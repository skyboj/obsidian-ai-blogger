/**
 * Generators Module - main export for all content generators
 */

import { ContentGenerator } from './contentGenerator.js';

// Export only ContentGenerator to avoid circular imports
export { ContentGenerator };

/**
 * Create ContentGenerator instance with configuration
 */
export function createContentGenerator(config) {
    return new ContentGenerator(config);
} 