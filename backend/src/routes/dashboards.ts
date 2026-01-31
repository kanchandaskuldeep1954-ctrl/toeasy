import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import { GroqService } from '../services/groq.service.js';

const router = Router();
const groqService = new GroqService();

// Safe JSON parse helper - handles plain strings and JSON
const safeParse = (value: any) => {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      // If it's not valid JSON, it's a plain string (like "grid")
      return { type: value };
    }
  }
  return value;
};

// Apply auth and subscription middleware
router.use(authenticateToken);
router.use(checkSubscription);

// List dashboards in workspace (with pagination)
router.get('/:workspaceId/dashboards', async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const datasetId = req.query.datasetId;

    let whereClause = 'workspace_id = $1';
    let params: any[] = [req.params.workspaceId];

    if (datasetId) {
      whereClause += ' AND dataset_id = $2';
      params.push(datasetId);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM dashboards WHERE ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const result = await query(
      `SELECT id, name, description, layout, dataset_id, is_primary, created_at, updated_at 
       FROM dashboards 
       WHERE ${whereClause}
       ORDER BY is_primary DESC, created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const dashboards = result.rows.map(d => ({
      ...d,
      layout: safeParse(d.layout)
    }));

    res.json({
      data: dashboards,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (err) {
    console.error('List dashboards error:', err);
    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

// Create dashboard
router.post('/:workspaceId/dashboards', async (req: AuthRequest, res) => {
  try {
    const { name, description, layout, dataset_id, is_primary } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Dashboard name required' });
    }

    let layoutJson = '[]';
    if (layout) {
      layoutJson = typeof layout === 'string' ? JSON.stringify({ type: layout }) : JSON.stringify(layout);
    }

    const result = await query(
      `INSERT INTO dashboards (workspace_id, name, description, layout, dataset_id, is_primary) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, name, description, layout, dataset_id, is_primary, created_at`,
      [req.params.workspaceId, name, description || null, layoutJson, dataset_id || null, is_primary || false]
    );

    const dashboard = result.rows[0];
    res.status(201).json({
      ...dashboard,
      layout: safeParse(dashboard.layout)
    });
  } catch (err) {
    console.error('Create dashboard error:', err);
    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

// Get dashboard details
router.get('/:workspaceId/dashboards/:dashboardId', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, name, description, layout, dataset_id, is_primary, created_at, updated_at 
       FROM dashboards 
       WHERE id = $1 AND workspace_id = $2`,
      [req.params.dashboardId, req.params.workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    const dashboard = result.rows[0];
    res.json({
      ...dashboard,
      layout: safeParse(dashboard.layout)
    });
  } catch (err) {
    console.error('Get dashboard error:', err);
    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

// Update dashboard
router.put('/:workspaceId/dashboards/:dashboardId', async (req: AuthRequest, res) => {
  try {
    const { name, description, layout, is_primary } = req.body;

    let layoutJson = '[]';
    if (layout) {
      layoutJson = typeof layout === 'string' ? JSON.stringify({ type: layout }) : JSON.stringify(layout);
    }

    const result = await query(
      `UPDATE dashboards 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description), 
           layout = COALESCE($3, layout), 
           is_primary = COALESCE($4, is_primary),
           updated_at = NOW() 
       WHERE id = $5 AND workspace_id = $6 
       RETURNING id, name, description, layout, dataset_id, is_primary, updated_at`,
      [name || null, description || null, layout ? layoutJson : null, is_primary !== undefined ? is_primary : null, req.params.dashboardId, req.params.workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    const dashboard = result.rows[0];
    res.json({
      ...dashboard,
      layout: safeParse(dashboard.layout)
    });
  } catch (err) {
    console.error('Update dashboard error:', err);
    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

// CREATE VERSION
router.post('/:workspaceId/dashboards/:dashboardId/versions', async (req: AuthRequest, res) => {
  try {
    const { name, description, config } = req.body;

    if (!name || !config) {
      return res.status(400).json({ error: 'Version name and config required' });
    }

    const result = await query(
      `INSERT INTO dashboard_versions (dashboard_id, version_name, description, config) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, version_name, description, config, created_at`,
      [req.params.dashboardId, name, description || null, JSON.stringify(config)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create version error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// LIST VERSIONS
router.get('/:workspaceId/dashboards/:dashboardId/versions', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, version_name, description, config, created_at 
       FROM dashboard_versions 
       WHERE dashboard_id = $1 
       ORDER BY created_at DESC`,
      [req.params.dashboardId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List versions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Suggest dashboard layout with AI
router.post('/:workspaceId/dashboards/:dashboardId/suggest', async (req: AuthRequest, res) => {
  try {
    const { datasetId } = req.body;

    const datasetResult = await query(
      'SELECT raw_data, source_type FROM datasets WHERE id = $1 AND workspace_id = $2',
      [datasetId, req.params.workspaceId]
    );

    if (datasetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const data = JSON.parse(datasetResult.rows[0].raw_data);
    const headers = Object.keys(data[0] || {});
    const sample = data.slice(0, 2000);

    const dashboard = await GroqService.generateDashboard(headers, sample, datasetResult.rows[0].source_type);

    res.json({ dashboard });
  } catch (err) {
    console.error('Suggest dashboard error:', err);
    res.status(500).json({ error: 'Failed to suggest dashboard layout' });
  }
});

// Delete dashboard
router.delete('/:workspaceId/dashboards/:dashboardId', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'DELETE FROM dashboards WHERE id = $1 AND workspace_id = $2 RETURNING id',
      [req.params.dashboardId, req.params.workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    res.json({ message: 'Dashboard deleted' });
  } catch (err) {
    console.error('Delete dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
