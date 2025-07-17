#!/usr/bin/env node

import 'dotenv/config';
import { startBot } from './bot/index.js';
import { logger } from './utils/logger.js';

async function main() {
    try {
        logger.info('🚀 Starting Content Generator...');
        
        // Проверка обязательных переменных окружения
        const requiredEnvVars = [
            'TELEGRAM_BOT_TOKEN',
            'OPENAI_API_KEY',
            'ADMIN_TELEGRAM_ID'
        ];
        
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            logger.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
            logger.info('💡 Please copy env.example to .env and fill in your values');
            process.exit(1);
        }
        
        // Запуск бота
        await startBot();
        
        logger.info('✅ Content Generator started successfully!');
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            logger.info('🛑 Shutting down Content Generator...');
            process.exit(0);
        });
        
        process.on('SIGTERM', () => {
            logger.info('🛑 Shutting down Content Generator...');
            process.exit(0);
        });
        
    } catch (error) {
        logger.error('💥 Failed to start Content Generator:', error);
        process.exit(1);
    }
}

// Запуск приложения только если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('src/index.js')) {
    main();
} 