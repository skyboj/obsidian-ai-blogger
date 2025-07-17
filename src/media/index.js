/**
 * Media Module - главный экспорт всех провайдеров изображений
 */

export { BaseImageProvider } from './baseImageProvider.js';
export { UnsplashProvider } from './unsplashProvider.js';
export { ImageManager } from './imageManager.js';

/**
 * Создание экземпляра ImageManager с конфигурацией
 */
export function createImageManager(config) {
    return new ImageManager(config);
} 