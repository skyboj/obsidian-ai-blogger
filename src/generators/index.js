/**
 * Generators Module - главный экспорт всех генераторов контента
 */

import { ContentGenerator } from './contentGenerator.js';

// Экспорт только ContentGenerator для избежания circular imports
export { ContentGenerator };

/**
 * Создание экземпляра ContentGenerator с конфигурацией
 */
export function createContentGenerator(config) {
    return new ContentGenerator(config);
} 