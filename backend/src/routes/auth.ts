import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';
import { otpService } from '../services/otpService.js';
import { validateResource } from '../middleware/validateResource.js';
import { loginSchema, registerSchema } from '../schemas/validation.js';

const router = Router();

router.post('/register', validateResource(registerSchema), async (req, res) => {
  try {
    const { email, password, full_name, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists
    const existingUser = await query('SELECT id, email, is_verified FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      if (user.is_verified) {
        return res.status(409).json({ error: 'User already exists and is verified' });
      } else {
        // User exists but not verified - allow resending OTP by continuing
        // We will update their info below
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = otpService.generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    let userId;
    if (existingUser.rows.length > 0) {
      // Update existing unverified user
      const result = await query(
        'UPDATE users SET password_hash = $1, full_name = $2, otp = $3, otp_expiry = $4 WHERE email = $5 RETURNING id',
        [hashedPassword, full_name || name || email, otp, otpExpiry, email]
      );
      userId = result.rows[0].id;
    } else {
      // Create new user
      const result = await query(
        'INSERT INTO users (email, password_hash, full_name, otp, otp_expiry) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [email, hashedPassword, full_name || name || email, otp, otpExpiry]
      );
      userId = result.rows[0].id;
    }

    // Send OTP
    await otpService.sendOTP(email, otp);

    res.status(200).json({
      message: 'OTP sent to your email. Please verify to complete registration.',
      email
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP required' });
    }

    const result = await query(
      'SELECT id, email, otp, otp_expiry FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (user.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (new Date(user.otp_expiry) < new Date()) {
      return res.status(400).json({ error: 'OTP expired. Please resend.' });
    }

    // Verify user and clear OTP
    await query(
      'UPDATE users SET is_verified = true, otp = NULL, otp_expiry = NULL WHERE id = $1',
      [user.id]
    );

    // Initial check for subscription
    const subCheck = await query('SELECT id FROM subscriptions WHERE user_id = $1', [user.id]);

    if (subCheck.rows.length === 0) {
      // Create default workspace
      await query(
        'INSERT INTO workspaces (user_id, name) VALUES ($1, $2)',
        [user.id, 'My First Workspace']
      );

      // Create default subscription (basic tier)
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await query(
        `INSERT INTO subscriptions (user_id, tier, status, current_period_start, current_period_end, renewal_date) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, 'basic', 'active', new Date(), periodEnd, periodEnd]
      );
    }

    const token = generateToken(String(user.id), user.email, 'basic');
    const refreshToken = generateRefreshToken(String(user.id));

    res.status(200).json({
      accessToken: token,
      refreshToken: refreshToken,
      user: { id: user.id, email: user.email, tier: 'basic' },
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const otp = otpService.generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const result = await query(
      'UPDATE users SET otp = $1, otp_expiry = $2 WHERE email = $3 AND is_verified = false RETURNING id',
      [otp, otpExpiry, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unverified user not found' });
    }

    await otpService.sendOTP(email, otp);
    res.json({ message: 'OTP resent successfully' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', validateResource(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user
    const userResult = await query(
      'SELECT id, email, password_hash, is_verified FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Account not verified. Please verify your email.', unverified: true });
    }

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
