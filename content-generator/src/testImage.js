#!/usr/bin/env node

import 'dotenv/config';
import { createImageManager } from './media/index.js';
import { logger } from './utils/logger.js';

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
🖼️ Image Search CLI

Использование:
  node src/testImage.js "keyword"
  node src/testImage.js "технологии"

Опции:
  --provider <name>     Провайдер (unsplash)
  --limit <number>      Количество изображений (по умолчанию 5)
  --orientation <type>  Ориентация (landscape, portrait, square)
        `);
        process.exit(0);
    }

    try {
        const keyword = args.find(arg => !arg.startsWith('--')) || args[0];
        const provider = getArgValue(args, '--provider') || 'unsplash';
        const limit = parseInt(getArgValue(args, '--limit')) || 5;
        const orientation = getArgValue(args, '--orientation') || 'landscape';

        logger.info(`🔍 Searching for images: "${keyword}"`);
        
        // Создаем image manager
        const imageManager = createImageManager({
            provider,
            orientation,
            size: 'regular'
        });

        // Проверяем доступность провайдеров
        const healthChecks = await imageManager.checkProvidersHealth();
        logger.info('🏥 Image providers status:');
        healthChecks.forEach(check => {
            const status = check.available ? '✅' : '❌';
            logger.info(`  ${status} ${check.name}: ${check.status} (${check.responseTime}ms)`);
        });

        if (healthChecks.length === 0 || !healthChecks.some(check => check.available)) {
            logger.error('❌ No image providers available');
            logger.info('💡 Make sure you have UNSPLASH_ACCESS_KEY in your .env file');
            process.exit(1);
        }

        // Поиск изображений
        const result = await imageManager.searchImages(keyword, {
            limit,
            orientation,
            filters: {
                minWidth: 800,
                minHeight: 600
            }
        });

        if (result.success && result.images.length > 0) {
            logger.success(`✅ Found ${result.images.length} images!`);
            
            console.log('\n' + '='.repeat(80));
            console.log('🖼️ FOUND IMAGES:');
            console.log('='.repeat(80));
            
            result.images.forEach((image, index) => {
                console.log(`\n${index + 1}. ${image.title || 'Untitled'}`);
                console.log(`   URL: ${image.url}`);
                console.log(`   Size: ${image.width}x${image.height}`);
                console.log(`   Author: ${image.author || 'Unknown'}`);
                console.log(`   Source: ${image.source}`);
                if (image.description) {
                    console.log(`   Description: ${image.description}`);
                }
                if (image.tags && image.tags.length > 0) {
                    console.log(`   Tags: ${image.tags.slice(0, 5).join(', ')}`);
                }
            });
            
            console.log('\n' + '='.repeat(80));
            console.log('📊 SEARCH METADATA:');
            console.log(`• Query: ${result.metadata.query || keyword}`);
            console.log(`• Total results: ${result.metadata.totalResults || 'N/A'}`);
            console.log(`• Provider: ${result.provider}`);
            console.log(`• Search time: ${result.metadata.timestamp}`);
            
            // Тест получения лучшего изображения
            logger.info('\n🎯 Testing getBestImageForTopic...');
            const bestResult = await imageManager.getBestImageForTopic(keyword);
            
            if (bestResult.success) {
                console.log('\n🏆 BEST IMAGE:');
                console.log(`• Title: ${bestResult.image.title || 'Untitled'}`);
                console.log(`• URL: ${bestResult.image.url}`);
                console.log(`• Size: ${bestResult.image.width}x${bestResult.image.height}`);
                console.log(`• Author: ${bestResult.image.author}`);
                console.log(`• Keywords used: ${bestResult.searchKeywords.join(', ')}`);
                
                // Показываем Markdown
                const markdown = imageManager.createImageMarkdown(bestResult.image, {
                    includeAttribution: true
                });
                console.log('\n📝 MARKDOWN:');
                console.log(markdown);
            }
            
        } else {
            logger.error(`❌ No images found for "${keyword}"`);
            if (result.message) {
                console.log(`Error: ${result.message}`);
            }
        }

    } catch (error) {
        logger.error('💥 Error:', error);
        process.exit(1);
    }
}

function getArgValue(args, flag) {
    const index = args.indexOf(flag);
    return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

// Запуск если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('CLI failed:', error);
        process.exit(1);
    });
} 