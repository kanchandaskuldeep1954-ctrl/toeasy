/**
 * Chat Routes - Channels, Messages, Reactions, Decision Room Context
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware
router.use(authenticateToken);

let decisionRoomContextTableExists: boolean | null = null;

const normalizeInt = (value: any): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const slugify = (value: string) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 36);

const parseJsonMaybe = <T = any>(value: any, fallback: T): T => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value as T;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
};

const buildRoomChannelName = (roomId: number, roomName: string) => {
    const safeSlug = slugify(roomName || 'decision-room');
    return `room-${roomId}-${safeSlug || 'decision-room'}`;
};

const humanizeEventType = (eventType: string) =>
    String(eventType || '')
        .replace(/^decision_room_/i, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());

async function canAccessWorkspace(workspaceId: number, userId: number): Promise<boolean> {
    if (!Number.isFinite(workspaceId) || workspaceId <= 0 || !Number.isFinite(userId) || userId <= 0) {
        return false;
    }

    const result = await query(
        `
        SELECT w.id
        FROM workspaces w
        LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
        WHERE w.id = $1
          AND (w.user_id = $2 OR wm.user_id = $2)
        LIMIT 1
        `,
        [workspaceId, userId]
    );

    return result.rows.length > 0;
}

async function getChannelForUser(channelId: string, userId: number) {
    const result = await query(
        `
        SELECT c.*
        FROM channels c
        JOIN workspaces w ON w.id = c.workspace_id
        LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
        WHERE c.id = $1
          AND (w.user_id = $2 OR wm.user_id = $2)
        LIMIT 1
        `,
        [channelId, userId]
    );
    return result.rows[0] || null;
}

async function hasDecisionRoomContextTable(): Promise<boolean> {
    if (decisionRoomContextTableExists !== null) return decisionRoomContextTableExists;
    try {
        const result = await query(`SELECT to_regclass('public.decision_room_chat_channels') AS table_name`);
        decisionRoomContextTableExists = Boolean(result.rows[0]?.table_name);
    } catch {
        decisionRoomContextTableExists = false;
    }
    return decisionRoomContextTableExists;
}

async function ensureChannelMember(channelId: string, userId: number, role: 'owner' | 'admin' | 'member' = 'member') {
    await query(
        `
        INSERT INTO channel_members (channel_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (channel_id, user_id) DO NOTHING
        `,
        [channelId, userId, role]
    );
}

async function getDecisionRoomRow(workspaceId: number, roomId: number) {
    const result = await query(
        `
        SELECT
          r.id,
          r.name,
          r.stage,
          r.project_id,
          r.run_context,
          r.updated_at,
          p.name AS project_name
        FROM analysis_rooms r
        LEFT JOIN projects p ON p.id = r.project_id
        WHERE r.workspace_id = $1
          AND r.id = $2
          AND r.is_archived = false
        LIMIT 1
        `,
        [workspaceId, roomId]
    );
    return result.rows[0] || null;
}

async function findRoomContextChannel(workspaceId: number, roomId: number) {
    const tableReady = await hasDecisionRoomContextTable();
    if (tableReady) {
        const mapped = await query(
            `
            SELECT c.*, m.project_id AS context_project_id, m.room_id AS context_room_id
            FROM decision_room_chat_channels m
            JOIN channels c ON c.id = m.channel_id
            WHERE m.workspace_id = $1
              AND m.room_id = $2
              AND c.is_archived = false
            LIMIT 1
            `,
            [workspaceId, roomId]
        );
        if (mapped.rows.length > 0) {
            return mapped.rows[0];
        }
    }

    // Fallback when mapping table is not available yet.
    const fallback = await query(
        `
        SELECT c.*, NULL::int AS context_project_id, NULL::int AS context_room_id
        FROM channels c
        WHERE c.workspace_id = $1
          AND c.is_archived = false
          AND (
            c.description ILIKE $2
            OR c.name ILIKE $3
          )
        ORDER BY c.created_at DESC
        LIMIT 1
        `,
        [workspaceId, `%[room:${roomId}]%`, `room-${roomId}-%`]
    );
    return fallback.rows[0] || null;
}

async function ensureRoomContextChannel(workspaceId: number, roomId: number, userId: number) {
    const room = await getDecisionRoomRow(workspaceId, roomId);
    if (!room) return null;

    const existing = await findRoomContextChannel(workspaceId, roomId);
    if (existing) {
        await ensureChannelMember(existing.id, userId, 'member');
        return { channel: existing, created: false, room };
    }

    const name = buildRoomChannelName(roomId, String(room.name || 'decision-room'));
    const description = `[room:${roomId}] Decision Room context channel for "${room.name}"`;

    const created = await query(
        `
        INSERT INTO channels (workspace_id, name, description, type, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [workspaceId, name, description, 'public', userId]
    );

    const channel = created.rows[0];
    await ensureChannelMember(channel.id, userId, 'owner');

    const tableReady = await hasDecisionRoomContextTable();
    if (tableReady) {
        await query(
            `
            INSERT INTO decision_room_chat_channels (workspace_id, project_id, room_id, channel_id, created_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (workspace_id, room_id) DO UPDATE
              SET channel_id = EXCLUDED.channel_id,
                  project_id = EXCLUDED.project_id,
                  updated_at = NOW()
            `,
            [workspaceId, room.project_id || null, roomId, channel.id, userId]
        );
    }

    return {
        channel: {
            ...channel,
            context_project_id: room.project_id || null,
            context_room_id: roomId
        },
        created: true,
        room
    };
}

async function getRoomContextPayload(workspaceId: number, roomId: number) {
    const room = await getDecisionRoomRow(workspaceId, roomId);
    if (!room) return null;

    const artifactCountsResult = await query(
        `
        SELECT artifact_type, COUNT(*)::int AS count
        FROM artifacts
        WHERE workspace_id = $1
          AND room_id = $2
        GROUP BY artifact_type
        `,
        [workspaceId, roomId]
    );

    const artifactCounts: Record<string, number> = {};
    artifactCountsResult.rows.forEach((row: any) => {
        artifactCounts[String(row.artifact_type)] = normalizeInt(row.count);
    });

    const approvalsResult = await query(
        `
        SELECT COUNT(*)::int AS count
        FROM approval_requests
        WHERE workspace_id = $1
          AND room_id = $2
          AND status = 'pending'
        `,
        [workspaceId, roomId]
    );

    const latestReportResult = await query(
        `
        SELECT payload->>'bundleId' AS bundle_id, created_at
        FROM artifacts
        WHERE workspace_id = $1
          AND room_id = $2
          AND artifact_type = 'report_block'
          AND payload->>'reportVersion' = 'v2'
          AND payload ? 'bundleId'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [workspaceId, roomId]
    );

    const analyticsResult = await query(
        `
        SELECT event_type, metadata, created_at
        FROM analytics_events
        WHERE workspace_id = $1
          AND room_id = $2
        ORDER BY created_at DESC
        LIMIT 8
        `,
        [workspaceId, roomId]
    );

    const statusAndSyncStats = await query(
        `
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'decision_room_status_draft_generated')::int AS status_drafts,
          COUNT(*) FILTER (WHERE event_type = 'decision_room_actions_synced')::int AS actions_synced
        FROM analytics_events
        WHERE workspace_id = $1
          AND room_id = $2
        `,
        [workspaceId, roomId]
    );

    const contextChannel = await findRoomContextChannel(workspaceId, roomId);
    const runContext = parseJsonMaybe<Record<string, any>>(room.run_context, {});

    return {
        workspaceId,
        room: {
            id: normalizeInt(room.id),
            name: String(room.name || `Room ${roomId}`),
            stage: String(room.stage || 'ingest'),
            projectId: room.project_id ? normalizeInt(room.project_id) : null,
            projectName: room.project_name ? String(room.project_name) : null,
            datasetId: runContext.datasetId ? normalizeInt(runContext.datasetId) : null,
            updatedAt: room.updated_at
        },
        summary: {
            artifactsByType: artifactCounts,
            queryRuns: artifactCounts.query_run || 0,
            pivots: artifactCounts.pivot || 0,
            charts: artifactCounts.chart || 0,
            reports: artifactCounts.report_block || 0,
            actions: artifactCounts.action_item || 0,
            pendingApprovals: normalizeInt(approvalsResult.rows[0]?.count || 0),
            latestReportBundleId: latestReportResult.rows[0]?.bundle_id || null,
            latestReportGeneratedAt: latestReportResult.rows[0]?.created_at || null,
            statusDraftCount: normalizeInt(statusAndSyncStats.rows[0]?.status_drafts || 0),
            actionSyncCount: normalizeInt(statusAndSyncStats.rows[0]?.actions_synced || 0)
        },
        recentEvents: analyticsResult.rows.map((row: any) => ({
            eventType: String(row.event_type),
            label: humanizeEventType(String(row.event_type)),
            metadata: parseJsonMaybe(row.metadata, {}),
            createdAt: row.created_at
        })),
        channel: contextChannel
            ? {
                id: contextChannel.id,
                name: contextChannel.name,
                description: contextChannel.description,
                type: contextChannel.type,
                contextProjectId: contextChannel.context_project_id
                    ? normalizeInt(contextChannel.context_project_id)
                    : null,
                contextRoomId: contextChannel.context_room_id
                    ? normalizeInt(contextChannel.context_room_id)
                    : null
            }
            : null
    };
}

function buildContextUpdateMessage(payload: any): string {
    const room = payload?.room || {};
    const summary = payload?.summary || {};
    const recentEvents = Array.isArray(payload?.recentEvents) ? payload.recentEvents.slice(0, 3) : [];

    const lines: string[] = [
        `Decision Room Update: ${room.name || 'Room'} (stage: ${room.stage || 'unknown'})`,
        `Project: ${room.projectName || 'Not set'}`,
        `Artifacts -> runs: ${summary.queryRuns || 0}, pivots: ${summary.pivots || 0}, charts: ${summary.charts || 0}, reports: ${summary.reports || 0}, actions: ${summary.actions || 0}`,
        `Pending approvals: ${summary.pendingApprovals || 0}`,
        `Latest report bundle: ${summary.latestReportBundleId || 'none'}`,
        `Status drafts generated: ${summary.statusDraftCount || 0} | Action sync count: ${summary.actionSyncCount || 0}`
    ];

    if (recentEvents.length > 0) {
        lines.push('Recent activity:');
        recentEvents.forEach((event: any) => {
            const ts = event.createdAt ? new Date(event.createdAt).toLocaleString() : 'unknown time';
            lines.push(`- ${event.label} (${ts})`);
        });
    }

    return lines.join('\n');
}

// ===== CHANNELS =====

// Get all channels for workspace
router.get('/channels', async (req: AuthRequest, res) => {
    try {
        const workspaceId = normalizeInt(req.query.workspace_id as string | undefined);
        const userId = normalizeInt(req.user?.id);

        if (!workspaceId) {
            return res.status(400).json({ error: 'workspace_id is required' });
        }

        if (!(await canAccessWorkspace(workspaceId, userId))) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        const tableReady = await hasDecisionRoomContextTable();
        const result = tableReady
            ? await query(
                `
                SELECT
                  c.*,
                  m.room_id AS context_room_id,
                  m.project_id AS context_project_id
                FROM channels c
                LEFT JOIN decision_room_chat_channels m ON m.channel_id = c.id
                WHERE c.workspace_id = $1
                  AND c.is_archived = false
                ORDER BY c.created_at ASC
                `,
                [workspaceId]
            )
            : await query(
                `
                SELECT
                  c.*,
                  NULL::int AS context_room_id,
                  NULL::int AS context_project_id
                FROM channels c
                WHERE c.workspace_id = $1
                  AND c.is_archived = false
                ORDER BY c.created_at ASC
                `,
                [workspaceId]
            );

        const channels = result.rows;

        if (channels.length === 0) {
            // Bootstrap default channel for empty workspace.
            const created = await query(
                `
                INSERT INTO channels (workspace_id, name, description, type, created_by)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
                `,
                [workspaceId, 'general', 'Default channel', 'public', userId]
            );

            const channel = created.rows[0];
            await ensureChannelMember(channel.id, userId, 'owner');

            return res.json({
                channels: [{
                    ...channel,
                    unread: 0,
                    context_room_id: null,
                    context_project_id: null
                }]
            });
        }

        const membershipsResult = await query(
            `
            SELECT channel_id, last_read_at
            FROM channel_members
            WHERE user_id = $1
              AND channel_id = ANY($2)
            `,
            [userId, channels.map((channel: any) => channel.id)]
        );
        const membershipMap = Object.fromEntries(membershipsResult.rows.map((row: any) => [row.channel_id, row.last_read_at]));

        const channelsWithUnread = await Promise.all(channels.map(async (channel: any) => {
            const lastRead = membershipMap[channel.id];
            let unreadCount = 0;
            if (lastRead) {
                const unreadResult = await query(
                    'SELECT COUNT(*)::int AS count FROM messages WHERE channel_id = $1 AND created_at > $2',
                    [channel.id, lastRead]
                );
                unreadCount = normalizeInt(unreadResult.rows[0]?.count || 0);
            }
            return { ...channel, unread: unreadCount };
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
        const workspaceId = normalizeInt(workspace_id);
        const userId = normalizeInt(req.user?.id);

        if (!name) return res.status(400).json({ error: 'Name is required' });
        if (!workspaceId) return res.status(400).json({ error: 'workspace_id is required' });

        if (!(await canAccessWorkspace(workspaceId, userId))) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        const created = await query(
            `
            INSERT INTO channels (workspace_id, name, description, type, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [workspaceId, String(name), description || null, type || 'public', userId]
        );

        const channel = created.rows[0];
        await ensureChannelMember(channel.id, userId, 'owner');

        res.status(201).json({ channel });
    } catch (error) {
        console.error('Error creating channel:', error);
        res.status(500).json({ error: 'Failed to create channel' });
    }
});

// ===== DECISION ROOM CONTEXT =====

router.get('/workspaces/:workspaceId/rooms/:roomId/context', async (req: AuthRequest, res) => {
    try {
        const workspaceId = normalizeInt(req.params.workspaceId);
        const roomId = normalizeInt(req.params.roomId);
        const userId = normalizeInt(req.user?.id);

        if (!workspaceId || !roomId) {
            return res.status(400).json({ error: 'workspaceId and roomId are required' });
        }

        if (!(await canAccessWorkspace(workspaceId, userId))) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        const context = await getRoomContextPayload(workspaceId, roomId);
        if (!context) {
            return res.status(404).json({ error: 'Decision room not found' });
        }

        return res.json(context);
    } catch (error) {
        console.error('Error loading room chat context:', error);
        return res.status(500).json({ error: 'Failed to load room chat context' });
    }
});

router.post('/workspaces/:workspaceId/rooms/:roomId/context/channel', async (req: AuthRequest, res) => {
    try {
        const workspaceId = normalizeInt(req.params.workspaceId);
        const roomId = normalizeInt(req.params.roomId);
        const userId = normalizeInt(req.user?.id);
        const autoPostSummary = Boolean(req.body?.autoPostSummary);

        if (!workspaceId || !roomId) {
            return res.status(400).json({ error: 'workspaceId and roomId are required' });
        }
        if (!(await canAccessWorkspace(workspaceId, userId))) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        const ensured = await ensureRoomContextChannel(workspaceId, roomId, userId);
        if (!ensured) {
            return res.status(404).json({ error: 'Decision room not found' });
        }

        if (autoPostSummary) {
            const context = await getRoomContextPayload(workspaceId, roomId);
            if (context) {
                const message = buildContextUpdateMessage(context);
                await query(
                    `
                    INSERT INTO messages (channel_id, user_id, content, parent_id, attachments)
                    VALUES ($1, $2, $3, $4, $5)
                    `,
                    [ensured.channel.id, userId, message, null, JSON.stringify([])]
                );
            }
        }

        return res.status(ensured.created ? 201 : 200).json({
            channel: ensured.channel,
            created: ensured.created,
            room: {
                id: normalizeInt(ensured.room.id),
                name: String(ensured.room.name || ''),
                stage: String(ensured.room.stage || 'ingest'),
                projectId: ensured.room.project_id ? normalizeInt(ensured.room.project_id) : null
            }
        });
    } catch (error) {
        console.error('Error ensuring room context channel:', error);
        return res.status(500).json({ error: 'Failed to ensure room context channel' });
    }
});

router.post('/workspaces/:workspaceId/rooms/:roomId/context/publish', async (req: AuthRequest, res) => {
    try {
        const workspaceId = normalizeInt(req.params.workspaceId);
        const roomId = normalizeInt(req.params.roomId);
        const userId = normalizeInt(req.user?.id);
        const requestedChannelId = String(req.body?.channelId || '').trim();

        if (!workspaceId || !roomId) {
            return res.status(400).json({ error: 'workspaceId and roomId are required' });
        }
        if (!(await canAccessWorkspace(workspaceId, userId))) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        const context = await getRoomContextPayload(workspaceId, roomId);
        if (!context) {
            return res.status(404).json({ error: 'Decision room not found' });
        }

        let channel: any = null;
        if (requestedChannelId) {
            channel = await getChannelForUser(requestedChannelId, userId);
            if (!channel || normalizeInt(channel.workspace_id) !== workspaceId) {
                return res.status(404).json({ error: 'Channel not found in this workspace' });
            }
        } else {
            const ensured = await ensureRoomContextChannel(workspaceId, roomId, userId);
            if (!ensured) {
                return res.status(404).json({ error: 'Decision room not found' });
            }
            channel = ensured.channel;
        }

        await ensureChannelMember(channel.id, userId, 'member');
        const content = buildContextUpdateMessage(context);

        const inserted = await query(
            `
            INSERT INTO messages (channel_id, user_id, content, parent_id, attachments)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [channel.id, userId, content, null, JSON.stringify([])]
        );

        const userResult = await query(
            `SELECT id, full_name, email FROM users WHERE id = $1 LIMIT 1`,
            [userId]
        );

        return res.status(201).json({
            message: {
                ...inserted.rows[0],
                user: userResult.rows[0] || null,
                reactions: {},
                attachments: []
            },
            context
        });
    } catch (error) {
        console.error('Error publishing room context update:', error);
        return res.status(500).json({ error: 'Failed to publish room context update' });
    }
});

// ===== MESSAGES =====

// Get messages for channel
router.get('/channels/:channelId/messages', async (req: AuthRequest, res) => {
    try {
        const userId = normalizeInt(req.user?.id);
        const channel = await getChannelForUser(req.params.channelId, userId);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });

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

        const userIds = [...new Set(messages.map((message: any) => message.user_id))];
        let users: any[] = [];
        if (userIds.length > 0) {
            const userResult = await query(
                'SELECT id, full_name, email FROM users WHERE id = ANY($1)',
                [userIds]
            );
            users = userResult.rows;
        }
        const userMap = Object.fromEntries(users.map((user) => [user.id, user]));

        let threadMap: Record<string, number> = {};
        if (messages.length > 0) {
            const threadResult = await query(
                `SELECT parent_id, COUNT(*)::int AS count FROM messages WHERE parent_id = ANY($1) GROUP BY parent_id`,
                [messages.map((message: any) => message.id)]
            );
            threadMap = Object.fromEntries(threadResult.rows.map((thread: any) => [thread.parent_id, normalizeInt(thread.count)]));
        }

        const messagesWithUsers = messages.map((message: any) => ({
            ...message,
            user: userMap[message.user_id],
            threadCount: threadMap[message.id] || 0,
            reactions: typeof message.reactions === 'string' ? JSON.parse(message.reactions) : (message.reactions || {}),
            attachments: typeof message.attachments === 'string' ? JSON.parse(message.attachments) : (message.attachments || [])
        }));

        await query(
            `
            INSERT INTO channel_members (channel_id, user_id, role, last_read_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
            `,
            [req.params.channelId, userId, 'member']
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
        const userId = normalizeInt(req.user?.id);
        const channel = await getChannelForUser(req.params.channelId, userId);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });

        const { content, parent_id, attachments } = req.body;
        if (!content) return res.status(400).json({ error: 'Content is required' });

        const inserted = await query(
            `
            INSERT INTO messages (channel_id, user_id, content, parent_id, attachments)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [req.params.channelId, userId, content, parent_id || null, JSON.stringify(attachments || [])]
        );

        const userResult = await query('SELECT id, full_name, email FROM users WHERE id = $1', [userId]);

        res.status(201).json({
            message: {
                ...inserted.rows[0],
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
        const userId = normalizeInt(req.user?.id);
        const { emoji } = req.body;
        if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

        const messageResult = await query(
            `
            SELECT m.reactions
            FROM messages m
            JOIN channels c ON c.id = m.channel_id
            JOIN workspaces w ON w.id = c.workspace_id
            LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
            WHERE m.id = $1
              AND (w.user_id = $2 OR wm.user_id = $2)
            LIMIT 1
            `,
            [req.params.messageId, userId]
        );
        if (messageResult.rows.length === 0) return res.status(404).json({ error: 'Message not found' });

        let reactions = messageResult.rows[0].reactions;
        reactions = typeof reactions === 'string' ? JSON.parse(reactions) : (reactions || {});

        if (!reactions[emoji]) reactions[emoji] = [];
        if (!reactions[emoji].includes(userId)) {
            reactions[emoji].push(userId);
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
        const userId = normalizeInt(req.user?.id);
        await query(
            `UPDATE messages SET is_deleted = true, content = '[Message deleted]' WHERE id = $1 AND user_id = $2`,
            [req.params.messageId, userId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

export default router;
