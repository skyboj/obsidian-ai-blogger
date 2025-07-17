/**
 * Media Module - главный экспорт всех провайдеров изображений
 */

export { BaseImageProvider } from './baseImageProvider.js';
export { UnsplashProvider } from './unsplashProvider.js';
export { ImageManager } from './imageManager.js';

// Импортируем ImageManager для локального использования
import { ImageManager } from './imageManager.js';

/**
 * Creating экземпляра ImageManager с конфигурацией
 */
export function createImageManager(config) {
    return new ImageManager(config);
} 