import express from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AlertService } from '../services/alertService.js';

const router = express.Router();

// GET /api/alerts - List alerts for current workspace
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ error: 'Workspace ID required' });

        const result = await query(
            `SELECT * FROM alerts WHERE workspace_id = $1 ORDER BY created_at DESC`,
            [workspaceId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('List alerts error:', err);
        res.status(500).json({ error: 'Failed to list alerts' });
    }
});

// POST /api/alerts - Create new alert
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { workspace_id, name, condition_type, threshold_value, metric_id } = req.body;

        // Basic validation
        if (!workspace_id || !name || !condition_type || threshold_value === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await query(
            `INSERT INTO alerts (workspace_id, name, condition_type, threshold_value, metric_id, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [workspace_id, name, condition_type, threshold_value, metric_id || null, req.user!.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create alert error:', err);
        res.status(500).json({ error: 'Failed to create alert' });
    }
});

// DELETE /api/alerts/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        await query(`DELETE FROM alerts WHERE id = $1`, [id]);
        res.json({ message: 'Alert deleted' });
    } catch (err) {
        console.error('Delete alert error:', err);
        res.status(500).json({ error: 'Failed to delete alert' });
    }
});

// POST /api/alerts/:id/check - Manual Trigger
router.post('/:id/check', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const triggered = await AlertService.checkAlert(parseInt(id));
        res.json({ triggered });
    } catch (err) {
        console.error('Check alert error:', err);
        res.status(500).json({ error: 'Failed to check alert' });
    }
});

export default router;
