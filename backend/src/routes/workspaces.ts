import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription, checkTierLimit } from '../middleware/subscription.js';

const router = Router();

// Apply auth middleware to all workspace routes
router.use(authenticateToken);
router.use(checkSubscription);

// List workspaces for user (owned + shared)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const userId = req.user!.id;

    const countQuery = `
      SELECT COUNT(DISTINCT w.id) as total 
      FROM workspaces w
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE (w.user_id = $1 OR wm.user_id = $1) AND w.is_archived = false
    `;

    const countResult = await query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].total);

    const listQuery = `
      SELECT DISTINCT w.id, w.name, w.description, w.created_at, w.user_id as owner_id,
      CASE 
        WHEN w.user_id = $1 THEN 'admin'
        ELSE wm.role
      END as role
      FROM workspaces w
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = $1
      WHERE (w.user_id = $1 OR wm.user_id = $1) AND w.is_archived = false
      ORDER BY w.created_at DESC 
      LIMIT $2 OFFSET $3
    `;

    const result = await query(listQuery, [userId, limit, offset]);

    res.json({
      data: result.rows,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (err) {
    console.error('List workspaces error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create workspace
router.post('/', checkTierLimit('maxWorkspaces'), async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workspace name required' });
    }

    const result = await query(
      'INSERT INTO workspaces (user_id, name, description) VALUES ($1, $2, $3) RETURNING id, name, description, created_at',
      [req.user!.id, name, description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create workspace error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workspace details
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const workspaceId = req.params.id;

    const queryStr = `
      SELECT 
        w.id, w.name, w.description, w.created_at, w.user_id as owner_id,
        CASE 
          WHEN w.user_id = $2 THEN 'admin' 
          ELSE wm.role 
        END as role
      FROM workspaces w
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = $2
      WHERE w.id = $1 AND (w.user_id = $2 OR wm.user_id = $2)
    `;

    const result = await query(queryStr, [workspaceId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get workspace error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update workspace
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;

    const result = await query(
      'UPDATE workspaces SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING id, name, description, updated_at',
      [name, description, req.params.id, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update workspace error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete workspace
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await query(
      'UPDATE workspaces SET is_archived = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );

    res.json({ message: 'Workspace archived' });
  } catch (err) {
    console.error('Delete workspace error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workspace stats
router.get('/:id/stats', async (req: AuthRequest, res) => {
  try {
    const statsResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM datasets WHERE workspace_id = $1 AND user_id = $2) as dataset_count,
        (SELECT COUNT(*) FROM dashboards WHERE workspace_id = $1) as dashboard_count,
        (SELECT COUNT(*) FROM queries WHERE workspace_id = $1) as query_count`,
      [req.params.id, req.user!.id]
    );

    res.json(statsResult.rows[0]);
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
