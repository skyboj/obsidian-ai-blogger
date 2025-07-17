/**
 * Базовый класс для всех провайдеров изображений
 */
export class BaseImageProvider {
    constructor(config) {
        this.config = config;
        this.name = this.constructor.name;
    }

    /**
     * Поиск изображений по ключевым словам
     * @param {string|Array} keywords - Ключевые слова для поиска
     * @param {Object} options - Дополнительные опции поиска
     * @returns {Promise<Object>} Результат поиска
     */
    async searchImages(keywords, options = {}) {
        throw new Error(`Method searchImages() must be implemented in ${this.name}`);
    }

    /**
     * Проверка доступности провайдера
     * @returns {Promise<boolean>} Доступен ли провайдер
     */
    async isAvailable() {
        try {
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
     * Нормализация ключевых слов
     * @param {string|Array} keywords 
     * @returns {Array}
     */
    normalizeKeywords(keywords) {
        if (typeof keywords === 'string') {
            return [keywords];
        }
        
        if (Array.isArray(keywords)) {
            return keywords.filter(keyword => keyword && keyword.trim().length > 0);
        }
        
        return [];
    }

    /**
     * Валидация параметров поиска
     * @param {Array} keywords 
     * @param {Object} options 
     * @returns {boolean}
     */
    validateSearchParams(keywords, options = {}) {
        if (!keywords || keywords.length === 0) {
            return false;
        }

        // Проверка лимитов
        const limit = options.limit || 10;
        if (limit < 1 || limit > 50) {
            return false;
        }

        return true;
    }

    /**
     * Форматирование успешного ответа
     * @param {Array} images 
     * @param {Object} metadata 
     * @returns {Object}
     */
    formatResponse(images, metadata = {}) {
        return {
            success: true,
            provider: this.name,
            images: images.map(image => this.normalizeImageData(image)),
            metadata: {
                timestamp: new Date().toISOString(),
                total: images.length,
                ...metadata
            }
        };
    }

    /**
     * Нормализация данных изображения
     * @param {Object} imageData 
     * @returns {Object}
     */
    normalizeImageData(imageData) {
        return {
            id: imageData.id || null,
            url: imageData.url || imageData.src || null,
            thumbnail: imageData.thumbnail || imageData.thumb || null,
            title: imageData.title || imageData.alt || '',
            description: imageData.description || '',
            author: imageData.author || imageData.photographer || '',
            authorUrl: imageData.authorUrl || imageData.photographerUrl || '',
            source: imageData.source || this.name,
            width: imageData.width || null,
            height: imageData.height || null,
            tags: imageData.tags || [],
            license: imageData.license || 'Unknown',
            downloadUrl: imageData.downloadUrl || imageData.url
        };
    }

    /**
     * Обработка ошибок провайдера
     * @param {Error} error 
     * @returns {Object}
     */
    handleError(error) {
        const baseError = {
            success: false,
            provider: this.name,
            timestamp: new Date().toISOString()
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

        if (error.response?.status === 403) {
            return {
                ...baseError,
                error: 'ACCESS_FORBIDDEN',
                message: 'Доступ запрещен'
            };
        }

        return {
            ...baseError,
            error: 'UNKNOWN_ERROR',
            message: error.message || 'Неизвестная ошибка'
        };
    }

    /**
     * Фильтрация изображений по критериям
     * @param {Array} images 
     * @param {Object} filters 
     * @returns {Array}
     */
    filterImages(images, filters = {}) {
        let filtered = [...images];

        // Фильтр по размеру
        if (filters.minWidth || filters.minHeight) {
            filtered = filtered.filter(image => {
                const widthOk = !filters.minWidth || (image.width && image.width >= filters.minWidth);
                const heightOk = !filters.minHeight || (image.height && image.height >= filters.minHeight);
                return widthOk && heightOk;
            });
        }

        // Фильтр по ориентации
        if (filters.orientation) {
            filtered = filtered.filter(image => {
                if (!image.width || !image.height) return true;
                
                const ratio = image.width / image.height;
                
                switch (filters.orientation) {
                    case 'landscape':
                        return ratio > 1.2;
                    case 'portrait':
                        return ratio < 0.8;
                    case 'square':
                        return ratio >= 0.8 && ratio <= 1.2;
                    default:
                        return true;
                }
            });
        }

        return filtered;
    }

    /**
     * Сортировка изображений
     * @param {Array} images 
     * @param {string} sortBy 
     * @returns {Array}
     */
    sortImages(images, sortBy = 'relevance') {
        const sorted = [...images];

        switch (sortBy) {
            case 'size':
                return sorted.sort((a, b) => {
                    const sizeA = (a.width || 0) * (a.height || 0);
                    const sizeB = (b.width || 0) * (b.height || 0);
                    return sizeB - sizeA;
                });
            
            case 'width':
                return sorted.sort((a, b) => (b.width || 0) - (a.width || 0));
            
            case 'height':
                return sorted.sort((a, b) => (b.height || 0) - (a.height || 0));
            
            default:
                return sorted; // Оставляем исходный порядок (relevance)
        }
    }
} 