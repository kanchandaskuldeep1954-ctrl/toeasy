import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { config, pricing } from '../config.js';
import crypto from 'crypto';

const router = Router();

// Create payment order with Cashfree
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
    const userResult = await query('SELECT email FROM users WHERE id = $1', [req.user!.id]);
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

    const orderId = `ORDER_${req.user!.id}_${Date.now()}`;

    // Call Cashfree API
    const cashfreeResponse = await fetch('https://api.cashfree.com/pg/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.cashfree.apiKey || '',
        'X-Request-Id': crypto.randomBytes(16).toString('hex'),
        'x-api-version': '2022-09-01'
      } as Record<string, string>,
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: 'USD',
        customer_details: {
          customer_id: `CUST_${req.user!.id}`,
          customer_email: user.email,
          customer_phone: '9999999999'
        },
        order_meta: {
          return_url: `${config.frontendUrl}/billing/success`,
          notify_url: `${config.backendUrl}/api/payments/webhook`
        }
      })
    });

    if (!cashfreeResponse.ok) {
      throw new Error('Cashfree API error');
    }

    const cashfreeData = await cashfreeResponse.json() as any;

    // Save payment order to database
    await query(
      `INSERT INTO payment_orders (user_id, plan_id, amount, currency, order_id, cashfree_order_id, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user!.id, planId, amount / 100, 'INR', orderId, (cashfreeData as any).order_id, 'pending']
    );

    res.json({
      orderId: (cashfreeData as any).order_id,
      paymentSessionId: (cashfreeData as any).payment_session_id,
      redirectUrl: (cashfreeData as any).data?.url
    });
  } catch (err) {
    console.error('Create payment order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Cashfree webhook - verify and update subscription
router.post('/webhook', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Invalid webhook data' });
    }

    // Verify signature
    const signature = req.headers['x-webhook-signature'] as string;
    if (!verifyWebhookSignature(JSON.stringify(data), signature, config.cashfree.webhookSecret || '')) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { order_id, order_status, payment_method } = data;

    if (order_status === 'PAID') {
      // Get payment order
      const paymentResult = await query(
        'SELECT user_id, plan_id FROM payment_orders WHERE order_id = $1',
        [order_id]
      );

      if (paymentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment order not found' });
      }

      const { user_id, plan_id } = paymentResult.rows[0];

      // Update subscription
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 30);

      await query(
        `UPDATE subscriptions 
         SET tier = $1, status = $2, renewal_date = $3, updated_at = NOW() 
         WHERE user_id = $4 AND status = $5`,
        [plan_id, 'active', renewalDate, user_id, 'active']
      );

      // Update payment order status
      await query(
        'UPDATE payment_orders SET status = $1, updated_at = NOW() WHERE order_id = $2',
        ['completed', order_id]
      );
    }

    res.json({ message: 'Webhook processed' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get payment status
router.get('/status/:orderId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT status, plan_id, amount FROM payment_orders WHERE order_id = $1 AND user_id = $2',
      [req.params.orderId, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment order not found' });
    }

    res.json(result.rows[0]);
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

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return computedSignature === signature;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

export default router;
