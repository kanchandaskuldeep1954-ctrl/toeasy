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
import { tasksService, docsService, chatService } from '../../services/workOsService';
import { datasetAPI } from '../../services/api';

interface QuickAction {
    icon: React.ElementType;
    label: string;
    description: string;
    href: string;
    color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    { icon: FileText, label: 'New Doc', description: 'Create a document', href: '/app/docs', color: 'blue' },
    { icon: CheckSquare, label: 'New Task', description: 'Track work', href: '/app/tasks', color: 'sky' },
    { icon: MessageCircle, label: 'Chat', description: 'Collaborate', href: '/app/chat', color: 'emerald' },
    { icon: FolderOpen, label: 'Files', description: 'Store assets', href: '/app/files', color: 'amber' },
    { icon: Zap, label: 'Flows', description: 'Automate', href: '/app/dataflows', color: 'cyan' }
];

// Tailwind can't reliably pick up dynamic class names (e.g. `bg-${color}-...`),
// so keep these explicit to ensure the styles are generated in production builds.
const QUICK_ACTION_COLOR: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    sky: { bg: 'bg-sky-500/20', text: 'text-sky-400' },
    emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    amber: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' }
};

export const HomeView: React.FC = () => {
    const { activeWorkspace } = useWorkspace();
    const workspaceId = activeWorkspace?.id ? String(activeWorkspace.id) : undefined;

    const [stats, setStats] = useState([
        { label: 'Active Tasks', value: '0', change: '0' },
        { label: 'Documents', value: '0', change: '0' },
        { label: 'Channels', value: '0', change: '0' },
        { label: 'Datasets', value: '0', change: '0' }
    ]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!workspaceId) return;
            setLoading(true);
            try {
                const [tasks, docs, channels, datasetsRes] = await Promise.all([
                    tasksService.getAll(workspaceId),
                    docsService.getAll(workspaceId),
                    chatService.getChannels(workspaceId),
                    datasetAPI.list(workspaceId)
                ]);

                setStats([
                    { label: 'Active Tasks', value: String(tasks.length), change: '0' },
                    { label: 'Documents', value: String(docs.length), change: '0' },
                    { label: 'Channels', value: String(channels.length), change: '0' },
                    { label: 'Datasets', value: String(datasetsRes.data?.data?.length || 0), change: '0' }
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
                        Everything looks good in {activeWorkspace?.name || 'your workspace'}.
                    </p>
                </motion.div>

                {/* AI Assistant Prompt */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="relative overflow-hidden bg-slate-900 border-slate-800">
                        <div className="absolute inset-0 bg-blue-600/5" />
                        <div className="relative flex items-center gap-4 p-6">
                            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
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
                                    <div className={`w-12 h-12 mx-auto mb-3 rounded-xl ${QUICK_ACTION_COLOR[action.color]?.bg || 'bg-slate-500/20'} flex items-center justify-center`}>
                                        <action.icon className={`w-6 h-6 ${QUICK_ACTION_COLOR[action.color]?.text || 'text-slate-300'}`} />
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
