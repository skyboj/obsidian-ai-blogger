import axios from 'axios';
import { BaseImageProvider } from './baseImageProvider.js';
import { logger } from '../utils/logger.js';

/**
 * Unsplash Provider для поиска изображений
 */
export class UnsplashProvider extends BaseImageProvider {
    constructor(config) {
        super(config);
        
        this.baseURL = 'https://api.unsplash.com';
        this.apiKey = config.apiKey;
        this.perPage = config.perPage || 10;
        this.orientation = config.orientation || 'landscape';
        this.size = config.size || 'regular';
        
        // Создаем axios instance с настройками
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Client-ID ${this.apiKey}`,
                'Accept-Version': 'v1'
            },
            timeout: 10000
        });
        
        logger.debug('Unsplash Provider initialized');
    }

    async searchImages(keywords, options = {}) {
        try {
            const normalizedKeywords = this.normalizeKeywords(keywords);
            
            if (!this.validateSearchParams(normalizedKeywords, options)) {
                throw new Error('Invalid search parameters');
            }

            const query = normalizedKeywords.join(' ');
            logger.info(`Unsplash: Searching for "${query}"`);

            const searchParams = {
                query,
                page: options.page || 1,
                per_page: Math.min(options.limit || this.perPage, 30), // Unsplash максимум 30
                orientation: options.orientation || this.orientation,
                order_by: options.orderBy || 'relevant'
            };

            const response = await this.client.get('/search/photos', {
                params: searchParams
            });

            const images = response.data.results || [];
            
            if (images.length === 0) {
                logger.warn(`Unsplash: No images found for "${query}"`);
                return this.formatResponse([], {
                    query,
                    totalResults: 0,
                    searchParams
                });
            }

            const processedImages = images.map(photo => this.processUnsplashPhoto(photo));
            
            // Применяем дополнительные фильтры
            let filteredImages = processedImages;
            
            if (options.filters) {
                filteredImages = this.filterImages(processedImages, options.filters);
            }
            
            if (options.sortBy) {
                filteredImages = this.sortImages(filteredImages, options.sortBy);
            }

            logger.success(`Unsplash: Found ${filteredImages.length} images for "${query}"`);

            return this.formatResponse(filteredImages, {
                query,
                totalResults: response.data.total,
                totalPages: response.data.total_pages,
                currentPage: searchParams.page,
                searchParams
            });

        } catch (error) {
            logger.error('Unsplash search failed:', error);
            return this.handleError(error);
        }
    }

    /**
     * Processing фото из Unsplash API
     */
    processUnsplashPhoto(photo) {
        return {
            id: photo.id,
            url: photo.urls[this.size] || photo.urls.regular,
            thumbnail: photo.urls.thumb,
            title: photo.alt_description || photo.description || '',
            description: photo.description || photo.alt_description || '',
            author: photo.user.name,
            authorUrl: photo.user.links.html,
            authorUsername: photo.user.username,
            width: photo.width,
            height: photo.height,
            source: 'Unsplash',
            unsplashUrl: photo.links.html,
            downloadUrl: photo.links.download,
            tags: photo.tags ? photo.tags.map(tag => tag.title) : [],
            license: 'Unsplash License',
            color: photo.color,
            likes: photo.likes,
            downloads: photo.downloads,
            // Различные размеры
            sizes: {
                raw: photo.urls.raw,
                full: photo.urls.full,
                regular: photo.urls.regular,
                small: photo.urls.small,
                thumb: photo.urls.thumb
            }
        };
    }

    async isAvailable() {
        try {
            if (!this.hasApiKey()) {
                return false;
            }

            // Простой тест запрос
            const response = await this.client.get('/photos', {
                params: { per_page: 1 }
            });

            return response.status === 200;
        } catch (error) {
            logger.warn('Unsplash availability check failed:', error);
            return false;
        }
    }

    /**
     * Getting случайного изображения
     */
    async getRandomImage(options = {}) {
        try {
            const params = {
                orientation: options.orientation || this.orientation,
                count: options.count || 1
            };

            if (options.query) {
                params.query = options.query;
            }

            if (options.collections) {
                params.collections = options.collections;
            }

            const response = await this.client.get('/photos/random', { params });

            const photos = Array.isArray(response.data) ? response.data : [response.data];
            const processedImages = photos.map(photo => this.processUnsplashPhoto(photo));

            logger.success(`Unsplash: Got ${processedImages.length} random image(s)`);

            return this.formatResponse(processedImages, {
                type: 'random',
                params
            });

        } catch (error) {
            logger.error('Unsplash random image failed:', error);
            return this.handleError(error);
        }
    }

    /**
     * Getting информации об изображении по ID
     */
    async getImageById(photoId) {
        try {
            const response = await this.client.get(`/photos/${photoId}`);
            const processedImage = this.processUnsplashPhoto(response.data);

            return this.formatResponse([processedImage], {
                type: 'single',
                photoId
            });

        } catch (error) {
            logger.error(`Unsplash get image ${photoId} failed:`, error);
            return this.handleError(error);
        }
    }

    /**
     * Трекинг скачивания (требуется для Unsplash API)
     */
    async trackDownload(photoId) {
        try {
            await this.client.get(`/photos/${photoId}/download`);
            logger.debug(`Unsplash: Tracked download for ${photoId}`);
        } catch (error) {
            logger.warn(`Failed to track download for ${photoId}:`, error);
        }
    }

    /**
     * Getting коллекций
     */
    async getCollections(options = {}) {
        try {
            const params = {
                page: options.page || 1,
                per_page: Math.min(options.limit || 10, 30)
            };

            const response = await this.client.get('/collections', { params });

            return {
                success: true,
                collections: response.data.map(collection => ({
                    id: collection.id,
                    title: collection.title,
                    description: collection.description,
                    totalPhotos: collection.total_photos,
                    coverPhoto: collection.cover_photo ? 
                        this.processUnsplashPhoto(collection.cover_photo) : null,
                    user: collection.user.name
                })),
                metadata: {
                    totalResults: response.headers['x-total'] || response.data.length,
                    currentPage: params.page
                }
            };

        } catch (error) {
            logger.error('Unsplash get collections failed:', error);
            return this.handleError(error);
        }
    }

    /**
     * Поиск изображений в коллекции
     */
    async searchInCollection(collectionId, options = {}) {
        try {
            const params = {
                page: options.page || 1,
                per_page: Math.min(options.limit || this.perPage, 30)
            };

            const response = await this.client.get(`/collections/${collectionId}/photos`, { params });

            const processedImages = response.data.map(photo => this.processUnsplashPhoto(photo));

            return this.formatResponse(processedImages, {
                type: 'collection',
                collectionId,
                currentPage: params.page
            });

        } catch (error) {
            logger.error(`Unsplash collection ${collectionId} search failed:`, error);
            return this.handleError(error);
        }
    }

    handleError(error) {
        const baseError = super.handleError(error);

        // Специфичные ошибки Unsplash
        if (error.response?.status === 403) {
            return {
                ...baseError,
                error: 'RATE_LIMIT_OR_ACCESS_DENIED',
                message: 'Превышен лимит запросов или доступ запрещен'
            };
        }

        if (error.response?.data?.errors) {
            return {
                ...baseError,
                error: 'UNSPLASH_API_ERROR',
                message: error.response.data.errors.join(', ')
            };
        }

        return baseError;
    }

    /**
     * Getting URL для скачивания изображения нужного размера
     */
    getImageUrl(photo, size = 'regular') {
        if (photo.sizes && photo.sizes[size]) {
            return photo.sizes[size];
        }
        
        return photo.url || photo.downloadUrl;
    }

    /**
     * Форматирование атрибуции для Unsplash
     */
    getAttributionText(photo) {
        return `Photo by ${photo.author} on Unsplash`;
    }

    /**
     * Creating HTML атрибуции
     */
    getAttributionHtml(photo) {
        return `Photo by <a href="${photo.authorUrl}?utm_source=your_app&utm_medium=referral">${photo.author}</a> on <a href="https://unsplash.com/?utm_source=your_app&utm_medium=referral">Unsplash</a>`;
    }
} 