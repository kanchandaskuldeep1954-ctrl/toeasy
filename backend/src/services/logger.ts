/**
 * Simple logger utility
 * Provides basic logging with levels: info, debug, error, warn
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = levels[LOG_LEVEL as keyof typeof levels] || levels.info;

function formatLog(level: string, message: string, data?: any): string {
  const timestamp = new Date().toISOString();
  if (data) {
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(data)}`;
  }
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  debug: (message: string, data?: any) => {
    if (levels.debug >= currentLevel) {
      console.log(formatLog('debug', message, data));
    }
  },

  info: (message: string, data?: any) => {
    if (levels.info >= currentLevel) {
      console.log(formatLog('info', message, data));
    }
  },

  warn: (message: string, data?: any) => {
    if (levels.warn >= currentLevel) {
      console.warn(formatLog('warn', message, data));
    }
  },

  error: (message: string, data?: any) => {
    if (levels.error >= currentLevel) {
      console.error(formatLog('error', message, data));
    }
  },
};

export default logger;
