import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Home,
    FileText,
    Table2,
    BarChart3,
    CheckSquare,
    MessageCircle,
    Zap,
    FolderOpen,
    Bell,
    Search,
    Sparkles,
    Plus,
    ChevronDown,
    ChevronRight,
    Settings,
    LogOut,
    Clock,
    User
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Avatar, Badge } from '../UI';

interface SidebarSection {
    id: string;
    icon: React.ElementType;
    label: string;
    route?: string;
    shortcut?: string;
    badge?: number;
    children?: {
        icon: React.ElementType;
        label: string;
        route: string;
    }[];
}

const SECTIONS: SidebarSection[] = [
    {
        id: 'home',
        icon: Home,
        label: 'Home',
        route: '/app'
    },
    {
        id: 'workspace',
        icon: FolderOpen,
        label: 'Workspace',
        children: [
            { icon: FileText, label: 'Docs', route: '/app/docs' },
            { icon: Table2, label: 'Sheets', route: '/app/sheets' },
            { icon: BarChart3, label: 'Boards', route: '/app/boards' },
            { icon: CheckSquare, label: 'Tasks', route: '/app/tasks' },
            { icon: MessageCircle, label: 'Chat', route: '/app/chat' },
            { icon: Zap, label: 'Flows', route: '/app/flows' },
            { icon: FolderOpen, label: 'Files', route: '/app/files' }
        ]
    },
    {
        id: 'inbox',
        icon: Bell,
        label: 'Inbox',
        route: '/app/inbox',
        badge: 5
    }
];

interface UnifiedSidebarProps {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    onOpenCommandPalette?: () => void;
    onOpenAI?: () => void;
}

export const UnifiedSidebar: React.FC<UnifiedSidebarProps> = ({
    collapsed = false,
    onToggleCollapse,
    onOpenCommandPalette,
    onOpenAI
}) => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();

    const [expanded, setExpanded] = useState<string | null>('workspace');
    const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    const recentItems = [
        { type: 'sheet', name: 'Sales Data Q1', route: '/app/sheets/1' },
        { type: 'board', name: 'Revenue Dashboard', route: '/app/boards/1' },
        { type: 'doc', name: 'Project Plan', route: '/app/docs/1' }
    ];

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'sheet': return Table2;
            case 'board': return BarChart3;
            case 'doc': return FileText;
            default: return FileText;
        }
    };

    return (
        <aside
            className={`
                flex flex-col h-full
                bg-slate-950 border-r border-slate-800
                transition-all duration-300
                ${collapsed ? 'w-16' : 'w-60'}
            `}
        >
            {/* Workspace Selector */}
            <div className="p-3 border-b border-slate-800">
                <button
                    onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
                    className={`
                        w-full flex items-center gap-3 p-2 rounded-xl
                        bg-slate-900 hover:bg-slate-800 transition-colors
                        ${collapsed ? 'justify-center' : ''}
                    `}
                >
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        {activeWorkspace?.name?.charAt(0) || 'T'}
                    </div>
                    {!collapsed && (
                        <>
                            <div className="flex-1 text-left">
                                <div className="text-sm font-medium text-white truncate">
                                    {activeWorkspace?.name || 'ToEasy'}
                                </div>
                                <div className="text-xs text-slate-500">
                                    Free Plan
                                </div>
                            </div>
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                        </>
                    )}
                </button>
            </div>

            {/* Quick Actions */}
            <div className="p-3 space-y-2">
                {/* Quick Create */}
                <button
                    className={`
                        w-full flex items-center gap-3 p-2.5 rounded-xl
                        bg-blue-600 hover:bg-blue-700
                        text-white transition-all
                        ${collapsed ? 'justify-center' : ''}
                    `}
                >
                    <Plus className="w-4 h-4" />
                    {!collapsed && <span className="text-sm font-medium">Quick Create</span>}
                </button>

                {/* Search / Command Palette */}
                <button
                    onClick={onOpenCommandPalette}
                    className={`
                        w-full flex items-center gap-3 p-2.5 rounded-xl
                        bg-slate-900 hover:bg-slate-800 transition-colors
                        text-slate-400 hover:text-white
                        ${collapsed ? 'justify-center' : ''}
                    `}
                >
                    <Search className="w-4 h-4" />
                    {!collapsed && (
                        <>
                            <span className="text-sm flex-1 text-left">Search...</span>
                            <kbd className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">⌘K</kbd>
                        </>
                    )}
                </button>

                {/* AI Copilot */}
                <button
                    onClick={onOpenAI}
                    className={`
                        w-full flex items-center gap-3 p-2.5 rounded-xl
                        bg-slate-900 hover:bg-slate-800 transition-colors
                        text-slate-400 hover:text-white
                        ${collapsed ? 'justify-center' : ''}
                    `}
                >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    {!collapsed && <span className="text-sm">AI Copilot</span>}
                </button>
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                {SECTIONS.map((section) => (
                    <div key={section.id}>
                        {section.children ? (
                            // Expandable Section
                            <>
                                <button
                                    onClick={() => setExpanded(expanded === section.id ? null : section.id)}
                                    className={`
                                        w-full flex items-center gap-3 p-2 rounded-xl
                                        text-slate-400 hover:text-white hover:bg-slate-800/50
                                        transition-colors
                                        ${collapsed ? 'justify-center' : ''}
                                    `}
                                >
                                    <section.icon className="w-5 h-5" />
                                    {!collapsed && (
                                        <>
                                            <span className="flex-1 text-left text-sm font-medium">
                                                {section.label}
                                            </span>
                                            <ChevronRight
                                                className={`w-4 h-4 transition-transform ${expanded === section.id ? 'rotate-90' : ''
                                                    }`}
                                            />
                                        </>
                                    )}
                                </button>

                                <AnimatePresence>
                                    {expanded === section.id && !collapsed && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden ml-3 mt-1 space-y-1"
                                        >
                                            {section.children.map((child) => (
                                                <NavLink
                                                    key={child.route}
                                                    to={child.route}
                                                    className={({ isActive }) => `
                                                        flex items-center gap-3 p-2 rounded-xl
                                                        transition-colors text-sm
                                                        ${isActive
                                                            ? 'bg-blue-600 text-white'
                                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                                        }
                                                    `}
                                                >
                                                    <child.icon className="w-4 h-4" />
                                                    <span>{child.label}</span>
                                                </NavLink>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        ) : (
                            // Simple Link
                            <NavLink
                                to={section.route!}
                                className={({ isActive }) => `
                                    flex items-center gap-3 p-2 rounded-xl
                                    transition-colors
                                    ${isActive
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                    }
                                    ${collapsed ? 'justify-center' : ''}
                                `}
                            >
                                <section.icon className="w-5 h-5" />
                                {!collapsed && (
                                    <>
                                        <span className="flex-1 text-sm font-medium">{section.label}</span>
                                        {section.badge && (
                                            <Badge variant="primary" size="sm">{section.badge}</Badge>
                                        )}
                                    </>
                                )}
                            </NavLink>
                        )}
                    </div>
                ))}
            </nav>

            {/* Recent Items */}
            {!collapsed && (
                <div className="p-3 border-t border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2 px-2">
                        <Clock className="w-3 h-3" />
                        <span>Recent</span>
                    </div>
                    <div className="space-y-1">
                        {recentItems.map((item, index) => {
                            const Icon = getTypeIcon(item.type);
                            return (
                                <NavLink
                                    key={index}
                                    to={item.route}
                                    className="flex items-center gap-2 p-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="truncate">{item.name}</span>
                                </NavLink>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* User Menu */}
            <div className="p-3 border-t border-slate-800">
                <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`
                        w-full flex items-center gap-3 p-2 rounded-xl
                        hover:bg-slate-800/50 transition-colors
                        ${collapsed ? 'justify-center' : ''}
                    `}
                >
                    <Avatar
                        name={user?.name || user?.email || 'User'}
                        size="sm"
                        status="online"
                    />
                    {!collapsed && (
                        <>
                            <div className="flex-1 text-left">
                                <div className="text-sm font-medium text-white truncate">
                                    {user?.name || 'User'}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                    {user?.email}
                                </div>
                            </div>
                            <Settings className="w-4 h-4 text-slate-500" />
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
};

export default UnifiedSidebar;
