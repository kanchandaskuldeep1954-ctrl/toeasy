import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface TextWidgetProps {
    content: string;
    onUpdate?: (newContent: string) => void;
    editable?: boolean;
}

export const TextWidget: React.FC<TextWidgetProps> = ({ content, onUpdate, editable = false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localContent, setLocalContent] = useState(content);

    const handleSave = () => {
        if (onUpdate) onUpdate(localContent);
        setIsEditing(false);
    };

    const handleDoubleClick = () => {
        if (editable) setIsEditing(true);
    };

    if (isEditing) {
        return (
            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm h-full flex flex-col">
                <textarea
                    value={localContent}
                    onChange={(e) => setLocalContent(e.target.value)}
                    className="flex-1 w-full p-2 text-sm font-mono border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200"
                    autoFocus
                    placeholder="Enter markdown text..."
                />
                <div className="mt-2 flex justify-end gap-2">
                    <button
                        onClick={() => { setLocalContent(content); setIsEditing(false); }}
                        className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-2 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`prose prose-sm dark:prose-invert max-w-none p-2 h-full overflow-y-auto ${editable ? 'cursor-text hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''} rounded-lg transition-colors`}
            onDoubleClick={handleDoubleClick}
            title={editable ? "Double-click to edit" : ""}
        >
            <ReactMarkdown>{content || '*Double-click to add text*'}</ReactMarkdown>
        </div>
    );
};
