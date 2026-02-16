import React, { useState } from 'react';
import { ChartSpec, DashboardConfig, ReportSection } from '../../../types';
import { dashboardAPI, reportsAPI } from '../../services/api';
import html2canvas from 'html2canvas';

interface SendToMenuProps {
    chart: ChartSpec;
    elementId?: string; // ID of the DOM element to capture for image export
    onClose?: () => void;
}

export const SendToMenu: React.FC<SendToMenuProps> = ({ chart, elementId, onClose }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [dashboards, setDashboards] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [mode, setMode] = useState<'menu' | 'select-dashboard' | 'select-report'>('menu');

    // Load available targets
    const loadTargets = async (type: 'dashboard' | 'report') => {
        try {
            if (type === 'dashboard') {
                const workspaceId = localStorage.getItem('current_workspace_id');
                if (!workspaceId) return;
                const res = await dashboardAPI.list(workspaceId);
                setDashboards(res.data || []);
                setMode('select-dashboard');
            } else {
                const workspaceId = localStorage.getItem('current_workspace_id');
                if (!workspaceId) return;
                const res = await reportsAPI.list(workspaceId);
                setReports(res.data || []);
                setMode('select-report');
            }
        } catch (err) {
            console.error("Failed to load targets", err);
        }
    };

    const handleSendToDashboard = async (dashboardId: string) => {
        setSubmitting(true);
        try {
            const workspaceId = localStorage.getItem('current_workspace_id');
            if (!workspaceId) return;

            // Fetch current dashboard to append
            const currentDash = await dashboardAPI.get(workspaceId, dashboardId);
            const updatedCharts = [...(currentDash.data.config.charts || []), chart];

            await dashboardAPI.update(workspaceId, dashboardId, {
                ...currentDash.data,
                config: {
                    ...currentDash.data.config,
                    charts: updatedCharts
                }
            });

            alert('Chart added to dashboard!');
            setIsOpen(false);
        } catch (err) {
            alert('Failed to add to dashboard');
            console.error(err);
        } finally {
            setSubmitting(false);
            if (onClose) onClose();
        }
    };

    const handleSendToReport = async (reportId: string) => {
        setSubmitting(true);
        try {
            const workspaceId = localStorage.getItem('current_workspace_id');
            if (!workspaceId) return;

            // Fetch report
            const currentReport = await reportsAPI.get(workspaceId, reportId);
            // Append to first section for now (or let user pick section in V2)
            const sections = currentReport.data.sections || [];
            if (sections.length > 0) {
                sections[0].charts = [...(sections[0].charts || []), chart];

                await reportsAPI.update(workspaceId, reportId, {
                    ...currentReport.data,
                    sections
                });
                alert('Chart added to report!');
                setIsOpen(false);
            } else {
                alert('Report has no sections to add to.');
            }

        } catch (err) {
            alert('Failed to add to report');
            console.error(err);
        } finally {
            setSubmitting(false);
            if (onClose) onClose();
        }
    };

    const handleDownloadImage = async () => {
        if (!elementId) return;
        const element = document.getElementById(elementId);
        if (!element) return;

        try {
            const canvas = await html2canvas(element);
            const link = document.createElement('a');
            link.download = `${chart.title || 'chart'}.png`;
            link.href = canvas.toDataURL();
            link.click();
        } catch (err) {
            console.error("Screenshot failed", err);
        }
    };

    const handleCopyJSON = () => {
        navigator.clipboard.writeText(JSON.stringify(chart, null, 2));
        alert('Chart config copied to clipboard!');
    };

    return (
        <div className="relative inline-block text-left">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-md transition-colors"
                title="Send To..."
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 origin-top-right focus:outline-none">
                    <div className="py-1" role="menu" aria-orientation="vertical">

                        {mode === 'menu' && (
                            <>
                                <button
                                    onClick={() => loadTargets('dashboard')}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                >
                                    <span>📈</span> Send to Dashboard
                                </button>
                                <button
                                    onClick={() => loadTargets('report')}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                >
                                    <span>📝</span> Send to Report
                                </button>
                                <button
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    onClick={() => {
                                        // Navigate to playground with query
                                        // Needs specialized implementation or useHistory
                                        alert('Coming soon: Open in Playground');
                                    }}
                                >
                                    <span>🧪</span> Open in Playground
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                    onClick={handleDownloadImage}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                >
                                    <span>📸</span> Download as PNG
                                </button>
                                <button
                                    onClick={handleCopyJSON}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                >
                                    <span>📋</span> Copy Widget JSON
                                </button>
                            </>
                        )}

                        {mode === 'select-dashboard' && (
                            <div className="max-h-60 overflow-y-auto">
                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 flex justify-between items-center">
                                    Select Dashboard
                                    <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-gray-600">✕</button>
                                </div>
                                {dashboards.map(d => (
                                    <button
                                        key={d.id}
                                        onClick={() => handleSendToDashboard(d.id)}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 truncate"
                                    >
                                        {d.name}
                                    </button>
                                ))}
                                {dashboards.length === 0 && <div className="px-4 py-2 text-sm text-gray-500 italic">No dashboards found</div>}
                            </div>
                        )}

                        {mode === 'select-report' && (
                            <div className="max-h-60 overflow-y-auto">
                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 flex justify-between items-center">
                                    Select Report
                                    <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-gray-600">✕</button>
                                </div>
                                {reports.map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => handleSendToReport(r.id)}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 truncate"
                                    >
                                        {r.title}
                                    </button>
                                ))}
                                {reports.length === 0 && <div className="px-4 py-2 text-sm text-gray-500 italic">No reports found</div>}
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
};
