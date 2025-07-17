/**
 * Базовый класс для всех AI провайдеров
 */
export class BaseAIProvider {
    constructor(config) {
        this.config = config;
        this.name = this.constructor.name;
    }

    /**
     * Генерация контента
     * @param {string} prompt - Промпт для генерации
     * @param {Object} options - Дополнительные опции
     * @returns {Promise<Object>} Результат генерации
     */
    async generate(prompt, options = {}) {
        throw new Error(`Method generate() must be implemented in ${this.name}`);
    }

    /**
     * Проверка доступности провайдера
     * @returns {Promise<boolean>} Доступен ли провайдер
     */
    async isAvailable() {
        try {
            // Базовая проверка - есть ли API ключ
            return this.hasApiKey();
        } catch (error) {
            return false;
        }
    }

    /**
     * Проверка наличия API ключа
     * @returns {boolean}
     */
    hasApiKey() {
        return Boolean(this.config.apiKey);
    }

    /**
     * Подсчет токенов (базовая оценка)
     * @param {string} text 
     * @returns {number}
     */
    estimateTokens(text) {
        // Примерная оценка: 1 токен ≈ 4 символа для английского, 2-3 для русского
        return Math.ceil(text.length / 3);
    }

    /**
     * Валидация промпта
     * @param {string} prompt 
     * @returns {boolean}
     */
    validatePrompt(prompt) {
        if (!prompt || typeof prompt !== 'string') {
            return false;
        }
        
        if (prompt.trim().length === 0) {
            return false;
        }
        
        // Проверка на максимальную длину
        const maxTokens = this.config.max_tokens || 4000;
        const estimatedTokens = this.estimateTokens(prompt);
        
        return estimatedTokens < maxTokens * 0.8; // Оставляем место для ответа
    }

    /**
     * Обработка ошибок провайдера
     * @param {Error} error 
     * @returns {Object}
     */
    handleError(error) {
        const baseError = {
            provider: this.name,
            timestamp: new Date().toISOString(),
            success: false
        };

        if (error.response?.status === 401) {
            return {
                ...baseError,
                error: 'INVALID_API_KEY',
                message: 'Неверный API ключ'
            };
        }

        if (error.response?.status === 429) {
            return {
                ...baseError,
                error: 'RATE_LIMIT',
                message: 'Превышен лимит запросов'
            };
        }

        if (error.response?.status === 402) {
            return {
                ...baseError,
                error: 'INSUFFICIENT_CREDITS',
                message: 'Недостаточно средств на счету'
            };
        }

        return {
            ...baseError,
            error: 'UNKNOWN_ERROR',
            message: error.message || 'Неизвестная ошибка'
        };
    }

    /**
     * Форматирование успешного ответа
     * @param {string} content 
     * @param {Object} metadata 
     * @returns {Object}
     */
    formatResponse(content, metadata = {}) {
        return {
            success: true,
            provider: this.name,
            content: content.trim(),
            metadata: {
                timestamp: new Date().toISOString(),
                tokensUsed: this.estimateTokens(content),
                ...metadata
            }
        };
    }
} 