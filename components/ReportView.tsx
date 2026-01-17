
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dataset, StrategicReport, ReportSection, ChartSpec } from '../types';
import { GroqService } from '../services/groqService';
import ReactMarkdown from 'react-markdown';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer,
    XAxis, YAxis, Tooltip, CartesianGrid, Cell, AreaChart, Area,
    ScatterChart, Scatter, Treemap, ZAxis
} from 'recharts';

interface ReportViewProps {
    dataset: Dataset;
    onAIAction?: () => void;
    onUpdate?: (updated: Dataset) => void;
}

// Fallback report template when AI fails
const createFallbackReport = (dataset: Dataset): StrategicReport => ({
    title: `Analysis Report: ${dataset?.name || 'Dataset'}`,
    executiveSummary: `This report provides an overview of ${(dataset?.data?.length || 0).toLocaleString()} records across ${(dataset?.headers || []).length} data dimensions. Key metrics and patterns have been analyzed for business insights.`,
    sections: [
        {
            id: 'overview',
            title: 'Dataset Overview',
            content: `The dataset contains **${(dataset?.data?.length || 0).toLocaleString()}** records with the following columns:\n\n${(dataset?.headers || []).map(h => `- **${h}**`).join('\n')}\n\n### Data Quality\nThe data has been processed and is ready for analysis.`,
            keyTakeaways: [
                `${(dataset?.data?.length || 0).toLocaleString()} total records`,
                `${(dataset?.headers || []).length} data dimensions`,
                'Data loaded successfully'
            ],
            charts: [],
            kpis: []
        },
        {
            id: 'recommendations',
            title: 'Recommendations',
            content: `### Suggested Next Steps\n\n1. **Explore the data** using the interactive dashboard\n2. **Run data cleaning** to improve quality\n3. **Generate custom visualizations** for specific insights`,
            keyTakeaways: [
                'Use dashboard for visual analysis',
                'Consider data cleaning for improved quality'
            ],
            charts: [],
            kpis: []
        }
    ],
    generatedAt: new Date().toISOString(),
    version: '1.0'
});

const ReportView: React.FC<ReportViewProps> = ({ dataset, onAIAction, onUpdate }) => {
    const [report, setReport] = useState<StrategicReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [activeSection, setActiveSection] = useState<string>('');
    const contentRef = useRef<HTMLDivElement>(null);

    // Generate report with timeout
    const generateReportWithTimeout = async (timeoutMs: number = 30000): Promise<StrategicReport> => {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Report generation timed out after ${timeoutMs / 1000} seconds`));
            }, timeoutMs);

            GroqService.generateReport(dataset)
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(err => {
                    clearTimeout(timeoutId);
                    reject(err);
                });
        });
    };

    // Retry handler
    const handleRetry = () => {
        setError(null);
        setLoading(true);
        setRetryCount(prev => prev + 1);
    };

    // Use fallback report
    const useFallback = () => {
        const fallback = createFallbackReport(dataset);
        setReport(fallback);
        setError(null);
        setLoading(false);
        if (onUpdate) onUpdate({ ...dataset, strategicReport: fallback });
    };

    useEffect(() => {
        if (!dataset) return;

        // If report already exists, use it
        if (dataset.strategicReport) {
            setReport(dataset.strategicReport);
            setActiveSection(dataset.strategicReport.sections?.[0]?.id || '');
            setLoading(false);
            setError(null);
            return;
        }

        // Generate new report
        const generate = async () => {
            setLoading(true);
            setError(null);

            try {
                if (onAIAction) onAIAction();

                // Try with 30 second timeout
                const content = await generateReportWithTimeout(30000);

                // Validate response structure
                if (!content || !content.sections || !Array.isArray(content.sections)) {
                    throw new Error('Invalid report structure received');
                }

                setReport(content);
                setActiveSection(content.sections?.[0]?.id || '');
                setError(null);
                if (onUpdate) onUpdate({ ...dataset, strategicReport: content });

            } catch (e) {
                console.error('Report generation failed:', e);
                const errorMessage = e instanceof Error ? e.message : 'Failed to generate report';

                // After 2 retries, use fallback automatically
                if (retryCount >= 2) {
                    console.log('Using fallback report after multiple failures');
                    useFallback();
                } else {
                    setError(errorMessage);
                }
            } finally {
                setLoading(false);
            }
        };

        generate();
    }, [dataset?.name, retryCount]);

    const aggregateData = useCallback((chart: ChartSpec) => {
        const data = dataset?.data;
        if (!data || data.length === 0) return [];

        // Safety check for keys
        if (!chart.xAxis || !chart.yAxis) return [];

        if (chart.type === 'scatter' || chart.type === 'heatmap') {
            return data.map(row => ({
                x: Number(row[chart.xAxis]) || 0,
                y: Number(row[chart.yAxis]) || 0,
                z: chart.zAxis ? (Number(row[chart.zAxis]) || 1) : 1,
                name: row[dataset?.headers?.[0]] || 'Unknown'
            })).slice(0, 300);
        }

        if (chart.type === 'treemap') {
            const map = new Map<string, number>();
            data.forEach(row => {
                const key = String(row[chart.xAxis] || 'Unknown');
                const val = chart.aggregation === 'count' ? 1 : (parseFloat(String(row[chart.yAxis])) || 0);
                map.set(key, (map.get(key) || 0) + val);
            });
            return Array.from(map.entries())
                .map(([name, size]) => ({ name, size }))
                .sort((a, b) => b.size - a.size)
                .slice(0, 15);
        }

        const map = new Map<string, number>();
        data.forEach(row => {
            const key = String(row[chart.xAxis] || 'Unknown').trim();
            if (key === 'Unknown' || key === 'undefined') return;
            const val = chart.aggregation === 'count' ? 1 : (parseFloat(String(row[chart.yAxis])) || 0);
            map.set(key, (map.get(key) || 0) + val);
        });

        return Array.from(map.entries())
            .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 18) + '...' : name, value: Number(value.toFixed(2)) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 15);
    }, [dataset?.data]);

    const renderChart = (chart: ChartSpec) => {
        const data = aggregateData(chart);
        if (!data.length) return null;

        const color = '#6366f1';
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

        return (
            <div className="my-8 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm break-inside-avoid">
                <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">{chart.type} Visualization</h5>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-6">{chart.title}</h4>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        {chart.type === 'bar' ? (
                            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis fontSize={9} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        ) : chart.type === 'line' ? (
                            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis fontSize={9} tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} dot={{ r: 3 }} />
                            </LineChart>
                        ) : chart.type === 'pie' ? (
                            <PieChart>
                                <Pie
                                    data={data}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    isAnimationActive={false} // Disable animation for report stability
                                >
                                    {data && Array.isArray(data) && data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        ) : chart.type === 'scatter' ? (
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" dataKey="x" name={chart.xAxis} fontSize={9} />
                                <YAxis type="number" dataKey="y" name={chart.yAxis} fontSize={9} />
                                <ZAxis type="number" dataKey="z" range={[50, 400]} />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                <Scatter name={chart.title} data={data} fill={color} />
                            </ScatterChart>
                        ) : chart.type === 'treemap' ? (
                            <Treemap data={data} dataKey="size" aspectRatio={4 / 3} stroke="#fff" fill={color} animationDuration={0} isAnimationActive={false}>
                                <Tooltip />
                            </Treemap>
                        ) : (
                            <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis fontSize={9} tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Area type="monotone" dataKey="value" fill={color} fillOpacity={0.2} stroke={color} />
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                </div>
                <p className="mt-4 text-[10px] text-slate-500 italic text-center">{chart.description}</p>
            </div>
        );
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in">
            <div className="w-20 h-20 border-[6px] border-indigo-100 dark:border-indigo-900/30 border-t-indigo-600 rounded-full animate-spin" />
            <div className="text-center space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-indigo-600">Synthesizing Strategic Narrative</h3>
                <p className="text-xs font-medium text-slate-400">Analyzing {(dataset?.data?.length || 0).toLocaleString()} records • Generating visuals • Drafting executive summary</p>
                <p className="text-[10px] text-slate-300 mt-2">This may take up to 30 seconds...</p>
            </div>
        </div>
    );

    // Error state with retry and fallback options
    if (error) return (
        <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in">
            <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <div className="text-center space-y-2 max-w-md">
                <h3 className="text-lg font-black uppercase tracking-widest text-rose-600">Report Generation Failed</h3>
                <p className="text-sm font-medium text-slate-500">{error}</p>
                {retryCount > 0 && (
                    <p className="text-xs text-slate-400">Attempt {retryCount + 1} of 3</p>
                )}
            </div>
            <div className="flex gap-4">
                <button
                    onClick={handleRetry}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
                >
                    🔄 Try Again
                </button>
                <button
                    onClick={useFallback}
                    className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                >
                    📋 Use Basic Template
                </button>
            </div>
        </div>
    );

    if (!report || !dataset) return null;

    return (
        <div className="flex h-full bg-slate-100 dark:bg-slate-950 overflow-hidden relative">

            {/* Sticky Table of Contents (Desktop) */}
            <aside className="hidden xl:flex w-72 flex-col gap-6 p-8 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto shrink-0 z-10 print:hidden">
                <div className="space-y-1">
                    <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Report Structure</h2>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={report?.title}>{dataset?.name || 'Untitled'}</p>
                </div>
                <nav className="space-y-1">
                    {report.sections && Array.isArray(report.sections) && report.sections.map((section, idx) => (
                        <a
                            key={section.id}
                            href={`#${section.id}`}
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveSection(section.id);
                                document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`block px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeSection === section.id
                                ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 border-l-4 border-indigo-600'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            {idx + 1}. {section.title}
                        </a>
                    ))}
                </nav>
                <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={handlePrint} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Export PDF
                    </button>
                </div>
            </aside>

            {/* Main Document View */}
            <main className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth" ref={contentRef}>
                <div className="max-w-[900px] mx-auto py-12 px-8 md:px-12 space-y-16 print:max-w-none print:p-0">

                    {/* Cover Page */}
                    <div className="min-h-[60vh] flex flex-col justify-center border-b border-slate-200 dark:border-slate-800 pb-12 print:min-h-0 print:pb-4 print:border-none">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest w-fit mb-6 print:hidden">
                            Strategic Intelligence v{report.version}
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter leading-[0.9] mb-8">
                            {report.title}
                        </h1>
                        <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
                            <span>{new Date(report.generatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span>Prepared by Toeasy AI</span>
                        </div>

                        {/* Executive Summary Card */}
                        <div className="mt-12 p-8 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl print:shadow-none print:border print:rounded-none">
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] mb-4">Executive Summary</h3>
                            <p className="text-lg leading-relaxed text-slate-800 dark:text-slate-200 font-medium">
                                {report.executiveSummary}
                            </p>
                        </div>
                    </div>

                    {/* Sections */}
                    <div className="space-y-24 print:space-y-12">
                        {report.sections && Array.isArray(report.sections) && report.sections.map((section, idx) => (
                            <section key={section.id} id={section.id} className="scroll-mt-12 break-after-page">
                                <div className="flex items-baseline gap-4 mb-8">
                                    <span className="text-6xl font-black text-slate-200 dark:text-slate-800 select-none">{idx + 1}</span>
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{section.title}</h2>
                                </div>

                                {/* Key Takeaways */}
                                {section.keyTakeaways && section.keyTakeaways.length > 0 && (
                                    <div className="mb-8 flex flex-wrap gap-3">
                                        {section.keyTakeaways.map((takeaway, k) => (
                                            <span key={k} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                                ✦ {takeaway}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* KPIs Grid */}
                                {section.kpis && section.kpis.length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                                        {section.kpis.map((kpi, k) => (
                                            <div key={k} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:border">
                                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">{kpi.label}</p>
                                                <p className="text-xl font-black text-slate-900 dark:text-white">{kpi.value}</p>
                                                <p className={`text-[10px] font-bold mt-1 ${kpi.status === 'on_track' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {kpi.status?.replace('_', ' ').toUpperCase()}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Narrative Content */}
                                <div className="prose prose-slate dark:prose-invert prose-lg max-w-none prose-headings:font-black prose-headings:tracking-tight prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:font-medium">
                                    <ReactMarkdown>{section.content}</ReactMarkdown>
                                </div>

                                {/* Embedded Visuals */}
                                {section.charts && section.charts.length > 0 && (
                                    <div className="mt-10 grid grid-cols-1 gap-8">
                                        {section.charts.map((chart, c) => (
                                            <React.Fragment key={c}>
                                                {renderChart(chart)}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>

                    <footer className="pt-20 pb-10 border-t border-slate-200 dark:border-slate-800 text-center space-y-4 print:hidden">
                        <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xl mx-auto">T</div>
                        <p className="text-xs font-bold text-slate-400">Generated by Toeasy AI Data OS</p>
                        <p className="text-[10px] text-slate-300">Confidential & Proprietary</p>
                    </footer>
                </div>
            </main>

            <style>{`
        @media print {
            body { background: white; color: black; }
            aside, button { display: none !important; }
            main { overflow: visible !important; height: auto !important; }
            .prose { color: black !important; }
            .bg-slate-900 { background: white !important; color: black !important; border: 1px solid #ddd !important; }
            .text-white { color: black !important; }
            .dark\\:bg-slate-900 { background: white !important; }
        }
      `}</style>
        </div>
    );
};

export default ReportView;
