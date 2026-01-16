import { createClient, RedisClientType } from 'redis';
import { logger } from './logger.js';

/**
 * Redis Cache Service
 * Handles query result caching with automatic invalidation
 */

let redisClient: RedisClientType | null = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
export async function initializeRedis(redisUrl?: string): Promise<void> {
  if (!redisUrl) {
    logger.info('Redis URL not configured, caching disabled');
    return;
  }

  try {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => logger.error('Redis error:', err));
    await redisClient.connect();

    isConnected = true;
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    isConnected = false;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient && isConnected) {
    try {
      await redisClient.quit();
      isConnected = false;
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis:', error);
    }
  }
}

/**
 * Get cached value
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (!isConnected || !redisClient) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    if (value) {
      logger.debug(`Cache hit: ${key}`);
      return JSON.parse(value) as T;
    }
    return null;
  } catch (error) {
    logger.error(`Cache get error for ${key}:`, error);
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number = 300 // 5 minutes default
): Promise<void> {
  if (!isConnected || !redisClient) {
    return;
  }

  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    logger.debug(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
  } catch (error) {
    logger.error(`Cache set error for ${key}:`, error);
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key: string): Promise<void> {
  if (!isConnected || !redisClient) {
    return;
  }

  try {
    await redisClient.del(key);
    logger.debug(`Cache deleted: ${key}`);
  } catch (error) {
    logger.error(`Cache delete error for ${key}:`, error);
  }
}

/**
 * Delete cached values matching pattern
 */
export async function deleteCachedPattern(pattern: string): Promise<void> {
  if (!isConnected || !redisClient) {
    return;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.debug(`Cache deleted pattern: ${pattern} (${keys.length} keys)`);
    }
  } catch (error) {
    logger.error(`Cache delete pattern error for ${pattern}:`, error);
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  if (!isConnected || !redisClient) {
    return;
  }

  try {
    await redisClient.flushDb();
    logger.info('All cache cleared');
  } catch (error) {
    logger.error('Cache clear error:', error);
  }
}

/**
 * Generate cache key for queries
 */
export function generateQueryCacheKey(userId: string, queryHash: string): string {
  return `query:${userId}:${queryHash}`;
}

/**
 * Generate cache key for datasets
 */
export function generateDatasetCacheKey(userId: string, datasetId: string): string {
  return `dataset:${userId}:${datasetId}`;
}

/**
 * Generate cache key for validation results
 */
export function generateValidationCacheKey(
  userId: string,
  datasetId: string,
  ruleId: string
): string {
  return `validation:${userId}:${datasetId}:${ruleId}`;
}

/**
 * Get cache stats
 */
export async function getCacheStats(): Promise<{
  isConnected: boolean;
  totalKeys: number;
  memoryUsage: string;
}> {
  if (!isConnected || !redisClient) {
    return { isConnected: false, totalKeys: 0, memoryUsage: '0B' };
  }

  try {
    const keys = await redisClient.keys('*');
    const info = await redisClient.info('memory');
    const memoryMatch = info.match(/used_memory_human:(.+?)\r/);
    const memoryUsage = memoryMatch ? memoryMatch[1] : '0B';

    return {
      isConnected: true,
      totalKeys: keys.length,
      memoryUsage,
    };
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    return { isConnected: false, totalKeys: 0, memoryUsage: '0B' };
  }
}

export default {
  initializeRedis,
  closeRedis,
  getCached,
  setCached,
  deleteCached,
  deleteCachedPattern,
  clearAllCache,
  generateQueryCacheKey,
  generateDatasetCacheKey,
  generateValidationCacheKey,
  getCacheStats,
};
