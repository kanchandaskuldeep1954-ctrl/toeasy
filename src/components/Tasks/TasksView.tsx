import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Plus,
    Filter,
    SortAsc,
    Grid,
    List,
    Calendar,
    Search,
    MoreHorizontal,
    ChevronDown,
    X,
    Loader2
} from 'lucide-react';
import { KanbanBoard } from './KanbanBoard';
import { Task } from './TaskCard';
import { Button, Input, Modal, Badge, Avatar } from '../UI';
import { tasksService } from '../../../services/workOsService';
import { useWorkspace } from '../../contexts/WorkspaceContext';

interface TasksViewProps {
    workspaceId?: string;
}

export const TasksView: React.FC<TasksViewProps> = ({ workspaceId: propWorkspaceId }) => {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = propWorkspaceId || currentWorkspace?.id;

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'kanban' | 'list' | 'calendar'>('kanban');
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPriority, setFilterPriority] = useState<string | null>(null);

    // Form state for new task
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('medium');
    const [newTaskDueDate, setNewTaskDueDate] = useState('');
    const [newTaskStatus, setNewTaskStatus] = useState<Task['status']>('backlog');
    const [createLoading, setCreateLoading] = useState(false);

    // Fetch tasks
    useEffect(() => {
        const fetchTasks = async () => {
            if (!workspaceId) return;
            setLoading(true);
            try {
                const data = await tasksService.getAll(workspaceId);
                // Transform API data to component format
                const transformedTasks: Task[] = (data || []).map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    status: mapApiStatus(t.status),
                    priority: t.priority || 'medium',
                    assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.full_name || t.assignee.email } : undefined,
                    dueDate: t.due_date ? new Date(t.due_date) : undefined,
                    tags: t.tags || [],
                    comments: t.comment_count || 0
                }));
                setTasks(transformedTasks);
            } catch (error) {
                console.error('Failed to fetch tasks:', error);
                setTasks([]);
            } finally {
                setLoading(false);
            }
        };
        fetchTasks();
    }, [workspaceId]);

    // Map API status to component status
    const mapApiStatus = (status: string): Task['status'] => {
        const statusMap: Record<string, Task['status']> = {
            'backlog': 'backlog',
            'todo': 'todo',
            'in_progress': 'in-progress',
            'review': 'review',
            'done': 'done'
        };
        return statusMap[status] || 'backlog';
    };

    // Map component status to API status
    const mapToApiStatus = (status: Task['status']): string => {
        const statusMap: Record<Task['status'], string> = {
            'backlog': 'backlog',
            'todo': 'todo',
            'in-progress': 'in_progress',
            'review': 'review',
            'done': 'done'
        };
        return statusMap[status];
    };

    const handleAddTask = useCallback((status: Task['status']) => {
        setNewTaskStatus(status);
        setShowCreateTask(true);
    }, []);

    const handleTaskClick = useCallback((task: Task) => {
        setSelectedTask(task);
    }, []);

    const handleCreateTask = async () => {
        if (!newTaskTitle.trim() || !workspaceId) return;
        setCreateLoading(true);
        try {
            const newTask = await tasksService.create({
                title: newTaskTitle.trim(),
                description: newTaskDescription.trim() || undefined,
                status: mapToApiStatus(newTaskStatus),
                priority: newTaskPriority,
                due_date: newTaskDueDate || undefined,
                workspace_id: workspaceId
            });

            // Add to local state
            const transformedTask: Task = {
                id: newTask.id,
                title: newTask.title,
                description: newTask.description,
                status: mapApiStatus(newTask.status),
                priority: newTask.priority || 'medium',
                dueDate: newTask.due_date ? new Date(newTask.due_date) : undefined,
                tags: newTask.tags || []
            };
            setTasks(prev => [...prev, transformedTask]);

            // Reset form
            setShowCreateTask(false);
            setNewTaskTitle('');
            setNewTaskDescription('');
            setNewTaskPriority('medium');
            setNewTaskDueDate('');
            setNewTaskStatus('backlog');
        } catch (error) {
            console.error('Failed to create task:', error);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleUpdateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
        // Optimistic update
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: newStatus } : t
        ));

        try {
            await tasksService.update(taskId, { status: mapToApiStatus(newStatus) });
        } catch (error) {
            console.error('Failed to update task:', error);
            // Revert on error - would need to store previous state
        }
    };

    // Filter tasks
    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPriority = !filterPriority || task.priority === filterPriority;
        return matchesSearch && matchesPriority;
    });

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-950">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                    <p className="text-slate-400">Loading tasks...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-950">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-white">Tasks</h1>

                    {/* Search */}
                    <div className="w-64">
                        <Input
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            inputSize="sm"
                            leftIcon={<Search className="w-4 h-4" />}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Filters */}
                    <Button variant="ghost" size="sm" leftIcon={<Filter className="w-4 h-4" />}>
                        Filter
                    </Button>

                    <Button variant="ghost" size="sm" leftIcon={<SortAsc className="w-4 h-4" />}>
                        Sort
                    </Button>

                    {/* View Toggle */}
                    <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setView('kanban')}
                            className={`p-2 transition-colors ${view === 'kanban'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className={`p-2 transition-colors ${view === 'list'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setView('calendar')}
                            className={`p-2 transition-colors ${view === 'calendar'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <Calendar className="w-4 h-4" />
                        </button>
                    </div>

                    <Button
                        onClick={() => setShowCreateTask(true)}
                        leftIcon={<Plus className="w-4 h-4" />}
                    >
                        New Task
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden p-6">
                {view === 'kanban' && (
                    <KanbanBoard
                        tasks={filteredTasks}
                        onTaskClick={handleTaskClick}
                        onAddTask={handleAddTask}
                    />
                )}

                {view === 'list' && (
                    <div className="text-slate-400 text-center py-12">
                        List view coming soon...
                    </div>
                )}

                {view === 'calendar' && (
                    <div className="text-slate-400 text-center py-12">
                        Calendar view coming soon...
                    </div>
                )}
            </main>

            {/* Create Task Modal */}
            <Modal
                isOpen={showCreateTask}
                onClose={() => setShowCreateTask(false)}
                title="Create New Task"
                size="lg"
            >
                <div className="space-y-4">
                    <Input
                        label="Task Title"
                        placeholder="What needs to be done?"
                        autoFocus
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                    />

                    <Input
                        label="Description (optional)"
                        placeholder="Add more details..."
                        value={newTaskDescription}
                        onChange={(e) => setNewTaskDescription(e.target.value)}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                Priority
                            </label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                                value={newTaskPriority}
                                onChange={(e) => setNewTaskPriority(e.target.value as Task['priority'])}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                Due Date
                            </label>
                            <input
                                type="date"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                                value={newTaskDueDate}
                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setShowCreateTask(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateTask}
                            disabled={!newTaskTitle.trim() || createLoading}
                        >
                            {createLoading ? 'Creating...' : 'Create Task'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Task Detail Slide-over */}
            {selectedTask && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-50"
                >
                    <div className="flex items-center justify-between p-4 border-b border-slate-800">
                        <h2 className="font-semibold text-white">Task Details</h2>
                        <button
                            onClick={() => setSelectedTask(null)}
                            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        <h3 className="text-lg font-medium text-white">
                            {selectedTask.title}
                        </h3>

                        {selectedTask.description && (
                            <p className="text-slate-400">{selectedTask.description}</p>
                        )}

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">Status</span>
                                <Badge variant="primary">{selectedTask.status}</Badge>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">Priority</span>
                                <Badge variant={
                                    selectedTask.priority === 'urgent' ? 'danger' :
                                        selectedTask.priority === 'high' ? 'warning' :
                                            'default'
                                }>
                                    {selectedTask.priority}
                                </Badge>
                            </div>

                            {selectedTask.assignee && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">Assignee</span>
                                    <div className="flex items-center gap-2">
                                        <Avatar name={selectedTask.assignee.name} size="xs" />
                                        <span className="text-sm text-white">
                                            {selectedTask.assignee.name}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {selectedTask.dueDate && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">Due Date</span>
                                    <span className="text-sm text-white">
                                        {new Date(selectedTask.dueDate).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default TasksView;
