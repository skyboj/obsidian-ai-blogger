import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import yaml from 'yaml';
import { logger } from '../utils/logger.js';

/**
 * Менеджер шаблонов промптов
 */
export class PromptManager {
    constructor(promptsDir = './prompts') {
        this.promptsDir = promptsDir;
        this.templates = new Map();
    }

    /**
     * Загрузка всех шаблонов из папки prompts
     */
    async loadTemplates() {
        try {
            const files = await readdir(this.promptsDir);
            const yamlFiles = files.filter(file => extname(file) === '.yaml' || extname(file) === '.yml');
            
            logger.info(`📋 Loading ${yamlFiles.length} prompt templates...`);
            
            for (const file of yamlFiles) {
                try {
                    const templateName = file.replace(/\.(yaml|yml)$/, '');
                    const template = await this.loadTemplate(templateName);
                    this.templates.set(templateName, template);
                    logger.debug(`✅ Loaded template: ${templateName}`);
                } catch (error) {
                    logger.error(`❌ Failed to load template ${file}:`, error);
                }
            }
            
            logger.success(`📚 Loaded ${this.templates.size} prompt templates`);
            
        } catch (error) {
            logger.error('Failed to load templates:', error);
            throw error;
        }
    }

    /**
     * Загрузка конкретного шаблона
     */
    async loadTemplate(templateName) {
        const filePath = join(this.promptsDir, `${templateName}.yaml`);
        
        try {
            const content = await readFile(filePath, 'utf8');
            const template = yaml.parse(content);
            
            // Валидация шаблона
            this.validateTemplate(template, templateName);
            
            return template;
        } catch (error) {
            throw new Error(`Failed to load template ${templateName}: ${error.message}`);
        }
    }

    /**
     * Валидация шаблона
     */
    validateTemplate(template, templateName) {
        const requiredFields = ['name', 'prompt'];
        
        for (const field of requiredFields) {
            if (!template[field]) {
                throw new Error(`Template ${templateName} missing required field: ${field}`);
            }
        }

        // Проверка переменных
        if (template.variables && !Array.isArray(template.variables)) {
            throw new Error(`Template ${templateName}: variables must be an array`);
        }

        // Проверка frontmatter_template
        if (template.frontmatter_template && typeof template.frontmatter_template !== 'object') {
            throw new Error(`Template ${templateName}: frontmatter_template must be an object`);
        }
    }

    /**
     * Получение шаблона по имени
     */
    getTemplate(templateName) {
        const template = this.templates.get(templateName);
        
        if (!template) {
            throw new Error(`Template '${templateName}' not found`);
        }
        
        return template;
    }

    /**
     * Получение списка доступных шаблонов
     */
    getAvailableTemplates() {
        return Array.from(this.templates.keys()).map(name => {
            const template = this.templates.get(name);
            return {
                name,
                displayName: template.name,
                description: template.description || 'Нет описания',
                language: template.language || 'ru',
                version: template.version || '1.0'
            };
        });
    }

    /**
     * Создание промпта из шаблона с подстановкой переменных
     */
    buildPrompt(templateName, variables = {}) {
        const template = this.getTemplate(templateName);
        
        // Подготовка переменных с дефолтными значениями
        const finalVariables = this.prepareVariables(template, variables);
        
        // Подстановка переменных в промпт
        let prompt = template.prompt;
        
        for (const [key, value] of Object.entries(finalVariables)) {
            const placeholder = `{${key}}`;
            prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
        }
        
        logger.debug(`Built prompt for template ${templateName}:`, {
            variables: finalVariables,
            promptLength: prompt.length
        });
        
        return {
            prompt,
            template,
            variables: finalVariables
        };
    }

    /**
     * Подготовка переменных с дефолтными значениями
     */
    prepareVariables(template, userVariables = {}) {
        const finalVariables = { ...userVariables };
        
        // Добавляем системные переменные
        finalVariables.current_date = new Date().toISOString().split('T')[0];
        finalVariables.current_datetime = new Date().toISOString();
        finalVariables.current_timestamp = Date.now();
        
        // Обрабатываем переменные из шаблона
        if (template.variables) {
            for (const variable of template.variables) {
                const varName = typeof variable === 'string' ? variable : variable.name;
                
                // Если переменная не задана пользователем
                if (!(varName in finalVariables)) {
                    if (typeof variable === 'object' && variable.default !== undefined) {
                        // Используем дефолтное значение
                        finalVariables[varName] = variable.default;
                    } else if (typeof variable === 'object' && variable.required) {
                        // Обязательная переменная не задана
                        throw new Error(`Required variable '${varName}' not provided for template`);
                    } else {
                        // Опциональная переменная без дефолта
                        finalVariables[varName] = '';
                    }
                }
            }
        }
        
        return finalVariables;
    }

    /**
     * Создание frontmatter из шаблона
     */
    buildFrontmatter(templateName, variables = {}, additionalData = {}) {
        const template = this.getTemplate(templateName);
        
        if (!template.frontmatter_template) {
            return {};
        }
        
        const finalVariables = this.prepareVariables(template, variables);
        let frontmatter = JSON.parse(JSON.stringify(template.frontmatter_template));
        
        // Подстановка переменных в frontmatter
        frontmatter = this.substituteVariablesInObject(frontmatter, finalVariables);
        
        // Добавление дополнительных данных
        Object.assign(frontmatter, additionalData);
        
        return frontmatter;
    }

    /**
     * Рекурсивная подстановка переменных в объекте
     */
    substituteVariablesInObject(obj, variables) {
        if (typeof obj === 'string') {
            // Подстановка переменных в строке
            let result = obj;
            for (const [key, value] of Object.entries(variables)) {
                const placeholder = `{${key}}`;
                result = result.replace(new RegExp(placeholder, 'g'), value);
            }
            return result;
        } else if (Array.isArray(obj)) {
            // Обработка массива
            return obj.map(item => this.substituteVariablesInObject(item, variables));
        } else if (obj && typeof obj === 'object') {
            // Обработка объекта
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.substituteVariablesInObject(value, variables);
            }
            return result;
        }
        
        return obj;
    }

    /**
     * Получение ключевых слов для поиска изображений
     */
    getImageKeywords(templateName, variables = {}) {
        const template = this.getTemplate(templateName);
        
        if (!template.image_keywords) {
            return [variables.topic || 'article', 'concept', 'technology'];
        }
        
        const finalVariables = this.prepareVariables(template, variables);
        const keywords = template.image_keywords.map(keyword => 
            this.substituteVariablesInObject(keyword, finalVariables)
        );
        
        return keywords.filter(keyword => keyword && keyword.trim().length > 0);
    }

    /**
     * Получение метаданных шаблона
     */
    getTemplateMetadata(templateName) {
        const template = this.getTemplate(templateName);
        
        return {
            name: template.name,
            description: template.description || '',
            version: template.version || '1.0',
            language: template.language || 'ru',
            variables: template.variables || [],
            hasImageSupport: Boolean(template.image_keywords),
            hasFrontmatter: Boolean(template.frontmatter_template)
        };
    }
} 