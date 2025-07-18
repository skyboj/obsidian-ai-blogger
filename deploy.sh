#!/bin/bash

# Скрипт деплоя Obsidian Blogger на Amazon EC2
# Использование: ./deploy.sh [production|staging]

set -e

ENVIRONMENT=${1:-production}
SERVER_IP="your-server-ip"  # Замените на IP вашего сервера
SERVER_USER="ubuntu"         # Замените на пользователя сервера
PROJECT_NAME="obsidian-blogger"

echo "🚀 Начинаем деплой Obsidian Blogger на $ENVIRONMENT..."

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден! Создайте его на основе env.example"
    exit 1
fi

# Создаем папки для данных если их нет
mkdir -p output drafts

# Копируем файлы на сервер
echo "📤 Копируем файлы на сервер..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'output' --exclude 'drafts' \
    ./ $SERVER_USER@$SERVER_IP:/home/$SERVER_USER/$PROJECT_NAME/

# Подключаемся к серверу и запускаем деплой
echo "🔧 Настраиваем сервер..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
    cd /home/ubuntu/obsidian-blogger
    
    # Устанавливаем Docker если его нет
    if ! command -v docker &> /dev/null; then
        echo "🐳 Устанавливаем Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
    fi
    
    # Устанавливаем Docker Compose если его нет
    if ! command -v docker-compose &> /dev/null; then
        echo "📦 Устанавливаем Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
    
    # Останавливаем старые контейнеры
    echo "🛑 Останавливаем старые контейнеры..."
    docker-compose down || true
    
    # Собираем и запускаем новые контейнеры
    echo "🔨 Собираем и запускаем контейнеры..."
    docker-compose up -d --build
    
    # Проверяем статус
    echo "✅ Проверяем статус контейнеров..."
    docker-compose ps
    
    # Показываем логи
    echo "📋 Логи приложения:"
    docker-compose logs --tail=20 obsidian-blogger
EOF

echo "🎉 Деплой завершен!"
echo "📊 Проверить статус: ssh $SERVER_USER@$SERVER_IP 'cd /home/$SERVER_USER/$PROJECT_NAME && docker-compose ps'"
echo "📋 Посмотреть логи: ssh $SERVER_USER@$SERVER_IP 'cd /home/$SERVER_USER/$PROJECT_NAME && docker-compose logs -f obsidian-blogger'" 