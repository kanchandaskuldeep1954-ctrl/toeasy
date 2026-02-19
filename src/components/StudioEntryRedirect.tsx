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

const StudioEntryRedirect: React.FC<StudioEntryRedirectProps> = ({ source }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [resolvedRoute, setResolvedRoute] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

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
        const route = response.data?.route;
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
    hasCompleteStudioContext,
    panelFromUrl,
    datasetFromUrl,
    workspaces,
    activeWorkspace,
    setActiveWorkspace
  ]);

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

  return <AnalyticsStudio />;
};

export default StudioEntryRedirect;
