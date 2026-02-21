import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { studioAPI } from '../services/api';
import AnalyticsStudio from './AnalyticsStudio';

type StudioEntrySource = 'app_root' | 'studio_route';
type BootstrapSource = 'login' | 'upload' | 'dataset_library' | 'deep_link';
type StudioPanel = 'sheets' | 'query' | 'pivot' | 'visuals' | 'report' | 'actions' | 'comms';

interface StudioEntryRedirectProps {
  source: StudioEntrySource;
}

const VALID_PANELS: StudioPanel[] = ['sheets', 'query', 'pivot', 'visuals', 'report', 'actions', 'comms'];

const applyUxModeToRoute = (route: string, mode: 'simple' | 'pro') => {
  if (mode === 'simple') {
    if (route.startsWith('/app/studio?')) return route.replace('/app/studio?', '/app/simple?');
    if (route === '/app/studio') return '/app/simple';
  }
  if (mode === 'pro') {
    if (route.startsWith('/app/simple?')) return route.replace('/app/simple?', '/app/studio?');
    if (route === '/app/simple') return '/app/studio';
  }
  return route;
};

const StudioEntryRedirect: React.FC<StudioEntryRedirectProps> = ({ source }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [resolvedRoute, setResolvedRoute] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [uxMode, setUxMode] = useState<'simple' | 'pro' | null>(null);

  const workspaceIdFromUrl = searchParams.get('workspace');
  const projectFromUrl = searchParams.get('project');
  const roomFromUrl = searchParams.get('room');
  const panelFromUrl = searchParams.get('panel');
  const datasetFromUrl = searchParams.get('dataset');

  const workspaceId = useMemo(() => {
    if (workspaceIdFromUrl) return workspaceIdFromUrl;
    if (activeWorkspace?.id) return String(activeWorkspace.id);
    if (workspaces.length > 0) return String(workspaces[0].id);
    return '';
  }, [workspaceIdFromUrl, activeWorkspace, workspaces]);

  const isPanelValid = panelFromUrl ? VALID_PANELS.includes(panelFromUrl as StudioPanel) : false;
  const hasCompleteStudioContext = Boolean(workspaceId && projectFromUrl && roomFromUrl && isPanelValid);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    const loadMode = async () => {
      try {
        const response = await studioAPI.getMode(workspaceId);
        const mode = response.data?.mode === 'pro' ? 'pro' : 'simple';
        if (!cancelled) setUxMode(mode);
      } catch {
        if (!cancelled) setUxMode('simple');
      }
    };

    setUxMode(null);
    loadMode();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    if (uxMode === null) return;
    if (hasCompleteStudioContext) return;

    const workspace = workspaces.find((item) => String(item.id) === String(workspaceId));
    if (workspace && (!activeWorkspace || activeWorkspace.id !== workspace.id)) {
      setActiveWorkspace(workspace);
    }

    const runBootstrap = async () => {
      try {
        setBootstrapError(null);
        const preferredPanel = panelFromUrl && VALID_PANELS.includes(panelFromUrl as StudioPanel)
          ? (panelFromUrl as StudioPanel)
          : 'sheets';
        const bootstrapSource: BootstrapSource = source === 'app_root' ? 'login' : 'deep_link';
        const response = await studioAPI.bootstrap(workspaceId, {
          datasetId: datasetFromUrl ? Number(datasetFromUrl) : undefined,
          source: bootstrapSource,
          preferredPanel
        });
        const route = response.data?.route ? applyUxModeToRoute(response.data.route, uxMode) : null;
        if (route) {
          setResolvedRoute(route);
        } else {
          setBootstrapError('Missing bootstrap route.');
        }
      } catch (error: any) {
        setBootstrapError(error?.response?.data?.error || error?.message || 'Failed to initialize Studio.');
      }
    };

    runBootstrap();
  }, [
    source,
    workspaceId,
    uxMode,
    hasCompleteStudioContext,
    panelFromUrl,
    datasetFromUrl,
    workspaces,
    activeWorkspace,
    setActiveWorkspace
  ]);

  useEffect(() => {
    if (!workspaceId || !hasCompleteStudioContext || uxMode === null) return;

    const params = new URLSearchParams(location.search);
    if (!params.get('panel') || !isPanelValid) {
      params.set('panel', isPanelValid ? String(panelFromUrl) : 'sheets');
    }

    const targetBase = uxMode === 'simple' ? '/app/simple' : '/app/studio';
    const targetRoute = `${targetBase}?${params.toString()}`;
    const currentWithQuery = `${location.pathname}${location.search}`;
    if (targetRoute !== currentWithQuery) {
      setResolvedRoute(targetRoute);
    }
  }, [workspaceId, hasCompleteStudioContext, uxMode, location.pathname, location.search, panelFromUrl, isPanelValid]);

  if (!workspaceId && workspaces.length === 0) {
    return <Navigate to="/app/workspaces" replace />;
  }

  if (bootstrapError) {
    return <Navigate to="/app/workspaces" replace state={{ studioError: bootstrapError }} />;
  }

  if (resolvedRoute) {
    const currentWithQuery = `${location.pathname}${location.search}`;
    if (resolvedRoute !== currentWithQuery) {
      return <Navigate to={resolvedRoute} replace />;
    }
  }

  if (!hasCompleteStudioContext) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (uxMode === null) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <AnalyticsStudio />;
};

export default StudioEntryRedirect;
