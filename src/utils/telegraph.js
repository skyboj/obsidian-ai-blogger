import { Telegraph } from 'better-telegraph';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from './logger.js';
import { marked } from 'marked';

const tokenFile = join(process.cwd(), 'telegraph_token.json');
const cacheFile = join(process.cwd(), 'telegraph_cache.json');

let telegraphInstance = null;
let articleCache = {};

// Load article cache
async function loadCache() {
    try {
        const cacheData = await readFile(cacheFile, 'utf-8');
        articleCache = JSON.parse(cacheData);
        logger.info(`📋 Loaded ${Object.keys(articleCache).length} cached articles`);
    } catch (error) {
        logger.info('📋 No article cache found, starting fresh');
        articleCache = {};
    }
}

// Save article cache
async function saveCache() {
    try {
        await writeFile(cacheFile, JSON.stringify(articleCache, null, 2));
        logger.info('💾 Article cache saved');
    } catch (error) {
        logger.error('❌ Failed to save article cache:', error.message);
    }
}

// Generate cache key for a draft
function getCacheKey(title, content) {
    // Use title and first 100 chars of content as cache key
    return `${title}-${content.substring(0, 100).replace(/[^a-zA-Z0-9]/g, '')}`;
}

// Load or create Telegraph account
async function initializeTelegraph() {
    try {
        // Try to load existing token
        const tokenData = JSON.parse(await readFile(tokenFile, 'utf-8'));
        if (tokenData.access_token) {
            logger.info('📋 Loading existing Telegraph token...');
            
            // Create instance with existing token
            telegraphInstance = new Telegraph({
                accessToken: tokenData.access_token
            });
            
            // Verify the token works
            try {
                const account = await telegraphInstance.getAccount();
                logger.info(`✅ Telegraph account verified: ${account.short_name}`);
                return telegraphInstance;
            } catch (error) {
                logger.warn('⚠️ Telegraph token invalid, creating new account');
            }
        }
    } catch (error) {
        logger.info('📋 No Telegraph token found, creating new account');
    }

    // Create new account
    try {
        logger.info('🔧 Creating new Telegraph account...');
        
        telegraphInstance = new Telegraph({
            short_name: 'QContentBot',
            author_name: 'Q Content Generator',
            author_url: 'https://qloga.com'
        });

        // Setup the account (this will create it and set the token)
        const account = await telegraphInstance.setupAccount();
        logger.info(`📋 Account created with response:`, account);

        // Save the token
        await writeFile(tokenFile, JSON.stringify({
            access_token: account.access_token,
            short_name: account.short_name,
            created: new Date().toISOString()
        }, null, 2));

        logger.success(`📝 New Telegraph account created: ${account.short_name}`);
        return telegraphInstance;

    } catch (error) {
        logger.error(`❌ Failed to create Telegraph account: ${error.message}`);
        return null;
    }
}

export const createTelegraphAccount = async () => {
    if (!telegraphInstance) {
        telegraphInstance = await initializeTelegraph();
    }
    return telegraphInstance;
};

export const publishToTelegraph = async (title, markdownContent) => {
    try {
        if (!telegraphInstance) {
            telegraphInstance = await createTelegraphAccount();
        }

        if (!telegraphInstance) {
            logger.error('❌ Telegraph not available');
            return null;
        }

        // Load cache if not loaded
        if (Object.keys(articleCache).length === 0) {
            await loadCache();
        }

        // Check if article already exists in cache
        const cacheKey = getCacheKey(title, markdownContent);
        if (articleCache[cacheKey]) {
            logger.info(`📋 Article found in cache: ${articleCache[cacheKey]}`);
            return articleCache[cacheKey];
        }

        logger.info('🔄 Publishing to Telegraph...');

        // Convert markdown to HTML content for Telegraph using marked library
        const htmlContent = convertMarkdownToHtml(markdownContent);

        // Create page using the correct API
        const page = await telegraphInstance.create({
            title: title,
            content: htmlContent,
            author_name: 'Q Content Generator',
            return_content: false
        });

        // Cache the URL
        articleCache[cacheKey] = page.url;
        await saveCache();

        logger.success(`✅ Published to Telegraph: ${page.url}`);
        return page.url;

    } catch (error) {
        logger.error(`❌ Failed to publish to Telegraph: ${error.message}`);
        return null;
    }
};

// Convert markdown to Telegraph Node format
function convertMarkdownToHtml(markdown) {
    try {
        // Configure marked for safe HTML output
        marked.setOptions({
            breaks: true, // Convert line breaks to <br>
            gfm: true,    // GitHub Flavored Markdown
            sanitize: false // Allow HTML tags
        });

        // Convert markdown to HTML first
        let html = marked(markdown);
        
        // Clean up any potential issues
        html = html.trim();
        
        // Convert HTML to Telegraph Node format using a simpler approach
        const telegraphContent = convertHtmlToTelegraphNodesSimple(html);
        
        // Debug: log the content to see what we're sending
        logger.info('🔍 Generated Telegraph content preview:', JSON.stringify(telegraphContent.slice(0, 2)));
        
        return telegraphContent;
        
    } catch (error) {
        logger.error(`❌ Error converting markdown to Telegraph format: ${error.message}`);
        // Fallback to simple text
        return [{ tag: 'p', children: [markdown] }];
    }
}

// Simplified HTML to Telegraph Node converter
function convertHtmlToTelegraphNodesSimple(html) {
    const nodes = [];
    
    // Split by paragraphs first
    const paragraphs = html.split(/<\/?p[^>]*>/).filter(p => p.trim());
    
    for (const paragraph of paragraphs) {
        if (!paragraph.trim()) continue;
        
        // Process each paragraph
        const processedParagraph = processParagraph(paragraph.trim());
        if (processedParagraph) {
            nodes.push(processedParagraph);
        }
    }
    
    return nodes;
}

// Process a single paragraph
function processParagraph(text) {
    // Check if it's a heading
    const headingMatch = text.match(/^<h([1-6])[^>]*>(.*?)<\/h[1-6]>$/);
    if (headingMatch) {
        const level = parseInt(headingMatch[1]);
        const content = headingMatch[2].replace(/<[^>]+>/g, ''); // Remove any nested tags
        return { tag: `h${level}`, children: [content] };
    }
    
    // Check if it's a list
    if (text.includes('<ul>') || text.includes('<ol>')) {
        return processList(text);
    }
    
    // Regular paragraph - clean up HTML tags and convert to text
    let cleanText = text
        .replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**') // Convert strong to markdown
        .replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*') // Convert em to markdown
        .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)') // Convert links to markdown
        .replace(/<[^>]+>/g, ''); // Remove all other HTML tags
    
    // Convert markdown back to Telegraph format
    const processedText = processTextWithMarkdown(cleanText);
    
    return { tag: 'p', children: processedText };
}

// Process text with markdown formatting
function processTextWithMarkdown(text) {
    const parts = [];
    let currentText = '';
    let i = 0;
    
    while (i < text.length) {
        // Check for bold
        if (text.substring(i, i + 2) === '**') {
            if (currentText) {
                parts.push(currentText);
                currentText = '';
            }
            i += 2;
            let boldText = '';
            while (i < text.length && text.substring(i, i + 2) !== '**') {
                boldText += text[i];
                i++;
            }
            if (i < text.length) {
                parts.push({ tag: 'strong', children: [boldText] });
                i += 2;
            }
        }
        // Check for italic
        else if (text[i] === '*') {
            if (currentText) {
                parts.push(currentText);
                currentText = '';
            }
            i++;
            let italicText = '';
            while (i < text.length && text[i] !== '*') {
                italicText += text[i];
                i++;
            }
            if (i < text.length) {
                parts.push({ tag: 'em', children: [italicText] });
                i++;
            }
        }
        // Check for links
        else if (text[i] === '[') {
            if (currentText) {
                parts.push(currentText);
                currentText = '';
            }
            i++;
            let linkText = '';
            while (i < text.length && text[i] !== ']') {
                linkText += text[i];
                i++;
            }
            if (i < text.length && text[i + 1] === '(') {
                i += 2;
                let linkUrl = '';
                while (i < text.length && text[i] !== ')') {
                    linkUrl += text[i];
                    i++;
                }
                if (i < text.length) {
                    parts.push({ tag: 'a', attrs: { href: linkUrl }, children: [linkText] });
                    i++;
                }
            }
        }
        else {
            currentText += text[i];
            i++;
        }
    }
    
    if (currentText) {
        parts.push(currentText);
    }
    
    return parts;
}

// Process lists
function processList(html) {
    const listMatch = html.match(/<(ul|ol)[^>]*>(.*?)<\/(ul|ol)>/s);
    if (!listMatch) return null;
    
    const listType = listMatch[1];
    const listContent = listMatch[2];
    
    const items = listContent.match(/<li[^>]*>(.*?)<\/li>/gs);
    if (!items) return null;
    
    const children = items.map(item => {
        const content = item.replace(/<\/?li[^>]*>/g, '').trim();
        return { tag: 'li', children: [content] };
    });
    
    return { tag: listType, children };
}

export default telegraphInstance; 