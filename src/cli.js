#!/usr/bin/env node

import 'dotenv/config';
import { createAIManager } from './ai/index.js';
import { loadConfig } from './utils/config.js';
import { logger } from './utils/logger.js';

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
🤖 Content Generator CLI

Usage:
  npm run content:generate "Article topic"
  node src/cli.js "Artificial Intelligence in 2024"

Options:
  --provider <name>    Choose AI provider (openai)
  --model <name>       Model for generation
  --help               Show this help
        `);
        process.exit(0);
    }

    if (args.includes('--help')) {
        showHelp();
        process.exit(0);
    }

    try {
        // Загрузка конфигурации
        const config = await loadConfig();
        const aiManager = createAIManager(config.ai);

        // Парсинг аргументов
        const topic = args.find(arg => !arg.startsWith('--')) || args[0];
        const provider = getArgValue(args, '--provider');
        const model = getArgValue(args, '--model');

        if (!topic) {
            logger.error('❌ Укажите тему для генерации');
            process.exit(1);
        }

        logger.info(`🎯 Генерирую контент на тему: "${topic}"`);
        
        if (provider) {
            logger.info(`🔧 Используемый провайдер: ${provider}`);
        }

        // Check доступности провайдеров
        const healthChecks = await aiManager.checkProvidersHealth();
        logger.info('🏥 Статус провайдеров:');
        healthChecks.forEach(check => {
            const status = check.available ? '✅' : '❌';
            logger.info(`  ${status} ${check.name}: ${check.status} (${check.responseTime}ms)`);
        });

        // Creating простого промпта
        const prompt = `Напиши подробную и интересную статью на тему: ${topic}

Требования:
- Объем: 1500-2000 слов
- Язык: русский
- Стиль: информативный и доступный
- Структура: введение, основная часть, заключение
- Включи практические примеры и полезные советы

Не используй заголовок в тексте - он будет добавлен отдельно.`;

        // Генерация контента
        const result = await aiManager.generate(prompt, {
            provider,
            model
        });

        if (result.success) {
            logger.success('✅ Контент успешно сгенерирован!');
            
            console.log('\n' + '='.repeat(80));
            console.log('📝 СГЕНЕРИРОВАННЫЙ КОНТЕНТ:');
            console.log('='.repeat(80));
            console.log(result.content);
            console.log('='.repeat(80));
            
            console.log('\n📊 МЕТАДАННЫЕ:');
            console.log(`• Провайдер: ${result.provider}`);
            console.log(`• Модель: ${result.metadata.model || 'N/A'}`);
            console.log(`• Токенов использовано: ${result.metadata.tokensUsed || 'N/A'}`);
            console.log(`• Время генерации: ${result.metadata.timestamp}`);
            
            // Оценка стоимости
            if (result.metadata.promptTokens && result.metadata.completionTokens) {
                const cost = await aiManager.estimateGenerationCost(prompt, provider);
                if (cost) {
                    console.log(`• Примерная стоимость: $${cost.totalCost.toFixed(6)} ${cost.currency}`);
                }
            }
            
        } else {
            logger.error(`❌ Ошибка генерации: ${result.message}`);
            if (result.lastError) {
                logger.error('Детали ошибки:', result.lastError);
            }
            process.exit(1);
        }

    } catch (error) {
        logger.error('💥 Критическая ошибка:', error);
        process.exit(1);
    }
}

function getArgValue(args, flag) {
    const index = args.indexOf(flag);
    return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

function showHelp() {
    console.log(`
🤖 Content Generator CLI - Справка

ИСПОЛЬЗОВАНИЕ:
  npm run generate "Тема статьи"
  node src/cli.js "Тема" [опции]

ПРИМЕРЫ:
  npm run generate "Искусственный интеллект в медицине"
  node src/cli.js "Веб-разработка в 2024" --provider openai
  node src/cli.js "Здоровое питание" --provider openai --model gpt-4o-mini

ОПЦИИ:
  --provider <name>    Выбор AI провайдера
                       Доступные: openai
                       По умолчанию: из конфигурации

  --model <name>       Модель для генерации
                       OpenAI: gpt-4o-mini, gpt-4o, gpt-3.5-turbo

  --help              Показать эту справку

ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ:
  Скопируйте env.example в .env и заполните:
  • OPENAI_API_KEY      - Ключ OpenAI API

КОНФИГУРАЦИЯ:
  Настройки в config/bot.yaml, секция ai:
  • default_provider    - Провайдер по умолчанию
  • providers          - Настройки каждого провайдера
    `);
}

// Запуск CLI если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('CLI failed:', error);
        process.exit(1);
    });
} 