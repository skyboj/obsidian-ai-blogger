import { logger } from '../utils/logger.js';
import { createContentGenerator } from '../generators/index.js';

export class CommandHandler {
    constructor(config) {
        this.config = config;
        this.userStates = new Map(); // Хранение состояний пользователей
        this.contentGenerator = createContentGenerator(config);
    }

    async handleMessage(bot, msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text;

        try {
            // Обработка команд
            if (text?.startsWith('/')) {
                await this.handleCommand(bot, msg);
            } else {
                // Обработка обычных сообщений (в зависимости от состояния)
                await this.handleRegularMessage(bot, msg);
            }
        } catch (error) {
            logger.error(`Error handling message from user ${userId}:`, error);
            await bot.sendMessage(chatId, '💥 Произошла ошибка при обработке сообщения.');
        }
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

    async handleRegularMessage(bot, msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userState = this.userStates.get(userId);

        if (!userState) {
            await bot.sendMessage(chatId, '💡 Используйте команды для взаимодействия с ботом.\nНапример: /generate "ваша тема"');
            return;
        }

        // Обработка состояний (будет расширено позже)
        switch (userState.action) {
            case 'waiting_for_topic':
                await this.handleGenerate(bot, chatId, userId, msg.text);
                break;
            default:
                await bot.sendMessage(chatId, '💡 Используйте команды для взаимодействия с ботом.');
        }
    }

    async handleStart(bot, chatId) {
        const welcomeMessage = `
🤖 *Добро пожаловать в Content Generator!*

Я помогу вам создавать качественные статьи с помощью AI.

*Основные команды:*
• /generate "тема" - Создать новую статью
• /templates - Доступные шаблоны
• /drafts - Управление черновиками
• /settings - Настройки
• /help - Подробная справка

*Пример использования:*
\`/generate "Искусственный интеллект в 2024"\`

Готовы начать? 🚀
        `;

        await bot.sendMessage(chatId, welcomeMessage, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true 
        });
    }

    async handleGenerate(bot, chatId, userId, topic) {
        if (!topic || topic.trim() === '') {
            await bot.sendMessage(chatId, `
❓ *Укажите тему для статьи*

Примеры:
• \`/generate "Машинное обучение"\`
• \`/generate "Здоровое питание"\`
• \`/generate "Веб-разработка"\`

Или просто отправьте тему следующим сообщением.
            `, { parse_mode: 'Markdown' });
            
            this.userStates.set(userId, { action: 'waiting_for_topic' });
            return;
        }

        // Очищаем состояние пользователя
        this.userStates.delete(userId);

        const statusMessage = await bot.sendMessage(chatId, `
🎯 *Генерирую статью на тему:* "${topic}"

⏳ Это займет 1-2 минуты...
📝 Создаю контент с помощью AI
🔍 Генерирую описание и теги
🖼️ Подбираю подходящее изображение
📄 Формирую итоговый файл

_Пожалуйста, подождите..._
        `, { parse_mode: 'Markdown' });

        try {
            logger.info(`Starting content generation for topic: "${topic}" by user ${userId}`);
            
            // Генерация контента
            const result = await this.contentGenerator.generateCompleteArticle({
                topic: topic,
                template: 'default',
                variables: {
                    target_audience: 'широкая аудитория',
                    style: 'информативный и доступный'
                }
            });

            if (result.success) {
                await bot.editMessageText(`
✅ *Статья готова!*

📝 **Тема:** "${result.topic}"
📊 **Статус:** Черновик
💾 **Сохранено в:** ${result.file.filename}

📈 **Статистика:**
• Слов: ${result.content.wordCount}
• Время чтения: ${result.content.readingTime.text}
• Размер: ${Math.round(result.file.size / 1024)} КБ
• AI модель: ${result.metadata.model || 'N/A'}

*Следующие шаги:*
• /drafts - Просмотреть черновики
• Редактировать и опубликовать

🎉 Генерация завершена!
                `, {
                    chat_id: chatId,
                    message_id: statusMessage.message_id,
                    parse_mode: 'Markdown'
                });

            } else {
                await bot.editMessageText(`
❌ *Ошибка генерации*

🎯 Тема: "${topic}"
💥 Ошибка: ${result.error}

Попробуйте:
• Проверить доступность AI провайдеров
• Изменить формулировку темы
• Попробовать позже

_Если проблема повторится, обратитесь к администратору._
                `, {
                    chat_id: chatId,
                    message_id: statusMessage.message_id,
                    parse_mode: 'Markdown'
                });
            }

        } catch (error) {
            logger.error('Content generation error:', error);
            
            await bot.editMessageText(`
💥 *Критическая ошибка*

Не удалось сгенерировать статью.
Попробуйте позже или обратитесь к администратору.

Ошибка: ${error.message}
            `, {
                chat_id: chatId,
                message_id: statusMessage.message_id,
                parse_mode: 'Markdown'
            });
        }
    }

    async handleTemplates(bot, chatId) {
        const templatesMessage = `
📋 *Доступные шаблоны:*

1️⃣ **Универсальная статья** (по умолчанию)
   • Подходит для любых тем
   • Информативный стиль
   • 1500-2000 слов

2️⃣ **Техническая статья** _(скоро)_
   • Для IT и технических тем
   • С примерами кода
   • Пошаговые инструкции

3️⃣ **Лайфстайл статья** _(скоро)_
   • Личная история
   • Практические советы
   • Легкий стиль

*Использование:*
\`/generate "ваша тема"\` - использует базовый шаблон

_В будущих версиях можно будет выбирать шаблон._
        `;

        await bot.sendMessage(chatId, templatesMessage, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true 
        });
    }

    async handleDrafts(bot, chatId, userId) {
        const draftsMessage = `
📂 *Управление черновиками*

_Функция в разработке..._

Планируемые возможности:
• 📋 Список всех черновиков
• ✏️ Редактирование
• 👁️ Предпросмотр
• 🚀 Публикация в блог
• 🗑️ Удаление

Пока что файлы сохраняются в папку \`drafts/\`
        `;

        await bot.sendMessage(chatId, draftsMessage, { 
            parse_mode: 'Markdown' 
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

    async handleHelp(bot, chatId) {
        const helpMessage = `
📚 *Справка по Content Generator*

*Основные команды:*

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
Попробуйте позже.

Ошибка: ${error.message}
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

Ошибка: ${syncResult.error}

Попробуйте позже или обратитесь к администратору.
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
Попробуйте позже.

Ошибка: ${error.message}
            `, { parse_mode: 'Markdown' });
        }
    }

    async handlePublish(bot, chatId, userId, fileName) {
        if (!fileName || fileName.trim() === '') {
            await bot.sendMessage(chatId, `
❓ *Укажите имя файла для публикации*

Примеры:
• \`/publish article-name.md\`
• \`/publish 2024-12-16-my-article.md\`

Используйте /drafts для просмотра доступных черновиков.
            `, { parse_mode: 'Markdown' });
            return;
        }

        try {
            const statusMessage = await bot.sendMessage(chatId, `
📰 *Публикую черновик:* "${fileName}"

⏳ Копирую в основную папку блога...
            `, { parse_mode: 'Markdown' });

            const publishResult = await this.contentGenerator.publishDraft(fileName);

            if (publishResult.success) {
                await bot.editMessageText(`
✅ *Черновик опубликован!*

📝 **Файл:** ${fileName}
📂 **Перемещен в:** основную папку блога
🔗 **Готов к синхронизации** с сайтом

*Следующие шаги:*
• Файл готов для sync-obsidian.js
• Будет опубликован при следующей сборке сайта

🎉 Публикация завершена!
                `, {
                    chat_id: chatId,
                    message_id: statusMessage.message_id,
                    parse_mode: 'Markdown'
                });

            } else {
                let errorMessage = `❌ *Ошибка публикации*\n\n`;
                
                if (publishResult.error === 'DRAFT_NOT_FOUND') {
                    errorMessage += `📂 Черновик "${fileName}" не найден.\n\n`;
                    errorMessage += `Проверьте:\n`;
                    errorMessage += `• Правильность имени файла\n`;
                    errorMessage += `• Существование файла в папке drafts\n`;
                    errorMessage += `• Используйте /drafts для просмотра доступных черновиков`;
                } else {
                    errorMessage += `💥 ${publishResult.message || publishResult.error}\n\n`;
                    errorMessage += `Попробуйте позже или обратитесь к администратору.`;
                }

                await bot.editMessageText(errorMessage, {
                    chat_id: chatId,
                    message_id: statusMessage.message_id,
                    parse_mode: 'Markdown'
                });
            }

        } catch (error) {
            logger.error('Publish command error:', error);
            
            await bot.sendMessage(chatId, `
❌ *Критическая ошибка публикации*

Не удалось опубликовать черновик "${fileName}".
Попробуйте позже.

Ошибка: ${error.message}
            `, { parse_mode: 'Markdown' });
        }
    }
} 