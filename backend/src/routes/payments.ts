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

    if (interval === 'year') {
      // RECURRING SUBSCRIPTION LOGIC (Autopay)
      const planMap: any = {
        'pro': { name: 'Toeasy Pro Annual', amount: 599000 },
        'enterprise': { name: 'Toeasy Enterprise Annual', amount: 2599000 }
      };

      const targetPlanData = planMap[planId];
      let razorpayPlanId = '';

      try {
        // 1. Fetch available plans to find a match
        // Razorpay listing is paginated, fetching last 100 should cover active plans usually
        // Ideally we should cache this mapping in DB
        const plans = await razorpay.plans.all({ count: 100 });
        const existingPlan = plans.items.find((p: any) =>
          p.item.name === targetPlanData.name &&
          p.item.amount === targetPlanData.amount &&
          p.period === 'yearly'
        );

        if (existingPlan) {
          razorpayPlanId = existingPlan.id;
        } else {
          // 2. Create Plan if not found
          const newPlan = await razorpay.plans.create({
            period: 'yearly',
            interval: 1,
            item: {
              name: targetPlanData.name,
              amount: targetPlanData.amount,
              currency: 'INR', // Currently enforcing INR
              description: 'Annual Autopay Membership'
            }
          });
          razorpayPlanId = newPlan.id;
        }

        // 3. Create Subscription
        const subscription = await razorpay.subscriptions.create({
          plan_id: razorpayPlanId,
          total_count: 100, // Indefinite
          quantity: 1,
          customer_notify: 1,
          notes: { planId, interval, userId: req.user!.id }
        });

        razorpayData = {
          subscription_id: subscription.id,
          amount: amountSmallestUnit,
          currency: validCurrency.toUpperCase()
        };

      } catch (e: any) {
        console.error("Subscription setup failed, falling back to Order", e);
        // Fallback to one-time charge
        const order = await razorpay.orders.create({
          amount: amountSmallestUnit,
          currency: validCurrency.toUpperCase(),
          receipt: `receipt_${req.user!.id}_${Date.now()}`
        });
        razorpayData = { order_id: order.id, amount: order.amount, currency: order.currency };
      }
    } else {
      // ONE-TIME PASS LOGIC
      const order = await razorpay.orders.create({
        amount: amountSmallestUnit,
        currency: validCurrency.toUpperCase(),
        receipt: `receipt_${req.user!.id}_${Date.now()}`,
        notes: { planId, interval, userId: req.user!.id }
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
      name: "Toeasy Intelligence",
      description: `${planId === 'pro' ? 'Pro' : 'Enterprise'} Membership (${interval === 'year' ? 'Annual Autopay' : '1-Month Pass'})`,
      prefill: {
        name: user.full_name || 'User',
        email: user.email,
        contact: '9999999999'
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", config.razorpay.keySecret || '')
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Payment Successful

      // Get payment order details
      const paymentResult = await query(
        'SELECT user_id, plan_id FROM payment_orders WHERE cashfree_order_id = $1', // Using cashfree_order_id as generic order id storage
        [razorpay_order_id]
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
          'UPDATE payment_orders SET status = $1, updated_at = NOW() WHERE cashfree_order_id = $2',
          ['completed', razorpay_order_id]
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
      'SELECT status FROM payment_orders WHERE cashfree_order_id = $1 AND user_id = $2',
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
