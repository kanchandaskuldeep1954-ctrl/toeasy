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
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500); // Max 500
    const offset = parseInt(req.query.offset as string) || 0;

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM dashboards WHERE workspace_id = $1`,
      [req.params.workspaceId]
    );

    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const result = await query(
      `SELECT id, name, description, layout, created_at, updated_at 
       FROM dashboards 
       WHERE workspace_id = $1 
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.workspaceId, limit, offset]
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
    const { name, description, layout, charts, filters, theme } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Dashboard name required' });
    }

    // Convert layout to JSON if it's a string or object
    let layoutJson = '[]';
    if (layout) {
      if (typeof layout === 'string') {
        // If it's already a string like "grid", just use it as a simple value
        layoutJson = JSON.stringify({ type: layout });
      } else if (Array.isArray(layout)) {
        layoutJson = JSON.stringify(layout);
      } else {
        layoutJson = JSON.stringify(layout);
      }
    }

    const result = await query(
      `INSERT INTO dashboards (workspace_id, name, description, layout) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, description, layout, created_at`,
      [req.params.workspaceId, name, description || null, layoutJson]
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
      `SELECT id, name, description, layout, created_at, updated_at 
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
    const { name, description, layout } = req.body;

    // Convert layout to JSON if needed
    let layoutJson = '[]';
    if (layout) {
      if (typeof layout === 'string') {
        layoutJson = JSON.stringify({ type: layout });
      } else if (Array.isArray(layout)) {
        layoutJson = JSON.stringify(layout);
      } else {
        layoutJson = JSON.stringify(layout);
      }
    }

    const result = await query(
      `UPDATE dashboards 
       SET name = $1, description = $2, layout = $3, updated_at = NOW() 
       WHERE id = $4 AND workspace_id = $5 
       RETURNING id, name, description, layout, updated_at`,
      [name, description, layoutJson, req.params.dashboardId, req.params.workspaceId]
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

// Suggest dashboard layout with AI
router.post('/:workspaceId/dashboards/:dashboardId/suggest', async (req: AuthRequest, res) => {
  try {
    const { datasetId } = req.body;

    // Get dataset
    const datasetResult = await query(
      'SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2',
      [datasetId, req.params.workspaceId]
    );

    if (datasetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const data = JSON.parse(datasetResult.rows[0].raw_data);
    const headers = Object.keys(data[0] || {});
    // PASSING LARGER SAMPLE (2000) FOR ANALYTICS ENGINE
    const sample = data.slice(0, 2000);

    // Call Groq service
    const dashboard = await GroqService.generateDashboard(headers, sample);

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
