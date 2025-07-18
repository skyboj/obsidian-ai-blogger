# 🚀 Деплой Obsidian Blogger на Amazon

## Варианты деплоя

### 1. Amazon EC2 (Рекомендуемый для Telegram бота)

#### Подготовка сервера

1. **Создайте EC2 инстанс:**
   - Тип: t3.micro или t3.small (достаточно для бота)
   - OS: Ubuntu 22.04 LTS
   - Security Group: откройте порты 22 (SSH), 80 (HTTP), 443 (HTTPS)

2. **Подключитесь к серверу:**
   ```bash
   ssh -i your-key.pem ubuntu@your-server-ip
   ```

#### Автоматический деплой

1. **Настройте скрипт деплоя:**
   ```bash
   # Отредактируйте deploy.sh
   nano deploy.sh
   # Замените your-server-ip на IP вашего сервера
   ```

2. **Создайте .env файл:**
   ```bash
   cp env.example .env
   # Заполните все необходимые переменные
   ```

3. **Запустите деплой:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

#### Ручной деплой

1. **Копируйте файлы на сервер:**
   ```bash
   rsync -avz --exclude 'node_modules' --exclude '.git' \
       ./ ubuntu@your-server-ip:/home/ubuntu/obsidian-blogger/
   ```

2. **На сервере установите Docker:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

3. **Запустите приложение:**
   ```bash
   cd /home/ubuntu/obsidian-blogger
   docker-compose up -d
   ```

### 2. Amazon ECS (Для масштабирования)

#### Создание ECS кластера

1. **Создайте ECS кластер:**
   - Тип: Fargate (serverless)
   - VPC: создайте новую или используйте существующую

2. **Создайте Task Definition:**
   ```json
   {
     "family": "obsidian-blogger",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "256",
     "memory": "512",
     "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
     "containerDefinitions": [
       {
         "name": "obsidian-blogger",
         "image": "your-account.dkr.ecr.region.amazonaws.com/obsidian-blogger:latest",
         "portMappings": [
           {
             "containerPort": 4321,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {
             "name": "NODE_ENV",
             "value": "production"
           }
         ],
         "secrets": [
           {
             "name": "TELEGRAM_BOT_TOKEN",
             "valueFrom": "arn:aws:secretsmanager:region:account:secret:telegram-bot-token"
           }
         ]
       }
     ]
   }
   ```

### 3. AWS Lambda + API Gateway (Serverless)

#### Создание Lambda функции

1. **Создайте Lambda функцию:**
   - Runtime: Node.js 18.x
   - Handler: src/lambda.handler
   - Timeout: 30 секунд
   - Memory: 512 MB

2. **Создайте API Gateway:**
   - Тип: REST API
   - Интегрируйте с Lambda

## Мониторинг и логирование

### CloudWatch Logs

Добавьте в код логирование в CloudWatch:

```javascript
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatchLogs();

// Логирование в CloudWatch
async function logToCloudWatch(message, level = 'INFO') {
  const logGroupName = '/aws/lambda/obsidian-blogger';
  const logStreamName = new Date().toISOString().split('T')[0];
  
  try {
    await cloudwatch.putLogEvents({
      logGroupName,
      logStreamName,
      logEvents: [{
        timestamp: Date.now(),
        message: `[${level}] ${message}`
      }]
    }).promise();
  } catch (error) {
    console.error('Failed to log to CloudWatch:', error);
  }
}
```

### Health Check

Добавьте endpoint для проверки здоровья:

```javascript
// В src/index.js
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

## SSL сертификаты

### Let's Encrypt (бесплатно)

```bash
# Установите Certbot
sudo apt install certbot python3-certbot-nginx

# Получите сертификат
sudo certbot --nginx -d your-domain.com

# Автообновление
sudo crontab -e
# Добавьте: 0 12 * * * /usr/bin/certbot renew --quiet
```

### AWS Certificate Manager

1. Запросите сертификат в ACM
2. Привяжите к Load Balancer или CloudFront

## Резервное копирование

### Автоматическое резервное копирование

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/obsidian-blogger"

# Создаем резервную копию данных
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" \
    output/ drafts/ telegraph_token.json telegraph_cache.json

# Удаляем старые резервные копии (старше 30 дней)
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +30 -delete

# Загружаем в S3
aws s3 cp "$BACKUP_DIR/backup_$DATE.tar.gz" \
    s3://your-bucket/obsidian-blogger/backups/
```

## Масштабирование

### Auto Scaling (EC2)

```bash
# Создайте Launch Template
aws ec2 create-launch-template \
    --launch-template-name obsidian-blogger-template \
    --version-description v1 \
    --launch-template-data '{"ImageId":"ami-123456","InstanceType":"t3.micro"}'

# Создайте Auto Scaling Group
aws autoscaling create-auto-scaling-group \
    --auto-scaling-group-name obsidian-blogger-asg \
    --launch-template LaunchTemplateName=obsidian-blogger-template \
    --min-size 1 --max-size 3 --desired-capacity 1
```

### Load Balancer

```bash
# Создайте Application Load Balancer
aws elbv2 create-load-balancer \
    --name obsidian-blogger-alb \
    --subnets subnet-123456 subnet-789012 \
    --security-groups sg-123456
```

## Стоимость

### EC2 (t3.micro)
- **Стоимость:** ~$8-15/месяц
- **Подходит для:** небольших проектов, тестирования

### ECS Fargate
- **Стоимость:** ~$15-30/месяц
- **Подходит для:** продакшена, масштабирования

### Lambda
- **Стоимость:** ~$1-5/месяц (зависит от количества запросов)
- **Подходит для:** редких запросов, экономии

## Безопасность

### IAM роли
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### Security Groups
- **Inbound:** только необходимые порты (22, 80, 443)
- **Outbound:** все исходящие разрешены

### Secrets Manager
```bash
# Сохраните токены в Secrets Manager
aws secretsmanager create-secret \
    --name telegram-bot-token \
    --secret-string '{"token":"your-telegram-token"}'
```

## Устранение неполадок

### Проверка логов
```bash
# Docker контейнер
docker-compose logs -f obsidian-blogger

# Systemd сервис
sudo journalctl -u obsidian-blogger -f

# CloudWatch
aws logs tail /aws/lambda/obsidian-blogger --follow
```

### Мониторинг ресурсов
```bash
# CPU и память
htop

# Дисковое пространство
df -h

# Сетевые соединения
netstat -tulpn
``` 