/**
 * AI Module - главный экспорт всех AI провайдеров и менеджера
 */

export { BaseAIProvider } from './baseProvider.js';
export { OpenAIProvider } from './openaiProvider.js';
export { AIManager } from './aiManager.js';

// Импортируем AIManager для локального использования
import { AIManager } from './aiManager.js';

/**
 * Creating экземпляра AIManager с конфигурацией
 */
export function createAIManager(config) {
    return new AIManager(config);
} 