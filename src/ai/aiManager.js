import { OpenAIProvider } from './openaiProvider.js';
import { logger } from '../utils/logger.js';

/**
 * AI Providers Manager
 */
export class AIManager {
    constructor(config) {
        this.config = config;
        this.providers = new Map();
        this.defaultProvider = config.default_provider || 'openai';
        
        this.initializeProviders();
    }

    /**
     * Initialize all available providers
     */
    initializeProviders() {
        const providers = this.config.providers || {};

        // OpenAI Provider
        if (providers.openai && process.env.OPENAI_API_KEY) {
            try {
                const openaiProvider = new OpenAIProvider({
                    apiKey: process.env.OPENAI_API_KEY,
                    ...providers.openai
                });
                this.providers.set('openai', openaiProvider);
                logger.info('✅ OpenAI provider initialized');
            } catch (error) {
                logger.error('❌ Failed to initialize OpenAI provider:', error);
            }
        }



        // TODO: Добавить другие провайдеры
        // - Google (Gemini)
        // - Local models (Ollama)

        if (this.providers.size === 0) {
            logger.warn('⚠️ No AI providers available');
        } else {
            logger.success(`🤖 Initialized ${this.providers.size} AI provider(s)`);
        }
    }

    /**
     * Getting провайдера по имени
     */
    getProvider(providerName = null) {
        const name = providerName || this.defaultProvider;
        const provider = this.providers.get(name);
        
        if (!provider) {
            throw new Error(`AI provider '${name}' not found or not initialized`);
        }
        
        return provider;
    }

    /**
     * Генерация контента с fallback на другие провайдеры
     */
    async generate(prompt, options = {}) {
        const preferredProvider = options.provider || this.defaultProvider;
        const maxRetries = options.maxRetries || 2;
        
        logger.info(`🧠 Starting content generation with provider: ${preferredProvider}`);

        // Список провайдеров для попыток (начинаем с предпочтительного)
        const providerNames = [preferredProvider, ...this.getAvailableProviders()]
            .filter((name, index, arr) => arr.indexOf(name) === index) // Убираем дубликаты
            .slice(0, maxRetries + 1);

        let lastError = null;

        for (const providerName of providerNames) {
            try {
                const provider = this.getProvider(providerName);
                
                // Проверяем доступность провайдера
                if (!(await provider.isAvailable())) {
                    logger.warn(`Provider ${providerName} is not available, skipping...`);
                    continue;
                }

                logger.info(`🔄 Attempting generation with ${providerName}...`);
                
                const result = await provider.generate(prompt, options);
                
                if (result.success) {
                    logger.success(`✅ Content generated successfully with ${providerName}`);
                    return result;
                } else {
                    logger.warn(`❌ Generation failed with ${providerName}:`, result.message);
                    lastError = result;
                }

            } catch (error) {
                logger.error(`💥 Error with provider ${providerName}:`, error);
                lastError = error;
                continue;
            }
        }

        // Если все провайдеры не сработали
        logger.error('💥 All AI providers failed');
        return {
            success: false,
            error: 'ALL_PROVIDERS_FAILED',
            message: 'Все AI провайдеры недоступны',
            lastError: lastError
        };
    }

    /**
     * Getting списка доступных провайдеров
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }

    /**
     * Check доступности всех провайдеров
     */
    async checkProvidersHealth() {
        const healthChecks = [];
        
        for (const [name, provider] of this.providers.entries()) {
            const start = Date.now();
            try {
                const isAvailable = await provider.isAvailable();
                const responseTime = Date.now() - start;
                
                healthChecks.push({
                    name,
                    available: isAvailable,
                    responseTime,
                    status: isAvailable ? 'healthy' : 'unavailable'
                });
            } catch (error) {
                healthChecks.push({
                    name,
                    available: false,
                    responseTime: Date.now() - start,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        return healthChecks;
    }

    /**
     * Getting статистики использования
     */
    getUsageStats() {
        // TODO: Реализовать трекинг использования
        return {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            providersUsage: {}
        };
    }

    /**
     * Оценка стоимости генерации
     */
    async estimateGenerationCost(prompt, providerName = null) {
        try {
            const provider = this.getProvider(providerName);
            
            if (typeof provider.estimateCost === 'function') {
                const promptTokens = provider.estimateTokens(prompt);
                const estimatedCompletionTokens = Math.min(
                    provider.maxTokens || 4000,
                    promptTokens * 2 // Предполагаем, что ответ в 2 раза короче промпта
                );
                
                return provider.estimateCost(promptTokens, estimatedCompletionTokens);
            }
            
            return null;
        } catch (error) {
            logger.error('Failed to estimate cost:', error);
            return null;
        }
    }

    /**
     * Getting лучшего провайдера для задачи
     */
    async getBestProvider(prompt, requirements = {}) {
        const availableProviders = this.getAvailableProviders();
        
        if (availableProviders.length === 0) {
            throw new Error('No AI providers available');
        }

        // Простая логика выбора (можно расширить)
        if (requirements.cost === 'low') {
            // Предпочитаем более дешевые модели
            return availableProviders.includes('openai') ? 'openai' : availableProviders[0];
        }

        if (requirements.quality === 'high') {
            // Предпочитаем более качественные модели
            return availableProviders.includes('openai') ? 'openai' : availableProviders[0];
        }

        // По умолчанию возвращаем дефолтный провайдер
        return availableProviders.includes(this.defaultProvider) 
            ? this.defaultProvider 
            : availableProviders[0];
    }
} 