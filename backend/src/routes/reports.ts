
import express, { Request, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/:workspaceId/reports - List reports
router.get('/:workspaceId/reports', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;
        const { datasetId } = req.query;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
        const offset = parseInt(req.query.offset as string) || 0;

        let sql = `
      SELECT r.*, u.email as owner_email,
      (SELECT COUNT(*) FROM report_versions WHERE report_id = r.id) as version_count
      FROM strategic_reports r
      LEFT JOIN users u ON r.owner_id = u.id
      WHERE r.workspace_id = $1
    `;
        const params: any[] = [workspaceId];

        if (datasetId) {
            sql += ` AND r.dataset_id = $2`;
            params.push(datasetId);
        }

        // Get total count first
        const countSql = `SELECT COUNT(*) as total FROM strategic_reports r WHERE r.workspace_id = $1 ${datasetId ? 'AND r.dataset_id = $2' : ''}`;
        const countParams = datasetId ? [workspaceId, datasetId] : [workspaceId];
        const countResult = await query(countSql, countParams);
        const total = parseInt(countResult.rows[0].total);

        // Get paginated data
        sql += ` ORDER BY r.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(sql, params);

        res.json({
            data: result.rows,
            total,
            limit,
            offset,
            hasMore: offset + limit < total
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// GET /api/:workspaceId/reports/:id - Get single report
router.get('/:workspaceId/reports/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id } = req.params;
        const result = await query(`
      SELECT r.*, u.email as owner_email 
      FROM strategic_reports r
      LEFT JOIN users u ON r.owner_id = u.id
      WHERE r.id = $1 AND r.workspace_id = $2
    `, [id, workspaceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// POST /api/:workspaceId/reports - Create report
router.post('/:workspaceId/reports', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user?.id;
        const { name, description, dataset_id, content } = req.body;

        const result = await query(`
      INSERT INTO strategic_reports (workspace_id, dataset_id, owner_id, name, description, current_content)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [workspaceId, dataset_id, userId, name, description, content || '{}']);

        res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'Failed to create report' });
    }
});

// PUT /api/:workspaceId/reports/:id - Update report
router.put('/:workspaceId/reports/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id } = req.params;
        const { name, description, content } = req.body;

        const result = await query(`
      UPDATE strategic_reports 
      SET name = COALESCE($1, name), 
          description = COALESCE($2, description), 
          current_content = COALESCE($3, current_content),
          updated_at = NOW()
      WHERE id = $4 AND workspace_id = $5
      RETURNING *
    `, [name, description, content, id, workspaceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

// GET /api/:workspaceId/reports/:id/versions - List versions
router.get('/:workspaceId/reports/:id/versions', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id } = req.params;

        // First verify report belongs to workspace
        const reportCheck = await query(`SELECT id FROM strategic_reports WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
        if (reportCheck.rows.length === 0) return res.status(404).json({ error: 'Report not found' });

        const result = await query(`
      SELECT v.*, u.email as creator_email 
      FROM report_versions v
      LEFT JOIN users u ON v.created_by = u.id
      WHERE v.report_id = $1
      ORDER BY v.version_number DESC
    `, [id]);

        res.json({ data: result.rows });
    } catch (error) {
        console.error('Error fetching versions:', error);
        res.status(500).json({ error: 'Failed to fetch versions' });
    }
});

// POST /api/:workspaceId/reports/:id/versions - Create version
router.post('/:workspaceId/reports/:id/versions', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id } = req.params;
        const userId = req.user?.id;
        const { change_summary } = req.body;

        // 1. Get current report state
        const reportRes = await query(`SELECT * FROM strategic_reports WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
        if (reportRes.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
        const report = reportRes.rows[0];

        // 2. Get next version number
        const verRes = await query(`SELECT COALESCE(MAX(version_number), 0) + 1 as next_ver FROM report_versions WHERE report_id = $1`, [id]);
        const nextVer = verRes.rows[0].next_ver;

        // 3. Create version
        const result = await query(`
      INSERT INTO report_versions (report_id, version_number, content, created_by, change_summary)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, nextVer, report.current_content, userId, change_summary]);

        res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        console.error('Error creating version:', error);
        res.status(500).json({ error: 'Failed to create version' });
    }
});

// POST /api/:workspaceId/reports/:id/restore/:versionId - Restore version
router.post('/:workspaceId/reports/:id/restore/:versionId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, id, versionId } = req.params;

        // 1. Get version content
        const verRes = await query(`
      SELECT v.* FROM report_versions v
      JOIN strategic_reports r ON v.report_id = r.id
      WHERE v.id = $1 AND r.id = $2 AND r.workspace_id = $3
    `, [versionId, id, workspaceId]);

        if (verRes.rows.length === 0) return res.status(404).json({ error: 'Version not found' });
        const version = verRes.rows[0];

        // 2. Update report current_content
        const result = await query(`
      UPDATE strategic_reports 
      SET current_content = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [version.content, id]);

        res.json({ data: result.rows[0], message: `Restored to version ${version.version_number}` });
    } catch (error) {
        console.error('Error restoring version:', error);
        res.status(500).json({ error: 'Failed to restore version' });
    }
});

export default router;
