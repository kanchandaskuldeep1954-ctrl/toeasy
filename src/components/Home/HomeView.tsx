import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FileText,
    CheckSquare,
    MessageCircle,
    Zap,
    FolderOpen,
    ArrowRight,
    Sparkles,
    TrendingUp,
    Users,
    Activity,
    Plus
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { tasksService, docsService, chatService } from '../../services/workOsService';
import { datasetAPI } from '../../services/api';

export const HomeView: React.FC = () => {
    const { activeWorkspace } = useWorkspace();
    const workspaceId = activeWorkspace?.id ? String(activeWorkspace.id) : undefined;

    const [stats, setStats] = useState([
        { label: 'Active Tasks', value: '0', icon: CheckSquare, color: 'sky' },
        { label: 'Documents', value: '0', icon: FileText, color: 'blue' },
        { label: 'Channels', value: '0', icon: MessageCircle, color: 'emerald' },
        { label: 'Datasets', value: '0', icon: Activity, color: 'violet' }
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
                    { label: 'Active Tasks', value: String(tasks.length), icon: CheckSquare, color: 'sky' },
                    { label: 'Documents', value: String(docs.length), icon: FileText, color: 'blue' },
                    { label: 'Channels', value: String(channels.length), icon: MessageCircle, color: 'emerald' },
                    { label: 'Datasets', value: String(datasetsRes.data?.data?.length || 0), icon: Activity, color: 'violet' }
                ]);
            } catch (error) {
                console.error('Failed to fetch home stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [workspaceId]);

    const greeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="min-h-full p-6 md:p-12 max-w-7xl mx-auto space-y-12">
            {/* Hero Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6"
            >
                <div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">
                        {greeting()}, {activeWorkspace?.name || 'Friend'}.
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
                        Ready to build something active today?
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link to="/app/create" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        <span>New Project</span>
                    </Link>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[24px] hover:border-indigo-500/30 transition-colors"
                    >
                        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-${stat.color}-500 transform group-hover:scale-110 duration-500`}>
                            <stat.icon className="w-24 h-24" />
                        </div>
                        <div className="relative z-10">
                            <div className={`w-10 h-10 rounded-xl bg-${stat.color}-100 dark:bg-${stat.color}-900/20 flex items-center justify-center text-${stat.color}-600 dark:text-${stat.color}-400 mb-4`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {loading ? '...' : stat.value}
                            </p>
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                {stat.label}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* AI & Quick Actions */}
                <div className="lg:col-span-2 space-y-8">
                    {/* AI Assistant Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 to-violet-600 p-8 md:p-10 text-white shadow-2xl shadow-indigo-600/20"
                    >
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-black/10 rounded-full blur-3xl opacity-50"></div>

                        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-2 max-w-lg">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-widest mb-2">
                                    <Sparkles className="w-3 h-3" />
                                    <span>AI Assistant Ready</span>
                                </div>
                                <h2 className="text-3xl font-black tracking-tight">
                                    Need help with analysis?
                                </h2>
                                <p className="text-indigo-100 text-lg font-medium leading-relaxed">
                                    I can help you analyze datasets, generate SQL queries, or draft reports in seconds.
                                </p>
                            </div>
                            <Button variant="secondary" size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 border-none shadow-xl">
                                Ask Copilot <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </motion.div>

                    {/* Quick Actions Grid */}
                    <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" />
                            Quick Actions
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: 'New Dataset', icon: FolderOpen, href: '/app/upload', color: 'blue' },
                                { label: 'New Document', icon: FileText, href: '/app/docs', color: 'emerald' },
                                { label: 'Team Chat', icon: MessageCircle, href: '/app/chat', color: 'violet' },
                                { label: 'Invite Member', icon: Users, href: '/app/team', color: 'rose' }
                            ].map((action, i) => (
                                <Link to={action.href} key={i}>
                                    <motion.div
                                        whileHover={{ y: -4 }}
                                        className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[24px] hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/50 transition-all group"
                                    >
                                        <div className={`w-12 h-12 rounded-2xl bg-${action.color}-50 dark:bg-${action.color}-900/20 flex items-center justify-center text-${action.color}-600 dark:text-${action.color}-400 mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                            <action.icon className="w-6 h-6" />
                                        </div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{action.label}</h4>
                                    </motion.div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Recent Activity / Tips */}
                <div className="space-y-8">
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[32px] p-8 border border-slate-200 dark:border-slate-800">
                        <h3 className="font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                            Getting Started
                        </h3>
                        <ul className="space-y-4">
                            {[
                                { text: "Upload your first dataset", done: Number(stats[3].value) > 0 },
                                { text: "Create a project document", done: Number(stats[1].value) > 0 },
                                { text: "Invite your team members", done: false }, // Hard to track easily without another fetch
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent'}`}>
                                        <ArrowRight className="w-3 h-3" />
                                    </div>
                                    <span className={`text-sm font-bold ${item.done ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {item.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomeView;

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
