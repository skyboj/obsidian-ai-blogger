# 🤖 QLOGA AI Content Generator

AI-powered content generator for automatic article creation via Telegram bot integration.

## 🎯 Overview

This project serves as a content generation system for the QLOGA company blog, allowing automated article creation through AI via Telegram bot interface. Generated articles are automatically saved in the proper format and can be published to the blog.

## 🏗️ Architecture

```
qloga-blog/
├── src/
│   ├── bot/              # Telegram bot handlers
│   ├── ai/               # AI providers (OpenAI)
│   ├── generators/       # Content generators
│   ├── media/            # Image providers (Unsplash, etc.)
│   └── utils/            # Utilities
├── config/               # Configuration files
├── prompts/              # Template system
├── Blog/                 # Generated content output
└── public/               # Static assets
```

## ⚡ Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

```bash
cp env.example .env
```

Fill in your `.env` file with API keys:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_TELEGRAM_ID=your_telegram_id
OPENAI_API_KEY=your_openai_key

# Optional
UNSPLASH_ACCESS_KEY=your_unsplash_key
```

### 3. Start the Bot

```bash
# Production
npm run content:bot

# Development (with auto-reload)
npm run dev
```

## 🤖 Bot Commands

- `/start` - Initialize bot interaction
- `/generate <topic>` - Generate new article
- `/templates` - List available templates
- `/drafts` - Manage drafts
- `/settings` - Generation settings
- `/status` - System and AI provider status
- `/sync` - Sync new files with blog
- `/publish <file.md>` - Publish draft to blog
- `/help` - Help and instructions

## 📝 Template System

Templates are located in the `prompts/` folder. Example template:

```yaml
name: "Technical Article"
description: "For technical guides and tutorials"
variables:
  - name: "topic"
    required: true
  - name: "difficulty"
    default: "intermediate"

prompt: |
  Write a technical article on the topic: {topic}
  Difficulty level: {difficulty}
  
frontmatter_template:
  title: "{topic}"
  tags: ["tech", "tutorial"]
  difficulty: "{difficulty}"
```

## 🔗 Blog Integration

The generator is fully integrated with the main QLOGA blog application:

### Automatic Synchronization
- Generated articles are automatically saved to the blog folder
- Support for drafts and publish-ready articles
- Availability and write permissions checking

### Integration Commands
```bash
# Sync new files
/sync

# Publish draft
/publish article-name.md

# Integration statistics
/status
```

### Configuration
The system automatically saves generated content to `Blog/` which syncs with the Astro blog in `src/content/blog/`.

## 🔄 Generation Workflow

1. **Topic Input** from user via bot
2. **Prompt Preparation** based on selected template
3. **Content Generation** via AI (OpenAI/Anthropic)
4. **Image Search** via Unsplash API
5. **Markdown File Creation** with proper frontmatter
6. **Auto-sync** with blog folder
7. **Ready** for publication via Astro build

## 🔧 Configuration

### AI Providers

Supported providers:
- **OpenAI** (GPT-4, GPT-3.5)

### Rate Limiting

- 10 requests per hour per user
- 50 requests per day per user
- Burst limit: 3 consecutive requests

### Content Settings

- Minimum: 800 words
- Maximum: 3000 words
- Automatic quality checking
- Image support via Unsplash

## 🚀 Blog Integration

The generator works with the Astro-based QLOGA blog:

1. **Generation**: AI creates content in `Blog/`
2. **Sync**: Manual or automatic sync to `src/content/blog/`
3. **Build**: Astro processes and builds the blog
4. **Deploy**: Static site deployment

## 📊 Monitoring & Logs

- Colored logs with timestamps
- Usage statistics
- Error monitoring
- Rate limiting metrics

## 🔒 Security

- Telegram ID-based authorization
- Rate limiting for spam prevention
- Input data validation
- Secure error handling

## 🛠️ Development

```bash
# Development with auto-reload
npm run dev

# Run bot only
npm run content:bot

# Generate via CLI
npm run content:generate
```

## 🧪 Testing

### CLI Tests

```bash
# Test article generation
node src/cli.js "Artificial Intelligence in Education"

# Test AI providers
node src/testFull.js status

# Test image search
node src/testImage.js "artificial intelligence"

# Full system test
node src/testFull.js full "React 2024"
```

### Telegram Test Commands

```bash
/status      # Check all services
/sync        # Sync files
/generate "Test topic"  # Full generation
```

## 📦 Dependencies

- `node-telegram-bot-api` - Telegram Bot API
- `openai` - OpenAI API client
- `yaml` - YAML parser
- `axios` - HTTP client
- `gray-matter` - Frontmatter parser
- `dotenv` - Environment variables
- `astro` - Static site generator
- `tailwindcss` - CSS framework

## 🌐 Project Workflow

```
AI Generation  →  Blog/ folder  →  src/content/blog/  →  Astro Build  →  Published Blog
```

## 📄 License

MIT

## 🏢 QLOGA Company

This project is part of the QLOGA technology ecosystem. Visit [qloga.com](https://qloga.com) for more information about our company and services.

## 🔗 Social Media

- Instagram: [@qloga_uk](https://instagram.com/qloga_uk)
- YouTube: [@QLOGA](https://www.youtube.com/@QLOGA)
