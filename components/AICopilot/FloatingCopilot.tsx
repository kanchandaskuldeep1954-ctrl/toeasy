/**
 * FloatingCopilot - AI assistant that floats on all views
 * Context-aware prompts and actions for the entire app
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    Sparkles,
    X,
    Send,
    Loader2,
    Lightbulb,
    BarChart3,
    FileText,
    CheckSquare,
    MessageCircle,
    Wand2
} from 'lucide-react';

export type CopilotContext = 'home' | 'sheets' | 'dashboard' | 'report' | 'tasks' | 'docs' | 'chat' | 'general';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface FloatingCopilotProps {
    context?: CopilotContext;
    contextData?: any; // dataset, document, task, etc.
    onAction?: (action: string, params: any) => void;
}

const CONTEXT_PROMPTS: Record<CopilotContext, string[]> = {
    home: ['What should I focus on today?', 'Summarize recent activity', 'Create a new project'],
    sheets: ['Clean this data', 'Find outliers', 'Generate formula', 'Create chart from selection'],
    dashboard: ['Explain this trend', 'Add a new KPI', 'Suggest improvements', 'Generate insights'],
    report: ['Write executive summary', 'Add recommendations', 'Improve clarity', 'Translate to formal'],
    tasks: ['Break down this task', 'Estimate completion time', 'Suggest priority', 'Add subtasks'],
    docs: ['Summarize this document', 'Expand this section', 'Fix grammar', 'Add table of contents'],
    chat: ['Summarize this thread', 'Extract action items', 'Draft a response', 'Schedule a meeting'],
    general: ['What can you help with?', 'Search my workspace', 'Create something new', 'Show shortcuts'],
};

const CONTEXT_ICONS: Record<CopilotContext, React.ReactNode> = {
    home: <Lightbulb className="w-4 h-4" />,
    sheets: <BarChart3 className="w-4 h-4" />,
    dashboard: <BarChart3 className="w-4 h-4" />,
    report: <FileText className="w-4 h-4" />,
    tasks: <CheckSquare className="w-4 h-4" />,
    docs: <FileText className="w-4 h-4" />,
    chat: <MessageCircle className="w-4 h-4" />,
    general: <Sparkles className="w-4 h-4" />,
};

export const FloatingCopilot: React.FC<FloatingCopilotProps> = ({
    context = 'general',
    contextData,
    onAction
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const suggestedPrompts = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.general;

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (query: string) => {
        if (!query.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: query,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsThinking(true);

        try {
            // Call AI service
            const { GroqService } = await import('../../src/services/groqService');

            let response = '';

            if (context === 'dashboard' && contextData) {
                response = await GroqService.consultVerifiedAgent(contextData, query);
            } else {
                // Generic chat response
                response = await GroqService.chat([{ role: 'user', content: query }]);
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsThinking(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-[9999] group flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-3 rounded-full shadow-2xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
            >
                <span className="text-xs font-bold uppercase tracking-wider max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 whitespace-nowrap">
                    AI Copilot
                </span>
                <div className="relative">
                    <Sparkles className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-600 rounded-full animate-pulse" />
                </div>
            </button>
        );
    }

    return (
        <div className={`fixed z-[9999] transition-all duration-300 ${isMinimized
                ? 'bottom-6 right-6 w-auto'
                : 'bottom-6 right-6 w-[90vw] max-w-[400px] md:w-96'
            }`}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200">
                {/* Header */}
                <div
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 p-3 flex justify-between items-center cursor-pointer"
                    onClick={() => setIsMinimized(!isMinimized)}
                >
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <div className="flex items-center gap-1.5">
                            {CONTEXT_ICONS[context]}
                            <span className="text-white text-xs font-bold uppercase tracking-wider">
                                AI Copilot
                            </span>
                        </div>
                        <span className="text-white/50 text-[9px] uppercase tracking-wider">
                            • {context}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                            className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                        >
                            <svg className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                            className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        {/* Messages */}
                        <div className="h-72 overflow-y-auto p-4 space-y-3 bg-slate-950/50 custom-scrollbar">
                            {messages.length === 0 ? (
                                <div className="text-center pt-8">
                                    <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                                        <Wand2 className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <p className="text-white font-bold text-sm mb-1">How can I help?</p>
                                    <p className="text-slate-500 text-[11px]">Ask anything or try a suggestion below</p>

                                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                                        {suggestedPrompts.slice(0, 3).map((prompt, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSubmit(prompt)}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600/20 border border-slate-700 hover:border-indigo-500/50 rounded-lg text-[10px] font-bold text-slate-400 hover:text-indigo-400 transition-all"
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {messages.map(msg => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${msg.role === 'user'
                                                    ? 'bg-indigo-600 text-white rounded-br-none'
                                                    : 'bg-slate-800 text-slate-300 rounded-bl-none border border-slate-700'
                                                }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {isThinking && (
                                        <div className="flex justify-start">
                                            <div className="bg-slate-800 border border-slate-700 rounded-xl rounded-bl-none px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                                                    <span className="text-[11px] text-slate-400">Thinking...</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSubmit(input)}
                                placeholder="Ask AI anything..."
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-white placeholder:text-slate-500"
                            />
                            <button
                                onClick={() => handleSubmit(input)}
                                disabled={isThinking || !input.trim()}
                                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                {isThinking ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default FloatingCopilot;
