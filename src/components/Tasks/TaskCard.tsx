import React, { useState } from 'react';
import { motion, Reorder, useDragControls } from 'framer-motion';
import {
    GripVertical,
    Plus,
    MoreHorizontal,
    Calendar,
    User,
    Tag,
    MessageCircle,
    Paperclip,
    Flag,
    Clock
} from 'lucide-react';
import { Avatar, Badge, Button } from '../UI';

// Types
export interface Task {
    id: string;
    title: string;
    description?: string;
    status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assignee?: { id: string; name: string; avatar?: string };
    dueDate?: Date;
    tags?: string[];
    comments?: number;
    attachments?: number;
    subtasks?: { total: number; completed: number };
}

interface TaskCardProps {
    task: Task;
    onClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
}

const priorityColors: Record<Task['priority'], { bg: string; text: string; dot: string }> = {
    low: { bg: 'bg-slate-500/20', text: 'text-slate-400', dot: 'bg-slate-400' },
    medium: { bg: 'bg-sky-500/20', text: 'text-sky-400', dot: 'bg-sky-400' },
    high: { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
    urgent: { bg: 'bg-rose-500/20', text: 'text-rose-400', dot: 'bg-rose-400' }
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onContextMenu }) => {
    const [isHovered, setIsHovered] = useState(false);
    const dragControls = useDragControls();
    const priority = priorityColors[task.priority];

    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            onClick={onClick}
            onContextMenu={onContextMenu}
            className="group relative bg-slate-800/50 border border-slate-700 rounded-xl p-4 cursor-pointer hover:border-slate-600 hover:shadow-lg transition-all"
        >
            {/* Drag Handle */}
            <div
                className={`absolute -left-2 top-1/2 -translate-y-1/2 p-1 rounded cursor-grab text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-all ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                onPointerDown={(e) => dragControls.start(e)}
            >
                <GripVertical className="w-4 h-4" />
            </div>

            {/* Priority Indicator */}
            <div className="flex items-center gap-2 mb-3">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${priority.bg} ${priority.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                    {task.priority}
                </div>

                {task.tags?.slice(0, 2).map((tag, i) => (
                    <Badge key={i} variant="default" size="sm">
                        {tag}
                    </Badge>
                ))}
            </div>

            {/* Title */}
            <h4 className="text-white font-medium mb-2 line-clamp-2">
                {task.title}
            </h4>

            {/* Description preview */}
            {task.description && (
                <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                    {task.description}
                </p>
            )}

            {/* Subtasks progress */}
            {task.subtasks && task.subtasks.total > 0 && (
                <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>Subtasks</span>
                        <span>{task.subtasks.completed}/{task.subtasks.total}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${(task.subtasks.completed / task.subtasks.total) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
                <div className="flex items-center gap-3">
                    {/* Due Date */}
                    {task.dueDate && (
                        <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-rose-400' : 'text-slate-400'}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                                {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                    )}

                    {/* Comments */}
                    {task.comments && task.comments > 0 && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{task.comments}</span>
                        </div>
                    )}

                    {/* Attachments */}
                    {task.attachments && task.attachments > 0 && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>{task.attachments}</span>
                        </div>
                    )}
                </div>

                {/* Assignee */}
                {task.assignee && (
                    <Avatar
                        name={task.assignee.name}
                        src={task.assignee.avatar}
                        size="xs"
                    />
                )}
            </div>

            {/* Hover Actions */}
            {isHovered && (
                <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>
            )}
        </motion.div>
    );
};

export default TaskCard;
