/**
 * Tasks Routes - Full CRUD for Task Management
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware
router.use(authenticateToken);

// Get all tasks for workspace
router.get('/', async (req: AuthRequest, res) => {
    try {
        const workspaceId = req.query.workspace_id as string | undefined;
        const status = req.query.status as string | undefined;
        const assignee_id = req.query.assignee_id as string | undefined;
        const priority = req.query.priority as string | undefined;

        if (!workspaceId) {
            return res.status(400).json({ error: 'workspace_id is required' });
        }

        const wsCheck = await query('SELECT id FROM workspaces WHERE id = $1 AND user_id = $2', [workspaceId, req.user!.id]);
        if (wsCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        let sql = `SELECT * FROM tasks WHERE workspace_id = $1`;
        const params: any[] = [workspaceId];
        let paramIdx = 2;

        if (status) {
            sql += ` AND status = $${paramIdx++}`;
            params.push(status);
        }
        if (assignee_id) {
            sql += ` AND assignee_id = $${paramIdx++}`;
            params.push(assignee_id);
        }
        if (priority) {
            sql += ` AND priority = $${paramIdx++}`;
            params.push(priority);
        }

        sql += ` ORDER BY status, position`;

        const result = await query(sql, params);
        const tasks = result.rows;

        // Get assignee info
        const userIds = [...new Set(tasks.map((t: any) => t.assignee_id).filter(Boolean))];
        let users: any[] = [];
        if (userIds.length > 0) {
            const userResult = await query(
                `SELECT id, full_name, email FROM users WHERE id = ANY($1)`,
                [userIds]
            );
            users = userResult.rows;
        }
        const userMap = Object.fromEntries(users.map(u => [u.id, u]));

        const tasksWithAssignees = tasks.map((t: any) => ({
            ...t,
            assignee: t.assignee_id ? userMap[t.assignee_id] : null,
            tags: typeof t.tags === 'string' ? JSON.parse(t.tags) : (t.tags || [])
        }));

        res.json({ tasks: tasksWithAssignees });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// Get single task
router.get('/:id', async (req: AuthRequest, res) => {
    try {
        const result = await query(
            `SELECT t.*
             FROM tasks t
             JOIN workspaces w ON w.id = t.workspace_id
             WHERE t.id = $1 AND w.user_id = $2`,
            [req.params.id, req.user!.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

        const task = result.rows[0];

        // Get comments
        const commentsResult = await query(
            'SELECT * FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC',
            [req.params.id]
        );

        // Get subtasks
        const subtasksResult = await query(
            `SELECT t.*
             FROM tasks t
             JOIN workspaces w ON w.id = t.workspace_id
             WHERE t.parent_id = $1 AND w.user_id = $2
             ORDER BY t.position`,
            [req.params.id, req.user!.id]
        );

        res.json({
            task: {
                ...task,
                tags: typeof task.tags === 'string' ? JSON.parse(task.tags) : (task.tags || []),
                comments: commentsResult.rows,
                subtasks: subtasksResult.rows
            }
        });
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

// Create task
router.post('/', async (req: AuthRequest, res) => {
    try {
        const { title, description, status, priority, assignee_id, due_date, tags, parent_id, workspace_id } = req.body;

        if (!title) return res.status(400).json({ error: 'Title is required' });

        const wsId = workspace_id;

        if (!wsId) {
            return res.status(400).json({ error: 'workspace_id is required' });
        }

        const wsCheck = await query('SELECT id FROM workspaces WHERE id = $1 AND user_id = $2', [wsId, req.user!.id]);
        if (wsCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        // Get max position for status
        const maxPosResult = await query(
            'SELECT COALESCE(MAX(position), 0) as max FROM tasks WHERE workspace_id = $1 AND status = $2',
            [wsId, status || 'backlog']
        );

        const result = await query(
            `INSERT INTO tasks (workspace_id, title, description, status, priority, assignee_id, created_by, due_date, tags, parent_id, position)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                wsId,
                title,
                description || null,
                status || 'backlog',
                priority || 'medium',
                assignee_id || null,
                req.user?.id,
                due_date || null,
                JSON.stringify(tags || []),
                parent_id || null,
                (maxPosResult.rows[0]?.max || 0) + 1
            ]
        );

        res.status(201).json({ task: result.rows[0] });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// Update task
router.put('/:id', async (req: AuthRequest, res) => {
    try {
        const { title, description, status, priority, assignee_id, due_date, tags, position } = req.body;

        const result = await query(
            `UPDATE tasks t SET
                title = COALESCE($1, t.title),
                description = COALESCE($2, t.description),
                status = COALESCE($3, t.status),
                priority = COALESCE($4, t.priority),
                assignee_id = COALESCE($5, t.assignee_id),
                due_date = COALESCE($6, t.due_date),
                tags = COALESCE($7, t.tags),
                position = COALESCE($8, t.position),
                updated_at = NOW()
             FROM workspaces w
             WHERE t.id = $9 AND w.id = t.workspace_id AND w.user_id = $10
             RETURNING t.*`,
            [
                title || null,
                description !== undefined ? description : null,
                status || null,
                priority || null,
                assignee_id !== undefined ? assignee_id : null,
                due_date !== undefined ? due_date : null,
                tags !== undefined ? JSON.stringify(tags) : null,
                position !== undefined ? position : null,
                req.params.id,
                req.user!.id
            ]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

        res.json({ task: result.rows[0] });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// Delete task
router.delete('/:id', async (req: AuthRequest, res) => {
    try {
        const result = await query(
            `DELETE FROM tasks t
             USING workspaces w
             WHERE t.id = $1 AND w.id = t.workspace_id AND w.user_id = $2
             RETURNING t.id`,
            [req.params.id, req.user!.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// Reorder tasks (move between columns)
router.post('/reorder', async (req: AuthRequest, res) => {
    try {
        const { task_id, new_status, new_position } = req.body;

        const result = await query(
            `UPDATE tasks t
             SET status = $1, position = $2, updated_at = NOW()
             FROM workspaces w
             WHERE t.id = $3 AND w.id = t.workspace_id AND w.user_id = $4`,
            [new_status, new_position, task_id, req.user!.id]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });

        res.json({ success: true });
    } catch (error) {
        console.error('Error reordering task:', error);
        res.status(500).json({ error: 'Failed to reorder task' });
    }
});

// Add comment
router.post('/:id/comments', async (req: AuthRequest, res) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: 'Content is required' });

        const result = await query(
            `INSERT INTO task_comments (task_id, user_id, content)
             SELECT $1, $2, $3
             WHERE EXISTS (
               SELECT 1
               FROM tasks t
               JOIN workspaces w ON w.id = t.workspace_id
               WHERE t.id = $1 AND w.user_id = $2
             )
             RETURNING *`,
            [req.params.id, req.user!.id, content]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
        res.status(201).json({ comment: result.rows[0] });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

export default router;
