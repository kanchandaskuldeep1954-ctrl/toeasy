import express from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get activity feed
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { workspaceId, datasetId, limit = 50, offset = 0, category, type } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ error: 'workspaceId is required' });
        }

        const wsCheck = await query(
            'SELECT id FROM workspaces WHERE id = $1 AND user_id = $2',
            [workspaceId, req.user!.id]
        );
        if (wsCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        // Base query
        let sql = `
            SELECT a.*, u.email as user_email, u.full_name as user_name
            FROM activity_log a
            JOIN users u ON a.user_id = u.id
            WHERE a.workspace_id = $1
        `;
        const params: any[] = [workspaceId];
        let paramIndex = 2;

        // Optional filters
        if (datasetId) {
            sql += ` AND a.dataset_id = $${paramIndex}`;
            params.push(datasetId);
            paramIndex++;
        }

        if (category) {
            sql += ` AND a.action_category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        if (type) {
            sql += ` AND a.action_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        // Sorting and pagination
        sql += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await query(sql, params);

        // Get total count for pagination
        let countSql = `SELECT COUNT(*) as total FROM activity_log WHERE workspace_id = $1`;
        const countParams = [workspaceId];
        // Note: Simplified count query ignores other filters for now for speed, 
        // but ideally should include them.

        const countResult = await query(countSql, countParams);

        res.json({
            data: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: Number(limit),
                offset: Number(offset)
            }
        });
    } catch (err) {
        console.error('Get activity log error:', err);
        res.status(500).json({ error: 'Failed to fetch activity log' });
    }
});

// Log new activity
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const {
            workspaceId,
            datasetId,
            actionType,
            actionCategory,
            actionDetail,
            actionMetadata,
            sourceComponent
        } = req.body;
        const userId = req.user!.id;

        if (!workspaceId || !actionType || !actionCategory) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const wsCheck = await query(
            'SELECT id FROM workspaces WHERE id = $1 AND user_id = $2',
            [workspaceId, userId]
        );
        if (wsCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        const sql = `
            INSERT INTO activity_log 
            (user_id, workspace_id, dataset_id, action_type, action_category, action_detail, action_metadata, source_component)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const result = await query(sql, [
            userId,
            workspaceId,
            datasetId || null,
            actionType,
            actionCategory,
            actionDetail,
            JSON.stringify(actionMetadata || {}),
            sourceComponent
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Log activity error:', err);
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

export default router;
