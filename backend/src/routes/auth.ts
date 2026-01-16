import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const result = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email',
      [email, hashedPassword, name || email]
    );

    const user = result.rows[0];

    // Create default workspace
    await query(
      'INSERT INTO workspaces (user_id, name) VALUES ($1, $2)',
      [user.id, 'My First Workspace']
    );

    // Create default subscription (basic tier)
    const periodEnd = new Date(Date.now() + 30*24*60*60*1000);
    await query(
      `INSERT INTO subscriptions (user_id, tier, status, current_period_start, current_period_end, renewal_date) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, 'basic', 'active', new Date(), periodEnd, periodEnd]
    );

    const token = generateToken(String(user.id), user.email, 'basic');
    const refreshToken = generateRefreshToken(String(user.id));

    res.status(201).json({
      accessToken: token,
      refreshToken: refreshToken,
      user: { id: user.id, email: user.email, tier: 'basic' },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user
    const userResult = await query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get current subscription
    const subResult = await query(
      `SELECT tier FROM subscriptions 
       WHERE user_id = $1 AND status = 'active' 
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    const tier = subResult.rows[0]?.tier || 'basic';
    const token = generateToken(String(user.id), user.email, tier);
    const refreshToken = generateRefreshToken(String(user.id));

    res.json({
      accessToken: token,
      refreshToken: refreshToken,
      user: { id: user.id, email: user.email, tier },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
