#!/bin/bash

# Быстрый старт Obsidian Blogger на Amazon EC2
echo "🚀 Быстрый старт Obsidian Blogger на Amazon EC2"

# Проверяем наличие .env
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    echo "📝 Создайте .env файл на основе env.example:"
    echo "   cp env.example .env"
    echo "   # Затем заполните все переменные"
    exit 1
fi

# Устанавливаем Docker если его нет
if ! command -v docker &> /dev/null; then
    echo "🐳 Устанавливаем Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker установлен. Перезапустите сессию или выполните: newgrp docker"
fi

# Устанавливаем Docker Compose если его нет
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Устанавливаем Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Создаем папки для данных
mkdir -p output drafts

# Запускаем приложение
echo "🔨 Запускаем Obsidian Blogger..."
docker-compose up -d --build

# Проверяем статус
echo "📊 Статус контейнеров:"
docker-compose ps

echo "📋 Логи приложения:"
docker-compose logs --tail=10 obsidian-blogger

echo "✅ Obsidian Blogger запущен!"
echo "📱 Telegram бот должен быть активен"
echo "🌐 Для остановки: docker-compose down"
echo "📋 Для просмотра логов: docker-compose logs -f obsidian-blogger" 