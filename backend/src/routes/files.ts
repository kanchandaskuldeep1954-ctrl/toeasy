/**
 * Files Routes - File and Folder Management
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware
router.use(authenticateToken);

// Get files and folders for workspace
router.get('/', async (req: AuthRequest, res) => {
    try {
        const workspaceId = req.query.workspace_id || req.user?.active_workspace_id;
        const folder_id = req.query.folder_id as string | undefined;
        const starred = req.query.starred as string | undefined;

        // Get folders
        let folderSql = `SELECT *, 'folder' as type FROM folders WHERE workspace_id = $1`;
        const folderParams: any[] = [workspaceId];
        let folderParamIdx = 2;

        if (folder_id) {
            folderSql += ` AND parent_id = $${folderParamIdx++}`;
            folderParams.push(folder_id);
        } else {
            folderSql += ` AND parent_id IS NULL`;
        }

        if (starred === 'true') {
            folderSql += ` AND is_starred = true`;
        }

        folderSql += ` ORDER BY name`;

        const foldersResult = await query(folderSql, folderParams);

        // Get files
        let fileSql = `SELECT *, 'file' as type FROM files WHERE workspace_id = $1`;
        const fileParams: any[] = [workspaceId];
        let fileParamIdx = 2;

        if (folder_id) {
            fileSql += ` AND folder_id = $${fileParamIdx++}`;
            fileParams.push(folder_id);
        } else {
            fileSql += ` AND folder_id IS NULL`;
        }

        if (starred === 'true') {
            fileSql += ` AND is_starred = true`;
        }

        fileSql += ` ORDER BY name`;

        const filesResult = await query(fileSql, fileParams);

        // Get uploader info
        const uploaderIds = [...new Set(filesResult.rows.map((f: any) => f.uploaded_by).filter(Boolean))];
        let uploaders: any[] = [];
        if (uploaderIds.length > 0) {
            const uploaderResult = await query(
                'SELECT id, full_name, email FROM users WHERE id = ANY($1)',
                [uploaderIds]
            );
            uploaders = uploaderResult.rows;
        }
        const uploaderMap = Object.fromEntries(uploaders.map(u => [u.id, u]));

        const filesWithUploaders = filesResult.rows.map((f: any) => ({
            ...f,
            uploader: f.uploaded_by ? uploaderMap[f.uploaded_by] : null
        }));

        res.json({
            folders: foldersResult.rows,
            files: filesWithUploaders
        });
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// Create folder
router.post('/folders', async (req: AuthRequest, res) => {
    try {
        const { name, parent_id, workspace_id } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const wsId = workspace_id || req.user?.active_workspace_id;

        const result = await query(
            `INSERT INTO folders (workspace_id, name, parent_id, created_by)
             VALUES ($1, $2, $3, $4) RETURNING *, 'folder' as type`,
            [wsId, name, parent_id || null, req.user?.id]
        );

        res.status(201).json({ folder: result.rows[0] });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// Update folder
router.put('/folders/:id', async (req: AuthRequest, res) => {
    try {
        const { name, parent_id, is_starred } = req.body;

        const result = await query(
            `UPDATE folders SET
                name = COALESCE($1, name),
                parent_id = COALESCE($2, parent_id),
                is_starred = COALESCE($3, is_starred),
                updated_at = NOW()
             WHERE id = $4 RETURNING *`,
            [
                name || null,
                parent_id !== undefined ? parent_id : null,
                is_starred !== undefined ? is_starred : null,
                req.params.id
            ]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Folder not found' });
        res.json({ folder: result.rows[0] });
    } catch (error) {
        console.error('Error updating folder:', error);
        res.status(500).json({ error: 'Failed to update folder' });
    }
});

// Delete folder
router.delete('/folders/:id', async (req: AuthRequest, res) => {
    try {
        await query('DELETE FROM folders WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

// ===== FILES =====

// Upload file (supports base64 data storage or cloud storage URL)
router.post('/upload', async (req: AuthRequest, res) => {
    try {
        const { name, mime_type, size, storage_key, storage_url, folder_id, workspace_id, file_data } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const wsId = workspace_id || req.user?.active_workspace_id;

        // For small files (< 5MB), we can store base64 data directly
        // For larger files, use storage_url pointing to S3/cloud
        const result = await query(
            `INSERT INTO files (workspace_id, folder_id, name, mime_type, size, storage_key, storage_url, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *, 'file' as type`,
            [
                wsId,
                folder_id || null,
                name,
                mime_type || null,
                size || null,
                storage_key || null,
                // Store base64 data as data URL if provided, otherwise use storage_url
                file_data ? `data:${mime_type || 'application/octet-stream'};base64,${file_data}` : (storage_url || null),
                req.user?.id
            ]
        );

        res.status(201).json({ file: result.rows[0] });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Update file
router.put('/:id', async (req: AuthRequest, res) => {
    try {
        const { name, folder_id, is_starred } = req.body;

        const result = await query(
            `UPDATE files SET
                name = COALESCE($1, name),
                folder_id = COALESCE($2, folder_id),
                is_starred = COALESCE($3, is_starred),
                updated_at = NOW()
             WHERE id = $4 RETURNING *`,
            [
                name || null,
                folder_id !== undefined ? folder_id : null,
                is_starred !== undefined ? is_starred : null,
                req.params.id
            ]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' });
        res.json({ file: result.rows[0] });
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ error: 'Failed to update file' });
    }
});

// Delete file
router.delete('/:id', async (req: AuthRequest, res) => {
    try {
        // TODO: Also delete from cloud storage
        await query('DELETE FROM files WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

export default router;
