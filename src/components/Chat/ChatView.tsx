import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Hash,
    Users,
    Phone,
    Video,
    Pin,
    Bell,
    Search,
    Settings,
    MoreHorizontal,
    Sparkles,
    X,
    Loader2
} from 'lucide-react';
import { ChannelList } from './ChannelList';
import { MessageList, Message } from './MessageList';
import { MessageInput } from './MessageInput';
import { Button, Badge, Avatar, Modal, Input } from '../UI';
import { chatService } from '../../services/workOsService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

interface ChatViewProps {
    workspaceId?: string;
}

interface Channel {
    id: string;
    name: string;
    type: 'public' | 'private' | 'direct';
    description?: string;
    unread?: number;
    memberCount?: number;
    context_room_id?: number | null;
    context_project_id?: number | null;
}

interface RoomContextPayload {
    workspaceId: number;
    room: {
        id: number;
        name: string;
        stage: string;
        projectId: number | null;
        projectName: string | null;
        datasetId: number | null;
        updatedAt?: string;
    };
    summary: {
        artifactsByType: Record<string, number>;
        queryRuns: number;
        pivots: number;
        charts: number;
        reports: number;
        actions: number;
        pendingApprovals: number;
        latestReportBundleId: string | null;
        latestReportGeneratedAt: string | null;
        statusDraftCount: number;
        actionSyncCount: number;
    };
    recentEvents: Array<{
        eventType: string;
        label: string;
        metadata: Record<string, any>;
        createdAt: string;
    }>;
    channel?: {
        id: string;
        name: string;
        description?: string;
        type: 'public' | 'private' | 'direct';
        contextProjectId?: number | null;
        contextRoomId?: number | null;
    } | null;
}

export const ChatView: React.FC<ChatViewProps> = ({ workspaceId: propWorkspaceId }) => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();
    const workspaceId = propWorkspaceId
        || searchParams.get('workspace')
        || (activeWorkspace?.id ? String(activeWorkspace.id) : undefined);
    const roomId = searchParams.get('room') || '';
    const projectId = searchParams.get('project') || '';
    const datasetId = searchParams.get('dataset') || '';

    const [channels, setChannels] = useState<Channel[]>([]);
    const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [showMemberPanel, setShowMemberPanel] = useState(false);
    const [showPinnedMessages, setShowPinnedMessages] = useState(false);
    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelDesc, setNewChannelDesc] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [roomContext, setRoomContext] = useState<RoomContextPayload | null>(null);
    const [roomContextLoading, setRoomContextLoading] = useState(false);
    const [roomContextError, setRoomContextError] = useState('');
    const [publishingContextUpdate, setPublishingContextUpdate] = useState(false);

    const [replyTo, setReplyTo] = useState<{ id: string; userName: string; content: string } | null>(null);
    const { socket } = useSocket();
    const { user } = useAuth();
    const contextRoomId = roomId || (activeChannel?.context_room_id ? String(activeChannel.context_room_id) : '');
    const contextProjectId = projectId || (activeChannel?.context_project_id ? String(activeChannel.context_project_id) : '');

    const currentUserId = user?.id ? String(user.id) : 'current-user';
    const currentUserName = user?.name || user?.email || 'You';

    type SocketMessage = {
        id: string;
        channelId: string;
        userId: string | number;
        userName: string;
        content: string;
        timestamp: string | Date;
        replyTo?: string;
        attachments?: { type: string; url: string; name: string }[];
        clientMessageId?: string;
    };

    // Member roster API is not wired in this screen yet.
    // Keep a truthful fallback (current authenticated user only).
    const members = user ? [
        { id: currentUserId, name: currentUserName, status: (socket?.connected ? 'online' : 'offline') as 'online' | 'offline' }
    ] : [];

    // Fetch channels + ensure room-context channel (when room query param exists)
    useEffect(() => {
        const fetchChannels = async () => {
            if (!workspaceId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                let nextChannels: Channel[] = (await chatService.getChannels(workspaceId)) || [];

                if (roomId) {
                    try {
                        const ensured = await chatService.ensureRoomContextChannel(workspaceId, roomId, { autoPostSummary: false });
                        const ensuredChannel = ensured?.channel as Channel | undefined;
                        if (ensuredChannel?.id) {
                            const alreadyExists = nextChannels.some((channel) => channel.id === ensuredChannel.id);
                            if (!alreadyExists) {
                                nextChannels = [...nextChannels, ensuredChannel];
                            }
                            setActiveChannel((prev) => {
                                if (!prev) return ensuredChannel;
                                if (prev.id === ensuredChannel.id) return prev;
                                return ensuredChannel;
                            });
                        }
                    } catch (contextChannelErr) {
                        console.warn('Failed to ensure room context channel:', contextChannelErr);
                    }
                }

                setChannels(nextChannels);
                if (nextChannels.length > 0 && !activeChannel) {
                    setActiveChannel(nextChannels[0]);
                }
            } catch (error) {
                console.error('Failed to fetch channels:', error);
                // Fallback to empty
                setChannels([]);
            } finally {
                setLoading(false);
            }
        };
        fetchChannels();
    }, [workspaceId, roomId]);

    useEffect(() => {
        const fetchRoomContext = async () => {
            if (!workspaceId || !contextRoomId) {
                setRoomContext(null);
                setRoomContextError('');
                return;
            }

            setRoomContextLoading(true);
            setRoomContextError('');
            try {
                const contextPayload = await chatService.getRoomContext(workspaceId, contextRoomId);
                setRoomContext(contextPayload || null);
            } catch (error: any) {
                console.error('Failed to load room context:', error);
                setRoomContext(null);
                setRoomContextError(
                    error?.response?.data?.error || error?.message || 'Unable to load room context.'
                );
            } finally {
                setRoomContextLoading(false);
            }
        };
        fetchRoomContext();
    }, [workspaceId, contextRoomId]);

    // Fetch messages when active channel changes
    useEffect(() => {
        const fetchMessages = async () => {
            if (!activeChannel) {
                setMessages([]);
                return;
            }
            setMessagesLoading(true);
            try {
                const data = await chatService.getMessages(activeChannel.id);
                // Transform API messages to component format
                const transformedMessages: Message[] = (data || []).map((m: any) => ({
                    id: m.id,
                    content: m.content,
                    userId: String(m.user_id),
                    userName: m.user?.full_name || m.user?.email || 'Unknown',
                    timestamp: new Date(m.created_at),
                    reactions: m.reactions || {},
                    attachments: m.attachments || [],
                    threadCount: m.threadCount || 0
                }));
                setMessages(transformedMessages);
            } catch (error) {
                console.error('Failed to fetch messages:', error);
                setMessages([]);
            } finally {
                setMessagesLoading(false);
            }
        };
        fetchMessages();
    }, [activeChannel?.id]);

    // WebSocket Integration
    useEffect(() => {
        if (!socket || !activeChannel) return;

        console.log('Joining channel via socket:', activeChannel.id);
        socket.emit('join-channel', activeChannel.id);

        const handleNewMessage = (msg: SocketMessage) => {
            // NOTE: Socket payload timestamps arrive as strings; normalize to Date for MessageList.
            if (msg.channelId !== activeChannel.id) return;

            const mapped: Message = {
                id: String(msg.id),
                content: msg.content,
                userId: String(msg.userId),
                userName: msg.userName || 'Unknown',
                timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
                attachments: msg.attachments || []
            };

            setMessages(prev => {
                const withoutTemp = msg.clientMessageId
                    ? prev.filter(p => p.id !== `temp-${msg.clientMessageId}`)
                    : prev;

                if (withoutTemp.some(p => p.id === mapped.id)) return withoutTemp;
                return [...withoutTemp, mapped];
            });
        };

        socket.on('new-message', handleNewMessage);

        return () => {
            socket.emit('leave-channel', activeChannel.id);
            socket.off('new-message', handleNewMessage);
        };
    }, [socket, activeChannel?.id]);

    const handleSelectChannel = useCallback((channelId: string) => {
        const channel = channels.find(c => c.id === channelId);
        if (channel) {
            setActiveChannel(channel);
        }
    }, [channels]);

    const handleSendMessage = useCallback(async (content: string, attachments?: File[]) => {
        if (!activeChannel || !content.trim()) return;

        // Optimistic update
        const clientMessageId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const tempId = `temp-${clientMessageId}`;
        const tempMessage: Message = {
            id: tempId,
            content,
            userId: currentUserId,
            userName: currentUserName,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, tempMessage]);
        const replyToId = replyTo?.id;
        setReplyTo(null);

        // Prefer socket for real-time + persistence (server writes & broadcasts).
        // Fallback to REST if socket isn't available or fails to ack quickly.
        if (socket && socket.connected) {
            let didAck = false;
            const fallbackTimer = window.setTimeout(async () => {
                if (didAck) return;
                try {
                    const newMessage = await chatService.sendMessage(activeChannel.id, content, replyToId);
                    setMessages(prev => prev.map(m =>
                        m.id === tempId ? {
                            id: String(newMessage.id),
                            content: newMessage.content,
                            userId: String(newMessage.user_id),
                            userName: newMessage.user?.full_name || newMessage.user?.email || currentUserName,
                            timestamp: new Date(newMessage.created_at),
                            reactions: newMessage.reactions || {},
                            attachments: newMessage.attachments || []
                        } : m
                    ));
                } catch (error) {
                    console.error('Failed to send message:', error);
                    setMessages(prev => prev.filter(m => m.id !== tempId));
                }
            }, 5000);

            socket.emit('send-message', {
                channelId: activeChannel.id,
                content,
                replyTo: replyToId,
                clientMessageId
            }, (ack: any) => {
                didAck = true;
                window.clearTimeout(fallbackTimer);

                if (!ack?.ok || !ack?.message?.id) {
                    // Keep the optimistic message; fallback timer handles REST if needed.
                    return;
                }

                const msg = ack.message as SocketMessage;
                const mapped: Message = {
                    id: String(msg.id),
                    content: msg.content,
                    userId: String(msg.userId),
                    userName: msg.userName || currentUserName,
                    timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
                    attachments: msg.attachments || []
                };

                setMessages(prev => prev.map(m => (m.id === tempId ? mapped : m)));
            });

            return;
        }

        try {
            const newMessage = await chatService.sendMessage(activeChannel.id, content, replyToId);
            // Replace temp message with real one
            setMessages(prev => prev.map(m =>
                m.id === tempId ? {
                    id: String(newMessage.id),
                    content: newMessage.content,
                    userId: String(newMessage.user_id),
                    userName: newMessage.user?.full_name || newMessage.user?.email || currentUserName,
                    timestamp: new Date(newMessage.created_at),
                    reactions: newMessage.reactions || {},
                    attachments: newMessage.attachments || []
                } : m
            ));
        } catch (error) {
            console.error('Failed to send message:', error);
            // Remove temp message on error
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    }, [activeChannel, replyTo, socket, currentUserId, currentUserName]);

    const handleCreateChannel = async () => {
        if (!newChannelName.trim() || !workspaceId) return;
        setCreateLoading(true);
        try {
            const newChannel = await chatService.createChannel({
                name: newChannelName.trim(),
                description: newChannelDesc.trim() || undefined,
                type: 'public',
                workspace_id: workspaceId
            });
            setChannels(prev => [...prev, newChannel]);
            setActiveChannel(newChannel);
            setShowCreateChannel(false);
            setNewChannelName('');
            setNewChannelDesc('');
        } catch (error) {
            console.error('Failed to create channel:', error);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleReply = (messageId: string) => {
        const message = messages.find(m => m.id === messageId);
        if (message) {
            setReplyTo({
                id: message.id,
                userName: message.userName,
                content: message.content
            });
        }
    };

    const handleOpenRoomInStudio = () => {
        if (!workspaceId || !contextRoomId) return;
        const query = new URLSearchParams();
        query.set('workspace', workspaceId);
        if (datasetId) query.set('dataset', datasetId);
        if (contextProjectId) query.set('project', contextProjectId);
        query.set('room', contextRoomId);
        query.set('panel', 'comms');
        navigate(`/app/studio?${query.toString()}`);
    };

    const handlePublishContextUpdate = async () => {
        if (!workspaceId || !contextRoomId || !activeChannel) return;
        setPublishingContextUpdate(true);
        try {
            const response = await chatService.publishRoomContextUpdate(workspaceId, contextRoomId, {
                channelId: activeChannel.id
            });
            const message = response?.message;
            if (message && String(message.channel_id || '') === String(activeChannel.id)) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: String(message.id),
                        content: String(message.content || ''),
                        userId: String(message.user_id || currentUserId),
                        userName: message.user?.full_name || message.user?.email || currentUserName,
                        timestamp: new Date(message.created_at || new Date().toISOString()),
                        reactions: {},
                        attachments: []
                    }
                ]);
            }
            if (workspaceId && contextRoomId) {
                const refreshed = await chatService.getRoomContext(workspaceId, contextRoomId);
                setRoomContext(refreshed || null);
            }
        } catch (error) {
            console.error('Failed to publish room context update:', error);
        } finally {
            setPublishingContextUpdate(false);
        }
    };

    // Transform channels for ChannelList component
    const channelListData = channels.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type === 'direct' ? 'dm' as const : c.type as 'public' | 'private',
        context_room_id: c.context_room_id ?? null,
    }));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-950">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                    <p className="text-slate-400">Loading chat...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-slate-950">
            {/* Channel List Sidebar */}
            <div className="w-64 flex-shrink-0 hidden md:block">
                <ChannelList
                    channels={channelListData}
                    activeChannelId={activeChannel?.id}
                    onSelectChannel={handleSelectChannel}
                    onCreateChannel={() => setShowCreateChannel(true)}
                />
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {activeChannel ? (
                    <>
                        {contextRoomId && (
                            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/70">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <div className="text-xs font-semibold text-blue-300 uppercase tracking-wide">
                                        Decision Room Context
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleOpenRoomInStudio}
                                            className="!px-2 !py-1 text-[11px]"
                                        >
                                            Open in Studio
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handlePublishContextUpdate}
                                            disabled={publishingContextUpdate || roomContextLoading}
                                            className="!px-2 !py-1 text-[11px]"
                                        >
                                            {publishingContextUpdate ? 'Publishing...' : 'Post Context Update'}
                                        </Button>
                                    </div>
                                </div>

                                {roomContextLoading ? (
                                    <div className="text-[11px] text-slate-400">Loading room context...</div>
                                ) : roomContextError ? (
                                    <div className="text-[11px] text-rose-300">{roomContextError}</div>
                                ) : roomContext ? (
                                    <>
                                        <div className="text-[11px] text-slate-300 mb-2">
                                            <span className="font-semibold text-white">{roomContext.room.name}</span>
                                            {' '}| stage: <span className="uppercase">{roomContext.room.stage}</span>
                                            {' '}| project: <span>{roomContext.room.projectName || 'Not set'}</span>
                                            {roomContext.room.datasetId ? (
                                                <>
                                                    {' '}| dataset: <span>{roomContext.room.datasetId}</span>
                                                </>
                                            ) : null}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                                            <div className="rounded border border-slate-700 p-2">
                                                <div className="text-slate-400">Runs</div>
                                                <div className="text-white font-semibold">{roomContext.summary.queryRuns}</div>
                                            </div>
                                            <div className="rounded border border-slate-700 p-2">
                                                <div className="text-slate-400">Actions</div>
                                                <div className="text-white font-semibold">{roomContext.summary.actions}</div>
                                            </div>
                                            <div className="rounded border border-slate-700 p-2">
                                                <div className="text-slate-400">Pending Approvals</div>
                                                <div className="text-white font-semibold">{roomContext.summary.pendingApprovals}</div>
                                            </div>
                                            <div className="rounded border border-slate-700 p-2">
                                                <div className="text-slate-400">Latest Report</div>
                                                <div className="text-white font-semibold truncate">
                                                    {roomContext.summary.latestReportBundleId || 'none'}
                                                </div>
                                            </div>
                                        </div>

                                        {roomContext.recentEvents.length > 0 && (
                                            <div className="mt-2 text-[11px] text-slate-400">
                                                <div className="font-semibold text-slate-300 mb-1">Recent room activity</div>
                                                <div className="space-y-1">
                                                    {roomContext.recentEvents.slice(0, 3).map((event) => (
                                                        <div key={`${event.eventType}-${event.createdAt}`} className="truncate">
                                                            {event.label} • {new Date(event.createdAt).toLocaleString()}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-[11px] text-slate-400">
                                        No room context available for this chat view.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Channel Header */}
                        < header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl" >
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Hash className="w-5 h-5 text-slate-400" />
                                    <h1 className="text-lg font-semibold text-white">
                                        {activeChannel.name}
                                    </h1>
                                </div>

                                {activeChannel.description && (
                                    <>
                                        <div className="w-px h-5 bg-slate-700" />
                                        <span className="text-sm text-slate-400 truncate max-w-[300px]">
                                            {activeChannel.description}
                                        </span>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                                    <Phone className="w-5 h-5" />
                                </button>
                                <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                                    <Video className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setShowPinnedMessages(true)}
                                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                >
                                    <Pin className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setShowMemberPanel(!showMemberPanel)}
                                    className={`p-2 rounded-lg transition-colors ${showMemberPanel
                                        ? 'bg-blue-600/20 text-blue-300'
                                        : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                >
                                    <Users className="w-5 h-5" />
                                </button>
                                <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                                    <Search className="w-5 h-5" />
                                </button>
                            </div>
                        </header >

                        {/* Messages Area */}
                        < div className="flex-1 flex overflow-hidden" >
                            {/* Message List */}
                            < div className="flex-1 flex flex-col" >
                                {
                                    messagesLoading ? (
                                        <div className="flex-1 flex items-center justify-center" >
                                            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                        </div>
                                    ) : (
                                        <MessageList
                                            messages={messages}
                                            currentUserId={currentUserId}
                                            onReply={handleReply}
                                        />
                                    )}

                                <MessageInput
                                    channelName={activeChannel.name}
                                    onSendMessage={handleSendMessage}
                                    replyTo={replyTo || undefined}
                                    onCancelReply={() => setReplyTo(null)}
                                />
                            </div >

                            {/* Members Panel */}
                            <AnimatePresence>
                                {
                                    showMemberPanel && (
                                        <motion.aside
                                            initial={{ width: 0, opacity: 0 }}
                                            animate={{ width: 256, opacity: 1 }}
                                            exit={{ width: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="border-l border-slate-800 bg-slate-900/50 overflow-hidden"
                                        >
                                            <div className="w-64 p-4">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="font-semibold text-white">
                                                        Members ({members.length})
                                                    </h3>
                                                    <button
                                                        onClick={() => setShowMemberPanel(false)}
                                                        className="p-1 rounded hover:bg-slate-800 text-slate-400"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="space-y-2">
                                                    {members.map(member => (
                                                        <div
                                                            key={member.id}
                                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                                                        >
                                                            <Avatar
                                                                name={member.name}
                                                                size="sm"
                                                                status={member.status as any}
                                                            />
                                                            <span className="text-sm text-slate-300 truncate">
                                                                {member.name}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.aside>
                                    )
                                }
                            </AnimatePresence >
                        </div >
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <Hash className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-white mb-2">No channels yet</h2>
                            <p className="text-slate-400 mb-4">Create your first channel to start chatting</p>
                            <Button onClick={() => setShowCreateChannel(true)}>
                                Create Channel
                            </Button>
                        </div>
                    </div>
                )}
            </div >

            {/* Create Channel Modal */}
            < Modal
                isOpen={showCreateChannel}
                onClose={() => setShowCreateChannel(false)}
                title="Create Channel"
                description="Create a new channel for your team"
            >
                <div className="space-y-4">
                    <Input
                        label="Channel Name"
                        placeholder="e.g. marketing, design-team"
                        leftIcon={<Hash className="w-4 h-4" />}
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                    />
                    <Input
                        label="Description (optional)"
                        placeholder="What's this channel about?"
                        value={newChannelDesc}
                        onChange={(e) => setNewChannelDesc(e.target.value)}
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            variant="secondary"
                            onClick={() => setShowCreateChannel(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateChannel}
                            disabled={!newChannelName.trim() || createLoading}
                        >
                            {createLoading ? 'Creating...' : 'Create Channel'}
                        </Button>
                    </div>
                </div>
            </Modal >
        </div >
    );
};

export default ChatView;
