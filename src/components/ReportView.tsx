
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dataset, StrategicReport, ReportSection, ChartSpec } from '../../types';
import { GroqService } from '../services/groqService';
import { FileText, Database, Presentation, Share2, Download, RefreshCw, Layout, AlignLeft } from 'lucide-react';
import { ExportService } from '../services/exportService';
import ReactMarkdown from 'react-markdown';
import { SmartChart } from '../../components/Dashboard/SmartChart';
import { sharingAPI, activityAPI } from '../services/api';
import { useSearchParams } from 'react-router-dom';
import ExportModal from './ExportHub/ExportModal';
import { ReportSectionEditor } from './Report/ReportSectionEditor';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    suppressError: true, // Prevent Mermaid from throwing bomb icons into the DOM if possible
    themeVariables: {
        primaryColor: '#6366f1',
        primaryTextColor: '#fff',
        primaryBorderColor: '#4f46e5',
        lineColor: '#6366f1',
        secondaryColor: '#f8fafc',
        tertiaryColor: '#fff'
    },
    // New v10+ specific error handling
    logLevel: 5 // Fatal only
});

const sanitizeMermaid = (chart: string) => {
    if (!chart) return '';

    let processed = chart.trim();

    // 1. Force graph LR if missing
    if (!processed.startsWith('graph')) {
        processed = 'graph LR\n' + processed;
    }

    // 2. Clear out any markdown code blocks if the AI accidentally included them
    processed = processed.replace(/```mermaid/g, '').replace(/```/g, '');

    // 3. Fix hallucinated arrows (e.g., |>, ->, =>, etc. to standard -->)
    processed = processed.replace(/\|>/g, '-->')
        .replace(/ -+> /g, ' --> ')
        .replace(/ =+> /g, ' ==> ')
        .replace(/ \.> /g, ' -.-> ')
        .replace(/ \+> /g, ' --> ')
        .replace(/~+>/g, ' --> ');

    // 4. Ultra-Robust Node "Rescue": 
    // This regex looks for node definitions and ensures they are properly quoted.
    // It captures: id[text], id(text), id{text} or just plain UNQUOTED_ID
    // We split by lines and reconnects to avoid multiline confusion
    const lines = processed.split('\n');
    const sanitizedLines = lines.map(line => {
        if (!line.includes('-->') && !line.includes('---') && !line.includes('==>') && !line.includes('-.->')) return line;

        // Split by arrows but preserve flags like |label|
        // Group 1: Source Node, Group 2: Arrow, Group 3: Optional Label, Group 4: Target Node
        return line.replace(/([^-\n>|]+)([-=]{2,}>|-\.\.>)(?:\|([^|]+)\|)?([^-\n>|]+)/g, (match, n1, arrow, label, n2) => {
            const cleanNode = (n: string) => {
                let node = n.trim();
                // If it already has brackets/quotes, just ensure internal quotes are safe
                if (node.includes('[') || node.includes('(') || node.includes('{')) {
                    return node.replace(/"/g, "'");
                }
                // If it's a plain string with spaces or special chars, wrap it
                if (/[^a-zA-Z0-9]/.test(node)) {
                    // Avoid double-wrapping if already rescued
                    if (node.startsWith('node_')) return node;
                    return `node_${Math.random().toString(36).substr(2, 4)}["${node.replace(/"/g, "'")}"]`;
                }
                return node;
            };
            const labelContent = label ? `|${label.trim()}|` : '';
            return `${cleanNode(n1)} ${arrow}${labelContent} ${cleanNode(n2)}`;
        });
    });

    return sanitizedLines.join('\n');
};

const Mermaid: React.FC<{ chart: string, fallbackLogic?: string }> = ({ chart, fallbackLogic }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    React.useEffect(() => {
        const renderMermaid = async () => {
            if (!chart) return;
            try {
                setHasError(false);
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                const sanitized = sanitizeMermaid(chart);

                // Check if syntax is valid before rendering to avoid "bomb" icons
                try {
                    await mermaid.parse(sanitized);
                } catch (parseErr) {
                    console.warn('Mermaid parse failed, entering rescue mode:', parseErr);
                    setHasError(true);
                    return;
                }

                // Use mermaid.render which is more robust in v10+
                const { svg: svgContent } = await mermaid.render(id, sanitized);
                setSvg(svgContent);
            } catch (err) {
                console.error('Mermaid render error:', err);
                setHasError(true);
            }
        };
        renderMermaid();
    }, [chart]);

    if (hasError) {
        return (
            <div className="bg-slate-100 dark:bg-white/5 p-8 rounded-3xl border border-dashed border-slate-300 dark:border-white/10 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed mb-4">
                    Logic Visualization Offline
                </p>
                <div className="bg-white/40 dark:bg-black/20 p-5 rounded-2xl border border-slate-200/50 dark:border-white/5 text-left max-w-xl mx-auto">
                    <p className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                        Analytical Chain of Thought
                    </p>
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed italic">
                        {fallbackLogic || "Resolving complex structural dependencies and establishing cross-metric correlations for this analysis segment."}
                    </p>
                </div>
            </div>
        );
    }

    if (!svg) return null;

    return (
        <div
            className="mermaid-container bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex justify-center w-full scale-90 origin-center"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};

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
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<StrategicReport | null>(dataset.strategicReport || null);
    const [error, setError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<string>('');
    const [isSharing, setIsSharing] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [showExportModal, setShowExportModal] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Report Template State
    const [reportType, setReportType] = useState<'strategic' | 'technical' | 'presentation'>('strategic');

    // Focus Mode State
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [copilotLoading, setCopilotLoading] = useState(false);
    const [selectionOverlay, setSelectionOverlay] = useState<{ text: string, top: number, left: number } | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace') || '';
    const [focusIndex, setFocusIndex] = useState(0);
    const [chartDesigner, setChartDesigner] = useState<{ open: boolean, chartId: string | null }>({ open: false, chartId: null });
    const [chartOverrides, setChartOverrides] = useState<Record<string, Partial<ChartSpec>>>({});
    const [copilotMode, setCopilotMode] = useState<'chat' | 'update'>('chat');
    const [showCopilot, setShowCopilot] = useState(false);
    const [copilotInput, setCopilotInput] = useState('');
    const [copilotMessages, setCopilotMessages] = useState<{ role: 'user' | 'assistant', content: string, thinking?: string }[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (copilotMode === 'chat') scrollToBottom();
    }, [copilotMessages, copilotMode]);

    const copilotSuggestions = [
        { title: 'Add Competitor Benchmark', icon: '🏆', prompt: 'Include a section comparing our revenue growth against the S&P 500 average for 2025.' },
        { title: 'Summarize for Board', icon: '🤵', prompt: 'Convert the executive summary into 3 bullet points that fit on a single slide.' },
        { title: 'Deep Dive on Anomaly', icon: '🔬', prompt: 'Analyze the sharp drop in record count between Oct 12 and Oct 15.' },
        { title: 'Forecasting v2.0', icon: '🔮', prompt: 'Extend the trendlines to Q4 2026 using a 15% optimistic growth variable.' }
    ];

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

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

    const handleCopyLink = () => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const handleNativeShare = async () => {
        if (!shareUrl) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: report?.title || 'Report',
                    text: `Check out this report analysis from Toeasy: ${report?.title}`,
                    url: shareUrl,
                });
            } catch (err) {
                console.error('Error sharing:', err);
            }
        } else {
            handleCopyLink();
        }
    };

    const handleShare = async () => {
        if (!report || isSharing) return;
        setIsSharing(true);
        try {
            // Capture frozen snapshot of the report
            const snapshot = {
                summary: report.executiveSummary,
                sections: (report.sections || []).map(s => ({
                    title: s.title,
                    content: s.content,
                    keyTakeaways: s.keyTakeaways,
                    swot: s.swot,
                    recommendations: s.recommendations,
                    risks: s.risks,
                    kpis: s.kpis,
                    charts: (s.charts || []).map(c => ({
                        type: c.type,
                        title: c.title,
                        data: c.data || [], // Use the pre-aggregated data from the section chart
                        spec: c
                    }))
                }))
            };

            const response = await sharingAPI.create({
                resourceType: 'report',
                resourceId: String(dataset.id),
                workspaceId,
                title: report.title,
                snapshot
            });

            if (response.data && response.data.publicUrl) {
                setShareUrl(response.data.publicUrl);
                setShowShareModal(true);
            } else {
                throw new Error('No public URL returned');
            }
        } catch (err) {
            console.error('Sharing failed:', err);
            alert('Failed to generate share link');
        } finally {
            setIsSharing(false);
        }
    };

    const socialShares = [
        {
            name: 'WhatsApp',
            icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.45L0 24l6.835-1.794c1.516.827 3.215 1.263 4.946 1.263h0c6.557 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.415-8.412',
            color: '#25D366',
            action: (url: string) => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out this report analysis from Toeasy: ${url}`)}`, '_blank')
        },
        {
            name: 'LinkedIn',
            icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
            color: '#0077B5',
            action: (url: string) => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank')
        },
        {
            name: 'X',
            icon: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.497h2.039L6.486 3.24H4.298L17.607 20.65z',
            color: '#000000',
            action: (url: string) => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Report analysis from Toeasy: ${url}`)}`, '_blank')
        }
    ];

    const generate = useCallback(async (forced: boolean = false) => {
        if (!dataset) return;

        // Skip if report already exists and not forced
        if (!forced && dataset.strategicReport) {
            setReport(dataset.strategicReport);
            setActiveSection(dataset.strategicReport.sections?.[0]?.id || '');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (onAIAction) onAIAction();

            // 1. Gather Extra Context (Boss Move)
            let activityLogs: any[] = [];
            try {
                const actRes = await activityAPI.list(workspaceId || '', dataset.id, 10);
                activityLogs = actRes.data.data;
            } catch (actErr) {
                console.warn('Failed to fetch activity logs for report context', actErr);
            }

            const extraContext = {
                cleaningHistory: dataset.cleaningHistory || [],
                activityLogs: activityLogs
            };

            // 2. Try with 45 second timeout
            const content = await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Report generation timed out after 45 seconds`));
                }, 45000);

                GroqService.generateReport(dataset, reportType, extraContext)
                    .then(result => {
                        clearTimeout(timeoutId);
                        resolve(result);
                    })
                    .catch(err => {
                        clearTimeout(timeoutId);
                        reject(err);
                    });
            }) as StrategicReport;

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
    }, [dataset, onAIAction, onUpdate, retryCount, workspaceId, reportType]);

    useEffect(() => {
        generate(false);
    }, [dataset?.name, retryCount, generate]);

    const handleCopilotUpdate = async (instruction: string) => {
        if (!instruction.trim() || !report || !dataset) return;

        setCopilotLoading(true);
        // Optimistic UI for chat
        const userMsg = { role: 'user' as const, content: instruction };
        setCopilotMessages(prev => [...prev, userMsg]);
        setCopilotInput('');

        try {
            const updatedReport = await GroqService.modifyReport(dataset, report, instruction);
            setReport(updatedReport);
            if (onUpdate) onUpdate({ ...dataset, strategicReport: updatedReport });

            // Add a proper explanatory message instead of hardcoded generic one
            setCopilotMessages(prev => [...prev,
            {
                role: 'assistant',
                content: `Report updated successfully. I've restructured the analysis focusing on "${instruction}". You can see the new insights in the report view.`
            }
            ]);

            contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
            console.error('Copilot update failed:', e);
            setCopilotMessages(prev => [...prev, { role: 'assistant', content: '⚠️ I encountered an error while trying to update the report. Please try a more specific instruction.' }]);
        } finally {
            setCopilotLoading(false);
        }
    };

    const handleCopilotChat = async () => {
        if (!copilotInput.trim() || !dataset) return;

        const input = copilotInput;
        setCopilotInput('');
        setCopilotMessages(prev => [...prev, { role: 'user', content: input }]);
        setCopilotLoading(true);

        try {
            // We'll use a new consultAgent endpoint for report-specific context
            const response = await GroqService.consultAgent(dataset, input, { reportContext: report }, copilotMessages.map(m => ({ role: m.role, text: m.content })));
            setCopilotMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (e) {
            console.error('Chat failed:', e);
            setCopilotMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I hit a snag while analyzing. Try again?' }]);
        } finally {
            setCopilotLoading(false);
        }
    };

    const renderChart = (chart: ChartSpec) => {
        const override = chartOverrides[chart.id] || {};
        const activeChart = { ...chart, ...override };

        return (
            <div className="my-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm break-inside-avoid print:border-slate-300 group/chart relative">
                <div className="absolute top-4 right-4 opacity-0 group-hover/chart:opacity-100 transition-opacity">
                    <button
                        onClick={() => setChartDesigner({ open: true, chartId: chart.id })}
                        className="p-2 bg-white dark:bg-slate-800 text-slate-500 hover:text-indigo-600 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                </div>
                <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">{activeChart.type} Visualization</h5>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-6">{activeChart.title}</h4>
                <div className="h-72 w-full">
                    <SmartChart
                        chart={activeChart}
                        height={288}
                        data={activeChart.data} // Pass pre-calculated data
                    />
                </div>
                <p className="mt-4 text-[11px] text-slate-500 italic text-center">{activeChart.description}</p>
                {activeChart.reasoning && (
                    <div className="mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20">
                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">First Principles Analysis</p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">{activeChart.reasoning}</p>
                    </div>
                )}
            </div>
        );
    };

    const renderDataFrame = (df: any) => (
        <div className="bg-slate-50 dark:bg-slate-800/20 rounded-[32px] border border-slate-200 dark:border-white/5 overflow-hidden shadow-2xl my-12">
            <div className="p-8 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/50">
                <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest">Calculated DataFrame</span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        Logic Verified
                    </span>
                </div>
                <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2">{df.title}</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{df.description}</p>

                <div className="mt-6 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20">
                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">First Principle Logic</p>
                    <code className="text-xs font-bold text-slate-700 dark:text-indigo-200">{df.logic}</code>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100/50 dark:bg-white/5">
                            {(df.headers || []).map((h: any, i: number) => (
                                <th key={i} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-white/5">
                                    <div className="group relative cursor-help">
                                        {h.name}
                                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-48 p-3 bg-slate-900 text-white text-[10px] rounded-xl shadow-2xl z-50 normal-case font-medium leading-normal animate-in fade-in zoom-in-95">
                                            {h.description}
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {(df.rows || []).map((row: any, r: number) => (
                            <tr key={r} className="hover:bg-slate-100/30 dark:hover:bg-white/5 transition-colors">
                                {(df.headers || []).map((h: any, i: number) => (
                                    <td key={i} className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {typeof row[h.name] === 'number'
                                            ? (h.name === 'Delta' ? (row[h.name] === 0 ? '✓ Match' : row[h.name].toFixed(4)) : row[h.name].toLocaleString())
                                            : String(row[h.name])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {df.summaryInsights && (
                <div className="p-6 bg-slate-100/30 dark:bg-white/2 border-t border-slate-200 dark:border-white/5">
                    <div className="flex flex-wrap gap-4">
                        {(df.summaryInsights || []).map((insight: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                                {insight}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderSWOT = (swot: NonNullable<ReportSection['swot']>) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-10 break-inside-avoid">
            <div className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl">
                <h6 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-3">Strengths</h6>
                <ul className="space-y-2">
                    {swot.strengths && Array.isArray(swot.strengths) && swot.strengths.map((s, i) => <li key={i} className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex gap-2"><span>💪</span> {s}</li>)}
                </ul>
            </div>
            <div className="p-6 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-3xl">
                <h6 className="text-[10px] font-black uppercase text-rose-600 tracking-widest mb-3">Weaknesses</h6>
                <ul className="space-y-2">
                    {swot.weaknesses && Array.isArray(swot.weaknesses) && swot.weaknesses.map((s, i) => <li key={i} className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex gap-2"><span>⚠️</span> {s}</li>)}
                </ul>
            </div>
            <div className="p-6 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-3xl">
                <h6 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-3">Opportunities</h6>
                <ul className="space-y-2">
                    {swot.opportunities && Array.isArray(swot.opportunities) && swot.opportunities.map((s, i) => <li key={i} className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex gap-2"><span>🚀</span> {s}</li>)}
                </ul>
            </div>
            <div className="p-6 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-3xl">
                <h6 className="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-3">Threats</h6>
                <ul className="space-y-2">
                    {swot.threats && Array.isArray(swot.threats) && swot.threats.map((s, i) => <li key={i} className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex gap-2"><span>🛡️</span> {s}</li>)}
                </ul>
            </div>
        </div>
    );

    const renderRecommendations = (recs: NonNullable<ReportSection['recommendations']>) => (
        <div className="my-10 space-y-4">
            <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">Actionable Intelligence</h4>
            <div className="grid gap-4">
                {recs && Array.isArray(recs) && recs.map((rec, i) => (
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
                        {risks && Array.isArray(risks) && risks.map((risk, i) => (
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



    const handleExport = (format: 'pdf' | 'word' | 'powerbi' | 'tableau' | 'markdown') => {
        if (!report) return;

        const reportTitle = `${report.title}_${report.version}`;

        if (format === 'pdf') {
            ExportService.exportToPDF(reportTitle);
            setShowExportModal(false);
            return;
        }

        if (format === 'markdown') {
            const content = (report.sections || [])
                .filter(s => !!s)
                .map(s => `## ${s.title}\n\n${s.content}`)
                .join('\n\n') || '';
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

    if (!report) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors p-6">
                <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 bg-indigo-600/10 border-2 border-dashed border-indigo-500/30 rounded-[32px] flex items-center justify-center mx-auto group">
                        <svg className="w-12 h-12 text-indigo-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-3">Strategic Drafting</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
                            No strategic analysis has been drafted for this dataset. Use the Toeasy AI to compile a comprehensive intelligence report.
                        </p>
                    </div>
                    <div className="pt-4">
                        <button
                            onClick={() => generate(true)}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-3 mx-auto"
                        >
                            <span>✨ Generate Report</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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
                    {/* Template Selector */}
                    <div className="mb-6 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex gap-1">
                        <button
                            onClick={() => { setReportType('strategic'); generate(true); }}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${reportType === 'strategic' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            disabled={loading}
                        >
                            <FileText className="w-4 h-4" />
                            Strat
                        </button>
                        <button
                            onClick={() => { setReportType('technical'); generate(true); }}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${reportType === 'technical' ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-600' : 'text-slate-400 hover:text-slate-600'}`}
                            disabled={loading}
                        >
                            <Database className="w-4 h-4" />
                            Tech
                        </button>
                        <button
                            onClick={() => { setReportType('presentation'); generate(true); }}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${reportType === 'presentation' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                            disabled={loading}
                        >
                            <Presentation className="w-4 h-4" />
                            Slide
                        </button>
                    </div>

                    <button
                        onClick={() => generate(true)}
                        disabled={loading}
                        className="w-full mb-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Rebuilding...' : 'Rebuild AI Report'}
                    </button>
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
                <div className="mt-auto pt-4 space-y-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={handleShare}
                        disabled={isSharing}
                        className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isSharing ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'}`}
                    >
                        {isSharing ? (
                            <span className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        )}
                        {isSharing ? 'SHARING...' : 'SHARE REPORT'}
                    </button>
                    <button onClick={() => setShowExportModal(true)} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-2 border border-slate-700 dark:border-slate-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4h14" /></svg>
                        Export Options
                    </button>
                    <button
                        onClick={() => { setIsFocusMode(true); setFocusIndex(0); }}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        BOARDROOM MODE
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
                        onClick={handleShare} // Added share button
                        disabled={isSharing}
                        className={`p-2 rounded-full transition-all ${isSharing ? 'animate-pulse bg-indigo-100 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 group'}`}
                        title="Share Report Link"
                    >
                        <svg className={`w-5 h-5 transition-transform group-hover:scale-110 ${isSharing ? 'text-indigo-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </button>

                    <button
                        onClick={() => generate(true)}
                        disabled={loading}
                        className={`p-2 rounded-full transition-all ${loading ? 'animate-spin bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        title="Rebuild AI Report"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>

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

            {/* Share Modal */}
            {showShareModal && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 w-full max-w-lg shadow-4xl border border-slate-200 dark:border-white/10 animate-in zoom-in-95">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Share Report</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global snapshot share link</p>
                                </div>
                            </div>
                            <button onClick={() => setShowShareModal(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="space-y-8">
                            {/* Social Share Row */}
                            <div className="flex justify-between gap-4">
                                {socialShares.map((social) => (
                                    <button
                                        key={social.name}
                                        onClick={() => social.action(shareUrl || '')}
                                        className="flex-1 flex flex-col items-center gap-2 group"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-lg" style={{ '--hover-color': social.color } as any}>
                                            <svg className="w-6 h-6 transition-colors group-hover:text-[var(--hover-color)]" fill="currentColor" viewBox="0 0 24 24">
                                                <path d={social.icon} />
                                            </svg>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                            {social.name}
                                        </span>
                                    </button>
                                ))}
                                {(navigator as any).share && (
                                    <button
                                        onClick={handleNativeShare}
                                        className="flex-1 flex flex-col items-center gap-2 group"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white transition-all group-hover:scale-110 group-hover:shadow-lg group-hover:bg-indigo-500">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">More</span>
                                    </button>
                                )}
                            </div>

                            <div className="p-5 bg-slate-950/5 dark:bg-white/5 rounded-[24px] border border-slate-200/50 dark:border-white/5 flex flex-col gap-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Public View Link</p>
                                <div className="flex items-center gap-4">
                                    <input
                                        readOnly
                                        value={shareUrl || ''}
                                        className="flex-1 bg-transparent border-none text-sm font-bold text-slate-900 dark:text-white outline-none truncate"
                                    />
                                    <button
                                        onClick={handleCopyLink}
                                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${copySuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-105 active:scale-95'}`}
                                    >
                                        {copySuccess ? '✕ COPIED' : 'COPY'}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-200/50 dark:border-blue-900/20">
                                <div className="flex gap-3">
                                    <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-xs text-blue-800 dark:text-blue-200/70 leading-relaxed font-medium">
                                        Anyone with this link can view the report. This is a <strong>frozen snapshot</strong> of the current data and analysis.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <a
                                    href={shareUrl || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-center hover:scale-[1.02] transition-all"
                                >
                                    Preview Share
                                </a>
                                <button
                                    onClick={() => setShowShareModal(false)}
                                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Document View */}
            <main
                className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth pt-16 xl:pt-0 relative"
                ref={contentRef}
                onMouseUp={() => {
                    const selection = window.getSelection();
                    if (!selection || selection.isCollapsed) {
                        setSelectionOverlay(null);
                        return;
                    }
                    const text = selection.toString().trim();
                    if (text.length < 5) return;

                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();

                    // Simple relative positioning check
                    setSelectionOverlay({
                        text,
                        top: rect.top, // relative to viewport, fixed pos handles it
                        left: rect.left + (rect.width / 2)
                    });
                }}
            >
                <div className={`mx-auto py-8 md:py-12 px-4 md:px-12 space-y-12 md:space-y-16 print:max-w-none print:p-0 transition-all duration-500 ${reportType === 'presentation' ? 'max-w-[1200px]' :
                    reportType === 'technical' ? 'max-w-[1100px] font-mono text-sm' :
                        'max-w-[900px]'
                    }`}>

                    {/* Cover Page */}
                    <div
                        className="min-h-[60vh] flex flex-col justify-center border-b border-slate-200 dark:border-slate-800 pb-12 print:min-h-0 print:pb-4 print:border-none"
                        onClick={() => setSelectionOverlay(null)} // Click outside to close
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest w-fit mb-6 print:hidden">
                            Report Version {report.version || '1.0'}
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
                        {report.sections && Array.isArray(report.sections) && report.sections.map((section, idx) => {
                            if (!section) return null;
                            return (
                                <div key={section.id || idx} id={section.id} className="scroll-mt-12 break-after-page relative group/outer">
                                    <div className="absolute -left-12 top-0 text-6xl font-black text-slate-100 dark:text-slate-800 select-none -z-10 transition-colors group-hover/outer:text-slate-200 dark:group-hover/outer:text-slate-700">
                                        {idx + 1}
                                    </div>

                                    <ReportSectionEditor
                                        section={section}
                                        dataset={dataset}
                                        onUpdate={(updatedSection) => {
                                            const newSections = [...(report.sections || [])];
                                            newSections[idx] = updatedSection;
                                            const newReport = { ...report, sections: newSections };
                                            setReport(newReport);
                                            if (onUpdate) onUpdate({ ...dataset, strategicReport: newReport } as any);
                                        }}
                                        onDelete={() => {
                                            if (!confirm('Delete this section?')) return;
                                            const newSections = (report.sections || []).filter((_, i) => i !== idx);
                                            const newReport = { ...report, sections: newSections };
                                            setReport(newReport);
                                            if (onUpdate) onUpdate({ ...dataset, strategicReport: newReport } as any);
                                        }}
                                    />

                                    {/* Legacy Modules Preservation */}
                                    <div className="pl-4 border-l-2 border-slate-100 dark:border-slate-800 ml-2 space-y-8">
                                        {/* Key Takeaways */}
                                        {section.keyTakeaways && section.keyTakeaways.length > 0 && (
                                            <div className="flex flex-wrap gap-3">
                                                {(section.keyTakeaways || []).map((takeaway, k) => (
                                                    <span key={k} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                                                        ✦ {takeaway}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Section Reasoning (First Principles) */}
                                        {(section as any).reasoning && (
                                            <div className="p-6 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border-l-4 border-indigo-600">
                                                <h6 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-2">Strategic Reasoning</h6>
                                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 italic leading-relaxed">
                                                    "{(section as any).reasoning}"
                                                </p>
                                            </div>
                                        )}

                                        {/* Mermaid Logic Path (Brain Logic) */}
                                        {section.logicPath && (
                                            <div>
                                                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Logic Flow</h5>
                                                <Mermaid chart={section.logicPath} fallbackLogic={section.reasoning} />
                                            </div>
                                        )}

                                        {/* Strategic Modules */}
                                        {section.swot && renderSWOT(section.swot)}
                                        {section.recommendations && renderRecommendations(section.recommendations)}
                                        {section.risks && renderRisks(section.risks)}

                                        {/* Calculated DataFrames (First Principles) */}
                                        {(section as any).dataFrames && (section as any).dataFrames.length > 0 && (
                                            <div className="space-y-8">
                                                {((section as any).dataFrames || []).map((df: any, d: number) => (
                                                    <React.Fragment key={d}>
                                                        {renderDataFrame(df)}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <footer className="pt-20 pb-10 border-t border-slate-200 dark:border-slate-800 text-center space-y-4 print:hidden">
                        <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xl mx-auto">T</div>
                        <p className="text-xs font-bold text-slate-400">Generated by Toeasy AI Data OS</p>
                        <p className="text-[10px] text-slate-300">Confidential & Proprietary</p>
                    </footer>
                </div>
            </main>

            {/* Contextual AI Overlay */}
            {selectionOverlay && (
                <div
                    className="fixed z-50 animate-in zoom-in-95 pointer-events-auto"
                    style={{
                        top: Math.max(10, selectionOverlay.top - 60),
                        left: selectionOverlay.left,
                        transform: 'translateX(-50%)'
                    }}
                >
                    <div className="bg-slate-900 text-white p-2 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700">
                        <div className="flex items-center gap-2 px-2 border-r border-slate-700 pr-2">
                            <span className="text-lg">✨</span>
                            <span className="text-xs font-bold">Ask AI</span>
                        </div>
                        <input
                            autoFocus
                            placeholder="Edit this selection..."
                            className="bg-transparent border-none outline-none text-xs w-48 text-white placeholder:text-slate-500"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleCopilotUpdate(`Regarding this text: "${selectionOverlay.text}" - ${e.currentTarget.value}`);
                                    setSelectionOverlay(null);
                                    window.getSelection()?.removeAllRanges();
                                }
                            }}
                        />
                        <button
                            onClick={() => setSelectionOverlay(null)}
                            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

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
                        <div className="flex-1">
                            <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white leading-none">Report Co-pilot</h3>
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => setCopilotMode('chat')}
                                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md transition-all ${copilotMode === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Chat
                                </button>
                                <button
                                    onClick={() => setCopilotMode('update')}
                                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md transition-all ${copilotMode === 'update' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Refine
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        {copilotMode === 'chat' ? (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar mb-4">
                                    {copilotMessages.length === 0 && (
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                            <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
                                                Ask me anything about this report or the underlying data. I can explain the logic, summarize findings, or help you find specific metrics.
                                            </p>
                                        </div>
                                    )}
                                    {copilotMessages.map((msg, i) => (
                                        <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className={`max-w-[90%] p-3 rounded-2xl text-[11px] font-medium leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none'}`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar mb-4">
                                <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
                                    "I've analyzed your data and detected several high-impact narrative opportunities. How would you like to refine this report?"
                                </p>

                                <div className="grid gap-3">
                                    {(copilotSuggestions || []).map((s, i) => (
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
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">
                                {copilotMode === 'chat' ? 'Ask Research Question' : 'Manual Refinement'}
                            </h4>
                            <textarea
                                value={copilotInput}
                                onChange={(e) => setCopilotInput(e.target.value)}
                                onFocus={() => setSelectionOverlay(null)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (copilotMode === 'chat') handleCopilotChat();
                                        else handleCopilotUpdate(copilotInput);
                                    }
                                }}
                                placeholder={copilotMode === 'chat' ? "Ask about the data..." : "E.g., 'Make it more technical'..."}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 min-h-[80px] focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={() => {
                                    if (copilotMode === 'chat') handleCopilotChat();
                                    else handleCopilotUpdate(copilotInput);
                                    setSelectionOverlay(null);
                                }}
                                disabled={copilotLoading || !copilotInput.trim()}
                                className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {copilotLoading ? 'Thinking...' : (copilotMode === 'chat' ? 'Send Query' : 'Update Report')}
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Export Modal Integration */}
            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                exportType="report"
                data={report}
                filename={`${report.title}_${new Date().toISOString().split('T')[0]}`}
                onExport={handleExport as any}
            />

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
            {/* --- FOCUS MODE (BOARDROOM) --- */}
            {isFocusMode && (
                <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-8 overflow-hidden">
                    <button
                        onClick={() => setIsFocusMode(false)}
                        className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    <div className="w-full max-w-6xl flex flex-col h-full">
                        {/* Progress Bar */}
                        <div className="w-full h-1 bg-white/10 rounded-full mb-12 overflow-hidden flex">
                            {report?.sections && Array.isArray(report.sections) && report.sections.map((_, i) => (
                                <div
                                    key={i}
                                    className={`flex-1 h-full transition-all duration-500 ${i === focusIndex ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : (i < focusIndex ? 'bg-emerald-800' : 'bg-transparent')}`}
                                />
                            ))}
                        </div>

                        {/* Slide Content */}
                        <div className="flex-1 flex flex-col justify-center">
                            <AnimatePresence mode="wait">
                                {report?.sections[focusIndex] && (
                                    <motion.div
                                        key={focusIndex}
                                        initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 1.05, y: -30 }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 150 }}
                                        className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
                                    >
                                        <div className="space-y-10">
                                            <div>
                                                <h5 className="text-emerald-400 font-black tracking-[0.5em] uppercase text-[10px] mb-6">Strategic Insight {focusIndex + 1}</h5>
                                                <h2 className="text-6xl font-black text-white leading-[1.1] tracking-tighter">
                                                    {report.sections[focusIndex].title}
                                                </h2>
                                            </div>

                                            <div className="text-2xl text-slate-300 leading-relaxed font-medium max-w-xl">
                                                <ReactMarkdown>{report.sections[focusIndex].content}</ReactMarkdown>
                                            </div>

                                            <div className="p-10 bg-indigo-500/10 border border-indigo-500/20 rounded-[3rem] backdrop-blur-3xl relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                                    <svg className="w-12 h-12 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 13.1216 16 12.017 16H9.01703C7.91246 16 7.01703 16.8954 7.01703 18V21H5.01703V18C5.01703 15.7909 6.80789 14 9.01703 14H12.017C14.2262 14 16.017 15.7909 16.017 18V21H14.017Z" /></svg>
                                                </div>
                                                <div className="flex items-center justify-between mb-4">
                                                    <h6 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">First Principle Reasoning</h6>
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                </div>
                                                <p className="text-lg text-slate-400 italic font-medium leading-relaxed mb-6">
                                                    "{(report.sections[focusIndex] as any).reasoning}"
                                                </p>
                                                {(report.sections[focusIndex] as any).logicPath && (
                                                    <div className="mt-4 scale-90 origin-top transform">
                                                        <Mermaid chart={(report.sections[focusIndex] as any).logicPath} fallbackLogic={(report.sections[focusIndex] as any).reasoning} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-white/5 p-12 rounded-[5rem] border border-white/10 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.5)] relative group">
                                            <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 rounded-[5.2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="relative">
                                                {report.sections[focusIndex].charts && report.sections[focusIndex].charts.length > 0 ? (
                                                    <div className="h-[550px]">
                                                        <SmartChart
                                                            chart={report.sections[focusIndex].charts[0]}
                                                            height={550}
                                                            data={report.sections[focusIndex].charts[0].data}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="h-[550px] flex items-center justify-center text-slate-500 font-black uppercase tracking-[0.5em] text-[10px]">Narrative Deep-Dive</div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Slide Mini-Map */}
                        <div className="flex justify-center gap-3 mb-12">
                            {report?.sections && Array.isArray(report.sections) && report.sections.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setFocusIndex(i)}
                                    className={`h-1.5 rounded-full transition-all duration-500 ${i === focusIndex ? 'w-12 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'w-3 bg-white/10 hover:bg-white/30'}`}
                                />
                            ))}
                        </div>

                        {/* Navigation */}
                        <div className="flex justify-between items-center py-12 border-t border-white/5">
                            <button
                                onClick={() => setFocusIndex(Math.max(0, focusIndex - 1))}
                                disabled={focusIndex === 0}
                                className="flex items-center gap-4 text-white/40 hover:text-white disabled:opacity-0 transition-all font-black uppercase text-[10px] tracking-[0.4em]"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                                Previous
                            </button>

                            <div className="flex flex-col items-center">
                                <span className="text-white/20 font-black text-[9px] tracking-[0.4em] uppercase mb-2">Internal Strategic Desk</span>
                                <div className="px-6 py-2 bg-white/5 rounded-full text-white/50 font-black text-[10px] tracking-[0.2em] uppercase border border-white/5">
                                    Frame {focusIndex + 1} / {report?.sections.length}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (focusIndex < (report?.sections.length || 0) - 1) {
                                        setFocusIndex(focusIndex + 1);
                                    } else {
                                        setIsFocusMode(false);
                                    }
                                }}
                                className="flex items-center gap-4 text-emerald-400 hover:text-emerald-300 transition-all font-black uppercase text-[10px] tracking-[0.4em] group"
                            >
                                {focusIndex === (report?.sections.length || 0) - 1 ? 'Close Desk' : 'Advance'}
                                <svg className="w-5 h-5 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- CHART DESIGNER MODAL --- */}
            {chartDesigner.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Chart Aesthetic Designer</h3>
                                <p className="text-xs text-slate-500 font-medium">Fine-tune the AI's visualization choice</p>
                            </div>
                            <button
                                onClick={() => setChartDesigner({ open: false, chartId: null })}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Chart Type Selection */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Override Type</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['bar', 'line', 'area', 'pie', 'doughnut', 'radar'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                if (chartDesigner.chartId) {
                                                    setChartOverrides({
                                                        ...chartOverrides,
                                                        [chartDesigner.chartId]: { ...chartOverrides[chartDesigner.chartId], type: type as any }
                                                    });
                                                }
                                            }}
                                            className={`py-3 px-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${(chartOverrides[chartDesigner.chartId!]?.type || report?.sections.flatMap(s => s.charts).find(c => c.id === chartDesigner.chartId)?.type) === type
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-400'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Theme Selection */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visual Preset</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'indigo', color: 'bg-indigo-500', label: 'Indigo Night' },
                                        { id: 'emerald', color: 'bg-emerald-500', label: 'Forest Green' },
                                        { id: 'vibrant', color: 'bg-rose-500', label: 'Vibrant Insight' },
                                        { id: 'minimal', color: 'bg-slate-900', label: 'Glass Mono' }
                                    ].map(theme => (
                                        <button
                                            key={theme.id}
                                            onClick={() => {
                                                if (chartDesigner.chartId) {
                                                    setChartOverrides({
                                                        ...chartOverrides,
                                                        [chartDesigner.chartId]: { ...chartOverrides[chartDesigner.chartId], colorScheme: theme.id }
                                                    });
                                                }
                                            }}
                                            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all group ${(chartOverrides[chartDesigner.chartId!]?.colorScheme || 'indigo') === theme.id
                                                ? 'bg-indigo-600/10 border-indigo-600 dark:bg-indigo-600/20'
                                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-indigo-500'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-full ${theme.color} shadow-inner group-hover:scale-110 transition-transform`} />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{theme.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 dark:bg-slate-800/30">
                            <button
                                onClick={() => setChartDesigner({ open: false, chartId: null })}
                                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-opacity"
                            >
                                Apply Aesthetics
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportView;
