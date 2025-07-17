import { copyFile, mkdir, readdir, stat } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { logger } from './logger.js';

/**
 * Утилита для интеграции с основным блоговым приложением Obsidian Blogger
 */
export class BlogIntegration {
    constructor(config = {}) {
        this.generatorOutputDir = config.generatorOutputDir || './output';
        this.blogFolderPath = config.blogFolderPath || '../obsidian-blogger/Blog';
        this.draftsSubfolder = config.draftsSubfolder || 'drafts';
        this.autoSync = config.autoSync || false;
        
        logger.debug('BlogIntegration initialized', {
            generatorOutputDir: this.generatorOutputDir,
            blogFolderPath: this.blogFolderPath,
            autoSync: this.autoSync
        });
    }

    /**
     * Копирование файла из генератора в папку блога
     */
    async copyToBlogs(filePath, options = {}) {
        try {
            const {
                publishReady = false,
                subfolder = null,
                overwrite = false
            } = options;

            // Определяем целевую папку
            const targetFolder = publishReady 
                ? this.blogFolderPath 
                : join(this.blogFolderPath, this.draftsSubfolder);

            // Если указана подпапка
            const finalTargetFolder = subfolder 
                ? join(targetFolder, subfolder) 
                : targetFolder;

            // Создаем папку если не существует
            await this.ensureDirectoryExists(finalTargetFolder);

            // Получаем имя файла
            const fileName = filePath.split('/').pop();
            const targetPath = join(finalTargetFolder, fileName);

            // Проверяем существование файла
            if (!overwrite) {
                try {
                    await stat(targetPath);
                    logger.warn(`File already exists: ${targetPath}`);
                    return {
                        success: false,
                        error: 'FILE_EXISTS',
                        message: 'Файл уже существует в целевой папке'
                    };
                } catch (error) {
                    // Файл не существует - это хорошо
                }
            }

            // Копируем файл
            await copyFile(filePath, targetPath);

            const status = publishReady ? 'published' : 'draft';
            logger.success(`📄 Copied to blog (${status}): ${targetPath}`);

            return {
                success: true,
                sourcePath: filePath,
                targetPath,
                status,
                folder: finalTargetFolder
            };

        } catch (error) {
            logger.error('Failed to copy file to blog:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Автоматическое копирование всех новых файлов
     */
    async syncNewFiles() {
        try {
            logger.info('🔄 Starting blog sync...');

            // Получаем список файлов из генератора
            const generatorFiles = await this.getGeneratorFiles();
            
            // Получаем список файлов в блоге
            const blogFiles = await this.getBlogFiles();

            // Находим новые файлы
            const newFiles = generatorFiles.filter(genFile => {
                return !blogFiles.some(blogFile => 
                    blogFile.name === genFile.name
                );
            });

            if (newFiles.length === 0) {
                logger.info('ℹ️ No new files to sync');
                return {
                    success: true,
                    syncedFiles: [],
                    message: 'No new files found'
                };
            }

            logger.info(`📋 Found ${newFiles.length} new files to sync`);

            const syncResults = [];

            for (const file of newFiles) {
                const result = await this.copyToBlogs(file.path, {
                    publishReady: false, // По умолчанию в черновики
                    overwrite: false
                });

                syncResults.push({
                    fileName: file.name,
                    result
                });

                if (result.success) {
                    logger.info(`✅ Synced: ${file.name}`);
                } else {
                    logger.warn(`❌ Failed to sync: ${file.name} - ${result.error}`);
                }
            }

            const successCount = syncResults.filter(r => r.result.success).length;
            
            logger.success(`🎉 Sync completed: ${successCount}/${newFiles.length} files synced`);

            return {
                success: true,
                syncedFiles: syncResults,
                totalFiles: newFiles.length,
                successCount
            };

        } catch (error) {
            logger.error('Sync failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Публикация черновика (перемещение из drafts в основную папку)
     */
    async publishDraft(fileName) {
        try {
            const draftPath = join(this.blogFolderPath, this.draftsSubfolder, fileName);
            const publishPath = join(this.blogFolderPath, fileName);

            // Проверяем существование черновика
            try {
                await stat(draftPath);
            } catch (error) {
                return {
                    success: false,
                    error: 'DRAFT_NOT_FOUND',
                    message: 'Черновик не найден'
                };
            }

            // Копируем в основную папку
            await copyFile(draftPath, publishPath);

            logger.success(`📰 Published: ${fileName}`);

            return {
                success: true,
                draftPath,
                publishPath,
                message: 'Статья опубликована'
            };

        } catch (error) {
            logger.error('Failed to publish draft:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Получение списка файлов из генератора
     */
    async getGeneratorFiles() {
        try {
            const files = [];
            const outputDir = resolve(this.generatorOutputDir);
            
            // Сканируем output папку
            await this.scanDirectory(outputDir, files, '.md');
            
            // Сканируем drafts папку
            const draftsDir = join(outputDir, 'drafts');
            try {
                await this.scanDirectory(draftsDir, files, '.md');
            } catch (error) {
                // Папка drafts может не существовать
            }

            return files;

        } catch (error) {
            logger.error('Failed to get generator files:', error);
            return [];
        }
    }

    /**
     * Получение списка файлов из блога
     */
    async getBlogFiles() {
        try {
            const files = [];
            const blogDir = resolve(this.blogFolderPath);
            
            // Сканируем основную папку блога
            await this.scanDirectory(blogDir, files, '.md');
            
            // Сканируем папку черновиков
            const draftsDir = join(blogDir, this.draftsSubfolder);
            try {
                await this.scanDirectory(draftsDir, files, '.md');
            } catch (error) {
                // Папка drafts может не существовать
            }

            return files;

        } catch (error) {
            logger.error('Failed to get blog files:', error);
            return [];
        }
    }

    /**
     * Рекурсивное сканирование директории
     */
    async scanDirectory(dirPath, files, extension) {
        try {
            const items = await readdir(dirPath, { withFileTypes: true });

            for (const item of items) {
                const fullPath = join(dirPath, item.name);

                if (item.isDirectory()) {
                    // Рекурсивно сканируем поддиректории
                    await this.scanDirectory(fullPath, files, extension);
                } else if (item.isFile() && item.name.endsWith(extension)) {
                    const stats = await stat(fullPath);
                    files.push({
                        name: item.name,
                        path: fullPath,
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            }
        } catch (error) {
            // Игнорируем ошибки доступа к папкам
        }
    }

    /**
     * Создание директории если не существует
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
     * Проверка доступности папки блога
     */
    async checkBlogFolderAccess() {
        try {
            const blogPath = resolve(this.blogFolderPath);
            await stat(blogPath);
            
            // Проверяем возможность записи создав тестовый файл
            const testFile = join(blogPath, '.test-access');
            try {
                await copyFile(__filename, testFile);
                await stat(testFile);
                // Удаляем тестовый файл
                await import('fs').then(fs => fs.promises.unlink(testFile));
                
                return {
                    accessible: true,
                    writable: true,
                    path: blogPath
                };
            } catch (error) {
                return {
                    accessible: true,
                    writable: false,
                    path: blogPath,
                    error: 'No write access'
                };
            }

        } catch (error) {
            return {
                accessible: false,
                writable: false,
                path: this.blogFolderPath,
                error: error.message
            };
        }
    }

    /**
     * Получение статистики интеграции
     */
    async getIntegrationStats() {
        try {
            const [generatorFiles, blogFiles, accessCheck] = await Promise.all([
                this.getGeneratorFiles(),
                this.getBlogFiles(),
                this.checkBlogFolderAccess()
            ]);

            const generatorCount = generatorFiles.length;
            const blogCount = blogFiles.length;
            
            // Находим общие файлы
            const commonFiles = generatorFiles.filter(genFile => 
                blogFiles.some(blogFile => blogFile.name === genFile.name)
            );

            return {
                generatorFiles: generatorCount,
                blogFiles: blogCount,
                commonFiles: commonFiles.length,
                newFiles: generatorCount - commonFiles.length,
                blogAccess: accessCheck,
                autoSync: this.autoSync
            };

        } catch (error) {
            logger.error('Failed to get integration stats:', error);
            return {
                error: error.message
            };
        }
    }

    /**
     * Создание символической ссылки (для продвинутой интеграции)
     */
    async createSymlink() {
        try {
            const { symlink } = await import('fs').then(fs => fs.promises);
            const outputPath = resolve(this.generatorOutputDir);
            const linkPath = join(this.blogFolderPath, 'generated');

            await symlink(outputPath, linkPath, 'dir');

            logger.success(`🔗 Created symlink: ${linkPath} -> ${outputPath}`);
            
            return {
                success: true,
                linkPath,
                targetPath: outputPath
            };

        } catch (error) {
            logger.error('Failed to create symlink:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
} 