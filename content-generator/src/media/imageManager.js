import { UnsplashProvider } from './unsplashProvider.js';
import { logger } from '../utils/logger.js';

/**
 * Менеджер провайдеров изображений
 */
export class ImageManager {
    constructor(config) {
        this.config = config;
        this.providers = new Map();
        this.defaultProvider = config.provider || 'unsplash';
        
        this.initializeProviders();
    }

    /**
     * Инициализация всех доступных провайдеров
     */
    initializeProviders() {
        const providers = this.config || {};

        // Unsplash Provider
        if (process.env.UNSPLASH_ACCESS_KEY) {
            try {
                const unsplashProvider = new UnsplashProvider({
                    apiKey: process.env.UNSPLASH_ACCESS_KEY,
                    orientation: providers.orientation || 'landscape',
                    size: providers.size || 'regular',
                    perPage: providers.perPage || 10
                });
                this.providers.set('unsplash', unsplashProvider);
                logger.info('✅ Unsplash provider initialized');
            } catch (error) {
                logger.error('❌ Failed to initialize Unsplash provider:', error);
            }
        } else {
            logger.warn('⚠️ Unsplash API key not found, skipping initialization');
        }

        // TODO: Добавить другие провайдеры
        // - Pexels
        // - Pixabay
        // - Getty Images

        if (this.providers.size === 0) {
            logger.warn('⚠️ No image providers available');
        } else {
            logger.success(`🖼️ Initialized ${this.providers.size} image provider(s)`);
        }
    }

    /**
     * Получение провайдера по имени
     */
    getProvider(providerName = null) {
        const name = providerName || this.defaultProvider;
        const provider = this.providers.get(name);
        
        if (!provider) {
            throw new Error(`Image provider '${name}' not found or not initialized`);
        }
        
        return provider;
    }

    /**
     * Поиск изображений с fallback на другие провайдеры
     */
    async searchImages(keywords, options = {}) {
        const preferredProvider = options.provider || this.defaultProvider;
        const maxRetries = options.maxRetries || 2;
        
        logger.info(`🖼️ Searching images for: ${Array.isArray(keywords) ? keywords.join(', ') : keywords}`);

        // Список провайдеров для попыток
        const providerNames = [preferredProvider, ...this.getAvailableProviders()]
            .filter((name, index, arr) => arr.indexOf(name) === index) // Убираем дубликаты
            .slice(0, maxRetries + 1);

        let lastError = null;

        for (const providerName of providerNames) {
            try {
                const provider = this.getProvider(providerName);
                
                // Проверяем доступность провайдера
                if (!(await provider.isAvailable())) {
                    logger.warn(`Image provider ${providerName} is not available, skipping...`);
                    continue;
                }

                logger.info(`🔄 Attempting image search with ${providerName}...`);
                
                const result = await provider.searchImages(keywords, options);
                
                if (result.success && result.images.length > 0) {
                    logger.success(`✅ Found ${result.images.length} images with ${providerName}`);
                    return result;
                } else {
                    logger.warn(`❌ No images found with ${providerName}`);
                    lastError = result;
                }

            } catch (error) {
                logger.error(`💥 Error with image provider ${providerName}:`, error);
                lastError = error;
                continue;
            }
        }

        // Если все провайдеры не сработали
        logger.error('💥 All image providers failed');
        return {
            success: false,
            error: 'ALL_PROVIDERS_FAILED',
            message: 'Все провайдеры изображений недоступны',
            lastError: lastError
        };
    }

    /**
     * Получение лучшего изображения для темы
     */
    async getBestImageForTopic(topic, options = {}) {
        try {
            // Создаем список ключевых слов для поиска
            const keywords = this.generateSearchKeywords(topic);
            
            // Настройки поиска для получения качественных изображений
            const searchOptions = {
                ...options,
                limit: options.limit || 5,
                orientation: options.orientation || 'landscape',
                filters: {
                    minWidth: options.minWidth || 800,
                    minHeight: options.minHeight || 600,
                    orientation: options.orientation || 'landscape',
                    ...options.filters
                },
                sortBy: 'relevance'
            };

            const result = await this.searchImages(keywords, searchOptions);
            
            if (result.success && result.images.length > 0) {
                // Возвращаем лучшее изображение (первое в списке)
                const bestImage = result.images[0];
                
                logger.success(`🎯 Selected best image: ${bestImage.title || bestImage.id}`);
                
                return {
                    success: true,
                    image: bestImage,
                    alternatives: result.images.slice(1),
                    searchKeywords: keywords,
                    metadata: result.metadata
                };
            }

            return {
                success: false,
                error: 'NO_SUITABLE_IMAGES',
                message: 'Не найдено подходящих изображений для темы'
            };

        } catch (error) {
            logger.error('Failed to get best image for topic:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Генерация ключевых слов для поиска на основе темы
     */
    generateSearchKeywords(topic) {
        const baseKeywords = [topic];
        
        // Добавляем общие ключевые слова в зависимости от темы
        const topicLower = topic.toLowerCase();
        
        if (topicLower.includes('технолог') || topicLower.includes('ai') || topicLower.includes('искусственный интеллект')) {
            baseKeywords.push('technology', 'artificial intelligence', 'innovation');
        } else if (topicLower.includes('здоров') || topicLower.includes('медицин')) {
            baseKeywords.push('health', 'medical', 'wellness');
        } else if (topicLower.includes('бизнес') || topicLower.includes('финанс')) {
            baseKeywords.push('business', 'finance', 'success');
        } else if (topicLower.includes('образован') || topicLower.includes('обучен')) {
            baseKeywords.push('education', 'learning', 'study');
        } else if (topicLower.includes('природ') || topicLower.includes('экологи')) {
            baseKeywords.push('nature', 'environment', 'ecology');
        } else {
            // Общие ключевые слова
            baseKeywords.push('concept', 'abstract', 'modern');
        }
        
        return baseKeywords;
    }

    /**
     * Получение случайного изображения
     */
    async getRandomImage(options = {}) {
        try {
            const provider = this.getProvider(options.provider);
            
            if (typeof provider.getRandomImage === 'function') {
                return await provider.getRandomImage(options);
            } else {
                // Fallback: поиск с общими ключевыми словами
                return await this.searchImages(['abstract', 'concept'], {
                    ...options,
                    limit: 1
                });
            }
            
        } catch (error) {
            logger.error('Failed to get random image:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Получение списка доступных провайдеров
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }

    /**
     * Проверка доступности всех провайдеров
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
     * Получение статистики использования
     */
    getUsageStats() {
        // TODO: Реализовать трекинг использования
        return {
            totalSearches: 0,
            successfulSearches: 0,
            failedSearches: 0,
            averageResponseTime: 0,
            providersUsage: {}
        };
    }

    /**
     * Форматирование изображения для использования в статье
     */
    formatImageForArticle(image, options = {}) {
        const size = options.size || 'regular';
        const includeAttribution = options.includeAttribution !== false;
        
        const provider = this.providers.get(image.source?.toLowerCase());
        const imageUrl = provider?.getImageUrl ? 
            provider.getImageUrl(image, size) : 
            image.url;

        const result = {
            url: imageUrl,
            alt: image.title || image.description || 'Article image',
            title: image.title,
            width: image.width,
            height: image.height
        };

        if (includeAttribution && provider?.getAttributionText) {
            result.attribution = provider.getAttributionText(image);
            result.attributionHtml = provider.getAttributionHtml ? 
                provider.getAttributionHtml(image) : 
                result.attribution;
        }

        return result;
    }

    /**
     * Создание Markdown для изображения
     */
    createImageMarkdown(image, options = {}) {
        const formatted = this.formatImageForArticle(image, options);
        
        let markdown = `![${formatted.alt}](${formatted.url})`;
        
        if (formatted.title) {
            markdown = `![${formatted.alt}](${formatted.url} "${formatted.title}")`;
        }

        if (options.includeAttribution && formatted.attribution) {
            markdown += `\n\n*${formatted.attribution}*`;
        }

        return markdown;
    }
} 