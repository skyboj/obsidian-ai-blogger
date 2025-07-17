import { logger } from './logger.js';

export class RateLimiter {
    constructor(config) {
        this.config = config || {
            enabled: true,
            requests_per_hour: 10,
            requests_per_day: 50,
            burst_limit: 3
        };
        
        // Storage for tracking requests
        this.hourlyRequests = new Map(); // userId -> { count, resetTime }
        this.dailyRequests = new Map();  // userId -> { count, resetTime }
        this.burstRequests = new Map();  // userId -> { timestamps[] }
        
        // Clean up old entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
        
        logger.debug('RateLimiter initialized', this.config);
    }

    checkLimit(userId) {
        if (!this.config.enabled) {
            return true;
        }

        const now = Date.now();
        
        // Check burst limit (multiple consecutive requests)
        if (!this.checkBurstLimit(userId, now)) {
            logger.warn(`User ${userId} exceeded burst limit`);
            return false;
        }
        
        // Check hourly limit
        if (!this.checkHourlyLimit(userId, now)) {
            logger.warn(`User ${userId} exceeded hourly limit`);
            return false;
        }
        
        // Check daily limit
        if (!this.checkDailyLimit(userId, now)) {
            logger.warn(`User ${userId} exceeded daily limit`);
            return false;
        }
        
        // If all checks pass, record the request
        this.recordRequest(userId, now);
        return true;
    }

    checkBurstLimit(userId, now) {
        const burstWindow = 60 * 1000; // 1 minute
        const maxBurst = this.config.burst_limit;
        
        if (!this.burstRequests.has(userId)) {
            this.burstRequests.set(userId, { timestamps: [] });
        }
        
        const userBurst = this.burstRequests.get(userId);
        
        // Clean up old entries
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
        
        // Reset counter if an hour has passed
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
        
        // Reset counter if a day has passed
        if (now > userDaily.resetTime) {
            userDaily.count = 0;
            userDaily.resetTime = now + dayInMs;
        }
        
        return userDaily.count < this.config.requests_per_day;
    }

    recordRequest(userId, now) {
        // Record in burst
        if (!this.burstRequests.has(userId)) {
            this.burstRequests.set(userId, { timestamps: [] });
        }
        this.burstRequests.get(userId).timestamps.push(now);
        
        // Increment hourly counter
        if (this.hourlyRequests.has(userId)) {
            this.hourlyRequests.get(userId).count++;
        }
        
        // Increment daily counter
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
        
        // Clean up expired entries
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
        
        // Clean up old burst entries
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
            return Math.ceil(stats.hourly.resetIn / 1000); // seconds until reset
        }
        
        if (stats.daily.used >= stats.daily.limit) {
            return Math.ceil(stats.daily.resetIn / 1000); // seconds until reset
        }
        
        return 0;
    }
} 