import { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { tierLimits } from '../config.js';
import { AuthRequest } from './auth.js';

export async function checkSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await query(
      `SELECT tier, status, renewal_date FROM subscriptions 
       WHERE user_id = $1 AND status = 'active' 
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // Default to basic tier
      req.user.tier = 'basic';
      return next();
    }

    const sub = result.rows[0];
    
    // Check if subscription expired
    if (new Date(sub.renewal_date) < new Date()) {
      return res.status(403).json({ error: 'Subscription expired' });
    }

    req.user.tier = sub.tier;
    next();
  } catch (err) {
    console.error('Subscription check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function checkTierLimit(limitKey: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tier = req.user.tier || 'basic';
    const limits = tierLimits[tier as keyof typeof tierLimits];

    if (!limits) {
      return res.status(500).json({ error: 'Invalid tier' });
    }

    const limit = limits[limitKey as keyof typeof limits];
    if (!limit) {
      return next(); // Limit not applicable
    }

    // Store limit in request for controller use
    (req as any).tierLimit = limit;
    next();
  };
}
