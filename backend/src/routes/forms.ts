/**
 * Forms Routes - Form Builder and Responses
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ===== PUBLIC RESPONSES =====
// Public endpoint - no auth required for form submission.
// NOTE: The router is mounted without a global auth guard in `backend/src/index.ts`.
router.post('/:id/respond', async (req, res) => {
    try {
        const { answers } = req.body;

        const formResult = await query('SELECT status FROM forms WHERE id = $1', [req.params.id]);
        if (formResult.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
        if (formResult.rows[0].status !== 'published') {
            return res.status(400).json({ error: 'Form is not accepting responses' });
        }

        const result = await query(
            `INSERT INTO form_responses (form_id, answers, ip_address) VALUES ($1, $2, $3) RETURNING id`,
            [req.params.id, JSON.stringify(answers || {}), req.ip]
        );

        res.status(201).json({ success: true, response_id: result.rows[0].id });
    } catch (error) {
        console.error('Error submitting response:', error);
        res.status(500).json({ error: 'Failed to submit response' });
    }
});

// ===== AUTHENTICATED ADMIN =====
router.use(authenticateToken);

// Get all forms for workspace
router.get('/', async (req: AuthRequest, res) => {
    try {
        const workspaceId = req.query.workspace_id as string | undefined;
        const status = req.query.status as string | undefined;

        if (!workspaceId) {
            return res.status(400).json({ error: 'workspace_id is required' });
        }

        const wsCheck = await query('SELECT id FROM workspaces WHERE id = $1 AND user_id = $2', [workspaceId, req.user!.id]);
        if (wsCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        let sql = `SELECT * FROM forms WHERE workspace_id = $1`;
        const params: any[] = [workspaceId];
        let paramIdx = 2;

        if (status) {
            sql += ` AND status = $${paramIdx++}`;
            params.push(status);
        }

        sql += ` ORDER BY updated_at DESC`;

        const result = await query(sql, params);
        const forms = result.rows;

        // Get response counts
        const formIds = forms.map((f: any) => f.id);
        let responseCounts: any[] = [];
        if (formIds.length > 0) {
            const countResult = await query(
                `SELECT form_id, COUNT(*) as count FROM form_responses WHERE form_id = ANY($1) GROUP BY form_id`,
                [formIds]
            );
            responseCounts = countResult.rows;
        }
        const countMap = Object.fromEntries(responseCounts.map((r: any) => [r.form_id, parseInt(r.count)]));

        const formsWithCounts = forms.map((f: any) => ({
            ...f,
            responses: countMap[f.id] || 0,
            // Alias for frontend variants
            response_count: countMap[f.id] || 0,
            settings: typeof f.settings === 'string' ? JSON.parse(f.settings) : (f.settings || {})
        }));

        res.json({ forms: formsWithCounts });
    } catch (error) {
        console.error('Error fetching forms:', error);
        res.status(500).json({ error: 'Failed to fetch forms' });
    }
});

// Get single form with fields
router.get('/:id', async (req: AuthRequest, res) => {
    try {
        const formResult = await query(
            `SELECT f.*
             FROM forms f
             JOIN workspaces w ON w.id = f.workspace_id
             WHERE f.id = $1 AND w.user_id = $2`,
            [req.params.id, req.user!.id]
        );
        if (formResult.rows.length === 0) return res.status(404).json({ error: 'Form not found' });

        const fieldsResult = await query(
            'SELECT * FROM form_fields WHERE form_id = $1 ORDER BY position',
            [req.params.id]
        );

        const fields = fieldsResult.rows.map((f: any) => ({
            ...f,
            options: typeof f.options === 'string' ? JSON.parse(f.options) : (f.options || []),
            validation: typeof f.validation === 'string' ? JSON.parse(f.validation) : (f.validation || {})
        }));

        const countResult = await query(
            'SELECT COUNT(*) as count FROM form_responses WHERE form_id = $1',
            [req.params.id]
        );
        const responseCount = parseInt(countResult.rows[0]?.count || '0', 10);

        res.json({
            form: {
                ...formResult.rows[0],
                settings: typeof formResult.rows[0].settings === 'string'
                    ? JSON.parse(formResult.rows[0].settings)
                    : (formResult.rows[0].settings || {}),
                fields,
                responses: responseCount,
                response_count: responseCount
            }
        });
    } catch (error) {
        console.error('Error fetching form:', error);
        res.status(500).json({ error: 'Failed to fetch form' });
    }
});

// Create form
router.post('/', async (req: AuthRequest, res) => {
    try {
        const { title, description, workspace_id } = req.body;
        const wsId = workspace_id;

        if (!wsId) {
            return res.status(400).json({ error: 'workspace_id is required' });
        }

        const wsCheck = await query('SELECT id FROM workspaces WHERE id = $1 AND user_id = $2', [wsId, req.user!.id]);
        if (wsCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        const result = await query(
            `INSERT INTO forms (workspace_id, title, description, created_by, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [wsId, title || 'Untitled Form', description || null, req.user?.id, 'draft']
        );

        res.status(201).json({ form: { ...result.rows[0], fields: [], responses: 0, response_count: 0 } });
    } catch (error) {
        console.error('Error creating form:', error);
        res.status(500).json({ error: 'Failed to create form' });
    }
});

// Update form
router.put('/:id', async (req: AuthRequest, res) => {
    try {
        const { title, description, status, settings } = req.body;

        const result = await query(
            `UPDATE forms f SET
                title = COALESCE($1, f.title),
                description = COALESCE($2, f.description),
                status = COALESCE($3, f.status),
                settings = COALESCE($4, f.settings),
                updated_at = NOW()
             FROM workspaces w
             WHERE f.id = $5 AND w.id = f.workspace_id AND w.user_id = $6
             RETURNING f.*`,
            [
                title || null,
                description !== undefined ? description : null,
                status || null,
                settings !== undefined ? JSON.stringify(settings) : null,
                req.params.id,
                req.user!.id
            ]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
        res.json({ form: result.rows[0] });
    } catch (error) {
        console.error('Error updating form:', error);
        res.status(500).json({ error: 'Failed to update form' });
    }
});

// Delete form
router.delete('/:id', async (req: AuthRequest, res) => {
    try {
        const result = await query(
            `DELETE FROM forms f
             USING workspaces w
             WHERE f.id = $1 AND w.id = f.workspace_id AND w.user_id = $2
             RETURNING f.id`,
            [req.params.id, req.user!.id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting form:', error);
        res.status(500).json({ error: 'Failed to delete form' });
    }
});

// ===== FIELDS =====

// Update fields (batch)
router.put('/:id/fields', async (req: AuthRequest, res) => {
    try {
        const { fields } = req.body;

        const accessResult = await query(
            `SELECT f.id
             FROM forms f
             JOIN workspaces w ON w.id = f.workspace_id
             WHERE f.id = $1 AND w.user_id = $2`,
            [req.params.id, req.user!.id]
        );
        if (accessResult.rows.length === 0) return res.status(404).json({ error: 'Form not found' });

        // Delete existing fields
        await query('DELETE FROM form_fields WHERE form_id = $1', [req.params.id]);

        // Insert new fields
        if (fields && fields.length > 0) {
            for (let idx = 0; idx < fields.length; idx++) {
                const f = fields[idx];
                await query(
                    `INSERT INTO form_fields (form_id, type, label, placeholder, required, options, validation, position)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        req.params.id,
                        f.type,
                        f.label,
                        f.placeholder || null,
                        f.required || false,
                        JSON.stringify(f.options || []),
                        JSON.stringify(f.validation || {}),
                        idx
                    ]
                );
            }
        }

        await query('UPDATE forms SET updated_at = NOW() WHERE id = $1', [req.params.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating fields:', error);
        res.status(500).json({ error: 'Failed to update fields' });
    }
});

// ===== RESPONSES =====

// Get responses for form
router.get('/:id/responses', async (req: AuthRequest, res) => {
    try {
        const accessResult = await query(
            `SELECT f.id
             FROM forms f
             JOIN workspaces w ON w.id = f.workspace_id
             WHERE f.id = $1 AND w.user_id = $2`,
            [req.params.id, req.user!.id]
        );
        if (accessResult.rows.length === 0) return res.status(404).json({ error: 'Form not found' });

        const result = await query(
            'SELECT * FROM form_responses WHERE form_id = $1 ORDER BY created_at DESC',
            [req.params.id]
        );

        const responses = result.rows.map((r: any) => ({
            ...r,
            answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {})
        }));

        res.json({ responses });
    } catch (error) {
        console.error('Error fetching responses:', error);
        res.status(500).json({ error: 'Failed to fetch responses' });
    }
});

export default router;
