import { readFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'yaml';
import { logger } from './logger.js';

let cachedConfig = null;

export async function loadConfig() {
    if (cachedConfig) {
        return cachedConfig;
    }
    
    try {
        const configPath = join(process.cwd(), 'config', 'bot.yaml');
        const configContent = await readFile(configPath, 'utf8');
        cachedConfig = yaml.parse(configContent);
        
        // Валидация конфигурации
        validateConfig(cachedConfig);
        
        logger.debug('Configuration loaded successfully');
        return cachedConfig;
        
    } catch (error) {
        logger.error('Failed to load configuration:', error);
        throw new Error(`Configuration loading failed: ${error.message}`);
    }
}

function validateConfig(config) {
    const requiredFields = [
        'bot.name',
        'bot.version',
        'telegram.polling',
        'ai.default_provider',
        'commands'
    ];
    
    for (const field of requiredFields) {
        if (!getNestedValue(config, field)) {
            throw new Error(`Missing required configuration field: ${field}`);
        }
    }
    
    // Проверка провайдеров AI
    const defaultProvider = config.ai.default_provider;
    if (!config.ai.providers[defaultProvider]) {
        throw new Error(`Default AI provider '${defaultProvider}' not found in providers configuration`);
    }
    
    logger.debug('Configuration validation passed');
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

export function getConfig() {
    if (!cachedConfig) {
        throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return cachedConfig;
} 