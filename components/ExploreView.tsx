
import React, { useState, useRef, useEffect } from 'react';
import { Dataset, ChartSpec, DataRow } from '../types';
import { GroqService } from '../src/services/groqService';
import ReactMarkdown from 'react-markdown';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, AreaChart, Area
} from 'recharts';
import ReportView from './ReportView';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  chart?: ChartSpec;
  results?: DataRow[];
}

interface ExploreViewProps {
  dataset: Dataset;
  onAIAction?: () => void;
  onUpdate?: (updated: Dataset) => void;
}

const ExploreView: React.FC<ExploreViewProps> = ({ dataset, onAIAction, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'report'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
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

      // Enriched Context: Pass Dashboard Config so agent knows about charts/KPIs
      const context = {
        dashboardConfig: dataset.dashboardConfig,
        stats: dataset.stats,
        rowCount: dataset.data.length,
        kpis: dataset.kpis,
        appName: "Toeasy AI Data OS",
        appCapabilities: ["Clean", "Explore", "Dashboard", "Report", "Playground (SQL)"]
      };

      const response = await GroqService.consultVerifiedAgent(dataset, userMsg, context);

      const safeResponse = (response || '').toLowerCase();
      const safeUserMsg = (userMsg || '').toLowerCase();

      let chart: ChartSpec | undefined;
      // Heuristic to detect if agent suggests a chart
      if (safeResponse.includes('visual') || safeResponse.includes('chart') || safeUserMsg.includes('chart')) {
        // Try to find a relevant chart from existing dashboard config first
        if (dataset.dashboardConfig?.charts) {
          const relevant = dataset.dashboardConfig.charts.find(c => {
            if (!c) return false;
            const title = (c.title || '').toLowerCase();
            const type = (c.type || '').toLowerCase();
            return safeUserMsg.includes(title) || safeUserMsg.includes(type);
          });
          if (relevant) chart = relevant;
        }

        // If no relevant existing chart, maybe generate one (fallback)
        if (!chart) {
          const config = await GroqService.suggestDashboard(dataset);
          if (config.charts && config.charts.length > 0) chart = config.charts[0];
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        chart: chart,
        results: chart ? dataset.data.slice(0, 15) : undefined // Slice for preview performance
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Operational stream disrupted. Please reconnect.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const renderInlineChart = (chart: ChartSpec, results: DataRow[]) => {
    const color = '#6366f1';
    // Simple aggregation for inline chat display
    const data = results.map(r => ({
      name: String(r[chart.xAxis]).substring(0, 10),
      value: parseFloat(String(r[chart.yAxis])) || 1
    }));

    return (
      <div className="w-full h-64 mt-6 p-6 bg-slate-50 dark:bg-slate-800 rounded-[32px] border border-slate-200 dark:border-slate-700 shadow-inner overflow-hidden animate-in zoom-in-95">
        <h4 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-4">{chart.title}</h4>
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === 'bar' ? (
            <BarChart data={data}>
              <XAxis dataKey="name" fontSize={8} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chart.type === 'line' ? (
            <LineChart data={data}>
              <XAxis dataKey="name" fontSize={8} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} dot={{ r: 2 }} />
            </LineChart>
          ) : (
            <AreaChart data={data}>
              <XAxis dataKey="name" fontSize={8} />
              <Area type="monotone" dataKey="value" fill={color} fillOpacity={0.2} stroke={color} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col w-full max-w-[1400px] mx-auto overflow-hidden">

      <div className="flex justify-center mb-8 shrink-0">
        <div className="glass-panel p-2 rounded-full flex gap-1 shadow-xl">
          <button onClick={() => setActiveTab('chat')} className={`px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Agent Chat</button>
          <button onClick={() => setActiveTab('report')} className={`px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'report' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Strategic Report</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {activeTab === 'chat' ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-12 py-8" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in-95">
                  <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[40px] flex items-center justify-center text-5xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-float">🤖</div>
                  <div className="space-y-3">
                    <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Strategic Analyst</h3>
                    <p className="text-slate-500 font-medium max-w-md mx-auto">Explore dataset invariants, truths, and quality metrics.</p>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-5 duration-500`}>
                  <div className={`w-12 h-12 rounded-[20px] shrink-0 flex items-center justify-center font-black text-[11px] uppercase shadow-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-100 dark:border-slate-800'}`}>
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className={`max-w-[80%] px-8 py-6 rounded-[40px] shadow-xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-tl-none'}`}>
                    <div className="prose prose-sm dark:prose-invert prose-slate max-w-none text-sm leading-relaxed font-medium">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.chart && msg.results && renderInlineChart(msg.chart, msg.results)}
                    <div className="mt-6 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • System v5.2 Analyst
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-6 animate-pulse">
                  <div className="w-12 h-12 rounded-[20px] bg-slate-200 dark:bg-slate-800"></div>
                  <div className="flex-1 space-y-3 py-3">
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-full w-32"></div>
                    <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full w-full"></div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-950/20 backdrop-blur-md">
              <form onSubmit={handleSend} className="relative flex items-center max-w-4xl mx-auto">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Query dataset, audits, or pattern discrepancies..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] px-8 py-5 pr-28 focus:outline-none focus:ring-[12px] focus:ring-indigo-500/5 text-sm font-bold shadow-2xl resize-none max-h-32 dark:text-white"
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="absolute right-4 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-xl"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto custom-scrollbar">
            <ReportView dataset={dataset} onAIAction={onAIAction} onUpdate={onUpdate} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ExploreView;
