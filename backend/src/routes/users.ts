import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { config } from '../config.js';
import bcryptjs from 'bcryptjs';

const router = Router();

// Get current user profile
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.full_name, u.avatar_url, u.created_at, s.tier 
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
       WHERE u.id = $1
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = result.rows[0];
    userData.tier = userData.tier || 'basic';

    res.json(userData);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { full_name, name, avatarUrl } = req.body;

    const result = await query(
      'UPDATE users SET full_name = COALESCE($1, full_name), avatar_url = COALESCE($2, avatar_url), updated_at = NOW() WHERE id = $3 RETURNING id, email, full_name, avatar_url',
      [full_name || name || null, avatarUrl || null, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Get user
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify current password
    const isPasswordCorrect = await bcryptjs.compare(currentPassword, user.password_hash);

    if (!isPasswordCorrect) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = await bcryptjs.hash(newPassword, 12);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedNewPassword, req.user!.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get usage statistics
router.get('/me/usage', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Get subscription tier
    const subResult = await query(
      'SELECT tier FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.user!.id, 'active']
    );

    const tier = subResult.rows.length > 0 ? subResult.rows[0].tier : 'basic';

    // Get usage stats
    const statsResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM workspaces WHERE user_id = $1) as workspace_count,
        (SELECT COUNT(*) FROM datasets WHERE user_id = $1) as dataset_count,
        (SELECT COUNT(*) FROM dashboards WHERE workspace_id IN (SELECT id FROM workspaces WHERE user_id = $1)) as dashboard_count,
        (SELECT COUNT(*) FROM queries WHERE executed_by = $1) as query_count`,
      [req.user!.id]
    );

    const stats = statsResult.rows[0];
    const limits = config.tierLimits[tier as keyof typeof config.tierLimits] || config.tierLimits.basic;

    res.json({
      tier,
      limits,
      stats: {
        workspaces: stats.workspace_count,
        datasets: stats.dataset_count,
        dashboards: stats.dashboard_count,
        queriesExecuted: stats.query_count
      }
    });
  } catch (err) {
    console.error('Get usage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get usage statistics (legacy endpoint)
router.get('/usage', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Get subscription tier
    const subResult = await query(
      'SELECT tier FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.user!.id, 'active']
    );

    const tier = subResult.rows.length > 0 ? subResult.rows[0].tier : 'basic';

    // Get usage stats
    const statsResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM workspaces WHERE user_id = $1) as workspace_count,
        (SELECT COUNT(*) FROM datasets WHERE user_id = $1) as dataset_count,
        (SELECT COUNT(*) FROM dashboards WHERE workspace_id IN (SELECT id FROM workspaces WHERE user_id = $1)) as dashboard_count,
        (SELECT COUNT(*) FROM queries WHERE executed_by = $1) as query_count`,
      [req.user!.id]
    );

    const stats = statsResult.rows[0];

    res.json({
      tier,
      stats: {
        workspaces: stats.workspace_count,
        datasets: stats.dataset_count,
        dashboards: stats.dashboard_count,
        queriesExecuted: stats.query_count
      }
    });
  } catch (err) {
    console.error('Get usage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get activity logs
router.get('/activity', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(
      `SELECT id, action, resource_type, resource_id, created_at 
       FROM activity_logs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user!.id, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get activity logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete account
router.delete('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required to delete account' });
    }

    // Get user and verify password
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPasswordCorrect = await bcryptjs.compare(password, userResult.rows[0].password_hash);

    if (!isPasswordCorrect) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Delete user and related data (cascade delete should handle this)
    await query('DELETE FROM users WHERE id = $1', [req.user!.id]);

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
