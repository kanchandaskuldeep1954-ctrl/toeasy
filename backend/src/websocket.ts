/**
 * ToEasy WebSocket Server
 * 
 * Real-time communication for:
 * - Chat messaging
 * - Live collaboration
 * - Presence indicators
 * - Real-time notifications
 */

import { Server, Socket } from 'socket.io';
import { query } from './db.js';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

// Types
interface Message {
    id: string;
    channelId: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: Date;
    replyTo?: string;
    attachments?: { type: string; url: string; name: string }[];
}

interface UserPresence {
    id: string;
    name: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    lastSeen: Date;
}

interface CursorPosition {
    x: number;
    y: number;
    element?: string;
}

/**
 * Setup WebSocket server for real-time features
 */
export function setupWebSocket(httpServer: any) {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || '*',
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Store active connections
    const userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>
    const roomParticipants = new Map<string, Set<string>>(); // roomId -> Set<userId>

    io.on('connection', (socket: Socket) => {
        console.log(`[WS] Client connected: ${socket.id}`);

        // --- Authentication ---
        socket.on('authenticate', async (data: { userId?: string; userName?: string; token?: string }) => {
            const token = data.token;
            if (!token) {
                socket.emit('auth-error', { error: 'Missing token' });
                socket.disconnect(true);
                return;
            }

            let decoded: any;
            try {
                decoded = jwt.verify(token, config.jwtSecret) as any;
            } catch (err: any) {
                socket.emit('auth-error', { error: 'Invalid or expired token', details: err?.message });
                socket.disconnect(true);
                return;
            }

            const authedUserId = String(decoded.userId || '');
            if (!authedUserId) {
                socket.emit('auth-error', { error: 'Invalid token payload' });
                socket.disconnect(true);
                return;
            }

            // Prefer DB full_name for display, fall back to token email.
            let userName = String(decoded.email || 'User');
            try {
                const u = await query('SELECT full_name, email FROM users WHERE id = $1', [authedUserId]);
                if (u.rows.length > 0) {
                    userName = u.rows[0].full_name || u.rows[0].email || userName;
                }
            } catch {
                // Non-fatal
            }

            socket.data.userId = authedUserId;
            socket.data.userName = userName;

            // Track user sockets
            if (!userSockets.has(authedUserId)) {
                userSockets.set(authedUserId, new Set());
            }
            userSockets.get(authedUserId)!.add(socket.id);

            // Broadcast presence
            io.emit('user-status-change', {
                userId: authedUserId,
                status: 'online'
            });

            console.log(`[WS] User authenticated: ${userName} (${authedUserId})`);
        });

        // --- Chat ---
        socket.on('join-channel', async (channelId: string) => {
            if (!socket.data.userId) {
                socket.emit('auth-error', { error: 'Not authenticated' });
                return;
            }

            const channelAccess = await query(
                `SELECT c.id
                 FROM channels c
                 JOIN workspaces w ON w.id = c.workspace_id
                 WHERE c.id = $1 AND w.user_id = $2`,
                [channelId, socket.data.userId]
            );
            if (channelAccess.rows.length === 0) {
                socket.emit('channel-error', { error: 'Channel not found' });
                return;
            }

            socket.join(`channel:${channelId}`);

            // Track participants
            if (!roomParticipants.has(channelId)) {
                roomParticipants.set(channelId, new Set());
            }
            roomParticipants.get(channelId)!.add(socket.data.userId);

            // Notify others
            socket.to(`channel:${channelId}`).emit('user-joined-channel', {
                userId: socket.data.userId,
                userName: socket.data.userName,
                channelId
            });

            console.log(`[WS] ${socket.data.userName} joined channel ${channelId}`);
        });

        socket.on('leave-channel', (channelId: string) => {
            if (!socket.data.userId) return;
            socket.leave(`channel:${channelId}`);
            roomParticipants.get(channelId)?.delete(socket.data.userId);

            socket.to(`channel:${channelId}`).emit('user-left-channel', {
                userId: socket.data.userId,
                channelId
            });
        });

        socket.on('send-message', async (data: {
            channelId: string;
            content: string;
            replyTo?: string;
            attachments?: any[];
            clientMessageId?: string;
        }, ack?: (payload: any) => void) => {
            try {
                if (!socket.data.userId) {
                    socket.emit('auth-error', { error: 'Not authenticated' });
                    if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated' });
                    return;
                }

                // Ensure the user owns the workspace for this channel (prevents cross-tenant writes).
                const channelAccess = await query(
                    `SELECT c.id
                     FROM channels c
                     JOIN workspaces w ON w.id = c.workspace_id
                     WHERE c.id = $1 AND w.user_id = $2`,
                    [data.channelId, socket.data.userId]
                );
                if (channelAccess.rows.length === 0) {
                    if (typeof ack === 'function') ack({ ok: false, error: 'Channel not found' });
                    return;
                }

                // Save message to database
                const result = await query(
                    `INSERT INTO messages (channel_id, user_id, content, parent_id, attachments)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [
                        data.channelId,
                        socket.data.userId,
                        data.content,
                        data.replyTo || null,
                        JSON.stringify(data.attachments || [])
                    ]
                );

                const savedMessage = result.rows[0];

                const message: Message = {
                    id: savedMessage.id,
                    channelId: data.channelId,
                    userId: socket.data.userId,
                    userName: socket.data.userName,
                    content: data.content,
                    timestamp: savedMessage.created_at,
                    replyTo: data.replyTo,
                    attachments: data.attachments
                };

                // Broadcast to channel
                io.to(`channel:${data.channelId}`).emit('new-message', {
                    ...message,
                    clientMessageId: data.clientMessageId
                });

                if (typeof ack === 'function') {
                    ack({ ok: true, message: { ...message, clientMessageId: data.clientMessageId } });
                }

                console.log(`[WS] Message saved & broadcast in ${data.channelId}: ${data.content.slice(0, 50)}...`);
            } catch (err) {
                console.error('[WS] Failed to save message:', err);
                socket.emit('message-error', { error: 'Failed to save message' });
                if (typeof ack === 'function') ack({ ok: false, error: 'Failed to save message' });
            }
        });

        socket.on('typing', (data: { channelId: string }) => {
            if (!socket.data.userId) return;
            if (!socket.rooms.has(`channel:${data.channelId}`)) return;
            socket.to(`channel:${data.channelId}`).emit('user-typing', {
                userId: socket.data.userId,
                userName: socket.data.userName,
                channelId: data.channelId
            });
        });

        socket.on('stop-typing', (data: { channelId: string }) => {
            if (!socket.data.userId) return;
            if (!socket.rooms.has(`channel:${data.channelId}`)) return;
            socket.to(`channel:${data.channelId}`).emit('user-stopped-typing', {
                userId: socket.data.userId,
                channelId: data.channelId
            });
        });

        socket.on('add-reaction', async (data: {
            messageId: string;
            channelId: string;
            emoji: string;
        }) => {
            try {
                if (!socket.data.userId) return;
                // Get current reactions
                const msgResult = await query(
                    `SELECT m.reactions
                     FROM messages m
                     JOIN channels c ON c.id = m.channel_id
                     JOIN workspaces w ON w.id = c.workspace_id
                     WHERE m.id = $1 AND m.channel_id = $2 AND w.user_id = $3`,
                    [data.messageId, data.channelId, socket.data.userId]
                );
                if (msgResult.rows.length === 0) return;

                let reactions = msgResult.rows[0].reactions;
                reactions = typeof reactions === 'string' ? JSON.parse(reactions) : (reactions || {});

                if (!reactions[data.emoji]) reactions[data.emoji] = [];
                if (!reactions[data.emoji].includes(socket.data.userId)) {
                    reactions[data.emoji].push(socket.data.userId);
                }

                await query('UPDATE messages SET reactions = $1 WHERE id = $2', [JSON.stringify(reactions), data.messageId]);

                io.to(`channel:${data.channelId}`).emit('reaction-added', {
                    messageId: data.messageId,
                    userId: socket.data.userId,
                    emoji: data.emoji,
                    reactions
                });
            } catch (err) {
                console.error('[WS] Failed to add reaction:', err);
            }
        });

        // --- Collaboration ---
        socket.on('join-document', (documentId: string) => {
            if (!socket.data.userId) return;
            socket.join(`doc:${documentId}`);

            socket.to(`doc:${documentId}`).emit('collaborator-joined', {
                userId: socket.data.userId,
                userName: socket.data.userName
            });
        });

        socket.on('cursor-move', (data: {
            documentId: string;
            position: CursorPosition;
        }) => {
            if (!socket.data.userId) return;
            socket.to(`doc:${data.documentId}`).emit('cursor-update', {
                userId: socket.data.userId,
                userName: socket.data.userName,
                position: data.position
            });
        });

        socket.on('document-change', (data: {
            documentId: string;
            changes: any;
            version: number;
        }) => {
            if (!socket.data.userId) return;
            socket.to(`doc:${data.documentId}`).emit('document-updated', {
                userId: socket.data.userId,
                changes: data.changes,
                version: data.version
            });
        });

        // --- Dashboard Collaboration ---
        socket.on('join-dashboard', (dashboardId: string) => {
            if (!socket.data.userId) return;
            socket.join(`dashboard:${dashboardId}`);
        });

        socket.on('chart-interaction', (data: {
            dashboardId: string;
            chartId: string;
            action: 'select' | 'filter' | 'drill';
            value: any;
        }) => {
            if (!socket.data.userId) return;
            socket.to(`dashboard:${data.dashboardId}`).emit('chart-interacted', {
                userId: socket.data.userId,
                ...data
            });
        });

        // --- Notifications ---
        socket.on('mark-notification-read', (notificationId: string) => {
            if (!socket.data.userId) return;
            // TODO: Update database
            socket.emit('notification-read', { id: notificationId });
        });

        // --- Presence ---
        socket.on('set-status', (status: 'online' | 'away' | 'busy') => {
            if (!socket.data.userId) return;
            io.emit('user-status-change', {
                userId: socket.data.userId,
                status
            });
        });

        // --- Disconnect ---
        socket.on('disconnect', () => {
            console.log(`[WS] Client disconnected: ${socket.id}`);

            // Remove from tracking
            if (socket.data.userId) {
                const userSocketSet = userSockets.get(socket.data.userId);
                if (userSocketSet) {
                    userSocketSet.delete(socket.id);

                    // If no more sockets, user is offline
                    if (userSocketSet.size === 0) {
                        userSockets.delete(socket.data.userId);
                        io.emit('user-status-change', {
                            userId: socket.data.userId,
                            status: 'offline'
                        });
                    }
                }
            }
        });
    });

    return io;
}

export default setupWebSocket;
