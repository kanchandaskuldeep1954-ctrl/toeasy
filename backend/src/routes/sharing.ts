/**
 * Sharing Routes
 * 
 * Handles public share link generation and retrieval.
 * Key Design: Stores FROZEN SNAPSHOTS - no regeneration, no hallucination.
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// Generate a unique share token
function generateShareToken(): string {
    return crypto.randomBytes(16).toString('base64url');
}

/**
 * Create a new share link
 * POST /sharing/create
 * Body: { resourceType: 'dashboard' | 'report', resourceId: string, title: string, snapshot: object }
 */
router.post('/create', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { resourceType, resourceId, title, snapshot, workspaceId } = req.body;

        if (!resourceType || !['dashboard', 'report'].includes(resourceType)) {
            return res.status(400).json({ error: 'Invalid resource type. Must be "dashboard" or "report".' });
        }

        if (!resourceId || !title || !snapshot) {
            return res.status(400).json({ error: 'Missing required fields: resourceId, title, snapshot' });
        }

        const shareToken = generateShareToken();

        const result = await query(
            `INSERT INTO shared_links 
             (user_id, workspace_id, resource_type, resource_id, snapshot, share_token, title)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, share_token, created_at`,
            [req.user!.id, workspaceId, resourceType, resourceId, JSON.stringify(snapshot), shareToken, title]
        );

        const shareLink = result.rows[0];
        const origin = req.headers.origin || process.env.FRONTEND_URL || 'https://toeasy.vercel.app';
        const publicUrl = `${origin}/public/share/${shareLink.share_token}`;

        res.json({
            success: true,
            shareId: shareLink.id,
            shareToken: shareLink.share_token,
            publicUrl,
            createdAt: shareLink.created_at
        });

    } catch (err) {
        console.error('Create share link error:', err);
        res.status(500).json({ error: 'Failed to create share link' });
    }
});

/**
 * List user's shared links
 * GET /sharing/list
 */
router.get('/list', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const result = await query(
            `SELECT id, resource_type, resource_id, share_token, title, is_active, view_count, created_at
             FROM shared_links
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user!.id]
        );

        res.json(result.rows);

    } catch (err) {
        console.error('List shared links error:', err);
        res.status(500).json({ error: 'Failed to list shared links' });
    }
});

/**
 * Get public share content (NO AUTH REQUIRED)
 * GET /sharing/:token
 */
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Fetch the share link
        const result = await query(
            `SELECT id, resource_type, title, snapshot, is_active, expires_at
             FROM shared_links
             WHERE share_token = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Share link not found or expired' });
        }

        const shareLink = result.rows[0];

        // Check if active
        if (!shareLink.is_active) {
            return res.status(410).json({ error: 'This share link has been deactivated' });
        }

        // Check expiry
        if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
            return res.status(410).json({ error: 'This share link has expired' });
        }

        // Increment view count (fire and forget)
        query('UPDATE shared_links SET view_count = view_count + 1 WHERE id = $1', [shareLink.id]).catch(() => { });

        res.json({
            resourceType: shareLink.resource_type,
            title: shareLink.title,
            snapshot: shareLink.snapshot,
            viewedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error('Get share link error:', err);
        res.status(500).json({ error: 'Failed to retrieve shared content' });
    }
});

/**
 * Revoke/Delete a share link
 * DELETE /sharing/:token
 */
router.delete('/:token', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { token } = req.params;

        const result = await query(
            `DELETE FROM shared_links
             WHERE share_token = $1 AND user_id = $2
             RETURNING id`,
            [token, req.user!.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Share link not found or not owned by you' });
        }

        res.json({ success: true, message: 'Share link revoked' });

    } catch (err) {
        console.error('Delete share link error:', err);
        res.status(500).json({ error: 'Failed to revoke share link' });
    }
});

export default router;
