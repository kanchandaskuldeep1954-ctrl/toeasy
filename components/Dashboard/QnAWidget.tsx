import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GroqService } from '../../services/groqService';
import { Dataset } from '../../types';

interface QnAWidgetProps {
    dataset: Dataset;
    context?: any; // Active dashboard config
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export const QnAWidget: React.FC<QnAWidgetProps> = ({ dataset, context }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const handleAsk = async (e?: React.FormEvent, customQuery?: string) => {
        e?.preventDefault();
        const activeQuery = customQuery || query;
        if (!activeQuery.trim() || isThinking) return;

        const userMsg: Message = { role: 'user', content: activeQuery, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setQuery('');
        setIsThinking(true);

        try {
            // Construct context from dashboard state
            const dashboardContext = context ? {
                reportContext: {
                    title: context.name || 'Dashboard Analysis',
                    sections: context.charts?.map((c: any) => ({
                        title: c.title,
                        reasoning: c.chartConfig?.trendline ? 'Trend analysis active' : 'Standard visualization'
                    }))
                }
            } : {};

            const answer = await GroqService.consultAgent(dataset, activeQuery, dashboardContext, messages.map(m => ({ role: m.role, text: m.content })).slice(-4));

            const aiMsg: Message = { role: 'assistant', content: answer, timestamp: new Date() };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'I encountered an error analyzing the data. Please try again.', timestamp: new Date() }]);
        } finally {
            setIsThinking(false);
        }
    };

    const suggestedQuestions = useMemo(() => {
        if (!context?.charts) return ['What are the key trends here?', 'Give me a summary of this dashboard.'];
        const titles = context.charts.map((c: any) => c.title).slice(0, 3);
        return [
            ...titles.map((t: string) => `Analyze ${t} for me.`),
            'What insights can I get from this data?',
            'What is the most interesting finding?'
        ];
    }, [context]);

    return (
        <div className={`fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-4 pointer-events-none ${isOpen ? 'pointer-events-auto' : ''}`}>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-[380px] h-[580px] flex flex-col overflow-hidden pointer-events-auto"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Analysis Copilot</h3>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-medium custom-scrollbar">
                            {messages.length === 0 && (
                                <div className="text-center mt-6">
                                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                                        <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Suggested Inquiries</p>
                                    <div className="flex flex-col gap-2">
                                        {suggestedQuestions.map((q, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleAsk(undefined, q)}
                                                className="text-[10px] text-left p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-xl hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all font-semibold text-slate-600 dark:text-slate-400"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] leading-relaxed shadow-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-none'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-bl-none border border-slate-200 dark:border-slate-700'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isThinking && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleAsk} className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="relative">
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Ask anything about the report..."
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl pl-4 pr-10 py-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                />
                                <button type="submit" disabled={!query.trim() || isThinking} className="absolute right-2 top-2 p-1.5 bg-white dark:bg-slate-700 rounded-lg text-indigo-500 hover:text-indigo-600 disabled:opacity-50 transition-colors shadow-sm">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all pointer-events-auto ${isOpen ? 'bg-indigo-600 text-white rotate-90' : 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-500'
                    }`}
            >
                {isOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                )}
            </motion.button>
        </div>
    );
};
