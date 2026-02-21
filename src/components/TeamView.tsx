import React, { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { TeamMembers } from './Workspaces/TeamMembers';
import { Users } from 'lucide-react';
import { ManagerSummary, ReadinessDecision, StudioNavigationState, studioAPI } from '../services/api';

const TeamView: React.FC = () => {
    const { activeWorkspace, isLoading } = useWorkspace();
    const workspaceId = activeWorkspace?.id ? String(activeWorkspace.id) : '';
    const [navigationState, setNavigationState] = useState<StudioNavigationState | null>(null);
    const [managerSummary, setManagerSummary] = useState<ManagerSummary | null>(null);
    const [readiness, setReadiness] = useState<ReadinessDecision | null>(null);
    const [openIncidents, setOpenIncidents] = useState(0);

    useEffect(() => {
        const load = async () => {
            if (!workspaceId) return;
            try {
                const navigationResult = await studioAPI.getNavigationState(workspaceId);
                const nav = navigationResult.data || null;
                setNavigationState(nav);
                const roomId = nav?.active?.roomId || nav?.rooms?.[0]?.id;
                if (!roomId) {
                    setManagerSummary(null);
                    setReadiness(null);
                    setOpenIncidents(0);
                    return;
                }
                const [summaryResult, readinessResult, incidentsResult] = await Promise.all([
                    studioAPI.getManagerSummary(workspaceId, String(roomId), { periodDays: 14 }),
                    studioAPI.getReadinessDecision(workspaceId, String(roomId), { periodDays: 14 }),
                    studioAPI.listPilotIncidents(workspaceId, { status: 'open', severity: 'all', periodDays: 14 })
                ]);
                setManagerSummary(summaryResult.data?.summary || null);
                setReadiness(readinessResult.data || null);
                setOpenIncidents(Number(incidentsResult.data?.counts?.open || 0));
            } catch (error) {
                console.error('Failed to load team operations summary:', error);
                setManagerSummary(null);
                setReadiness(null);
                setOpenIncidents(0);
            }
        };
        load();
    }, [workspaceId]);

    const activeRoomLabel = useMemo(() => {
        const roomId = navigationState?.active?.roomId;
        if (!roomId) return 'No active room';
        const room = navigationState?.rooms?.find((entry) => Number(entry.id) === Number(roomId));
        return room?.name || `Room ${roomId}`;
    }, [navigationState]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!activeWorkspace) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 p-8 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-[32px] flex items-center justify-center mb-6 shadow-inner">
                    <Users className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">No WorkspaceSelected</h3>
                <p className="max-w-xs mx-auto font-medium">Please select a workspace from the sidebar to manage your team members.</p>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4 border border-indigo-100 dark:border-indigo-800">
                        <Users className="w-3 h-3" />
                        <span>Workspace Team</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">
                        Team Management
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
                        Manage members and permissions for <span className="text-indigo-600 dark:text-indigo-400 font-bold">{activeWorkspace.name}</span>
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="text-xs uppercase font-bold text-slate-500">Active Room</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{activeRoomLabel}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="text-xs uppercase font-bold text-slate-500">Pending Approvals</div>
                    <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{managerSummary?.pendingApprovals ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="text-xs uppercase font-bold text-slate-500">Blocked Publishes</div>
                    <div className="mt-2 text-2xl font-black text-amber-600">{managerSummary?.blockedPublishes ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="text-xs uppercase font-bold text-slate-500">Open Incidents</div>
                    <div className="mt-2 text-2xl font-black text-rose-600">{openIncidents}</div>
                    <div className="text-xs text-slate-500 mt-1">
                        Readiness: {readiness?.overall === 'go' ? 'GO' : readiness?.overall === 'no_go' ? 'NO-GO' : 'n/a'}
                    </div>
                </div>
            </div>

            <div className="relative">
                {/* Subtle background glow */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none"></div>

                <TeamMembers workspaceId={String(activeWorkspace.id)} />
            </div>
        </div>
    );
};

export default TeamView;
