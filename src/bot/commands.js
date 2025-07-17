import { logger } from '../utils/logger.js';
import { createContentGenerator } from '../generators/index.js';
import { readdir, readFile, stat, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import matter from 'gray-matter';
import { exec } from 'child_process';

export class CommandHandler {
    constructor(config, rateLimiter) {
        this.config = config;
        this.rateLimiter = rateLimiter;
        this.userStates = new Map(); // Хранение состояний пользователей
        this.contentGenerator = createContentGenerator(config);
    }

    async handleMessage(bot, msg) {
        // A callback query has a 'data' property and a 'message' property.
        // A regular message has a 'text' or other content property, but not 'data'.
        const isCallback = !!msg.data && !!msg.message;

        const text = isCallback ? msg.data : msg.text;
        const userId = msg.from?.id;
        const chatId = isCallback ? msg.message.chat.id : msg.chat?.id;
        const originalMessage = isCallback ? msg.message : msg;

        // Проверка, что мы смогли определить пользователя и чат
        if (!userId || !chatId) {
            logger.warn('Could not determine user or chat ID from message:', msg);
            return;
        }

        try {
            // Check доступа
            if (!this.isAuthorized(userId)) {
                await bot.sendMessage(chatId, '❌ У вас нет доступа к этому боту.');
                logger.warn(`Unauthorized access attempt from user ${userId}`);
                return;
            }

            // Check rate limiting
            const rateLimitResult = this.rateLimiter.canMakeRequest(userId);
            if (!rateLimitResult.allowed) {
                const waitTime = this.rateLimiter.formatWaitTime(rateLimitResult.resetIn);
                await bot.sendMessage(chatId, `⏰ Превышен лимит запросов. Попробуйте через ${waitTime}.`);
                return;
            }
            this.rateLimiter.recordRequest(userId);


            // Обработка колбэков от кнопок
            if (isCallback) {
                const [action, ...params] = text.split(':');
                const value = params.join(':');

                switch (action) {
                    case 'view_draft':
                        await this.handleViewDraft(bot, msg, chatId, userId, parseInt(value, 10));
                        break;
                    case 'mark_for_publication':
                        await this.handleMarkForPublication(bot, msg, chatId, userId, parseInt(value, 10));
                        break;
                    // другие кейсы
                }
                return;
            }
            
            // Processing команд
            if (text?.startsWith('/')) {
                await this.handleCommand(bot, originalMessage);
            } else {
                // Processing обычных сообщений (в зависимости от состояния)
                await this.handleRegularMessage(bot, originalMessage);
            }
        } catch (error) {
            logger.error(`Error handling message from user ${userId}:`, error);
            await bot.sendMessage(chatId, '💥 Произошла ошибка при обработке сообщения.');
        }
    }

    isAuthorized(userId) {
        const adminId = process.env.ADMIN_TELEGRAM_ID;
        if (!adminId) return false;
        
        // Поддержка нескольких админов через запятую
        const adminIds = adminId.split(',').map(id => parseInt(id.trim()));
        return adminIds.includes(userId);
    }

    async handleCommand(bot, msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const [command, ...args] = msg.text.split(' ');
        const commandName = command.substring(1); // Убираем '/'

        logger.info(`User ${userId} executed command: ${commandName}`);

        switch (commandName) {
            case 'start':
                await this.handleStart(bot, chatId);
                break;
            case 'generate':
                await this.handleGenerate(bot, chatId, userId, args.join(' '));
                break;
            case 'templates':
                await this.handleTemplates(bot, chatId);
                break;
            case 'drafts':
                await this.handleDrafts(bot, chatId, userId);
                break;
            case 'settings':
                await this.handleSettings(bot, chatId, userId);
                break;
            case 'help':
                await this.handleHelp(bot, chatId);
                break;
            case 'status':
                await this.handleStatus(bot, chatId);
                break;
            case 'sync':
                await this.handleSync(bot, chatId, userId);
                break;
            case 'publish':
                await this.handlePublish(bot, chatId, userId, args.join(' '));
                break;
            default:
                await bot.sendMessage(chatId, `❓ Неизвестная команда: ${command}\n\nИспользуйте /help для списка команд.`);
        }
    }

    async handleStart(bot, chatId) {
        const welcomeMessage = `
👋 *Добро пожаловать в QContent!*

Я ваш AI ассистент для создания контента. Вот что я умею:

- */generate [тема]* - Создать черновик статьи на заданную тему.
- */drafts* - Показать список всех черновиков.
- */publish* - Опубликовать отмеченные статьи.
- */help* - Показать это сообщение.

Для начала, попробуйте сгенерировать вашу первую статью!
Например: \`/generate Как открыть кофейню в Эдинбурге\`
        `;
        await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    }

    async handleRegularMessage(bot, msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userState = this.userStates.get(userId);

        if (!userState) {
            await bot.sendMessage(chatId, '💡 Используйте команды для взаимодействия с ботом.\nНапример: /generate "ваша тема"');
            return;
        }

        // Processing состояний (будет расширено позже)
        switch (userState.action) {
            case 'waiting_for_topic':
                await this.handleGenerate(bot, chatId, userId, msg.text);
                break;
            default:
                await bot.sendMessage(chatId, '💡 Используйте команды для взаимодействия с ботом.');
        }
    }

    async handleGenerate(bot, chatId, userId, topic) {
        if (!topic || topic.trim().length === 0) {
            this.userStates.set(userId, { action: 'waiting_for_topic' });
            await bot.sendMessage(chatId, 'Пожалуйста, укажите тему для генерации статьи. \nНапример: /generate Лучшие места для зимовки в Европе');
            return;
        }

        try {
            await bot.sendMessage(chatId, '⏳ *Начинаю генерацию статьи...* Это может занять несколько минут.', { parse_mode: 'Markdown' });

            logger.info(`Starting content generation for topic: "${topic}" by user ${userId}`);

            const article = await this.contentGenerator.generateCompleteArticle(topic);
            const finalMessage = `
✅ *Статья успешно сгенерирована!*

**Тема:** ${article.title}
**Файл:** \`${article.filename}\`

Теперь вы можете найти ее в списке черновиков с помощью команды /drafts и пометить для публикации.
            `;
            await bot.sendMessage(chatId, finalMessage, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('Content generation error:', error);
            await bot.sendMessage(chatId, `❌ *Ошибка при генерации статьи:* ${error.message}`);
        } finally {
            this.userStates.delete(userId);
        }
    }

    async handleDrafts(bot, chatId, userId) {
        try {
            const draftsDir = join(this.contentGenerator.markdownGenerator.outputDir, 'drafts');

            // Проверяем, существует ли директория
            try {
                await stat(draftsDir);
            } catch (dirError) {
                if (dirError.code === 'ENOENT') {
                    await bot.sendMessage(chatId, '📂 Папка с черновиками еще не создана. Сначала сгенерируйте статью.');
                    return;
                }
                throw dirError; // Другие ошибки пробрасываем выше
            }

            const files = await readdir(draftsDir);
            const markdownFiles = files.filter(file => file.endsWith('.md'));

            if (markdownFiles.length === 0) {
                await bot.sendMessage(chatId, '📭 В папке нет черновиков.');
                return;
            }
            
            // Сохраняем список файлов в состояние пользователя
            this.userStates.set(userId, { command: 'drafts', files: markdownFiles });

            const keyboard = markdownFiles.map((file, index) => {
                const shortName = file.length > 50 ? `${file.substring(0, 50)}...` : file;
                return [{ text: shortName, callback_data: `view_draft:${index}` }];
            });

            await bot.sendMessage(chatId, '📝 *Ваши черновики:*', {
                reply_markup: {
                    inline_keyboard: keyboard,
                },
                parse_mode: 'Markdown'
            });

        } catch (error) {
            logger.error(`Failed to get drafts list for user ${userId}:`, error);
            await bot.sendMessage(chatId, '❌ Не удалось получить список черновиков.');
        }
    }

    async handleViewDraft(bot, callbackQuery, chatId, userId, draftIndex) {
        try {
            const state = this.userStates.get(userId);
            if (!state || state.command !== 'drafts' || !state.files) {
                await bot.sendMessage(chatId, '⚠️ Список черновиков устарел. Пожалуйста, вызовите /drafts снова.');
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            const fileName = state.files[draftIndex];
            if (!fileName) {
                await bot.sendMessage(chatId, '❌ Неверный индекс черновика. Пожалуйста, вызовите /drafts снова.');
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            const filePath = join(this.contentGenerator.markdownGenerator.outputDir, 'drafts', fileName);
            const content = await readFile(filePath, 'utf-8');

            // Отправляем укороченную версию или полный текст
            const message = `📄 *Черновик: ${fileName}*\n\n---\n\n${content.substring(0, 3500)}...`;

            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ Пометить для публикации', callback_data: `mark_for_publication:${draftIndex}` }],
                        [{ text: '🗑️ Удалить черновик (скоро)', callback_data: `delete_draft:${draftIndex}` }]
                    ]
                }
            });
            await bot.answerCallbackQuery(callbackQuery.id);

        } catch (error) {
            logger.error(`Failed to read draft for user ${userId}:`, error);
            await bot.sendMessage(chatId, `💥 Не удалось прочитать черновик.`);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '💥 Ошибка при чтении черновика' });
        }
    }

    async handleMarkForPublication(bot, callbackQuery, chatId, userId, draftIndex) {
        try {
            const state = this.userStates.get(userId);
            if (!state || state.command !== 'drafts' || !state.files) {
                await bot.sendMessage(chatId, '⚠️ Список черновиков устарел. Пожалуйста, вызовите /drafts снова.');
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            const fileName = state.files[draftIndex];
            if (!fileName) {
                await bot.sendMessage(chatId, '❌ Неверный индекс черновика. Пожалуйста, вызовите /drafts снова.');
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            const filePath = join(this.contentGenerator.markdownGenerator.outputDir, 'drafts', fileName);
            
            // Читаем файл, изменяем frontmatter и сохраняем
            const fileContent = await readFile(filePath, 'utf-8');
            const { data, content } = matter(fileContent);
            data.publish = true;
            
            const newContent = matter.stringify(content, data);
            await writeFile(filePath, newContent, 'utf-8');
            
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: `✅ Статья "${fileName}" помечена для публикации!`
            });
            
            await bot.editMessageReplyMarkup( {inline_keyboard: []} , {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id
            });

        } catch (error) {
            logger.error(`Failed to mark draft for publication for user ${userId}:`, error);
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '❌ Ошибка при пометке статьи для публикации'
            });
        }
    }


    async handleSettings(bot, chatId, userId) {
        const settingsMessage = `
⚙️ *Настройки генерации*

*Текущие настройки:*
• 🌐 Язык: Русский
• 📝 Объем: 1500-2000 слов
• 🎨 Стиль: Информативный
• 🖼️ Изображения: Включены
• 🔗 Автопубликация: Отключена

_Функция изменения настроек в разработке..._

По умолчанию используются настройки из конфигурации.
        `;

        await bot.sendMessage(chatId, settingsMessage, { 
            parse_mode: 'Markdown' 
        });
    }

    async handleHelp(bot, chatId) {
        const helpMessage = `
📚 *Справка по Content Generator*

*Main commands:*

🚀 \`/start\` - Начать работу
📝 \`/generate "тема"\` - Создать статью
📋 \`/templates\` - Доступные шаблоны
📂 \`/drafts\` - Управление черновиками
⚙️ \`/settings\` - Настройки
🔧 \`/status\` - Статус системы
🔄 \`/sync\` - Синхронизация с блогом
📰 \`/publish "файл.md"\` - Опубликовать черновик
❓ \`/help\` - Эта справка

*Примеры использования:*

\`/generate "Польза медитации"\`
\`/generate "React хуки"\`
\`/generate "Инвестиции для начинающих"\`

*Процесс создания статьи:*
1. Отправляете команду с темой
2. AI генерирует качественный контент
3. Автоматически подбирается изображение
4. Создается Markdown файл с метаданными
5. Файл сохраняется для публикации

*Особенности:*
• Генерация на русском языке
• SEO-оптимизированный контент
• Автоматическое форматирование
• Поддержка изображений

Возникли вопросы? Просто напишите администратору!
        `;

        await bot.sendMessage(chatId, helpMessage, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true 
        });
    }

    async handleStatus(bot, chatId) {
        try {
            const statusMessage = await bot.sendMessage(chatId, '🔍 Проверяю статус системы...', {
                parse_mode: 'Markdown'
            });

            // Получаем статус AI провайдеров и изображений
            const [aiProvidersStatus, imageProvidersStatus, templates] = await Promise.all([
                this.contentGenerator.getProvidersStatus(),
                this.contentGenerator.imageManager.checkProvidersHealth(),
                Promise.resolve(this.contentGenerator.getAvailableTemplates())
            ]);

            let statusText = `
🔧 *Статус Content Generator*

🤖 **AI Провайдеры:**
`;

            for (const provider of aiProvidersStatus) {
                const icon = provider.available ? '✅' : '❌';
                const status = provider.available ? 'Доступен' : 'Недоступен';
                const responseTime = provider.responseTime ? `(${provider.responseTime}ms)` : '';
                
                statusText += `• ${icon} ${provider.name}: ${status} ${responseTime}\n`;
            }

            statusText += `
🖼️ **Провайдеры изображений:**
`;

            for (const provider of imageProvidersStatus) {
                const icon = provider.available ? '✅' : '❌';
                const status = provider.available ? 'Доступен' : 'Недоступен';
                const responseTime = provider.responseTime ? `(${provider.responseTime}ms)` : '';
                
                statusText += `• ${icon} ${provider.name}: ${status} ${responseTime}\n`;
            }

            statusText += `
📋 **Шаблоны:** ${templates.length} доступно

🏥 **Система:** Работает
⏰ **Время проверки:** ${new Date().toLocaleString('ru-RU')}
`;

            await bot.editMessageText(statusText, {
                chat_id: chatId,
                message_id: statusMessage.message_id,
                parse_mode: 'Markdown'
            });

        } catch (error) {
            logger.error('Status check error:', error);
            
            await bot.sendMessage(chatId, `
❌ *Ошибка проверки статуса*

Не удалось получить информацию о состоянии системы.
Try again later.

Error: ${error.message}
            `, { parse_mode: 'Markdown' });
        }
    }

    async handleSync(bot, chatId, userId) {
        try {
            const statusMessage = await bot.sendMessage(chatId, '🔄 Синхронизация с блогом...', {
                parse_mode: 'Markdown'
            });

            // Получаем статистику перед синхронизацией
            const statsBefore = await this.contentGenerator.getBlogIntegrationStats();

            // Выполняем синхронизацию
            const syncResult = await this.contentGenerator.syncWithBlog();

            if (syncResult.success) {
                let message = `✅ *Синхронизация завершена*\n\n`;
                
                if (syncResult.syncedFiles.length > 0) {
                    message += `📋 **Синхронизировано файлов:** ${syncResult.successCount}/${syncResult.totalFiles}\n\n`;
                    
                    message += `**Новые файлы:**\n`;
                    syncResult.syncedFiles.slice(0, 5).forEach(file => {
                        const status = file.result.success ? '✅' : '❌';
                        message += `• ${status} ${file.fileName}\n`;
                    });
                    
                    if (syncResult.syncedFiles.length > 5) {
                        message += `_... и еще ${syncResult.syncedFiles.length - 5} файлов_\n`;
                    }
                } else {
                    message += `ℹ️ Нет новых файлов для синхронизации`;
                }

                message += `\n⏰ ${new Date().toLocaleString('ru-RU')}`;

                await bot.editMessageText(message, {
                    chat_id: chatId,
                    message_id: statusMessage.message_id,
                    parse_mode: 'Markdown'
                });

            } else {
                await bot.editMessageText(`
❌ *Ошибка синхронизации*

💥 Не удалось синхронизировать файлы с блогом.

Error: ${syncResult.error}

Try again later или обратитесь к администратору.
                `, {
                    chat_id: chatId,
                    message_id: statusMessage.message_id,
                    parse_mode: 'Markdown'
                });
            }

        } catch (error) {
            logger.error('Sync command error:', error);
            
            await bot.sendMessage(chatId, `
❌ *Критическая ошибка синхронизации*

Не удалось выполнить синхронизацию.
Try again later.

Error: ${error.message}
            `, { parse_mode: 'Markdown' });
        }
    }

    async handlePublish(bot, chatId, userId, fileName) {
        const statusMessage = await bot.sendMessage(chatId, '🚀 *Начинаю публикацию...*', { parse_mode: 'Markdown' });

        try {
            await bot.editMessageText('🔄 Синхронизирую файлы...', {
                chat_id: chatId,
                message_id: statusMessage.message_id,
                parse_mode: 'Markdown'
            });

            const syncOutput = await this.runScript('scripts/sync-obsidian.js');
            logger.info(syncOutput);

            await bot.editMessageText('🏗️ Собираю сайт...', {
                chat_id: chatId,
                message_id: statusMessage.message_id,
                parse_mode: 'Markdown'
            });
            
            const buildOutput = await this.runScript(null, 'npm run build');
            logger.info(buildOutput);

            await bot.editMessageText('✅ *Публикация завершена!*', {
                chat_id: chatId,
                message_id: statusMessage.message_id,
                parse_mode: 'Markdown'
            });

        } catch (error) {
            logger.error(`Publication failed for user ${userId}:`, error);
            await bot.editMessageText(`💥 *Ошибка публикации:* ${error.message}`, {
                chat_id: chatId,
                message_id: statusMessage.message_id,
                parse_mode: 'Markdown'
            });
        }
    }

    runScript(scriptPath, command = null) {
        return new Promise((resolve, reject) => {
            const cmd = command ? command : `node ${scriptPath}`;
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    return reject(new Error(stderr || stdout));
                }
                resolve(stdout);
            });
        });
    }


    async handleSettings(bot, chatId, userId) {
        const settingsMessage = `
⚙️ *Настройки генерации*

*Текущие настройки:*
• 🌐 Язык: Русский
• 📝 Объем: 1500-2000 слов
• 🎨 Стиль: Информативный
• 🖼️ Изображения: Включены
• 🔗 Автопубликация: Отключена

_Функция изменения настроек в разработке..._

По умолчанию используются настройки из конфигурации.
        `;

        await bot.sendMessage(chatId, settingsMessage, { 
            parse_mode: 'Markdown' 
        });
    }
} 