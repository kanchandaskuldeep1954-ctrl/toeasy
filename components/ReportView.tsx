
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dataset, StrategicReport, ReportSection, ChartSpec } from '../types';
import { GroqService } from '../services/groqService';
import { ExportService } from '../services/exportService';
import ReactMarkdown from 'react-markdown';
import PlotlyChart from './Dashboard/PlotlyChart';

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
        }
    ],
    generatedAt: new Date().toISOString(),
    version: '1.0'
});

// unified report structure
// type ReportType = 'strategic' | 'operational' | 'financial' | 'quality' | 'risk';

const ReportView: React.FC<ReportViewProps> = ({ dataset, onAIAction, onUpdate }) => {
    const [report, setReport] = useState<StrategicReport | null>(null);
    const [loading, setLoading] = useState(true);
    // const [reportType, setReportType] = useState<ReportType>('strategic');
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [activeSection, setActiveSection] = useState<string>('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showCopilot, setShowCopilot] = useState(true);
    const [copilotInput, setCopilotInput] = useState('');
    const [copilotLoading, setCopilotLoading] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const copilotSuggestions = [
        { title: 'Add Competitor Benchmark', icon: '🏆', prompt: 'Include a section comparing our revenue growth against the S&P 500 average for 2025.' },
        { title: 'Summarize for Board', icon: '🤵', prompt: 'Convert the executive summary into 3 bullet points that fit on a single slide.' },
        { title: 'Deep Dive on Anomaly', icon: '🔬', prompt: 'Analyze the sharp drop in record count between Oct 12 and Oct 15.' },
        { title: 'Forecasting v2.0', icon: '🔮', prompt: 'Extend the trendlines to Q4 2026 using a 15% optimistic growth variable.' }
    ];

    // Generate report with timeout
    const generateReportWithTimeout = async (timeoutMs: number = 45000): Promise<StrategicReport> => {
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

    /* Redundant: report types removed */

    // Use fallback report
    const useFallback = () => {
        const fallback = createFallbackReport(dataset);
        setReport(fallback);
        setError(null);
        setLoading(false);
        if (onUpdate) onUpdate({ ...dataset, strategicReport: fallback });
    };

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        if (!dataset) return;

        // Skip if report already exists for this type
        if (report && dataset.strategicReport) {
            return;
        }

        // Generate new report
        const generate = async () => {
            setLoading(true);
            setError(null);

            try {
                if (onAIAction) onAIAction();

                // Try with 45 second timeout
                const content = await generateReportWithTimeout(45000);

                if (!isMounted.current) return;

                // Validate response structure
                if (!content || !content.sections || !Array.isArray(content.sections)) {
                    throw new Error('Invalid report structure received');
                }

                setReport(content);
                setActiveSection(content.sections?.[0]?.id || '');
                setError(null);
                if (onUpdate) onUpdate({ ...dataset, strategicReport: content } as any);

            } catch (e: any) {
                if (!isMounted.current) return;
                console.error('Report generation failed:', e);

                let errorMessage = e instanceof Error ? e.message : 'Failed to generate report';

                if (e.message?.includes('429') || e.response?.status === 429) {
                    errorMessage = "Server is under high load (Too Many Requests). Using basic template instead.";
                    useFallback();
                    return;
                }

                // After 2 retries, use fallback automatically
                if (retryCount >= 2) {
                    console.log('Using fallback report after multiple failures');
                    useFallback();
                } else {
                    setError(errorMessage);
                }
            } finally {
                if (isMounted.current) setLoading(false);
            }
        };

        generate();
    }, [dataset?.name, retryCount]);

    const handleCopilotUpdate = async (instruction: string) => {
        if (!instruction.trim() || !report || !dataset) return;

        setCopilotLoading(true);
        try {
            const updatedReport = await GroqService.modifyReport(dataset, report, instruction);
            setReport(updatedReport);
            setCopilotInput('');
            // Optional: Scroll to top of report to show changes
            contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
            console.error('Copilot update failed:', e);
            alert('Failed to update report. Please try again.');
        } finally {
            setCopilotLoading(false);
        }
    };

    const renderChart = (chart: ChartSpec) => {
        return (
            <div className="my-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm break-inside-avoid print:border-slate-300">
                <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">{chart.type} Visualization</h5>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-6">{chart.title}</h4>
                <div className="h-72 w-full">
                    <PlotlyChart
                        chart={chart}
                        height={288}
                        data={chart.data} // Pass pre-calculated data
                    />
                </div>
                <p className="mt-4 text-[11px] text-slate-500 italic text-center">{chart.description}</p>
            </div>
        );
    };

    const renderSWOT = (swot: NonNullable<ReportSection['swot']>) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-10 break-inside-avoid">
            <div className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl">
                <h6 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-3">Strengths</h6>
                <ul className="space-y-2">
                    {swot.strengths.map((s, i) => <li key={i} className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex gap-2"><span>💪</span> {s}</li>)}
                </ul>
            </div>
            <div className="p-6 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-3xl">
                <h6 className="text-[10px] font-black uppercase text-rose-600 tracking-widest mb-3">Weaknesses</h6>
                <ul className="space-y-2">
                    {swot.weaknesses.map((s, i) => <li key={i} className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex gap-2"><span>⚠️</span> {s}</li>)}
                </ul>
            </div>
            <div className="p-6 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-3xl">
                <h6 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-3">Opportunities</h6>
                <ul className="space-y-2">
                    {swot.opportunities.map((s, i) => <li key={i} className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex gap-2"><span>🚀</span> {s}</li>)}
                </ul>
            </div>
            <div className="p-6 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-3xl">
                <h6 className="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-3">Threats</h6>
                <ul className="space-y-2">
                    {swot.threats.map((s, i) => <li key={i} className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex gap-2"><span>🛡️</span> {s}</li>)}
                </ul>
            </div>
        </div>
    );

    const renderRecommendations = (recs: NonNullable<ReportSection['recommendations']>) => (
        <div className="my-10 space-y-4">
            <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">Actionable Intelligence</h4>
            <div className="grid gap-4">
                {recs.map((rec, i) => (
                    <div key={i} className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                            <h5 className="font-bold text-slate-900 dark:text-white">{rec.action}</h5>
                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter ${rec.impact === 'high' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                Impact: {rec.impact}
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{rec.rationale}</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                            <span>Effort: {rec.effort}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderRisks = (risks: NonNullable<ReportSection['risks']>) => (
        <div className="my-10 space-y-4">
            <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">Risk Exposure & Mitigation</h4>
            <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-3xl">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr>
                            <th className="px-6 py-4 font-black uppercase tracking-wider text-slate-500">Risk Category</th>
                            <th className="px-6 py-4 font-black uppercase tracking-wider text-slate-500 w-1/3">Description</th>
                            <th className="px-6 py-4 font-black uppercase tracking-wider text-slate-500">Level</th>
                            <th className="px-6 py-4 font-black uppercase tracking-wider text-slate-500">Mitigation Strategy</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {risks.map((risk, i) => (
                            <tr key={i} className="bg-white dark:bg-slate-900 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white uppercase tracking-tighter">{risk.category}</td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400 leading-relaxed">{risk.description}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${risk.level === 'critical' ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20' : risk.level === 'high' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {risk.level}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-medium italic">{risk.mitigation}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const [showExportModal, setShowExportModal] = useState(false);

    const handleExport = (format: 'pdf' | 'word' | 'powerbi' | 'tableau' | 'markdown') => {
        if (!report) return;

        const reportTitle = `${report.title}_${report.version}`;

        if (format === 'pdf') {
            ExportService.exportToPDF(reportTitle);
            setShowExportModal(false);
            return;
        }

        if (format === 'markdown') {
            const content = report.sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n') || '';
            // Basic download for Markdown (not in service yet, or could add?)
            // Let's add simple inline for MD or extend service. Service is better.
            // For now, inline since it's simple string.
            const blob = new Blob([content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${reportTitle}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        else if (format === 'word') {
            ExportService.exportToWord(report, dataset?.name || 'Dataset');
        }
        else if (format === 'powerbi' || format === 'tableau') {
            // Use ExportService CSV with optimization
            ExportService.exportToCSV(dataset, format); // 'powerbi' or 'tableau' as suffix
        }

        setShowExportModal(false);
    };

    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in bg-slate-100 dark:bg-slate-950">
            <div className="w-20 h-20 border-[6px] border-indigo-100 dark:border-indigo-900/30 border-t-indigo-600 rounded-full animate-spin" />
            <div className="text-center space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-indigo-600">Generating Intelligence Report</h3>
                <p className="text-xs font-medium text-slate-400">Analyzing {(dataset?.data?.length || 0).toLocaleString()} records • Calculating KPIs • Building Visuals</p>
                <p className="text-[10px] text-slate-300 mt-2">This may take up to 45 seconds...</p>
            </div>
        </div>
    );

    // Error state with retry and fallback options
    if (error) return (
        <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in bg-slate-100 dark:bg-slate-950">
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
                    <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Table of Contents</h2>
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
                    <button onClick={() => setShowExportModal(true)} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4h14" /></svg>
                        Export Options
                    </button>
                </div>
            </aside>

            {/* Mobile Header with Drawer Trigger */}
            <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold">T</div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Report View</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{dataset?.name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowExportModal(true)}
                        className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4h14" /></svg>
                    </button>

                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                    </button>
                </div>
            </div>

            {/* FULL MOBILE DRAWER OVERLAY */}
            {/* Using a fixed full-screen overlay when menu is open */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 xl:hidden">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />

                    {/* Drawer Content */}
                    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Report Navigation</h3>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="space-y-8">
                            {/* 1. Report Type Selector (Mobile) */}
                            <div>
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3">Sections</h4>
                                <nav className="space-y-1">
                                    {report.sections && Array.isArray(report.sections) && report.sections.map((section, idx) => (
                                        <button
                                            key={section.id}
                                            onClick={() => {
                                                setActiveSection(section.id);
                                                setIsMobileMenuOpen(false);
                                                document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                                            }}
                                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeSection === section.id
                                                ? 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 border-l-4 border-indigo-600'
                                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            {idx + 1}. {section.title}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                            <button onClick={() => { setShowExportModal(true); setIsMobileMenuOpen(false); }} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4h14" /></svg>
                                Export Options
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in print:hidden">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Export Report</h3>
                            <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-500">✕</button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleExport('pdf')} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 group transition-all text-left">
                                <span className="text-2xl mb-2 block">📄</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white block">PDF Document</span>
                                <span className="text-[10px] text-slate-500">Professional print layout</span>
                            </button>
                            <button onClick={() => handleExport('word')} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 group transition-all text-left">
                                <span className="text-2xl mb-2 block">📝</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white block">Word Document</span>
                                <span className="text-[10px] text-slate-500">Editable .doc format</span>
                            </button>
                            <button onClick={() => handleExport('powerbi')} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 group transition-all text-left">
                                <span className="text-2xl mb-2 block">📊</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white block">PowerBI Data</span>
                                <span className="text-[10px] text-slate-500">Optimized CSV dataset</span>
                            </button>
                            <button onClick={() => handleExport('tableau')} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 group transition-all text-left">
                                <span className="text-2xl mb-2 block">📉</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white block">Tableau Data</span>
                                <span className="text-[10px] text-slate-500">TDE-ready CSV format</span>
                            </button>
                            <button onClick={() => handleExport('markdown')} className="col-span-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">⌨️</span>
                                    <div>
                                        <span className="text-xs font-bold text-slate-900 dark:text-white block">Markdown / Raw Text</span>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Download</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Document View */}
            <main className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth pt-16 xl:pt-0" ref={contentRef}>
                <div className="max-w-[900px] mx-auto py-8 md:py-12 px-4 md:px-12 space-y-12 md:space-y-16 print:max-w-none print:p-0">

                    {/* Cover Page */}
                    <div className="min-h-[60vh] flex flex-col justify-center border-b border-slate-200 dark:border-slate-800 pb-12 print:min-h-0 print:pb-4 print:border-none">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest w-fit mb-6 print:hidden">
                            Intelligence Report v{report.version}
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
                        <div className="mt-12 p-8 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl print:shadow-none print:border print:rounded-none break-inside-avoid">
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] mb-4">Executive Summary</h3>
                            <p className="text-lg leading-relaxed text-slate-800 dark:text-slate-200 font-medium whitespace-pre-line">
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
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 break-inside-avoid">
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

                                {/* Strategic Modules */}
                                {section.swot && renderSWOT(section.swot)}
                                {section.recommendations && renderRecommendations(section.recommendations)}
                                {section.risks && renderRisks(section.risks)}

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

            {/* Report Co-pilot: Insight Optimizer */}
            <aside className={`fixed top-0 right-0 bottom-0 w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-8 pt-12 transform transition-all duration-500 shadow-2xl z-30 print:hidden ${showCopilot ? 'translate-x-0' : 'translate-x-full'}`}>
                <button
                    onClick={() => setShowCopilot(!showCopilot)}
                    className="absolute -left-10 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-2 rounded-l-xl shadow-xl"
                >
                    {showCopilot ? '👉' : '✨'}
                </button>

                <div className="flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30">✨</div>
                        <div>
                            <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white leading-none">Report Co-pilot</h3>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Insight Optimizer</p>
                        </div>
                    </div>

                    <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
                            "I've analyzed your data and detected several high-impact narrative opportunities. How would you like to refine this report?"
                        </p>

                        <div className="grid gap-3">
                            {copilotSuggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleCopilotUpdate(s.prompt)}
                                    disabled={copilotLoading}
                                    className="group p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-600 rounded-2xl border border-slate-100 dark:border-slate-800 text-left transition-all disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-lg">{s.icon}</span>
                                        <span className="text-[11px] font-black uppercase text-slate-900 dark:text-white group-hover:text-white">{s.title}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 group-hover:text-indigo-100 font-medium line-clamp-2">
                                        {s.prompt}
                                    </p>
                                </button>
                            ))}
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Manual Refinement</h4>
                            <textarea
                                value={copilotInput}
                                onChange={(e) => setCopilotInput(e.target.value)}
                                placeholder="E.g., 'Make it more technical' or 'Add a table for...'"
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 min-h-[100px] focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={() => handleCopilotUpdate(copilotInput)}
                                disabled={copilotLoading || !copilotInput.trim()}
                                className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {copilotLoading ? 'Optimizing...' : 'Update Report'}
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

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
