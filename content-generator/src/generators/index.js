/**
 * Generators Module - главный экспорт всех генераторов контента
 */

export { PromptManager } from './promptManager.js';
export { MarkdownGenerator } from './markdownGenerator.js';
import { ContentGenerator } from './contentGenerator.js';

// Реэкспорт ContentGenerator
export { ContentGenerator };

/**
 * Создание экземпляра ContentGenerator с конфигурацией
 */
export function createContentGenerator(config) {
    return new ContentGenerator(config);
} 