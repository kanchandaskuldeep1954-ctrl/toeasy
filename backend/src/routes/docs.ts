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
        const workspaceId = req.query.workspace_id || req.user?.active_workspace_id;
        const parent_id = req.query.parent_id as string | undefined;
        const starred = req.query.starred as string | undefined;

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
        const docResult = await query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
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
        const wsId = workspace_id || req.user?.active_workspace_id;

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
            `UPDATE documents SET
                title = COALESCE($1, title),
                icon = COALESCE($2, icon),
                cover_image = COALESCE($3, cover_image),
                is_starred = COALESCE($4, is_starred),
                is_archived = COALESCE($5, is_archived),
                updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [
                title || null,
                icon !== undefined ? icon : null,
                cover_image !== undefined ? cover_image : null,
                is_starred !== undefined ? is_starred : null,
                is_archived !== undefined ? is_archived : null,
                req.params.id
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
        await query('DELETE FROM documents WHERE id = $1', [req.params.id]);
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
