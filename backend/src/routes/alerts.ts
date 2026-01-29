
import express, { Request, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AlertService } from '../services/alertService.js';

const router = express.Router();

interface AlertCreateRequest {
    metric_id: number;
    name: string;
    condition_type: 'GT' | 'LT' | 'EQ';
    threshold_value: number;
    frequency?: string;
}

// GET /api/workspaces/:workspaceId/alerts - List alerts
router.get('/workspaces/:workspaceId/alerts', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;

        const result = await query(`
      SELECT a.*, m.name as metric_name, m.format_type as metric_format
      FROM alerts a
      LEFT JOIN metrics m ON a.metric_id = m.id
      WHERE a.workspace_id = $1
      ORDER BY a.created_at DESC
    `, [workspaceId]);

        res.json({ data: result.rows });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// POST /api/workspaces/:workspaceId/alerts - Create alert
router.post('/workspaces/:workspaceId/alerts', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user?.id;
        const body: AlertCreateRequest = req.body;

        const result = await query(`
      INSERT INTO alerts (workspace_id, metric_id, name, condition_type, threshold_value, frequency, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
            workspaceId,
            body.metric_id,
            body.name,
            body.condition_type,
            body.threshold_value,
            body.frequency || 'daily',
            userId
        ]);

        res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        console.error('Error creating alert:', error);
        res.status(500).json({ error: 'Failed to create alert' });
    }
});

// DELETE /api/workspaces/:workspaceId/alerts/:id - Delete alert
router.delete('/workspaces/:workspaceId/alerts/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id } = req.params;
        await query(`DELETE FROM alerts WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting alert:', error);
        res.status(500).json({ error: 'Failed to delete alert' });
    }
});

// POST /api/workspaces/:workspaceId/alerts/:id/toggle - Toggle active status
router.post('/workspaces/:workspaceId/alerts/:id/toggle', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id } = req.params;
        const { is_active } = req.body;

        const result = await query(`
      UPDATE alerts SET is_active = $1, updated_at = NOW()
      WHERE id = $2 AND workspace_id = $3
      RETURNING *
    `, [is_active, id, workspaceId]);

        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error('Error toggling alert:', error);
        res.status(500).json({ error: 'Failed to toggle alert' });
    }
});

// POST /api/workspaces/:workspaceId/alerts/check - Trigger check
router.post('/workspaces/:workspaceId/alerts/check', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;
        const notifications = await AlertService.checkAlerts(workspaceId);
        res.json({ success: true, triggered: notifications });
    } catch (error) {
        console.error('Error checking alerts:', error);
        res.status(500).json({ error: 'Failed to check alerts' });
    }
});

export default router;
