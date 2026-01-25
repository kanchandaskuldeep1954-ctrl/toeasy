/**
 * Tabs Routes
 * 
 * Handles workspace tabs management (save, list, delete, reorder).
 * Users can save dashboards, reports, and datasets as quick-access tabs.
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * List tabs for a workspace
 * GET /tabs?workspaceId=xxx
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { workspaceId } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ error: 'workspaceId is required' });
        }

        const result = await query(
            `SELECT id, tab_type, resource_id, tab_name, tab_order
             FROM workspace_tabs
             WHERE user_id = $1 AND workspace_id = $2
             ORDER BY tab_order ASC`,
            [req.user!.id, workspaceId]
        );

        res.json(result.rows);

    } catch (err) {
        console.error('List tabs error:', err);
        res.status(500).json({ error: 'Failed to list tabs' });
    }
});

/**
 * Add a new tab
 * POST /tabs
 * Body: { workspaceId, tabType, resourceId, tabName }
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { workspaceId, tabType, resourceId, tabName } = req.body;

        if (!workspaceId || !tabType || !resourceId || !tabName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!['dashboard', 'report', 'dataset'].includes(tabType)) {
            return res.status(400).json({ error: 'Invalid tab type' });
        }

        // Get max order for this workspace
        const maxOrderResult = await query(
            `SELECT COALESCE(MAX(tab_order), 0) + 1 as next_order
             FROM workspace_tabs
             WHERE user_id = $1 AND workspace_id = $2`,
            [req.user!.id, workspaceId]
        );
        const nextOrder = maxOrderResult.rows[0].next_order;

        const result = await query(
            `INSERT INTO workspace_tabs (user_id, workspace_id, tab_type, resource_id, tab_name, tab_order)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, workspace_id, tab_type, resource_id) DO UPDATE
             SET tab_name = EXCLUDED.tab_name
             RETURNING id, tab_type, resource_id, tab_name, tab_order`,
            [req.user!.id, workspaceId, tabType, resourceId, tabName, nextOrder]
        );

        res.json(result.rows[0]);

    } catch (err) {
        console.error('Add tab error:', err);
        res.status(500).json({ error: 'Failed to add tab' });
    }
});

/**
 * Remove a tab
 * DELETE /tabs/:id
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `DELETE FROM workspace_tabs
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [id, req.user!.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tab not found' });
        }

        res.json({ success: true });

    } catch (err) {
        console.error('Delete tab error:', err);
        res.status(500).json({ error: 'Failed to delete tab' });
    }
});

/**
 * Reorder tabs
 * PUT /tabs/reorder
 * Body: { workspaceId, tabIds: string[] } - array of tab IDs in desired order
 */
router.put('/reorder', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { workspaceId, tabIds } = req.body;

        if (!workspaceId || !Array.isArray(tabIds)) {
            return res.status(400).json({ error: 'Missing workspaceId or tabIds array' });
        }

        // Update order for each tab
        const updates = tabIds.map((tabId, index) =>
            query(
                `UPDATE workspace_tabs SET tab_order = $1
                 WHERE id = $2 AND user_id = $3 AND workspace_id = $4`,
                [index, tabId, req.user!.id, workspaceId]
            )
        );

        await Promise.all(updates);

        res.json({ success: true });

    } catch (err) {
        console.error('Reorder tabs error:', err);
        res.status(500).json({ error: 'Failed to reorder tabs' });
    }
});

export default router;
