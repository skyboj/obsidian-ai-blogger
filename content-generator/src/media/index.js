/**
 * Media Module - главный экспорт всех медиа провайдеров и менеджера
 */

export { BaseImageProvider } from './baseImageProvider.js';
export { UnsplashProvider } from './unsplashProvider.js';
import { ImageManager } from './imageManager.js';

// Реэкспорт ImageManager
export { ImageManager };

/**
 * Создание экземпляра ImageManager с конфигурацией
 */
export function createImageManager(config) {
    return new ImageManager(config);
} 