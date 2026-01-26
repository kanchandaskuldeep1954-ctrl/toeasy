/**
 * PublicShareView Component
 * 
 * Renders shared dashboards/reports publicly WITHOUT authentication.
 * Uses frozen snapshot data - NO regeneration, NO hallucination.
 * 
 * Route: /public/share/:token
 */

import { useTheme } from '../hooks/useTheme';

const PublicShareView: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shareData, setShareData] = useState<ShareSnapshot | null>(null);
    const { theme, toggleTheme } = useTheme();

    const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3000/api';

    useEffect(() => {
        if (token) {
            fetchShareData();
        }
    }, [token]);

    const fetchShareData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${backendUrl}/sharing/${token}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load shared content');
            }

            const data = await response.json();
            setShareData(data);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'This share link is invalid or has expired.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400">Loading shared content...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Link Unavailable</h1>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                        Go to Toeasy
                    </Link>
                </div>
            </div>
        );
    }

    if (!shareData) return null;

    const { resourceType, title, snapshot } = shareData;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            {/* Header */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black">
                            T
                        </div>
                        <span className="font-black text-xl text-slate-900 dark:text-white">Toeasy</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-200 dark:border-slate-700"
                        >
                            {theme === 'dark' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" /></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            )}
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                                {resourceType}
                            </span>
                            <span className="text-xs text-slate-400">Read-only</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Title */}
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-8">{title}</h1>

                {/* Dashboard View */}
                {resourceType === 'dashboard' && (
                    <div className="space-y-8">
                        {/* KPIs */}
                        {snapshot.kpis && snapshot.kpis.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {snapshot.kpis.map((kpi, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                                        <p className="text-xs font-bold uppercase text-slate-500 mb-2">{kpi.label}</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</p>
                                        {kpi.change && (
                                            <p className={`text-xs font-bold mt-1 ${kpi.change.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {kpi.change}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Charts */}
                        {snapshot.charts && snapshot.charts.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {snapshot.charts.map((chart, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{chart.title}</h3>
                                        <PlotlyChart
                                            chart={chart.spec || { type: chart.type, title: chart.title } as any}
                                            data={chart.data}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Report View */}
                {resourceType === 'report' && (
                    <div className="space-y-8">
                        {snapshot.summary && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900/30">
                                <h2 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 mb-2">Executive Summary</h2>
                                <p className="text-indigo-800 dark:text-indigo-200">{snapshot.summary}</p>
                            </div>
                        )}

                        {snapshot.sections && snapshot.sections.map((section, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{section.title}</h2>
                                <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: section.content }} />

                                {section.charts && section.charts.length > 0 && (
                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {section.charts.map((chart, cIdx) => (
                                            <PlotlyChart
                                                key={cIdx}
                                                chart={chart.spec || { type: chart.type } as any}
                                                data={chart.data}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Footer - Branding & CTA */}
            <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8 mt-12">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                        This dashboard was created with <span className="font-bold text-indigo-600">Toeasy</span>
                    </p>
                    <Link
                        to="/signup"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                        Create Your Own Dashboard
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </Link>
                    <p className="text-xs text-slate-400 mt-6">© 2026 Toeasy. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default PublicShareView;
