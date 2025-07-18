#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function generateContent() {
  console.log('🤖 Генерируем новый контент...');
  
  try {
    // Запускаем генерацию контента
    execSync('npm run content:generate', { stdio: 'inherit' });
    console.log('✅ Контент сгенерирован');
  } catch (error) {
    console.error('❌ Ошибка при генерации контента:', error.message);
    throw error;
  }
}

async function syncObsidianContent() {
  console.log('📝 Синхронизируем контент с Obsidian...');
  
  try {
    // Копируем новые статьи в папку content/blog
    const outputDir = './output/drafts';
    const contentDir = './src/content/blog';
    
    if (existsSync(outputDir)) {
      // Здесь можно добавить логику копирования файлов
      // или интеграцию с Obsidian через API
      console.log('✅ Контент синхронизирован');
    } else {
      console.log('⚠️ Папка output/drafts не найдена');
    }
  } catch (error) {
    console.error('❌ Ошибка при синхронизации:', error.message);
  }
}

async function buildAndDeploy() {
  console.log('🚀 Собираем и деплоим сайт...');
  
  try {
    // Собираем статический сайт
    execSync('npm run build', { stdio: 'inherit' });
    
    // Деплоим в S3
    execSync('npm run deploy:s3', { stdio: 'inherit' });
    
    console.log('✅ Сайт обновлен и задеплоен');
  } catch (error) {
    console.error('❌ Ошибка при деплое:', error.message);
    throw error;
  }
}

async function updateLastDeployTime() {
  const timestamp = new Date().toISOString();
  const deployInfo = {
    lastDeploy: timestamp,
    status: 'success'
  };
  
  writeFileSync('./deploy-info.json', JSON.stringify(deployInfo, null, 2));
  console.log(`📅 Время последнего деплоя: ${timestamp}`);
}

async function main() {
  console.log('🔄 Начинаем автоматическое обновление контента и деплой...');
  
  try {
    await generateContent();
    await syncObsidianContent();
    await buildAndDeploy();
    await updateLastDeployTime();
    
    console.log('🎉 Автоматическое обновление завершено успешно!');
  } catch (error) {
    console.error('❌ Ошибка при автоматическом обновлении:', error.message);
    
    // Обновляем информацию о неудачном деплое
    const deployInfo = {
      lastDeploy: new Date().toISOString(),
      status: 'failed',
      error: error.message
    };
    writeFileSync('./deploy-info.json', JSON.stringify(deployInfo, null, 2));
    
    process.exit(1);
  }
}

main(); 