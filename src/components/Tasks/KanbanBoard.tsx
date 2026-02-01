import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
    Plus,
    MoreHorizontal,
    Filter,
    SortAsc,
    Grid,
    List,
    Calendar
} from 'lucide-react';
import { TaskCard, Task } from './TaskCard';
import { Button, Badge } from '../UI';

interface Column {
    id: string;
    title: string;
    status: Task['status'];
    color: string;
}

const COLUMNS: Column[] = [
    { id: 'backlog', title: 'Backlog', status: 'backlog', color: 'slate' },
    { id: 'todo', title: 'To Do', status: 'todo', color: 'sky' },
    { id: 'in-progress', title: 'In Progress', status: 'in-progress', color: 'amber' },
    { id: 'review', title: 'In Review', status: 'review', color: 'purple' },
    { id: 'done', title: 'Done', status: 'done', color: 'emerald' }
];

const MOCK_TASKS: Task[] = [
    {
        id: '1',
        title: 'Design new dashboard layout',
        description: 'Create a modern, responsive dashboard design with dark mode support.',
        status: 'in-progress',
        priority: 'high',
        assignee: { id: '1', name: 'John Doe' },
        dueDate: new Date(Date.now() + 86400000 * 3),
        tags: ['design', 'ui'],
        comments: 5,
        subtasks: { total: 4, completed: 2 }
    },
    {
        id: '2',
        title: 'Implement chat module',
        description: 'Build real-time messaging with WebSocket support.',
        status: 'in-progress',
        priority: 'urgent',
        assignee: { id: '2', name: 'Sarah Smith' },
        dueDate: new Date(Date.now() + 86400000 * 2),
        tags: ['backend', 'frontend'],
        comments: 12,
        attachments: 3
    },
    {
        id: '3',
        title: 'Set up CI/CD pipeline',
        status: 'todo',
        priority: 'medium',
        assignee: { id: '3', name: 'Mike Johnson' },
        tags: ['devops']
    },
    {
        id: '4',
        title: 'Write API documentation',
        status: 'todo',
        priority: 'low',
        dueDate: new Date(Date.now() + 86400000 * 7)
    },
    {
        id: '5',
        title: 'User research interviews',
        status: 'backlog',
        priority: 'medium',
        tags: ['research']
    },
    {
        id: '6',
        title: 'Fix mobile responsiveness',
        status: 'review',
        priority: 'high',
        assignee: { id: '1', name: 'John Doe' },
        comments: 3
    },
    {
        id: '7',
        title: 'Database optimization',
        status: 'done',
        priority: 'medium',
        assignee: { id: '2', name: 'Sarah Smith' }
    }
];

interface KanbanBoardProps {
    tasks?: Task[];
    onTaskClick?: (task: Task) => void;
    onAddTask?: (status: Task['status']) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
    tasks = MOCK_TASKS,
    onTaskClick,
    onAddTask
}) => {
    const [items, setItems] = useState(tasks);

    const getTasksForColumn = (status: Task['status']) => {
        return items.filter(task => task.status === status);
    };

    const handleDragEnd = useCallback((taskId: string, newStatus: Task['status']) => {
        setItems(prev =>
            prev.map(task =>
                task.id === taskId ? { ...task, status: newStatus } : task
            )
        );
    }, []);

    const columnColorClasses: Record<string, string> = {
        slate: 'bg-slate-500',
        sky: 'bg-sky-500',
        amber: 'bg-amber-500',
        purple: 'bg-purple-500',
        emerald: 'bg-emerald-500'
    };

    return (
        <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
            {COLUMNS.map((column) => {
                const columnTasks = getTasksForColumn(column.status);

                return (
                    <div
                        key={column.id}
                        className="flex-shrink-0 w-80 flex flex-col"
                    >
                        {/* Column Header */}
                        <div className="flex items-center justify-between mb-3 px-1">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${columnColorClasses[column.color]}`} />
                                <h3 className="font-semibold text-white">
                                    {column.title}
                                </h3>
                                <Badge variant="default" size="sm">
                                    {columnTasks.length}
                                </Badge>
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => onAddTask?.(column.status)}
                                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                                <button className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Column Content */}
                        <div className="flex-1 space-y-3 min-h-[200px] p-2 rounded-xl bg-slate-900/50 border border-slate-800">
                            <AnimatePresence>
                                {columnTasks.map((task) => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        onClick={() => onTaskClick?.(task)}
                                    />
                                ))}
                            </AnimatePresence>

                            {columnTasks.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                                    <p className="text-sm">No tasks</p>
                                    <button
                                        onClick={() => onAddTask?.(column.status)}
                                        className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                                    >
                                        + Add task
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default KanbanBoard;
