import { Request, Response, NextFunction } from 'express';
import { getCached, setCached } from '../services/cacheService.js';
import { logger } from '../services/logger.js';

/**
 * Cache middleware for GET requests
 * Caches successful responses with configurable TTL
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string; // Optional prefix for cache key
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, prefix?: string): string {
  const base = `${req.method}:${req.originalUrl || req.url}`;
  const userId = (req as any).user?.id || 'anonymous';
  return prefix ? `${prefix}:${userId}:${base}` : `cache:${userId}:${base}`;
}

/**
 * Cache middleware
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const ttl = options.ttl || 300; // 5 minutes default

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = generateCacheKey(req, options.keyPrefix);

    try {
      // Try to get from cache
      const cachedData = await getCached(cacheKey);
      if (cachedData) {
        res.set('X-Cache', 'HIT');
        return res.json(cachedData);
      }

      // Intercept res.json to cache successful responses
      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        // Only cache 2xx responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setCached(cacheKey, data, ttl).catch((err) => {
            logger.error('Error setting cache:', err);
          });

          res.set('X-Cache', 'MISS');
        }

        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 * Clears related cache entries on mutation operations
 */
export function invalidateCacheMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only intercept mutation requests
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return next();
    }

    // Store original send to intercept response
    const originalSend = res.send.bind(res);
    res.send = function (data: any) {
      // On success, invalidate related caches
      if (res.statusCode >= 200 && res.statusCode < 300) {
        invalidateRelatedCaches(req, userId).catch((err) => {
          logger.error('Error invalidating cache:', err);
        });
      }

      return originalSend(data);
    };

    next();
  };
}

/**
 * Invalidate caches based on the request
 */
async function invalidateRelatedCaches(
  req: Request,
  userId: string
): Promise<void> {
  const { path, body } = req;
  const { deleteCachedPattern } = await import('../services/cacheService.js');

  // Invalidate based on route
  if (path.includes('/datasets')) {
    await deleteCachedPattern(`cache:${userId}:GET:*datasets*`);
  }

  if (path.includes('/queries')) {
    await deleteCachedPattern(`cache:${userId}:GET:*queries*`);
  }

  if (path.includes('/validation')) {
    await deleteCachedPattern(`cache:${userId}:GET:*validation*`);
  }

  if (path.includes('/dashboards')) {
    await deleteCachedPattern(`cache:${userId}:GET:*dashboards*`);
  }

  logger.debug(`Cache invalidated for ${path}`);
}

/**
 * Query caching middleware with smart invalidation
 */
export function queryResultCacheMiddleware(ttl: number = 600) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'POST' || !req.path.includes('/execute')) {
      return next();
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return next();
    }

    // Generate cache key from query content
    const queryHash = generateQueryHash((req.body as any).query || '');
    const { generateQueryCacheKey, getCached, setCached } = await import(
      '../services/cacheService.js'
    );

    const cacheKey = generateQueryCacheKey(userId, queryHash);

    try {
      const cachedResult = await getCached(cacheKey);
      if (cachedResult) {
        res.set('X-Cache', 'HIT');
        return res.json(cachedResult);
      }

      // Intercept response
      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        if (res.statusCode === 200) {
          setCached(cacheKey, data, ttl).catch((err) => {
            logger.error('Error caching query result:', err);
          });
          res.set('X-Cache', 'MISS');
        }

        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Query cache middleware error:', error);
      next();
    }
  };
}

/**
 * Generate hash from query string for caching
 */
function generateQueryHash(query: string): string {
  // Simple hash implementation - in production use crypto
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

export default {
  cacheMiddleware,
  invalidateCacheMiddleware,
  queryResultCacheMiddleware,
};
