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
            <div className="bg-white p-2 rounded border border-indigo-200 shadow-sm h-full flex flex-col">
                <textarea
                    value={localContent}
                    onChange={(e) => setLocalContent(e.target.value)}
                    className="flex-1 w-full p-2 text-sm font-mono border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                    autoFocus
                    placeholder="Enter markdown text..."
                />
                <div className="mt-2 flex justify-end gap-2">
                    <button
                        onClick={() => { setLocalContent(content); setIsEditing(false); }}
                        className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                        Save
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`prose prose-sm max-w-none p-2 h-full overflow-y-auto ${editable ? 'cursor-text hover:bg-gray-50' : ''} rounded transition-colors`}
            onDoubleClick={handleDoubleClick}
            title={editable ? "Double-click to edit" : ""}
        >
            <ReactMarkdown>{content || '*Double-click to add text*'}</ReactMarkdown>
        </div>
    );
};
