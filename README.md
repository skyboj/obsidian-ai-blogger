# 🤖 Obsidian Content Generator

AI-powered content generator для автоматического создания статей через Telegram бота.

## 🎯 Описание

Этот проект создан как дополнение к [Obsidian Blogger](../obsidian-blogger) и позволяет генерировать статьи с помощью AI через Telegram бота. Генерируемые статьи автоматически сохраняются в нужном формате и могут быть опубликованы в блоге.

## 🏗️ Архитектура

```
content-generator/
├── src/
│   ├── bot/              # Telegram bot handlers
│   ├── ai/               # AI providers (OpenAI, Anthropic, etc.)
│   ├── generators/       # Content generators
│   ├── media/            # Image providers (Unsplash, etc.)
│   └── utils/            # Utilities
├── config/               # Configuration files
├── prompts/              # Template system
├── output/               # Generated content
└── drafts/               # Draft management
```

## ⚡ Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка переменных окружения

```bash
cp env.example .env
```

Заполните `.env` файл своими ключами:

```env
# Обязательные
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_TELEGRAM_ID=your_telegram_id
OPENAI_API_KEY=your_openai_key

# Опциональные
UNSPLASH_ACCESS_KEY=your_unsplash_key
BLOG_FOLDER_PATH=../obsidian-blogger/Blog
```

### 3. Запуск бота

```bash
# Продакшн
npm start

# Разработка (с автоперезагрузкой)
npm run dev
```

## 🤖 Команды бота

- `/start` - Начать работу с ботом
- `/generate <тема>` - Генерировать новую статью
- `/templates` - Список доступных шаблонов
- `/drafts` - Управление черновиками
- `/settings` - Настройки генерации
- `/status` - Статус системы и AI провайдеров
- `/sync` - Синхронизация новых файлов с блогом
- `/publish <файл.md>` - Публикация черновика в блог
- `/help` - Помощь и инструкции

## 📝 Система шаблонов

Шаблоны находятся в папке `prompts/`. Пример шаблона:

```yaml
name: "Техническая статья"
description: "Для технических руководств и туториалов"
variables:
  - name: "topic"
    required: true
  - name: "difficulty"
    default: "средний"

prompt: |
  Напиши техническую статью на тему: {topic}
  Уровень сложности: {difficulty}
  
frontmatter_template:
  title: "{topic}"
  tags: ["tech", "tutorial"]
  difficulty: "{difficulty}"
```

## 🔗 Интеграция с блогом

Генератор полностью интегрирован с основным блоговым приложением:

### Автоматическая синхронизация
- Сгенерированные статьи автоматически копируются в папку блога
- Поддержка черновиков и готовых к публикации статей
- Проверка доступности и прав записи

### Команды интеграции
```bash
# Синхронизация новых файлов
/sync

# Публикация черновика
/publish article-name.md

# Статистика интеграции
/status
```

### Настройка
```bash
# Переменная окружения
BLOG_FOLDER_PATH="../obsidian-blogger/Blog"
```

## 🔄 Workflow генерации

1. **Получение темы** от пользователя через бота
2. **Подготовка промпта** на основе выбранного шаблона
3. **Генерация контента** через AI (OpenAI/Anthropic)
4. **Поиск изображения** через Unsplash API
5. **Создание Markdown файла** с правильным frontmatter
6. **Автосинхронизация** с папкой блога
7. **Готовность** к публикации через sync-obsidian.js

## 🔧 Конфигурация

### AI Провайдеры

Поддерживаемые провайдеры:
- **OpenAI** (GPT-4, GPT-3.5)
- **Anthropic** (Claude)
- **Google** (Gemini)

### Rate Limiting

- 10 запросов в час на пользователя
- 50 запросов в день на пользователя
- Burst limit: 3 запроса подряд

### Настройки контента

- Минимум: 800 слов
- Максимум: 3000 слов
- Автоматическая проверка качества
- Поддержка изображений

## 🚀 Интеграция с Obsidian Blogger

Генератор может работать в двух режимах:

1. **Manual mode**: Сохранение в `output/` для ручного переноса
2. **Auto mode**: Прямое сохранение в `../obsidian-blogger/Blog/`

## 📊 Мониторинг и логи

- Цветные логи с временными метками
- Статистика использования
- Мониторинг ошибок
- Rate limiting метрики

## 🔒 Безопасность

- Авторизация по Telegram ID
- Rate limiting для предотвращения спама
- Валидация входных данных
- Безопасная обработка ошибок

## 🛠️ Разработка

```bash
# Разработка с автоперезагрузкой
npm run dev

# Запуск только бота
npm run bot:dev

# Генерация через CLI
npm run generate "Тема статьи"
```

## 🧪 Тестирование

### CLI тесты

```bash
# Тест генерации статьи
node src/cli.js "Искусственный интеллект в образовании"

# Тест AI провайдеров
node src/testAI.js

# Тест поиска изображений
node src/testImage.js "artificial intelligence"

# Полное тестирование системы
node src/testFull.js status           # Статус всех компонентов
node src/testFull.js sync             # Тест синхронизации
node src/testFull.js blog-stats       # Статистика блога
node src/testFull.js full "React 2024" # Полный workflow
```

### Telegram команды тестирования

```bash
/status      # Проверка всех сервисов
/sync        # Синхронизация файлов
/generate "Тестовая тема"  # Полная генерация
```

## 📦 Зависимости

- `node-telegram-bot-api` - Telegram Bot API
- `openai` - OpenAI API client
- `yaml` - YAML parser
- `axios` - HTTP client
- `gray-matter` - Frontmatter parser
- `dotenv` - Environment variables

## 🤝 Связь с основным проектом

```
content-generator/output/  →  obsidian-blogger/Blog/
                          ↓
                    sync-obsidian.js
                          ↓
              obsidian-blogger/src/content/blog/
                          ↓
                    Astro Build
                          ↓
                   Published Blog
```

## 📄 Лицензия

MIT

## 🔗 Связанные проекты

- [Obsidian Blogger](../obsidian-blogger) - Основной блоговый движок
