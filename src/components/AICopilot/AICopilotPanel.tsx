import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dataset } from '../../../types';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    actions?: CopilotAction[];
}

interface CopilotAction {
    id: string;
    label: string;
    icon: string;
    type: 'navigate' | 'execute' | 'generate';
    payload: any;
}

interface AICopilotPanelProps {
    isOpen: boolean;
    onClose: () => void;
    dataset?: Dataset;
    currentView: 'dashboard' | 'clean' | 'report' | 'upload' | 'other';
    onAction?: (action: CopilotAction) => void;
    onAsk: (query: string) => Promise<string>;
}

const QUICK_PROMPTS = {
    clean: [
        { icon: '🔍', label: 'Find issues', prompt: 'What issues exist in my data?' },
        { icon: '🧹', label: 'Suggest fixes', prompt: 'How should I clean this data?' },
        { icon: '📊', label: 'Quality score', prompt: 'What is my data quality score?' },
    ],
    dashboard: [
        { icon: '📈', label: 'Key insights', prompt: 'What are the key insights from this data?' },
        { icon: '🎯', label: 'Add KPI', prompt: 'What KPIs should I track?' },
        { icon: '📊', label: 'Best chart', prompt: 'What chart would best visualize this data?' },
    ],
    report: [
        { icon: '📝', label: 'Executive summary', prompt: 'Write an executive summary' },
        { icon: '💡', label: 'Key findings', prompt: 'What are the key findings?' },
        { icon: '🎯', label: 'Recommendations', prompt: 'What actions do you recommend?' },
    ],
    upload: [
        { icon: '🔍', label: 'Data preview', prompt: 'What does this data contain?' },
        { icon: '📋', label: 'Column analysis', prompt: 'Analyze the columns in this dataset' },
        { icon: '⚠️', label: 'Potential issues', prompt: 'Are there any potential issues?' },
    ],
    other: [
        { icon: '❓', label: 'Help me', prompt: 'How can I use ToEasy effectively?' },
        { icon: '🚀', label: 'Get started', prompt: 'What should I do first?' },
        { icon: '📖', label: 'Features', prompt: 'What features are available?' },
    ]
};

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({
    isOpen,
    onClose,
    dataset,
    currentView,
    onAction,
    onAsk
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSend = useCallback(async (text: string = input) => {
        if (!text.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await onAsk(text.trim());

            // Parse any action commands from the response
            const actions: CopilotAction[] = [];

            // Simple heuristic: if response mentions creating something, add action
            if (response.toLowerCase().includes('create a chart')) {
                actions.push({
                    id: 'create-chart',
                    label: 'Create Chart',
                    icon: '📊',
                    type: 'execute',
                    payload: { action: 'create-chart' }
                });
            }
            if (response.toLowerCase().includes('go to dashboard')) {
                actions.push({
                    id: 'nav-dashboard',
                    label: 'Open Dashboard',
                    icon: '📈',
                    type: 'navigate',
                    payload: { route: '/app/dashboard' }
                });
            }

            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: response,
                timestamp: new Date(),
                actions: actions.length > 0 ? actions : undefined
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, onAsk]);

    const handleVoiceInput = useCallback(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Voice input is not supported in your browser.');
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            handleSend(transcript);
        };

        recognition.onerror = () => setIsListening(false);

        recognition.start();
    }, [handleSend]);

    const quickPrompts = QUICK_PROMPTS[currentView] || QUICK_PROMPTS.other;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-96 bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <span className="text-xl">🤖</span>
                                </div>
                                <div>
                                    <h2 className="font-black text-slate-900 dark:text-white">AI Copilot</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {dataset ? `Working with ${dataset.name}` : 'Ready to help'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                            {messages.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center mb-4">
                                        <span className="text-3xl">💬</span>
                                    </div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">How can I help?</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        Ask me anything about your data
                                    </p>

                                    {/* Quick Prompts */}
                                    <div className="mt-6 space-y-2">
                                        {quickPrompts.map((qp, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSend(qp.prompt)}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl text-left transition-colors flex items-center gap-3 group"
                                            >
                                                <span className="text-lg">{qp.icon}</span>
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                    {qp.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                messages.map(message => (
                                    <motion.div
                                        key={message.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[85%] ${message.role === 'user'
                                                ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl rounded-tl-sm'
                                            } px-4 py-3`}>
                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                                            {/* Action Buttons */}
                                            {message.actions && message.actions.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {message.actions.map(action => (
                                                        <button
                                                            key={action.id}
                                                            onClick={() => onAction?.(action)}
                                                            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                                                        >
                                                            <span>{action.icon}</span>
                                                            <span>{action.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))
                            )}

                            {/* Loading */}
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-start"
                                >
                                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                            <span className="text-xs text-slate-500">Thinking...</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                            <div className="flex items-center gap-2">
                                {/* Voice Button */}
                                <button
                                    onClick={handleVoiceInput}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isListening
                                            ? 'bg-rose-500 text-white animate-pulse'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600'
                                        }`}
                                    title="Voice input"
                                >
                                    {isListening ? '🔴' : '🎤'}
                                </button>

                                {/* Text Input */}
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder="Ask AI anything..."
                                    className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />

                                {/* Send Button */}
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isLoading}
                                    className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 rounded-xl flex items-center justify-center text-white transition-colors disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        '→'
                                    )}
                                </button>
                            </div>

                            {/* Keyboard hint */}
                            <p className="mt-2 text-center text-xs text-slate-400">
                                Press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">Enter</kbd> to send
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default AICopilotPanel;
