import express from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/notifications - List unread notifications
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { workspaceId } = req.query;
        // If workspaceId is provided, filter by it, otherwise just by user
        const sql = `SELECT * FROM notifications WHERE user_id = $1 ${workspaceId ? 'AND workspace_id = $2' : ''} ORDER BY created_at DESC LIMIT 50`;
        const params = workspaceId ? [req.user!.id, workspaceId] : [req.user!.id];

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// POST /api/notifications/:id/read - Mark as read
router.post('/:id/read', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        await query(`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, [id, req.user!.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Mark read error:', err);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { workspaceId } = req.body;
        const sql = `UPDATE notifications SET is_read = true WHERE user_id = $1 ${workspaceId ? 'AND workspace_id = $2' : ''}`;
        const params = workspaceId ? [req.user!.id, workspaceId] : [req.user!.id];

        await query(sql, params);
        res.json({ success: true });
    } catch (err) {
        console.error('Mark all read error:', err);
        res.status(500).json({ error: 'Failed to mark all notifications' });
    }
});

export default router;
