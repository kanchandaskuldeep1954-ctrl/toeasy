import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger.js';

/**
 * Middleware to validate request body/params/query against a Zod schema
 */
export const validateResource = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (e: any) {
        if (e instanceof ZodError) {
            // Cast to any to avoid "Property 'errors' does not exist on type 'ZodError<unknown>'"
            const zodError = e as any;
            logger.warn(`Validation error on ${req.method} ${req.url}`, { errors: zodError.errors });
            return res.status(400).json({
                error: 'Validation failed',
                details: zodError.errors.map((err: any) => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        next(e);
    }
};
