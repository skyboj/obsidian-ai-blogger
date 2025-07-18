# 🚀 Деплой статического сайта в AWS S3

## Преимущества S3 деплоя

- ✅ **Дешево:** ~$1-5/месяц за хостинг
- ✅ **Быстро:** статические файлы загружаются мгновенно
- ✅ **Надежно:** 99.99% доступность
- ✅ **Автоматизация:** ежедневное обновление через GitHub Actions
- ✅ **Масштабируемость:** автоматическое масштабирование

## Настройка S3 бакета

### 1. Создание бакета

1. **Войдите в AWS Console**
2. **Перейдите в S3**
3. **Создайте новый бакет:**
   - Имя: `your-blog-name` (должно быть уникальным)
   - Регион: выберите ближайший к вашей аудитории
   - Блокировка: отключите (для статического сайта)

### 2. Настройка для статического сайта

1. **Выберите ваш бакет**
2. **Перейдите в Properties → Static website hosting**
3. **Включите хостинг:**
   - Index document: `index.html`
   - Error document: `404.html`
4. **Сохраните URL сайта** (понадобится позже)

### 3. Настройка прав доступа

1. **Перейдите в Permissions**
2. **Отключите Block all public access**
3. **Обновите Bucket Policy:**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

### 4. Настройка CORS (если нужно)

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

## Настройка IAM пользователя

### 1. Создание пользователя

1. **Перейдите в IAM → Users**
2. **Создайте нового пользователя:**
   - Имя: `s3-deploy-user`
   - Access type: Programmatic access

### 2. Создание политики

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

### 3. Привязка политики

1. **Создайте политику** с JSON выше
2. **Привяжите к пользователю**
3. **Сохраните Access Key ID и Secret Access Key**

## Настройка CloudFront (опционально)

### 1. Создание дистрибуции

1. **Перейдите в CloudFront**
2. **Создайте дистрибуцию:**
   - Origin Domain: выберите ваш S3 бакет
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Default Root Object: `index.html`

### 2. Настройка кэширования

- **Cache Policy:** CachingOptimized
- **Origin Request Policy:** CORS-S3Origin

### 3. Настройка домена

1. **Добавьте ваш домен** в Alternate Domain Names
2. **Загрузите SSL сертификат** в ACM
3. **Настройте DNS** для указания на CloudFront

## Локальная настройка

### 1. Установка зависимостей

```bash
npm install
```

### 2. Создание .env файла

```bash
cp env.example .env
```

Заполните переменные:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Site Configuration
SITE_URL=https://your-domain.com
BASE_URL=/
```

### 3. Тестовый деплой

```bash
# Сборка и деплой
npm run deploy:static

# Или по отдельности
npm run build
npm run deploy:s3
```

## Настройка GitHub Actions

### 1. Добавление секретов

В настройках репозитория (Settings → Secrets and variables → Actions) добавьте:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `SITE_URL`
- `BASE_URL`
- `OPENAI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_TELEGRAM_ID`
- `UNSPLASH_ACCESS_KEY`
- `CLOUDFRONT_DISTRIBUTION_ID` (если используете CloudFront)

### 2. Автоматический деплой

Workflow будет запускаться:
- **Ежедневно в 9:00 UTC**
- **При push в main ветку**
- **Вручную через GitHub Actions**

## Мониторинг и логирование

### 1. CloudWatch Logs

```bash
# Просмотр логов деплоя
aws logs tail /aws/lambda/deploy-function --follow
```

### 2. S3 Access Logs

1. **Включите логирование** в настройках бакета
2. **Настройте анализ** через Athena

### 3. CloudFront Analytics

- **Usage Reports** в CloudFront консоли
- **Real-time metrics** для мониторинга

## Оптимизация производительности

### 1. Сжатие файлов

```javascript
// В build-and-deploy.js
const gzip = require('gzip-js');
const fileContent = gzip.zip(fileContent, {level: 9});
```

### 2. Кэширование

```javascript
// Настройка Cache-Control заголовков
const cacheControl = {
  '*.html': 'public, max-age=3600',
  '*.css': 'public, max-age=31536000, immutable',
  '*.js': 'public, max-age=31536000, immutable'
};
```

### 3. CDN настройки

- **Edge Locations:** выберите ближайшие к аудитории
- **Compression:** включите сжатие
- **Security Headers:** добавьте CSP, HSTS

## Стоимость

### S3 Storage
- **Первые 50 TB:** $0.023 за GB/месяц
- **Типичный блог:** ~100MB = $0.002/месяц

### S3 Requests
- **GET requests:** $0.0004 за 1000 запросов
- **PUT requests:** $0.0005 за 1000 запросов

### CloudFront (опционально)
- **Data Transfer:** $0.085 за GB
- **Requests:** $0.0075 за 10000 запросов

### Итого
- **Только S3:** ~$1-3/месяц
- **S3 + CloudFront:** ~$3-10/месяц

## Устранение неполадок

### 1. Ошибки доступа

```bash
# Проверка прав
aws s3 ls s3://your-bucket-name

# Исправление прав
aws s3api put-bucket-policy --bucket your-bucket-name --policy file://policy.json
```

### 2. Ошибки сборки

```bash
# Очистка кэша
rm -rf dist node_modules/.cache

# Переустановка зависимостей
npm ci
```

### 3. Проблемы с CloudFront

```bash
# Инвалидация кэша
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

## Альтернативы

### 1. Netlify
- **Плюсы:** простая настройка, бесплатный план
- **Минусы:** ограничения на бесплатном плане

### 2. Vercel
- **Плюсы:** отличная производительность, автоматический деплой
- **Минусы:** дороже для больших проектов

### 3. GitHub Pages
- **Плюсы:** бесплатно, интеграция с Git
- **Минусы:** ограниченная функциональность

## Заключение

S3 + CloudFront - отличное решение для статических сайтов:
- ✅ Низкая стоимость
- ✅ Высокая производительность
- ✅ Надежность
- ✅ Масштабируемость
- ✅ Простота настройки

Для блога с ежедневными обновлениями это идеальный выбор! 