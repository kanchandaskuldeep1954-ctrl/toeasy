import express, { Request, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { verifyWorkspaceOwnership } from '../middleware/workspace.js';

const router = express.Router();

interface MetricCreateRequest {
    name: string;
    formula: string;
    description?: string;
    category?: string;
    format_type?: 'number' | 'currency' | 'percentage' | 'integer';
    decimal_places?: number;
    dependencies?: string[];
    tags?: string[];
}

// GET /api/workspaces/:workspaceId/metrics - List all metrics
router.get('/workspaces/:workspaceId/metrics', authenticateToken, verifyWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;
        const { category, certified, search } = req.query;

        let sql = `
      SELECT 
        m.*,
        (SELECT COUNT(*) FROM metric_usage WHERE metric_id = m.id) as usage_count,
        u.email as owner_email
      FROM metrics m
      LEFT JOIN users u ON m.owner_id = u.id
      WHERE m.workspace_id = $1
    `;
        const params: any[] = [workspaceId];
        let paramIndex = 2;

        if (category) {
            sql += ` AND m.category = $${paramIndex++}`;
            params.push(category);
        }
        if (certified === 'true') {
            sql += ` AND m.is_certified = true`;
        }
        if (search) {
            sql += ` AND (m.name ILIKE $${paramIndex} OR m.description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        sql += ` ORDER BY m.name ASC`;

        const result = await query(sql, params);
        res.json({ data: result.rows });
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// GET /api/workspaces/:workspaceId/metrics/:id - Get single metric with usage
router.get('/workspaces/:workspaceId/metrics/:id', authenticateToken, verifyWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id } = req.params;

        const metricResult = await query(`
      SELECT m.*, u.email as owner_email
      FROM metrics m
      LEFT JOIN users u ON m.owner_id = u.id
      WHERE m.id = $1 AND m.workspace_id = $2
    `, [id, workspaceId]);

        if (metricResult.rows.length === 0) {
            return res.status(404).json({ error: 'Metric not found' });
        }

        const metric = metricResult.rows[0];

        // Get usage details
        const usageResult = await query(`SELECT * FROM metric_usage WHERE metric_id = $1`, [id]);

        // Get version history
        const versionsResult = await query(`
      SELECT * FROM metric_versions 
      WHERE metric_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [id]);

        res.json({
            data: {
                ...metric,
                usage: usageResult.rows,
                versions: versionsResult.rows,
                usage_count: usageResult.rows.length
            }
        });
    } catch (error) {
        console.error('Error fetching metric:', error);
        res.status(500).json({ error: 'Failed to fetch metric' });
    }
});

// POST /api/workspaces/:workspaceId/metrics - Create new metric
router.post('/workspaces/:workspaceId/metrics', authenticateToken, verifyWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user?.id;
        const body: MetricCreateRequest = req.body;

        const result = await query(`
      INSERT INTO metrics (workspace_id, owner_id, name, formula, description, category, format_type, decimal_places, dependencies, tags, is_certified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
      RETURNING *
    `, [
            workspaceId,
            userId,
            body.name,
            body.formula,
            body.description || '',
            body.category || 'General',
            body.format_type || 'number',
            body.decimal_places ?? 2,
            JSON.stringify(body.dependencies || []),
            JSON.stringify(body.tags || [])
        ]);

        const metric = result.rows[0];

        // Create initial version record
        await query(`
      INSERT INTO metric_versions (metric_id, formula, change_reason, changed_by)
      VALUES ($1, $2, $3, $4)
    `, [metric.id, body.formula, 'Initial creation', userId]);

        res.status(201).json({ data: metric });
    } catch (error) {
        console.error('Error creating metric:', error);
        res.status(500).json({ error: 'Failed to create metric' });
    }
});

// PUT /api/workspaces/:workspaceId/metrics/:id - Update metric
router.put('/workspaces/:workspaceId/metrics/:id', authenticateToken, verifyWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id } = req.params;
        const userId = req.user?.id;
        const body = req.body;

        // Get current metric to check formula change
        const currentResult = await query(`
      SELECT * FROM metrics WHERE id = $1 AND workspace_id = $2
    `, [id, workspaceId]);

        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Metric not found' });
        }

        const current = currentResult.rows[0];

        const result = await query(`
      UPDATE metrics SET
        name = COALESCE($1, name),
        formula = COALESCE($2, formula),
        description = COALESCE($3, description),
        category = COALESCE($4, category),
        format_type = COALESCE($5, format_type),
        decimal_places = COALESCE($6, decimal_places),
        dependencies = COALESCE($7, dependencies),
        tags = COALESCE($8, tags),
        updated_at = NOW()
      WHERE id = $9 AND workspace_id = $10
      RETURNING *
    `, [
            body.name || null,
            body.formula || null,
            body.description !== undefined ? body.description : null,
            body.category || null,
            body.format_type || null,
            body.decimal_places !== undefined ? body.decimal_places : null,
            body.dependencies ? JSON.stringify(body.dependencies) : null,
            body.tags ? JSON.stringify(body.tags) : null,
            id,
            workspaceId
        ]);

        // If formula changed, create version record
        if (body.formula && body.formula !== current.formula) {
            await query(`
        INSERT INTO metric_versions (metric_id, formula, change_reason, changed_by)
        VALUES ($1, $2, $3, $4)
      `, [id, body.formula, body.change_reason || 'Formula updated', userId]);
        }

        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error('Error updating metric:', error);
        res.status(500).json({ error: 'Failed to update metric' });
    }
});

// PATCH /api/workspaces/:workspaceId/metrics/:id/certify - Certify/uncertify a metric
router.patch('/workspaces/:workspaceId/metrics/:id/certify', authenticateToken, verifyWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id } = req.params;
        const { certified } = req.body;

        const result = await query(`
      UPDATE metrics SET is_certified = $1, updated_at = NOW()
      WHERE id = $2 AND workspace_id = $3
      RETURNING *
    `, [certified, id, workspaceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Metric not found' });
        }

        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error('Error certifying metric:', error);
        res.status(500).json({ error: 'Failed to certify metric' });
    }
});

// DELETE /api/workspaces/:workspaceId/metrics/:id - Delete metric
router.delete('/workspaces/:workspaceId/metrics/:id', authenticateToken, verifyWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id } = req.params;

        // Check if metric is in use
        const usageResult = await query(`SELECT COUNT(*) as count FROM metric_usage WHERE metric_id = $1`, [id]);
        const usageCount = parseInt(usageResult.rows[0]?.count || '0', 10);

        if (usageCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete metric that is in use',
                usage_count: usageCount
            });
        }

        await query(`DELETE FROM metrics WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting metric:', error);
        res.status(500).json({ error: 'Failed to delete metric' });
    }
});

// GET /api/workspaces/:workspaceId/metrics/categories - Get all categories
router.get('/workspaces/:workspaceId/metrics/categories', authenticateToken, verifyWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;

        const result = await query(`
      SELECT DISTINCT category FROM metrics 
      WHERE workspace_id = $1 AND category IS NOT NULL
      ORDER BY category
    `, [workspaceId]);

        res.json({ data: result.rows.map(r => r.category) });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// POST /api/workspaces/:workspaceId/metrics/:id/track-usage - Track metric usage
router.post('/workspaces/:workspaceId/metrics/:id/track-usage', authenticateToken, verifyWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id } = req.params;
        const { used_in_type, used_in_id } = req.body;

        const metricCheck = await query(
            `SELECT id FROM metrics WHERE id = $1 AND workspace_id = $2`,
            [id, workspaceId]
        );
        if (metricCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Metric not found' });
        }

        // Check if already tracked
        const existing = await query(`
      SELECT * FROM metric_usage WHERE metric_id = $1 AND used_in_type = $2 AND used_in_id = $3
    `, [id, used_in_type, used_in_id]);

        if (existing.rows.length > 0) {
            return res.json({ data: existing.rows[0] });
        }

        const result = await query(`
      INSERT INTO metric_usage (metric_id, used_in_type, used_in_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, used_in_type, used_in_id]);

        res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        console.error('Error tracking usage:', error);
        res.status(500).json({ error: 'Failed to track usage' });
    }
});

export default router;
