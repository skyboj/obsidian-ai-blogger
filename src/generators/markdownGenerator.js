import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import matter from 'gray-matter';
import slugify from 'slugify';
import { logger } from '../utils/logger.js';

/**
 * Markdown File Generator
 */
export class MarkdownGenerator {
    constructor(outputDir = './output') {
        this.outputDir = resolve(process.cwd(), outputDir);
    }

    /**
     * Create Markdown file from content
     */
    async generateMarkdownFile(options) {
        const {
            title,
            content,
            frontmatter = {},
            filename = null,
            subfolder = null
        } = options;

        try {
            // Генерация имени файла если не указано
            const finalFilename = filename || this.generateFilename(title);
            
            // Подготовка frontmatter
            const finalFrontmatter = this.prepareFrontmatter(title, frontmatter);
            
            // Creating полного контента с frontmatter
            const markdownContent = this.buildMarkdownContent(finalFrontmatter, content);
            
            // Определение пути для сохранения
            const outputPath = this.getOutputPath(finalFilename, subfolder);
            
            // Creating директории если не существует
            await this.ensureDirectoryExists(dirname(outputPath));
            
            // Сохранение файла
            await writeFile(outputPath, markdownContent, 'utf8');
            
            logger.success(`📄 Markdown file created: ${outputPath}`);
            
            return {
                success: true,
                filename: finalFilename,
                path: outputPath,
                size: markdownContent.length,
                frontmatter: finalFrontmatter
            };
            
        } catch (error) {
            logger.error('Failed to generate markdown file:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Генерация имени файла из заголовка
     */
    generateFilename(title) {
        const baseFilename = slugify(title, {
            lower: true,
            strict: true,
            locale: 'ru'
        });
        
        // Добавляем дату для уникальности
        const date = new Date().toISOString().split('T')[0];
        
        return `${date}-${baseFilename}.md`;
    }

    /**
     * Подготовка frontmatter с обязательными полями
     */
    prepareFrontmatter(title, userFrontmatter = {}) {
        const currentDate = new Date().toISOString().split('T')[0];
        
        const defaultFrontmatter = {
            title,
            description: '',
            publish: false, // По умолчанию статьи в черновиках
            created_date: currentDate,
            tags: [],
            featured_image: '',
            slug: ''
        };

        // Объединяем с пользовательским frontmatter
        const finalFrontmatter = {
            ...defaultFrontmatter,
            ...userFrontmatter,
            title // Title всегда берем из параметра
        };

        // Генерируем slug если не указан
        if (!finalFrontmatter.slug) {
            finalFrontmatter.slug = slugify(title, {
                lower: true,
                strict: true,
                locale: 'ru'
            });
        }

        return finalFrontmatter;
    }

    /**
     * Creating полного Markdown контента с frontmatter
     */
    buildMarkdownContent(frontmatter, content) {
        // `matter.stringify` правильно объединяет frontmatter и контент
        return matter.stringify(content, frontmatter);
    }

    /**
     * Getting полного пути для сохранения
     */
    getOutputPath(filename, subfolder = null) {
        if (subfolder) {
            return join(this.outputDir, subfolder, filename);
        }
        return join(this.outputDir, filename);
    }

    /**
     * Creating директории если не существует
     */
    async ensureDirectoryExists(dirPath) {
        try {
            await mkdir(dirPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Creating черновика статьи
     */
    async createDraft(title, content, frontmatter = {}) {
        const draftFrontmatter = {
            ...frontmatter,
            publish: false,
            draft: true
        };

        return this.generateMarkdownFile({
            title,
            content,
            frontmatter: draftFrontmatter,
            subfolder: 'drafts'
        });
    }

    /**
     * Creating готовой статьи для публикации
     */
    async createArticle(title, content, frontmatter = {}) {
        const articleFrontmatter = {
            ...frontmatter,
            publish: true,
            draft: false
        };

        return this.generateMarkdownFile({
            title,
            content,
            frontmatter: articleFrontmatter
        });
    }

    /**
     * Обновление существующего файла
     */
    async updateMarkdownFile(filePath, newContent, newFrontmatter = null) {
        try {
            // Читаем существующий файл
            const existingContent = await readFile(filePath, 'utf8');
            const parsed = matter(existingContent);
            
            // Обновляем frontmatter если передан
            const finalFrontmatter = newFrontmatter 
                ? { ...parsed.data, ...newFrontmatter }
                : parsed.data;
            
            // Создаем обновленный контент
            const updatedContent = this.buildMarkdownContent(finalFrontmatter, newContent);
            
            // Сохраняем файл
            await writeFile(filePath, updatedContent, 'utf8');
            
            logger.success(`📝 Updated markdown file: ${filePath}`);
            
            return {
                success: true,
                path: filePath,
                frontmatter: finalFrontmatter
            };
            
        } catch (error) {
            logger.error('Failed to update markdown file:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Getting метаданных файла
     */
    async getFileMetadata(filePath) {
        try {
            const content = await readFile(filePath, 'utf8');
            const parsed = matter(content);
            
            return {
                frontmatter: parsed.data,
                content: parsed.content,
                wordCount: this.countWords(parsed.content),
                charCount: parsed.content.length,
                readingTime: this.estimateReadingTime(parsed.content)
            };
            
        } catch (error) {
            logger.error('Failed to read file metadata:', error);
            return null;
        }
    }

    /**
     * Подсчет количества слов
     */
    countWords(text) {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Оценка времени чтения
     */
    estimateReadingTime(text) {
        const wordsPerMinute = 200; // Средняя скорость чтения
        const wordCount = this.countWords(text);
        const minutes = Math.ceil(wordCount / wordsPerMinute);
        
        return {
            minutes,
            words: wordCount,
            text: minutes === 1 ? '1 минута' : `${minutes} минут`
        };
    }

    /**
     * Валидация frontmatter
     */
    validateFrontmatter(frontmatter) {
        const requiredFields = ['title'];
        const errors = [];
        
        for (const field of requiredFields) {
            if (!frontmatter[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }
        
        // Check типов данных
        if (frontmatter.tags && !Array.isArray(frontmatter.tags)) {
            errors.push('Tags must be an array');
        }
        
        if (frontmatter.publish && typeof frontmatter.publish !== 'boolean') {
            errors.push('Publish must be a boolean');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Creating резервной копии
     */
    async createBackup(filePath) {
        try {
            const content = await readFile(filePath, 'utf8');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${filePath}.backup.${timestamp}`;
            
            await writeFile(backupPath, content, 'utf8');
            
            logger.info(`📋 Backup created: ${backupPath}`);
            return backupPath;
            
        } catch (error) {
            logger.error('Failed to create backup:', error);
            return null;
        }
    }
} 