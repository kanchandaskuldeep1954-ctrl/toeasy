/**
 * Docs Routes - Documents and Blocks CRUD
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware
router.use(authenticateToken);

// Get all documents for workspace
router.get('/', async (req: AuthRequest, res) => {
    try {
        const workspaceId = req.query.workspace_id as string | undefined;
        const parent_id = req.query.parent_id as string | undefined;
        const starred = req.query.starred as string | undefined;

        if (!workspaceId) {
            return res.status(400).json({ error: 'workspace_id is required' });
        }

        const wsCheck = await query('SELECT id FROM workspaces WHERE id = $1 AND user_id = $2', [workspaceId, req.user!.id]);
        if (wsCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        let sql = `SELECT * FROM documents WHERE workspace_id = $1 AND is_archived = false`;
        const params: any[] = [workspaceId];
        let paramIdx = 2;

        if (parent_id) {
            sql += ` AND parent_id = $${paramIdx++}`;
            params.push(parent_id);
        } else {
            sql += ` AND parent_id IS NULL`;
        }

        if (starred === 'true') {
            sql += ` AND is_starred = true`;
        }

        sql += ` ORDER BY updated_at DESC`;

        const result = await query(sql, params);
        res.json({ documents: result.rows });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Get single document with blocks
router.get('/:id', async (req: AuthRequest, res) => {
    try {
        const docResult = await query(
            `SELECT d.*
             FROM documents d
             JOIN workspaces w ON w.id = d.workspace_id
             WHERE d.id = $1 AND w.user_id = $2`,
            [req.params.id, req.user!.id]
        );
        if (docResult.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

        const blocksResult = await query(
            'SELECT * FROM document_blocks WHERE document_id = $1 ORDER BY position',
            [req.params.id]
        );

        const blocks = blocksResult.rows.map((b: any) => ({
            ...b,
            properties: typeof b.properties === 'string' ? JSON.parse(b.properties) : (b.properties || {})
        }));

        res.json({ document: { ...docResult.rows[0], blocks } });
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ error: 'Failed to fetch document' });
    }
});

// Create document
router.post('/', async (req: AuthRequest, res) => {
    try {
        const { title, icon, parent_id, workspace_id } = req.body;
        const wsId = workspace_id;

        if (!wsId) {
            return res.status(400).json({ error: 'workspace_id is required' });
        }

        const wsCheck = await query('SELECT id FROM workspaces WHERE id = $1 AND user_id = $2', [wsId, req.user!.id]);
        if (wsCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        const result = await query(
            `INSERT INTO documents (workspace_id, title, icon, parent_id, created_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [wsId, title || 'Untitled', icon || null, parent_id || null, req.user?.id]
        );

        const document = result.rows[0];

        // Create initial empty paragraph block
        await query(
            'INSERT INTO document_blocks (document_id, type, content, position) VALUES ($1, $2, $3, $4)',
            [document.id, 'paragraph', '', 0]
        );

        res.status(201).json({ document });
    } catch (error) {
        console.error('Error creating document:', error);
        res.status(500).json({ error: 'Failed to create document' });
    }
});

// Update document
router.put('/:id', async (req: AuthRequest, res) => {
    try {
        const { title, icon, cover_image, is_starred, is_archived } = req.body;

        const result = await query(
            `UPDATE documents d SET
                title = COALESCE($1, d.title),
                icon = COALESCE($2, d.icon),
                cover_image = COALESCE($3, d.cover_image),
                is_starred = COALESCE($4, d.is_starred),
                is_archived = COALESCE($5, d.is_archived),
                updated_at = NOW()
             FROM workspaces w
             WHERE d.id = $6 AND w.id = d.workspace_id AND w.user_id = $7
             RETURNING d.*`,
            [
                title || null,
                icon !== undefined ? icon : null,
                cover_image !== undefined ? cover_image : null,
                is_starred !== undefined ? is_starred : null,
                is_archived !== undefined ? is_archived : null,
                req.params.id,
                req.user!.id
            ]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
        res.json({ document: result.rows[0] });
    } catch (error) {
        console.error('Error updating document:', error);
        res.status(500).json({ error: 'Failed to update document' });
    }
});

// Delete document
router.delete('/:id', async (req: AuthRequest, res) => {
    try {
        const result = await query(
            `DELETE FROM documents d
             USING workspaces w
             WHERE d.id = $1 AND w.id = d.workspace_id AND w.user_id = $2
             RETURNING d.id`,
            [req.params.id, req.user!.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// ===== BLOCKS =====

// Update blocks (batch)
router.put('/:id/blocks', async (req: AuthRequest, res) => {
    try {
        const { blocks } = req.body;

        const accessResult = await query(
            `SELECT d.id
             FROM documents d
             JOIN workspaces w ON w.id = d.workspace_id
             WHERE d.id = $1 AND w.user_id = $2`,
            [req.params.id, req.user!.id]
        );
        if (accessResult.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

        // Delete existing blocks
        await query('DELETE FROM document_blocks WHERE document_id = $1', [req.params.id]);

        // Insert new blocks
        if (blocks && blocks.length > 0) {
            for (let idx = 0; idx < blocks.length; idx++) {
                const b = blocks[idx];
                await query(
                    `INSERT INTO document_blocks (document_id, type, content, properties, position)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [req.params.id, b.type, b.content || '', JSON.stringify(b.properties || {}), idx]
                );
            }
        }

        // Update document timestamp
        await query('UPDATE documents SET updated_at = NOW() WHERE id = $1', [req.params.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating blocks:', error);
        res.status(500).json({ error: 'Failed to update blocks' });
    }
});

export default router;
