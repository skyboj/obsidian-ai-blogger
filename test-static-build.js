#!/usr/bin/env node

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log('🧪 Тестируем статическую сборку...');

try {
  // Очищаем предыдущую сборку
  console.log('🧹 Очищаем предыдущую сборку...');
  execSync('rm -rf dist', { stdio: 'inherit' });
  
  // Собираем сайт
  console.log('🔨 Собираем статический сайт...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Проверяем результат
  console.log('📁 Проверяем собранные файлы...');
  const distDir = './dist';
  const files = getAllFiles(distDir);
  
  console.log(`✅ Собрано ${files.length} файлов:`);
  
  // Показываем структуру
  const fileTypes = {};
  files.forEach(file => {
    const ext = file.split('.').pop()?.toLowerCase();
    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
  });
  
  Object.entries(fileTypes).forEach(([ext, count]) => {
    console.log(`   ${ext}: ${count} файлов`);
  });
  
  // Проверяем наличие основных файлов
  const requiredFiles = ['index.html', 'blog/index.html', 'about/index.html'];
  const missingFiles = requiredFiles.filter(file => !files.some(f => f.includes(file)));
  
  if (missingFiles.length > 0) {
    console.log('⚠️ Отсутствуют файлы:', missingFiles);
  } else {
    console.log('✅ Все основные файлы присутствуют');
  }
  
  console.log('🎉 Тест сборки завершен успешно!');
  console.log('📂 Файлы готовы в папке dist/');
  
} catch (error) {
  console.error('❌ Ошибка при тестировании:', error.message);
  process.exit(1);
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = join(dirPath, file);
    
    if (statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  
  return arrayOfFiles;
} 