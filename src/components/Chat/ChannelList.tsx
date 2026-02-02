import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Hash,
    Lock,
    Plus,
    Search,
    Settings,
    ChevronDown,
    MessageCircle,
    Users,
    Star,
    MoreHorizontal,
    X
} from 'lucide-react';
import { Input, Badge, Avatar, Button } from '../UI';

interface Channel {
    id: string;
    name: string;
    type: 'public' | 'private' | 'dm';
    unread?: number;
    participants?: { id: string; name: string; avatar?: string }[];
    lastMessage?: string;
    starred?: boolean;
}

interface ChannelListProps {
    channels: Channel[];
    activeChannelId?: string;
    onSelectChannel: (channelId: string) => void;
    onCreateChannel?: () => void;
}

const MOCK_CHANNELS: Channel[] = [
    { id: '1', name: 'general', type: 'public', unread: 3 },
    { id: '2', name: 'announcements', type: 'public', starred: true },
    { id: '3', name: 'engineering', type: 'private', unread: 12 },
    { id: '4', name: 'design', type: 'private' },
    { id: '5', name: 'random', type: 'public' },
    {
        id: 'dm1',
        name: 'John Doe',
        type: 'dm',
        unread: 2,
        participants: [{ id: '1', name: 'John Doe' }],
        lastMessage: 'Hey, can you check the report?'
    },
    {
        id: 'dm2',
        name: 'Sarah Smith',
        type: 'dm',
        participants: [{ id: '2', name: 'Sarah Smith' }],
        lastMessage: 'Thanks for the update!'
    }
];

export const ChannelList: React.FC<ChannelListProps> = ({
    channels = [],
    activeChannelId,
    onSelectChannel,
    onCreateChannel
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        starred: true,
        channels: true,
        directMessages: true
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const filteredChannels = channels.filter(ch =>
        ch.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const starredChannels = filteredChannels.filter(ch => ch.starred);
    const publicChannels = filteredChannels.filter(ch => ch.type !== 'dm' && !ch.starred);
    const dmChannels = filteredChannels.filter(ch => ch.type === 'dm');

    const renderChannelIcon = (channel: Channel) => {
        if (channel.type === 'dm') {
            const participant = channel.participants?.[0];
            return <Avatar name={participant?.name || channel.name} size="xs" />;
        }
        if (channel.type === 'private') {
            return <Lock className="w-4 h-4 text-slate-500" />;
        }
        return <Hash className="w-4 h-4 text-slate-500" />;
    };

    const renderSection = (
        title: string,
        sectionKey: string,
        items: Channel[],
        icon?: React.ReactNode
    ) => {
        if (items.length === 0) return null;

        return (
            <div className="mb-2">
                <button
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                >
                    <ChevronDown
                        className={`w-3 h-3 transition-transform ${expandedSections[sectionKey] ? '' : '-rotate-90'
                            }`}
                    />
                    {icon}
                    <span className="flex-1 text-left">{title}</span>
                    {items.some(ch => ch.unread) && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    )}
                </button>

                <AnimatePresence>
                    {expandedSections[sectionKey] && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                        >
                            {items.map(channel => (
                                <button
                                    key={channel.id}
                                    onClick={() => onSelectChannel(channel.id)}
                                    className={`
                                        w-full flex items-center gap-2 px-3 py-2 mx-1 rounded-lg
                                        transition-colors text-sm
                                        ${activeChannelId === channel.id
                                            ? 'bg-indigo-600/20 text-white'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                        }
                                    `}
                                >
                                    {renderChannelIcon(channel)}
                                    <span className="flex-1 text-left truncate">
                                        {channel.name}
                                    </span>
                                    {channel.unread && (
                                        <Badge variant="primary" size="sm">
                                            {channel.unread}
                                        </Badge>
                                    )}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/50 border-r border-slate-800">
            {/* Header */}
            <div className="p-4 border-b border-slate-800">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-indigo-400" />
                        Chat
                    </h2>
                    <button
                        onClick={onCreateChannel}
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                <Input
                    placeholder="Search channels..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    inputSize="sm"
                    leftIcon={<Search className="w-4 h-4" />}
                />
            </div>

            {/* Channel List */}
            <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                {renderSection('Starred', 'starred', starredChannels, <Star className="w-3 h-3" />)}
                {renderSection('Channels', 'channels', publicChannels, <Hash className="w-3 h-3" />)}
                {renderSection('Direct Messages', 'directMessages', dmChannels, <Users className="w-3 h-3" />)}

                {filteredChannels.length === 0 && (
                    <div className="px-4 py-8 text-center text-slate-500 text-sm">
                        No channels found
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChannelList;
