import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FileText,
    Table2,
    BarChart3,
    CheckSquare,
    MessageCircle,
    Zap,
    FolderOpen,
    Plus,
    ArrowRight,
    Sparkles,
    Clock,
    TrendingUp,
    Loader2
} from 'lucide-react';
import { Card, Button, Badge } from '../UI';
import { useWorkspace } from '../../context/WorkspaceContext';
import { tasksService, docsService, chatService } from '../../../services/workOsService';

interface QuickAction {
    icon: React.ElementType;
    label: string;
    description: string;
    href: string;
    color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    { icon: FileText, label: 'New Doc', description: 'Create a document', href: '/app/docs', color: 'indigo' },
    { icon: CheckSquare, label: 'New Task', description: 'Track work', href: '/app/tasks', color: 'sky' },
    { icon: MessageCircle, label: 'Chat', description: 'Collaborate', href: '/app/chat', color: 'emerald' },
    { icon: FolderOpen, label: 'Files', description: 'Store assets', href: '/app/files', color: 'amber' },
    { icon: Zap, label: 'Flows', description: 'Automate', href: '/app/flows', color: 'purple' }
];

export const HomeView: React.FC = () => {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id;

    const [stats, setStats] = useState([
        { label: 'Active Tasks', value: '0', change: '0' },
        { label: 'Documents', value: '0', change: '0' },
        { label: 'Channels', value: '0', change: '0' },
        { label: 'Team Members', value: '1', change: '0' }
    ]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!workspaceId) return;
            setLoading(true);
            try {
                const [tasks, docs, channels] = await Promise.all([
                    tasksService.getAll(workspaceId),
                    docsService.getAll(workspaceId),
                    chatService.getChannels(workspaceId)
                ]);

                setStats([
                    { label: 'Active Tasks', value: String(tasks.length), change: '0' },
                    { label: 'Documents', value: String(docs.length), change: '0' },
                    { label: 'Channels', value: String(channels.length), change: '0' },
                    { label: 'Team Members', value: '1', change: '0' }
                ]);
            } catch (error) {
                console.error('Failed to fetch home stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [workspaceId]);

    return (
        <div className="min-h-full bg-slate-950 p-6">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Welcome Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-8"
                >
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Welcome back! 👋
                    </h1>
                    <p className="text-slate-400">
                        Everything looks good in {currentWorkspace?.name || 'your workspace'}.
                    </p>
                </motion.div>

                {/* AI Assistant Prompt */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20" />
                        <div className="relative flex items-center gap-4 p-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                                <h2 className="font-semibold text-white mb-1">
                                    Ask AI Anything
                                </h2>
                                <p className="text-sm text-slate-400">
                                    "Create a sales report", "Analyze my data", "Help me write..."
                                </p>
                            </div>
                            <Button rightIcon={<ArrowRight className="w-4 h-4" />}>
                                Ask Now
                            </Button>
                        </div>
                    </Card>
                </motion.div>

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {QUICK_ACTIONS.map((action, index) => (
                            <Link key={index} to={action.href}>
                                <Card
                                    hover
                                    padding="md"
                                    className="text-center h-full transition-transform hover:scale-105"
                                >
                                    <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-${action.color}-500/20 flex items-center justify-center`}>
                                        <action.icon className={`w-6 h-6 text-${action.color}-400`} />
                                    </div>
                                    <h3 className="font-medium text-white text-sm mb-1">
                                        {action.label}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {action.description}
                                    </p>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </motion.div>

                {/* Stats Overview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h2 className="text-lg font-semibold text-white mb-4">Overview</h2>
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <Card key={i} padding="md" className="animate-pulse">
                                    <div className="h-4 w-20 bg-slate-800 rounded mb-2" />
                                    <div className="h-8 w-12 bg-slate-800 rounded" />
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {stats.map((stat, index) => (
                                <Card key={index} padding="md">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-slate-400">{stat.label}</span>
                                        {stat.change !== '0' && (
                                            <Badge
                                                variant={stat.change.startsWith('+') ? 'success' : 'default'}
                                                size="sm"
                                            >
                                                {stat.change}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="text-2xl font-bold text-white">
                                        {stat.value}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default HomeView;
