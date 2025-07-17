#!/usr/bin/env node

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { startBot } from './bot/index.js';
import { logger } from './utils/logger.js';

// Explicitly load .env and override process.env
try {
    const envConfig = dotenv.parse(readFileSync('.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
    logger.info('✅ .env file loaded successfully and variables are set.');
} catch (error) {
    logger.warn('⚠️ Could not find or parse .env file. Relying on system environment variables.');
}


async function main() {
    try {
        logger.info('🚀 Starting Content Generator...');
        
        // Check required environment variables
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
        
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            logger.info(`🔑 Using OpenAI API Key starting with: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`);
        }

        // Starting bot
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

// Starting application only if file is called directly
console.log('Starting bot...');
main(); 