/**
 * Rate Limiter для контроля частоты запросов пользователей
 */
export class RateLimiter {
    constructor(options = {}) {
        this.requestsPerHour = options.requestsPerHour || parseInt(process.env.REQUESTS_PER_HOUR) || 10;
        this.requestsPerDay = options.requestsPerDay || parseInt(process.env.REQUESTS_PER_DAY) || 50;
        this.burstLimit = options.burstLimit || 3;
        
        // Хранилище запросов пользователей
        this.userRequests = new Map();
        
        // Очистка старых записей каждый час
        setInterval(() => this.cleanup(), 60 * 60 * 1000);
    }

    /**
     * Check возможности выполнения запроса
     */
    canMakeRequest(userId) {
        const now = Date.now();
        const userData = this.getUserData(userId);
        
        // Check burst limit (последовательные запросы)
        if (this.checkBurstLimit(userData, now)) {
            return { allowed: false, reason: 'burst_limit', resetIn: 60000 };
        }
        
        // Check часового лимита
        if (this.checkHourlyLimit(userData, now)) {
            return { allowed: false, reason: 'hourly_limit', resetIn: this.getHourlyResetTime(userData, now) };
        }
        
        // Check дневного лимита
        if (this.checkDailyLimit(userData, now)) {
            return { allowed: false, reason: 'daily_limit', resetIn: this.getDailyResetTime(userData, now) };
        }
        
        return { allowed: true };
    }

    /**
     * Регистрация запроса
     */
    recordRequest(userId) {
        const now = Date.now();
        const userData = this.getUserData(userId);
        
        userData.requests.push(now);
        userData.lastRequest = now;
        
        this.userRequests.set(userId, userData);
    }

    /**
     * Getting данных пользователя
     */
    getUserData(userId) {
        if (!this.userRequests.has(userId)) {
            this.userRequests.set(userId, {
                requests: [],
                lastRequest: 0,
                burstCount: 0,
                lastBurstTime: 0
            });
        }
        return this.userRequests.get(userId);
    }

    /**
     * Check burst limit
     */
    checkBurstLimit(userData, now) {
        const timeSinceLastRequest = now - userData.lastRequest;
        
        if (timeSinceLastRequest < 60000) { // Менее минуты
            if (timeSinceLastRequest < 10000) { // Менее 10 секунд
                userData.burstCount = (userData.burstCount || 0) + 1;
            } else {
                userData.burstCount = 1;
            }
            
            return userData.burstCount >= this.burstLimit;
        }
        
        userData.burstCount = 0;
        return false;
    }

    /**
     * Check часового лимита
     */
    checkHourlyLimit(userData, now) {
        const oneHourAgo = now - (60 * 60 * 1000);
        const recentRequests = userData.requests.filter(time => time > oneHourAgo);
        
        userData.requests = recentRequests; // Очистка старых запросов
        
        return recentRequests.length >= this.requestsPerHour;
    }

    /**
     * Check дневного лимита
     */
    checkDailyLimit(userData, now) {
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const recentRequests = userData.requests.filter(time => time > oneDayAgo);
        
        return recentRequests.length >= this.requestsPerDay;
    }

    /**
     * Время до сброса часового лимита
     */
    getHourlyResetTime(userData, now) {
        const oldestRecentRequest = userData.requests[0];
        const resetTime = oldestRecentRequest + (60 * 60 * 1000);
        return Math.max(0, resetTime - now);
    }

    /**
     * Время до сброса дневного лимита
     */
    getDailyResetTime(userData, now) {
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const recentRequests = userData.requests.filter(time => time > oneDayAgo);
        
        if (recentRequests.length > 0) {
            const oldestRecentRequest = recentRequests[0];
            const resetTime = oldestRecentRequest + (24 * 60 * 60 * 1000);
            return Math.max(0, resetTime - now);
        }
        
        return 0;
    }

    /**
     * Getting статистики пользователя
     */
    getUserStats(userId) {
        const userData = this.getUserData(userId);
        const now = Date.now();
        
        const oneHourAgo = now - (60 * 60 * 1000);
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        const hourlyRequests = userData.requests.filter(time => time > oneHourAgo).length;
        const dailyRequests = userData.requests.filter(time => time > oneDayAgo).length;
        
        return {
            userId,
            hourlyRequests,
            dailyRequests,
            hourlyLimit: this.requestsPerHour,
            dailyLimit: this.requestsPerDay,
            hourlyRemaining: Math.max(0, this.requestsPerHour - hourlyRequests),
            dailyRemaining: Math.max(0, this.requestsPerDay - dailyRequests),
            lastRequest: userData.lastRequest,
            burstCount: userData.burstCount || 0
        };
    }

    /**
     * Очистка старых данных
     */
    cleanup() {
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        for (const [userId, userData] of this.userRequests.entries()) {
            // Удаляем старые запросы
            userData.requests = userData.requests.filter(time => time > oneDayAgo);
            
            // Удаляем пользователей без недавних запросов
            if (userData.requests.length === 0 && (now - userData.lastRequest) > oneDayAgo) {
                this.userRequests.delete(userId);
            }
        }
    }

    /**
     * Форматирование времени ожидания
     */
    formatWaitTime(milliseconds) {
        const seconds = Math.ceil(milliseconds / 1000);
        
        if (seconds < 60) {
            return `${seconds} сек`;
        }
        
        const minutes = Math.ceil(seconds / 60);
        if (minutes < 60) {
            return `${minutes} мин`;
        }
        
        const hours = Math.ceil(minutes / 60);
        return `${hours} ч`;
    }

    /**
     * Getting общей статистики
     */
    getGlobalStats() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        let totalUsers = 0;
        let activeHourly = 0;
        let activeDaily = 0;
        let totalRequests = 0;
        
        for (const [userId, userData] of this.userRequests.entries()) {
            totalUsers++;
            
            const hourlyRequests = userData.requests.filter(time => time > oneHourAgo);
            const dailyRequests = userData.requests.filter(time => time > oneDayAgo);
            
            if (hourlyRequests.length > 0) activeHourly++;
            if (dailyRequests.length > 0) activeDaily++;
            
            totalRequests += userData.requests.length;
        }
        
        return {
            totalUsers,
            activeHourly,
            activeDaily,
            totalRequests,
            limitsConfig: {
                requestsPerHour: this.requestsPerHour,
                requestsPerDay: this.requestsPerDay,
                burstLimit: this.burstLimit
            }
        };
    }
} 