import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Reply, Smile, Pin, Bookmark } from 'lucide-react';
import { Avatar } from '../UI';

export interface Message {
    id: string;
    content: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    timestamp: Date;
    reactions?: { emoji: string; count: number; users: string[] }[];
    threadCount?: number;
    isPinned?: boolean;
    attachments?: { type: string; url: string; name: string }[];
}

interface MessageListProps {
    messages: Message[];
    currentUserId?: string;
    onReply?: (messageId: string) => void;
    onReact?: (messageId: string, emoji: string) => void;
}

const MOCK_MESSAGES: Message[] = [
    {
        id: '1',
        content: 'Hey team! 👋 Just pushed the new dashboard updates. Please review when you get a chance.',
        userId: 'user1',
        userName: 'John Doe',
        timestamp: new Date(Date.now() - 3600000 * 2),
        reactions: [
            { emoji: '👍', count: 3, users: ['user2', 'user3', 'user4'] },
            { emoji: '🎉', count: 1, users: ['user5'] }
        ],
        threadCount: 4
    },
    {
        id: '2',
        content: 'Looks great! The charts are rendering much faster now.',
        userId: 'user2',
        userName: 'Sarah Smith',
        timestamp: new Date(Date.now() - 3600000),
        reactions: [{ emoji: '💯', count: 2, users: ['user1', 'user3'] }]
    },
    {
        id: '3',
        content: '@john Can you also check the export functionality? I noticed some edge cases with large datasets.',
        userId: 'user3',
        userName: 'Mike Johnson',
        timestamp: new Date(Date.now() - 1800000)
    },
    {
        id: '4',
        content: 'Sure thing! I\'ll look into it this afternoon. 🔍',
        userId: 'user1',
        userName: 'John Doe',
        timestamp: new Date(Date.now() - 600000)
    }
];

const MessageItem: React.FC<{
    message: Message;
    isOwn: boolean;
    showAvatar: boolean;
    onReply?: () => void;
}> = ({ message, isOwn, showAvatar, onReply }) => {
    const [showActions, setShowActions] = React.useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative px-4 py-1.5 hover:bg-slate-800/30 transition-colors"
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            <div className="flex gap-3">
                {/* Avatar */}
                <div className="w-10 flex-shrink-0">
                    {showAvatar && (
                        <Avatar
                            name={message.userName}
                            src={message.userAvatar}
                            size="md"
                        />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {showAvatar && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="font-semibold text-white">
                                {message.userName}
                            </span>
                            <span className="text-xs text-slate-500">
                                {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                            </span>
                            {message.isPinned && (
                                <span className="flex items-center gap-1 text-xs text-amber-400">
                                    <Pin className="w-3 h-3" />
                                    Pinned
                                </span>
                            )}
                        </div>
                    )}

                    <div className="text-slate-300 break-words">
                        {/* Parse @mentions */}
                        {message.content.split(/(@\w+)/g).map((part, i) => (
                            part.startsWith('@') ? (
                                <span
                                    key={i}
                                    className="text-indigo-400 bg-indigo-400/10 px-1 rounded cursor-pointer hover:bg-indigo-400/20"
                                >
                                    {part}
                                </span>
                            ) : part
                        ))}
                    </div>

                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                            {message.reactions.map((reaction, index) => (
                                <button
                                    key={index}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-sm transition-colors"
                                >
                                    <span>{reaction.emoji}</span>
                                    <span className="text-slate-400">{reaction.count}</span>
                                </button>
                            ))}
                            <button className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300">
                                <Smile className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Thread indicator */}
                    {message.threadCount && (
                        <button className="flex items-center gap-2 mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                            <Reply className="w-4 h-4" />
                            <span>{message.threadCount} replies</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Hover Actions */}
            {showActions && (
                <div className="absolute right-4 top-0 -translate-y-1/2 flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 shadow-lg">
                    <button className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                        <Smile className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onReply}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                        <Reply className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                        <Bookmark className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>
            )}
        </motion.div>
    );
};

export const MessageList: React.FC<MessageListProps> = ({
    messages = MOCK_MESSAGES,
    currentUserId = 'user1',
    onReply
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages]);

    // Group messages by user (consecutive)
    const shouldShowAvatar = (index: number): boolean => {
        if (index === 0) return true;
        const prevMessage = messages[index - 1];
        const currMessage = messages[index];

        // Show avatar if different user or more than 5 min apart
        if (prevMessage.userId !== currMessage.userId) return true;
        if (currMessage.timestamp.getTime() - prevMessage.timestamp.getTime() > 300000) return true;

        return false;
    };

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-y-auto py-4 custom-scrollbar"
        >
            {/* Date separator */}
            <div className="flex items-center gap-4 px-4 py-2 mb-2">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-xs text-slate-500 font-medium">Today</span>
                <div className="flex-1 h-px bg-slate-800" />
            </div>

            {messages.map((message, index) => (
                <MessageItem
                    key={message.id}
                    message={message}
                    isOwn={message.userId === currentUserId}
                    showAvatar={shouldShowAvatar(index)}
                    onReply={() => onReply?.(message.id)}
                />
            ))}
        </div>
    );
};

export default MessageList;
