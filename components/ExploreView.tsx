
import React, { useState, useRef, useEffect } from 'react';
import { Dataset } from '../types';
import { GeminiService } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface ExploreViewProps {
  dataset: Dataset;
  onAIAction?: () => void;
}

const ExploreView: React.FC<ExploreViewProps> = ({ dataset, onAIAction }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; timestamp: Date }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date() }]);
    setLoading(true);

    try {
      if (onAIAction) onAIAction();
      const response = await GeminiService.askQuestion(dataset, userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date() }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "An error occurred. Please check your data or try again.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-10 py-8" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
             <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-3xl">🤖</div>
             <div className="space-y-2">
                <h3 className="text-2xl font-bold">Data Assistant</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md">Ask complex questions about your data. I can summarize trends, find outliers, and calculate metrics.</p>
             </div>
             <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {["Summarize key trends", "Average revenue", "Find anomalies", "Show group totals"].map(q => (
                  <button 
                    key={q} 
                    onClick={() => setInput(q)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-indigo-400 hover:text-indigo-600 transition-all"
                  >
                    {q}
                  </button>
                ))}
             </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
             <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-bold text-[10px] uppercase shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                {msg.role === 'user' ? 'You' : 'AI'}
             </div>
             <div className={`max-w-[85%] px-6 py-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-200 rounded-tr-none' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-tl-none shadow-sm'}`}>
                <div className="prose prose-sm dark:prose-invert prose-slate max-w-none text-sm leading-relaxed">
                   <ReactMarkdown 
                    components={{
                        table: ({node, ...props}) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden" {...props} /></div>,
                        th: ({node, ...props}) => <th className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider" {...props} />,
                        td: ({node, ...props}) => <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800" {...props} />,
                    }}
                   >
                    {msg.content}
                   </ReactMarkdown>
                </div>
                <div className="mt-4 text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                   {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
             </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-4 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800"></div>
            <div className="flex-1 space-y-2 py-2">
               <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-full w-24"></div>
               <div className="h-3 bg-slate-100 dark:bg-slate-900 rounded-full w-full"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your data..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-4 pr-24 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm shadow-sm"
          />
          <button 
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-3 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-lg font-bold text-xs uppercase transition-all"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
};

export default ExploreView;
