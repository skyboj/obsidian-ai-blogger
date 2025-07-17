#!/usr/bin/env node

import 'dotenv/config';
import { createContentGenerator } from './generators/index.js';
import { loadConfig } from './utils/config.js';
import { logger } from './utils/logger.js';

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        showHelp();
        process.exit(0);
    }

    try {
        const action = args[0];
        const topic = args[1];

        // Загрузка конфигурации
        const config = await loadConfig();
        const contentGenerator = createContentGenerator({
            ...config,
            outputDir: './output',
            blogFolderPath: process.env.BLOG_FOLDER_PATH || '../obsidian-blogger/Blog'
        });

        switch (action) {
            case 'generate':
                await testGeneration(contentGenerator, topic);
                break;
            case 'status':
                await testStatus(contentGenerator);
                break;
            case 'sync':
                await testSync(contentGenerator);
                break;
            case 'blog-stats':
                await testBlogStats(contentGenerator);
                break;
            case 'full':
                await testFullWorkflow(contentGenerator, topic);
                break;
            default:
                logger.error(`Unknown action: ${action}`);
                showHelp();
                process.exit(1);
        }

    } catch (error) {
        logger.error('💥 Test failed:', error);
        process.exit(1);
    }
}

async function testGeneration(contentGenerator, topic) {
    if (!topic) {
        logger.error('Topic is required for generation test');
        process.exit(1);
    }

    logger.info(`🧪 Testing content generation for: "${topic}"`);

    const result = await contentGenerator.generateCompleteArticle({
        topic,
        template: 'default',
        variables: {
            target_audience: 'широкая аудитория',
            style: 'информативный и доступный'
        }
    });

    if (result.success) {
        console.log('\n' + '='.repeat(80));
        console.log('✅ GENERATION TEST PASSED');
        console.log('='.repeat(80));
        console.log(`📝 Topic: ${result.topic}`);
        console.log(`📄 File: ${result.file.filename}`);
        console.log(`📊 Words: ${result.content.wordCount}`);
        console.log(`⏱️ Reading time: ${result.content.readingTime.text}`);
        console.log(`🤖 AI Provider: ${result.metadata.aiProvider}`);
        console.log(`📂 Path: ${result.file.path}`);

        // Показываем frontmatter
        console.log('\n📋 FRONTMATTER:');
        console.log(JSON.stringify(result.metadata.frontmatter, null, 2));

        // Показываем начало контента
        console.log('\n📝 CONTENT PREVIEW (first 200 chars):');
        console.log(result.content.text.substring(0, 200) + '...');

    } else {
        logger.error(`❌ Generation failed: ${result.error}`);
        process.exit(1);
    }
}

async function testStatus(contentGenerator) {
    logger.info('🧪 Testing system status...');

    const [aiStatus, imageStatus, templates, blogStats] = await Promise.all([
        contentGenerator.getProvidersStatus(),
        contentGenerator.imageManager.checkProvidersHealth(),
        Promise.resolve(contentGenerator.getAvailableTemplates()),
        contentGenerator.getBlogIntegrationStats()
    ]);

    console.log('\n' + '='.repeat(80));
    console.log('🔧 SYSTEM STATUS');
    console.log('='.repeat(80));

    console.log('\n🤖 AI PROVIDERS:');
    aiStatus.forEach(provider => {
        const status = provider.available ? '✅ Available' : '❌ Unavailable';
        console.log(`  • ${provider.name}: ${status} (${provider.responseTime}ms)`);
    });

    console.log('\n🖼️ IMAGE PROVIDERS:');
    imageStatus.forEach(provider => {
        const status = provider.available ? '✅ Available' : '❌ Unavailable';
        console.log(`  • ${provider.name}: ${status} (${provider.responseTime}ms)`);
    });

    console.log(`\n📋 TEMPLATES: ${templates.length} available`);
    templates.forEach(template => {
        console.log(`  • ${template.name}: ${template.description}`);
    });

    console.log('\n🔗 BLOG INTEGRATION:');
    if (blogStats.error) {
        console.log(`  ❌ Error: ${blogStats.error}`);
    } else {
        console.log(`  📁 Generator files: ${blogStats.generatorFiles}`);
        console.log(`  📰 Blog files: ${blogStats.blogFiles}`);
        console.log(`  🔄 Common files: ${blogStats.commonFiles}`);
        console.log(`  ✨ New files: ${blogStats.newFiles}`);
        console.log(`  🔗 Blog accessible: ${blogStats.blogAccess.accessible ? '✅' : '❌'}`);
        console.log(`  ✏️ Blog writable: ${blogStats.blogAccess.writable ? '✅' : '❌'}`);
        console.log(`  📂 Blog path: ${blogStats.blogAccess.path}`);
    }
}

async function testSync(contentGenerator) {
    logger.info('🧪 Testing blog synchronization...');

    const result = await contentGenerator.syncWithBlog();

    if (result.success) {
        console.log('\n' + '='.repeat(80));
        console.log('✅ SYNC TEST PASSED');
        console.log('='.repeat(80));
        console.log(`📋 Total files: ${result.totalFiles}`);
        console.log(`✅ Synced successfully: ${result.successCount}`);

        if (result.syncedFiles.length > 0) {
            console.log('\n📄 SYNCED FILES:');
            result.syncedFiles.forEach(file => {
                const status = file.result.success ? '✅' : '❌';
                console.log(`  ${status} ${file.fileName}`);
            });
        } else {
            console.log('\nℹ️ No new files to sync');
        }

    } else {
        logger.error(`❌ Sync failed: ${result.error}`);
        process.exit(1);
    }
}

async function testBlogStats(contentGenerator) {
    logger.info('🧪 Testing blog integration stats...');

    const stats = await contentGenerator.getBlogIntegrationStats();

    console.log('\n' + '='.repeat(80));
    console.log('📊 BLOG INTEGRATION STATS');
    console.log('='.repeat(80));

    if (stats.error) {
        console.log(`❌ Error: ${stats.error}`);
        return;
    }

    console.log(`📁 Generator files: ${stats.generatorFiles}`);
    console.log(`📰 Blog files: ${stats.blogFiles}`);
    console.log(`🔄 Common files: ${stats.commonFiles}`);
    console.log(`✨ New files ready to sync: ${stats.newFiles}`);
    console.log(`🔗 Auto sync: ${stats.autoSync ? 'Enabled' : 'Disabled'}`);

    console.log('\n🏥 BLOG FOLDER ACCESS:');
    console.log(`  📂 Path: ${stats.blogAccess.path}`);
    console.log(`  🔍 Accessible: ${stats.blogAccess.accessible ? '✅' : '❌'}`);
    console.log(`  ✏️ Writable: ${stats.blogAccess.writable ? '✅' : '❌'}`);
    
    if (stats.blogAccess.error) {
        console.log(`  ❌ Error: ${stats.blogAccess.error}`);
    }
}

async function testFullWorkflow(contentGenerator, topic) {
    if (!topic) {
        logger.error('Topic is required for full workflow test');
        process.exit(1);
    }

    logger.info(`🧪 Testing FULL WORKFLOW for: "${topic}"`);

    console.log('\n' + '='.repeat(80));
    console.log('🚀 FULL WORKFLOW TEST');
    console.log('='.repeat(80));

    // 1. Генерация статьи
    console.log('\n📝 Step 1: Generating article...');
    const result = await contentGenerator.generateCompleteArticle({
        topic,
        template: 'default'
    });

    if (!result.success) {
        logger.error(`❌ Generation failed: ${result.error}`);
        process.exit(1);
    }

    console.log(`✅ Article generated: ${result.file.filename}`);

    // 2. Тестирование статуса
    console.log('\n🔧 Step 2: Checking system status...');
    const [aiStatus, imageStatus] = await Promise.all([
        contentGenerator.getProvidersStatus(),
        contentGenerator.imageManager.checkProvidersHealth()
    ]);

    const aiAvailable = aiStatus.some(p => p.available);
    const imageAvailable = imageStatus.some(p => p.available);
    
    console.log(`✅ AI providers: ${aiAvailable ? 'Available' : 'Unavailable'}`);
    console.log(`✅ Image providers: ${imageAvailable ? 'Available' : 'Unavailable'}`);

    // 3. Синхронизация с блогом
    console.log('\n🔄 Step 3: Syncing with blog...');
    const syncResult = await contentGenerator.syncWithBlog();
    
    if (syncResult.success) {
        console.log(`✅ Sync completed: ${syncResult.successCount} files`);
    } else {
        console.log(`⚠️ Sync failed: ${syncResult.error}`);
    }

    // 4. Финальная статистика
    console.log('\n📊 Step 4: Final stats...');
    const finalStats = await contentGenerator.getBlogIntegrationStats();
    
    if (!finalStats.error) {
        console.log(`📁 Total generator files: ${finalStats.generatorFiles}`);
        console.log(`📰 Total blog files: ${finalStats.blogFiles}`);
        console.log(`✨ New files: ${finalStats.newFiles}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 FULL WORKFLOW TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log(`📝 Generated: ${result.file.filename}`);
    console.log(`📊 Words: ${result.content.wordCount}`);
    console.log(`🤖 AI: ${result.metadata.aiProvider}`);
    console.log(`🖼️ Image: ${result.metadata.frontmatter.featured_image ? 'Yes' : 'No'}`);
    console.log(`🔄 Synced: ${syncResult.success ? 'Yes' : 'No'}`);
}

function showHelp() {
    console.log(`
🧪 Full System Test CLI

ИСПОЛЬЗОВАНИЕ:
  node src/testFull.js <action> [topic]

ДЕЙСТВИЯ:
  generate <topic>     Тест генерации статьи
  status              Тест статуса системы  
  sync                Тест синхронизации с блогом
  blog-stats          Статистика интеграции с блогом
  full <topic>        Полный тест workflow

ПРИМЕРЫ:
  node src/testFull.js generate "Искусственный интеллект"
  node src/testFull.js status
  node src/testFull.js sync
  node src/testFull.js full "Веб-разработка 2024"

ТРЕБОВАНИЯ:
  • .env файл с API ключами
  • Доступ к папке блога (если тестируете интеграцию)
  • Рабочие AI провайдеры

ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ:
  OPENAI_API_KEY      - Обязательный
  UNSPLASH_ACCESS_KEY - Опциональный
  BLOG_FOLDER_PATH    - Путь к папке блога
    `);
}

// Запуск если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('Test CLI failed:', error);
        process.exit(1);
    });
} 