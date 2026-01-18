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
    const { planId, interval } = req.body;

    if (!planId || !['pro', 'enterprise'].includes(planId)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    if (!interval || !['month', 'year'].includes(interval)) {
      return res.status(400).json({ error: 'Invalid billing interval' });
    }

    // Get user
    const userResult = await query('SELECT email, full_name FROM users WHERE id = $1', [req.user!.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Calculate amount based on plan and interval
    let amount = 0;
    if (planId === 'pro') {
      amount = interval === 'month' ? pricing.pro.monthly : pricing.pro.yearly;
    } else if (planId === 'enterprise') {
      amount = interval === 'month' ? pricing.enterprise.monthly : pricing.enterprise.yearly;
    }

    // Razorpay amount is in paise (smallest currency unit), but for USD it is cents
    // Razorpay supports international currency. Amount must be in smallest unit of currency.
    // For USD, it is cents. 29.00 USD -> 2900 cents.
    const amountSmallestUnit = Math.round(amount * 100);

    const options = {
      amount: amountSmallestUnit,
      currency: "USD",
      receipt: `receipt_${req.user!.id}_${Date.now()}`,
      notes: {
        planId,
        interval,
        userId: req.user!.id
      }
    };

    const order = await razorpay.orders.create(options);

    // Save payment order to database
    // Mapping Razorpay order_id to cashfree_order_id column to avoid schema change for now
    await query(
      `INSERT INTO payment_orders (user_id, plan_id, amount, currency, order_id, cashfree_order_id, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user!.id, planId, amount, 'USD', order.id, order.id, 'pending']
    );

    res.json({
      key: config.razorpay.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "Toeasy.AI",
      description: `${planId === 'pro' ? 'Pro' : 'Enterprise'} Plan (${interval})`,
      order_id: order.id,
      prefill: {
        name: user.full_name || 'User',
        email: user.email,
        contact: '9999999999' // Placeholder or fetch from user profile if available
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

// Get payment status (Keeping compatibility for now or removing if unused)
// ... keeping simple status check if handy ...

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
