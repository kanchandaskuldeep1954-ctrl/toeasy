import React, { useState, useCallback } from 'react';
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
    X
} from 'lucide-react';
import { ChannelList } from './ChannelList';
import { MessageList, Message } from './MessageList';
import { MessageInput } from './MessageInput';
import { Button, Badge, Avatar, Modal, Input } from '../UI';

interface ChatViewProps {
    workspaceId?: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ workspaceId }) => {
    const [activeChannelId, setActiveChannelId] = useState<string>('1');
    const [showMemberPanel, setShowMemberPanel] = useState(false);
    const [showPinnedMessages, setShowPinnedMessages] = useState(false);
    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [replyTo, setReplyTo] = useState<{ id: string; userName: string; content: string } | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);

    // Mock channel data
    const activeChannel = {
        id: activeChannelId,
        name: 'general',
        type: 'public',
        topic: 'General discussions and announcements',
        memberCount: 24
    };

    // Mock members
    const members = [
        { id: '1', name: 'John Doe', status: 'online' as const },
        { id: '2', name: 'Sarah Smith', status: 'online' as const },
        { id: '3', name: 'Mike Johnson', status: 'away' as const },
        { id: '4', name: 'Emily Brown', status: 'offline' as const },
        { id: '5', name: 'Alex Wilson', status: 'busy' as const }
    ];

    const handleSendMessage = useCallback((content: string, attachments?: File[]) => {
        const newMessage: Message = {
            id: `msg-${Date.now()}`,
            content,
            userId: 'current-user',
            userName: 'You',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newMessage]);
        setReplyTo(null);
    }, []);

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

    return (
        <div className="flex h-full bg-slate-950">
            {/* Channel List Sidebar */}
            <div className="w-64 flex-shrink-0 hidden md:block">
                <ChannelList
                    channels={[]}
                    activeChannelId={activeChannelId}
                    onSelectChannel={setActiveChannelId}
                    onCreateChannel={() => setShowCreateChannel(true)}
                />
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Channel Header */}
                <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Hash className="w-5 h-5 text-slate-400" />
                            <h1 className="text-lg font-semibold text-white">
                                {activeChannel.name}
                            </h1>
                        </div>

                        {activeChannel.topic && (
                            <>
                                <div className="w-px h-5 bg-slate-700" />
                                <span className="text-sm text-slate-400 truncate max-w-[300px]">
                                    {activeChannel.topic}
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
                        <MessageList
                            messages={messages}
                            currentUserId="current-user"
                            onReply={handleReply}
                        />

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
                    />
                    <Input
                        label="Description (optional)"
                        placeholder="What's this channel about?"
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            variant="secondary"
                            onClick={() => setShowCreateChannel(false)}
                        >
                            Cancel
                        </Button>
                        <Button>Create Channel</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ChatView;
