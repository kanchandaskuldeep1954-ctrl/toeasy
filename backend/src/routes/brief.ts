/**
 * Brief Routes — Weekly Decision Brief generation, approval, and retrieval
 * 
 * POST /:id/brief/generate   → Generate a new AI-powered weekly brief
 * POST /:id/brief/:briefId/approve → Approve a brief and auto-create action items
 * GET  /:id/brief/latest     → Get the most recent brief for a workspace
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { GroqService } from '../services/groq.service.js';

const router = Router();

// All brief routes require authentication
router.use(authenticateToken);

// ─────────────────────────────────────────────────────────────
// POST /:id/brief/generate
// Generate a new weekly decision brief from a dataset
// ─────────────────────────────────────────────────────────────
router.post('/:id/brief/generate', async (req: AuthRequest, res) => {
    try {
        const workspaceId = req.params.id;
        const { datasetId } = req.body;

        if (!datasetId) {
            return res.status(400).json({ error: 'datasetId is required' });
        }

        // Verify workspace ownership
        const wsCheck = await query(
            'SELECT id FROM workspaces WHERE id = $1 AND user_id = $2',
            [workspaceId, req.user!.id]
        );
        if (wsCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        // Fetch dataset
        const dsResult = await query(
            'SELECT * FROM datasets WHERE id = $1 AND workspace_id = $2',
            [datasetId, workspaceId]
        );
        if (dsResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dataset not found in this workspace' });
        }

        const dataset = dsResult.rows[0];
        const dataPayload = typeof dataset.data === 'string' ? JSON.parse(dataset.data) : dataset.data;
        const headers = typeof dataset.headers === 'string' ? JSON.parse(dataset.headers) : dataset.headers;

        // Generate brief via GroqService
        const brief = await GroqService.generateWeeklyBrief({
            headers: headers || Object.keys(dataPayload?.[0] || {}),
            data: Array.isArray(dataPayload) ? dataPayload : [],
            name: dataset.name || 'Dataset',
        });

        // Store brief in database (uses a simple JSON column approach for MVP)
        try {
            await query(
                `INSERT INTO briefs (workspace_id, dataset_id, user_id, brief_data, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
                [workspaceId, datasetId, req.user!.id, JSON.stringify(brief), 'pending_review']
            );
        } catch (dbErr: any) {
            // Table might not exist yet — that's fine for MVP, we still return the brief
            console.warn('[Brief] Could not persist brief to DB (table may not exist):', dbErr.message);
        }

        res.json({ brief });
    } catch (error: any) {
        console.error('Brief generation error:', error?.message || error);
        res.status(500).json({ error: 'Failed to generate brief' });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /:id/brief/:briefId/approve
// Approve brief and auto-create action items as tasks
// ─────────────────────────────────────────────────────────────
router.post('/:id/brief/:briefId/approve', async (req: AuthRequest, res) => {
    try {
        const workspaceId = req.params.id;
        const briefId = req.params.briefId;

        // Verify workspace ownership
        const wsCheck = await query(
            'SELECT id FROM workspaces WHERE id = $1 AND user_id = $2',
            [workspaceId, req.user!.id]
        );
        if (wsCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        // Update brief status
        try {
            await query(
                `UPDATE briefs SET status = 'approved', approved_at = NOW(), approved_by = $1
         WHERE id = $2 AND workspace_id = $3`,
                [req.user!.id, briefId, workspaceId]
            );
        } catch (dbErr: any) {
            console.warn('[Brief] Could not update brief status:', dbErr.message);
        }

        // Auto-create tasks from recommended actions (if brief data is provided in body)
        const { recommendedActions } = req.body;
        const createdTasks: any[] = [];

        if (Array.isArray(recommendedActions)) {
            for (const action of recommendedActions) {
                try {
                    // Get max position
                    const maxPosResult = await query(
                        'SELECT COALESCE(MAX(position), 0) as max FROM tasks WHERE workspace_id = $1 AND status = $2',
                        [workspaceId, 'todo']
                    );

                    const result = await query(
                        `INSERT INTO tasks (workspace_id, title, description, status, priority, created_by, tags, position)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
                        [
                            workspaceId,
                            action.title,
                            `${action.description || ''}\n\n📎 Evidence: ${action.evidenceReference || 'AI Brief'}`,
                            'todo',
                            action.priority || 'medium',
                            req.user!.id,
                            JSON.stringify(['from-brief', 'auto-created']),
                            (maxPosResult.rows[0]?.max || 0) + 1,
                        ]
                    );
                    createdTasks.push(result.rows[0]);
                } catch (taskErr: any) {
                    console.warn('[Brief] Failed to create task:', taskErr.message);
                }
            }
        }

        res.json({
            approved: true,
            briefId,
            tasksCreated: createdTasks.length,
            tasks: createdTasks,
        });
    } catch (error: any) {
        console.error('Brief approval error:', error?.message || error);
        res.status(500).json({ error: 'Failed to approve brief' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /:id/brief/latest
// Get the most recent brief for a workspace
// ─────────────────────────────────────────────────────────────
router.get('/:id/brief/latest', async (req: AuthRequest, res) => {
    try {
        const workspaceId = req.params.id;

        // Verify workspace ownership
        const wsCheck = await query(
            'SELECT id FROM workspaces WHERE id = $1 AND user_id = $2',
            [workspaceId, req.user!.id]
        );
        if (wsCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        try {
            const result = await query(
                `SELECT * FROM briefs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [workspaceId]
            );

            if (result.rows.length === 0) {
                return res.json({ brief: null });
            }

            const row = result.rows[0];
            const briefData = typeof row.brief_data === 'string' ? JSON.parse(row.brief_data) : row.brief_data;

            res.json({
                brief: {
                    id: row.id,
                    ...briefData,
                    status: row.status,
                    createdAt: row.created_at,
                    approvedAt: row.approved_at,
                },
            });
        } catch (dbErr: any) {
            // Table might not exist yet
            console.warn('[Brief] Could not fetch latest brief:', dbErr.message);
            res.json({ brief: null });
        }
    } catch (error: any) {
        console.error('Fetch latest brief error:', error?.message || error);
        res.status(500).json({ error: 'Failed to fetch latest brief' });
    }
});

export default router;
