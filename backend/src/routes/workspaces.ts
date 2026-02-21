import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription, checkTierLimit } from '../middleware/subscription.js';

const router = Router();

interface WorkspaceAccessRow {
  id: number;
  owner_id: number;
  role: string | null;
}

async function getWorkspaceAccess(workspaceId: number, userId: number): Promise<WorkspaceAccessRow | null> {
  const accessResult = await query(
    `
    SELECT
      w.id,
      w.user_id AS owner_id,
      wm.role
    FROM workspaces w
    LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
    WHERE w.id = $1
      AND (w.user_id = $2 OR wm.user_id = $2)
    LIMIT 1
    `,
    [workspaceId, userId]
  );
  if (!accessResult.rows.length) return null;
  return accessResult.rows[0] as WorkspaceAccessRow;
}

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

// List workspace members
router.get('/:id/members', async (req: AuthRequest, res) => {
  try {
    const workspaceId = Number(req.params.id);
    if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }

    const access = await getWorkspaceAccess(workspaceId, Number(req.user!.id));
    if (!access) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    const membersResult = await query(
      `
      SELECT
        u.id,
        u.full_name,
        u.email,
        wm.role,
        wm.created_at AS joined_at
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = $1
      ORDER BY
        CASE wm.role
          WHEN 'admin' THEN 1
          WHEN 'editor' THEN 2
          ELSE 3
        END ASC,
        COALESCE(u.full_name, u.email) ASC
      `,
      [workspaceId]
    );

    let members = membersResult.rows.map((row) => ({
      id: Number(row.id),
      full_name: row.full_name ? String(row.full_name) : '',
      email: String(row.email || ''),
      role: String(row.role || 'viewer'),
      joined_at: row.joined_at || null,
      is_owner: Number(row.id) === Number(access.owner_id)
    }));

    if (!members.some((member) => Number(member.id) === Number(access.owner_id))) {
      const ownerResult = await query(
        `SELECT id, full_name, email, created_at FROM users WHERE id = $1 LIMIT 1`,
        [access.owner_id]
      );
      const owner = ownerResult.rows[0];
      if (owner) {
        members = [
          {
            id: Number(owner.id),
            full_name: owner.full_name ? String(owner.full_name) : '',
            email: String(owner.email || ''),
            role: 'admin',
            joined_at: owner.created_at || null,
            is_owner: true
          },
          ...members
        ];
      }
    }

    return res.json(members);
  } catch (err) {
    console.error('List workspace members error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update member role
router.put('/:id/members/:memberId', async (req: AuthRequest, res) => {
  try {
    const workspaceId = Number(req.params.id);
    const memberId = Number(req.params.memberId);
    const role = String(req.body?.role || '').trim().toLowerCase();
    if (!Number.isFinite(workspaceId) || workspaceId <= 0 || !Number.isFinite(memberId) || memberId <= 0) {
      return res.status(400).json({ error: 'Invalid workspace/member id' });
    }
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin, editor, or viewer' });
    }

    const access = await getWorkspaceAccess(workspaceId, Number(req.user!.id));
    if (!access) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }
    const canManage = Number(access.owner_id) === Number(req.user!.id) || String(access.role || '').toLowerCase() === 'admin';
    if (!canManage) {
      return res.status(403).json({ error: 'Only workspace admins can update member roles' });
    }
    if (memberId === Number(access.owner_id)) {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    const updateResult = await query(
      `
      UPDATE workspace_members
      SET role = $3, updated_at = NOW()
      WHERE workspace_id = $1 AND user_id = $2
      RETURNING workspace_id, user_id, role, updated_at
      `,
      [workspaceId, memberId, role]
    );
    if (!updateResult.rows.length) {
      return res.status(404).json({ error: 'Workspace member not found' });
    }

    const memberResult = await query(
      `
      SELECT u.id, u.full_name, u.email, wm.role, wm.created_at AS joined_at
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = $1 AND wm.user_id = $2
      LIMIT 1
      `,
      [workspaceId, memberId]
    );
    return res.json(memberResult.rows[0] || updateResult.rows[0]);
  } catch (err) {
    console.error('Update workspace member role error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove member from workspace
router.delete('/:id/members/:memberId', async (req: AuthRequest, res) => {
  try {
    const workspaceId = Number(req.params.id);
    const memberId = Number(req.params.memberId);
    if (!Number.isFinite(workspaceId) || workspaceId <= 0 || !Number.isFinite(memberId) || memberId <= 0) {
      return res.status(400).json({ error: 'Invalid workspace/member id' });
    }

    const access = await getWorkspaceAccess(workspaceId, Number(req.user!.id));
    if (!access) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }
    const canManage = Number(access.owner_id) === Number(req.user!.id) || String(access.role || '').toLowerCase() === 'admin';
    if (!canManage) {
      return res.status(403).json({ error: 'Only workspace admins can remove members' });
    }
    if (memberId === Number(access.owner_id)) {
      return res.status(400).json({ error: 'Cannot remove workspace owner' });
    }

    const deleteResult = await query(
      `
      DELETE FROM workspace_members
      WHERE workspace_id = $1 AND user_id = $2
      RETURNING id
      `,
      [workspaceId, memberId]
    );
    if (!deleteResult.rows.length) {
      return res.status(404).json({ error: 'Workspace member not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Remove workspace member error:', err);
    return res.status(500).json({ error: 'Internal server error' });
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
