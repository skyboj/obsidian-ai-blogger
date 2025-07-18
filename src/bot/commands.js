import { createContentGenerator } from '../generators/index.js';
import { MarkdownGenerator } from '../generators/markdownGenerator.js';
import { logger } from '../utils/logger.js';
import { publishToTelegraph, createTelegraphAccount } from '../utils/telegraph.js';
import { RateLimiter } from '../utils/rateLimiter.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import matter from 'gray-matter';
import { exec } from 'child_process';

export class CommandHandler {
    constructor(config, rateLimiter) {
        this.config = config;
        this.rateLimiter = rateLimiter;
        this.userStates = {};
        this.userDrafts = {}; // Store drafts per user
        this.contentGenerator = createContentGenerator(config);
        this.markdownGenerator = this.contentGenerator.markdownGenerator;
        this.initializeTelegraph();
    }

    async initializeTelegraph() {
        this.telegraph = await createTelegraphAccount();
    }

    async handleMessage(bot, msg) {
        const isCallback = !!msg.data && !!msg.message;
        const text = isCallback ? msg.data : msg.text;
        const userId = msg.from?.id;
        const chatId = isCallback ? msg.message.chat.id : msg.chat?.id;
        const originalMessage = isCallback ? msg.message : msg;

        if (!userId || !chatId) {
            logger.warn('Could not determine user or chat ID from message:', msg);
            return;
        }

        try {
            if (!this.isAuthorized(userId)) {
                await bot.sendMessage(chatId, '❌ You do not have access to this bot.');
                logger.warn(`Unauthorized access attempt from user ${userId}`);
                return;
            }

            const rateLimitResult = this.rateLimiter.canMakeRequest(userId);
            if (!rateLimitResult.allowed) {
                const waitTime = this.rateLimiter.formatWaitTime(rateLimitResult.resetIn);
                await bot.sendMessage(chatId, `⏰ Rate limit exceeded. Please try again in ${waitTime}.`);
                return;
            }
            this.rateLimiter.recordRequest(userId);

            if (isCallback) {
                await this.handleCallbackQuery(bot, msg);
            } else if (text?.startsWith('/')) {
                await this.handleCommand(bot, originalMessage);
            } else {
                await this.handleRegularMessage(bot, originalMessage);
            }
        } catch (error) {
            logger.error(`Error handling message from user ${userId}:`, error);
            await bot.sendMessage(chatId, '💥 An error occurred while processing the message.');
        }
    }

    isAuthorized(userId) {
        const adminId = process.env.ADMIN_TELEGRAM_ID;
        if (!adminId) return false;
        const adminIds = adminId.split(',').map(id => parseInt(id.trim()));
        return adminIds.includes(userId);
    }

    async handleCommand(bot, msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const [command, ...args] = msg.text.split(' ');
        const commandName = command.substring(1);

        logger.info(`User ${userId} executed command: ${commandName}`);

        switch (commandName) {
            case 'start':
                await this.handleStart(bot, chatId);
                break;
            case 'generate':
                await this.handleGenerate(bot, chatId, userId, args.join(' '));
                break;
            case 'drafts':
                await this.handleDrafts(bot, chatId, userId);
                break;
            case 'publish':
                await this.handlePublish(bot, chatId, userId);
                break;
            case 'help':
                await this.handleHelp(bot, chatId);
                break;
            default:
                await bot.sendMessage(chatId, `❓ Unknown command: ${command}\n\nUse /help for a list of commands.`);
        }
    }

    async handleStart(bot, chatId) {
        const welcomeMessage = `
👋 *Welcome to QContent!*

I am your AI assistant for content creation. Here's what I can do:

- */generate [topic]* - Create a draft article on a given topic.
- */drafts* - Show a list of all drafts.
- */publish* - Publish marked articles.
- */help* - Show this message.

To get started, try generating your first article!
For example: \`/generate How to open a coffee shop in Edinburgh\`
        `;
        await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    }

    async handleRegularMessage(bot, msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userState = this.userStates[userId];

        if (userState?.action === 'waiting_for_topic') {
            await this.handleGenerate(bot, chatId, userId, msg.text);
        } else {
            await bot.sendMessage(chatId, '💡 Please use commands to interact with the bot.\nFor example: /generate "your topic"');
        }
    }

    async handleGenerate(bot, chatId, userId, topic) {
        if (!topic || topic.trim().length === 0) {
            this.userStates[userId] = { action: 'waiting_for_topic' };
            await bot.sendMessage(chatId, 'Please provide a topic for the article.\nFor example: /generate Best places to visit in Europe');
            return;
        }

        try {
            await bot.sendMessage(chatId, '⏳ *Generating article...* This may take a few minutes.', { parse_mode: 'Markdown' });
            logger.info(`Starting content generation for topic: "${topic}" by user ${userId}`);
            const article = await this.contentGenerator.generateCompleteArticle(topic);
            const finalMessage = `
✅ *Article successfully generated!*

**Topic:** ${article.title}
**File:** \`${article.filename}\`

You can now find it in the drafts list using the /drafts command and mark it for publication.
            `;
            await bot.sendMessage(chatId, finalMessage, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('Content generation error:', error);
            await bot.sendMessage(chatId, `❌ *Error generating article:* ${error.message}`);
        } finally {
            delete this.userStates[userId];
        }
    }

    async handleDrafts(bot, chatId, userId) {
        const drafts = await this.markdownGenerator.getDrafts();
        this.userDrafts[userId] = drafts;

        if (drafts.length === 0) {
            await bot.sendMessage(chatId, 'You have no drafts yet.');
            return;
        }

        const keyboard = drafts.map((draft, index) => {
            const status = draft.frontmatter.publish ? '✅' : '📝';
            return [
                { text: `${status} ${draft.title}`, callback_data: `view_draft:${index}` },
                { text: 'Mark for Publication', callback_data: `mark_publish:${index}` }
            ];
        });

        await bot.sendMessage(chatId, 'Here is the list of your drafts:', {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    }

    async handleViewDraft(bot, chatId, userId, draftIndex) {
        const draft = this.userDrafts[userId]?.[draftIndex];
        if (!draft) {
            await bot.sendMessage(chatId, 'Draft not found. Please try again.');
            return;
        }

        // Always prepare text preview as fallback
        const textPreview = draft.content.substring(0, 600) + (draft.content.length > 600 ? '...' : '');
        
        // Try Telegraph first
        let telegraphUrl = null;
        if (this.telegraph) {
            try {
                telegraphUrl = await publishToTelegraph(draft.title, draft.content);
            } catch (error) {
                logger.warn(`Telegraph failed: ${error.message}`);
            }
        }

        if (telegraphUrl) {
            await bot.sendMessage(chatId, 
                `📖 **${draft.title}**\n\n🔗 Read full article: ${telegraphUrl}\n\n📝 Preview:\n${textPreview}`, 
                { parse_mode: 'Markdown' }
            );
        } else {
            await bot.sendMessage(chatId, 
                `📖 **${draft.title}**\n\n${textPreview}\n\n_Note: Telegraph preview unavailable_`, 
                { parse_mode: 'Markdown' }
            );
        }
    }

    async handleMarkForPublication(bot, callbackQuery, draftIndex) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const messageId = callbackQuery.message.message_id;

        const draft = this.userDrafts[userId]?.[draftIndex];
        if (!draft) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Draft not found. Please try again.', show_alert: true });
            return;
        }

        // Check if already marked for publication
        if (draft.frontmatter.publish) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ This draft is already marked for publication.' });
            return;
        }

        try {
            await this.markdownGenerator.updateDraft(draft.filename, { publish: true });
            logger.info(`📝 Marked draft for publication: ${draft.filename}`);
            
            // Update the local cache
            this.userDrafts[userId][draftIndex].frontmatter.publish = true;

            // Recreate the keyboard with updated statuses
            const keyboard = this.userDrafts[userId].map((d, index) => {
                const status = d.frontmatter.publish ? '✅' : '📝';
                return [
                    { text: `${status} ${d.title}`, callback_data: `view_draft:${index}` },
                    { text: 'Mark for Publication', callback_data: `mark_publish:${index}` }
                ];
            });

            try {
                await bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, { chat_id: chatId, message_id: messageId });
            } catch (editError) {
                // If editing fails (message not modified), just send confirmation
                logger.warn(`Could not update message markup: ${editError.message}`);
            }
            
            await bot.answerCallbackQuery(callbackQuery.id, { text: `✅ ${draft.title} has been marked for publication.` });

        } catch (error) {
            logger.error(`Failed to mark draft for publication: ${error.message}`);
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Failed to mark the draft for publication.', show_alert: true });
        }
    }

    async handleCallbackQuery(bot, callbackQuery) {
        const { data } = callbackQuery;
        const [action, draftIndexStr] = data.split(':');
        const draftIndex = parseInt(draftIndexStr, 10);

        switch (action) {
            case 'view_draft':
                await this.handleViewDraft(bot, callbackQuery.message.chat.id, callbackQuery.from.id, draftIndex);
                await bot.answerCallbackQuery(callbackQuery.id);
                break;
            case 'mark_publish':
                await this.handleMarkForPublication(bot, callbackQuery, draftIndex);
                break;
        }
    }

    async handlePublish(bot, chatId) {
        await bot.sendMessage(chatId, '🚀 Publication process started...');
        const scriptPath = join(process.cwd(), 'scripts', 'sync-obsidian.js');

        exec(`node ${scriptPath}`, async (error, stdout, stderr) => {
            if (error) {
                logger.error(`exec error: ${error}`);
                await bot.sendMessage(chatId, `Failed to publish articles: ${error.message}`);
                return;
            }
            if (stderr) {
                logger.error(`stderr: ${stderr}`);
            }
            logger.info(`stdout: ${stdout}`);
            await bot.sendMessage(chatId, '✅ Sync completed successfully!');

            exec('npm run build', async (buildError, buildStdout, buildStderr) => {
                if (buildError) {
                    logger.error(`exec error: ${buildError}`);
                    await bot.sendMessage(chatId, `Failed to build site: ${buildError.message}`);
                    return;
                }
                if (buildStderr) {
                    logger.error(`stderr: ${buildStderr}`);
                }
                logger.info(`stdout: ${buildStdout}`);
                await bot.sendMessage(chatId, '🎉 Site built successfully!');
            });
        });
    }

    async handleHelp(bot, chatId) {
        const helpMessage = `
*QContent Bot Help*

Here are the available commands:

-   */generate [topic]* - Creates a new draft article on the specified topic. If you don't provide a topic, I will ask for one.
-   */drafts* - Shows a list of your current drafts. You can view them or mark them for publication from the list.
-   */publish* - Starts the process of publishing all drafts that have been marked for publication.
-   */help* - Shows this help message.

*Workflow:*
1.  Use */generate* to create articles.
2.  Use */drafts* to review them. Mark the ones you like for publication.
3.  Use */publish* to build and deploy your site with the new articles.
        `;
        await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    }
} 