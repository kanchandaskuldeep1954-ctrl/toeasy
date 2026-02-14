/**
 * Chat Routes - Channels, Messages, Reactions
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware  
router.use(authenticateToken);

// ===== CHANNELS =====

// Get all channels for workspace
router.get('/channels', async (req: AuthRequest, res) => {
    try {
        const workspaceId = req.query.workspace_id as string | undefined;
        if (!workspaceId) {
            return res.status(400).json({ error: 'workspace_id is required' });
        }

        const wsCheck = await query('SELECT id FROM workspaces WHERE id = $1 AND user_id = $2', [workspaceId, req.user!.id]);
        if (wsCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        const result = await query(
            `SELECT * FROM channels WHERE workspace_id = $1 AND is_archived = false ORDER BY created_at ASC`,
            [workspaceId]
        );
        const channels = result.rows;

        if (channels.length === 0) {
            // Bootstrap a default channel so the module works out-of-the-box.
            const created = await query(
                `INSERT INTO channels (workspace_id, name, description, type, created_by)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [workspaceId, 'general', 'Default channel', 'public', req.user!.id]
            );

            const channel = created.rows[0];
            await query(
                'INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (channel_id, user_id) DO NOTHING',
                [channel.id, req.user!.id, 'owner']
            );

            return res.json({ channels: [{ ...channel, unread: 0 }] });
        }

        // Get unread counts
        const membershipsResult = await query(
            `SELECT channel_id, last_read_at FROM channel_members WHERE user_id = $1 AND channel_id = ANY($2)`,
            [req.user?.id, channels.map((c: any) => c.id)]
        );
        const membershipMap = Object.fromEntries(membershipsResult.rows.map((m: any) => [m.channel_id, m.last_read_at]));

        const channelsWithUnread = await Promise.all(channels.map(async (c: any) => {
            const lastRead = membershipMap[c.id];
            let unreadCount = 0;
            if (lastRead) {
                const unreadResult = await query(
                    'SELECT COUNT(*) as count FROM messages WHERE channel_id = $1 AND created_at > $2',
                    [c.id, lastRead]
                );
                unreadCount = parseInt(unreadResult.rows[0]?.count || '0');
            }
            return { ...c, unread: unreadCount };
        }));

        res.json({ channels: channelsWithUnread });
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
});

// Create channel
router.post('/channels', async (req: AuthRequest, res) => {
    try {
        const { name, description, type, workspace_id } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const wsId = workspace_id;
        if (!wsId) {
            return res.status(400).json({ error: 'workspace_id is required' });
        }

        const wsCheck = await query('SELECT id FROM workspaces WHERE id = $1 AND user_id = $2', [wsId, req.user!.id]);
        if (wsCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        const result = await query(
            `INSERT INTO channels (workspace_id, name, description, type, created_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [wsId, name, description || null, type || 'public', req.user?.id]
        );

        const channel = result.rows[0];

        // Add creator as owner
        await query(
            'INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (channel_id, user_id) DO NOTHING',
            [channel.id, req.user?.id, 'owner']
        );

        res.status(201).json({ channel });
    } catch (error) {
        console.error('Error creating channel:', error);
        res.status(500).json({ error: 'Failed to create channel' });
    }
});

// ===== MESSAGES =====

// Get messages for channel
router.get('/channels/:channelId/messages', async (req: AuthRequest, res) => {
    try {
        const channelAccess = await query(
            `SELECT c.id
             FROM channels c
             JOIN workspaces w ON w.id = c.workspace_id
             WHERE c.id = $1 AND w.user_id = $2`,
            [req.params.channelId, req.user!.id]
        );
        if (channelAccess.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });

        const limit = parseInt(req.query.limit as string) || 50;
        const before = req.query.before as string | undefined;

        let sql = `SELECT * FROM messages WHERE channel_id = $1 AND is_deleted = false AND parent_id IS NULL`;
        const params: any[] = [req.params.channelId];
        let paramIdx = 2;

        if (before) {
            sql += ` AND created_at < $${paramIdx++}`;
            params.push(before);
        }

        sql += ` ORDER BY created_at DESC LIMIT $${paramIdx}`;
        params.push(limit);

        const result = await query(sql, params);
        const messages = result.rows;

        // Get user info
        const userIds = [...new Set(messages.map((m: any) => m.user_id))];
        let users: any[] = [];
        if (userIds.length > 0) {
            const userResult = await query(
                'SELECT id, full_name, email FROM users WHERE id = ANY($1)',
                [userIds]
            );
            users = userResult.rows;
        }
        const userMap = Object.fromEntries(users.map(u => [u.id, u]));

        // Get thread counts
        let threadMap: Record<string, number> = {};
        if (messages.length > 0) {
            const threadResult = await query(
                `SELECT parent_id, COUNT(*) as count FROM messages WHERE parent_id = ANY($1) GROUP BY parent_id`,
                [messages.map((m: any) => m.id)]
            );
            threadMap = Object.fromEntries(threadResult.rows.map((t: any) => [t.parent_id, parseInt(t.count)]));
        }

        const messagesWithUsers = messages.map((m: any) => ({
            ...m,
            user: userMap[m.user_id],
            threadCount: threadMap[m.id] || 0,
            reactions: typeof m.reactions === 'string' ? JSON.parse(m.reactions) : (m.reactions || {}),
            attachments: typeof m.attachments === 'string' ? JSON.parse(m.attachments) : (m.attachments || [])
        }));

        // Update last read (upsert membership if missing)
        await query(
            `INSERT INTO channel_members (channel_id, user_id, role, last_read_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
            [req.params.channelId, req.user!.id, 'member']
        );

        res.json({ messages: messagesWithUsers.reverse() });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Send message
router.post('/channels/:channelId/messages', async (req: AuthRequest, res) => {
    try {
        const channelAccess = await query(
            `SELECT c.id
             FROM channels c
             JOIN workspaces w ON w.id = c.workspace_id
             WHERE c.id = $1 AND w.user_id = $2`,
            [req.params.channelId, req.user!.id]
        );
        if (channelAccess.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });

        const { content, parent_id, attachments } = req.body;
        if (!content) return res.status(400).json({ error: 'Content is required' });

        const result = await query(
            `INSERT INTO messages (channel_id, user_id, content, parent_id, attachments)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.params.channelId, req.user?.id, content, parent_id || null, JSON.stringify(attachments || [])]
        );

        // Get user info
        const userResult = await query('SELECT id, full_name, email FROM users WHERE id = $1', [req.user?.id]);

        res.status(201).json({
            message: {
                ...result.rows[0],
                user: userResult.rows[0],
                reactions: {},
                attachments: attachments || []
            }
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Add reaction
router.post('/messages/:messageId/reactions', async (req: AuthRequest, res) => {
    try {
        const { emoji } = req.body;
        if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

        const msgResult = await query(
            `SELECT m.reactions
             FROM messages m
             JOIN channels c ON c.id = m.channel_id
             JOIN workspaces w ON w.id = c.workspace_id
             WHERE m.id = $1 AND w.user_id = $2`,
            [req.params.messageId, req.user!.id]
        );
        if (msgResult.rows.length === 0) return res.status(404).json({ error: 'Message not found' });

        let reactions = msgResult.rows[0].reactions;
        reactions = typeof reactions === 'string' ? JSON.parse(reactions) : (reactions || {});

        if (!reactions[emoji]) reactions[emoji] = [];
        if (!reactions[emoji].includes(req.user?.id)) {
            reactions[emoji].push(req.user?.id);
        }

        await query('UPDATE messages SET reactions = $1 WHERE id = $2', [JSON.stringify(reactions), req.params.messageId]);

        res.json({ reactions });
    } catch (error) {
        console.error('Error adding reaction:', error);
        res.status(500).json({ error: 'Failed to add reaction' });
    }
});

// Delete message
router.delete('/messages/:messageId', async (req: AuthRequest, res) => {
    try {
        await query(
            `UPDATE messages SET is_deleted = true, content = '[Message deleted]' WHERE id = $1 AND user_id = $2`,
            [req.params.messageId, req.user?.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

export default router;
