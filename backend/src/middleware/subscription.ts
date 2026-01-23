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
    console.error('Subscription check error (falling back to basic):', err);
    // Fallback to basic tier instead of failing
    if (req.user) req.user.tier = 'basic';
    next();
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
    if (limit === undefined) {
      return next(); // Limit not applicable
    }

    // Explicitly check for limits that can be verified immediately
    if (limitKey === 'maxWorkspaces') {
      const result = await query('SELECT COUNT(*) as count FROM workspaces WHERE user_id = $1', [req.user.id]);
      if (parseInt(result.rows[0].count) >= limit) {
        return res.status(403).json({
          error: 'Tier limit reached',
          message: `Your current tier allows up to ${limit} workspaces. Please upgrade for more.`,
          limit
        });
      }
    }

    if (limitKey === 'maxDatasets') {
      const workspaceId = req.params.workspaceId;
      if (workspaceId) {
        const result = await query('SELECT COUNT(*) as count FROM datasets WHERE workspace_id = $1', [workspaceId]);
        if (parseInt(result.rows[0].count) >= limit) {
          return res.status(403).json({
            error: 'Tier limit reached',
            message: `This workspace allows up to ${limit} datasets on your current plan.`,
            limit
          });
        }
      }
    }

    // Store limit in request for controller use (for limits like maxRowsPerDataset)
    (req as any).tierLimit = limit;
    next();
  };
}
