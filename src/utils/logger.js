/**
 * Simple logger utility
 */

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

function formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const coloredLevel = `${colors[getColor(level)]}${level.toUpperCase()}${colors.reset}`;
    return `${colors.gray}${timestamp}${colors.reset} ${coloredLevel} ${message}`;
}

function getColor(level) {
    switch (level) {
        case 'error': return 'red';
        case 'warn': return 'yellow';
        case 'info': return 'blue';
        case 'success': return 'green';
        case 'debug': return 'magenta';
        default: return 'reset';
    }
}

export const logger = {
    error: (message, ...args) => {
        console.error(formatMessage('error', message), ...args);
    },
    
    warn: (message, ...args) => {
        console.warn(formatMessage('warn', message), ...args);
    },
    
    info: (message, ...args) => {
        console.log(formatMessage('info', message), ...args);
    },
    
    success: (message, ...args) => {
        console.log(formatMessage('success', message), ...args);
    },
    
    debug: (message, ...args) => {
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
            console.log(formatMessage('debug', message), ...args);
        }
    }
}; 