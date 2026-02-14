import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Send,
    Paperclip,
    Smile,
    AtSign,
    Image,
    Code,
    Bold,
    Italic,
    Link2,
    Mic,
    X
} from 'lucide-react';
import { Button } from '../UI';

interface MessageInputProps {
    channelName?: string;
    onSendMessage: (content: string, attachments?: File[]) => void;
    placeholder?: string;
    disabled?: boolean;
    replyTo?: { id: string; userName: string; content: string };
    onCancelReply?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
    channelName = 'general',
    onSendMessage,
    placeholder,
    disabled = false,
    replyTo,
    onCancelReply
}) => {
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = useCallback(() => {
        if (!message.trim() && attachments.length === 0) return;
        onSendMessage(message.trim(), attachments);
        setMessage('');
        setAttachments([]);
    }, [message, attachments, onSendMessage]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const insertFormatting = (format: 'bold' | 'italic' | 'code' | 'link') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = message.substring(start, end);

        let newText = '';
        let newCursorPos = start;

        switch (format) {
            case 'bold':
                newText = `**${selected}**`;
                newCursorPos = selected ? end + 4 : start + 2;
                break;
            case 'italic':
                newText = `_${selected}_`;
                newCursorPos = selected ? end + 2 : start + 1;
                break;
            case 'code':
                newText = `\`${selected}\``;
                newCursorPos = selected ? end + 2 : start + 1;
                break;
            case 'link':
                newText = `[${selected}](url)`;
                newCursorPos = selected ? end + 7 : start + 1;
                break;
        }

        setMessage(prev => prev.substring(0, start) + newText + prev.substring(end));

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    return (
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
            {/* Reply Preview */}
            {replyTo && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-slate-800/50 border-l-2 border-blue-500"
                >
                    <div className="flex-1 min-w-0">
                        <span className="text-xs text-slate-400">Replying to </span>
                        <span className="text-xs font-medium text-white">{replyTo.userName}</span>
                        <p className="text-sm text-slate-500 truncate">{replyTo.content}</p>
                    </div>
                    <button
                        onClick={onCancelReply}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </motion.div>
            )}

            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {attachments.map((file, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-sm"
                        >
                            <Paperclip className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-300 truncate max-w-[150px]">
                                {file.name}
                            </span>
                            <button
                                onClick={() => removeAttachment(index)}
                                className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="rounded-xl bg-slate-900/50 border border-slate-700/50 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all backdrop-blur-sm shadow-lg">
                {/* Formatting Toolbar */}
                <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-700">
                    <button
                        onClick={() => insertFormatting('bold')}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Bold"
                    >
                        <Bold className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => insertFormatting('italic')}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Italic"
                    >
                        <Italic className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => insertFormatting('code')}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Code"
                    >
                        <Code className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => insertFormatting('link')}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Link"
                    >
                        <Link2 className="w-4 h-4" />
                    </button>

                    <div className="w-px h-4 bg-slate-700 mx-1" />

                    <button
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Mention"
                    >
                        <AtSign className="w-4 h-4" />
                    </button>
                    <button
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Emoji"
                    >
                        <Smile className="w-4 h-4" />
                    </button>
                </div>

                {/* Textarea */}
                <div className="flex items-end gap-2 p-3">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder || `Message #${channelName}`}
                        disabled={disabled}
                        rows={1}
                        className="flex-1 bg-transparent text-white placeholder-slate-500 resize-none outline-none max-h-32"
                        style={{ minHeight: '24px' }}
                    />

                    <div className="flex items-center gap-1">
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Attach file"
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Add image"
                        >
                            <Image className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => setIsRecording(!isRecording)}
                            className={`p-2 rounded-lg transition-colors ${isRecording
                                ? 'bg-rose-600 text-white'
                                : 'hover:bg-slate-700 text-slate-400 hover:text-white'
                                }`}
                            title="Voice message"
                        >
                            <Mic className="w-5 h-5" />
                        </button>

                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={disabled || (!message.trim() && attachments.length === 0)}
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Character limit / typing indicator */}
            <div className="flex items-center justify-between mt-2 px-1 text-xs text-slate-500">
                <span>Shift + Enter for new line</span>
                <span>{message.length} / 4000</span>
            </div>
        </div>
    );
};

export default MessageInput;
