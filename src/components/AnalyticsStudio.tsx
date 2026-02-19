import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { useDataset } from '../hooks/useDataset';
import {
  AutomationQueueState,
  AutomationRunDetail,
  AutomationRunEvent,
  AutomationSchedule,
  analyticsAPI,
  CoverageTrendPoint,
  datasetAPI,
  DatasetProfileArtifact,
  MetricCatalogItem,
  NextBestStep,
  OnboardingPlaybookStep,
  OutcomeAttribution,
  PersonaProfile,
  ReportV2Bundle,
  ReportV2Quality,
  ReviewSubmission,
  RoomApproval,
  RoomDecisionCheckpoint,
  RoomGuideStep,
  RoomMentionableUser,
  RoomRoiSnapshot,
  RoomRoiTargetStatus,
  RoomThread,
  RoomThreadComment,
  StatusDraft,
  VisualAnnotation,
  studioAPI
} from '../services/api';
import { useSocket } from '../context/SocketContext';
import { DataGridWidget } from './Widgets/DataGridWidget';
import { ChartWidget } from './Widgets/ChartWidget';
import { PivotConfig, PivotWidget } from './Widgets/PivotWidget';
import { ChartSpec } from '../../types';

type StudioPanel = 'sheets' | 'query' | 'pivot' | 'visuals' | 'report' | 'actions' | 'comms';
type RunMode = 'sql' | 'nl' | 'sheet_op';
type MentionPresetKey = 'manager' | 'exec' | 'owner_group';
type StudioFeatureFlags = {
  legacySurfacesEnabled: boolean;
  visualsTabEnabled: boolean;
  commsTabEnabled: boolean;
};

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

interface PlaybookRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  action: string;
  blockers: string[];
}

const PANELS: StudioPanel[] = ['sheets', 'query', 'pivot', 'visuals', 'report', 'actions', 'comms'];
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
const reviewStageOptions = [
  { value: 'manager_review', label: 'Manager review' },
  { value: 'executive_notify', label: 'Executive notify' },
  { value: 'final_signoff', label: 'Final signoff' }
] as const;
const managerRolePattern = /(manager|lead|admin|owner)/i;
const executiveRolePattern = /(exec|executive|director|vp|chief|ceo|coo|cfo|cro|founder)/i;
const reportSectionMeaning: Record<string, string> = {
  kpi_delta: 'Shows period-over-period KPI movement grounded in linked evidence artifacts.',
  trend: 'Visual trend coverage across the selected weekly window.',
  pattern: 'Detected risks and shifts (owner concentration, bottlenecks, volatility, segment movement).',
  explanation: 'Deterministic explanation of what changed and why it matters for RevOps decisions.',
  recommendation: 'Next actions tied to evidence so owners can execute in Slack and action boards.'
};

type RevOpsVisualTemplate = {
  key: string;
  label: string;
  description: string;
  chartType: string;
  xSynonyms: string[];
  ySynonyms: string[];
  defaultPivotRows: string[];
  defaultPivotValues: Array<{ fieldSynonyms: string[]; agg: 'sum' | 'count' | 'avg' | 'min' | 'max' }>;
};

const REVOPS_VISUAL_TEMPLATES: RevOpsVisualTemplate[] = [
  {
    key: 'pipeline_by_owner',
    label: 'Pipeline by owner',
    description: 'See pipeline concentration by owner and identify load imbalance.',
    chartType: 'bar',
    xSynonyms: ['owner', 'sales_rep', 'account_executive', 'rep'],
    ySynonyms: ['amount', 'pipeline_amount', 'revenue', 'deal_value', 'value'],
    defaultPivotRows: ['owner'],
    defaultPivotValues: [{ fieldSynonyms: ['amount', 'pipeline_amount', 'revenue', 'value'], agg: 'sum' }]
  },
  {
    key: 'stage_conversion',
    label: 'Stage conversion',
    description: 'Track deal flow across stages and spot bottlenecks.',
    chartType: 'bar',
    xSynonyms: ['stage', 'status', 'deal_stage', 'pipeline_stage'],
    ySynonyms: ['amount', 'value', 'revenue'],
    defaultPivotRows: ['stage'],
    defaultPivotValues: [
      { fieldSynonyms: ['amount', 'value', 'revenue'], agg: 'sum' },
      { fieldSynonyms: ['stage', 'status'], agg: 'count' }
    ]
  },
  {
    key: 'weekly_pipeline_trend',
    label: 'Weekly trend',
    description: 'Review weekly movement for created pipeline and outcomes.',
    chartType: 'line',
    xSynonyms: ['date', 'created_at', 'created_date', 'close_date'],
    ySynonyms: ['amount', 'pipeline_amount', 'revenue', 'value'],
    defaultPivotRows: ['date'],
    defaultPivotValues: [{ fieldSynonyms: ['amount', 'pipeline_amount', 'revenue', 'value'], agg: 'sum' }]
  },
  {
    key: 'segment_mix_shift',
    label: 'Segment mix shift',
    description: 'Detect segment/channel shifts affecting conversion and volume.',
    chartType: 'area',
    xSynonyms: ['segment', 'region', 'channel', 'market'],
    ySynonyms: ['amount', 'pipeline_amount', 'revenue', 'value'],
    defaultPivotRows: ['segment'],
    defaultPivotValues: [{ fieldSynonyms: ['amount', 'pipeline_amount', 'revenue', 'value'], agg: 'sum' }]
  }
];

const normalizeFieldToken = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const resolveFieldFromSynonyms = (availableFields: string[], synonyms: string[]) => {
  if (!availableFields.length) return '';
  const normalizedFields = availableFields.map((field) => ({
    field,
    normalized: normalizeFieldToken(field)
  }));
  const normalizedSynonyms = synonyms.map(normalizeFieldToken).filter(Boolean);

  for (const synonym of normalizedSynonyms) {
    const exactMatch = normalizedFields.find((entry) => entry.normalized === synonym);
    if (exactMatch) return exactMatch.field;
  }
  for (const synonym of normalizedSynonyms) {
    const fuzzyMatch = normalizedFields.find((entry) => entry.normalized.includes(synonym) || synonym.includes(entry.normalized));
    if (fuzzyMatch) return fuzzyMatch.field;
  }
  return '';
};

const toErrorMessage = (error: any) =>
  error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Request failed';

const mergeMentionTokens = (existing: string, tokens: string[]) => {
  const currentTokens = existing
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.startsWith('@'));
  const tokenSet = new Set(currentTokens.map((token) => token.toLowerCase()));
  const merged = [...currentTokens];
  tokens.forEach((token) => {
    const normalized = token.trim().toLowerCase();
    if (!normalized.startsWith('@')) return;
    if (tokenSet.has(normalized)) return;
    tokenSet.add(normalized);
    merged.push(token.trim());
  });
  return merged.join(' ').trim();
};

const appendMentionsToMessage = (existing: string, tokens: string[]) => {
  const normalizedExisting = existing.trim();
  const existingMentionSet = new Set(
    normalizedExisting
      .split(/\s+/g)
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token.startsWith('@'))
  );
  const uniqueTokens = tokens
    .map((token) => token.trim())
    .filter((token) => token.startsWith('@'))
    .filter((token) => {
      const normalized = token.toLowerCase();
      if (existingMentionSet.has(normalized)) return false;
      existingMentionSet.add(normalized);
      return true;
    });

  if (!uniqueTokens.length) return normalizedExisting;
  return normalizedExisting
    ? `${normalizedExisting}\n${uniqueTokens.join(' ')}`
    : uniqueTokens.join(' ');
};

const AnalyticsStudio: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const { activeDataset, setActiveDataset } = useDataset();

  const workspaceId = searchParams.get('workspace') || String(activeWorkspace?.id || '');
  const datasetId = searchParams.get('dataset') || String((activeDataset as any)?.id || '');
  const panel = (searchParams.get('panel') as StudioPanel) || 'sheets';
  const [studioFeatureFlags, setStudioFeatureFlags] = useState<StudioFeatureFlags>({
    legacySurfacesEnabled: false,
    visualsTabEnabled: true,
    commsTabEnabled: true
  });

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
  const [reportV2TimeframeDays, setReportV2TimeframeDays] = useState<number>(7);
  const [reportV2Bundle, setReportV2Bundle] = useState<ReportV2Bundle | null>(null);
  const [reportV2Quality, setReportV2Quality] = useState<ReportV2Quality | null>(null);
  const [reportPublishMentions, setReportPublishMentions] = useState<string>('');
  const [reportV2Busy, setReportV2Busy] = useState<boolean>(false);

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
  const [newThreadOwnerId, setNewThreadOwnerId] = useState<string>('');
  const [newThreadAnchor, setNewThreadAnchor] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [newThreadComment, setNewThreadComment] = useState('');
  const [pendingApprovals, setPendingApprovals] = useState<RoomApproval[]>([]);
  const [decisionCheckpoints, setDecisionCheckpoints] = useState<RoomDecisionCheckpoint[]>([]);
  const [decisionTitle, setDecisionTitle] = useState('');
  const [decisionRationale, setDecisionRationale] = useState('');
  const [decisionArtifactId, setDecisionArtifactId] = useState<string>('room');
  const [visualType, setVisualType] = useState<string>('bar');
  const [selectedVisualTemplateKey, setSelectedVisualTemplateKey] = useState<string>('');
  const [visualXField, setVisualXField] = useState<string>('');
  const [visualYField, setVisualYField] = useState<string>('');
  const [visualApiRows, setVisualApiRows] = useState<any[]>([]);
  const [visualApiVisualId, setVisualApiVisualId] = useState<number | null>(null);
  const [visualApiNextDimension, setVisualApiNextDimension] = useState<string | null>(null);
  const [visualDrillLevel, setVisualDrillLevel] = useState<number>(0);
  const [visualPathValuesInput, setVisualPathValuesInput] = useState<string>('');
  const [visualBuildBusy, setVisualBuildBusy] = useState(false);
  const [visualCrossFilter, setVisualCrossFilter] = useState<{
    source: 'preview' | 'advanced';
    field: string;
    value: string;
  } | null>(null);
  const [metricCatalog, setMetricCatalog] = useState<MetricCatalogItem[]>([]);
  const [metricOwnerBusyId, setMetricOwnerBusyId] = useState<number | null>(null);
  const [metricValidationBusy, setMetricValidationBusy] = useState(false);
  const [metricValidationSummary, setMetricValidationSummary] = useState<{
    total: number;
    passed: number;
    failed: number;
    validatedAt: string | null;
  } | null>(null);
  const [playbookRecommendations, setPlaybookRecommendations] = useState<PlaybookRecommendation[]>([]);
  const [outcomeAttributions, setOutcomeAttributions] = useState<OutcomeAttribution[]>([]);
  const [automationRuns, setAutomationRuns] = useState<AutomationRunDetail[]>([]);
  const [automationRunEvents, setAutomationRunEvents] = useState<AutomationRunEvent[]>([]);
  const [automationSchedules, setAutomationSchedules] = useState<AutomationSchedule[]>([]);
  const [automationEventCount, setAutomationEventCount] = useState<number>(0);
  const [automationQueueState, setAutomationQueueState] = useState<AutomationQueueState | null>(null);
  const [automationPolicyIdInput, setAutomationPolicyIdInput] = useState<string>('');
  const [automationCronInput, setAutomationCronInput] = useState<string>('0 9 * * 1');
  const [automationTimezoneInput, setAutomationTimezoneInput] = useState<string>('UTC');
  const [automationDedupeKeyInput, setAutomationDedupeKeyInput] = useState<string>('');
  const [automationBusy, setAutomationBusy] = useState(false);
  const [roomTrustProfile, setRoomTrustProfile] = useState<DatasetProfileArtifact | null>(null);
  const [roomTrustQuality, setRoomTrustQuality] = useState<{ qualityScore: number; threshold: number; publishBlocked: boolean } | null>(null);
  const [coverageTrendPoints, setCoverageTrendPoints] = useState<CoverageTrendPoint[]>([]);
  const [roomRoiSnapshot, setRoomRoiSnapshot] = useState<RoomRoiSnapshot | null>(null);
  const [roomRoiScorecard, setRoomRoiScorecard] = useState<{
    totalTargets: number;
    measuredTargets: number;
    metTargets: number;
    overallStatus: string;
    items: RoomRoiTargetStatus[];
  } | null>(null);
  const [personaProfile, setPersonaProfile] = useState<PersonaProfile | null>(null);
  const [personaBusy, setPersonaBusy] = useState(false);
  const [onboardingPlaybook, setOnboardingPlaybook] = useState<{
    completionRatio: number;
    nextBestStep?: { stepId: string; reason: string; blockingIssues: string[] } | null;
    steps: OnboardingPlaybookStep[];
  } | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [pivotPercentOfTotalEnabled, setPivotPercentOfTotalEnabled] = useState(true);
  const [pivotRankEnabled, setPivotRankEnabled] = useState(true);
  const [pivotRankOrder, setPivotRankOrder] = useState<'asc' | 'desc'>('desc');
  const [pivotFormulaEnabled, setPivotFormulaEnabled] = useState(false);
  const [pivotFormulaExpression, setPivotFormulaExpression] = useState<string>('');
  const [pivotFormulaAlias, setPivotFormulaAlias] = useState<string>('custom_calc');
  const [pivotFilterField, setPivotFilterField] = useState<string>('');
  const [pivotFilterOperator, setPivotFilterOperator] = useState<'eq' | 'contains' | 'gt' | 'lt'>('eq');
  const [pivotFilterValue, setPivotFilterValue] = useState<string>('');
  const [reviewBundleIdInput, setReviewBundleIdInput] = useState<string>('');
  const [reviewStageInput, setReviewStageInput] = useState<string>('manager_review');
  const [reviewNoteInput, setReviewNoteInput] = useState<string>('');
  const [reviewResponseNoteInput, setReviewResponseNoteInput] = useState<string>('');
  const [lastReviewSubmission, setLastReviewSubmission] = useState<ReviewSubmission | null>(null);
  const [reviewSubmissions, setReviewSubmissions] = useState<ReviewSubmission[]>([]);
  const [selectedReviewSubmissionId, setSelectedReviewSubmissionId] = useState<string>('');
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>('');
  const [visualAnnotationText, setVisualAnnotationText] = useState<string>('');
  const [visualAnnotationAnchorInput, setVisualAnnotationAnchorInput] = useState<string>('');
  const [visualAnnotations, setVisualAnnotations] = useState<VisualAnnotation[]>([]);
  const [pinnedVisualAnnotationIds, setPinnedVisualAnnotationIds] = useState<number[]>([]);
  const [annotateVisualBusy, setAnnotateVisualBusy] = useState(false);
  const { socket, isConnected } = useSocket();

  const visiblePanels = useMemo(() => {
    return PANELS.filter((panelKey) => {
      if (panelKey === 'visuals' && !studioFeatureFlags.visualsTabEnabled) return false;
      if (panelKey === 'comms' && !studioFeatureFlags.commsTabEnabled) return false;
      return true;
    });
  }, [studioFeatureFlags]);

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

  const selectedReviewSubmission = useMemo(
    () => reviewSubmissions.find((submission) => String(submission.id) === selectedReviewSubmissionId) || null,
    [reviewSubmissions, selectedReviewSubmissionId]
  );

  const mentionRoleGroups = useMemo(() => {
    const managers: RoomMentionableUser[] = [];
    const executives: RoomMentionableUser[] = [];
    const owners: RoomMentionableUser[] = [];

    mentionableUsers.forEach((user) => {
      const role = String(user.role || '');
      if (managerRolePattern.test(role)) {
        managers.push(user);
      }
      if (executiveRolePattern.test(role)) {
        executives.push(user);
      }
      if (managerRolePattern.test(role) || role.toLowerCase().includes('analyst') || role.toLowerCase().includes('editor')) {
        owners.push(user);
      }
    });

    const dedupe = (users: RoomMentionableUser[]) => {
      const seen = new Set<number>();
      return users.filter((user) => {
        if (seen.has(user.id)) return false;
        seen.add(user.id);
        return true;
      });
    };

    return {
      managers: dedupe(managers),
      executives: dedupe(executives),
      owners: dedupe(owners.length ? owners : mentionableUsers)
    };
  }, [mentionableUsers]);

  const mentionPresetHandles = useMemo<Record<MentionPresetKey, string[]>>(
    () => ({
      manager: mentionRoleGroups.managers.map((user) => user.handle).filter(Boolean),
      exec: mentionRoleGroups.executives.map((user) => user.handle).filter(Boolean),
      owner_group: mentionRoleGroups.owners.map((user) => user.handle).filter(Boolean)
    }),
    [mentionRoleGroups]
  );

  const suggestedManagerReviewer = useMemo(
    () => mentionRoleGroups.managers[0] || mentionableUsers[0] || null,
    [mentionRoleGroups.managers, mentionableUsers]
  );

  const suggestedExecutiveReviewer = useMemo(
    () => mentionRoleGroups.executives[0] || mentionRoleGroups.managers[0] || mentionableUsers[0] || null,
    [mentionRoleGroups.executives, mentionRoleGroups.managers, mentionableUsers]
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

  const visualApiChartSpec = useMemo<ChartSpec>(() => {
    const xAxis = visualXField || fields[0] || 'label';
    const hasValueColumn = visualApiRows.length > 0 && Object.prototype.hasOwnProperty.call(visualApiRows[0], 'value');
    const hasCountColumn = visualApiRows.length > 0 && Object.prototype.hasOwnProperty.call(visualApiRows[0], 'count');
    const yAxis = visualYField || (hasValueColumn ? 'value' : hasCountColumn ? 'count' : 'value');
    return {
      id: `studio-visual-api-${visualApiVisualId || 'preview'}`,
      type: visualType,
      title: `Advanced Visual${visualApiVisualId ? ` #${visualApiVisualId}` : ''}`,
      xAxis,
      yAxis,
      data: visualApiRows
    };
  }, [fields, visualApiRows, visualApiVisualId, visualType, visualXField, visualYField]);

  const visualCrossFilteredPreviewRows = useMemo(() => {
    if (!visualCrossFilter || visualCrossFilter.source !== 'preview') return currentRows;
    const field = visualCrossFilter.field;
    const value = visualCrossFilter.value;
    if (!field) return currentRows;
    return currentRows.filter((row) => String(row?.[field] ?? '(blank)') === value);
  }, [currentRows, visualCrossFilter]);

  const visualCrossFilteredAdvancedRows = useMemo(() => {
    if (!visualCrossFilter || visualCrossFilter.source !== 'advanced') return visualApiRows;
    const field = visualCrossFilter.field;
    const value = visualCrossFilter.value;
    if (!field) return visualApiRows;
    return visualApiRows.filter((row) => String(row?.[field] ?? '(blank)') === value);
  }, [visualApiRows, visualCrossFilter]);

  const trustIssueSummary = useMemo(() => {
    const profile = roomTrustProfile;
    if (!profile) {
      return {
        missingFieldsAtRisk: 0,
        duplicateFieldsAtRisk: 0,
        continuityFieldsAtRisk: 0,
        numericFieldsAtRisk: 0
      };
    }
    return {
      missingFieldsAtRisk: profile.missingness.filter((item) => Number(item.ratio || 0) >= 0.2).length,
      duplicateFieldsAtRisk: profile.duplicateKeys.filter((item) => Number(item.ratio || 0) >= 0.05).length,
      continuityFieldsAtRisk: profile.dateContinuity.filter((item) => Number(item.continuityRatio || 1) < 0.8).length,
      numericFieldsAtRisk: profile.invalidNumerics.filter((item) => Number(item.ratio || 0) >= 0.05).length
    };
  }, [roomTrustProfile]);

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

  const refreshReportV2 = useCallback(async () => {
    if (!workspaceId || !selectedRoomId) {
      setReportV2Bundle(null);
      setReportV2Quality(null);
      return;
    }

    try {
      const latestResponse = await studioAPI.getLatestReportV2(workspaceId, selectedRoomId);
      const bundle = latestResponse.data as ReportV2Bundle;
      setReportV2Bundle(bundle);
      setReportV2Quality(bundle.quality || null);

      if (bundle?.bundleId) {
        const qualityResponse = await studioAPI.getReportV2Quality(workspaceId, selectedRoomId, bundle.bundleId);
        setReportV2Quality(qualityResponse.data?.quality || bundle.quality || null);
      }
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setReportV2Bundle(null);
        setReportV2Quality(null);
        return;
      }
      throw error;
    }
  }, [workspaceId, selectedRoomId]);

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

  const refreshAnalystOps = useCallback(async () => {
    if (!workspaceId || !selectedRoomId) {
      setMetricCatalog([]);
      setPlaybookRecommendations([]);
      setOutcomeAttributions([]);
      setAutomationRuns([]);
      setAutomationRunEvents([]);
      setAutomationSchedules([]);
      setAutomationEventCount(0);
      setAutomationQueueState(null);
      setRoomTrustProfile(null);
      setRoomTrustQuality(null);
      setCoverageTrendPoints([]);
      setRoomRoiSnapshot(null);
      setRoomRoiScorecard(null);
      setOnboardingPlaybook(null);
      setPersonaProfile(null);
      return;
    }

    const [metricsResponse, playbookResponse, outcomeResponse, automationResponse, queueStateResponse, trustResponse, coverageTrendResponse, roiResponse, reviewSubmissionsResponse, profileResponse, onboardingResponse] = await Promise.all([
      studioAPI.getMetricsCatalog(workspaceId, selectedRoomId).catch((error) => {
        console.warn('Metric catalog refresh failed:', error);
        return null;
      }),
      studioAPI.getPlaybookRecommendations(workspaceId, selectedRoomId).catch((error) => {
        console.warn('Playbook recommendations refresh failed:', error);
        return null;
      }),
      studioAPI.getOutcomeAttribution(workspaceId, selectedRoomId).catch((error) => {
        console.warn('Outcome attribution refresh failed:', error);
        return null;
      }),
      studioAPI.listAutomationRuns(workspaceId, selectedRoomId).catch((error) => {
        console.warn('Automation runs refresh failed:', error);
        return null;
      }),
      studioAPI.getAutomationQueueState(workspaceId, selectedRoomId).catch((error) => {
        console.warn('Automation queue state refresh failed:', error);
        return null;
      }),
      studioAPI.getRoomTrust(workspaceId, selectedRoomId).catch((error) => {
        if (error?.response?.status !== 404) {
          console.warn('Room trust refresh failed:', error);
        }
        return null;
      }),
      studioAPI.getEvidenceCoverageTrend(workspaceId, selectedRoomId).catch((error) => {
        if (error?.response?.status !== 404) {
          console.warn('Coverage trend refresh failed:', error);
        }
        return null;
      }),
      studioAPI.getRoomRoi(workspaceId, selectedRoomId).catch((error) => {
        if (error?.response?.status !== 404) {
          console.warn('Room ROI refresh failed:', error);
        }
        return null;
      }),
      studioAPI.listReviewSubmissions(workspaceId, selectedRoomId).catch((error) => {
        if (error?.response?.status !== 404) {
          console.warn('Review submissions refresh failed:', error);
        }
        return null;
      }),
      studioAPI.getPersonaProfile(workspaceId).catch((error) => {
        if (error?.response?.status !== 404) {
          console.warn('Persona profile refresh failed:', error);
        }
        return null;
      }),
      studioAPI.getOnboardingPlaybook(workspaceId, selectedRoomId).catch((error) => {
        if (error?.response?.status !== 404) {
          console.warn('Onboarding playbook refresh failed:', error);
        }
        return null;
      })
    ]);

    if (metricsResponse) {
      setMetricCatalog(metricsResponse.data?.metrics || []);
    }
    if (playbookResponse) {
      setPlaybookRecommendations(playbookResponse.data?.recommendations || []);
    }
    if (outcomeResponse) {
      setOutcomeAttributions(outcomeResponse.data?.attributions || []);
    }
    if (automationResponse) {
      setAutomationRuns(automationResponse.data?.runs || []);
      setAutomationSchedules(automationResponse.data?.schedules || []);
      setAutomationEventCount(Array.isArray(automationResponse.data?.events) ? automationResponse.data.events.length : 0);
      setAutomationRunEvents(Array.isArray(automationResponse.data?.events) ? automationResponse.data.events : []);
    }
    if (queueStateResponse) {
      setAutomationQueueState(queueStateResponse.data || null);
    }
    if (trustResponse?.data?.trust) {
      const trust = trustResponse.data.trust;
      setRoomTrustQuality({
        qualityScore: Number(trust.qualityScore || 0),
        threshold: Number(trust.threshold || 0.65),
        publishBlocked: Boolean(trust.publishBlocked)
      });
      setRoomTrustProfile({
        datasetVersionId: trust.datasetVersionId ?? null,
        qualityScore: Number(trust.qualityScore || 0),
        missingness: trust.missingness || [],
        duplicateKeys: trust.duplicateKeys || [],
        dateContinuity: trust.dateContinuity || [],
        invalidNumerics: trust.invalidNumerics || [],
        generatedAt: trust.generatedAt || new Date().toISOString(),
        summary: trust.summary || { rowCount: 0, columnCount: 0, topIssues: [] }
      });
    } else {
      setRoomTrustQuality(null);
      setRoomTrustProfile(null);
    }
    if (coverageTrendResponse) {
      setCoverageTrendPoints(Array.isArray(coverageTrendResponse.data?.points) ? coverageTrendResponse.data.points : []);
    }
    if (roiResponse?.data?.snapshot) {
      setRoomRoiSnapshot(roiResponse.data.snapshot);
      setRoomRoiScorecard(roiResponse.data?.scorecard || null);
    } else {
      setRoomRoiSnapshot(null);
      setRoomRoiScorecard(null);
    }
    if (reviewSubmissionsResponse) {
      const submissions = Array.isArray(reviewSubmissionsResponse.data?.submissions)
        ? reviewSubmissionsResponse.data.submissions
        : [];
      setReviewSubmissions(submissions);
      if (submissions.length > 0) {
        setLastReviewSubmission(submissions[0]);
        if (!selectedReviewSubmissionId) {
          setSelectedReviewSubmissionId(String(submissions[0].id));
        }
      } else {
        setLastReviewSubmission(null);
        setSelectedReviewSubmissionId('');
      }
    }
    if (profileResponse?.data?.profile) {
      setPersonaProfile(profileResponse.data.profile);
    }
    if (onboardingResponse?.data) {
      setOnboardingPlaybook({
        completionRatio: Number(onboardingResponse.data?.completionRatio || 0),
        nextBestStep: onboardingResponse.data?.nextBestStep || null,
        steps: Array.isArray(onboardingResponse.data?.steps) ? onboardingResponse.data.steps : []
      });
    }
  }, [workspaceId, selectedRoomId, selectedReviewSubmissionId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (workspaceId && !searchParams.get('workspace')) next.set('workspace', workspaceId);
    if (datasetId && !searchParams.get('dataset')) next.set('dataset', datasetId);
    if (!visiblePanels.includes(panel)) next.set('panel', 'sheets');
    if (selectedProjectId) next.set('project', selectedProjectId);
    if (selectedRoomId) next.set('room', selectedRoomId);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [workspaceId, datasetId, panel, selectedProjectId, selectedRoomId, searchParams, setSearchParams, visiblePanels]);

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
    const loadStudioFlags = async () => {
      if (!workspaceId) return;
      try {
        const response = await studioAPI.getNavigationState(workspaceId);
        const flags = response.data?.featureFlags;
        if (flags) {
          setStudioFeatureFlags({
            legacySurfacesEnabled: Boolean(flags.legacySurfacesEnabled),
            visualsTabEnabled: Boolean(flags.visualsTabEnabled),
            commsTabEnabled: Boolean(flags.commsTabEnabled)
          });
        }
      } catch (error) {
        console.warn('Failed to load Studio feature flags:', error);
      }
    };

    loadStudioFlags();
  }, [workspaceId]);

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
    refreshReportV2().catch((error) => {
      console.error('Failed to refresh Report V2:', error);
    });
  }, [refreshReportV2]);

  useEffect(() => {
    refreshAnalystOps().catch((error) => {
      console.error('Failed to refresh analyst operations context:', error);
    });
  }, [refreshAnalystOps]);

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
      refreshRoomState().catch((error) => {
        console.error('Realtime room refresh failed:', error);
      });
      refreshReportV2().catch((error) => {
        console.error('Realtime Report V2 refresh failed:', error);
      });
      refreshAnalystOps().catch((error) => {
        console.error('Realtime analyst ops refresh failed:', error);
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
    socket.on('decision-room:report-generated', handleRoomEvent);
    socket.on('decision-room:report-published', handleRoomEvent);

    return () => {
      socket.emit('leave-decision-room', { workspaceId: workspaceNumeric, roomId: roomNumeric });
      socket.off('decision-room:thread-created', handleRoomEvent);
      socket.off('decision-room:comment-added', handleRoomEvent);
      socket.off('decision-room:approval-created', handleRoomEvent);
      socket.off('decision-room:approval-updated', handleRoomEvent);
      socket.off('decision-room:checkpoint-created', handleRoomEvent);
      socket.off('decision-room:checkpoint-updated', handleRoomEvent);
      socket.off('decision-room:report-generated', handleRoomEvent);
      socket.off('decision-room:report-published', handleRoomEvent);
    };
  }, [socket, isConnected, workspaceId, selectedRoomId, selectedThreadId, refreshAnalystOps, refreshCommunication, refreshReportV2, refreshRoomState, refreshThreadComments]);

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
    setNewThreadOwnerId('');
    setNewThreadContent('');
    setNewThreadComment('');
    setPendingApprovals([]);
    setDecisionCheckpoints([]);
    setDecisionTitle('');
    setDecisionRationale('');
    setDecisionArtifactId('room');
    setReportV2Bundle(null);
    setReportV2Quality(null);
    setReportPublishMentions('');
    setReportV2Busy(false);
    setVisualApiRows([]);
    setVisualApiVisualId(null);
    setVisualApiNextDimension(null);
    setVisualDrillLevel(0);
    setVisualPathValuesInput('');
    setVisualCrossFilter(null);
    setSelectedVisualTemplateKey('');
    setMetricOwnerBusyId(null);
    setPivotPercentOfTotalEnabled(true);
    setPivotRankEnabled(true);
    setPivotRankOrder('desc');
    setPivotFormulaEnabled(false);
    setPivotFormulaExpression('');
    setPivotFormulaAlias('custom_calc');
    setPivotFilterField('');
    setPivotFilterOperator('eq');
    setPivotFilterValue('');
    setMetricCatalog([]);
    setMetricValidationSummary(null);
    setPlaybookRecommendations([]);
    setOutcomeAttributions([]);
    setAutomationRuns([]);
    setAutomationRunEvents([]);
    setAutomationSchedules([]);
    setAutomationEventCount(0);
    setAutomationQueueState(null);
    setAutomationPolicyIdInput('');
    setAutomationCronInput('0 9 * * 1');
    setAutomationTimezoneInput('UTC');
    setAutomationDedupeKeyInput('');
    setRoomTrustProfile(null);
    setRoomTrustQuality(null);
    setCoverageTrendPoints([]);
    setRoomRoiSnapshot(null);
    setRoomRoiScorecard(null);
    setOnboardingPlaybook(null);
    setProfileBusy(false);
    setReviewBundleIdInput('');
    setReviewStageInput('manager_review');
    setReviewNoteInput('');
    setReviewResponseNoteInput('');
    setLastReviewSubmission(null);
    setReviewSubmissions([]);
    setSelectedReviewSubmissionId('');
    setSelectedReviewerId('');
    setVisualAnnotationText('');
    setVisualAnnotationAnchorInput('');
    setVisualAnnotations([]);
    setPinnedVisualAnnotationIds([]);
    setAnnotateVisualBusy(false);
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

  useEffect(() => {
    const loadVisualAnnotations = async () => {
      if (!workspaceId || !selectedRoomId || !visualApiVisualId) {
        setVisualAnnotations([]);
        setPinnedVisualAnnotationIds([]);
        return;
      }
      try {
        const response = await studioAPI.listVisualAnnotations(workspaceId, selectedRoomId, visualApiVisualId);
        const nextAnnotations = Array.isArray(response.data?.annotations) ? response.data.annotations : [];
        setVisualAnnotations(nextAnnotations);
        setPinnedVisualAnnotationIds((prev) => prev.filter((id) => nextAnnotations.some((annotation) => annotation.id === id)));
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          console.warn('Failed to load visual annotations:', error);
        }
        setVisualAnnotations([]);
        setPinnedVisualAnnotationIds([]);
      }
    };
    loadVisualAnnotations().catch((error) => {
      console.warn('Visual annotations load error:', error);
    });
  }, [workspaceId, selectedRoomId, visualApiVisualId]);

  const setPanel = (nextPanel: StudioPanel) => {
    const resolvedPanel = visiblePanels.includes(nextPanel) ? nextPanel : 'sheets';
    const next = new URLSearchParams(searchParams);
    next.set('panel', resolvedPanel);
    if (selectedProjectId) next.set('project', selectedProjectId);
    if (selectedRoomId) next.set('room', selectedRoomId);
    setSearchParams(next);
  };

  const updatePersonaProfile = async (updates: Partial<PersonaProfile>) => {
    if (!workspaceId) return;
    setPersonaBusy(true);
    try {
      const response = await studioAPI.updatePersonaProfile(workspaceId, {
        persona: updates.persona,
        uiMode: updates.uiMode,
        reportStyle: updates.reportStyle,
        aiStyle: updates.aiStyle,
        notificationPreferences: updates.notificationPreferences,
        panelPreferences: updates.panelPreferences
      });
      if (response.data?.profile) {
        setPersonaProfile(response.data.profile);
      }
      setStatusMessage('Persona preferences saved.');
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    } finally {
      setPersonaBusy(false);
    }
  };

  const openOnboardingStep = (step: OnboardingPlaybookStep) => {
    setPanel(step.panel);
    setStatusMessage(`Opened onboarding step "${step.label}" in ${step.panel}.`);
  };

  const completeOnboardingStep = async (stepId: string) => {
    if (!workspaceId || !selectedRoomId) return;
    try {
      await studioAPI.completeGuideStep(workspaceId, selectedRoomId, stepId);
      await refreshRoomState();
      await refreshAnalystOps();
      setStatusMessage(`Marked onboarding step "${stepId}" as complete.`);
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
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
      await refreshAnalystOps();
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
    await refreshAnalystOps();
    setStatusMessage('Pivot artifact saved with lineage.');
  };

  const computePivotViaApi = async () => {
    if (!workspaceId || !selectedRoomId) return;
    try {
      const dimensions = [...(pivotConfig.rows || []), ...(pivotConfig.columns || [])]
        .map((field) => String(field))
        .filter(Boolean);
      const measures = (pivotConfig.values || [])
        .map((value, index) => {
          if (typeof value === 'string') {
            const alias = `sum_${value}`;
            return {
              field: value,
              agg: 'sum' as const,
              as: alias || `measure_${index + 1}`
            };
          }
          const field = String(value?.field || '').trim();
          if (!field) return null;
          const agg = value?.agg || 'sum';
          return {
            field,
            agg,
            as: `${agg}_${field}`
          };
        })
        .filter((measure): measure is { field: string; agg: 'sum' | 'avg' | 'count' | 'min' | 'max'; as: string } => Boolean(measure));
      if (!dimensions.length && !measures.length) {
        setStatusMessage('Configure at least one pivot row/column/value before computing.');
        return;
      }

      const primaryMeasure = measures[0]?.as || '';
      const calculations: Array<{
        type: 'percent_of_total' | 'rank' | 'formula';
        sourceField?: string;
        as?: string;
        order?: 'asc' | 'desc';
        expression?: string;
      }> = [];

      if (pivotPercentOfTotalEnabled && primaryMeasure) {
        calculations.push({
          type: 'percent_of_total',
          sourceField: primaryMeasure,
          as: `${primaryMeasure}_pct_total`
        });
      }
      if (pivotRankEnabled && primaryMeasure) {
        calculations.push({
          type: 'rank',
          sourceField: primaryMeasure,
          as: `${primaryMeasure}_rank`,
          order: pivotRankOrder
        });
      }
      if (pivotFormulaEnabled && pivotFormulaExpression.trim()) {
        calculations.push({
          type: 'formula',
          as: pivotFormulaAlias.trim() || 'custom_calc',
          expression: pivotFormulaExpression.trim()
        });
      }

      const filters = pivotFilterField && pivotFilterValue.trim()
        ? [{
            field: pivotFilterField,
            operator: pivotFilterOperator,
            value: pivotFilterValue
          }]
        : [];

      const response = await studioAPI.computePivot(workspaceId, selectedRoomId, {
        name: `Pivot - ${dimensions.join(', ') || 'summary'}`,
        spec: {
          dimensions,
          measures,
          calculations,
          filters
        }
      });

      setRunRows(response.data?.pivot?.rows || []);
      await refreshRoomState();
      await refreshAnalystOps();
      setStatusMessage(`Pivot computed and persisted as artifact #${response.data?.pivot?.artifactId || 'n/a'}.`);
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const generateDataProfile = async () => {
    if (!workspaceId || !selectedRoomId) return;
    setProfileBusy(true);
    try {
      const response = await studioAPI.generateDataProfile(workspaceId, selectedRoomId, {
        minQualityScore: 0.65
      });
      const profile = response.data?.profile as DatasetProfileArtifact | undefined;
      const quality = response.data?.quality;
      if (profile) {
        setRoomTrustProfile(profile);
      }
      if (quality) {
        setRoomTrustQuality({
          qualityScore: Number(quality.qualityScore || 0),
          threshold: Number(quality.threshold || 0.65),
          publishBlocked: Boolean(quality.publishBlocked)
        });
      }
      await refreshRoomState();
      await refreshAnalystOps();
      setStatusMessage(`Data profile generated. Quality ${(Number(quality?.qualityScore || 0) * 100).toFixed(1)}%.`);
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    } finally {
      setProfileBusy(false);
    }
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
    await refreshAnalystOps();
    setStatusMessage('Chart artifact saved with lineage.');
  };

  const validateMetrics = async () => {
    if (!workspaceId || !selectedRoomId) return;
    setMetricValidationBusy(true);
    try {
      const response = await studioAPI.validateMetrics(workspaceId, selectedRoomId);
      const validations = response.data?.validations || [];
      const passed = validations.filter((item: any) => String(item.status || '').toLowerCase() === 'passed').length;
      const failed = validations.length - passed;
      const validatedAt = validations[0]?.validatedAt || new Date().toISOString();
      setMetricValidationSummary({
        total: validations.length,
        passed,
        failed,
        validatedAt
      });
      await refreshAnalystOps();
      setStatusMessage(`Metric validation completed. Passed: ${passed}, failed: ${failed}.`);
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    } finally {
      setMetricValidationBusy(false);
    }
  };

  const applyVisualTemplate = (templateKey: string) => {
    const template = REVOPS_VISUAL_TEMPLATES.find((item) => item.key === templateKey);
    if (!template) return;

    const resolvedX = resolveFieldFromSynonyms(fields, template.xSynonyms) || fields[0] || '';
    const resolvedY = resolveFieldFromSynonyms(numericFields, template.ySynonyms) || numericFields[0] || '';
    setSelectedVisualTemplateKey(template.key);
    setVisualType(template.chartType);
    if (resolvedX) setVisualXField(resolvedX);
    if (resolvedY) setVisualYField(resolvedY);
    setVisualCrossFilter(null);

    const nextPivotRows = template.defaultPivotRows
      .map((synonym) => resolveFieldFromSynonyms(fields, [synonym]))
      .filter(Boolean);
    const nextPivotValues = template.defaultPivotValues
      .map((entry) => {
        const resolvedField = resolveFieldFromSynonyms(fields, entry.fieldSynonyms);
        if (!resolvedField) return null;
        return {
          field: resolvedField,
          agg: entry.agg
        };
      })
      .filter((value): value is { field: string; agg: 'sum' | 'count' | 'avg' | 'min' | 'max' } => Boolean(value));

    if (nextPivotRows.length > 0 || nextPivotValues.length > 0) {
      setPivotConfig((prev) => ({
        rows: nextPivotRows.length ? nextPivotRows : prev.rows,
        columns: prev.columns,
        values: nextPivotValues.length ? nextPivotValues : prev.values
      }));
    }

    setStatusMessage(`Applied visual template "${template.label}".`);
  };

  const applyVisualCrossFilter = (source: 'preview' | 'advanced', field: string, value: any) => {
    const resolvedField = String(field || '').trim();
    if (!resolvedField) return;
    setVisualCrossFilter({
      source,
      field: resolvedField,
      value: String(value ?? '(blank)')
    });
    setStatusMessage(`Cross-filter applied: ${resolvedField} = ${String(value ?? '(blank)')}`);
  };

  const clearVisualCrossFilter = () => {
    setVisualCrossFilter(null);
  };

  const assignMetricOwner = async (metricId: number, ownerIdRaw: string) => {
    if (!workspaceId || !selectedRoomId) return;
    const ownerId = ownerIdRaw ? Number(ownerIdRaw) : null;
    if (ownerIdRaw && (!Number.isFinite(ownerId) || Number(ownerId) <= 0)) {
      setStatusMessage('Invalid metric owner selection.');
      return;
    }

    setMetricOwnerBusyId(metricId);
    try {
      const response = await studioAPI.assignMetricOwner(workspaceId, selectedRoomId, metricId, {
        ownerId: ownerId ? Number(ownerId) : null
      });
      const updatedMetric = response.data?.metric;
      const fallbackOwner = ownerId
        ? mentionableUsers.find((user) => user.id === ownerId)
        : null;
      setMetricCatalog((prev) =>
        prev.map((metric) =>
          metric.id === metricId
            ? {
                ...metric,
                ownerId: updatedMetric?.ownerId ?? (ownerId ? Number(ownerId) : null),
                ownerName: updatedMetric?.ownerName || fallbackOwner?.fullName || fallbackOwner?.email || null
              }
            : metric
        )
      );
      setStatusMessage(
        updatedMetric?.ownerName
          ? `Owner assigned for metric "${updatedMetric.key}".`
          : 'Metric owner cleared.'
      );
      await refreshAnalystOps();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    } finally {
      setMetricOwnerBusyId(null);
    }
  };

  const buildVisualViaApi = async () => {
    if (!workspaceId || !selectedRoomId) return;
    const dimensions = visualXField ? [visualXField] : [];
    const measures = visualYField ? [visualYField] : [];
    if (!dimensions.length && !measures.length) {
      setStatusMessage('Pick at least one visual field before building an advanced visual.');
      return;
    }

    const drillPath = [visualXField, ...fields.filter((field) => field !== visualXField).slice(0, 2)].filter(Boolean);

    setVisualBuildBusy(true);
    try {
      const response = await studioAPI.buildVisual(workspaceId, selectedRoomId, {
        name: `Visual - ${dimensions[0] || measures[0] || visualType}`,
        spec: {
          chartType: visualType,
          dimensions,
          measures,
          drillPath
        },
        annotations: []
      });
      setVisualApiRows(Array.isArray(response.data?.data) ? response.data.data : []);
      setVisualApiVisualId(Number(response.data?.visualId || 0) || null);
      setVisualApiNextDimension(drillPath[1] || null);
      setVisualDrillLevel(0);
      setVisualPathValuesInput('');
      await refreshRoomState();
      await refreshAnalystOps();
      setStatusMessage(`Advanced visual built and saved as artifact #${response.data?.artifact?.id || 'n/a'}.`);
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    } finally {
      setVisualBuildBusy(false);
    }
  };

  const drillVisualViaApi = async () => {
    if (!workspaceId || !selectedRoomId || !visualApiVisualId) return;
    let pathValues: Record<string, any> = {};
    if (visualPathValuesInput.trim()) {
      try {
        pathValues = JSON.parse(visualPathValuesInput);
      } catch {
        setStatusMessage('Path values must be valid JSON, for example {"owner":"Alice"}');
        return;
      }
    }

    try {
      const response = await studioAPI.drillVisual(workspaceId, selectedRoomId, visualApiVisualId, {
        level: visualDrillLevel,
        pathValues
      });
      setVisualApiRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
      setVisualApiNextDimension(response.data?.nextDimension || null);
      setStatusMessage(response.data?.nextDimension
        ? `Drilled visual. Next dimension: ${response.data.nextDimension}.`
        : 'Drill reached row-level detail.');
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const annotateVisualViaApi = async () => {
    if (!workspaceId || !selectedRoomId || !visualApiVisualId) return;
    const text = visualAnnotationText.trim();
    if (!text) {
      setStatusMessage('Add annotation text before saving visual annotation.');
      return;
    }

    let anchor: Record<string, any> = {};
    if (visualAnnotationAnchorInput.trim()) {
      try {
        anchor = JSON.parse(visualAnnotationAnchorInput);
      } catch {
        setStatusMessage('Annotation anchor must be valid JSON, for example {"x":"owner=Alex"}');
        return;
      }
    }

    setAnnotateVisualBusy(true);
    try {
      const response = await studioAPI.annotateVisual(workspaceId, selectedRoomId, visualApiVisualId, {
        text,
        anchor
      });
      const nextAnnotations = Array.isArray(response.data?.annotations) ? response.data.annotations : [];
      setVisualAnnotations(nextAnnotations);
      setPinnedVisualAnnotationIds((prev) => prev.filter((id) => nextAnnotations.some((item) => item.id === id)));
      setVisualAnnotationText('');
      setVisualAnnotationAnchorInput('');
      setStatusMessage('Visual annotation saved.');
      await refreshRoomState();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    } finally {
      setAnnotateVisualBusy(false);
    }
  };

  const togglePinnedVisualAnnotation = (annotationId: number) => {
    setPinnedVisualAnnotationIds((prev) =>
      prev.includes(annotationId)
        ? prev.filter((id) => id !== annotationId)
        : [...prev, annotationId]
    );
  };

  const addVisualAnnotationToReportDraft = (annotation: VisualAnnotation) => {
    const anchorSummary = annotation.anchor && Object.keys(annotation.anchor).length > 0
      ? ` | anchor: ${JSON.stringify(annotation.anchor)}`
      : '';
    const block = `- [Visual insight] ${annotation.text}${anchorSummary}`;
    setReportText((prev) => (prev.trim() ? `${prev}\n${block}` : block));
    setPanel('report');
    setStatusMessage('Visual insight added to report draft.');
  };

  const createThreadFromVisualAnnotation = async (annotation: VisualAnnotation) => {
    if (!workspaceId || !selectedRoomId) return;
    try {
      const ownerMentions = mentionPresetHandles.owner_group.join(' ');
      const message = [
        `Visual insight: ${annotation.text}`,
        ownerMentions || ''
      ].filter(Boolean).join('\n');
      await studioAPI.createThread(workspaceId, selectedRoomId, {
        artifactId: null,
        anchor: {
          ...(annotation.anchor || {}),
          visualId: annotation.visualId,
          annotationId: annotation.id
        },
        content: message
      });
      await refreshCommunication();
      setPanel('comms');
      setStatusMessage('Visual insight sent to Comms as a thread.');
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
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

  const generateReportV2 = async () => {
    if (!workspaceId || !selectedRoomId) return;
    setReportV2Busy(true);
    try {
      const response = await studioAPI.generateReportV2(workspaceId, selectedRoomId, {
        timeframeDays: reportV2TimeframeDays,
        compareMode: 'previous_period',
        focus: 'revops_weekly',
        persist: true
      });
      const bundle = response.data as ReportV2Bundle;
      setReportV2Bundle(bundle);
      setReportV2Quality(bundle.quality || null);
      setStatusMessage(`Report V2 generated (${bundle.bundleId}).`);
      await refreshRoomState();
      await refreshCommunication();
      await refreshReportV2();
      await refreshAnalystOps();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    } finally {
      setReportV2Busy(false);
    }
  };

  const publishReportV2 = async () => {
    if (!workspaceId || !selectedRoomId || !reportV2Bundle?.bundleId) return;
    setReportV2Busy(true);
    try {
      const mentionTokens = reportPublishMentions
        .split(/\s+/g)
        .map((token) => token.trim())
        .filter((token) => token.startsWith('@'));
      const response = await studioAPI.publishReportV2(workspaceId, selectedRoomId, reportV2Bundle.bundleId, {
        channel: 'slack',
        mentionTokens,
        idempotencyKey: `publish-${selectedRoomId}-${reportV2Bundle.bundleId}`
      });
      setStatusMessage(response.data?.message || 'Report V2 published.');
      await refreshReportV2();
      await refreshCommunication();
      await refreshAnalystOps();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
      if (reportV2Bundle?.bundleId) {
        try {
          const qualityResponse = await studioAPI.getReportV2Quality(workspaceId, selectedRoomId, reportV2Bundle.bundleId);
          setReportV2Quality(qualityResponse.data?.quality || null);
        } catch {
          // no-op; fallback to API error message
        }
      }
    } finally {
      setReportV2Busy(false);
    }
  };

  const applyMentionPresetToReport = (preset: MentionPresetKey) => {
    const tokens = mentionPresetHandles[preset];
    if (!tokens.length) {
      setStatusMessage(`No users found for "${preset}" mention preset.`);
      return;
    }
    setReportPublishMentions((prev) => mergeMentionTokens(prev, tokens));
    setStatusMessage(`Added ${tokens.length} mention(s) using preset "${preset}".`);
  };

  const applyMentionPresetToThreadComposer = (preset: MentionPresetKey) => {
    const tokens = mentionPresetHandles[preset];
    if (!tokens.length) {
      setStatusMessage(`No users found for "${preset}" mention preset.`);
      return;
    }
    setNewThreadContent((prev) => appendMentionsToMessage(prev, tokens));
    setStatusMessage(`Added ${tokens.length} mention(s) to thread draft.`);
  };

  const applyMentionPresetToThreadReply = (preset: MentionPresetKey) => {
    const tokens = mentionPresetHandles[preset];
    if (!tokens.length) {
      setStatusMessage(`No users found for "${preset}" mention preset.`);
      return;
    }
    setNewThreadComment((prev) => appendMentionsToMessage(prev, tokens));
    setStatusMessage(`Added ${tokens.length} mention(s) to reply draft.`);
  };

  const submitReview = async (overrides?: { bundleId?: string; stage?: string; reviewerId?: number | null; note?: string }) => {
    if (!workspaceId || !selectedRoomId) return;
    try {
      const reviewerIdFromState = selectedReviewerId.trim() ? Number(selectedReviewerId) : undefined;
      const reviewerId = overrides?.reviewerId !== undefined
        ? overrides.reviewerId
        : reviewerIdFromState;

      const response = await studioAPI.submitReview(workspaceId, selectedRoomId, {
        bundleId: overrides?.bundleId || reviewBundleIdInput.trim() || reportV2Bundle?.bundleId || undefined,
        stage: overrides?.stage || reviewStageInput.trim() || 'manager_review',
        reviewerId: reviewerId === null ? undefined : (reviewerId as number | undefined),
        note: overrides?.note || reviewNoteInput.trim() || undefined
      });
      const createdSubmission = response.data?.submission || null;
      setLastReviewSubmission(createdSubmission);
      if (createdSubmission?.id) {
        setSelectedReviewSubmissionId(String(createdSubmission.id));
      }
      setStatusMessage(`Review submitted${response.data?.submission?.id ? ` (#${response.data.submission.id})` : ''}.`);
      await refreshAnalystOps();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const submitDraftForManagerReview = async () => {
    const reviewer = suggestedManagerReviewer;
    if (!reviewer) {
      setStatusMessage('No manager candidate found. Select a reviewer manually.');
      return;
    }
    setSelectedReviewerId(String(reviewer.id));
    setReviewStageInput('manager_review');
    await submitReview({
      stage: 'manager_review',
      reviewerId: reviewer.id,
      note: reviewNoteInput.trim() || 'Analyst draft submitted for manager review.'
    });
  };

  const notifyExecutiveReview = async () => {
    const reviewer = suggestedExecutiveReviewer;
    if (!reviewer) {
      setStatusMessage('No executive candidate found. Select a reviewer manually.');
      return;
    }
    const sourceSubmission = selectedReviewSubmission || lastReviewSubmission;
    if (sourceSubmission && sourceSubmission.stage === 'manager_review' && sourceSubmission.status !== 'approved') {
      setStatusMessage('Manager review should be approved before executive notify.');
      return;
    }
    const noteParts = [
      'Manager-approved report ready for executive notify.',
      sourceSubmission ? `Source review #${sourceSubmission.id} (${sourceSubmission.status}).` : ''
    ].filter(Boolean);
    setSelectedReviewerId(String(reviewer.id));
    setReviewStageInput('executive_notify');
    await submitReview({
      stage: 'executive_notify',
      reviewerId: reviewer.id,
      note: noteParts.join(' ')
    });
  };

  const respondReview = async (decision: 'approved' | 'rejected' | 'cancelled') => {
    if (!workspaceId || !selectedRoomId) return;
    const submissionId = Number(selectedReviewSubmissionId || lastReviewSubmission?.id || 0);
    if (!Number.isFinite(submissionId) || submissionId <= 0) {
      setStatusMessage('Select a review submission before responding.');
      return;
    }

    try {
      const response = await studioAPI.respondReview(workspaceId, selectedRoomId, {
        submissionId,
        decision,
        responseNote: reviewResponseNoteInput.trim() || undefined
      });
      setLastReviewSubmission(response.data?.submission || null);
      setStatusMessage(`Review ${decision}.`);
      await refreshCommunication();
      await refreshAnalystOps();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const createReportCheckpoint = async () => {
    if (!workspaceId || !selectedRoomId || !reportV2Bundle?.bundleId) return;
    try {
      await studioAPI.createDecisionCheckpoint(workspaceId, selectedRoomId, {
        decision: `Approve Report V2 bundle ${reportV2Bundle.bundleId}`,
        rationale: 'Decision checkpoint created from Report V2 quality panel.',
        artifactId: reportV2Bundle.summaryArtifactId || null
      });
      setStatusMessage('Decision checkpoint created from Report V2.');
      await refreshCommunication();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
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
    await refreshAnalystOps();
    setStatusMessage('Action item created with evidence links.');
  };

  const syncActions = async () => {
    if (!workspaceId || !selectedRoomId) return;
    try {
      const response = await studioAPI.syncActions(workspaceId, selectedRoomId, {
        channel: 'slack',
        createTasks: true,
        idempotencyKey: `sync-${selectedRoomId}-${actionArtifacts.length}-${actionArtifacts[0]?.id || 0}`
      });
      setStatusMessage(response.data?.message || 'Actions synced.');
      await refreshRoomState();
      await refreshAnalystOps();
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
      await refreshAnalystOps();
      await refreshMvpKpis();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const refreshOutcomeAttribution = async (persist: boolean = false) => {
    if (!workspaceId || !selectedRoomId) return;
    try {
      const response = await studioAPI.getOutcomeAttribution(workspaceId, selectedRoomId, persist ? { persist: true } : undefined);
      setOutcomeAttributions(response.data?.attributions || []);
      setStatusMessage(`Outcome attribution ${persist ? 'generated and persisted' : 'refreshed'}.`);
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    }
  };

  const createAutomationSchedule = async () => {
    if (!workspaceId || !selectedRoomId) return;
    const policyId = Number(automationPolicyIdInput);
    if (!Number.isFinite(policyId) || policyId <= 0) {
      setStatusMessage('Automation policy ID must be a positive number.');
      return;
    }
    if (!automationCronInput.trim()) {
      setStatusMessage('Cron expression is required.');
      return;
    }

    setAutomationBusy(true);
    try {
      const response = await studioAPI.scheduleAutomation(workspaceId, selectedRoomId, {
        policyId,
        cron: automationCronInput.trim(),
        timezone: automationTimezoneInput.trim() || 'UTC',
        dedupeKey: automationDedupeKeyInput.trim() || undefined
      });
      const createdScheduleId = response.data?.schedule?.id;
      setStatusMessage(`Automation schedule created${createdScheduleId ? ` (#${createdScheduleId})` : ''}.`);
      await refreshAnalystOps();
    } catch (error: any) {
      setStatusMessage(toErrorMessage(error));
    } finally {
      setAutomationBusy(false);
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
        anchor: (() => {
          const anchorPayload: Record<string, any> = {};
          if (newThreadAnchor.trim()) {
            anchorPayload.label = newThreadAnchor.trim();
          }
          if (newThreadOwnerId) {
            const owner = mentionableUsers.find((user) => String(user.id) === newThreadOwnerId);
            if (owner) {
              anchorPayload.ownerId = owner.id;
              anchorPayload.ownerName = owner.fullName || owner.email;
              anchorPayload.ownerHandle = owner.handle;
            }
          }
          return anchorPayload;
        })(),
        content: newThreadContent.trim()
      });
      const createdThreadId = response.data?.thread?.id;
      setNewThreadContent('');
      setNewThreadAnchor('');
      setNewThreadOwnerId('');
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

  const updateThreadResolution = async (status: 'resolved' | 'reopened') => {
    if (!workspaceId || !selectedRoomId || !selectedThreadId) return;
    try {
      await studioAPI.resolveThread(workspaceId, selectedRoomId, selectedThreadId, {
        status,
        resolutionNote: status === 'resolved'
          ? 'Resolved in Decision Room workflow.'
          : 'Thread reopened for additional follow-up.'
      });
      await refreshCommunication();
      await refreshThreadComments(selectedThreadId);
      setStatusMessage(`Thread marked as ${status}.`);
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
        {visiblePanels.map((tab) => (
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
                <button
                  onClick={generateDataProfile}
                  disabled={!selectedRoomId || profileBusy}
                  className="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50"
                >
                  {profileBusy ? 'Profiling...' : 'Generate Data Profile'}
                </button>
                {roomTrustQuality && (
                  <span className={`text-[11px] px-2 py-1 rounded ${
                    roomTrustQuality.publishBlocked
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    Trust {(roomTrustQuality.qualityScore * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <DataGridWidget data={currentRows} height={520} title={`Rows (${currentRows.length})`} />
            </div>
          )}

          {panel === 'query' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                AI is assistive here: prompts can draft queries, but execution and persistence are always explicit actions.
              </div>
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
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-500">Pivot Calculations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pivotPercentOfTotalEnabled}
                      onChange={(e) => setPivotPercentOfTotalEnabled(e.target.checked)}
                    />
                    Enable % of total
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pivotRankEnabled}
                      onChange={(e) => setPivotRankEnabled(e.target.checked)}
                    />
                    Enable rank
                  </label>
                  <label className="flex items-center gap-2">
                    Rank order
                    <select
                      value={pivotRankOrder}
                      onChange={(e) => setPivotRankOrder(e.target.value as 'asc' | 'desc')}
                      className="px-2 py-1 text-xs rounded border"
                    >
                      <option value="desc">High to low</option>
                      <option value="asc">Low to high</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pivotFormulaEnabled}
                      onChange={(e) => setPivotFormulaEnabled(e.target.checked)}
                    />
                    Enable custom formula
                  </label>
                </div>
                {pivotFormulaEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      value={pivotFormulaAlias}
                      onChange={(e) => setPivotFormulaAlias(e.target.value)}
                      placeholder="Formula alias"
                      className="px-2 py-1 text-xs rounded border"
                    />
                    <input
                      value={pivotFormulaExpression}
                      onChange={(e) => setPivotFormulaExpression(e.target.value)}
                      placeholder="Formula expression (SafeExecutor syntax)"
                      className="px-2 py-1 text-xs rounded border"
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-2">
                  <select
                    value={pivotFilterField}
                    onChange={(e) => setPivotFilterField(e.target.value)}
                    className="px-2 py-1 text-xs rounded border"
                  >
                    <option value="">Optional filter field</option>
                    {fields.map((field) => <option key={field} value={field}>{field}</option>)}
                  </select>
                  <select
                    value={pivotFilterOperator}
                    onChange={(e) => setPivotFilterOperator(e.target.value as 'eq' | 'contains' | 'gt' | 'lt')}
                    className="px-2 py-1 text-xs rounded border"
                  >
                    <option value="eq">equals</option>
                    <option value="contains">contains</option>
                    <option value="gt">greater than</option>
                    <option value="lt">less than</option>
                  </select>
                  <input
                    value={pivotFilterValue}
                    onChange={(e) => setPivotFilterValue(e.target.value)}
                    placeholder="Filter value"
                    className="px-2 py-1 text-xs rounded border"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={savePivotArtifact} disabled={!selectedRoomId} className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white disabled:opacity-50">
                  Save Pivot Artifact
                </button>
                <button onClick={computePivotViaApi} disabled={!selectedRoomId} className="px-3 py-1.5 text-xs rounded border disabled:opacity-50">
                  Compute Pivot (API)
                </button>
                <span className="text-xs text-slate-500">
                  Pivot is focused on grouped summaries. Open the Visuals tab for chart building and drill exploration.
                </span>
              </div>
              <button
                onClick={() => setPanel('visuals')}
                className="px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700"
              >
                Open Visuals Tab
              </button>
            </div>
          )}

          {panel === 'visuals' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Visuals are evidence-linked artifacts. Build charts here, then use Report and Actions to execute decisions.
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-500">Visual Builder (Tableau-style preview)</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedVisualTemplateKey}
                    onChange={(e) => applyVisualTemplate(e.target.value)}
                    className="px-2 py-1 text-xs rounded border"
                  >
                    <option value="">Apply RevOps template</option>
                    {REVOPS_VISUAL_TEMPLATES.map((template) => (
                      <option key={template.key} value={template.key}>{template.label}</option>
                    ))}
                  </select>
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
                  <button
                    onClick={buildVisualViaApi}
                    disabled={!selectedRoomId || visualBuildBusy}
                    className="px-3 py-1.5 text-xs rounded bg-slate-800 text-white disabled:opacity-50"
                  >
                    {visualBuildBusy ? 'Building...' : 'Build Advanced Visual'}
                  </button>
                </div>
                {selectedVisualTemplateKey && (
                  <div className="text-[11px] text-slate-500 rounded border border-slate-200 dark:border-slate-700 p-2">
                    {REVOPS_VISUAL_TEMPLATES.find((item) => item.key === selectedVisualTemplateKey)?.description}
                  </div>
                )}
                <ChartWidget
                  chart={visualChartSpec}
                  data={visualPreviewData}
                  height={320}
                  onPointClick={(point) => {
                    const field = visualChartSpec.xAxis || visualXField;
                    if (!field) return;
                    applyVisualCrossFilter('preview', field, point?.[field]);
                  }}
                />
                <div className="rounded border border-slate-200 dark:border-slate-700 p-2 text-[11px] text-slate-600 dark:text-slate-300">
                  {visualCrossFilter ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                        {visualCrossFilter.source} filter: {visualCrossFilter.field} = {visualCrossFilter.value}
                      </span>
                      <button onClick={clearVisualCrossFilter} className="px-2 py-0.5 rounded border">
                        Clear filter
                      </button>
                    </div>
                  ) : (
                    <span>Tip: click a chart point/bar to cross-filter the result table below.</span>
                  )}
                </div>
                <DataGridWidget
                  data={visualCrossFilteredPreviewRows}
                  height={220}
                  title={`Preview Rows (${visualCrossFilteredPreviewRows.length}/${currentRows.length})`}
                />
                {visualApiRows.length > 0 && (
                  <div className="rounded border border-slate-200 dark:border-slate-700 p-2 space-y-2">
                    <div className="text-[11px] font-semibold uppercase text-slate-500">
                      Advanced Visual Output {visualApiVisualId ? `#${visualApiVisualId}` : ''}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={visualDrillLevel}
                        onChange={(e) => setVisualDrillLevel(Math.max(0, Number(e.target.value) || 0))}
                        className="px-2 py-1 text-xs rounded border w-20"
                        placeholder="Level"
                      />
                      <input
                        value={visualPathValuesInput}
                        onChange={(e) => setVisualPathValuesInput(e.target.value)}
                        placeholder='Drill path values JSON, e.g. {"owner":"Alice"}'
                        className="px-2 py-1 text-xs rounded border flex-1 min-w-[220px]"
                      />
                      <button
                        onClick={drillVisualViaApi}
                        disabled={!visualApiVisualId}
                        className="px-3 py-1.5 text-xs rounded border disabled:opacity-50"
                      >
                        Drill
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Next dimension: {visualApiNextDimension || 'none (row-level)'}
                    </div>
                    <ChartWidget
                      chart={visualApiChartSpec}
                      data={visualApiRows}
                      height={280}
                      onPointClick={(point) => {
                        const field = visualApiChartSpec.xAxis || visualXField;
                        if (!field) return;
                        applyVisualCrossFilter('advanced', field, point?.[field]);
                      }}
                    />
                    <DataGridWidget
                      data={visualCrossFilteredAdvancedRows}
                      height={240}
                      title={`Advanced Visual Rows (${visualCrossFilteredAdvancedRows.length}/${visualApiRows.length})`}
                    />
                    <div className="rounded border border-slate-200 dark:border-slate-700 p-2 space-y-2">
                      <div className="text-[11px] font-semibold uppercase text-slate-500">Visual Annotations</div>
                      <textarea
                        value={visualAnnotationText}
                        onChange={(e) => setVisualAnnotationText(e.target.value)}
                        placeholder="Add insight note for this visual"
                        className="w-full h-16 px-2 py-1 text-xs rounded border"
                      />
                      <input
                        value={visualAnnotationAnchorInput}
                        onChange={(e) => setVisualAnnotationAnchorInput(e.target.value)}
                        placeholder='Anchor JSON (optional), e.g. {"row":"owner=Alex"}'
                        className="w-full px-2 py-1 text-xs rounded border"
                      />
                      <button
                        onClick={annotateVisualViaApi}
                        disabled={!visualApiVisualId || annotateVisualBusy}
                        className="px-3 py-1 text-xs rounded border disabled:opacity-50"
                      >
                        {annotateVisualBusy ? 'Saving...' : 'Add Annotation'}
                      </button>
                      <div className="space-y-1">
                        {visualAnnotations.length === 0 && (
                          <div className="text-[11px] text-slate-500">No annotations yet.</div>
                        )}
                        {visualAnnotations.slice(0, 8).map((annotation) => (
                          <div key={annotation.id} className="text-[11px] rounded border border-slate-200 dark:border-slate-700 p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold">{annotation.text}</div>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                pinnedVisualAnnotationIds.includes(annotation.id)
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              }`}>
                                {pinnedVisualAnnotationIds.includes(annotation.id) ? 'pinned' : 'unpinned'}
                              </span>
                            </div>
                            <div className="text-slate-500 mt-1">
                              {annotation.createdAt ? new Date(annotation.createdAt).toLocaleString() : 'unknown time'}
                            </div>
                            <div className="text-slate-500 mt-1">
                              Anchor: {annotation.anchor && Object.keys(annotation.anchor).length > 0 ? JSON.stringify(annotation.anchor) : 'none'}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button onClick={() => togglePinnedVisualAnnotation(annotation.id)} className="px-2 py-0.5 rounded border">
                                {pinnedVisualAnnotationIds.includes(annotation.id) ? 'Unpin' : 'Pin'}
                              </button>
                              <button onClick={() => addVisualAnnotationToReportDraft(annotation)} className="px-2 py-0.5 rounded border">
                                Add to Report Draft
                              </button>
                              <button onClick={() => createThreadFromVisualAnnotation(annotation)} className="px-2 py-0.5 rounded border">
                                Send to Comms
                              </button>
                            </div>
                          </div>
                        ))}
                        {pinnedVisualAnnotationIds.length > 0 && (
                          <div className="text-[11px] rounded border border-amber-200 bg-amber-50 text-amber-800 p-2">
                            Pinned insights: {pinnedVisualAnnotationIds.length}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {panel === 'report' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500">
                AI can polish language, but numeric claims and publish actions remain evidence-gated and user-controlled.
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={reportV2TimeframeDays}
                    onChange={(e) => setReportV2TimeframeDays(Number(e.target.value))}
                    className="px-2 py-1 text-xs rounded border"
                  >
                    <option value={7}>Last 7 days vs previous 7</option>
                    <option value={14}>Last 14 days vs previous 14</option>
                    <option value={30}>Last 30 days vs previous 30</option>
                  </select>
                  <button
                    onClick={generateReportV2}
                    disabled={!selectedRoomId || reportV2Busy}
                    className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white disabled:opacity-50"
                  >
                    {reportV2Busy ? 'Generating...' : 'Generate Report V2'}
                  </button>
                  <button
                    onClick={publishReportV2}
                    disabled={!reportV2Bundle?.bundleId || Boolean(reportV2Quality?.publishBlocked) || reportV2Busy}
                    className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-50"
                  >
                    Publish to Slack
                  </button>
                  <button
                    onClick={createReportCheckpoint}
                    disabled={!reportV2Bundle?.bundleId}
                    className="px-3 py-1.5 text-xs rounded border"
                  >
                    Create Decision Checkpoint
                  </button>
                  <button onClick={generateBrief} disabled={!selectedRoomId} className="px-3 py-1.5 text-xs rounded border">
                    Generate Legacy Brief
                  </button>
                </div>

                <input
                  value={reportPublishMentions}
                  onChange={(e) => setReportPublishMentions(e.target.value)}
                  placeholder="@revops-lead @sales-manager (optional mention prompt before publish)"
                  className="w-full px-2 py-1 text-xs rounded border"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => applyMentionPresetToReport('manager')}
                    className="px-2 py-1 text-[11px] rounded border"
                  >
                    Notify Manager Group
                  </button>
                  <button
                    onClick={() => applyMentionPresetToReport('exec')}
                    className="px-2 py-1 text-[11px] rounded border"
                  >
                    Notify Executive Group
                  </button>
                  <button
                    onClick={() => applyMentionPresetToReport('owner_group')}
                    className="px-2 py-1 text-[11px] rounded border"
                  >
                    Notify Owner Group
                  </button>
                  <span className="text-[10px] text-slate-500">
                    Routing presets are optional and role-based.
                  </span>
                </div>

                <div className="rounded border border-slate-200 dark:border-slate-700 p-2 space-y-2">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">Review Lane</div>
                  <div className="text-[11px] text-slate-500">
                    Flow: Analyst draft -&gt; Manager approve -&gt; Executive notify.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select
                      value={reviewBundleIdInput}
                      onChange={(e) => setReviewBundleIdInput(e.target.value)}
                      className="px-2 py-1 text-xs rounded border"
                    >
                      <option value="">Use latest bundle</option>
                      {reportV2Bundle?.bundleId ? (
                        <option value={reportV2Bundle.bundleId}>{reportV2Bundle.bundleId}</option>
                      ) : null}
                      {reviewSubmissions
                        .map((submission) => submission.bundleId)
                        .filter((value, index, arr) => arr.indexOf(value) === index)
                        .map((bundleId) => (
                          <option key={bundleId} value={bundleId}>{bundleId}</option>
                        ))}
                    </select>
                    <select
                      value={reviewStageInput}
                      onChange={(e) => setReviewStageInput(e.target.value)}
                      className="px-2 py-1 text-xs rounded border"
                    >
                      {reviewStageOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedReviewerId}
                      onChange={(e) => setSelectedReviewerId(e.target.value)}
                      className="px-2 py-1 text-xs rounded border"
                    >
                      <option value="">No reviewer (open)</option>
                      {mentionableUsers.map((user) => (
                        <option key={user.id} value={String(user.id)}>
                          {user.fullName || user.email} ({user.role})
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedReviewSubmissionId}
                      onChange={(e) => setSelectedReviewSubmissionId(e.target.value)}
                      className="px-2 py-1 text-xs rounded border"
                    >
                      <option value="">Select submission to respond</option>
                      {reviewSubmissions.map((submission) => (
                        <option key={submission.id} value={String(submission.id)}>
                          #{submission.id} - {submission.status} - {submission.bundleId}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={reviewNoteInput}
                    onChange={(e) => setReviewNoteInput(e.target.value)}
                    placeholder="Submission note (optional)"
                    className="w-full h-14 px-2 py-1 text-xs rounded border"
                  />
                  <textarea
                    value={reviewResponseNoteInput}
                    onChange={(e) => setReviewResponseNoteInput(e.target.value)}
                    placeholder="Response note (optional)"
                    className="w-full h-14 px-2 py-1 text-xs rounded border"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={submitDraftForManagerReview} className="px-3 py-1 text-xs rounded bg-slate-800 text-white">
                      Submit Draft -&gt; Manager
                    </button>
                    <button onClick={notifyExecutiveReview} className="px-3 py-1 text-xs rounded border">
                      Notify Exec Review
                    </button>
                    <button onClick={submitReview} className="px-3 py-1 text-xs rounded border">
                      Submit Review
                    </button>
                    <button onClick={() => respondReview('approved')} className="px-3 py-1 text-xs rounded bg-emerald-600 text-white">
                      Approve Review
                    </button>
                    <button onClick={() => respondReview('rejected')} className="px-3 py-1 text-xs rounded bg-rose-600 text-white">
                      Reject Review
                    </button>
                    <button onClick={() => respondReview('cancelled')} className="px-3 py-1 text-xs rounded border">
                      Cancel Review
                    </button>
                    {lastReviewSubmission && (
                      <span className="text-[11px] text-slate-500">
                        Last review #{lastReviewSubmission.id}: {lastReviewSubmission.status}
                      </span>
                    )}
                    {selectedReviewSubmission && (
                      <span className="text-[11px] text-slate-500">
                        Active submission stage: {selectedReviewSubmission.stage}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {reviewSubmissions.length === 0 && (
                      <div className="text-[11px] text-slate-500 rounded border border-slate-200 dark:border-slate-700 p-2">
                        No review submissions yet.
                      </div>
                    )}
                    {reviewSubmissions.slice(0, 5).map((submission) => (
                      <button
                        key={submission.id}
                        onClick={() => setSelectedReviewSubmissionId(String(submission.id))}
                        className={`w-full text-left text-[11px] rounded border p-2 ${
                          String(submission.id) === selectedReviewSubmissionId
                            ? 'border-blue-300 bg-blue-50 dark:bg-slate-800'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="font-semibold">#{submission.id} - {submission.status}</div>
                        <div className="text-slate-500">
                          Bundle: {submission.bundleId} | Stage: {submission.stage}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded border border-slate-200 dark:border-slate-700 p-2">
                    <div className="text-[11px] font-semibold uppercase text-slate-500">Report Quality</div>
                    {reportV2Quality ? (
                      <div className="mt-2 space-y-1 text-xs">
                        <div>Evidence coverage: {(reportV2Quality.evidenceCoverageRatio * 100).toFixed(0)}%</div>
                        <div>Unsupported claims: {reportV2Quality.unsupportedClaims}</div>
                        <div>
                          Publish gate: {reportV2Quality.publishBlocked ? (
                            <span className="text-rose-600 font-semibold">Blocked</span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Ready</span>
                          )}
                        </div>
                        {reportV2Quality.blockers?.length > 0 && (
                          <div className="text-[11px] text-amber-700">
                            {reportV2Quality.blockers.join(' | ')}
                          </div>
                        )}
                        {reportV2Quality.metricPolicyFailures && reportV2Quality.metricPolicyFailures.length > 0 && (
                          <div className="text-[11px] text-rose-700 rounded border border-rose-200 bg-rose-50 p-1.5">
                            Metric policy blockers: {reportV2Quality.metricPolicyFailures.map((failure) => `${failure.metricKey} (${failure.status})`).join(' | ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">Generate Report V2 to view quality gates.</div>
                    )}
                  </div>

                  <div className="rounded border border-slate-200 dark:border-slate-700 p-2">
                    <div className="text-[11px] font-semibold uppercase text-slate-500">Input Requirements</div>
                    {reportV2Bundle ? (
                      <div className="mt-2 space-y-2 text-xs">
                        <div className="text-[11px] text-slate-500">
                          Bundle: {reportV2Bundle.bundleId}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(reportV2Bundle.inputRequirements?.mappedFields || {}).map(([key, value]) => (
                            <span key={key} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                        {reportV2Bundle.inputRequirements?.missingFields?.length > 0 && (
                          <div className="text-[11px] text-amber-700">
                            Missing: {reportV2Bundle.inputRequirements.missingFields.join(', ')}
                          </div>
                        )}
                        {reportV2Bundle.inputRequirements?.warnings?.length > 0 && (
                          <div className="text-[11px] text-slate-500">
                            {reportV2Bundle.inputRequirements.warnings.join(' | ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">No report bundle yet.</div>
                    )}
                  </div>
                </div>
              </div>

              {reportV2Bundle ? (
                <div className="space-y-3">
                  {reportV2Bundle.sections.map((section) => (
                    <div key={section.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold">{section.title}</h4>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {reportSectionMeaning[section.type] || 'Evidence-backed section.'}
                          </div>
                        </div>
                        {section.chartArtifactIds.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {section.chartArtifactIds.map((chartId) => (
                              <button
                                key={chartId}
                                onClick={() => openLineage(chartId)}
                                className="px-2 py-0.5 text-[11px] rounded border"
                              >
                                Chart #{chartId}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-xs mt-2 whitespace-pre-wrap break-words">{section.contentMarkdown}</div>
                      <div className="mt-2 space-y-2">
                        {section.claims.map((claim) => (
                          <div key={claim.id} className="rounded border border-slate-200 dark:border-slate-700 p-2">
                            <div className="text-xs">{claim.statement}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
                              <span className={`px-1.5 py-0.5 rounded ${claim.supported ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {claim.supported ? 'supported' : 'unsupported'}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                {claim.metricKey}
                              </span>
                              {claim.evidenceArtifactIds.map((artifactId) => (
                                <button
                                  key={`${claim.id}-${artifactId}`}
                                  onClick={() => openLineage(artifactId)}
                                  className="px-1.5 py-0.5 rounded border"
                                >
                                  evidence #{artifactId}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded border border-dashed border-slate-300 dark:border-slate-700 p-4 text-xs text-slate-500">
                  Report V2 is evidence-first weekly reporting: generate once data analysis artifacts exist in this room.
                </div>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                <div className="text-xs font-semibold uppercase text-slate-500">Manual Report Block</div>
                <div className="flex items-center gap-2">
                  <button onClick={saveReportBlock} disabled={!selectedRoomId || !reportText.trim()} className="px-3 py-1.5 text-xs rounded bg-slate-800 text-white disabled:opacity-50">
                    Save Report Block
                  </button>
                </div>
                <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} className="w-full h-48 p-3 text-sm rounded border font-mono" />
              </div>
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
                <button
                  onClick={async () => {
                    try {
                      await studioAPI.connectSQL(workspaceId, {
                        provider: 'postgres',
                        name: 'Postgres',
                        validateConnection: false,
                        credentials: {
                          host: 'localhost',
                          port: 5432,
                          database: 'analytics',
                          user: 'analyst'
                        }
                      });
                      setStatusMessage('SQL profile saved. Add credentials before production runs.');
                    } catch (error: any) {
                      setStatusMessage(toErrorMessage(error));
                    }
                  }}
                  className="px-3 py-1 text-xs rounded border"
                >
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

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-500">Automation Reliability</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={automationPolicyIdInput}
                    onChange={(e) => setAutomationPolicyIdInput(e.target.value)}
                    placeholder="Policy ID"
                    className="px-2 py-1 text-xs rounded border w-24"
                  />
                  <input
                    value={automationCronInput}
                    onChange={(e) => setAutomationCronInput(e.target.value)}
                    placeholder="Cron (e.g. 0 9 * * 1)"
                    className="px-2 py-1 text-xs rounded border w-40"
                  />
                  <input
                    value={automationTimezoneInput}
                    onChange={(e) => setAutomationTimezoneInput(e.target.value)}
                    placeholder="Timezone"
                    className="px-2 py-1 text-xs rounded border w-24"
                  />
                  <input
                    value={automationDedupeKeyInput}
                    onChange={(e) => setAutomationDedupeKeyInput(e.target.value)}
                    placeholder="Dedupe key (optional)"
                    className="px-2 py-1 text-xs rounded border w-44"
                  />
                  <button
                    onClick={createAutomationSchedule}
                    disabled={!selectedRoomId || automationBusy}
                    className="px-3 py-1 text-xs rounded bg-slate-800 text-white disabled:opacity-50"
                  >
                    {automationBusy ? 'Scheduling...' : 'Schedule Automation'}
                  </button>
                </div>
                <div className="text-[11px] text-slate-500">
                  Schedules: {automationSchedules.length} | Runs: {automationRuns.length} | Run events: {automationEventCount}
                </div>
                {automationQueueState && (
                  <div className="space-y-1 text-[11px] text-slate-500">
                    <div>
                      Queue: {automationQueueState.queue.enabled ? 'enabled' : 'disabled'}
                      {' '}| Due schedules: {automationQueueState.metrics.dueSchedules}
                      {' '}| Running: {automationQueueState.metrics.runningRuns}
                      {' '}| Awaiting approval: {automationQueueState.metrics.awaitingApprovalRuns}
                    </div>
                    <div>
                      Dispatches: {automationQueueState.queue.dispatchInvocations || 0}
                      {' '}| Execute retries: {automationQueueState.queue.executeRetriesScheduled || 0}
                      {' '}| Execute failures: {automationQueueState.queue.executeFailures || 0}
                      {' '}| Terminal failures: {automationQueueState.queue.executeTerminalFailures || 0}
                    </div>
                    {!!Object.keys(automationQueueState.queue.failureByCode || {}).length && (
                      <div>
                        Failure taxonomy -&gt; {Object.entries(automationQueueState.queue.failureByCode || {})
                          .sort((a, b) => Number(b[1]) - Number(a[1]))
                          .slice(0, 5)
                          .map(([code, count]) => `${code}: ${count}`)
                          .join(' | ')}
                      </div>
                    )}
                    {automationQueueState.queue.lastDispatchAt && (
                      <div>
                        Last dispatch: {new Date(automationQueueState.queue.lastDispatchAt).toLocaleString()}
                        {' '}({automationQueueState.queue.lastDispatchReason || 'n/a'})
                        {automationQueueState.queue.lastDispatchError
                          ? ` | error: ${automationQueueState.queue.lastDispatchError}`
                          : ''}
                      </div>
                    )}
                    {automationQueueState.queue.lastDispatchResult && (
                      <div>
                        Last scan -&gt; scanned {automationQueueState.queue.lastDispatchResult.scanned},
                        {' '}queued {automationQueueState.queue.lastDispatchResult.queued},
                        {' '}skipped {automationQueueState.queue.lastDispatchResult.skipped},
                        {' '}duplicates {automationQueueState.queue.lastDispatchResult.duplicates},
                        {' '}enqueue errors {automationQueueState.queue.lastDispatchResult.failedEnqueue}
                      </div>
                    )}
                    {automationQueueState.queue.queues?.execute && (
                      <div>
                        Execute queue -&gt; waiting {automationQueueState.queue.queues.execute.waiting},
                        {' '}active {automationQueueState.queue.queues.execute.active},
                        {' '}delayed {automationQueueState.queue.queues.execute.delayed},
                        {' '}failed {automationQueueState.queue.queues.execute.failed}
                      </div>
                    )}
                    {automationQueueState.queue.lastFailure && (
                      <div className="rounded border border-rose-200 dark:border-rose-700/70 bg-rose-50/80 dark:bg-rose-900/20 px-2 py-1 text-rose-700 dark:text-rose-300">
                        <div className="font-semibold">
                          Last failure: {automationQueueState.queue.lastFailure.code} ({automationQueueState.queue.lastFailure.severity})
                          {' '}| terminal: {automationQueueState.queue.lastFailure.terminal ? 'yes' : 'no'}
                        </div>
                        <div>
                          {automationQueueState.queue.lastFailure.operatorAction}
                        </div>
                        <div className="truncate">
                          {automationQueueState.queue.lastFailure.message}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  {automationRuns.slice(0, 4).map((run) => (
                    <div key={run.runId} className="text-[11px] rounded border border-slate-200 dark:border-slate-700 p-2">
                      <span className="font-semibold">Run #{run.runId}</span> - {run.status} - attempts {run.attempts}
                      {run.error && <div className="text-rose-600 mt-1">{run.error}</div>}
                    </div>
                  ))}
                  {automationRuns.length === 0 && (
                    <div className="text-[11px] text-slate-500 rounded border border-slate-200 dark:border-slate-700 p-2">
                      No automation runs in this room yet.
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">Run Event Timeline</div>
                  {automationRunEvents.slice(0, 8).map((event) => (
                    <div key={event.id} className="text-[11px] rounded border border-slate-200 dark:border-slate-700 p-2">
                      <div className="font-semibold">
                        Run #{event.runId} - {event.eventType} ({event.status})
                      </div>
                      <div className="text-slate-500">
                        Attempt {event.attempt}
                        {event.metadata?.queueAttempt ? ` | Queue attempt ${event.metadata.queueAttempt}` : ''}
                        {event.metadata?.queueMaxAttempts ? `/${event.metadata.queueMaxAttempts}` : ''}
                        {event.metadata?.retryBackoffMs ? ` | Backoff ${event.metadata.retryBackoffMs}ms` : ''}
                      </div>
                      <div className="text-slate-500">
                        {event.createdAt ? new Date(event.createdAt).toLocaleString() : 'unknown time'}
                      </div>
                      {event.error && <div className="text-rose-600">{event.error}</div>}
                    </div>
                  ))}
                  {automationRunEvents.length === 0 && (
                    <div className="text-[11px] text-slate-500 rounded border border-slate-200 dark:border-slate-700 p-2">
                      No run events captured yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase text-slate-500">Outcome Attribution</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => refreshOutcomeAttribution(false)}
                      className="px-2 py-1 text-[11px] rounded border"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={() => refreshOutcomeAttribution(true)}
                      className="px-2 py-1 text-[11px] rounded border"
                    >
                      Persist Snapshot
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {outcomeAttributions.slice(0, 8).map((attribution, index) => (
                    <div key={`${attribution.actionId || 'room'}-${attribution.metricKey}-${index}`} className="text-[11px] rounded border border-slate-200 dark:border-slate-700 p-2">
                      <div className="font-semibold">
                        Action #{attribution.actionId || 'n/a'} - {attribution.metricKey}
                      </div>
                      <div className="text-slate-500">
                        Baseline: {attribution.baselineValue ?? 'n/a'} | Latest: {attribution.latestValue ?? 'n/a'} | Delta: {attribution.deltaPct != null ? `${attribution.deltaPct.toFixed(2)}%` : 'n/a'}
                      </div>
                      <div className="text-slate-500">
                        Confidence: {attribution.confidence} | Evidence: {attribution.evidenceArtifactIds.join(', ') || 'none'}
                      </div>
                    </div>
                  ))}
                  {outcomeAttributions.length === 0 && (
                    <div className="text-[11px] text-slate-500 rounded border border-slate-200 dark:border-slate-700 p-2">
                      No attribution records yet. Generate actions and run snapshots.
                    </div>
                  )}
                </div>
              </div>

              {statusDraft && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                  <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Latest Status Draft</h3>
                  <p className="text-xs text-slate-700 dark:text-slate-200">{statusDraft.summary}</p>
                  {statusDraft.latestReportBundleId && (
                    <div className="mt-2 text-[11px] text-slate-500">
                      Linked Report V2: {statusDraft.latestReportBundleId}
                    </div>
                  )}
                  <div className="mt-2 text-[11px] text-slate-500">
                    Evidence IDs: {statusDraft.evidenceArtifactIds.join(', ') || 'none'}
                  </div>
                </div>
              )}
            </div>
          )}

          {panel === 'comms' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                <div className="text-xs font-bold uppercase text-slate-500">Communication Hub</div>
                <div className="text-xs text-slate-500">
                  Collaboration is optional but first-class: create artifact-linked threads, route mentions, and resolve approvals without leaving Studio.
                </div>
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
                <select
                  value={newThreadOwnerId}
                  onChange={(e) => setNewThreadOwnerId(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded border"
                >
                  <option value="">Thread owner (optional)</option>
                  {mentionableUsers.map((user) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.fullName || user.email} ({user.role})
                    </option>
                  ))}
                </select>
                <textarea
                  value={newThreadContent}
                  onChange={(e) => setNewThreadContent(e.target.value)}
                  placeholder="Start a thread. Mention teammates with @handle."
                  className="w-full h-16 px-2 py-1 text-xs rounded border"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => applyMentionPresetToThreadComposer('manager')}
                    className="px-2 py-1 text-[11px] rounded border"
                  >
                    Mention Managers
                  </button>
                  <button
                    onClick={() => applyMentionPresetToThreadComposer('exec')}
                    className="px-2 py-1 text-[11px] rounded border"
                  >
                    Mention Execs
                  </button>
                  <button
                    onClick={() => applyMentionPresetToThreadComposer('owner_group')}
                    className="px-2 py-1 text-[11px] rounded border"
                  >
                    Mention Owners
                  </button>
                  <button onClick={createThread} disabled={!selectedRoomId || !newThreadContent.trim()} className="px-3 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50">
                    Start Thread
                  </button>
                  <span className="text-[10px] text-slate-500">
                    Mentions: {mentionHints || 'No workspace members detected.'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                  <div className="text-xs font-bold uppercase text-slate-500">Threads</div>
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {threads.length === 0 && (
                      <div className="text-[11px] text-slate-500 border rounded p-2">
                        No threads yet.
                      </div>
                    )}
                    {threads.slice(0, 20).map((thread) => (
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
                        {thread.anchor?.ownerHandle && (
                          <div className="text-[10px] text-indigo-600 truncate">
                            Owner: {thread.anchor.ownerHandle}
                          </div>
                        )}
                        {thread.anchor?.label && (
                          <div className="text-[10px] text-slate-500 truncate">
                            Anchor: {String(thread.anchor.label)}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 truncate">
                          {thread.lastCommentContent || 'No messages yet'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {thread.commentCount} comment(s) | {thread.resolution?.status || 'open'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                  <div className="text-xs font-bold uppercase text-slate-500">
                    {selectedThread ? `Thread #${selectedThread.id}` : 'Select a thread'}
                  </div>
                  {selectedThread ? (
                    <>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className={`${selectedThread.resolution?.status === 'resolved' ? 'text-emerald-600' : 'text-slate-500'}`}>
                          Status: {selectedThread.resolution?.status || 'open'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateThreadResolution('resolved')} className="px-2 py-1 rounded border">
                            Resolve
                          </button>
                          <button onClick={() => updateThreadResolution('reopened')} className="px-2 py-1 rounded border">
                            Reopen
                          </button>
                        </div>
                      </div>
                      <div className="rounded border border-slate-200 dark:border-slate-700 p-2 text-[11px] text-slate-500 space-y-1">
                        <div>Anchor label: {selectedThread.anchor?.label ? String(selectedThread.anchor.label) : 'none'}</div>
                        <div>Assigned owner: {selectedThread.anchor?.ownerHandle || selectedThread.anchor?.ownerName || 'none'}</div>
                        <div>
                          Resolution timeline:
                          {' '}
                          {selectedThread.resolution?.resolvedAt
                            ? new Date(selectedThread.resolution.resolvedAt).toLocaleString()
                            : 'not resolved yet'}
                        </div>
                        {selectedThread.resolution?.resolutionNote && (
                          <div>Resolution note: {selectedThread.resolution.resolutionNote}</div>
                        )}
                      </div>
                      <div className="max-h-56 overflow-auto space-y-2">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => applyMentionPresetToThreadReply('manager')} className="px-2 py-1 text-[11px] rounded border">
                          Mention Managers
                        </button>
                        <button onClick={() => applyMentionPresetToThreadReply('exec')} className="px-2 py-1 text-[11px] rounded border">
                          Mention Execs
                        </button>
                        <button onClick={() => applyMentionPresetToThreadReply('owner_group')} className="px-2 py-1 text-[11px] rounded border">
                          Mention Owners
                        </button>
                      </div>
                      <button
                        onClick={addCommentToThread}
                        disabled={!newThreadComment.trim()}
                        className="w-full px-2 py-1 text-xs rounded bg-slate-800 text-white disabled:opacity-50"
                      >
                        Send Reply
                      </button>
                    </>
                  ) : (
                    <div className="text-[11px] text-slate-500">Choose a thread from the left column.</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                  <div className="text-xs font-bold uppercase text-slate-500">Approval Inbox</div>
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
                      <div className="text-[11px] text-slate-500">Requested by {approval.requestedByName}</div>
                      {approval.reason && <div className="text-[11px] text-slate-600 dark:text-slate-300">{approval.reason}</div>}
                      <div className="flex items-center gap-2">
                        <button onClick={() => respondApproval(approval.id, 'approved')} className="px-2 py-1 text-[11px] rounded bg-emerald-600 text-white">
                          Approve
                        </button>
                        <button onClick={() => respondApproval(approval.id, 'rejected')} className="px-2 py-1 text-[11px] rounded bg-rose-600 text-white">
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                  <div className="text-xs font-bold uppercase text-slate-500">Decision Checkpoints</div>
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
                  <button
                    onClick={createDecisionCheckpoint}
                    disabled={!decisionTitle.trim()}
                    className="px-3 py-1 text-xs rounded bg-indigo-600 text-white disabled:opacity-50"
                  >
                    Create Checkpoint
                  </button>
                  <div className="space-y-2 max-h-52 overflow-auto">
                    {decisionCheckpoints.length === 0 && (
                      <div className="text-[11px] text-slate-500 border rounded p-2">No checkpoints yet.</div>
                    )}
                    {decisionCheckpoints.slice(0, 12).map((checkpoint) => (
                      <div key={checkpoint.id} className="text-xs border rounded p-2 space-y-1">
                        <div className="font-semibold">{checkpoint.decision}</div>
                        <div className="text-[10px] text-slate-500">
                          Status: {checkpoint.status} | Owner: {checkpoint.createdByName}
                        </div>
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
                </div>
              </div>
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

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Data Trust</h3>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 rounded border border-slate-200 dark:border-slate-700 p-2">
            {roomTrustQuality ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    Quality: {(roomTrustQuality.qualityScore * 100).toFixed(1)}%
                    {' '}({roomTrustQuality.publishBlocked ? 'blocked' : 'healthy'})
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    roomTrustQuality.qualityScore >= 0.85
                      ? 'bg-emerald-100 text-emerald-700'
                      : roomTrustQuality.qualityScore >= 0.65
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                  }`}>
                    {roomTrustQuality.qualityScore >= 0.85 ? 'A' : roomTrustQuality.qualityScore >= 0.65 ? 'B' : 'C'}
                  </span>
                </div>
                <div className="h-1.5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${
                      roomTrustQuality.qualityScore >= roomTrustQuality.threshold
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, roomTrustQuality.qualityScore * 100))}%` }}
                  />
                </div>
                <div>Threshold: {(roomTrustQuality.threshold * 100).toFixed(0)}%</div>
                <div>Rows: {roomTrustProfile?.summary?.rowCount ?? 0}</div>
                <div>Columns: {roomTrustProfile?.summary?.columnCount ?? 0}</div>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <div className="rounded border border-slate-200 dark:border-slate-700 px-1.5 py-1">
                    Missing risk fields: {trustIssueSummary.missingFieldsAtRisk}
                  </div>
                  <div className="rounded border border-slate-200 dark:border-slate-700 px-1.5 py-1">
                    Duplicate risk fields: {trustIssueSummary.duplicateFieldsAtRisk}
                  </div>
                  <div className="rounded border border-slate-200 dark:border-slate-700 px-1.5 py-1">
                    Date continuity risks: {trustIssueSummary.continuityFieldsAtRisk}
                  </div>
                  <div className="rounded border border-slate-200 dark:border-slate-700 px-1.5 py-1">
                    Invalid numeric risks: {trustIssueSummary.numericFieldsAtRisk}
                  </div>
                </div>
                <div className="text-[10px] text-amber-700">
                  {roomTrustProfile?.summary?.topIssues?.[0] || 'No major issues detected.'}
                </div>
                <div className="text-[10px] text-slate-500">
                  Generated: {roomTrustProfile?.generatedAt ? new Date(roomTrustProfile.generatedAt).toLocaleString() : 'n/a'}
                </div>
              </>
            ) : (
              <div>No trust profile yet. Run "Generate Data Profile" in Sheets.</div>
            )}
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Evidence Trend</h3>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 rounded border border-slate-200 dark:border-slate-700 p-2">
            <div>Points: {coverageTrendPoints.length}</div>
            {coverageTrendPoints.length > 0 ? (
              <>
                <div>Latest coverage: {(coverageTrendPoints[coverageTrendPoints.length - 1].evidenceCoverageRatio * 100).toFixed(0)}%</div>
                <div>Unsupported claims: {coverageTrendPoints[coverageTrendPoints.length - 1].unsupportedClaims}</div>
              </>
            ) : (
              <div>No coverage history yet.</div>
            )}
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Room ROI</h3>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 rounded border border-slate-200 dark:border-slate-700 p-2">
            <div>Time to insight: {roomRoiSnapshot?.timeToInsightMin != null ? `${roomRoiSnapshot.timeToInsightMin.toFixed(1)} min` : 'n/a'}</div>
            <div>Insight to action: {roomRoiSnapshot?.timeToActionMin != null ? `${roomRoiSnapshot.timeToActionMin.toFixed(1)} min` : 'n/a'}</div>
            <div>Manual update reduction: {roomRoiSnapshot?.manualUpdateReductionPct != null ? `${roomRoiSnapshot.manualUpdateReductionPct.toFixed(0)}%` : 'n/a'}</div>
            <div>Evidence ratio: {roomRoiSnapshot?.evidenceCoverageRatio != null ? `${(roomRoiSnapshot.evidenceCoverageRatio * 100).toFixed(0)}%` : 'n/a'}</div>
            {roomRoiScorecard && (
              <div className="mt-1 rounded border border-slate-200 dark:border-slate-700 p-2">
                <div className="font-semibold">
                  KPI scorecard: {roomRoiScorecard.metTargets}/{roomRoiScorecard.measuredTargets} targets met
                </div>
                <div className="text-[10px] text-slate-500 mb-1">Status: {roomRoiScorecard.overallStatus}</div>
                <div className="space-y-1">
                  {roomRoiScorecard.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-2 text-[10px]">
                      <span>{item.label}</span>
                      <span className={item.met ? 'text-emerald-600' : 'text-amber-700'}>
                        {item.actual == null
                          ? 'n/a'
                          : item.unit === 'minutes'
                            ? `${item.actual.toFixed(1)}m`
                            : item.unit === 'percent'
                              ? `${item.actual.toFixed(0)}%`
                              : `${(item.actual * 100).toFixed(0)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Persona Preset</h3>
          <div className="space-y-2 rounded border border-slate-200 dark:border-slate-700 p-2 text-[11px] text-slate-600 dark:text-slate-300">
            <select
              value={personaProfile?.persona || 'analyst'}
              onChange={(e) => updatePersonaProfile({ persona: e.target.value as PersonaProfile['persona'] })}
              disabled={personaBusy}
              className="w-full px-2 py-1 text-xs rounded border"
            >
              <option value="analyst">Analyst (deep)</option>
              <option value="manager">Manager (operational)</option>
              <option value="executive">Executive (digest-first)</option>
            </select>
            <select
              value={personaProfile?.uiMode || 'guided'}
              onChange={(e) => updatePersonaProfile({ uiMode: e.target.value as PersonaProfile['uiMode'] })}
              disabled={personaBusy}
              className="w-full px-2 py-1 text-xs rounded border"
            >
              <option value="guided">Guided mode</option>
              <option value="expert">Expert mode</option>
            </select>
            <div className="text-[10px] text-slate-500">
              AI style: {personaProfile?.aiStyle || 'tactical'} | Report style: {personaProfile?.reportStyle || 'concise'}
            </div>
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Onboarding Playbook</h3>
          <div className="space-y-2 rounded border border-slate-200 dark:border-slate-700 p-2">
            {onboardingPlaybook ? (
              <>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  Completion: {(onboardingPlaybook.completionRatio * 100).toFixed(0)}%
                </div>
                {onboardingPlaybook.steps.slice(0, 5).map((step) => (
                  <div key={step.id} className="text-[11px] rounded border border-slate-200 dark:border-slate-700 p-2">
                    <div className="font-semibold">{step.label}</div>
                    <div className="text-[10px] text-slate-500">
                      {step.completed ? 'Completed' : `Pending (${step.stage})`}
                    </div>
                    {step.blockers.length > 0 && !step.completed && (
                      <div className="text-[10px] text-amber-700 mt-1">{step.blockers[0]}</div>
                    )}
                    <div className="mt-1 flex items-center gap-1">
                      <button onClick={() => openOnboardingStep(step)} className="px-2 py-0.5 rounded border text-[10px]">
                        {step.actionLabel}
                      </button>
                      {!step.completed && step.blockers.length === 0 && (
                        <button onClick={() => completeOnboardingStep(step.id)} className="px-2 py-0.5 rounded border text-[10px]">
                          Mark done
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-[11px] text-slate-500">No onboarding playbook loaded yet.</div>
            )}
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

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Semantic Metrics</h3>
          <div className="space-y-2 rounded border border-slate-200 dark:border-slate-700 p-2">
            <button
              onClick={validateMetrics}
              disabled={!selectedRoomId || metricValidationBusy}
              className="w-full px-2 py-1 text-xs rounded bg-slate-800 text-white disabled:opacity-50"
            >
              {metricValidationBusy ? 'Validating...' : 'Validate Metric Formulas'}
            </button>
            {metricValidationSummary && (
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                Total: {metricValidationSummary.total} | Passed: {metricValidationSummary.passed} | Failed: {metricValidationSummary.failed}
              </div>
            )}
            {metricCatalog.slice(0, 6).map((metric) => (
              <div key={metric.id} className="text-[11px] rounded border border-slate-200 dark:border-slate-700 p-2">
                <div className="font-semibold">{metric.name}</div>
                <div className="text-slate-500">
                  {metric.key} | {metric.certified ? 'Certified' : 'Uncertified'} | Validation: {metric.validationStatus}
                </div>
                <div className="mt-1">
                  Owner: {metric.ownerName || 'Unassigned'}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <select
                    value={metric.ownerId ? String(metric.ownerId) : ''}
                    onChange={(e) => assignMetricOwner(metric.id, e.target.value)}
                    disabled={metricOwnerBusyId === metric.id}
                    className="flex-1 px-1.5 py-0.5 rounded border text-[11px]"
                  >
                    <option value="">Unassigned</option>
                    {mentionableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName || user.email}
                      </option>
                    ))}
                  </select>
                  {metricOwnerBusyId === metric.id && (
                    <span className="text-[10px] text-slate-500">Saving...</span>
                  )}
                </div>
              </div>
            ))}
            {metricCatalog.length === 0 && (
              <div className="text-[11px] text-slate-500">No metrics found in this workspace yet.</div>
            )}
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Playbook Recommendations</h3>
          <div className="space-y-2 rounded border border-slate-200 dark:border-slate-700 p-2">
            {playbookRecommendations.slice(0, 5).map((recommendation) => (
              <div key={recommendation.id} className="text-[11px] rounded border border-slate-200 dark:border-slate-700 p-2">
                <div className="font-semibold">
                  [{recommendation.priority}] {recommendation.title}
                </div>
                <div className="text-slate-500 mt-1">{recommendation.reason}</div>
                <div className="mt-1">{recommendation.action}</div>
                {recommendation.blockers.length > 0 && (
                  <div className="mt-1 text-amber-700">Blockers: {recommendation.blockers.join(' | ')}</div>
                )}
              </div>
            ))}
            {playbookRecommendations.length === 0 && (
              <div className="text-[11px] text-slate-500">No recommendations right now.</div>
            )}
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Collaboration Snapshot</h3>
          <div className="space-y-2 rounded border border-slate-200 dark:border-slate-700 p-2 text-[11px] text-slate-600 dark:text-slate-300">
            <div>Threads: {threads.length}</div>
            <div>Pending approvals: {pendingApprovals.length}</div>
            <div>Decision checkpoints: {decisionCheckpoints.length}</div>
            <div>Mention hints: {mentionHints || 'No teammates detected'}</div>
            <button
              onClick={() => setPanel('comms')}
              className="w-full mt-1 px-2 py-1 text-xs rounded bg-slate-800 text-white"
            >
              Open Comms Panel
            </button>
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
