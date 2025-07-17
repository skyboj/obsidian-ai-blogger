/**
 * AI Module - главный экспорт всех AI провайдеров и менеджера
 */

export { BaseAIProvider } from './baseProvider.js';
export { OpenAIProvider } from './openaiProvider.js';
export { AnthropicProvider } from './anthropicProvider.js';
export { AIManager } from './aiManager.js';

/**
 * Создание экземпляра AIManager с конфигурацией
 */
export function createAIManager(config) {
    return new AIManager(config);
} 