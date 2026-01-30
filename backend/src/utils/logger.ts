/**
 * Structured Logger for Enterprise Observability
 * Uses Winston for robust, level-based, and transport-agnostic logging.
 */
import winston from 'winston';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom format for local development
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp(),
        json() // Production: JSON format for easy parsing by Datadog/Splunk/CloudWatch
    ),
    transports: [
        new winston.transports.Console({
            format: combine(
                colorize(),
                timestamp(),
                logFormat // Development: Readable format
            )
        })
    ],
});

// Create a stream for Morgan or other middleware
export const stream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};
