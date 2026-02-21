import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import {
  ManagerSummary,
  NextActionRecommendation,
  SimpleHomeState,
  WorkflowHealth,
  studioAPI
} from '../services/api';

type StudioPanel = 'sheets' | 'query' | 'pivot' | 'visuals' | 'report' | 'actions' | 'comms';
const validStudioPanels: StudioPanel[] = ['sheets', 'query', 'pivot', 'visuals', 'report', 'actions', 'comms'];

const fallbackRecommendation: NextActionRecommendation = {
  id: 'connect_data',
  panel: 'sheets',
  reason: 'Select a dataset and start your weekly RevOps room flow.',
  requiredInputs: [],
  confidence: 'medium'
};

const fallbackHome: SimpleHomeState = {
  nextStep: fallbackRecommendation,
  blockers: [],
  kpiSnapshot: {
    timeToInsightMin: null,
    insightToActionMin: null,
    manualUpdateReductionPct: 0,
    evidenceCoverageRatio: 0
  },
  pendingApprovals: 0,
  overdueActions: 0
};

const fallbackHealth: WorkflowHealth = {
  completionPct: 0,
  blockers: [],
  missingRequiredArtifacts: [],
  stageLatency: []
};

const SimpleModeHome: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [home, setHome] = useState<SimpleHomeState>(fallbackHome);
  const [health, setHealth] = useState<WorkflowHealth>(fallbackHealth);
  const [managerSummary, setManagerSummary] = useState<ManagerSummary | null>(null);
  const [dashboards, setDashboards] = useState<Array<{ id: number; name: string; timeframeDays?: number; tileIds?: number[] }>>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; panel: StudioPanel }>>([]);
  const [dashboardBusy, setDashboardBusy] = useState(false);

  const workspaceId = useMemo(() => {
    const fromUrl = searchParams.get('workspace');
    if (fromUrl) return fromUrl;
    if (activeWorkspace?.id) return String(activeWorkspace.id);
    if (workspaces.length > 0) return String(workspaces[0].id);
    return '';
  }, [activeWorkspace, searchParams, workspaces]);
  const datasetId = searchParams.get('dataset');
  const projectId = searchParams.get('project');
  const roomId = searchParams.get('room');

  useEffect(() => {
    if (!workspaceId) return;
    const workspace = workspaces.find((item) => String(item.id) === workspaceId);
    if (workspace && (!activeWorkspace || workspace.id !== activeWorkspace.id)) {
      setActiveWorkspace(workspace);
    }
  }, [activeWorkspace, setActiveWorkspace, workspaceId, workspaces]);

  useEffect(() => {
    if (!workspaceId || !roomId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [homeResult, managerResult, dashboardsResult, templatesResult] = await Promise.all([
          studioAPI.getSimpleHome(workspaceId, roomId, { periodDays: 7 }),
          studioAPI.getSimpleManagerSummary(workspaceId, roomId, { periodDays: 7 }),
          studioAPI.listRoomDashboards(workspaceId, roomId),
          studioAPI.getRevopsTemplates(workspaceId, roomId)
        ]);

        if (cancelled) return;
        setHome(homeResult.data?.home || fallbackHome);
        setHealth(homeResult.data?.workflowHealth || fallbackHealth);
        setManagerSummary(managerResult.data?.summary || null);
        setDashboards((dashboardsResult.data?.dashboards || []).map((entry: any) => ({
          id: Number(entry.id),
          name: String(entry.name || `Dashboard ${entry.id}`),
          timeframeDays: entry.timeframeDays ? Number(entry.timeframeDays) : 7,
          tileIds: Array.isArray(entry.tileIds) ? entry.tileIds : []
        })));
        setTemplates((templatesResult.data?.templates || []).map((entry: any) => ({
          id: String(entry.id),
          name: String(entry.name || 'Template'),
          panel: validStudioPanels.includes(entry.panel as StudioPanel) ? entry.panel as StudioPanel : 'visuals'
        })));
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.error || err?.message || 'Failed to load simple mode state.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, roomId]);

  const buildStudioUrl = (panel: StudioPanel) => {
    const params = new URLSearchParams();
    if (workspaceId) params.set('workspace', workspaceId);
    if (datasetId) params.set('dataset', datasetId);
    if (projectId) params.set('project', projectId);
    if (roomId) params.set('room', roomId);
    params.set('panel', panel);
    return `/app/studio?${params.toString()}`;
  };

  const switchToProMode = async () => {
    if (!workspaceId) return;
    try {
      await studioAPI.setMode(workspaceId, 'pro');
    } catch {
      // noop: route still switches even if preference save fails
    }
    navigate(buildStudioUrl(home.nextStep.panel || 'sheets'));
  };

  const handleCreateDashboard = async () => {
    if (!workspaceId || !roomId || dashboardBusy) return;
    setDashboardBusy(true);
    try {
      const created = await studioAPI.createRoomDashboard(workspaceId, roomId, {
        name: `Weekly Dashboard ${new Date().toISOString().slice(5, 10)}`,
        description: 'Auto-created from Simple Mode.',
        timeframeDays: 7
      });
      const dashboard = created.data?.dashboard;
      if (dashboard) {
        setDashboards((prev) => [
          {
            id: Number(dashboard.id),
            name: String(dashboard.name || `Dashboard ${dashboard.id}`),
            timeframeDays: dashboard.timeframeDays ? Number(dashboard.timeframeDays) : 7,
            tileIds: Array.isArray(dashboard.tileIds) ? dashboard.tileIds : []
          },
          ...prev
        ]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to create dashboard.');
    } finally {
      setDashboardBusy(false);
    }
  };

  if (!workspaceId) {
    return <Navigate to="/app/workspaces" replace />;
  }

  if (!roomId) {
    return <Navigate to={`/app/studio?workspace=${workspaceId}`} replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Simple Mode</h1>
              <p className="text-sm text-slate-600 mt-1">
                Build weekly decisions fast. Pro Mode is available any time for deeper analysis.
              </p>
            </div>
            <button
              onClick={switchToProMode}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Open Pro Mode
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate(buildStudioUrl('visuals'))}
            className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300"
          >
            <div className="text-sm font-semibold text-slate-900">Build Weekly Dashboard</div>
            <div className="text-xs text-slate-600 mt-1">Use templates and visual tiles for trend review.</div>
          </button>
          <button
            onClick={() => navigate(buildStudioUrl('report'))}
            className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300"
          >
            <div className="text-sm font-semibold text-slate-900">Run Weekly Brief</div>
            <div className="text-xs text-slate-600 mt-1">Generate evidence-first report and pass quality checks.</div>
          </button>
          <button
            onClick={() => navigate(buildStudioUrl('actions'))}
            className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300"
          >
            <div className="text-sm font-semibold text-slate-900">Review Actions</div>
            <div className="text-xs text-slate-600 mt-1">Assign owners and sync follow-up to Slack.</div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">Room dashboards</div>
              <button
                onClick={handleCreateDashboard}
                disabled={dashboardBusy}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-60"
              >
                {dashboardBusy ? 'Creating...' : 'New dashboard'}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {dashboards.length === 0 && (
                <div className="text-xs text-slate-500">No room dashboards yet. Create one to track weekly trends.</div>
              )}
              {dashboards.slice(0, 4).map((dashboard) => (
                <button
                  key={dashboard.id}
                  onClick={() => navigate(buildStudioUrl('visuals'))}
                  className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:border-indigo-300"
                >
                  <div className="text-xs font-semibold text-slate-900">{dashboard.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {dashboard.tileIds?.length || 0} tile(s) • {dashboard.timeframeDays || 7} days
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-slate-900">RevOps templates</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {templates.length === 0 && (
                <div className="text-xs text-slate-500">Templates will appear after room initialization.</div>
              )}
              {templates.slice(0, 8).map((template) => (
                <button
                  key={template.id}
                  onClick={() => navigate(buildStudioUrl(template.panel))}
                  className="px-2.5 py-1.5 rounded-full border border-slate-300 text-xs text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-slate-900">Next best step</div>
            <div className="text-sm text-slate-700 mt-2">{home.nextStep.reason}</div>
            <div className="text-xs text-slate-500 mt-2">Panel: {home.nextStep.panel}</div>
            {home.nextStep.requiredInputs?.length > 0 && (
              <ul className="mt-3 text-xs text-amber-700 space-y-1">
                {home.nextStep.requiredInputs.map((item, idx) => (
                  <li key={`${item}-${idx}`}>- {item}</li>
                ))}
              </ul>
            )}
            <button
              onClick={() => navigate(buildStudioUrl(home.nextStep.panel))}
              className="mt-3 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium"
            >
              Continue
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-slate-900">Workflow health</div>
            <div className="text-sm text-slate-700 mt-2">Completion: {health.completionPct}%</div>
            <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                <div className="text-slate-500">Pending approvals</div>
                <div className="text-slate-900 font-semibold">{home.pendingApprovals}</div>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                <div className="text-slate-500">Overdue actions</div>
                <div className="text-slate-900 font-semibold">{home.overdueActions}</div>
              </div>
            </div>
            {health.blockers.length > 0 && (
              <ul className="mt-3 text-xs text-rose-700 space-y-1">
                {health.blockers.slice(0, 4).map((blocker, idx) => (
                  <li key={`${blocker}-${idx}`}>- {blocker}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-slate-900">KPI Snapshot</div>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Time to insight</span>
                <span>{home.kpiSnapshot.timeToInsightMin ?? 'n/a'} min</span>
              </div>
              <div className="flex justify-between">
                <span>Insight to action</span>
                <span>{home.kpiSnapshot.insightToActionMin ?? 'n/a'} min</span>
              </div>
              <div className="flex justify-between">
                <span>Manual update reduction</span>
                <span>{home.kpiSnapshot.manualUpdateReductionPct}%</span>
              </div>
              <div className="flex justify-between">
                <span>Evidence coverage</span>
                <span>{Math.round(home.kpiSnapshot.evidenceCoverageRatio * 100)}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-slate-900">Manager summary</div>
            {managerSummary ? (
              <div className="mt-3 space-y-2 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>Blocked publishes</span>
                  <span>{managerSummary.blockedPublishes}</span>
                </div>
                <div className="flex justify-between">
                  <span>Automation failures (24h)</span>
                  <span>{managerSummary.automationFailures24h}</span>
                </div>
                <div className="mt-2 text-slate-600">
                  {(managerSummary.recommendedActions || []).slice(0, 2).map((item, idx) => (
                    <div key={`${item}-${idx}`}>- {item}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-slate-500">Manager summary unavailable for this room.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleModeHome;
