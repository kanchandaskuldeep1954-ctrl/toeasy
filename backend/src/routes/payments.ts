import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { config, pricing } from '../config.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const router = Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: config.razorpay.keyId || '',
  key_secret: config.razorpay.keySecret || '',
});

// Create payment order
router.post('/create-order', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { planId, interval, currency = 'usd' } = req.body;

    if (!planId || !['pro', 'enterprise'].includes(planId)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    if (!interval || !['month', 'year'].includes(interval)) {
      return res.status(400).json({ error: 'Invalid billing interval' });
    }

    const validCurrency = currency.toLowerCase() === 'inr' ? 'inr' : 'usd';

    // Get user
    const userResult = await query('SELECT email, full_name FROM users WHERE id = $1', [req.user!.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Calculate amount based on plan, interval and currency
    let amount = 0;
    // @ts-ignore
    const planPricing = pricing[planId][validCurrency];
    amount = interval === 'month' ? planPricing.monthly : planPricing.yearly;

    // Razorpay amount is in smallest currency unit
    const amountSmallestUnit = Math.round(amount * 100);

    let razorpayData: any = {};

    // UNIFIED SUBSCRIPTION LOGIC (Monthly & Yearly are both Autopay now)
    // We treat both intervals as subscriptions.

    // UNIFIED SUBSCRIPTION LOGIC (Monthly & Yearly are both Autopay now)
    const planConfig: any = {
      'pro': {
        'month': {
          name: 'Toeasy Pro Monthly',
          amount: validCurrency === 'inr' ? pricing.pro.inr.monthly * 100 : pricing.pro.usd.monthly * 100,
          period: 'monthly'
        },
        'year': {
          name: 'Toeasy Pro Annual',
          amount: validCurrency === 'inr' ? pricing.pro.inr.yearly * 100 : pricing.pro.usd.yearly * 100,
          period: 'yearly'
        }
      },
      'enterprise': {
        'month': {
          name: 'Toeasy Enterprise Monthly',
          amount: validCurrency === 'inr' ? pricing.enterprise.inr.monthly * 100 : pricing.enterprise.usd.monthly * 100,
          period: 'monthly'
        },
        'year': {
          name: 'Toeasy Enterprise Annual',
          amount: validCurrency === 'inr' ? pricing.enterprise.inr.yearly * 100 : pricing.enterprise.usd.yearly * 100,
          period: 'yearly'
        }
      }
    };

    const targetPlanData = planConfig[planId]?.[interval];

    if (targetPlanData) {
      let razorpayPlanId = '';

      try {
        // 1. Fetch available plans to find a match
        const plans = await razorpay.plans.all({ count: 100 });
        const existingPlan = plans.items.find((p: any) =>
          p.item.name === targetPlanData.name &&
          p.item.amount === targetPlanData.amount &&
          p.period === targetPlanData.period
        );

        if (existingPlan) {
          razorpayPlanId = existingPlan.id;
        } else {
          // 2. Create Plan if not found
          console.log(`Creating missing plan: ${targetPlanData.name}`);
          const newPlan = await razorpay.plans.create({
            period: targetPlanData.period,
            interval: 1,
            item: {
              name: targetPlanData.name,
              amount: targetPlanData.amount,
              currency: 'INR', // Enforcing INR for consistency
              description: `${targetPlanData.period === 'monthly' ? 'Monthly' : 'Annual'} Autopay Membership`
            }
          });
          razorpayPlanId = newPlan.id;
        }

        // 3. Create Subscription
        const subscription = await razorpay.subscriptions.create({
          plan_id: razorpayPlanId,
          total_count: 100, // Indefinite recurrence (100 cycles)
          quantity: 1,
          customer_notify: 1,
          notes: { planId, interval, userId: req.user!.id }
        });

        razorpayData = {
          subscription_id: subscription.id,
          amount: targetPlanData.amount, // Use plan amount
          currency: validCurrency.toUpperCase()
        };

      } catch (e: any) {
        console.error("Subscription setup failed, falling back to One-time Order", e);
        // Fallback to one-time charge if subscription fails (e.g. gateway issues)
        const order = await razorpay.orders.create({
          amount: amountSmallestUnit,
          currency: validCurrency.toUpperCase(),
          receipt: `receipt_${req.user!.id}_${Date.now()}`,
          notes: { planId, interval, userId: req.user!.id }
        });
        razorpayData = { order_id: order.id, amount: order.amount, currency: order.currency };
      }
    } else {
      // Fallback for unknown plan/interval combination (should ideally not be hit with proper validation)
      console.warn(`Unknown planId/interval combination: ${planId}/${interval}. Falling back to one-time order.`);
      const order = await razorpay.orders.create({
        amount: amountSmallestUnit,
        currency: validCurrency.toUpperCase(),
        receipt: `receipt_${req.user!.id}_${Date.now()}`
      });
      razorpayData = { order_id: order.id, amount: order.amount, currency: order.currency };
    }

    // Save payment intent to database
    await query(
      `INSERT INTO payment_orders (user_id, plan_id, amount, currency, order_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user!.id, planId, amount, validCurrency.toUpperCase(), razorpayData.order_id || razorpayData.subscription_id, 'pending']
    );

    res.json({
      key: config.razorpay.keyId,
      ...razorpayData,
      name: "Toeasy",
      description: `${planId === 'pro' ? 'Pro' : 'Enterprise'} Membership (${interval}ly autopay)`,
      prefill: {
        name: user.full_name || 'User',
        email: user.email,
        contact: ''
      }
    });

  } catch (err) {
    console.error('Create payment order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Verify Payment
router.post('/verify', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { razorpay_order_id, razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing payment_id or signature' });
    }

    if (!razorpay_order_id && !razorpay_subscription_id) {
      return res.status(400).json({ success: false, error: 'Missing order_id or subscription_id' });
    }

    const secret = config.razorpay.keySecret || '';
    const candidates = [
      razorpay_order_id ? `${razorpay_order_id}|${razorpay_payment_id}` : null,
      razorpay_subscription_id ? `${razorpay_subscription_id}|${razorpay_payment_id}` : null,
    ].filter(Boolean) as string[];

    const isAuthentic = candidates.some((body) => {
      const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return expectedSignature === razorpay_signature;
    });

    if (isAuthentic) {
      // Payment Successful

      // Get payment order details
      const paymentResult = await query(
        // Backward compatible lookup (we historically used cashfree_order_id in some places)
        'SELECT user_id, plan_id FROM payment_orders WHERE order_id = $1 OR cashfree_order_id = $1',
        [razorpay_order_id || razorpay_subscription_id]
      );

      if (paymentResult.rows.length > 0) {
        const { user_id, plan_id } = paymentResult.rows[0];

        // Update subscription
        const renewalDate = new Date();
        renewalDate.setDate(renewalDate.getDate() + 30); // Or based on interval

        await query(
          `UPDATE subscriptions 
            SET tier = $1, status = $2, renewal_date = $3, updated_at = NOW() 
            WHERE user_id = $4 AND status = $5`,
          [plan_id, 'active', renewalDate, user_id, 'active']
        );

        // Update payment order status
        await query(
          'UPDATE payment_orders SET status = $1, updated_at = NOW() WHERE order_id = $2 OR cashfree_order_id = $2',
          ['completed', razorpay_order_id || razorpay_subscription_id]
        );
      }

      res.json({ success: true, message: 'Payment verified successfully' });
    } else {
      res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Get payment status
router.get('/status/:orderId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { orderId } = req.params;
    const result = await query(
      'SELECT status FROM payment_orders WHERE (order_id = $1 OR cashfree_order_id = $1) AND user_id = $2',
      [orderId, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ status: result.rows[0].status });
  } catch (err) {
    console.error('Get payment status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List user payment history
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, plan_id, amount, status, created_at 
       FROM payment_orders 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [req.user!.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get payment history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
