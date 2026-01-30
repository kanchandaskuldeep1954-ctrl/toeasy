import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Request Logging Middleware
 * Logs incoming requests and their duration/status.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const { method, url, ip } = req;

    // Log request start
    // logger.info(`Incoming ${method} ${url}`, { ip });

    res.on('finish', () => {
        const duration = Date.now() - start;
        const { statusCode } = res;
        const logLevel = statusCode >= 400 ? 'warn' : 'info';

        logger.log({
            level: logLevel,
            message: `${method} ${url} ${statusCode} ${duration}ms`,
            method,
            url,
            statusCode,
            duration,
            ip
        });
    });

    next();
};
