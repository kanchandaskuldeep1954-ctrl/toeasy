import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { useDataset } from '../hooks/useDataset';
import {
  analyticsAPI,
  datasetAPI,
  NextBestStep,
  RoomApproval,
  RoomDecisionCheckpoint,
  RoomGuideStep,
  RoomMentionableUser,
  RoomThread,
  RoomThreadComment,
  StatusDraft,
  studioAPI
} from '../services/api';
import { useSocket } from '../context/SocketContext';
import { DataGridWidget } from './Widgets/DataGridWidget';
import { ChartWidget } from './Widgets/ChartWidget';
import { PivotConfig, PivotWidget } from './Widgets/PivotWidget';
import { ChartSpec } from '../../types';

type StudioPanel = 'sheets' | 'query' | 'pivot' | 'report' | 'actions';
type RunMode = 'sql' | 'nl' | 'sheet_op';

interface StudioProject {
  id: number;
  name: string;
  description?: string;
}

interface StudioRoom {
  id: number;
  project_id: number;
  name: string;
  stage: string;
}

interface StudioArtifact {
  id: number;
  artifact_type: string;
  title: string;
  payload?: any;
  created_at: string;
}

interface MvpKpiSnapshot {
  metrics?: {
    timeToFirstInsightMedianMinutes?: number | null;
    timeFromInsightToActionMedianMinutes?: number | null;
    manualStatusUpdateReductionPct?: number | null;
    evidenceCoverageRatio?: number | null;
    weeklyActiveRooms?: number | null;
  };
  counters?: {
    trackedRooms?: number;
  };
}

const PANELS: StudioPanel[] = ['sheets', 'query', 'pivot', 'report', 'actions'];
const EVIDENCE_ARTIFACT_TYPES = new Set(['dataset_version', 'query_run', 'chart', 'pivot', 'report_block', 'decision_brief']);

const parseDatasetRows = (rawData: any, headers?: string[]) => {
  if (!rawData) return [];
  const parsed = typeof rawData === 'string' ? (() => {
    try {
      return JSON.parse(rawData);
    } catch {
      return [];
    }
  })() : rawData;
  if (!Array.isArray(parsed)) return [];
  if (parsed.length === 0) return [];
  if (Array.isArray(parsed[0])) {
    const sourceHeaders = (headers && headers.length ? headers : parsed[0]) as string[];
    const startIndex = headers && headers.length ? 0 : 1;
    return parsed.slice(startIndex).map((row: any[]) => {
      const mapped: Record<string, any> = {};
      sourceHeaders.forEach((h, idx) => {
        mapped[h] = row[idx];
      });
      return mapped;
    });
  }
  return parsed;
};

const stageOrder = ['ingest', 'profile', 'analyze', 'brief', 'action', 'done'];

const toErrorMessage = (error: any) =>
  error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Request failed';

const AnalyticsStudio: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const { activeDataset, setActiveDataset } = useDataset();

  const workspaceId = searchParams.get('workspace') || String(activeWorkspace?.id || '');
  const datasetId = searchParams.get('dataset') || String((activeDataset as any)?.id || '');
  const panel = (searchParams.get('panel') as StudioPanel) || 'sheets';

  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [rooms, setRooms] = useState<StudioRoom[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get('project') || '');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(searchParams.get('room') || '');
  const [roomStage, setRoomStage] = useState<string>('ingest');

  const [artifacts, setArtifacts] = useState<StudioArtifact[]>([]);
  const [lineage, setLineage] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [guideSteps, setGuideSteps] = useState<RoomGuideStep[]>([]);
  const [nextBestStep, setNextBestStep] = useState<NextBestStep | null>(null);
  const [guideCompletionRatio, setGuideCompletionRatio] = useState<number>(0);

  const [sqlInput, setSqlInput] = useState('SELECT * FROM dataset LIMIT 50');
  const [nlInput, setNlInput] = useState('Show top pipeline trends by owner and stage');
  const [runRows, setRunRows] = useState<any[]>([]);
  const [runInfo, setRunInfo] = useState<{ executionMs?: number; generatedSql?: string; explanation?: string }>({});

  const [sheetField, setSheetField] = useState('');
  const [sheetValue, setSheetValue] = useState('');
  const [sheetOperator, setSheetOperator] = useState<'eq' | 'contains' | 'gt' | 'lt'>('eq');

  const [pivotConfig, setPivotConfig] = useState<PivotConfig>({ rows: [], columns: [], values: [] });
  const [reportText, setReportText] = useState('');

  const [actionTitle, setActionTitle] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [actionOwner, setActionOwner] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<number[]>([]);
  const [statusDraft, setStatusDraft] = useState<StatusDraft | null>(null);
  const [mvpKpis, setMvpKpis] = useState<MvpKpiSnapshot | null>(null);
  const [slackChannel, setSlackChannel] = useState('#revops');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackBotToken, setSlackBotToken] = useState('');
  const [threads, setThreads] = useState<RoomThread[]>([]);
  const [mentionableUsers, setMentionableUsers] = useState<RoomMentionableUser[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [threadComments, setThreadComments] = useState<RoomThreadComment[]>([]);
  const [newThreadArtifactId, setNewThreadArtifactId] = useState<string>('room');
  const [newThreadAnchor, setNewThreadAnchor] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [newThreadComment, setNewThreadComment] = useState('');
  const [pendingApprovals, setPendingApprovals] = useState<RoomApproval[]>([]);
  const [decisionCheckpoints, setDecisionCheckpoints] = useState<RoomDecisionCheckpoint[]>([]);
  const [decisionTitle, setDecisionTitle] = useState('');
  const [decisionRationale, setDecisionRationale] = useState('');
  const [decisionArtifactId, setDecisionArtifactId] = useState<string>('room');
  const [visualType, setVisualType] = useState<string>('bar');
  const [visualXField, setVisualXField] = useState<string>('');
  const [visualYField, setVisualYField] = useState<string>('');
  const { socket, isConnected } = useSocket();

  const datasetRows = useMemo(() => {
    const rows = (activeDataset as any)?.data || (activeDataset as any)?.raw_data || [];
    return parseDatasetRows(rows, (activeDataset as any)?.headers || []);
  }, [activeDataset]);

  const currentRows = runRows.length ? runRows : datasetRows;
  const fields = useMemo(() => {
    if (!currentRows.length) return [];
    const keys = new Set<string>();
    currentRows.slice(0, 20).forEach((row) => Object.keys(row || {}).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [currentRows]);

  const evidenceArtifacts = useMemo(
    () => artifacts.filter((artifact) => EVIDENCE_ARTIFACT_TYPES.has(artifact.artifact_type)),
    [artifacts]
  );

  const actionArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.artifact_type === 'action_item'),
    [artifacts]
  );

  const selectedThread = useMemo(
    () => threads.find((thread) => String(thread.id) === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const mentionHints = useMemo(
    () => mentionableUsers.slice(0, 6).map((user) => user.handle).join(', '),
    [mentionableUsers]
  );

  const numericFields = useMemo(() => {
    if (!currentRows.length) return [];
    return fields.filter((field) =>
      currentRows.slice(0, 60).some((row) => {
        const value = row?.[field];
        if (typeof value === 'number') return Number.isFinite(value);
        if (typeof value === 'string' && value.trim() !== '') return Number.isFinite(Number(value));
        return false;
      })
    );
  }, [currentRows, fields]);

  const visualPreviewData = useMemo(() => {
    const xField = visualXField || fields[0] || '';
    if (!xField) return [];

    const rows = currentRows.slice(0, 1000);
    const aggregateMap = new Map<string, { x: string; value: number; rawCount: number }>();

    rows.forEach((row) => {
      const xValue = String(row?.[xField] ?? '(blank)');
      const numericValue = visualYField
        ? Number(row?.[visualYField] ?? 0)
        : 1;
      const resolvedValue = Number.isFinite(numericValue) ? numericValue : 0;

      const bucket = aggregateMap.get(xValue) || { x: xValue, value: 0, rawCount: 0 };
      bucket.value += resolvedValue;
      bucket.rawCount += 1;
      aggregateMap.set(xValue, bucket);
    });

    return Array.from(aggregateMap.values())
      .map((row) => ({
        [xField]: row.x,
        value: Number(row.value.toFixed(3)),
        count: row.rawCount
      }))
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 30);
  }, [currentRows, fields, visualXField, visualYField]);

  const visualChartSpec = useMemo<ChartSpec>(() => {
    const xField = visualXField || fields[0] || 'label';
    const defaultY = visualYField || 'value';
    return {
      id: `studio-visual-${selectedRoomId || 'preview'}`,
      type: visualType,
      title: `Visual - ${xField}${visualYField ? ` vs ${visualYField}` : ' (count)'}`,
      xAxis: xField,
      yAxis: defaultY,
      data: visualPreviewData
    };
  }, [fields, selectedRoomId, visualPreviewData, visualType, visualXField, visualYField]);

  const refreshRoomState = useCallback(async () => {
    if (!workspaceId || !selectedRoomId) return;
    const [stateResponse, guideResponse] = await Promise.all([
      studioAPI.getRoomState(workspaceId, selectedRoomId),
      studioAPI.getGuide(workspaceId, selectedRoomId)
    ]);

    const roomArtifacts = stateResponse.data?.artifacts || [];
    setArtifacts(roomArtifacts);
    setRoomStage(stateResponse.data?.room?.stage || 'ingest');

    setGuideSteps(guideResponse.data?.steps || []);
    setNextBestStep(guideResponse.data?.nextBestStep || null);
    setGuideCompletionRatio(Number(guideResponse.data?.completionRatio || 0));
  }, [workspaceId, selectedRoomId]);

  const refreshCommunication = useCallback(async () => {
    if (!workspaceId || !selectedRoomId) return;
    const [threadsResponse, approvalsResponse, checkpointsResponse] = await Promise.all([
      studioAPI.listThreads(workspaceId, selectedRoomId),
      studioAPI.listApprovals(workspaceId, selectedRoomId),
      studioAPI.listDecisionCheckpoints(workspaceId, selectedRoomId)
    ]);

    const roomThreads: RoomThread[] = threadsResponse.data?.threads || [];
    setThreads(roomThreads);
    setMentionableUsers(threadsResponse.data?.mentionableUsers || []);
    setPendingApprovals(approvalsResponse.data?.approvals || []);
    setDecisionCheckpoints(checkpointsResponse.data?.checkpoints || []);

    if (!roomThreads.length) {
      setSelectedThreadId('');
      setThreadComments([]);
      return;
    }

    const hasSelectedThread = roomThreads.some((thread) => String(thread.id) === selectedThreadId);
    if (!hasSelectedThread) {
      setSelectedThreadId(String(roomThreads[0].id));
    }
  }, [workspaceId, selectedRoomId, selectedThreadId]);

  const refreshThreadComments = useCallback(async (threadId?: string) => {
    const targetThreadId = threadId || selectedThreadId;
    if (!workspaceId || !selectedRoomId || !targetThreadId) {
      setThreadComments([]);
      return;
    }

    const response = await studioAPI.listThreadComments(workspaceId, selectedRoomId, targetThreadId);
    setThreadComments(response.data?.comments || []);
  }, [workspaceId, selectedRoomId, selectedThreadId]);

  const refreshMvpKpis = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const response = await analyticsAPI.getMvpKpis(workspaceId, 30);
      setMvpKpis(response.data || null);
    } catch (error) {
      console.error('Failed to fetch MVP KPIs:', error);
    }
  }, [workspaceId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (workspaceId && !searchParams.get('workspace')) next.set('workspace', workspaceId);
    if (datasetId && !searchParams.get('dataset')) next.set('dataset', datasetId);
    if (!PANELS.includes(panel)) next.set('panel', 'sheets');
    if (selectedProjectId) next.set('project', selectedProjectId);
    if (selectedRoomId) next.set('room', selectedRoomId);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [workspaceId, datasetId, panel, selectedProjectId, selectedRoomId, searchParams, setSearchParams]);

  useEffect(() => {
    const hydrateDataset = async () => {
      if (!workspaceId || !datasetId) return;
      if (activeDataset && String((activeDataset as any).id) === datasetId) return;
      try {
        const res = await datasetAPI.get(workspaceId, datasetId);
        const data = res.data?.data || res.data;
        const rows = parseDatasetRows(data.raw_data || data.data, data.headers || []);
        setActiveDataset({
          ...data,
          data: rows,
          raw_data: rows,
          headers: data.headers || (rows[0] ? Object.keys(rows[0]) : [])
        });
      } catch (error) {
        console.error('Failed to hydrate dataset for studio:', error);
      }
    };
    hydrateDataset();
  }, [workspaceId, datasetId, activeDataset, setActiveDataset]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!workspaceId) return;
      try {
        const response = await studioAPI.listProjects(workspaceId);
        const list = response.data?.data || [];
        setProjects(list);
        if (!selectedProjectId && list.length) {
          setSelectedProjectId(String(list[0].id));
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    };
    loadProjects();
  }, [workspaceId, selectedProjectId]);

  useEffect(() => {
    const loadRooms = async () => {
      if (!workspaceId || !selectedProjectId) return;
      try {
        const response = await studioAPI.listRooms(workspaceId, selectedProjectId);
        const list = response.data?.data || [];
        setRooms(list);
        if (!selectedRoomId && list.length) {
          setSelectedRoomId(String(list[0].id));
        }
      } catch (error) {
        console.error('Failed to load rooms:', error);
      }
    };
    loadRooms();
  }, [workspaceId, selectedProjectId, selectedRoomId]);

  useEffect(() => {
    refreshRoomState().catch((error) => {
      console.error('Failed to refresh room state:', error);
    });
  }, [refreshRoomState]);

  useEffect(() => {
    refreshCommunication().catch((error) => {
      console.error('Failed to refresh room communication:', error);
    });
  }, [refreshCommunication]);

  useEffect(() => {
    if (!socket || !isConnected || !workspaceId || !selectedRoomId) return;
    const workspaceNumeric = Number(workspaceId);
    const roomNumeric = Number(selectedRoomId);
    if (!Number.isFinite(workspaceNumeric) || !Number.isFinite(roomNumeric)) return;

    const handleRoomEvent = (payload: any) => {
      const eventRoomId = Number(payload?.roomId || payload?.thread?.roomId || payload?.checkpoint?.roomId || 0);
      if (eventRoomId && eventRoomId !== roomNumeric) return;
      refreshCommunication().catch((error) => {
        console.error('Realtime communication refresh failed:', error);
      });

      const eventThreadId = payload?.threadId ? String(payload.threadId) : payload?.comment?.threadId ? String(payload.comment.threadId) : '';
      if (eventThreadId && eventThreadId === selectedThreadId) {
        refreshThreadComments(eventThreadId).catch((error) => {
          console.error('Realtime thread refresh failed:', error);
        });
      }
    };

    socket.emit('join-workspace', workspaceNumeric);
    socket.emit('join-decision-room', { workspaceId: workspaceNumeric, roomId: roomNumeric });

    socket.on('decision-room:thread-created', handleRoomEvent);
    socket.on('decision-room:comment-added', handleRoomEvent);
    socket.on('decision-room:approval-created', handleRoomEvent);
    socket.on('decision-room:approval-updated', handleRoomEvent);
    socket.on('decision-room:checkpoint-created', handleRoomEvent);
    socket.on('decision-room:checkpoint-updated', handleRoomEvent);

    return () => {
      socket.emit('leave-decision-room', { workspaceId: workspaceNumeric, roomId: roomNumeric });
      socket.off('decision-room:thread-created', handleRoomEvent);
      socket.off('decision-room:comment-added', handleRoomEvent);
      socket.off('decision-room:approval-created', handleRoomEvent);
      socket.off('decision-room:approval-updated', handleRoomEvent);
      socket.off('decision-room:checkpoint-created', handleRoomEvent);
      socket.off('decision-room:checkpoint-updated', handleRoomEvent);
    };
  }, [socket, isConnected, workspaceId, selectedRoomId, selectedThreadId, refreshCommunication, refreshThreadComments]);

  useEffect(() => {
    refreshMvpKpis().catch((error) => {
      console.error('Failed to refresh MVP KPI snapshot:', error);
    });
  }, [refreshMvpKpis, selectedRoomId]);

  useEffect(() => {
    refreshThreadComments().catch((error) => {
      console.error('Failed to load thread comments:', error);
    });
  }, [refreshThreadComments]);

  useEffect(() => {
    setSelectedEvidenceIds([]);
    setStatusDraft(null);
    setLineage(null);
    setRunRows([]);
    setRunInfo({});
    setThreads([]);
    setMentionableUsers([]);
    setSelectedThreadId('');
    setThreadComments([]);
    setNewThreadContent('');
    setNewThreadComment('');
    setPendingApprovals([]);
    setDecisionCheckpoints([]);
    setDecisionTitle('');
    setDecisionRationale('');
    setDecisionArtifactId('room');
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId) return;
    if (selectedEvidenceIds.length > 0) return;
    const defaults = evidenceArtifacts.slice(0, 3).map((artifact) => artifact.id);
    setSelectedEvidenceIds(defaults);
  }, [selectedRoomId, evidenceArtifacts, selectedEvidenceIds.length]);

  useEffect(() => {
    if (!fields.length) return;
    if (!visualXField) {
      setVisualXField(fields[0]);
    }
  }, [fields, visualXField]);

  useEffect(() => {
    if (!numericFields.length) return;
    if (!visualYField || !numericFields.includes(visualYField)) {
      setVisualYField(numericFields[0]);
    }
  }, [numericFields, visualYField]);

  const setPanel = (nextPanel: StudioPanel) => {
    const next = new URLSearchParams(searchParams);
    next.set('panel', nextPanel);
    if (selectedProjectId) next.set('project', selectedProjectId);
    if (selectedRoomId) next.set('room', selectedRoomId);
    setSearchParams(next);
  };

  const createProject = async () => {
    if (!workspaceId) return;
    const name = window.prompt('Project name');
    if (!name) return;
    const result = await studioAPI.createProject(workspaceId, { name, objective: 'Weekly RevOps decision cycle' });
    const created = result.data?.data;
    setProjects((prev) => [created, ...prev]);
    setSelectedProjectId(String(created.id));
    setStatusMessage(`Project "${created.name}" created.`);
  };

  const createRoom = async () => {
    if (!workspaceId || !selectedProjectId) return;
    const name = window.prompt('Decision Room name');
    if (!name) return;
    const result = await studioAPI.createRoom(workspaceId, selectedProjectId, {
      name,
      stage: 'ingest',
      runContext: { datasetId: datasetId ? Number(datasetId) : null }
    });
    const created = result.data?.data;
    setRooms((prev) => [created, ...prev]);
    setSelectedRoomId(String(created.id));
    setStatusMessage(`Room "${created.name}" created.`);
  };

  const runExecution = async (mode: RunMode, payload: any) => {
    if (!workspaceId || !selectedRoomId) return;
    setLoading(true);
    try {
      const result = await studioAPI.run(workspaceId, selectedRoomId, {
        mode,
        payload: {
          datasetId: datasetId ? Number(datasetId) : undefined,
          ...payload
        },
        persistPolicy: 'persist'
      });
      setRunRows(result.data?.rows || []);
      setRunInfo({
        executionMs: result.data?.executionMs,
        generatedSql: result.data?.generatedSql,
        explanation: result.data?.explanation
      });
      setStatusMessage(`Run completed in ${result.data?.executionMs || 0}ms.`);
      await refreshRoomState();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const savePivotArtifact = async () => {
    if (!workspaceId || !selectedRoomId) return;
    await studioAPI.createArtifact(workspaceId, selectedRoomId, {
      artifactType: 'pivot',
      title: `Pivot - ${pivotConfig.rows.join(', ') || 'summary'}`,
      payload: {
        config: pivotConfig,
        previewRows: currentRows.slice(0, 200)
      },
      parentArtifactIds: evidenceArtifacts.slice(0, 3).map((artifact) => artifact.id)
    });
    await refreshRoomState();
    setStatusMessage('Pivot artifact saved with lineage.');
  };

  const saveVisualArtifact = async () => {
    if (!workspaceId || !selectedRoomId) return;
    if (!visualPreviewData.length) {
      setStatusMessage('Run analysis or adjust chart fields to generate visual data.');
      return;
    }

    await studioAPI.createArtifact(workspaceId, selectedRoomId, {
      artifactType: 'chart',
      title: visualChartSpec.title,
      payload: {
        chart: visualChartSpec,
        previewRows: visualPreviewData
      },
      parentArtifactIds: evidenceArtifacts.slice(0, 5).map((artifact) => artifact.id)
    });
    await refreshRoomState();
    setStatusMessage('Chart artifact saved with lineage.');
  };

  const generateBrief = async () => {
    if (!workspaceId || !selectedRoomId) return;
    const result = await studioAPI.generateBrief(workspaceId, selectedRoomId, {
      title: `Decision Brief - ${new Date().toLocaleDateString()}`,
      objective: 'Weekly RevOps decision cycle and action alignment'
    });
    setReportText(result.data?.brief || '');
    await refreshRoomState();
    setStatusMessage('Decision brief generated.');
  };

  const saveReportBlock = async () => {
    if (!workspaceId || !selectedRoomId || !reportText.trim()) return;
    await studioAPI.createArtifact(workspaceId, selectedRoomId, {
      artifactType: 'report_block',
      title: 'Report Block',
      payload: { markdown: reportText },
      parentArtifactIds: evidenceArtifacts.slice(0, 5).map((artifact) => artifact.id)
    });
    await refreshRoomState();
    setStatusMessage('Report block saved.');
  };

  const createAction = async () => {
    if (!workspaceId || !selectedRoomId || !actionTitle.trim()) return;
    if (!selectedEvidenceIds.length) {
      setStatusMessage('Select at least one evidence artifact before creating an action item.');
      return;
    }

    await studioAPI.createArtifact(workspaceId, selectedRoomId, {
      artifactType: 'action_item',
      title: actionTitle,
      description: actionDescription,
      payload: {
        description: actionDescription,
        owner: actionOwner || 'Unassigned',
        dueDate: actionDueDate || null,
        status: 'todo',
        priority: 'medium'
      },
      parentArtifactIds: selectedEvidenceIds
    });
    setActionTitle('');
    setActionDescription('');
    setActionOwner('');
    setActionDueDate('');
    await refreshRoomState();
    setStatusMessage('Action item created with evidence links.');
  };

  const syncActions = async () => {
    if (!workspaceId || !selectedRoomId) return;
    try {
      const response = await studioAPI.syncActions(workspaceId, selectedRoomId, {
        channel: 'slack',
        createTasks: true
      });
      setStatusMessage(response.data?.message || 'Actions synced.');
      await refreshRoomState();
      await refreshMvpKpis();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const generateStatusDraft = async () => {
    if (!workspaceId || !selectedRoomId) return;
    try {
      const response = await studioAPI.generateStatusDraft(workspaceId, selectedRoomId, { persist: true });
      setStatusDraft(response.data?.draft || null);
      setStatusMessage('Status draft generated from room execution logs.');
      await refreshRoomState();
      await refreshMvpKpis();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const createThread = async () => {
    if (!workspaceId || !selectedRoomId) return;
    if (!newThreadContent.trim()) {
      setStatusMessage('Add a message to start a communication thread.');
      return;
    }

    try {
      const response = await studioAPI.createThread(workspaceId, selectedRoomId, {
        artifactId: newThreadArtifactId === 'room' ? null : Number(newThreadArtifactId),
        anchor: newThreadAnchor.trim() ? { label: newThreadAnchor.trim() } : {},
        content: newThreadContent.trim()
      });
      const createdThreadId = response.data?.thread?.id;
      setNewThreadContent('');
      setNewThreadAnchor('');
      await refreshCommunication();
      if (createdThreadId) {
        setSelectedThreadId(String(createdThreadId));
      }
      setStatusMessage('Thread created.');
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const addCommentToThread = async () => {
    if (!workspaceId || !selectedRoomId || !selectedThreadId) return;
    if (!newThreadComment.trim()) return;

    try {
      await studioAPI.addThreadComment(workspaceId, selectedRoomId, selectedThreadId, {
        content: newThreadComment.trim()
      });
      setNewThreadComment('');
      await refreshThreadComments(selectedThreadId);
      await refreshCommunication();
      setStatusMessage('Comment posted.');
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const respondApproval = async (approvalId: number, decision: 'approved' | 'rejected') => {
    if (!workspaceId) return;
    try {
      await studioAPI.respondApproval(workspaceId, approvalId, { decision });
      await refreshCommunication();
      await refreshRoomState();
      setStatusMessage(`Approval ${decision}.`);
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const createDecisionCheckpoint = async () => {
    if (!workspaceId || !selectedRoomId) return;
    if (!decisionTitle.trim()) {
      setStatusMessage('Decision title is required.');
      return;
    }

    try {
      await studioAPI.createDecisionCheckpoint(workspaceId, selectedRoomId, {
        decision: decisionTitle.trim(),
        rationale: decisionRationale.trim() || undefined,
        artifactId: decisionArtifactId === 'room' ? null : Number(decisionArtifactId)
      });
      setDecisionTitle('');
      setDecisionRationale('');
      setDecisionArtifactId('room');
      await refreshCommunication();
      setStatusMessage('Decision checkpoint created.');
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const respondDecisionCheckpoint = async (checkpointId: number, decision: 'approved' | 'rejected') => {
    if (!workspaceId || !selectedRoomId) return;
    try {
      await studioAPI.respondDecisionCheckpoint(workspaceId, selectedRoomId, checkpointId, { decision });
      await refreshCommunication();
      setStatusMessage(`Decision checkpoint ${decision}.`);
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const completeGuideStep = async (stepId: string) => {
    if (!workspaceId || !selectedRoomId) return;
    try {
      const response = await studioAPI.completeGuideStep(workspaceId, selectedRoomId, stepId);
      setGuideSteps(response.data?.steps || []);
      setNextBestStep(response.data?.nextBestStep || null);
      setGuideCompletionRatio(Number(response.data?.completionRatio || 0));
      setRoomStage(response.data?.roomStage || roomStage);
      setStatusMessage(`Step "${stepId}" marked complete.`);
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const openLineage = async (artifactId: number) => {
    if (!workspaceId || !selectedRoomId) return;
    const response = await studioAPI.getLineage(workspaceId, selectedRoomId, artifactId);
    setLineage(response.data);
  };

  const toggleEvidenceSelection = (artifactId: number) => {
    setSelectedEvidenceIds((prev) =>
      prev.includes(artifactId) ? prev.filter((id) => id !== artifactId) : [...prev, artifactId]
    );
  };

  const roomStageProgress = stageOrder.indexOf(roomStage) + 1;

  if (!workspaceId || !datasetId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
        Select a workspace and dataset to start Decision Room.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase text-slate-500">Decision Room Studio</span>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          <option value="">Select Project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <button onClick={createProject} className="px-2 py-1 text-xs rounded bg-blue-600 text-white">+ Project</button>
        <select
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          <option value="">Select Room</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
        <button
          onClick={createRoom}
          disabled={!selectedProjectId}
          className="px-2 py-1 text-xs rounded bg-indigo-600 text-white disabled:opacity-50"
        >
          + Room
        </button>
        <span className="text-[11px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          Stage {roomStageProgress}/{stageOrder.length}: {roomStage}
        </span>
        <span className="ml-auto text-xs text-slate-500">{statusMessage}</span>
      </div>

      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 overflow-x-auto">
        {PANELS.map((tab) => (
          <button
            key={tab}
            onClick={() => setPanel(tab)}
            className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-colors ${
              panel === tab
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase text-slate-500">Guided Flow</h3>
          <span className="text-xs text-slate-500">{Math.round(guideCompletionRatio * 100)}% complete</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {guideSteps.map((step) => (
            <button
              key={step.id}
              onClick={() => !step.completed && step.blockingIssues.length === 0 && completeGuideStep(step.id)}
              className={`text-left p-2 rounded border ${
                step.completed
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : step.blockingIssues.length > 0
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <div className="text-[11px] font-semibold">{step.label}</div>
              <div className="text-[10px] uppercase mt-1">{step.stage}</div>
            </button>
          ))}
        </div>
        {nextBestStep && (
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Next best step:</span> {nextBestStep.reason}
            {nextBestStep.blockingIssues.length > 0 && (
              <div className="mt-1 text-[11px] text-amber-700">
                Blockers: {nextBestStep.blockingIssues.join(' | ')}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_320px]">
        <div className="min-h-0 p-4 overflow-auto">
          {panel === 'sheets' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <select value={sheetField} onChange={(e) => setSheetField(e.target.value)} className="px-2 py-1 text-xs rounded border">
                  <option value="">Field</option>
                  {fields.map((field) => <option key={field} value={field}>{field}</option>)}
                </select>
                <select value={sheetOperator} onChange={(e) => setSheetOperator(e.target.value as any)} className="px-2 py-1 text-xs rounded border">
                  <option value="eq">equals</option>
                  <option value="contains">contains</option>
                  <option value="gt">greater than</option>
                  <option value="lt">less than</option>
                </select>
                <input value={sheetValue} onChange={(e) => setSheetValue(e.target.value)} placeholder="Value" className="px-2 py-1 text-xs rounded border" />
                <button
                  disabled={!selectedRoomId || !sheetField || loading}
                  onClick={() => runExecution('sheet_op', { operation: 'filter', field: sheetField, operator: sheetOperator, value: sheetValue })}
                  className="px-3 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50"
                >
                  Apply Filter
                </button>
              </div>
              <DataGridWidget data={currentRows} height={520} title={`Rows (${currentRows.length})`} />
            </div>
          )}

          {panel === 'query' && (
            <div className="space-y-3">
              <textarea value={sqlInput} onChange={(e) => setSqlInput(e.target.value)} className="w-full h-28 p-3 text-sm rounded border font-mono" />
              <button disabled={!selectedRoomId || loading} onClick={() => runExecution('sql', { sql: sqlInput })} className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-50">
                Run SQL
              </button>
              <textarea value={nlInput} onChange={(e) => setNlInput(e.target.value)} className="w-full h-20 p-3 text-sm rounded border" />
              <button disabled={!selectedRoomId || loading} onClick={() => runExecution('nl', { prompt: nlInput })} className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white disabled:opacity-50">
                Run NL Query
              </button>
              <DataGridWidget data={currentRows} height={400} title={`Run Results (${currentRows.length})`} />
            </div>
          )}

          {panel === 'pivot' && (
            <div className="space-y-3">
              <PivotWidget
                data={currentRows}
                fields={fields}
                config={pivotConfig}
                onConfigChange={setPivotConfig}
                height={520}
              />
              <div className="flex items-center gap-2">
                <button onClick={savePivotArtifact} disabled={!selectedRoomId} className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white disabled:opacity-50">
                  Save Pivot Artifact
                </button>
                <span className="text-xs text-slate-500">
                  Pivot groups data for fast summaries. Chart Builder turns those summaries into visuals.
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-500">Visual Builder (Tableau-style preview)</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={visualType}
                    onChange={(e) => setVisualType(e.target.value)}
                    className="px-2 py-1 text-xs rounded border"
                  >
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="area">Area</option>
                    <option value="pie">Pie</option>
                    <option value="donut">Donut</option>
                  </select>
                  <select
                    value={visualXField}
                    onChange={(e) => setVisualXField(e.target.value)}
                    className="px-2 py-1 text-xs rounded border"
                  >
                    <option value="">X field</option>
                    {fields.map((field) => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                  <select
                    value={visualYField}
                    onChange={(e) => setVisualYField(e.target.value)}
                    className="px-2 py-1 text-xs rounded border"
                  >
                    <option value="">Count rows</option>
                    {numericFields.map((field) => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                  <button onClick={saveVisualArtifact} disabled={!selectedRoomId || !visualPreviewData.length} className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white disabled:opacity-50">
                    Save Chart Artifact
                  </button>
                </div>
                <ChartWidget chart={visualChartSpec} data={visualPreviewData} height={320} />
              </div>
            </div>
          )}

          {panel === 'report' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={generateBrief} disabled={!selectedRoomId} className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white disabled:opacity-50">
                  Generate Decision Brief
                </button>
                <button onClick={saveReportBlock} disabled={!selectedRoomId || !reportText.trim()} className="px-3 py-1.5 text-xs rounded bg-slate-800 text-white disabled:opacity-50">
                  Save Report Block
                </button>
              </div>
              <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} className="w-full h-[520px] p-3 text-sm rounded border font-mono" />
            </div>
          )}

          {panel === 'actions' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Evidence Selection</h3>
                <div className="flex flex-wrap gap-2">
                  {evidenceArtifacts.slice(0, 12).map((artifact) => (
                    <label key={artifact.id} className="text-[11px] px-2 py-1 rounded border flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedEvidenceIds.includes(artifact.id)}
                        onChange={() => toggleEvidenceSelection(artifact.id)}
                      />
                      <span>{artifact.title}</span>
                      <span className="text-slate-400">({artifact.artifact_type})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} placeholder="Action title" className="px-2 py-1 text-xs rounded border w-48" />
                <input value={actionOwner} onChange={(e) => setActionOwner(e.target.value)} placeholder="Owner" className="px-2 py-1 text-xs rounded border w-36" />
                <input value={actionDueDate} onChange={(e) => setActionDueDate(e.target.value)} type="date" className="px-2 py-1 text-xs rounded border" />
                <input value={actionDescription} onChange={(e) => setActionDescription(e.target.value)} placeholder="Action description" className="px-2 py-1 text-xs rounded border w-64" />
                <button onClick={createAction} disabled={!selectedRoomId || !actionTitle.trim()} className="px-3 py-1 text-xs rounded bg-emerald-600 text-white disabled:opacity-50">
                  Add Action
                </button>
                <button onClick={syncActions} disabled={!selectedRoomId} className="px-3 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50">
                  Sync Actions
                </button>
                <button onClick={generateStatusDraft} disabled={!selectedRoomId} className="px-3 py-1 text-xs rounded bg-violet-600 text-white disabled:opacity-50">
                  Generate Status Draft
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={slackChannel}
                  onChange={(e) => setSlackChannel(e.target.value)}
                  placeholder="#revops"
                  className="px-2 py-1 text-xs rounded border w-28"
                />
                <input
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  placeholder="Slack Webhook URL"
                  className="px-2 py-1 text-xs rounded border w-64"
                />
                <input
                  value={slackBotToken}
                  onChange={(e) => setSlackBotToken(e.target.value)}
                  placeholder="xoxb-... (optional if webhook set)"
                  className="px-2 py-1 text-xs rounded border w-56"
                />
                <button
                  onClick={async () => {
                    try {
                      await studioAPI.connectSlack(workspaceId, {
                        name: 'Slack Workspace',
                        credentials: {
                          channel: slackChannel || '#revops',
                          webhookUrl: slackWebhookUrl || undefined,
                          botToken: slackBotToken || undefined
                        }
                      });
                      setStatusMessage('Slack integration saved.');
                    } catch (error: any) {
                      setStatusMessage(toErrorMessage(error));
                    }
                  }}
                  className="px-3 py-1 text-xs rounded border"
                >
                  Connect Slack
                </button>
                <button onClick={() => studioAPI.connectSheets(workspaceId, { name: 'Google Sheets', credentials: { mode: 'oauth' } })} className="px-3 py-1 text-xs rounded border">
                  Connect Sheets
                </button>
                <button onClick={() => studioAPI.connectSQL(workspaceId, { provider: 'postgres', name: 'Postgres', credentials: { host: 'localhost' } })} className="px-3 py-1 text-xs rounded border">
                  Connect SQL
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Owner Accountability Board</h3>
                <div className="space-y-2">
                  {actionArtifacts.map((artifact) => (
                    <div key={artifact.id} className="text-xs rounded border border-slate-200 dark:border-slate-700 px-2 py-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-semibold">{artifact.title}</span>
                        <span className="text-[10px] text-slate-500">
                          Owner: {artifact.payload?.owner || 'Unassigned'} | Due: {artifact.payload?.dueDate || 'n/a'} | Status: {artifact.payload?.status || 'todo'}
                        </span>
                      </div>
                      <button onClick={() => openLineage(artifact.id)} className="text-blue-600">Lineage</button>
                    </div>
                  ))}
                </div>
              </div>

              {statusDraft && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                  <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Latest Status Draft</h3>
                  <p className="text-xs text-slate-700 dark:text-slate-200">{statusDraft.summary}</p>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Evidence IDs: {statusDraft.evidenceArtifactIds.join(', ') || 'none'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 overflow-auto">
          <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Run Context</h3>
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div>Rows: {currentRows.length}</div>
            <div>Fields: {fields.length}</div>
            <div>Execution: {runInfo.executionMs || 0}ms</div>
            {runInfo.generatedSql && <pre className="text-[10px] whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded p-2">{runInfo.generatedSql}</pre>}
            {runInfo.explanation && <p className="text-[10px]">{runInfo.explanation}</p>}
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">MVP KPI Snapshot</h3>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
            <div>Tracked Rooms: {mvpKpis?.counters?.trackedRooms ?? 0}</div>
            <div>Median Time to Insight: {mvpKpis?.metrics?.timeToFirstInsightMedianMinutes != null ? `${mvpKpis.metrics.timeToFirstInsightMedianMinutes.toFixed(1)} min` : 'n/a'}</div>
            <div>Median Insight to Action: {mvpKpis?.metrics?.timeFromInsightToActionMedianMinutes != null ? `${mvpKpis.metrics.timeFromInsightToActionMedianMinutes.toFixed(1)} min` : 'n/a'}</div>
            <div>Evidence Coverage: {mvpKpis?.metrics?.evidenceCoverageRatio != null ? `${(mvpKpis.metrics.evidenceCoverageRatio * 100).toFixed(0)}%` : 'n/a'}</div>
            <div>Status Automation: {mvpKpis?.metrics?.manualStatusUpdateReductionPct != null ? `${mvpKpis.metrics.manualStatusUpdateReductionPct.toFixed(0)}%` : 'n/a'}</div>
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Checklist</h3>
          <div className="space-y-2">
            {guideSteps.map((step) => (
              <div key={step.id} className="text-xs border rounded p-2">
                <div className="font-semibold">{step.label}</div>
                <div className="text-[10px] text-slate-500">
                  {step.completed ? 'Completed' : `Pending (${step.stage})`}
                </div>
                {!step.completed && step.blockingIssues.length > 0 && (
                  <div className="text-[10px] text-amber-600 mt-1">{step.blockingIssues[0]}</div>
                )}
              </div>
            ))}
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Communication</h3>
          <div className="space-y-2 rounded border border-slate-200 dark:border-slate-700 p-2">
            <select
              value={newThreadArtifactId}
              onChange={(e) => setNewThreadArtifactId(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded border"
            >
              <option value="room">Room-level thread</option>
              {artifacts.slice(0, 40).map((artifact) => (
                <option key={artifact.id} value={artifact.id}>
                  {artifact.title} ({artifact.artifact_type})
                </option>
              ))}
            </select>
            <input
              value={newThreadAnchor}
              onChange={(e) => setNewThreadAnchor(e.target.value)}
              placeholder="Anchor (row/metric optional)"
              className="w-full px-2 py-1 text-xs rounded border"
            />
            <textarea
              value={newThreadContent}
              onChange={(e) => setNewThreadContent(e.target.value)}
              placeholder="Start a thread. Mention teammates with @handle."
              className="w-full h-16 px-2 py-1 text-xs rounded border"
            />
            <button onClick={createThread} disabled={!selectedRoomId || !newThreadContent.trim()} className="w-full px-2 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50">
              Start Thread
            </button>
            <div className="text-[10px] text-slate-500">
              Mentions: {mentionHints || 'No workspace members detected.'}
            </div>
          </div>

          <div className="space-y-2 mt-2">
            {threads.length === 0 && (
              <div className="text-[11px] text-slate-500 border rounded p-2">
                No threads yet.
              </div>
            )}
            {threads.slice(0, 12).map((thread) => (
              <button
                key={thread.id}
                onClick={() => setSelectedThreadId(String(thread.id))}
                className={`w-full text-left text-xs border rounded p-2 ${
                  String(thread.id) === selectedThreadId
                    ? 'border-blue-300 bg-blue-50 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="font-semibold truncate">{thread.artifactTitle || 'Room discussion'}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {thread.lastCommentContent || 'No messages yet'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {thread.commentCount} comment(s)
                </div>
              </button>
            ))}
          </div>

          {selectedThread && (
            <div className="mt-2 rounded border border-slate-200 dark:border-slate-700 p-2 space-y-2">
              <div className="text-xs font-semibold">
                Thread #{selectedThread.id} {selectedThread.artifactTitle ? `- ${selectedThread.artifactTitle}` : '- Room'}
              </div>
              <div className="max-h-48 overflow-auto space-y-2">
                {threadComments.map((comment) => (
                  <div key={comment.id} className="text-xs border rounded p-2">
                    <div className="text-[10px] text-slate-500">{comment.authorName}</div>
                    <div className="mt-1 whitespace-pre-wrap break-words">{comment.content}</div>
                  </div>
                ))}
                {threadComments.length === 0 && (
                  <div className="text-[11px] text-slate-500">No comments in this thread yet.</div>
                )}
              </div>
              <textarea
                value={newThreadComment}
                onChange={(e) => setNewThreadComment(e.target.value)}
                placeholder="Reply to thread..."
                className="w-full h-14 px-2 py-1 text-xs rounded border"
              />
              <button
                onClick={addCommentToThread}
                disabled={!newThreadComment.trim()}
                className="w-full px-2 py-1 text-xs rounded bg-slate-800 text-white disabled:opacity-50"
              >
                Send Reply
              </button>
            </div>
          )}

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Approval Inbox</h3>
          <div className="space-y-2">
            {pendingApprovals.length === 0 && (
              <div className="text-[11px] text-slate-500 border rounded p-2">
                No pending approvals.
              </div>
            )}
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="text-xs border rounded p-2 space-y-2">
                <div className="font-semibold">
                  {approval.policyName || 'Automation'} ({approval.riskLevel})
                </div>
                <div className="text-[11px] text-slate-500">
                  Requested by {approval.requestedByName}
                </div>
                {approval.reason && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">{approval.reason}</div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => respondApproval(approval.id, 'approved')}
                    className="px-2 py-1 text-[11px] rounded bg-emerald-600 text-white"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => respondApproval(approval.id, 'rejected')}
                    className="px-2 py-1 text-[11px] rounded bg-rose-600 text-white"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Decision Checkpoints</h3>
          <div className="space-y-2 rounded border border-slate-200 dark:border-slate-700 p-2">
            <input
              value={decisionTitle}
              onChange={(e) => setDecisionTitle(e.target.value)}
              placeholder="Decision checkpoint title"
              className="w-full px-2 py-1 text-xs rounded border"
            />
            <textarea
              value={decisionRationale}
              onChange={(e) => setDecisionRationale(e.target.value)}
              placeholder="Rationale and decision context"
              className="w-full h-16 px-2 py-1 text-xs rounded border"
            />
            <select
              value={decisionArtifactId}
              onChange={(e) => setDecisionArtifactId(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded border"
            >
              <option value="room">Room-level checkpoint</option>
              {artifacts.slice(0, 40).map((artifact) => (
                <option key={artifact.id} value={artifact.id}>
                  {artifact.title} ({artifact.artifact_type})
                </option>
              ))}
            </select>
            <button
              onClick={createDecisionCheckpoint}
              disabled={!decisionTitle.trim()}
              className="w-full px-2 py-1 text-xs rounded bg-indigo-600 text-white disabled:opacity-50"
            >
              Create Checkpoint
            </button>
          </div>

          <div className="space-y-2 mt-2">
            {decisionCheckpoints.length === 0 && (
              <div className="text-[11px] text-slate-500 border rounded p-2">
                No checkpoints yet.
              </div>
            )}
            {decisionCheckpoints.slice(0, 12).map((checkpoint) => (
              <div key={checkpoint.id} className="text-xs border rounded p-2 space-y-2">
                <div className="font-semibold">{checkpoint.decision}</div>
                <div className="text-[10px] text-slate-500">
                  Status: {checkpoint.status} | Owner: {checkpoint.createdByName}
                </div>
                {checkpoint.artifactTitle && (
                  <div className="text-[10px] text-slate-500">
                    Evidence: {checkpoint.artifactTitle}
                  </div>
                )}
                {checkpoint.rationale && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                    {checkpoint.rationale}
                  </div>
                )}
                {checkpoint.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => respondDecisionCheckpoint(checkpoint.id, 'approved')}
                      className="px-2 py-1 text-[11px] rounded bg-emerald-600 text-white"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => respondDecisionCheckpoint(checkpoint.id, 'rejected')}
                      className="px-2 py-1 text-[11px] rounded bg-rose-600 text-white"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Artifacts</h3>
          <div className="space-y-2">
            {artifacts.slice(0, 20).map((artifact) => (
              <div key={artifact.id} className="text-xs border rounded p-2">
                <div className="font-semibold">{artifact.title}</div>
                <div className="text-[10px] text-slate-500">{artifact.artifact_type}</div>
                <button onClick={() => openLineage(artifact.id)} className="mt-1 text-[10px] text-blue-600">View Lineage</button>
              </div>
            ))}
          </div>

          {lineage && (
            <>
              <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Lineage Detail</h3>
              <div className="text-[10px] bg-slate-50 dark:bg-slate-800 rounded p-2 whitespace-pre-wrap">
                {JSON.stringify({
                  artifact: lineage.artifact?.title,
                  edgeCount: lineage.edges?.length || 0
                }, null, 2)}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default AnalyticsStudio;
