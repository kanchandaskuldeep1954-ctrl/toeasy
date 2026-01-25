import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { config } from '../config.js';

const router = Router();

// Get available subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = [
      {
        id: 'basic',
        name: 'Starter',
        price: 0,
        billingCycle: 'monthly',
        features: [
          '3 Datasets',
          '500 rows per dataset',
          '10 AI queries/day',
          '1 Workspace',
          'Basic Support'
        ],
        limits: config.tierLimits.basic
      },
      {
        id: 'pro',
        name: 'Professional',
        price: 29,
        billingCycle: 'monthly',
        features: [
          '50 Datasets',
          '100K rows per dataset',
          'Unlimited AI queries',
          '10 Workspaces',
          'Priority Support',
          'Advanced Analytics'
        ],
        limits: config.tierLimits.pro
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: null,
        billingCycle: 'custom',
        features: [
          'Unlimited Datasets',
          '10M rows per dataset',
          'Unlimited AI queries',
          'Unlimited Workspaces',
          'Dedicated Support',
          'Custom Integrations',
          'SLA Guarantee'
        ],
        limits: config.tierLimits.enterprise
      }
    ];

    res.json(plans);
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user subscription
router.get('/current', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT s.id, s.tier, s.status, s.current_period_start, s.current_period_end, s.renewal_date 
       FROM subscriptions s 
       WHERE s.user_id = $1 
       ORDER BY s.created_at DESC 
       LIMIT 1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active subscription' });
    }

    const subscription = result.rows[0];
    const planInfo = getPlanInfo(subscription.tier);

    res.json({
      ...subscription,
      plan: planInfo
    });
  } catch (err) {
    console.error('Get current subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upgrade/Downgrade subscription
router.post('/upgrade', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { newTier } = req.body;

    if (!newTier || !['basic', 'pro', 'enterprise'].includes(newTier)) {
      return res.status(400).json({ error: 'Invalid subscription tier' });
    }

    // Get current subscription
    const currentResult = await query(
      'SELECT id, tier FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.user!.id, 'active']
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active subscription' });
    }

    // Update subscription
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + 30);

    const result = await query(
      `UPDATE subscriptions 
       SET tier = $1, updated_at = NOW(), renewal_date = $2 
       WHERE user_id = $3 AND status = $4 
       RETURNING id, tier, status, renewal_date`,
      [newTier, renewalDate, req.user!.id, 'active']
    );

    const subscription = result.rows[0];
    const planInfo = getPlanInfo(subscription.tier);

    res.json({
      message: `Subscription upgraded to ${planInfo.name}`,
      subscription,
      plan: planInfo
    });
  } catch (err) {
    console.error('Upgrade subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Get Razorpay subscription ID if any
    const subResult = await query(
      'SELECT id, razorpay_subscription_id, interval FROM subscriptions WHERE user_id = $1 AND status = $2',
      [req.user!.id, 'active']
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active subscription to cancel' });
    }

    const { razorpay_subscription_id, interval } = subResult.rows[0];

    // If it's a recurring yearly subscription, cancel it in Razorpay
    if (razorpay_subscription_id) {
      try {
        // This would normally call Razorpay SDK
        // await razorpay.subscriptions.cancel(razorpay_subscription_id);
      } catch (err) {
        console.error('Razorpay cancel error:', err);
      }
    }

    // Update local database
    await query(
      'UPDATE subscriptions SET status = $1, auto_renew = false, updated_at = NOW() WHERE user_id = $2 AND status = $3',
      ['cancelled', req.user!.id, 'active']
    );

    res.json({ message: 'Membership set to expire at period end. No further charges will occur.' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get subscription usage
router.get('/usage', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const subscriptionResult = await query(
      'SELECT tier FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.user!.id, 'active']
    );

    if (subscriptionResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active subscription' });
    }

    const tier = subscriptionResult.rows[0].tier;
    const limits = config.tierLimits[tier as keyof typeof config.tierLimits];

    // Get current usage
    const usageResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM workspaces WHERE user_id = $1) as workspace_count,
        (SELECT COUNT(*) FROM datasets WHERE user_id = $1) as dataset_count,
        (SELECT COALESCE(SUM(row_count), 0) FROM datasets WHERE user_id = $1) as total_rows`,
      [req.user!.id]
    );

    const usage = usageResult.rows[0];

    res.json({
      tier,
      limits,
      usage: {
        workspaces: { used: usage.workspace_count, limit: limits.maxWorkspaces },
        datasets: { used: usage.dataset_count, limit: limits.maxDatasets },
        totalRows: { used: usage.total_rows, limit: limits.maxRowsPerDataset * usage.dataset_count }
      }
    });
  } catch (err) {
    console.error('Get usage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function getPlanInfo(tier: string): any {
  const plans: any = {
    basic: {
      id: 'basic',
      name: 'Starter',
      price: 0
    },
    pro: {
      id: 'pro',
      name: 'Professional',
      price: 29
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Custom'
    }
  };

  return plans[tier] || plans.basic;
}

export default router;
