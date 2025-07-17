# Content Generator для Obsidian Blogger

AI-powered генератор контента с Telegram Bot интерфейсом.

## 🚀 Быстрый старт

### 1. Настройка

```bash
# Установка зависимостей
npm install

# Настройка окружения
cp .env.example .env
# Отредактируйте .env файл с вашими API ключами
```

### 2. Настройка .env файла

Обязательные ключи:
```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token  # От @BotFather
ADMIN_TELEGRAM_ID=your_telegram_id         # От @userinfobot  
OPENAI_API_KEY=your_openai_key             # От OpenAI
```

Опциональные:
```bash
UNSPLASH_ACCESS_KEY=your_unsplash_key      # Для изображений
ANTHROPIC_API_KEY=your_anthropic_key       # Альтернативный AI
```

### 3. Получение API ключей

#### Telegram Bot Token:
1. Найдите @BotFather в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте токен

#### Telegram ID:
1. Найдите @userinfobot в Telegram
2. Отправьте `/start`
3. Скопируйте ваш ID

#### OpenAI API Key:
1. Перейдите на https://platform.openai.com/api-keys
2. Создайте новый ключ
3. Скопируйте ключ

#### Unsplash Access Key (опционально):
1. Перейдите на https://unsplash.com/developers
2. Создайте новое приложение
3. Скопируйте Access Key

## 🧪 Тестирование

```bash
# Проверка без запуска бота
npm test

# Тест только при наличии ключей
npm run test:full
```

## ▶️ Запуск

```bash
# Запуск бота
npm start

# Разработка с автоперезагрузкой
npm run dev
```

## 📱 Команды бота

- `/start` - Начать работу
- `/generate "тема"` - Создать статью
- `/status` - Статус системы
- `/help` - Помощь

## 📁 Структура

```
content-generator/
├── src/
│   ├── bot/          # Telegram Bot логика
│   ├── ai/           # AI провайдеры  
│   ├── generators/   # Генерация контента
│   ├── media/        # Поиск изображений
│   └── utils/        # Утилиты
├── config/           # Конфигурация
├── prompts/          # Шаблоны промптов
└── output/           # Результаты
```

## 🔗 Интеграция с блогом

Статьи автоматически сохраняются в `../Blog/` для использования основным блогом.

## ⚠️ Важные заметки

- Храните .env файл в безопасности
- OpenAI API тарифицируется по использованию
- Тестируйте сначала с минимальными запросами 