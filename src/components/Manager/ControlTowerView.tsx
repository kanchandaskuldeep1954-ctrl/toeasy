import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../../hooks/useWorkspace';
import {
  ManagerSummary,
  ReadinessDecision,
  ReliabilityScorecard,
  StudioNavigationState,
  studioAPI
} from '../../services/api';

const toErrorMessage = (error: any) =>
  error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Request failed';

const formatPercent = (value: number | null, digits: number = 1) => {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `${(value * 100).toFixed(digits)}%`;
};

const formatGateActual = (value: number | string | null) => {
  if (value == null) return 'n/a';
  if (typeof value === 'number' && value >= 0 && value <= 1) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return String(value);
};

const ControlTowerView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();

  const workspaceId = searchParams.get('workspace') || String(activeWorkspace?.id || '');
  const [navigationState, setNavigationState] = useState<StudioNavigationState | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(searchParams.get('room') || '');
  const [periodDays, setPeriodDays] = useState<number>(Number(searchParams.get('periodDays')) || 7);

  const [loadingNavigation, setLoadingNavigation] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [managerSummary, setManagerSummary] = useState<ManagerSummary | null>(null);
  const [reliabilityScorecard, setReliabilityScorecard] = useState<ReliabilityScorecard | null>(null);
  const [readinessDecision, setReadinessDecision] = useState<ReadinessDecision | null>(null);

  const roomOptions = navigationState?.rooms || [];
  const selectedRoom = useMemo(
    () => roomOptions.find((room) => String(room.id) === String(selectedRoomId)) || null,
    [roomOptions, selectedRoomId]
  );
  const datasetId = searchParams.get('dataset') || String(navigationState?.active?.datasetId || '');
  const projectId = selectedRoom?.projectId
    ? String(selectedRoom.projectId)
    : searchParams.get('project') || String(navigationState?.active?.projectId || '');

  const updateQueryParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value == null || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    if (!workspaceId) {
      setNavigationState(null);
      setSelectedRoomId('');
      return;
    }

    let cancelled = false;
    const loadNavigation = async () => {
      setLoadingNavigation(true);
      try {
        const response = await studioAPI.getNavigationState(workspaceId);
        if (cancelled) return;
        const nav = response.data || null;
        setNavigationState(nav);
        setSelectedRoomId((current) => {
          if (current) return current;
          const roomFromQuery = searchParams.get('room');
          if (roomFromQuery) return roomFromQuery;
          if (nav?.active?.roomId) return String(nav.active.roomId);
          if (nav?.rooms?.length) return String(nav.rooms[0].id);
          return '';
        });
      } catch (error) {
        if (!cancelled) setErrorMessage(toErrorMessage(error));
      } finally {
        if (!cancelled) setLoadingNavigation(false);
      }
    };

    loadNavigation();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, searchParams]);

  const refreshControlTower = useCallback(async () => {
    if (!workspaceId || !selectedRoomId) return;
    setLoadingSummary(true);
    setErrorMessage('');
    try {
      const [summaryResponse, reliabilityResponse, readinessResponse] = await Promise.all([
        studioAPI.getManagerSummary(workspaceId, selectedRoomId, { periodDays }),
        studioAPI.getReliabilityScorecard(workspaceId, selectedRoomId, { periodDays }),
        studioAPI.getReadinessDecision(workspaceId, selectedRoomId, { periodDays })
      ]);

      setManagerSummary(summaryResponse.data?.summary || null);
      setReliabilityScorecard(reliabilityResponse.data?.scorecard || null);
      setReadinessDecision(readinessResponse.data || null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoadingSummary(false);
    }
  }, [workspaceId, selectedRoomId, periodDays]);

  useEffect(() => {
    if (!workspaceId || !selectedRoomId) return;
    refreshControlTower();
  }, [workspaceId, selectedRoomId, periodDays, refreshControlTower]);

  const onRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    const room = roomOptions.find((candidate) => String(candidate.id) === String(roomId));
    updateQueryParams({
      workspace: workspaceId || null,
      room: roomId || null,
      project: room?.projectId ? String(room.projectId) : projectId || null,
      dataset: datasetId || null
    });
  };

  const onPeriodChange = (days: number) => {
    setPeriodDays(days);
    updateQueryParams({
      workspace: workspaceId || null,
      room: selectedRoomId || null,
      project: projectId || null,
      dataset: datasetId || null,
      periodDays: String(days)
    });
  };

  const openStudioPanel = (panel: 'sheets' | 'query' | 'pivot' | 'visuals' | 'report' | 'actions' | 'comms') => {
    const query = new URLSearchParams();
    if (workspaceId) query.set('workspace', workspaceId);
    if (datasetId) query.set('dataset', datasetId);
    if (projectId) query.set('project', projectId);
    if (selectedRoomId) query.set('room', selectedRoomId);
    query.set('panel', panel);
    navigate(`/app/studio?${query.toString()}`);
  };

  const topRisk = managerSummary?.topRisks?.[0] || readinessDecision?.blockers?.[0] || 'No immediate risk flagged.';
  const nextAction = managerSummary?.recommendedActions?.[0] || 'Review gate failures and unblock evidence issues.';
  const gatingPassCount = readinessDecision?.gateResults?.filter((gate) => gate.passed).length || 0;
  const gatingTotal = readinessDecision?.gateResults?.length || 0;

  return (
    <div className="min-h-full p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white space-y-5">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight">Manager Control Tower</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              One view for approvals, reliability, readiness gates, and ownership risk.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openStudioPanel('report')}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm"
            >
              Open report lane
            </button>
            <button
              onClick={() => openStudioPanel('actions')}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm"
            >
              Open action board
            </button>
            <button
              onClick={() => openStudioPanel('comms')}
              className="px-3 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm"
            >
              Open comms
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-4 mt-4">
          <label className="text-xs uppercase font-semibold text-slate-500">
            Room
            <select
              value={selectedRoomId}
              onChange={(event) => onRoomChange(event.target.value)}
              className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              {!roomOptions.length && <option value="">No rooms found</option>}
              {roomOptions.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} ({room.stage || 'ingest'})
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs uppercase font-semibold text-slate-500">
            Gate Window
            <select
              value={periodDays}
              onChange={(event) => onPeriodChange(Number(event.target.value) || 7)}
              className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </label>

          <div className="text-xs uppercase font-semibold text-slate-500">
            Workspace
            <div className="mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm normal-case">
              {activeWorkspace?.name || `Workspace ${workspaceId || '-'}`}
            </div>
          </div>

          <div className="text-xs uppercase font-semibold text-slate-500">
            Data Context
            <div className="mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm normal-case">
              {datasetId ? `Dataset ${datasetId}` : 'No dataset selected'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => {
              refreshControlTower().catch((error) => setErrorMessage(toErrorMessage(error)));
            }}
            disabled={loadingSummary || !workspaceId || !selectedRoomId}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            {loadingSummary ? 'Refreshing...' : 'Refresh control tower'}
          </button>
          {(loadingNavigation || loadingSummary) && (
            <span className="text-xs text-slate-500">Loading latest room health...</span>
          )}
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm">
          {errorMessage}
        </div>
      )}

      {!workspaceId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          Select a workspace to load manager control tower data.
        </div>
      )}

      {workspaceId && !selectedRoomId && !loadingNavigation && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          No rooms are available yet. Create or bootstrap a room in Studio first.
        </div>
      )}

      {workspaceId && selectedRoomId && (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs uppercase font-semibold text-slate-500">Go / No-Go</div>
              <div className="mt-2 text-2xl font-black">
                <span className={readinessDecision?.overall === 'go' ? 'text-emerald-600' : 'text-rose-600'}>
                  {readinessDecision?.overall === 'go' ? 'GO' : 'NO-GO'}
                </span>
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Gates: {gatingPassCount}/{gatingTotal}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Checked: {readinessDecision?.checkedAt ? new Date(readinessDecision.checkedAt).toLocaleString() : 'n/a'}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs uppercase font-semibold text-slate-500">Manager Summary</div>
              <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <div>Pending approvals: {managerSummary?.pendingApprovals ?? 0}</div>
                <div>Blocked publishes: {managerSummary?.blockedPublishes ?? 0}</div>
                <div>Overdue actions: {managerSummary?.overdueActions ?? 0}</div>
                <div>Automation failures (24h): {managerSummary?.automationFailures24h ?? 0}</div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs uppercase font-semibold text-slate-500">Reliability Health</div>
              <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <div>Scheduled run success: {formatPercent(reliabilityScorecard?.scheduledRunSuccessRate ?? null)}</div>
                <div>Report publish success: {formatPercent(reliabilityScorecard?.publishSuccessRate ?? null)}</div>
                <div>Duplicate side effects: {reliabilityScorecard?.duplicateSideEffects ?? 0}</div>
                <div>MTTR: {reliabilityScorecard?.mttrMinutes != null ? `${reliabilityScorecard.mttrMinutes.toFixed(1)} min` : 'n/a'}</div>
              </div>
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs uppercase font-semibold text-slate-500">Top Risk</div>
              <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{topRisk}</div>
              <div className="mt-4 text-xs uppercase font-semibold text-slate-500">Recommended Next Action</div>
              <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{nextAction}</div>
              <div className="mt-4 space-y-2">
                {(managerSummary?.recommendedActions || []).slice(0, 4).map((action) => (
                  <div key={action} className="text-sm rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                    {action}
                  </div>
                ))}
                {(managerSummary?.recommendedActions || []).length === 0 && (
                  <div className="text-sm text-slate-500">No explicit recommendations yet.</div>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs uppercase font-semibold text-slate-500">Gate Results</div>
              <div className="mt-3 space-y-2">
                {(readinessDecision?.gateResults || []).map((gate) => (
                  <div key={gate.key} className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{gate.label}</div>
                      <span className={gate.passed ? 'text-emerald-600 text-xs font-semibold' : 'text-amber-700 text-xs font-semibold'}>
                        {gate.passed ? 'pass' : 'fail'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Threshold: {gate.threshold} | Actual: {formatGateActual(gate.actual)}
                    </div>
                    {gate.note && <div className="text-xs text-slate-500 mt-1">{gate.note}</div>}
                  </div>
                ))}
                {(readinessDecision?.gateResults || []).length === 0 && (
                  <div className="text-sm text-slate-500">No gate evaluation found for this room yet.</div>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs uppercase font-semibold text-slate-500">Failure Buckets</div>
              <div className="mt-3 space-y-2">
                {(reliabilityScorecard?.failureByCode || []).map((bucket) => (
                  <div key={bucket.code} className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{bucket.code}</div>
                      <div className="text-xs text-slate-500">count: {bucket.count}</div>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      terminal: {bucket.terminalCount} | retryable: {bucket.retryableCount}
                    </div>
                    {bucket.operatorAction && (
                      <div className="text-xs text-amber-700 mt-1">{bucket.operatorAction}</div>
                    )}
                  </div>
                ))}
                {(reliabilityScorecard?.failureByCode || []).length === 0 && (
                  <div className="text-sm text-slate-500">No failure events recorded in selected period.</div>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs uppercase font-semibold text-slate-500">Weekly Reliability Trend</div>
              <div className="mt-3 space-y-2">
                {(reliabilityScorecard?.weeklyScheduledRunSuccessRates || []).map((week) => (
                  <div key={week.weekStart} className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span>{new Date(week.weekStart).toLocaleDateString()}</span>
                      <span className="font-semibold">{formatPercent(week.successRate, 1)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Resolved runs: {week.resolvedRuns}</div>
                  </div>
                ))}
                {(reliabilityScorecard?.weeklyScheduledRunSuccessRates || []).length === 0 && (
                  <div className="text-sm text-slate-500">No weekly reliability samples available.</div>
                )}
              </div>
              <div className="mt-4 text-xs text-slate-500">
                Samples: runs {reliabilityScorecard?.sampleSizes?.scheduledRuns ?? 0}, publish {reliabilityScorecard?.sampleSizes?.publishAttempts ?? 0}, failures {reliabilityScorecard?.sampleSizes?.failureEvents ?? 0}
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
};

export default ControlTowerView;
