import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../utils/config.js';
import { CommandHandler } from './commands.js';
import { RateLimiter } from './rateLimiter.js';

let bot = null;
let config = null;

export async function startBot() {
    try {
        // Загрузка конфигурации
        config = await loadConfig();
        logger.info('📋 Configuration loaded');
        
        // Создание экземпляра бота
        bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
            polling: config.telegram.polling
        });
        
        // Инициализация компонентов
        const rateLimiter = new RateLimiter(config.rate_limiting);
        const commandHandler = new CommandHandler(config);
        
        // Обработка команд
        bot.on('message', async (msg) => {
            try {
                const userId = msg.from.id;
                const chatId = msg.chat.id;
                
                // Проверка доступа
                if (!isAuthorizedUser(userId)) {
                    await bot.sendMessage(chatId, '❌ У вас нет доступа к этому боту.');
                    logger.warn(`Unauthorized access attempt from user ${userId}`);
                    return;
                }
                
                // Проверка rate limiting
                if (!rateLimiter.checkLimit(userId)) {
                    await bot.sendMessage(chatId, '⏰ Превышен лимит запросов. Попробуйте позже.');
                    return;
                }
                
                // Обработка сообщения
                await commandHandler.handleMessage(bot, msg);
                
            } catch (error) {
                logger.error('Error handling message:', error);
                await bot.sendMessage(msg.chat.id, '💥 Произошла ошибка при обработке сообщения.');
            }
        });
        
        // Установка команд в меню бота
        await setMenuCommands();
        
        logger.success(`🤖 Telegram bot started successfully!`);
        
        // Уведомление администратора о запуске
        if (process.env.ADMIN_TELEGRAM_ID) {
            await bot.sendMessage(
                process.env.ADMIN_TELEGRAM_ID,
                `🚀 *Content Generator Bot запущен!*\n\nВерсия: ${config.bot.version}\nВремя запуска: ${new Date().toLocaleString()}`,
                { parse_mode: 'Markdown' }
            );
        }
        
    } catch (error) {
        logger.error('Failed to start Telegram bot:', error);
        throw error;
    }
}

function isAuthorizedUser(userId) {
    const adminId = process.env.ADMIN_TELEGRAM_ID;
    if (!adminId) return false;
    
    // Поддержка нескольких админов через запятую
    const adminIds = adminId.split(',').map(id => parseInt(id.trim()));
    return adminIds.includes(userId);
}

async function setMenuCommands() {
    try {
        const commands = config.commands.map(cmd => ({
            command: cmd.command,
            description: cmd.description
        }));
        
        await bot.setMyCommands(commands);
        logger.info('📋 Bot commands menu set successfully');
        
    } catch (error) {
        logger.warn('Failed to set bot commands menu:', error);
    }
}

export function getBotInstance() {
    return bot;
}

export function getConfig() {
    return config;
} 