import { logger } from './logger.js';

export class RateLimiter {
    constructor(config) {
        this.config = config || {
            enabled: true,
            requests_per_hour: 10,
            requests_per_day: 50,
            burst_limit: 3
        };
        
        // Хранилища для отслеживания запросов
        this.hourlyRequests = new Map(); // userId -> { count, resetTime }
        this.dailyRequests = new Map();  // userId -> { count, resetTime }
        this.burstRequests = new Map();  // userId -> { timestamps[] }
        
        // Очистка старых записей каждые 5 минут
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
        
        logger.debug('RateLimiter initialized', this.config);
    }

    checkLimit(userId) {
        if (!this.config.enabled) {
            return true;
        }

        const now = Date.now();
        
        // Проверка burst лимита (несколько запросов подряд)
        if (!this.checkBurstLimit(userId, now)) {
            logger.warn(`User ${userId} exceeded burst limit`);
            return false;
        }
        
        // Проверка часового лимита
        if (!this.checkHourlyLimit(userId, now)) {
            logger.warn(`User ${userId} exceeded hourly limit`);
            return false;
        }
        
        // Проверка дневного лимита
        if (!this.checkDailyLimit(userId, now)) {
            logger.warn(`User ${userId} exceeded daily limit`);
            return false;
        }
        
        // Если все проверки пройдены, записываем запрос
        this.recordRequest(userId, now);
        return true;
    }

    checkBurstLimit(userId, now) {
        const burstWindow = 60 * 1000; // 1 минута
        const maxBurst = this.config.burst_limit;
        
        if (!this.burstRequests.has(userId)) {
            this.burstRequests.set(userId, { timestamps: [] });
        }
        
        const userBurst = this.burstRequests.get(userId);
        
        // Очищаем старые записи
        userBurst.timestamps = userBurst.timestamps.filter(
            timestamp => now - timestamp < burstWindow
        );
        
        return userBurst.timestamps.length < maxBurst;
    }

    checkHourlyLimit(userId, now) {
        const hourInMs = 60 * 60 * 1000;
        
        if (!this.hourlyRequests.has(userId)) {
            this.hourlyRequests.set(userId, {
                count: 0,
                resetTime: now + hourInMs
            });
        }
        
        const userHourly = this.hourlyRequests.get(userId);
        
        // Сброс счетчика если прошел час
        if (now > userHourly.resetTime) {
            userHourly.count = 0;
            userHourly.resetTime = now + hourInMs;
        }
        
        return userHourly.count < this.config.requests_per_hour;
    }

    checkDailyLimit(userId, now) {
        const dayInMs = 24 * 60 * 60 * 1000;
        
        if (!this.dailyRequests.has(userId)) {
            this.dailyRequests.set(userId, {
                count: 0,
                resetTime: now + dayInMs
            });
        }
        
        const userDaily = this.dailyRequests.get(userId);
        
        // Сброс счетчика если прошел день
        if (now > userDaily.resetTime) {
            userDaily.count = 0;
            userDaily.resetTime = now + dayInMs;
        }
        
        return userDaily.count < this.config.requests_per_day;
    }

    recordRequest(userId, now) {
        // Записываем в burst
        if (!this.burstRequests.has(userId)) {
            this.burstRequests.set(userId, { timestamps: [] });
        }
        this.burstRequests.get(userId).timestamps.push(now);
        
        // Увеличиваем часовой счетчик
        if (this.hourlyRequests.has(userId)) {
            this.hourlyRequests.get(userId).count++;
        }
        
        // Увеличиваем дневной счетчик
        if (this.dailyRequests.has(userId)) {
            this.dailyRequests.get(userId).count++;
        }
    }

    getUserStats(userId) {
        const hourly = this.hourlyRequests.get(userId) || { count: 0, resetTime: 0 };
        const daily = this.dailyRequests.get(userId) || { count: 0, resetTime: 0 };
        const burst = this.burstRequests.get(userId) || { timestamps: [] };
        
        return {
            hourly: {
                used: hourly.count,
                limit: this.config.requests_per_hour,
                resetIn: Math.max(0, hourly.resetTime - Date.now())
            },
            daily: {
                used: daily.count,
                limit: this.config.requests_per_day,
                resetIn: Math.max(0, daily.resetTime - Date.now())
            },
            burst: {
                used: burst.timestamps.length,
                limit: this.config.burst_limit
            }
        };
    }

    cleanup() {
        const now = Date.now();
        
        // Очистка просроченных записей
        for (const [userId, data] of this.hourlyRequests.entries()) {
            if (now > data.resetTime) {
                this.hourlyRequests.delete(userId);
            }
        }
        
        for (const [userId, data] of this.dailyRequests.entries()) {
            if (now > data.resetTime) {
                this.dailyRequests.delete(userId);
            }
        }
        
        // Очистка старых burst записей
        for (const [userId, data] of this.burstRequests.entries()) {
            data.timestamps = data.timestamps.filter(
                timestamp => now - timestamp < 60 * 1000
            );
            
            if (data.timestamps.length === 0) {
                this.burstRequests.delete(userId);
            }
        }
        
        logger.debug('RateLimiter cleanup completed');
    }

    getRemainingTime(userId) {
        const stats = this.getUserStats(userId);
        
        if (stats.hourly.used >= stats.hourly.limit) {
            return Math.ceil(stats.hourly.resetIn / 1000); // секунды до сброса
        }
        
        if (stats.daily.used >= stats.daily.limit) {
            return Math.ceil(stats.daily.resetIn / 1000); // секунды до сброса
        }
        
        return 0;
    }
} 