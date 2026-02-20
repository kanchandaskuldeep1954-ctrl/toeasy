import { Router, Response } from 'express';
import { query } from '../db.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

type BillingTierId = 'solo_analyst' | 'decision_room_pilot' | 'decision_room_annual';
type BillingCycle = 'monthly' | 'annual' | 'pilot_90d';

interface PlanTier {
  id: BillingTierId;
  name: string;
  monthlyUsd: number | null;
  annualUsd: number | null;
  limits: Record<string, any>;
}

const BILLING_PLANS: PlanTier[] = [
  {
    id: 'solo_analyst',
    name: 'Solo Analyst',
    monthlyUsd: 49,
    annualUsd: 468,
    limits: {
      maxWorkspaces: 1,
      maxConnectors: 2,
      scheduledRunsPerWeek: 25,
      seatsIncluded: 1
    }
  },
  {
    id: 'decision_room_pilot',
    name: 'Decision Room Pilot (90 days)',
    monthlyUsd: 2000,
    annualUsd: null,
    limits: {
      maxConnectors: 3,
      scheduledRunsPerWeek: 200,
      seatsIncluded: 8,
      includesSuccessReview: true
    }
  },
  {
    id: 'decision_room_annual',
    name: 'Decision Room Annual',
    monthlyUsd: null,
    annualUsd: 15000,
    limits: {
      maxConnectors: 3,
      scheduledRunsPerWeek: 300,
      seatsIncluded: 12,
      includesPrioritySupport: true
    }
  }
];

async function ensureWorkspaceAccess(workspaceId: number, userId: number) {
  const result = await query(
    `
    SELECT w.id
    FROM workspaces w
    LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
    WHERE w.id = $1
      AND (w.user_id = $2 OR wm.user_id = $2)
    LIMIT 1
    `,
    [workspaceId, userId]
  );
  return result.rows.length > 0;
}

router.get('/plans', async (_req, res: Response) => {
  return res.json({
    plans: BILLING_PLANS,
    defaults: {
      individualEntryUsdMonthly: 49,
      pilotUsdMonthly: 2000,
      annualUsd: 15000
    }
  });
});

router.get('/subscription', async (req: AuthRequest, res: Response) => {
  try {
    const workspaceIdRaw = req.query?.workspaceId;
    const workspaceId = workspaceIdRaw == null || workspaceIdRaw === ''
      ? null
      : Number(workspaceIdRaw);

    if (workspaceId !== null) {
      if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
        return res.status(400).json({ error: 'workspaceId must be a positive number.' });
      }
      const hasAccess = await ensureWorkspaceAccess(workspaceId, Number(req.user!.id));
      if (!hasAccess) {
        return res.status(403).json({ error: 'Workspace access denied' });
      }
    }

    const subscriptionResult = await query(
      `
      SELECT id, tier, status, current_period_start, current_period_end, renewal_date
      FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [req.user!.id]
    );

    const workspaceSeatCount = workspaceId
      ? await query(
        `
        SELECT (1 + COUNT(*))::int AS seats
        FROM workspace_members
        WHERE workspace_id = $1
        `,
        [workspaceId]
      )
      : { rows: [{ seats: 1 }] };

    const seats = Number(workspaceSeatCount.rows[0]?.seats || 1);
    const subscription = subscriptionResult.rows[0] || null;
    const mappedTier: BillingTierId = subscription?.tier === 'enterprise'
      ? 'decision_room_annual'
      : subscription?.tier === 'pro'
        ? 'solo_analyst'
        : 'solo_analyst';

    return res.json({
      workspaceId,
      tier: mappedTier,
      status: subscription?.status || 'inactive',
      seats,
      renewalAt: subscription?.renewal_date || null,
      currentPeriodStart: subscription?.current_period_start || null,
      currentPeriodEnd: subscription?.current_period_end || null,
      sourceTier: subscription?.tier || 'basic'
    });
  } catch (err) {
    console.error('Get billing subscription failed:', err);
    return res.status(500).json({ error: 'Failed to load billing subscription' });
  }
});

router.post('/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const tier = String(req.body?.tier || '').trim() as BillingTierId;
    const billingCycle = String(req.body?.billingCycle || '').trim() as BillingCycle;
    const currency = String(req.body?.currency || 'USD').toUpperCase();
    const seatsRaw = Number(req.body?.seats || 1);
    const seats = Number.isFinite(seatsRaw) && seatsRaw > 0 ? Math.min(200, Math.floor(seatsRaw)) : 1;
    const workspaceIdRaw = req.body?.workspaceId;
    const workspaceId = workspaceIdRaw == null || workspaceIdRaw === '' ? null : Number(workspaceIdRaw);

    if (!['solo_analyst', 'decision_room_pilot', 'decision_room_annual'].includes(tier)) {
      return res.status(400).json({ error: 'tier must be solo_analyst, decision_room_pilot, or decision_room_annual.' });
    }
    if (!['monthly', 'annual', 'pilot_90d'].includes(billingCycle)) {
      return res.status(400).json({ error: 'billingCycle must be monthly, annual, or pilot_90d.' });
    }
    if (!['USD', 'INR'].includes(currency)) {
      return res.status(400).json({ error: 'Only USD and INR are supported in checkout.' });
    }
    if (workspaceId !== null) {
      if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
        return res.status(400).json({ error: 'workspaceId must be a positive number.' });
      }
      const hasAccess = await ensureWorkspaceAccess(workspaceId, Number(req.user!.id));
      if (!hasAccess) {
        return res.status(403).json({ error: 'Workspace access denied' });
      }
    }

    const plan = BILLING_PLANS.find((entry) => entry.id === tier);
    if (!plan) {
      return res.status(400).json({ error: 'Unknown billing tier.' });
    }

    let amountUsd = 0;
    if (tier === 'solo_analyst') {
      amountUsd = billingCycle === 'annual' ? (plan.annualUsd || 0) : (plan.monthlyUsd || 0);
      amountUsd *= seats;
    } else if (tier === 'decision_room_pilot') {
      amountUsd = plan.monthlyUsd || 0;
    } else {
      amountUsd = plan.annualUsd || 0;
    }

    if (amountUsd <= 0) {
      return res.status(400).json({ error: 'Unable to compute checkout amount for selected tier/cycle.' });
    }

    const orderId = `pmf_checkout_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await query(
      `
      INSERT INTO payment_orders (user_id, plan_id, amount, currency, order_id, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,'pending',NOW(),NOW())
      `,
      [req.user!.id, tier, amountUsd, currency, orderId]
    );

    return res.status(201).json({
      checkoutId: orderId,
      workspaceId,
      tier,
      billingCycle,
      seats,
      amount: amountUsd,
      currency,
      status: 'pending',
      nextAction: tier === 'solo_analyst' ? 'complete_payment' : 'contact_sales',
      message: tier === 'solo_analyst'
        ? 'Checkout created. Complete payment to activate subscription.'
        : 'Pilot/annual checkout intent created. Sales or success team will follow up for contract and activation.'
    });
  } catch (err) {
    console.error('Create billing checkout failed:', err);
    return res.status(500).json({ error: 'Failed to create billing checkout' });
  }
});

export default router;
