#!/usr/bin/env node

import { execSync } from 'child_process';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const DIST_DIR = './dist';

async function buildSite() {
  console.log('🔨 Собираем статический сайт...');
  
  try {
    // Очищаем предыдущую сборку
    execSync('rm -rf dist', { stdio: 'inherit' });
    
    // Собираем сайт
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('✅ Сайт собран успешно');
  } catch (error) {
    console.error('❌ Ошибка при сборке сайта:', error.message);
    process.exit(1);
  }
}

async function uploadToS3() {
  console.log('📤 Загружаем файлы в S3...');
  
  if (!BUCKET_NAME) {
    console.error('❌ S3_BUCKET_NAME не указан в .env');
    process.exit(1);
  }

  try {
    // Получаем список всех файлов в dist
    const files = getAllFiles(DIST_DIR);
    
    console.log(`📁 Найдено ${files.length} файлов для загрузки`);
    
    // Загружаем каждый файл
    for (const file of files) {
      const relativePath = relative(DIST_DIR, file);
      const key = relativePath.replace(/\\/g, '/'); // Нормализуем пути для S3
      
      const fileContent = readFileSync(file);
      const contentType = getContentType(file);
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
        CacheControl: getCacheControl(key),
      });
      
      await s3Client.send(command);
      console.log(`✅ Загружен: ${key}`);
    }
    
    console.log('🎉 Все файлы загружены в S3');
  } catch (error) {
    console.error('❌ Ошибка при загрузке в S3:', error.message);
    process.exit(1);
  }
}

async function cleanupOldFiles() {
  console.log('🧹 Очищаем старые файлы...');
  
  try {
    // Получаем список всех объектов в бакете
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
    });
    
    const response = await s3Client.send(listCommand);
    
    if (response.Contents) {
      // Удаляем старые файлы
      for (const object of response.Contents) {
        if (object.Key) {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: object.Key,
          });
          
          await s3Client.send(deleteCommand);
          console.log(`🗑️ Удален: ${object.Key}`);
        }
      }
    }
    
    console.log('✅ Очистка завершена');
  } catch (error) {
    console.error('❌ Ошибка при очистке:', error.message);
  }
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

function getContentType(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  const contentTypes = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

function getCacheControl(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  // Статические ресурсы кэшируем долго
  if (['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf'].includes(ext)) {
    return 'public, max-age=31536000, immutable'; // 1 год
  }
  
  // HTML файлы кэшируем меньше
  if (ext === 'html') {
    return 'public, max-age=3600'; // 1 час
  }
  
  return 'public, max-age=86400'; // 1 день
}

async function main() {
  console.log('🚀 Начинаем деплой статического сайта в S3...');
  
  try {
    await buildSite();
    await cleanupOldFiles();
    await uploadToS3();
    
    console.log('🎉 Деплой завершен успешно!');
    console.log(`🌐 Сайт доступен по адресу: https://${BUCKET_NAME}.s3-website-${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`);
  } catch (error) {
    console.error('❌ Ошибка при деплое:', error.message);
    process.exit(1);
  }
}

main(); 