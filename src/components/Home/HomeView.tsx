import React from 'react';
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
    TrendingUp
} from 'lucide-react';
import { Card, Button, Badge, Avatar } from '../UI';

interface QuickAction {
    icon: React.ElementType;
    label: string;
    description: string;
    href: string;
    color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    { icon: FileText, label: 'New Doc', description: 'Create a document', href: '/app/docs/new', color: 'indigo' },
    { icon: Table2, label: 'New Sheet', description: 'Create a spreadsheet', href: '/app/sheets/new', color: 'emerald' },
    { icon: BarChart3, label: 'New Dashboard', description: 'Build analytics', href: '/app/boards/new', color: 'amber' },
    { icon: CheckSquare, label: 'New Task', description: 'Track work', href: '/app/tasks/new', color: 'sky' },
    { icon: Zap, label: 'New Flow', description: 'Automate workflows', href: '/app/flows/new', color: 'purple' }
];

const RECENT_ITEMS = [
    { type: 'sheet', name: 'Sales Data Q1', updatedAt: '2 hours ago', icon: Table2 },
    { type: 'board', name: 'Revenue Dashboard', updatedAt: 'Yesterday', icon: BarChart3 },
    { type: 'doc', name: 'Project Plan', updatedAt: '3 days ago', icon: FileText },
    { type: 'task', name: 'Design review', updatedAt: '1 week ago', icon: CheckSquare }
];

const STATS = [
    { label: 'Active Tasks', value: '12', change: '+3' },
    { label: 'Unread Messages', value: '5', change: '+5' },
    { label: 'Running Flows', value: '2', change: '0' },
    { label: 'Team Members', value: '8', change: '+1' }
];

export const HomeView: React.FC = () => {
    const userName = 'User'; // Would come from auth context

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
                        Welcome back, {userName}! 👋
                    </h1>
                    <p className="text-slate-400">
                        What would you like to work on today?
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {STATS.map((stat, index) => (
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
                </motion.div>

                {/* Recent Items */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">Recent</h2>
                        <Button variant="ghost" size="sm">
                            View All
                        </Button>
                    </div>
                    <Card padding="none">
                        {RECENT_ITEMS.map((item, index) => (
                            <div
                                key={index}
                                className={`flex items-center gap-4 p-4 hover:bg-slate-800/50 cursor-pointer transition-colors ${index !== RECENT_ITEMS.length - 1 ? 'border-b border-slate-800' : ''
                                    }`}
                            >
                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                                    <item.icon className="w-5 h-5 text-slate-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium text-white">{item.name}</h3>
                                    <p className="text-xs text-slate-500">{item.type}</p>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Clock className="w-4 h-4" />
                                    {item.updatedAt}
                                </div>
                            </div>
                        ))}
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};

export default HomeView;
