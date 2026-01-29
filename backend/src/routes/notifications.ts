
import express, { Request, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/notifications - List notifications
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { unreadOnly } = req.query;

        let sql = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;
        const params: any[] = [userId];

        if (unreadOnly === 'true') {
            sql += ` AND is_read = false`;
        }

        sql += ` ORDER BY created_at DESC LIMIT 50`;

        const result = await query(sql, params);
        res.json({ data: result.rows });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// POST /api/notifications/:id/read - Mark as read
router.post('/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        await query(`
      UPDATE notifications SET is_read = true
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking notification read:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        await query(`
      UPDATE notifications SET is_read = true
      WHERE user_id = $1 AND is_read = false
    `, [userId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking all read:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        await query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [id, userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
