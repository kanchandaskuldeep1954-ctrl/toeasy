
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dataset, StrategicReport, ReportSection, ChartSpec } from '../types';
import { GroqService } from '../services/groqService';
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

type ReportType = 'strategic' | 'operational' | 'financial' | 'quality' | 'risk';

const ReportView: React.FC<ReportViewProps> = ({ dataset, onAIAction, onUpdate }) => {
    const [report, setReport] = useState<StrategicReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [reportType, setReportType] = useState<ReportType>('strategic');
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [activeSection, setActiveSection] = useState<string>('');
    const contentRef = useRef<HTMLDivElement>(null);

    // Generate report with timeout
    const generateReportWithTimeout = async (type: ReportType, timeoutMs: number = 45000): Promise<StrategicReport> => {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Report generation timed out after ${timeoutMs / 1000} seconds`));
            }, timeoutMs);

            GroqService.generateReport(dataset, type)
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

    const handleReportTypeChange = (type: ReportType) => {
        setReportType(type);
        setLoading(true);
        setReport(null);
        setError(null);
        setRetryCount(0);
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

        // Generate new report
        const generate = async () => {
            setLoading(true);
            setError(null);

            try {
                if (onAIAction) onAIAction();

                // Try with 45 second timeout
                const content = await generateReportWithTimeout(reportType, 45000);

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
    }, [dataset?.name, retryCount, reportType]);

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

    const [showExportModal, setShowExportModal] = useState(false);

    const handleExport = (format: 'pdf' | 'word' | 'powerbi' | 'tableau' | 'markdown') => {
        if (format === 'pdf') {
            window.print();
            setShowExportModal(false);
            return;
        }

        const reportTitle = `${report?.title || 'Report'}_${report?.version || 'v1'}`;

        if (format === 'markdown') {
            const content = report?.sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n') || '';
            downloadFile(`${reportTitle}.md`, content, 'text/markdown');
        }
        else if (format === 'word') {
            const content = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>${report?.title}</title></head>
                <body>
                    <h1>${report?.title}</h1>
                    <p>${report?.executiveSummary}</p>
                    ${report?.sections.map(s => `<h2>${s.title}</h2><div>${s.content}</div>`).join('')}
                    <br/>
                    <p>Generated by Toeasy AI</p>
                </body>
                </html>
            `;
            downloadFile(`${reportTitle}.doc`, content, 'application/msword');
        }
        else if (format === 'powerbi' || format === 'tableau') {
            // Export data for BI tools
            if (!dataset?.data) return;
            const headers = dataset.headers.join(',');
            const rows = dataset.data.map(r => dataset.headers.map(h =>
                `"${String(r[h] ?? '').replace(/"/g, '""')}"`
            ).join(',')).join('\n');
            downloadFile(`${reportTitle}_data.csv`, `${headers}\n${rows}`, 'text/csv');
        }

        setShowExportModal(false);
    };

    const downloadFile = (filename: string, content: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in bg-slate-100 dark:bg-slate-950">
            <div className="w-20 h-20 border-[6px] border-indigo-100 dark:border-indigo-900/30 border-t-indigo-600 rounded-full animate-spin" />
            <div className="text-center space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-indigo-600">Generating {reportType} Report</h3>
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
                    <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Report Structure</h2>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={report?.title}>{dataset?.name || 'Untitled'}</p>
                </div>

                {/* Report Type Selector */}
                <div className="flex flex-col gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    {(['strategic', 'operational', 'financial', 'quality', 'risk'] as ReportType[]).map(type => (
                        <button
                            key={type}
                            onClick={() => handleReportTypeChange(type)}
                            className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg text-left transition-all ${reportType === type
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            {type} Report
                        </button>
                    ))}
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
            <main className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth" ref={contentRef}>
                <div className="max-w-[900px] mx-auto py-12 px-8 md:px-12 space-y-16 print:max-w-none print:p-0">

                    {/* Cover Page */}
                    <div className="min-h-[60vh] flex flex-col justify-center border-b border-slate-200 dark:border-slate-800 pb-12 print:min-h-0 print:pb-4 print:border-none">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest w-fit mb-6 print:hidden">
                            {reportType} Intelligence v{report.version}
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
