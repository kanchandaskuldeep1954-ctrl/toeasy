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
        socket.on('authenticate', (data: { userId: string; userName: string; token?: string }) => {
            socket.data.userId = data.userId;
            socket.data.userName = data.userName;

            // Track user sockets
            if (!userSockets.has(data.userId)) {
                userSockets.set(data.userId, new Set());
            }
            userSockets.get(data.userId)!.add(socket.id);

            // Broadcast presence
            io.emit('user-status-change', {
                userId: data.userId,
                status: 'online'
            });

            console.log(`[WS] User authenticated: ${data.userName} (${data.userId})`);
        });

        // --- Chat ---
        socket.on('join-channel', (channelId: string) => {
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
        }) => {
            const message: Message = {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                channelId: data.channelId,
                userId: socket.data.userId,
                userName: socket.data.userName,
                content: data.content,
                timestamp: new Date(),
                replyTo: data.replyTo,
                attachments: data.attachments
            };

            // TODO: Save to database
            // await db('messages').insert(message);

            // Broadcast to channel
            io.to(`channel:${data.channelId}`).emit('new-message', message);

            console.log(`[WS] Message in ${data.channelId}: ${data.content.slice(0, 50)}...`);
        });

        socket.on('typing', (data: { channelId: string }) => {
            socket.to(`channel:${data.channelId}`).emit('user-typing', {
                userId: socket.data.userId,
                userName: socket.data.userName,
                channelId: data.channelId
            });
        });

        socket.on('stop-typing', (data: { channelId: string }) => {
            socket.to(`channel:${data.channelId}`).emit('user-stopped-typing', {
                userId: socket.data.userId,
                channelId: data.channelId
            });
        });

        socket.on('add-reaction', (data: {
            messageId: string;
            channelId: string;
            emoji: string;
        }) => {
            io.to(`channel:${data.channelId}`).emit('reaction-added', {
                messageId: data.messageId,
                userId: socket.data.userId,
                emoji: data.emoji
            });
        });

        // --- Collaboration ---
        socket.on('join-document', (documentId: string) => {
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
            socket.to(`doc:${data.documentId}`).emit('document-updated', {
                userId: socket.data.userId,
                changes: data.changes,
                version: data.version
            });
        });

        // --- Dashboard Collaboration ---
        socket.on('join-dashboard', (dashboardId: string) => {
            socket.join(`dashboard:${dashboardId}`);
        });

        socket.on('chart-interaction', (data: {
            dashboardId: string;
            chartId: string;
            action: 'select' | 'filter' | 'drill';
            value: any;
        }) => {
            socket.to(`dashboard:${data.dashboardId}`).emit('chart-interacted', {
                userId: socket.data.userId,
                ...data
            });
        });

        // --- Notifications ---
        socket.on('mark-notification-read', (notificationId: string) => {
            // TODO: Update database
            socket.emit('notification-read', { id: notificationId });
        });

        // --- Presence ---
        socket.on('set-status', (status: 'online' | 'away' | 'busy') => {
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
