import React, { useState, useEffect, useCallback } from 'react';
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
}

export const ChatView: React.FC<ChatViewProps> = ({ workspaceId: propWorkspaceId }) => {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = propWorkspaceId || currentWorkspace?.id;

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

    const [replyTo, setReplyTo] = useState<{ id: string; userName: string; content: string } | null>(null);
    const { socket } = useSocket();

    // Mock members for now
    const members = [
        { id: '1', name: 'John Doe', status: 'online' as const },
        { id: '2', name: 'Sarah Smith', status: 'online' as const },
        { id: '3', name: 'Mike Johnson', status: 'away' as const },
        { id: '4', name: 'Emily Brown', status: 'offline' as const },
        { id: '5', name: 'Alex Wilson', status: 'busy' as const }
    ];

    // Fetch channels on mount
    useEffect(() => {
        const fetchChannels = async () => {
            if (!workspaceId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const data = await chatService.getChannels(workspaceId);
                setChannels(data || []);
                if (data && data.length > 0 && !activeChannel) {
                    setActiveChannel(data[0]);
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
    }, [workspaceId]);

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
                    userId: m.user_id,
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

        const handleNewMessage = (msg: Message) => {
            console.log('Socket received message:', msg);
            if (msg.channelId === activeChannel.id) {
                // Dedup check: if message with same content/timestamp exists recently, ignore (simple check)
                setMessages(prev => {
                    if (prev.some(p => p.id === msg.id)) return prev;
                    return [...prev, msg];
                });
            }
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
        const tempId = `temp-${Date.now()}`;
        const tempMessage: Message = {
            id: tempId,
            content,
            userId: 'current-user',
            userName: 'You',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, tempMessage]);
        setReplyTo(null);

        try {
            const newMessage = await chatService.sendMessage(activeChannel.id, content, replyTo?.id);
            // Replace temp message with real one
            setMessages(prev => prev.map(m =>
                m.id === tempId ? {
                    id: newMessage.id,
                    content: newMessage.content,
                    userId: newMessage.user_id,
                    userName: newMessage.user?.full_name || 'You',
                    timestamp: new Date(newMessage.created_at),
                    reactions: newMessage.reactions || {},
                    attachments: newMessage.attachments || []
                } : m
            ));

            // Socket Emit for Real-time (Demo)
            if (socket) {
                socket.emit('send-message', {
                    channelId: activeChannel.id,
                    content: content,
                    replyTo: replyTo?.id
                });
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            // Remove temp message on error
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    }, [activeChannel, replyTo]);

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

    // Transform channels for ChannelList component
    const channelListData = channels.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type === 'direct' ? 'dm' as const : c.type as 'public' | 'private',
        unread: c.unread
    }));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-950">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
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
                        {/* Channel Header */}
                        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
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
                                        ? 'bg-indigo-600/20 text-indigo-300'
                                        : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                >
                                    <Users className="w-5 h-5" />
                                </button>
                                <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                                    <Search className="w-5 h-5" />
                                </button>
                            </div>
                        </header>

                        {/* Messages Area */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Message List */}
                            <div className="flex-1 flex flex-col">
                                {messagesLoading ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                    </div>
                                ) : (
                                    <MessageList
                                        messages={messages}
                                        currentUserId="current-user"
                                        onReply={handleReply}
                                    />
                                )}

                                <MessageInput
                                    channelName={activeChannel.name}
                                    onSendMessage={handleSendMessage}
                                    replyTo={replyTo || undefined}
                                    onCancelReply={() => setReplyTo(null)}
                                />
                            </div>

                            {/* Members Panel */}
                            <AnimatePresence>
                                {showMemberPanel && (
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
                                )}
                            </AnimatePresence>
                        </div>
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
            </div>

            {/* Create Channel Modal */}
            <Modal
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
            </Modal>
        </div>
    );
};

export default ChatView;
