import { NextFunction, Response, Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import { SafeExecutor } from '../utils/safeExecutor.js';
import { GroqService } from '../services/groq.service.js';
import { emitToDecisionRoom, emitToUser } from '../realtime.js';

const router = Router();

type RunMode = 'sql' | 'nl' | 'script_js' | 'sheet_op';

interface WorkspaceRequest extends AuthRequest {
  workspaceRole?: 'admin' | 'editor' | 'viewer';
}

interface RoomRunInput {
  roomId?: number;
  mode?: RunMode;
  datasetVersionId?: number;
  payload?: Record<string, any>;
  persistPolicy?: 'persist' | 'none';
}

interface DatasetResolution {
  rows: Record<string, any>[];
  columns: string[];
  datasetVersionId: number | null;
  sourceDatasetId: number | null;
}

type RoomStage = 'ingest' | 'profile' | 'analyze' | 'brief' | 'action' | 'done';

interface RoomGuideStep {
  id: string;
  stage: RoomStage;
  label: string;
  requiredArtifacts: string[];
  completed: boolean;
  completedAt: string | null;
  blockingIssues: string[];
}

interface NextBestStep {
  stepId: string;
  reason: string;
  blockingIssues: string[];
}

interface StatusDraft {
  summary: string;
  completedActions: Array<{ id: number; title: string; owner: string; dueDate: string | null }>;
  blockedActions: Array<{ id: number; title: string; owner: string; dueDate: string | null; reason: string | null }>;
  inProgressActions: Array<{ id: number; title: string; owner: string; dueDate: string | null }>;
  evidenceArtifactIds: number[];
  roomStage: RoomStage;
  generatedAt: string;
  metrics: {
    queryRuns: number;
    rowsAnalyzed: number;
    actionItems: number;
    completedActions: number;
    blockedActions: number;
  };
}

interface RoomRunContext {
  datasetId?: number | string;
  sourceDatasetId?: number | string;
  datasetVersionId?: number | string;
  mvpGuide?: {
    completedStepIds?: string[];
    stepCompletedAt?: Record<string, string>;
    lastActionSyncAt?: string;
  };
  [key: string]: any;
}

interface AnalyticsEventInput {
  workspaceId?: number | null;
  roomId?: number | null;
  userId: string;
  eventType: string;
  metadata?: Record<string, any>;
}

interface SlackConnection {
  id: number;
  name: string;
  credentials: Record<string, any>;
}

interface SlackDeliveryResult {
  posted: boolean;
  attempts: number;
  destination: string;
  messageTs?: string | null;
  error?: string;
}

interface MentionableUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  handle: string;
}

const ARTIFACT_TYPES = new Set([
  'dataset_version',
  'query_run',
  'chart',
  'pivot',
  'report_block',
  'decision_brief',
  'action_item'
]);

const ROOM_STAGES = new Set(['ingest', 'profile', 'analyze', 'brief', 'action', 'done']);
const RISK_LEVELS = new Set(['low', 'medium', 'high']);
const ROOM_STAGE_ORDER: RoomStage[] = ['ingest', 'profile', 'analyze', 'brief', 'action', 'done'];
const EVIDENCE_ARTIFACT_TYPES = ['dataset_version', 'query_run', 'chart', 'pivot', 'report_block', 'decision_brief'];
const GUIDED_ROOM_STEPS: Array<{ id: string; stage: RoomStage; label: string; requiredArtifacts: string[] }> = [
  { id: 'connect_data', stage: 'ingest', label: 'Connect data source', requiredArtifacts: [] },
  { id: 'analyze_data', stage: 'analyze', label: 'Run analysis', requiredArtifacts: ['query_run'] },
  { id: 'build_brief', stage: 'brief', label: 'Create decision brief', requiredArtifacts: ['decision_brief'] },
  { id: 'assign_actions', stage: 'action', label: 'Assign action items with evidence', requiredArtifacts: ['action_item'] },
  { id: 'sync_actions', stage: 'done', label: 'Sync actions and publish status', requiredArtifacts: ['action_item'] }
];

router.use(authenticateToken);
router.use(checkSubscription);
router.use('/:workspaceId', ensureWorkspaceAccess);

async function ensureWorkspaceAccess(req: WorkspaceRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = Number(req.params.workspaceId);
    if (!Number.isFinite(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }

    const access = await query(
      `
      SELECT
        w.id,
        w.user_id AS owner_id,
        CASE WHEN w.user_id = $2 THEN 'admin' ELSE COALESCE(wm.role, 'viewer') END AS role
      FROM workspaces w
      LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
      WHERE w.id = $1
        AND (w.user_id = $2 OR wm.user_id = $2)
      LIMIT 1
      `,
      [workspaceId, req.user!.id]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Workspace access denied' });
    }

    const role = String(access.rows[0].role || 'viewer') as 'admin' | 'editor' | 'viewer';
    req.workspaceRole = role;
    return next();
  } catch (err) {
    console.error('Workspace access validation failed:', err);
    return res.status(500).json({ error: 'Failed to validate workspace access' });
  }
}

function canWrite(role?: 'admin' | 'editor' | 'viewer') {
  return role === 'admin' || role === 'editor';
}

function parseJsonMaybe<T = any>(value: any, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      const first = JSON.parse(value);
      if (typeof first === 'string') {
        try {
          return JSON.parse(first) as T;
        } catch {
          return first as T;
        }
      }
      return first as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function normalizeRows(rawData: any, headersHint?: string[]): Record<string, any>[] {
  const parsed = parseJsonMaybe<any>(rawData, []);

  if (Array.isArray(parsed) && parsed.length === 0) return [];

  if (Array.isArray(parsed) && parsed.length > 0 && !Array.isArray(parsed[0]) && typeof parsed[0] === 'object') {
    return parsed as Record<string, any>[];
  }

  if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
    const matrix = parsed as any[][];
    const providedHeaders = (headersHint || []).filter(Boolean);
    const headers = providedHeaders.length > 0 ? providedHeaders : (matrix[0] as string[]).map((h) => String(h));
    const startIndex = providedHeaders.length > 0 ? 0 : 1;
    return matrix.slice(startIndex).map((row) => {
      const entry: Record<string, any> = {};
      headers.forEach((header, index) => {
        entry[header] = row[index];
      });
      return entry;
    });
  }

  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.data)) {
    return normalizeRows(parsed.data, headersHint);
  }

  return [];
}

function extractColumns(rows: Record<string, any>[]): string[] {
  if (!rows.length) return [];
  const keys = new Set<string>();
  rows.slice(0, 20).forEach((row) => {
    Object.keys(row || {}).forEach((k) => keys.add(k));
  });
  return Array.from(keys);
}

function normalizeCondition(condition: string): string {
  return condition
    .replace(/<>/g, '!=')
    .replace(/\bAND\b/gi, '&&')
    .replace(/\bOR\b/gi, '||')
    .replace(/([^<>!=])=([^=])/g, '$1==$2');
}

function executeSimpleSQL(sourceRows: Record<string, any>[], sqlQuery: string): Record<string, any>[] {
  if (!Array.isArray(sourceRows)) return [];
  const sql = String(sqlQuery || '').trim();
  if (!sql) return sourceRows;

  const lowerQuery = sql.toLowerCase();
  let rows = [...sourceRows];

  if (lowerQuery.includes('count(*)') || lowerQuery.includes('count(')) {
    return [{ count: rows.length }];
  }

  const whereMatch = sql.match(/where\s+(.+?)(?:order\s+by|limit|$)/i);
  if (whereMatch) {
    const condition = normalizeCondition(whereMatch[1].trim());
    rows = rows.filter((row) => {
      const result = SafeExecutor.execute(condition, { ...row }, 200);
      return result.success ? Boolean(result.result) : true;
    });
  }

  const orderMatch = sql.match(/order\s+by\s+([\w.]+)(?:\s+(asc|desc))?/i);
  if (orderMatch) {
    const orderColumn = orderMatch[1];
    const direction = (orderMatch[2] || 'asc').toLowerCase();
    rows = rows.sort((a, b) => {
      const aVal = a[orderColumn];
      const bVal = b[orderColumn];
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const selectMatch = sql.match(/select\s+(.+?)\s+from/i);
  if (selectMatch) {
    const rawCols = selectMatch[1].trim();
    if (rawCols !== '*' && rawCols.toLowerCase() !== 'all') {
      const columns = rawCols.split(',').map((c) => c.trim().replace(/^["`]|["`]$/g, '')).filter(Boolean);
      rows = rows.map((row) => {
        const selected: Record<string, any> = {};
        columns.forEach((c) => {
          selected[c] = row[c];
        });
        return selected;
      });
    }
  }

  const limitMatch = sql.match(/limit\s+(\d+)/i);
  if (limitMatch) {
    const limit = Number(limitMatch[1]);
    rows = rows.slice(0, Number.isFinite(limit) ? limit : rows.length);
  }

  return rows;
}

function applySheetOperation(sourceRows: Record<string, any>[], payload: Record<string, any>): Record<string, any>[] {
  const operation = String(payload.operation || '').toLowerCase();

  if (operation === 'filter') {
    const field = String(payload.field || '');
    const operator = String(payload.operator || 'eq').toLowerCase();
    const value = payload.value;
    if (!field) return sourceRows;
    return sourceRows.filter((row) => {
      const current = row[field];
      switch (operator) {
        case 'neq':
          return current !== value;
        case 'gt':
          return Number(current) > Number(value);
        case 'gte':
          return Number(current) >= Number(value);
        case 'lt':
          return Number(current) < Number(value);
        case 'lte':
          return Number(current) <= Number(value);
        case 'contains':
          return String(current ?? '').toLowerCase().includes(String(value ?? '').toLowerCase());
        case 'in':
          return Array.isArray(value) ? value.includes(current) : false;
        case 'eq':
        default:
          return current === value;
      }
    });
  }

  if (operation === 'sort') {
    const field = String(payload.field || '');
    const direction = String(payload.direction || 'asc').toLowerCase();
    if (!field) return sourceRows;
    return [...sourceRows].sort((a, b) => {
      if (a[field] < b[field]) return direction === 'asc' ? -1 : 1;
      if (a[field] > b[field]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  if (operation === 'limit') {
    const limit = Number(payload.limit ?? payload.count ?? 100);
    return sourceRows.slice(0, Number.isFinite(limit) ? limit : 100);
  }

  if (operation === 'select_columns') {
    const columns = Array.isArray(payload.columns) ? payload.columns.map((c) => String(c)) : [];
    if (!columns.length) return sourceRows;
    return sourceRows.map((row) => {
      const picked: Record<string, any> = {};
      columns.forEach((column) => {
        picked[column] = row[column];
      });
      return picked;
    });
  }

  return sourceRows;
}

async function resolveDatasetRows(
  workspaceId: number,
  datasetVersionId: number | undefined,
  payload: Record<string, any>
): Promise<DatasetResolution> {
  if (datasetVersionId) {
    try {
      const versionResult = await query(
        `
        SELECT dv.id, dv.dataset_id, dv.data, dv.headers
        FROM dataset_versions dv
        JOIN datasets d ON d.id = dv.dataset_id
        WHERE dv.id = $1 AND d.workspace_id = $2
        LIMIT 1
        `,
        [datasetVersionId, workspaceId]
      );

      if (versionResult.rows.length > 0) {
        const row = versionResult.rows[0];
        const headers = parseJsonMaybe<string[]>(row.headers, []);
        const rows = normalizeRows(row.data, headers);
        return {
          rows,
          columns: headers.length ? headers : extractColumns(rows),
          datasetVersionId: Number(row.id),
          sourceDatasetId: Number(row.dataset_id)
        };
      }
    } catch (err) {
      console.warn('Dataset version lookup failed, falling back to dataset source:', err);
    }
  }

  const sourceDatasetId = Number(payload.datasetId || payload.sourceDatasetId || 0);
  if (Number.isFinite(sourceDatasetId) && sourceDatasetId > 0) {
    const datasetResult = await query(
      `SELECT id, raw_data, headers FROM datasets WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [sourceDatasetId, workspaceId]
    );
    if (datasetResult.rows.length > 0) {
      const row = datasetResult.rows[0];
      const headers = parseJsonMaybe<string[]>(row.headers, []);
      const rows = normalizeRows(row.raw_data, headers);
      return {
        rows,
        columns: headers.length ? headers : extractColumns(rows),
        datasetVersionId: null,
        sourceDatasetId: Number(row.id)
      };
    }
  }

  const fallback = await query(
    `SELECT id, raw_data, headers FROM datasets WHERE workspace_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [workspaceId]
  );
  if (fallback.rows.length === 0) {
    return { rows: [], columns: [], datasetVersionId: null, sourceDatasetId: null };
  }

  const row = fallback.rows[0];
  const headers = parseJsonMaybe<string[]>(row.headers, []);
  const rows = normalizeRows(row.raw_data, headers);
  return {
    rows,
    columns: headers.length ? headers : extractColumns(rows),
    datasetVersionId: null,
    sourceDatasetId: Number(row.id)
  };
}

async function getRoom(workspaceId: number, roomId: number) {
  const result = await query(
    `SELECT * FROM analysis_rooms WHERE id = $1 AND workspace_id = $2 AND is_archived = false LIMIT 1`,
    [roomId, workspaceId]
  );
  return result.rows[0] || null;
}

function parseRoomRunContext(rawContext: any): RoomRunContext {
  const context = parseJsonMaybe<RoomRunContext>(rawContext, {});
  const mvpGuide = context.mvpGuide || {};
  return {
    ...context,
    mvpGuide: {
      completedStepIds: Array.isArray(mvpGuide.completedStepIds) ? mvpGuide.completedStepIds : [],
      stepCompletedAt: mvpGuide.stepCompletedAt && typeof mvpGuide.stepCompletedAt === 'object' ? mvpGuide.stepCompletedAt : {},
      lastActionSyncAt: typeof mvpGuide.lastActionSyncAt === 'string' ? mvpGuide.lastActionSyncAt : undefined
    }
  };
}

function getRoomStageIndex(stage?: string | null): number {
  const normalized = String(stage || 'ingest') as RoomStage;
  const index = ROOM_STAGE_ORDER.indexOf(normalized);
  return index >= 0 ? index : 0;
}

async function listRoomArtifacts(workspaceId: number, roomId: number, limit: number = 400) {
  const result = await query(
    `
    SELECT id, artifact_type, title, description, payload, metadata, created_at, updated_at
    FROM artifacts
    WHERE workspace_id = $1 AND room_id = $2
    ORDER BY created_at DESC
    LIMIT $3
    `,
    [workspaceId, roomId, limit]
  );

  return result.rows.map((artifact) => ({
    ...artifact,
    payload: parseJsonMaybe(artifact.payload, {}),
    metadata: parseJsonMaybe(artifact.metadata, {})
  }));
}

async function getActionEvidenceMap(workspaceId: number, roomId: number, actionArtifactIds: number[]) {
  const evidenceByAction = new Map<number, number>();
  const evidenceArtifactIds = new Set<number>();

  if (!actionArtifactIds.length) {
    return { evidenceByAction, evidenceArtifactIds: Array.from(evidenceArtifactIds) };
  }

  const evidenceRows = await query(
    `
    SELECT le.child_artifact_id, le.parent_artifact_id
    FROM lineage_edges le
    JOIN artifacts parent ON parent.id = le.parent_artifact_id
    WHERE le.workspace_id = $1
      AND le.room_id = $2
      AND le.child_artifact_id = ANY($3::int[])
      AND parent.artifact_type = ANY($4::text[])
    `,
    [workspaceId, roomId, actionArtifactIds, EVIDENCE_ARTIFACT_TYPES]
  );

  evidenceRows.rows.forEach((row) => {
    const childId = Number(row.child_artifact_id);
    const parentId = Number(row.parent_artifact_id);
    evidenceByAction.set(childId, (evidenceByAction.get(childId) || 0) + 1);
    evidenceArtifactIds.add(parentId);
  });

  return { evidenceByAction, evidenceArtifactIds: Array.from(evidenceArtifactIds) };
}

async function buildRoomGuide(workspaceId: number, room: any, artifacts: any[]) {
  const runContext = parseRoomRunContext(room.run_context);
  const completedStepIds = new Set(runContext.mvpGuide?.completedStepIds || []);
  const stepCompletedAt = runContext.mvpGuide?.stepCompletedAt || {};
  const artifactsByType = new Map<string, any[]>();
  const latestByType = new Map<string, string>();

  artifacts.forEach((artifact) => {
    const type = String(artifact.artifact_type);
    const bucket = artifactsByType.get(type) || [];
    bucket.push(artifact);
    artifactsByType.set(type, bucket);
    if (!latestByType.has(type)) {
      latestByType.set(type, artifact.created_at);
    }
  });

  const hasDataConnection = Boolean(
    runContext.datasetId ||
    runContext.sourceDatasetId ||
    runContext.datasetVersionId ||
    (artifactsByType.get('dataset_version') || []).length ||
    (artifactsByType.get('query_run') || []).length
  );

  const actionArtifacts = artifactsByType.get('action_item') || [];
  const actionArtifactIds = actionArtifacts.map((artifact) => Number(artifact.id));
  const { evidenceByAction } = await getActionEvidenceMap(workspaceId, Number(room.id), actionArtifactIds);
  const actionsMissingEvidence = actionArtifacts.filter((artifact) => (evidenceByAction.get(Number(artifact.id)) || 0) === 0);

  const stepReasonMap: Record<string, string> = {
    connect_data: 'Select and attach the data source context for this room.',
    analyze_data: 'Run at least one query and validate trends before briefing.',
    build_brief: 'Publish a decision brief tied to evidence artifacts.',
    assign_actions: 'Create action items with explicit evidence links and owners.',
    sync_actions: 'Sync actions to Slack and publish a status draft.'
  };

  const steps: RoomGuideStep[] = GUIDED_ROOM_STEPS.map((stepDef) => {
    const blockingIssues: string[] = [];
    let autoCompleted = false;
    let autoCompletedAt: string | null = null;

    if (stepDef.id === 'connect_data') {
      autoCompleted = hasDataConnection;
      autoCompletedAt = latestByType.get('dataset_version') || latestByType.get('query_run') || null;
      if (!autoCompleted) {
        blockingIssues.push('No dataset context selected. Add datasetId in room context or run first query.');
      }
    } else if (stepDef.id === 'analyze_data') {
      const hasAnalysis = (artifactsByType.get('query_run') || []).length > 0;
      autoCompleted = hasAnalysis;
      autoCompletedAt = latestByType.get('query_run') || null;
      if (!autoCompleted) {
        blockingIssues.push('Run at least one SQL/NL/sheet analysis to continue.');
      }
    } else if (stepDef.id === 'build_brief') {
      autoCompleted = (artifactsByType.get('decision_brief') || []).length > 0;
      autoCompletedAt = latestByType.get('decision_brief') || null;
      if (!autoCompleted) {
        blockingIssues.push('Generate a decision brief from room evidence.');
      }
    } else if (stepDef.id === 'assign_actions') {
      autoCompleted = actionArtifacts.length > 0 && actionsMissingEvidence.length === 0;
      autoCompletedAt = latestByType.get('action_item') || null;
      if (actionArtifacts.length === 0) {
        blockingIssues.push('Add at least one action item.');
      }
      if (actionsMissingEvidence.length > 0) {
        blockingIssues.push(`Action items missing evidence linkage: ${actionsMissingEvidence.map((a) => a.id).join(', ')}`);
      }
    } else if (stepDef.id === 'sync_actions') {
      autoCompleted = Boolean(runContext.mvpGuide?.lastActionSyncAt);
      autoCompletedAt = runContext.mvpGuide?.lastActionSyncAt || null;
      if (!autoCompleted) {
        blockingIssues.push('Sync action items and generate a status draft.');
      }
    }

    const completed = completedStepIds.has(stepDef.id) || autoCompleted;
    return {
      id: stepDef.id,
      stage: stepDef.stage,
      label: stepDef.label,
      requiredArtifacts: stepDef.requiredArtifacts,
      completed,
      completedAt: stepCompletedAt[stepDef.id] || autoCompletedAt || null,
      blockingIssues: completed ? [] : blockingIssues
    };
  });

  const next = steps.find((step) => !step.completed);
  const completionRatio = steps.length ? steps.filter((step) => step.completed).length / steps.length : 0;

  return {
    steps,
    nextBestStep: next
      ? {
          stepId: next.id,
          reason: stepReasonMap[next.id] || 'Complete this step to advance the room.',
          blockingIssues: next.blockingIssues
        }
      : null,
    completionRatio
  };
}

function normalizeMentionToken(token: string): string {
  return String(token || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

function extractMentionHandles(content: string): string[] {
  const matches = String(content || '').match(/@([a-zA-Z0-9._-]{2,64})/g) || [];
  const unique = new Set<string>();
  matches.forEach((raw) => {
    const normalized = normalizeMentionToken(raw);
    if (normalized) unique.add(normalized);
  });
  return Array.from(unique);
}

async function listMentionableWorkspaceUsers(workspaceId: number): Promise<MentionableUser[]> {
  const result = await query(
    `
    SELECT u.id, u.full_name, u.email, wm.role
    FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = $1
    UNION
    SELECT u.id, u.full_name, u.email, 'admin' AS role
    FROM workspaces w
    JOIN users u ON u.id = w.user_id
    WHERE w.id = $1
    `,
    [workspaceId]
  );

  const deduped = new Map<number, MentionableUser>();
  result.rows.forEach((row) => {
    const id = Number(row.id);
    const email = String(row.email || '');
    const emailLocal = email.split('@')[0] || `user${id}`;
    const fullName = String(row.full_name || '').trim() || emailLocal;
    const role = String(row.role || 'viewer');
    const existing = deduped.get(id);

    if (!existing || (existing.role !== 'admin' && role === 'admin')) {
      deduped.set(id, {
        id,
        fullName,
        email,
        role,
        handle: `@${emailLocal.toLowerCase()}`
      });
    }
  });

  return Array.from(deduped.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

async function resolveMentionUserIds(workspaceId: number, content: string): Promise<number[]> {
  const handles = extractMentionHandles(content);
  if (!handles.length) return [];

  const mentionableUsers = await listMentionableWorkspaceUsers(workspaceId);
  const handleToUserId = new Map<string, number>();

  mentionableUsers.forEach((user) => {
    const emailLocal = normalizeMentionToken(user.email.split('@')[0] || '');
    const fullNameRaw = String(user.fullName || '').toLowerCase();
    const compactName = normalizeMentionToken(fullNameRaw.replace(/\s+/g, ''));
    const nameTokens = fullNameRaw
      .split(/[^a-z0-9._-]+/g)
      .map(normalizeMentionToken)
      .filter(Boolean);

    [emailLocal, compactName, ...nameTokens]
      .filter(Boolean)
      .forEach((token) => {
        if (!handleToUserId.has(token)) {
          handleToUserId.set(token, user.id);
        }
      });
  });

  const mentionIds = new Set<number>();
  handles.forEach((handle) => {
    const mentionId = handleToUserId.get(handle);
    if (mentionId) mentionIds.add(mentionId);
  });

  return Array.from(mentionIds);
}

async function getRoomThread(workspaceId: number, roomId: number, threadId: number) {
  const result = await query(
    `
    SELECT id, workspace_id, room_id, artifact_id, anchor, created_by, created_at, updated_at
    FROM comment_threads
    WHERE id = $1 AND workspace_id = $2 AND room_id = $3
    LIMIT 1
    `,
    [threadId, workspaceId, roomId]
  );
  return result.rows[0] || null;
}

async function listRoomThreads(workspaceId: number, roomId: number) {
  const result = await query(
    `
    SELECT
      t.id,
      t.workspace_id,
      t.room_id,
      t.artifact_id,
      t.anchor,
      t.created_by,
      t.created_at,
      t.updated_at,
      a.title AS artifact_title,
      a.artifact_type,
      u.full_name AS created_by_name,
      u.email AS created_by_email,
      (
        SELECT COUNT(*)::int
        FROM comments c
        WHERE c.thread_id = t.id
      ) AS comment_count,
      (
        SELECT c.created_at
        FROM comments c
        WHERE c.thread_id = t.id
        ORDER BY c.created_at DESC
        LIMIT 1
      ) AS last_comment_at,
      (
        SELECT c.content
        FROM comments c
        WHERE c.thread_id = t.id
        ORDER BY c.created_at DESC
        LIMIT 1
      ) AS last_comment_content
    FROM comment_threads t
    LEFT JOIN artifacts a ON a.id = t.artifact_id
    LEFT JOIN users u ON u.id = t.created_by
    WHERE t.workspace_id = $1
      AND t.room_id = $2
    ORDER BY COALESCE(
      (
        SELECT c.created_at
        FROM comments c
        WHERE c.thread_id = t.id
        ORDER BY c.created_at DESC
        LIMIT 1
      ),
      t.created_at
    ) DESC
    LIMIT 200
    `,
    [workspaceId, roomId]
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    workspaceId: Number(row.workspace_id),
    roomId: Number(row.room_id),
    artifactId: row.artifact_id ? Number(row.artifact_id) : null,
    artifactTitle: row.artifact_title || null,
    artifactType: row.artifact_type || null,
    anchor: parseJsonMaybe(row.anchor, {}),
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdByName: row.created_by_name || row.created_by_email || `User ${row.created_by || ''}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commentCount: Number(row.comment_count || 0),
    lastCommentAt: row.last_comment_at || null,
    lastCommentContent: row.last_comment_content || null
  }));
}

async function listThreadComments(threadId: number) {
  const result = await query(
    `
    SELECT
      c.id,
      c.thread_id,
      c.user_id,
      c.content,
      c.mentions,
      c.created_at,
      c.updated_at,
      u.full_name,
      u.email
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.thread_id = $1
    ORDER BY c.created_at ASC
    LIMIT 500
    `,
    [threadId]
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    threadId: Number(row.thread_id),
    userId: Number(row.user_id),
    authorName: row.full_name || row.email || `User ${row.user_id}`,
    authorEmail: row.email || null,
    content: row.content || '',
    mentions: parseJsonMaybe<number[]>(row.mentions, []).map((id) => Number(id)).filter((id) => Number.isFinite(id)),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

async function listRoomPendingApprovals(workspaceId: number, roomId: number) {
  const result = await query(
    `
    SELECT
      ar.id,
      ar.room_id,
      ar.automation_run_id,
      ar.risk_level,
      ar.status,
      ar.reason,
      ar.created_at,
      ar.requested_by,
      requester.full_name AS requested_by_name,
      requester.email AS requested_by_email,
      run.status AS run_status,
      policy.action_type AS run_action_type,
      policy.name AS policy_name
    FROM approval_requests ar
    LEFT JOIN users requester ON requester.id = ar.requested_by
    LEFT JOIN automation_runs run ON run.id = ar.automation_run_id
    LEFT JOIN automation_policies policy ON policy.id = run.automation_policy_id
    WHERE ar.workspace_id = $1
      AND (ar.room_id = $2 OR ar.room_id IS NULL)
      AND ar.status = 'pending'
    ORDER BY ar.created_at DESC
    LIMIT 100
    `,
    [workspaceId, roomId]
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    roomId: row.room_id ? Number(row.room_id) : null,
    automationRunId: row.automation_run_id ? Number(row.automation_run_id) : null,
    riskLevel: String(row.risk_level || 'medium'),
    status: String(row.status || 'pending'),
    reason: row.reason || null,
    requestedBy: row.requested_by ? Number(row.requested_by) : null,
    requestedByName: row.requested_by_name || row.requested_by_email || 'Unknown',
    runStatus: row.run_status || null,
    runActionType: row.run_action_type || null,
    policyName: row.policy_name || null,
    createdAt: row.created_at
  }));
}

async function resolveUserDisplayName(userId: string | number): Promise<string> {
  const result = await query(
    `SELECT full_name, email FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return `User ${userId}`;
  const row = result.rows[0];
  return String(row.full_name || row.email || `User ${userId}`);
}

async function createMentionNotifications(params: {
  workspaceId: number;
  roomId: number;
  threadId: number;
  artifactTitle?: string | null;
  commentContent: string;
  mentionedUserIds: number[];
  actorUserId: string;
}) {
  const recipients = Array.from(new Set(params.mentionedUserIds.map((id) => Number(id))))
    .filter((id) => Number.isFinite(id))
    .filter((id) => String(id) !== String(params.actorUserId));

  if (!recipients.length) return;

  const actorName = await resolveUserDisplayName(params.actorUserId);
  const contextLabel = params.artifactTitle ? `artifact "${params.artifactTitle}"` : 'room discussion';
  const messagePreview = String(params.commentContent || '').replace(/\s+/g, ' ').trim();
  const clippedPreview = messagePreview.length > 140 ? `${messagePreview.slice(0, 137)}...` : messagePreview;

  for (const userId of recipients) {
    try {
      const insertResult = await query(
        `
        INSERT INTO notifications (user_id, workspace_id, title, message, type, is_read, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
        RETURNING *
        `,
        [
          userId,
          params.workspaceId,
          'Decision Room mention',
          `${actorName} mentioned you in ${contextLabel} (thread #${params.threadId}): ${clippedPreview}`,
          'mention'
        ]
      );

      const notification = insertResult.rows[0];
      emitToUser(userId, 'notification-created', {
        ...notification,
        roomId: params.roomId,
        threadId: params.threadId
      });
    } catch (err) {
      console.warn('Mention notification skipped:', err);
    }
  }
}

async function listRoomDecisionCheckpoints(workspaceId: number, roomId: number) {
  const result = await query(
    `
    SELECT
      dr.id,
      dr.workspace_id,
      dr.room_id,
      dr.artifact_id,
      dr.decision,
      dr.rationale,
      dr.status,
      dr.created_by,
      dr.decided_by,
      dr.decided_at,
      dr.created_at,
      dr.updated_at,
      creator.full_name AS created_by_name,
      creator.email AS created_by_email,
      decider.full_name AS decided_by_name,
      decider.email AS decided_by_email,
      a.title AS artifact_title,
      a.artifact_type
    FROM decision_records dr
    LEFT JOIN users creator ON creator.id = dr.created_by
    LEFT JOIN users decider ON decider.id = dr.decided_by
    LEFT JOIN artifacts a ON a.id = dr.artifact_id
    WHERE dr.workspace_id = $1
      AND dr.room_id = $2
    ORDER BY dr.created_at DESC
    LIMIT 200
    `,
    [workspaceId, roomId]
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    workspaceId: Number(row.workspace_id),
    roomId: Number(row.room_id),
    artifactId: row.artifact_id ? Number(row.artifact_id) : null,
    artifactTitle: row.artifact_title || null,
    artifactType: row.artifact_type || null,
    decision: String(row.decision || ''),
    rationale: row.rationale || null,
    status: String(row.status || 'pending'),
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdByName: row.created_by_name || row.created_by_email || 'Unknown',
    decidedBy: row.decided_by ? Number(row.decided_by) : null,
    decidedByName: row.decided_by_name || row.decided_by_email || null,
    decidedAt: row.decided_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

async function recordAnalyticsEvent(input: AnalyticsEventInput) {
  try {
    await query(
      `
      INSERT INTO analytics_events (workspace_id, room_id, user_id, event_type, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [
        input.workspaceId ?? null,
        input.roomId ?? null,
        input.userId,
        input.eventType,
        JSON.stringify(input.metadata || {})
      ]
    );
  } catch (err) {
    // Telemetry must not break product paths.
    console.warn('Analytics event capture skipped:', err);
  }
}

async function getSlackConnection(workspaceId: number, userId: string): Promise<SlackConnection | null> {
  const result = await query(
    `
    SELECT id, name, credentials
    FROM integrations
    WHERE workspace_id = $1
      AND provider = 'slack'
      AND status = 'active'
    ORDER BY CASE WHEN user_id = $2 THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1
    `,
    [workspaceId, userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: Number(row.id),
    name: String(row.name || 'Slack Workspace'),
    credentials: parseJsonMaybe<Record<string, any>>(row.credentials, {})
  };
}

function normalizeSlackCredentials(credentials: Record<string, any>) {
  return {
    webhookUrl: String(
      credentials?.webhookUrl ||
      credentials?.webhook_url ||
      credentials?.incomingWebhookUrl ||
      credentials?.url ||
      ''
    ).trim(),
    botToken: String(credentials?.botToken || credentials?.bot_token || credentials?.token || '').trim(),
    channel: String(credentials?.channel || credentials?.channelId || credentials?.channel_id || '#general').trim() || '#general'
  };
}

function buildSlackActionSyncPayload(params: {
  roomName: string;
  actionItems: Array<{ id: number; title: string; payload?: any }>;
  syncedCount: number;
  evidenceCount: number;
}) {
  const lines = params.actionItems.slice(0, 10).map((action) => {
    const owner = action.payload?.owner || action.payload?.assigneeName || 'Unassigned';
    const due = action.payload?.dueDate ? ` | due ${action.payload.dueDate}` : '';
    const status = action.payload?.status ? ` | ${action.payload.status}` : '';
    return `• ${action.title} — ${owner}${due}${status}`;
  });

  const summaryText = [
    `Decision Room "${params.roomName}" synced ${params.syncedCount} action item(s).`,
    `${params.evidenceCount} evidence artifact(s) linked.`,
    lines.length ? lines.join('\n') : 'No action details found.'
  ].join('\n');

  return {
    text: summaryText,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Decision Room Sync: ${params.roomName}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${params.syncedCount}* action item(s) synced\n*${params.evidenceCount}* evidence artifact(s) linked`
        }
      },
      ...(lines.length
        ? [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: lines.join('\n')
            }
          }]
        : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Synced at ${new Date().toISOString()}`
          }
        ]
      }
    ]
  };
}

async function postSlackWithRetry(params: {
  webhookUrl?: string;
  botToken?: string;
  channel: string;
  payload: { text: string; blocks: any[] };
}): Promise<SlackDeliveryResult> {
  const hasWebhook = Boolean(params.webhookUrl);
  const hasToken = Boolean(params.botToken);
  if (!hasWebhook && !hasToken) {
    return {
      posted: false,
      attempts: 0,
      destination: params.channel,
      error: 'Slack credentials missing webhookUrl or botToken.'
    };
  }

  const maxAttempts = 3;
  let lastError = 'Unknown Slack error';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (hasWebhook) {
        const response = await fetch(String(params.webhookUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params.payload)
        });
        if (!response.ok) {
          const details = await response.text().catch(() => '');
          throw new Error(`Slack webhook ${response.status}: ${details || response.statusText}`);
        }

        return {
          posted: true,
          attempts: attempt,
          destination: params.channel,
          messageTs: null
        };
      }

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.botToken}`
        },
        body: JSON.stringify({
          channel: params.channel,
          text: params.payload.text,
          blocks: params.payload.blocks
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(`Slack API error: ${data?.error || response.statusText || 'unknown_error'}`);
      }

      return {
        posted: true,
        attempts: attempt,
        destination: params.channel,
        messageTs: data?.ts || null
      };
    } catch (err: any) {
      lastError = err?.message || 'Slack delivery failed';
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  }

  return {
    posted: false,
    attempts: maxAttempts,
    destination: params.channel,
    error: lastError
  };
}

async function createArtifact(params: {
  workspaceId: number;
  projectId?: number | null;
  roomId: number;
  artifactType: string;
  title: string;
  description?: string | null;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
  datasetVersionId?: number | null;
  sourceDatasetId?: number | null;
  createdBy: string;
}) {
  const result = await query(
    `
    INSERT INTO artifacts (
      workspace_id,
      project_id,
      room_id,
      artifact_type,
      title,
      description,
      payload,
      metadata,
      dataset_version_id,
      source_dataset_id,
      created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
    `,
    [
      params.workspaceId,
      params.projectId ?? null,
      params.roomId,
      params.artifactType,
      params.title,
      params.description ?? null,
      JSON.stringify(params.payload || {}),
      JSON.stringify(params.metadata || {}),
      params.datasetVersionId ?? null,
      params.sourceDatasetId ?? null,
      params.createdBy
    ]
  );
  return result.rows[0];
}

router.post('/:workspaceId/projects', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const { name, description, objective } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = await query(
      `
      INSERT INTO projects (workspace_id, name, description, objective, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [workspaceId, name.trim(), description || null, objective || null, req.user!.id]
    );

    return res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error('Create project failed:', err);
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

router.get('/:workspaceId/projects', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const result = await query(
      `
      SELECT *
      FROM projects
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      `,
      [workspaceId]
    );
    return res.json({ data: result.rows });
  } catch (err) {
    console.error('List projects failed:', err);
    return res.status(500).json({ error: 'Failed to list projects' });
  }
});

router.post('/:workspaceId/projects/:projectId/rooms', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const projectId = Number(req.params.projectId);
    const { name, description, stage, runContext } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const projectCheck = await query(
      `SELECT id FROM projects WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [projectId, workspaceId]
    );
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const normalizedStage = ROOM_STAGES.has(String(stage)) ? String(stage) : 'ingest';
    const result = await query(
      `
      INSERT INTO analysis_rooms (workspace_id, project_id, name, description, stage, run_context, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [workspaceId, projectId, name.trim(), description || null, normalizedStage, JSON.stringify(runContext || {}), req.user!.id]
    );

    const room = result.rows[0];
    await recordAnalyticsEvent({
      workspaceId,
      roomId: Number(room.id),
      userId: req.user!.id,
      eventType: 'decision_room_flow_started',
      metadata: {
        projectId,
        stage: normalizedStage,
        hasDatasetContext: Boolean(runContext?.datasetId || runContext?.datasetVersionId)
      }
    });

    return res.status(201).json({ data: room });
  } catch (err) {
    console.error('Create room failed:', err);
    return res.status(500).json({ error: 'Failed to create analysis room' });
  }
});

router.get('/:workspaceId/projects/:projectId/rooms', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const projectId = Number(req.params.projectId);
    const result = await query(
      `
      SELECT *
      FROM analysis_rooms
      WHERE workspace_id = $1 AND project_id = $2 AND is_archived = false
      ORDER BY updated_at DESC, created_at DESC
      `,
      [workspaceId, projectId]
    );
    return res.json({ data: result.rows });
  } catch (err) {
    console.error('List rooms failed:', err);
    return res.status(500).json({ error: 'Failed to list rooms' });
  }
});

router.get('/:workspaceId/rooms/:roomId/state', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);

    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const [projectResult, artifactsResult, automationsResult, approvalsResult] = await Promise.all([
      query(`SELECT * FROM projects WHERE id = $1 LIMIT 1`, [room.project_id]),
      query(
        `
        SELECT *
        FROM artifacts
        WHERE workspace_id = $1 AND room_id = $2
        ORDER BY created_at DESC
        LIMIT 200
        `,
        [workspaceId, roomId]
      ),
      query(
        `
        SELECT id, name, risk_level, trigger_type, action_type, is_active, updated_at
        FROM automation_policies
        WHERE workspace_id = $1 AND (room_id = $2 OR room_id IS NULL) AND is_active = true
        ORDER BY updated_at DESC
        `,
        [workspaceId, roomId]
      ),
      query(
        `
        SELECT COUNT(*)::int AS pending
        FROM approval_requests
        WHERE workspace_id = $1 AND (room_id = $2 OR room_id IS NULL) AND status = 'pending'
        `,
        [workspaceId, roomId]
      )
    ]);

    const artifacts = artifactsResult.rows.map((artifact) => ({
      ...artifact,
      payload: parseJsonMaybe(artifact.payload, {}),
      metadata: parseJsonMaybe(artifact.metadata, {})
    }));

    return res.json({
      room: {
        ...room,
        run_context: parseJsonMaybe(room.run_context, {})
      },
      project: projectResult.rows[0] || null,
      artifacts,
      automations: automationsResult.rows,
      pendingApprovals: approvalsResult.rows[0]?.pending || 0
    });
  } catch (err) {
    console.error('Fetch room state failed:', err);
    return res.status(500).json({ error: 'Failed to fetch room state' });
  }
});

router.get('/:workspaceId/rooms/:roomId/threads', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);

    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const [threads, mentionableUsers] = await Promise.all([
      listRoomThreads(workspaceId, roomId),
      listMentionableWorkspaceUsers(workspaceId)
    ]);

    return res.json({
      roomId,
      threads,
      mentionableUsers
    });
  } catch (err) {
    console.error('List room threads failed:', err);
    return res.status(500).json({ error: 'Failed to load room threads' });
  }
});

router.post('/:workspaceId/rooms/:roomId/threads', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const artifactIdRaw = req.body?.artifactId;
    const artifactId = artifactIdRaw === null || artifactIdRaw === undefined || artifactIdRaw === ''
      ? null
      : Number(artifactIdRaw);
    const anchor = req.body?.anchor && typeof req.body.anchor === 'object' ? req.body.anchor : {};
    const content = String(req.body?.content || '').trim();

    if (!content) {
      return res.status(400).json({ error: 'content is required to create a thread' });
    }

    if (artifactId !== null) {
      if (!Number.isFinite(artifactId) || artifactId <= 0) {
        return res.status(400).json({ error: 'artifactId must be a positive number' });
      }

      const artifactResult = await query(
        `
        SELECT id
        FROM artifacts
        WHERE id = $1 AND workspace_id = $2 AND room_id = $3
        LIMIT 1
        `,
        [artifactId, workspaceId, roomId]
      );
      if (artifactResult.rows.length === 0) {
        return res.status(404).json({ error: 'Referenced artifact not found in room' });
      }
    }

    const threadResult = await query(
      `
      INSERT INTO comment_threads (workspace_id, room_id, artifact_id, anchor, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, workspace_id, room_id, artifact_id, anchor, created_by, created_at, updated_at
      `,
      [workspaceId, roomId, artifactId, JSON.stringify(anchor), req.user!.id]
    );
    const thread = threadResult.rows[0];

    const mentionIds = await resolveMentionUserIds(workspaceId, content);
    const commentResult = await query(
      `
      INSERT INTO comments (thread_id, user_id, content, mentions)
      VALUES ($1, $2, $3, $4)
      RETURNING id, thread_id, user_id, content, mentions, created_at, updated_at
      `,
      [thread.id, req.user!.id, content, JSON.stringify(mentionIds)]
    );

    await query(
      `
      UPDATE comment_threads
      SET updated_at = NOW()
      WHERE id = $1
      `,
      [thread.id]
    );

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_thread_created',
      metadata: {
        threadId: Number(thread.id),
        artifactId: artifactId || null,
        mentionCount: mentionIds.length
      }
    });

    const [threadList, comments] = await Promise.all([
      listRoomThreads(workspaceId, roomId),
      listThreadComments(Number(thread.id))
    ]);
    const fullThread = threadList.find((entry) => entry.id === Number(thread.id)) || threadList[0] || {
      id: Number(thread.id),
      workspaceId,
      roomId,
      artifactId,
      artifactTitle: null,
      artifactType: null,
      anchor: parseJsonMaybe(thread.anchor, {}),
      createdBy: Number(thread.created_by),
      createdByName: 'Unknown',
      createdAt: thread.created_at,
      updatedAt: thread.updated_at,
      commentCount: 1,
      lastCommentAt: commentResult.rows[0]?.created_at || thread.created_at,
      lastCommentContent: content
    };

    await createMentionNotifications({
      workspaceId,
      roomId,
      threadId: Number(thread.id),
      artifactTitle: fullThread.artifactTitle,
      commentContent: content,
      mentionedUserIds: mentionIds,
      actorUserId: req.user!.id
    });

    emitToDecisionRoom(workspaceId, roomId, 'decision-room:thread-created', {
      roomId,
      thread: fullThread,
      comments
    });

    return res.status(201).json({
      thread: fullThread,
      comments
    });
  } catch (err) {
    console.error('Create room thread failed:', err);
    return res.status(500).json({ error: 'Failed to create room thread' });
  }
});

router.get('/:workspaceId/rooms/:roomId/threads/:threadId/comments', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const threadId = Number(req.params.threadId);

    const thread = await getRoomThread(workspaceId, roomId, threadId);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const comments = await listThreadComments(threadId);
    return res.json({
      threadId,
      comments
    });
  } catch (err) {
    console.error('List thread comments failed:', err);
    return res.status(500).json({ error: 'Failed to load thread comments' });
  }
});

router.post('/:workspaceId/rooms/:roomId/threads/:threadId/comments', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const threadId = Number(req.params.threadId);
    const content = String(req.body?.content || '').trim();
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const thread = await getRoomThread(workspaceId, roomId, threadId);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const mentionIds = await resolveMentionUserIds(workspaceId, content);
    const commentResult = await query(
      `
      INSERT INTO comments (thread_id, user_id, content, mentions)
      VALUES ($1, $2, $3, $4)
      RETURNING id, thread_id, user_id, content, mentions, created_at, updated_at
      `,
      [threadId, req.user!.id, content, JSON.stringify(mentionIds)]
    );

    await query(
      `
      UPDATE comment_threads
      SET updated_at = NOW()
      WHERE id = $1
      `,
      [threadId]
    );

    const commentRow = commentResult.rows[0];
    const authorResult = await query(
      `SELECT full_name, email FROM users WHERE id = $1 LIMIT 1`,
      [req.user!.id]
    );
    const author = authorResult.rows[0] || {};

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_comment_added',
      metadata: {
        threadId,
        commentId: Number(commentRow.id),
        mentionCount: mentionIds.length
      }
    });

    const threadList = await listRoomThreads(workspaceId, roomId);
    const threadSummary = threadList.find((entry) => entry.id === threadId) || null;

    await createMentionNotifications({
      workspaceId,
      roomId,
      threadId,
      artifactTitle: threadSummary?.artifactTitle || null,
      commentContent: commentRow.content,
      mentionedUserIds: mentionIds,
      actorUserId: req.user!.id
    });

    emitToDecisionRoom(workspaceId, roomId, 'decision-room:comment-added', {
      roomId,
      threadId,
      comment: {
        id: Number(commentRow.id),
        threadId: Number(commentRow.thread_id),
        userId: Number(commentRow.user_id),
        authorName: author.full_name || author.email || `User ${commentRow.user_id}`,
        authorEmail: author.email || null,
        content: commentRow.content,
        mentions: parseJsonMaybe<number[]>(commentRow.mentions, []).map((id) => Number(id)).filter((id) => Number.isFinite(id)),
        createdAt: commentRow.created_at,
        updatedAt: commentRow.updated_at
      }
    });

    return res.status(201).json({
      comment: {
        id: Number(commentRow.id),
        threadId: Number(commentRow.thread_id),
        userId: Number(commentRow.user_id),
        authorName: author.full_name || author.email || `User ${commentRow.user_id}`,
        authorEmail: author.email || null,
        content: commentRow.content,
        mentions: parseJsonMaybe<number[]>(commentRow.mentions, []).map((id) => Number(id)).filter((id) => Number.isFinite(id)),
        createdAt: commentRow.created_at,
        updatedAt: commentRow.updated_at
      }
    });
  } catch (err) {
    console.error('Create thread comment failed:', err);
    return res.status(500).json({ error: 'Failed to create thread comment' });
  }
});

router.get('/:workspaceId/rooms/:roomId/approvals', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);

    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const approvals = await listRoomPendingApprovals(workspaceId, roomId);
    return res.json({
      roomId,
      approvals
    });
  } catch (err) {
    console.error('List room approvals failed:', err);
    return res.status(500).json({ error: 'Failed to load room approvals' });
  }
});

router.get('/:workspaceId/rooms/:roomId/decision-checkpoints', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);

    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const checkpoints = await listRoomDecisionCheckpoints(workspaceId, roomId);
    return res.json({
      roomId,
      checkpoints
    });
  } catch (err) {
    console.error('List decision checkpoints failed:', err);
    return res.status(500).json({ error: 'Failed to load decision checkpoints' });
  }
});

router.post('/:workspaceId/rooms/:roomId/decision-checkpoints', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const decision = String(req.body?.decision || '').trim();
    if (!decision) {
      return res.status(400).json({ error: 'decision is required' });
    }

    const rationale = req.body?.rationale ? String(req.body.rationale).trim() : null;
    const artifactIdRaw = req.body?.artifactId;
    const artifactId = artifactIdRaw === null || artifactIdRaw === undefined || artifactIdRaw === ''
      ? null
      : Number(artifactIdRaw);

    if (artifactId !== null) {
      if (!Number.isFinite(artifactId) || artifactId <= 0) {
        return res.status(400).json({ error: 'artifactId must be a positive number' });
      }

      const artifactResult = await query(
        `SELECT id FROM artifacts WHERE id = $1 AND workspace_id = $2 AND room_id = $3 LIMIT 1`,
        [artifactId, workspaceId, roomId]
      );
      if (artifactResult.rows.length === 0) {
        return res.status(404).json({ error: 'Referenced artifact not found in room' });
      }
    }

    const insertResult = await query(
      `
      INSERT INTO decision_records (workspace_id, room_id, artifact_id, decision, rationale, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW(), NOW())
      RETURNING id
      `,
      [workspaceId, roomId, artifactId, decision, rationale, req.user!.id]
    );

    const checkpointId = Number(insertResult.rows[0].id);
    const checkpoints = await listRoomDecisionCheckpoints(workspaceId, roomId);
    const checkpoint = checkpoints.find((entry) => entry.id === checkpointId) || null;

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_checkpoint_created',
      metadata: {
        checkpointId,
        artifactId: artifactId || null
      }
    });

    emitToDecisionRoom(workspaceId, roomId, 'decision-room:checkpoint-created', {
      roomId,
      checkpoint
    });

    return res.status(201).json({
      checkpoint
    });
  } catch (err) {
    console.error('Create decision checkpoint failed:', err);
    return res.status(500).json({ error: 'Failed to create decision checkpoint' });
  }
});

router.post('/:workspaceId/rooms/:roomId/decision-checkpoints/:checkpointId/respond', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const checkpointId = Number(req.params.checkpointId);
    const decisionRaw = String(req.body?.decision || req.body?.status || '').toLowerCase();
    const nextStatus = decisionRaw === 'approved' ? 'approved' : decisionRaw === 'rejected' ? 'rejected' : null;

    if (!nextStatus) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const existingResult = await query(
      `
      SELECT id, status, created_by, decision
      FROM decision_records
      WHERE id = $1 AND workspace_id = $2 AND room_id = $3
      LIMIT 1
      `,
      [checkpointId, workspaceId, roomId]
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Decision checkpoint not found' });
    }

    const existing = existingResult.rows[0];
    if (String(existing.status) !== 'pending') {
      return res.status(400).json({ error: `Decision checkpoint is already ${existing.status}` });
    }

    const responseNote = req.body?.note ? String(req.body.note).trim() : '';
    const updatedRationale = responseNote
      ? `${existing.decision}\n\nReviewer note (${nextStatus}): ${responseNote}`
      : null;

    await query(
      `
      UPDATE decision_records
      SET status = $1,
          rationale = COALESCE($2, rationale),
          decided_by = $3,
          decided_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
      `,
      [nextStatus, updatedRationale, req.user!.id, checkpointId]
    );

    const checkpoints = await listRoomDecisionCheckpoints(workspaceId, roomId);
    const checkpoint = checkpoints.find((entry) => entry.id === checkpointId) || null;

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_checkpoint_responded',
      metadata: {
        checkpointId,
        status: nextStatus
      }
    });

    emitToDecisionRoom(workspaceId, roomId, 'decision-room:checkpoint-updated', {
      roomId,
      checkpoint
    });

    const creatorId = Number(existing.created_by || 0);
    if (creatorId > 0 && String(creatorId) !== String(req.user!.id)) {
      try {
        const reviewerName = await resolveUserDisplayName(req.user!.id);
        const notificationInsert = await query(
          `
          INSERT INTO notifications (user_id, workspace_id, title, message, type, is_read, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
          RETURNING *
          `,
          [
            creatorId,
            workspaceId,
            'Decision checkpoint updated',
            `${reviewerName} ${nextStatus} your decision checkpoint in room "${room.name}".`,
            'decision'
          ]
        );
        emitToUser(creatorId, 'notification-created', {
          ...notificationInsert.rows[0],
          roomId,
          checkpointId
        });
      } catch (notifyError) {
        console.warn('Decision checkpoint notification skipped:', notifyError);
      }
    }

    return res.json({
      checkpoint
    });
  } catch (err) {
    console.error('Respond decision checkpoint failed:', err);
    return res.status(500).json({ error: 'Failed to respond decision checkpoint' });
  }
});

router.get('/:workspaceId/rooms/:roomId/guide', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);

    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const artifacts = await listRoomArtifacts(workspaceId, roomId, 500);
    const guide = await buildRoomGuide(workspaceId, room, artifacts);

    return res.json({
      roomId,
      roomStage: room.stage,
      completionRatio: guide.completionRatio,
      steps: guide.steps,
      nextBestStep: guide.nextBestStep
    });
  } catch (err) {
    console.error('Fetch room guide failed:', err);
    return res.status(500).json({ error: 'Failed to fetch room guide' });
  }
});

router.post('/:workspaceId/rooms/:roomId/guide/complete-step', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const stepId = String(req.body?.stepId || '').trim();
    if (!stepId) {
      return res.status(400).json({ error: 'stepId is required' });
    }

    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const artifacts = await listRoomArtifacts(workspaceId, roomId, 500);
    const guide = await buildRoomGuide(workspaceId, room, artifacts);
    const step = guide.steps.find((entry) => entry.id === stepId);
    if (!step) {
      return res.status(404).json({ error: `Guide step "${stepId}" not found` });
    }

    if (step.blockingIssues.length > 0) {
      return res.status(400).json({
        error: `Cannot complete "${step.label}" until blockers are resolved.`,
        blockingIssues: step.blockingIssues
      });
    }

    const nowIso = new Date().toISOString();
    const currentContext = parseRoomRunContext(room.run_context);
    const completedStepIds = new Set(currentContext.mvpGuide?.completedStepIds || []);
    completedStepIds.add(stepId);

    const stepCompletedAt: Record<string, string> = {
      ...(currentContext.mvpGuide?.stepCompletedAt || {}),
      [stepId]: nowIso
    };

    const nextContext: RoomRunContext = {
      ...currentContext,
      mvpGuide: {
        ...(currentContext.mvpGuide || {}),
        completedStepIds: Array.from(completedStepIds),
        stepCompletedAt,
        lastActionSyncAt:
          stepId === 'sync_actions'
            ? nowIso
            : currentContext.mvpGuide?.lastActionSyncAt
      }
    };

    const targetStageIndex = getRoomStageIndex(step.stage);
    const currentStageIndex = getRoomStageIndex(room.stage);
    const nextStage = targetStageIndex > currentStageIndex ? step.stage : (String(room.stage) as RoomStage);

    await query(
      `
      UPDATE analysis_rooms
      SET run_context = $1,
          stage = $2,
          updated_at = NOW()
      WHERE id = $3 AND workspace_id = $4
      `,
      [JSON.stringify(nextContext), nextStage, roomId, workspaceId]
    );

    const updatedRoom = await getRoom(workspaceId, roomId);
    const updatedArtifacts = await listRoomArtifacts(workspaceId, roomId, 500);
    const updatedGuide = await buildRoomGuide(workspaceId, updatedRoom, updatedArtifacts);

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_guide_step_completed',
      metadata: {
        stepId,
        roomStage: updatedRoom.stage,
        completionRatio: updatedGuide.completionRatio
      }
    });

    return res.json({
      roomId,
      roomStage: updatedRoom.stage,
      completionRatio: updatedGuide.completionRatio,
      steps: updatedGuide.steps,
      nextBestStep: updatedGuide.nextBestStep
    });
  } catch (err) {
    console.error('Complete room guide step failed:', err);
    return res.status(500).json({ error: 'Failed to complete room guide step' });
  }
});

router.post('/:workspaceId/rooms/:roomId/status/draft', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const artifacts = await listRoomArtifacts(workspaceId, roomId, 500);
    const queryRuns = artifacts.filter((artifact) => artifact.artifact_type === 'query_run');
    const actionItems = artifacts.filter((artifact) => artifact.artifact_type === 'action_item');
    const latestBrief = artifacts.find((artifact) => artifact.artifact_type === 'decision_brief') || null;

    const completedActions = actionItems
      .filter((artifact) => ['done', 'completed', 'closed'].includes(String(artifact.payload?.status || '').toLowerCase()))
      .map((artifact) => ({
        id: Number(artifact.id),
        title: String(artifact.title),
        owner: String(artifact.payload?.owner || artifact.payload?.assigneeName || artifact.payload?.assigneeId || 'Unassigned'),
        dueDate: artifact.payload?.dueDate ? String(artifact.payload.dueDate) : null
      }));

    const blockedActions = actionItems
      .filter((artifact) => ['blocked', 'at_risk', 'needs_input'].includes(String(artifact.payload?.status || '').toLowerCase()))
      .map((artifact) => ({
        id: Number(artifact.id),
        title: String(artifact.title),
        owner: String(artifact.payload?.owner || artifact.payload?.assigneeName || artifact.payload?.assigneeId || 'Unassigned'),
        dueDate: artifact.payload?.dueDate ? String(artifact.payload.dueDate) : null,
        reason: artifact.payload?.blocker || artifact.payload?.reason || null
      }));

    const inProgressActions = actionItems
      .filter((artifact) => {
        const status = String(artifact.payload?.status || '').toLowerCase();
        return !['done', 'completed', 'closed', 'blocked', 'at_risk', 'needs_input'].includes(status);
      })
      .map((artifact) => ({
        id: Number(artifact.id),
        title: String(artifact.title),
        owner: String(artifact.payload?.owner || artifact.payload?.assigneeName || artifact.payload?.assigneeId || 'Unassigned'),
        dueDate: artifact.payload?.dueDate ? String(artifact.payload.dueDate) : null
      }));

    const { evidenceArtifactIds } = await getActionEvidenceMap(
      workspaceId,
      roomId,
      actionItems.map((artifact) => Number(artifact.id))
    );

    const rowsAnalyzed = queryRuns.reduce((acc, artifact) => acc + Number(artifact.payload?.rowCount || 0), 0);
    const summary = [
      `Room "${room.name}" is in ${room.stage} stage.`,
      `${queryRuns.length} analysis run(s) processed ${rowsAnalyzed} row(s).`,
      `${actionItems.length} action item(s): ${completedActions.length} completed, ${inProgressActions.length} in progress, ${blockedActions.length} blocked.`,
      latestBrief ? `Latest brief: ${latestBrief.title}.` : 'Decision brief is still missing.',
      evidenceArtifactIds.length > 0
        ? `${evidenceArtifactIds.length} evidence artifact(s) are linked to actions.`
        : 'No evidence linked to action items yet.'
    ].join(' ');

    const statusDraft: StatusDraft = {
      summary,
      completedActions,
      blockedActions,
      inProgressActions,
      evidenceArtifactIds,
      roomStage: String(room.stage || 'ingest') as RoomStage,
      generatedAt: new Date().toISOString(),
      metrics: {
        queryRuns: queryRuns.length,
        rowsAnalyzed,
        actionItems: actionItems.length,
        completedActions: completedActions.length,
        blockedActions: blockedActions.length
      }
    };

    const persist = Boolean(req.body?.persist);
    let artifact = null;
    if (persist) {
      artifact = await createArtifact({
        workspaceId,
        projectId: room.project_id,
        roomId,
        artifactType: 'report_block',
        title: `Weekly Status Draft - ${new Date().toLocaleDateString()}`,
        description: 'Auto-generated room status draft.',
        payload: statusDraft as unknown as Record<string, any>,
        metadata: { generatedBy: 'status_draft_endpoint' },
        createdBy: req.user!.id
      });
    }

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_status_draft_generated',
      metadata: {
        persisted: persist,
        artifactId: artifact ? Number(artifact.id) : null,
        actionItems: actionItems.length,
        completedActions: completedActions.length,
        blockedActions: blockedActions.length,
        evidenceCoverageRatio: actionItems.length
          ? evidenceArtifactIds.length / actionItems.length
          : 0
      }
    });

    return res.json({
      draft: statusDraft,
      artifact: artifact
        ? {
            ...artifact,
            payload: parseJsonMaybe(artifact.payload, {}),
            metadata: parseJsonMaybe(artifact.metadata, {})
          }
        : null
    });
  } catch (err) {
    console.error('Generate status draft failed:', err);
    return res.status(500).json({ error: 'Failed to generate status draft' });
  }
});

router.post('/:workspaceId/rooms/:roomId/run', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const body = (req.body || {}) as RoomRunInput;
    const mode = (body.mode || 'sql') as RunMode;
    if (!['sql', 'nl', 'script_js', 'sheet_op'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid run mode' });
    }

    const payload = body.payload || {};
    const persistPolicy = body.persistPolicy === 'none' ? 'none' : 'persist';
    const startedAt = Date.now();

    const source = await resolveDatasetRows(workspaceId, body.datasetVersionId, payload);
    const sourceRows = source.rows;

    let rows: Record<string, any>[] = [];
    let generatedSql: string | undefined;
    let explanation: string | undefined;

    if (mode === 'sql') {
      const sql = String(payload.sql || payload.query_text || payload.queryText || '').trim();
      if (!sql) {
        return res.status(400).json({ error: 'SQL payload is required for sql mode' });
      }
      rows = executeSimpleSQL(sourceRows, sql);
      generatedSql = sql;
    } else if (mode === 'nl') {
      const prompt = String(payload.prompt || payload.question || payload.query || '').trim();
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required for nl mode' });
      }

      try {
        const generated = await GroqService.generateSQL(
          {
            data: sourceRows.slice(0, 500),
            headers: source.columns
          },
          prompt
        );
        generatedSql = generated.sql;
        explanation = generated.explanation || `Generated SQL from natural language prompt: "${prompt}"`;
        rows = executeSimpleSQL(sourceRows, generated.sql);
      } catch (err) {
        console.warn('NL mode SQL generation failed, returning source sample:', err);
        explanation = `Could not translate prompt with AI, returned source rows for manual review. Prompt: "${prompt}"`;
        rows = sourceRows.slice(0, 200);
      }
    } else if (mode === 'script_js') {
      const script = String(payload.script || payload.code || '').trim();
      if (!script) {
        return res.status(400).json({ error: 'Script payload is required for script_js mode' });
      }

      const wrappedScript = `(function () { const data = inputRows; ${script} })()`;
      const execution = SafeExecutor.execute(wrappedScript, { inputRows: sourceRows }, 2000);
      if (!execution.success) {
        return res.status(400).json({ error: `Script execution failed: ${execution.error}` });
      }

      if (Array.isArray(execution.result)) {
        rows = execution.result as Record<string, any>[];
      } else if (execution.result && typeof execution.result === 'object' && Array.isArray((execution.result as any).rows)) {
        rows = (execution.result as any).rows;
      } else {
        rows = [{ value: execution.result }];
      }
    } else if (mode === 'sheet_op') {
      rows = applySheetOperation(sourceRows, payload);
    }

    const executionMs = Date.now() - startedAt;
    const columns = extractColumns(rows);
    const runId = `run_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    let artifactId: number | null = null;
    const lineage: Array<{
      id: number;
      parent_artifact_id: number;
      child_artifact_id: number;
      relation_type: string;
    }> = [];

    if (persistPolicy !== 'none') {
      const runArtifact = await createArtifact({
        workspaceId,
        projectId: room.project_id,
        roomId,
        artifactType: 'query_run',
        title: `${mode.toUpperCase()} Run ${new Date().toISOString()}`,
        description: explanation || null,
        payload: {
          mode,
          input: payload,
          generatedSql,
          previewRows: rows.slice(0, 200),
          rowCount: rows.length,
          columns,
          executionMs
        },
        metadata: {
          runId,
          persistPolicy
        },
        datasetVersionId: source.datasetVersionId,
        sourceDatasetId: source.sourceDatasetId,
        createdBy: req.user!.id
      });
      artifactId = Number(runArtifact.id);

      if (source.datasetVersionId) {
        let datasetArtifact = await query(
          `
          SELECT id
          FROM artifacts
          WHERE workspace_id = $1
            AND room_id = $2
            AND artifact_type = 'dataset_version'
            AND dataset_version_id = $3
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [workspaceId, roomId, source.datasetVersionId]
        );

        if (datasetArtifact.rows.length === 0) {
          const createdDatasetArtifact = await createArtifact({
            workspaceId,
            projectId: room.project_id,
            roomId,
            artifactType: 'dataset_version',
            title: `Dataset Version ${source.datasetVersionId}`,
            payload: {
              datasetVersionId: source.datasetVersionId,
              sourceDatasetId: source.sourceDatasetId
            },
            metadata: {},
            datasetVersionId: source.datasetVersionId,
            sourceDatasetId: source.sourceDatasetId,
            createdBy: req.user!.id
          });
          datasetArtifact = { rows: [{ id: createdDatasetArtifact.id }] } as any;
        }

        const edgeResult = await query(
          `
          INSERT INTO lineage_edges (
            workspace_id,
            room_id,
            parent_artifact_id,
            child_artifact_id,
            relation_type,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (parent_artifact_id, child_artifact_id, relation_type) DO NOTHING
          RETURNING id, parent_artifact_id, child_artifact_id, relation_type
          `,
          [workspaceId, roomId, datasetArtifact.rows[0].id, artifactId, 'derived_from', req.user!.id]
        );
        lineage.push(...edgeResult.rows);
      }
    }

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_run_completed',
      metadata: {
        mode,
        executionMs,
        rowCount: rows.length,
        persisted: persistPolicy !== 'none',
        artifactId
      }
    });

    if (persistPolicy !== 'none') {
      const runCountResult = await query(
        `
        SELECT COUNT(*)::int AS count
        FROM artifacts
        WHERE workspace_id = $1
          AND room_id = $2
          AND artifact_type = 'query_run'
        `,
        [workspaceId, roomId]
      );

      const runCount = Number(runCountResult.rows[0]?.count || 0);
      if (runCount === 1) {
        const firstInsightDelayMinutes = Math.max(
          0,
          (Date.now() - new Date(room.created_at).getTime()) / (1000 * 60)
        );

        await recordAnalyticsEvent({
          workspaceId,
          roomId,
          userId: req.user!.id,
          eventType: 'decision_room_first_insight',
          metadata: {
            mode,
            artifactId,
            minutesFromRoomStart: Number(firstInsightDelayMinutes.toFixed(2))
          }
        });
      }
    }

    return res.status(201).json({
      runId,
      rows,
      columns,
      executionMs,
      generatedSql,
      explanation,
      artifactId,
      lineage
    });
  } catch (err) {
    console.error('Room run failed:', err);
    return res.status(500).json({ error: 'Failed to execute room run' });
  }
});

router.post('/:workspaceId/rooms/:roomId/artifacts', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const {
      artifactType,
      title,
      description,
      payload,
      metadata,
      parentArtifactIds = [],
      datasetVersionId,
      sourceDatasetId
    } = req.body || {};

    if (!ARTIFACT_TYPES.has(String(artifactType))) {
      return res.status(400).json({ error: 'Invalid artifact type' });
    }

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Artifact title is required' });
    }

    const artifact = await createArtifact({
      workspaceId,
      projectId: room.project_id,
      roomId,
      artifactType: String(artifactType),
      title: title.trim(),
      description: description || null,
      payload: payload || {},
      metadata: metadata || {},
      datasetVersionId: datasetVersionId ?? null,
      sourceDatasetId: sourceDatasetId ?? null,
      createdBy: req.user!.id
    });

    const lineageEdges = [];
    if (Array.isArray(parentArtifactIds)) {
      for (const parentIdRaw of parentArtifactIds) {
        const parentId = Number(parentIdRaw);
        if (!Number.isFinite(parentId)) continue;
        const edgeResult = await query(
          `
          INSERT INTO lineage_edges (
            workspace_id,
            room_id,
            parent_artifact_id,
            child_artifact_id,
            relation_type,
            created_by
          )
          VALUES ($1, $2, $3, $4, 'derived_from', $5)
          ON CONFLICT (parent_artifact_id, child_artifact_id, relation_type) DO NOTHING
          RETURNING id, parent_artifact_id, child_artifact_id, relation_type
          `,
          [workspaceId, roomId, parentId, artifact.id, req.user!.id]
        );
        lineageEdges.push(...edgeResult.rows);
      }
    }

    if (String(artifactType) === 'action_item' || String(artifactType) === 'decision_brief') {
      await recordAnalyticsEvent({
        workspaceId,
        roomId,
        userId: req.user!.id,
        eventType: String(artifactType) === 'action_item'
          ? 'decision_room_action_created'
          : 'decision_room_brief_published',
        metadata: {
          artifactId: Number(artifact.id),
          lineageEdgeCount: lineageEdges.length
        }
      });
    }

    return res.status(201).json({
      data: {
        ...artifact,
        payload: parseJsonMaybe(artifact.payload, {}),
        metadata: parseJsonMaybe(artifact.metadata, {})
      },
      lineage: lineageEdges
    });
  } catch (err) {
    console.error('Create artifact failed:', err);
    return res.status(500).json({ error: 'Failed to create artifact' });
  }
});

router.get('/:workspaceId/rooms/:roomId/artifacts/:artifactId/lineage', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const artifactId = Number(req.params.artifactId);

    const artifactResult = await query(
      `SELECT * FROM artifacts WHERE workspace_id = $1 AND room_id = $2 AND id = $3 LIMIT 1`,
      [workspaceId, roomId, artifactId]
    );
    if (artifactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const edgesResult = await query(
      `
      SELECT *
      FROM lineage_edges
      WHERE workspace_id = $1
        AND room_id = $2
        AND (parent_artifact_id = $3 OR child_artifact_id = $3)
      ORDER BY created_at DESC
      `,
      [workspaceId, roomId, artifactId]
    );

    const relatedIds = new Set<number>([artifactId]);
    edgesResult.rows.forEach((edge) => {
      relatedIds.add(Number(edge.parent_artifact_id));
      relatedIds.add(Number(edge.child_artifact_id));
    });

    const artifactListResult = await query(
      `
      SELECT id, artifact_type, title, created_at
      FROM artifacts
      WHERE workspace_id = $1 AND room_id = $2 AND id = ANY($3::int[])
      `,
      [workspaceId, roomId, Array.from(relatedIds)]
    );

    return res.json({
      artifact: {
        ...artifactResult.rows[0],
        payload: parseJsonMaybe(artifactResult.rows[0].payload, {}),
        metadata: parseJsonMaybe(artifactResult.rows[0].metadata, {})
      },
      edges: edgesResult.rows,
      artifacts: artifactListResult.rows
    });
  } catch (err) {
    console.error('Fetch lineage failed:', err);
    return res.status(500).json({ error: 'Failed to fetch artifact lineage' });
  }
});

router.post('/:workspaceId/rooms/:roomId/briefs/generate', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const sourceArtifactsResult = await query(
      `
      SELECT id, artifact_type, title, payload, created_at
      FROM artifacts
      WHERE workspace_id = $1
        AND room_id = $2
        AND artifact_type IN ('query_run', 'chart', 'pivot', 'report_block')
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [workspaceId, roomId]
    );

    const sourceArtifacts = sourceArtifactsResult.rows.map((artifact) => ({
      ...artifact,
      payload: parseJsonMaybe(artifact.payload, {})
    }));

    const totalRowsFromRuns = sourceArtifacts
      .filter((artifact) => artifact.artifact_type === 'query_run')
      .reduce((acc, artifact) => acc + Number(artifact.payload?.rowCount || 0), 0);

    const title = String(req.body?.title || `Decision Brief - Room ${roomId}`);
    const objective = String(req.body?.objective || room.description || 'Drive execution from analyzed evidence.');
    const highlights = sourceArtifacts
      .slice(0, 5)
      .map((artifact, index) => `${index + 1}. ${artifact.title} (${artifact.artifact_type})`)
      .join('\n');

    const brief = [
      `# ${title}`,
      '',
      `## Objective`,
      objective,
      '',
      `## Evidence Summary`,
      `- Artifacts reviewed: ${sourceArtifacts.length}`,
      `- Total rows analyzed across runs: ${totalRowsFromRuns}`,
      '',
      `## Top Evidence`,
      highlights || '- No evidence artifacts available yet.',
      '',
      `## Recommended Actions`,
      '- Confirm ownership on each action item.',
      '- Assign due dates and sync updates to communication channels.',
      '- Track one metric snapshot per action to validate impact.'
    ].join('\n');

    const briefArtifact = await createArtifact({
      workspaceId,
      projectId: room.project_id,
      roomId,
      artifactType: 'decision_brief',
      title,
      description: 'Auto-generated decision brief from room artifacts.',
      payload: { brief, objective, sourceArtifactCount: sourceArtifacts.length },
      metadata: { generatedBy: 'system' },
      createdBy: req.user!.id
    });

    for (const sourceArtifact of sourceArtifacts.slice(0, 10)) {
      await query(
        `
        INSERT INTO lineage_edges (
          workspace_id,
          room_id,
          parent_artifact_id,
          child_artifact_id,
          relation_type,
          created_by
        )
        VALUES ($1, $2, $3, $4, 'evidence_for', $5)
        ON CONFLICT (parent_artifact_id, child_artifact_id, relation_type) DO NOTHING
        `,
        [workspaceId, roomId, sourceArtifact.id, briefArtifact.id, req.user!.id]
      );
    }

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_brief_published',
      metadata: {
        artifactId: Number(briefArtifact.id),
        evidenceArtifacts: sourceArtifacts.length,
        rowsAnalyzed: totalRowsFromRuns
      }
    });

    return res.status(201).json({
      artifact: {
        ...briefArtifact,
        payload: parseJsonMaybe(briefArtifact.payload, {})
      },
      brief
    });
  } catch (err) {
    console.error('Generate brief failed:', err);
    return res.status(500).json({ error: 'Failed to generate decision brief' });
  }
});

router.post('/:workspaceId/rooms/:roomId/actions/sync', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const { channel = 'slack', createTasks = true } = req.body || {};
    const actionResult = await query(
      `
      SELECT id, title, payload, created_at
      FROM artifacts
      WHERE workspace_id = $1
        AND room_id = $2
        AND artifact_type = 'action_item'
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [workspaceId, roomId]
    );

    const actionItems = actionResult.rows.map((artifact) => ({
      ...artifact,
      payload: parseJsonMaybe(artifact.payload, {})
    }));

    if (actionItems.length === 0) {
      return res.status(400).json({ error: 'No action items found to sync.' });
    }

    const actionItemIds = actionItems.map((artifact) => Number(artifact.id));
    const { evidenceByAction, evidenceArtifactIds } = await getActionEvidenceMap(workspaceId, roomId, actionItemIds);
    const missingEvidenceActionIds = actionItemIds.filter((id) => (evidenceByAction.get(id) || 0) === 0);
    if (missingEvidenceActionIds.length > 0) {
      return res.status(400).json({
        error: 'Cannot sync actions. Every action item must include at least one linked evidence artifact.',
        missingEvidenceActionIds
      });
    }

    const roomArtifacts = await listRoomArtifacts(workspaceId, roomId, 500);
    const guide = await buildRoomGuide(workspaceId, room, roomArtifacts);
    const requiredForSync = new Set(['connect_data', 'analyze_data', 'build_brief', 'assign_actions']);
    const missingGuideSteps = guide.steps
      .filter((step) => requiredForSync.has(step.id) && !step.completed)
      .map((step) => ({ stepId: step.id, blockingIssues: step.blockingIssues }));

    if (missingGuideSteps.length > 0) {
      return res.status(400).json({
        error: 'Cannot sync actions until required guide steps are complete.',
        missingGuideSteps
      });
    }

    const normalizedChannel = String(channel).toLowerCase();
    let slackConnection: SlackConnection | null = null;
    let slackDestination = '#general';
    let slackWebhookUrl = '';
    let slackBotToken = '';

    if (normalizedChannel === 'slack') {
      slackConnection = await getSlackConnection(workspaceId, req.user!.id);
      if (!slackConnection) {
        return res.status(400).json({
          error: 'Slack integration is not connected. Connect Slack before syncing actions.'
        });
      }

      const credentials = normalizeSlackCredentials(slackConnection.credentials);
      slackDestination = credentials.channel || '#general';
      slackWebhookUrl = credentials.webhookUrl;
      slackBotToken = credentials.botToken;

      if (!slackWebhookUrl && !slackBotToken) {
        return res.status(400).json({
          error: 'Slack integration is connected but missing webhookUrl/botToken credentials.'
        });
      }
    }

    const createdTaskIds: string[] = [];
    const skippedTaskIds: string[] = [];
    if (createTasks) {
      for (const action of actionItems) {
        try {
          const taskPayload = action.payload || {};
          const dedupeTag = `room-action:${action.id}`;
          const existingTask = await query(
            `
            SELECT id
            FROM tasks
            WHERE workspace_id = $1
              AND tags ? $2
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [workspaceId, dedupeTag]
          );

          if (existingTask.rows.length > 0) {
            skippedTaskIds.push(existingTask.rows[0].id);
            continue;
          }

          const normalizedTags = Array.isArray(taskPayload.tags)
            ? [...new Set(taskPayload.tags.map((tag: any) => String(tag)))]
            : [];
          normalizedTags.push('room-sync');
          normalizedTags.push(dedupeTag);
          normalizedTags.push(`room:${roomId}`);

          const taskInsert = await query(
            `
            INSERT INTO tasks (workspace_id, title, description, status, priority, assignee_id, created_by, due_date, tags)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id
            `,
            [
              workspaceId,
              action.title,
              taskPayload.description || null,
              taskPayload.status || 'todo',
              taskPayload.priority || 'medium',
              taskPayload.assigneeId || null,
              req.user!.id,
              taskPayload.dueDate || null,
              JSON.stringify(normalizedTags)
            ]
          );
          createdTaskIds.push(taskInsert.rows[0].id);
        } catch (taskErr) {
          console.warn('Task sync failed for action item, skipping:', taskErr);
        }
      }
    }

    let slackDelivery: SlackDeliveryResult = {
      posted: false,
      attempts: 0,
      destination: String(channel),
      error: 'Slack delivery not attempted.'
    };

    if (normalizedChannel === 'slack') {
      const payload = buildSlackActionSyncPayload({
        roomName: room.name,
        actionItems: actionItems.map((item) => ({ id: Number(item.id), title: String(item.title), payload: item.payload })),
        syncedCount: actionItems.length,
        evidenceCount: evidenceArtifactIds.length
      });

      slackDelivery = await postSlackWithRetry({
        webhookUrl: slackWebhookUrl,
        botToken: slackBotToken,
        channel: slackDestination,
        payload
      });

      if (!slackDelivery.posted) {
        await recordAnalyticsEvent({
          workspaceId,
          roomId,
          userId: req.user!.id,
          eventType: 'decision_room_actions_sync_failed',
          metadata: {
            channel: 'slack',
            error: slackDelivery.error || 'Slack delivery failed',
            createdTasks: createdTaskIds.length,
            skippedTasks: skippedTaskIds.length
          }
        });

        return res.status(502).json({
          error: `Slack delivery failed: ${slackDelivery.error || 'unknown error'}`,
          createdTasks: createdTaskIds.length,
          skippedTasks: skippedTaskIds.length,
          createdTaskIds,
          skippedTaskIds
        });
      }
    }

    const nowIso = new Date().toISOString();
    const currentContext = parseRoomRunContext(room.run_context);
    const completedStepIds = new Set(currentContext.mvpGuide?.completedStepIds || []);
    completedStepIds.add('sync_actions');
    const updatedRunContext: RoomRunContext = {
      ...currentContext,
      mvpGuide: {
        ...(currentContext.mvpGuide || {}),
        completedStepIds: Array.from(completedStepIds),
        stepCompletedAt: {
          ...(currentContext.mvpGuide?.stepCompletedAt || {}),
          sync_actions: nowIso
        },
        lastActionSyncAt: nowIso
      }
    };

    await query(
      `
      UPDATE analysis_rooms
      SET run_context = $1,
          stage = $2,
          updated_at = NOW()
      WHERE id = $3 AND workspace_id = $4
      `,
      [JSON.stringify(updatedRunContext), 'done', roomId, workspaceId]
    );

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_actions_synced',
      metadata: {
        channel,
        syncedCount: actionItems.length,
        createdTasks: createdTaskIds.length,
        skippedTasks: skippedTaskIds.length,
        evidenceArtifacts: evidenceArtifactIds.length,
        slackPosted: slackDelivery.posted,
        slackAttempts: slackDelivery.attempts
      }
    });

    return res.json({
      syncedCount: actionItems.length,
      createdTasks: createdTaskIds.length,
      createdTaskIds,
      skippedTasks: skippedTaskIds.length,
      skippedTaskIds,
      evidenceArtifactIds,
      slackDelivery,
      channel,
      message: `Synced ${actionItems.length} action item(s) for ${String(channel).toUpperCase()} handoff.`
    });
  } catch (err) {
    console.error('Sync actions failed:', err);
    return res.status(500).json({ error: 'Failed to sync actions' });
  }
});

router.post('/:workspaceId/automations', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const {
      name,
      description,
      roomId,
      riskLevel = 'medium',
      triggerType,
      triggerConfig = {},
      actionType,
      actionConfig = {}
    } = req.body || {};

    if (!name || !triggerType || !actionType) {
      return res.status(400).json({ error: 'name, triggerType, and actionType are required' });
    }

    const normalizedRisk = RISK_LEVELS.has(String(riskLevel)) ? String(riskLevel) : 'medium';
    const result = await query(
      `
      INSERT INTO automation_policies (
        workspace_id,
        room_id,
        name,
        description,
        risk_level,
        trigger_type,
        trigger_config,
        action_type,
        action_config,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        workspaceId,
        roomId || null,
        name,
        description || null,
        normalizedRisk,
        triggerType,
        JSON.stringify(triggerConfig),
        actionType,
        JSON.stringify(actionConfig),
        req.user!.id
      ]
    );

    return res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error('Create automation failed:', err);
    return res.status(500).json({ error: 'Failed to create automation policy' });
  }
});

router.post('/:workspaceId/automations/:automationId/execute', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const automationId = Number(req.params.automationId);
    const policyResult = await query(
      `
      SELECT *
      FROM automation_policies
      WHERE id = $1 AND workspace_id = $2 AND is_active = true
      LIMIT 1
      `,
      [automationId, workspaceId]
    );

    if (policyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Automation policy not found' });
    }

    const policy = policyResult.rows[0];
    const inputPayload = req.body?.input || {};

    const runInsert = await query(
      `
      INSERT INTO automation_runs (
        workspace_id,
        room_id,
        automation_policy_id,
        status,
        risk_level,
        input,
        created_by,
        started_at
      )
      VALUES ($1,$2,$3,'running',$4,$5,$6,NOW())
      RETURNING *
      `,
      [workspaceId, policy.room_id || null, automationId, policy.risk_level, JSON.stringify(inputPayload), req.user!.id]
    );

    const run = runInsert.rows[0];
    let approvalRequest = null;

    if (policy.risk_level === 'low') {
      const completed = await query(
        `
        UPDATE automation_runs
        SET status = 'completed',
            output = $1,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [JSON.stringify({ status: 'auto_applied', note: 'Low-risk automation auto-approved.' }), run.id]
      );

      return res.status(201).json({
        run: completed.rows[0],
        approvalRequest: null
      });
    }

    const approvalInsert = await query(
      `
      INSERT INTO approval_requests (
        workspace_id,
        room_id,
        automation_run_id,
        requested_by,
        risk_level,
        status,
        reason
      )
      VALUES ($1,$2,$3,$4,$5,'pending',$6)
      RETURNING *
      `,
      [workspaceId, policy.room_id || null, run.id, req.user!.id, policy.risk_level, req.body?.reason || null]
    );
    approvalRequest = approvalInsert.rows[0];

    const awaiting = await query(
      `
      UPDATE automation_runs
      SET status = 'awaiting_approval', updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [run.id]
    );

    if (approvalRequest && policy.room_id) {
      emitToDecisionRoom(workspaceId, Number(policy.room_id), 'decision-room:approval-created', {
        roomId: Number(policy.room_id),
        approval: approvalRequest
      });
    }

    return res.status(201).json({
      run: awaiting.rows[0],
      approvalRequest
    });
  } catch (err) {
    console.error('Execute automation failed:', err);
    return res.status(500).json({ error: 'Failed to execute automation policy' });
  }
});

router.post('/:workspaceId/approvals/:approvalId/respond', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const approvalId = Number(req.params.approvalId);
    const decisionRaw = String(req.body?.decision || req.body?.status || '').toLowerCase();
    const decision = decisionRaw === 'approved' ? 'approved' : decisionRaw === 'rejected' ? 'rejected' : null;
    if (!decision) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const approvalResult = await query(
      `
      SELECT *
      FROM approval_requests
      WHERE id = $1 AND workspace_id = $2
      LIMIT 1
      `,
      [approvalId, workspaceId]
    );
    if (approvalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    const approval = approvalResult.rows[0];
    if (approval.status !== 'pending') {
      return res.status(400).json({ error: `Approval request is already ${approval.status}` });
    }

    const updateApproval = await query(
      `
      UPDATE approval_requests
      SET status = $1,
          response_note = $2,
          responded_by = $3,
          responded_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [decision, req.body?.note || null, req.user!.id, approvalId]
    );

    let updatedRun = null;
    if (approval.automation_run_id) {
      const runStatus = decision === 'approved' ? 'completed' : 'failed';
      const output = decision === 'approved'
        ? { status: 'approved', note: req.body?.note || null }
        : { status: 'rejected', note: req.body?.note || null };
      const runUpdate = await query(
        `
        UPDATE automation_runs
        SET status = $1,
            output = $2,
            error = $3,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
        `,
        [runStatus, JSON.stringify(output), decision === 'rejected' ? 'Rejected by approver' : null, approval.automation_run_id]
      );
      updatedRun = runUpdate.rows[0] || null;
    }

    if (approval.room_id) {
      emitToDecisionRoom(workspaceId, Number(approval.room_id), 'decision-room:approval-updated', {
        roomId: Number(approval.room_id),
        approval: updateApproval.rows[0]
      });
    }

    if (approval.requested_by && String(approval.requested_by) !== String(req.user!.id)) {
      try {
        const responderName = await resolveUserDisplayName(req.user!.id);
        const notificationInsert = await query(
          `
          INSERT INTO notifications (user_id, workspace_id, title, message, type, is_read, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
          RETURNING *
          `,
          [
            Number(approval.requested_by),
            workspaceId,
            'Approval request updated',
            `${responderName} ${decision} your approval request.`,
            'approval'
          ]
        );
        emitToUser(Number(approval.requested_by), 'notification-created', {
          ...notificationInsert.rows[0],
          roomId: approval.room_id ? Number(approval.room_id) : null,
          approvalId
        });
      } catch (notifyError) {
        console.warn('Approval notification skipped:', notifyError);
      }
    }

    return res.json({
      approval: updateApproval.rows[0],
      run: updatedRun
    });
  } catch (err) {
    console.error('Respond approval failed:', err);
    return res.status(500).json({ error: 'Failed to process approval response' });
  }
});

async function upsertIntegrationConnection(params: {
  workspaceId: number;
  userId: string;
  provider: string;
  name: string;
  credentials: Record<string, any>;
}) {
  const existing = await query(
    `
    SELECT id
    FROM integrations
    WHERE workspace_id = $1 AND user_id = $2 AND provider = $3
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [params.workspaceId, params.userId, params.provider]
  );

  if (existing.rows.length > 0) {
    const updated = await query(
      `
      UPDATE integrations
      SET name = $1,
          credentials = $2,
          status = 'active',
          last_sync_at = NOW(),
          sync_message = 'Connected via Studio V2',
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, provider, name, status, last_sync_at
      `,
      [params.name, JSON.stringify(params.credentials || {}), existing.rows[0].id]
    );
    return updated.rows[0];
  }

  const inserted = await query(
    `
    INSERT INTO integrations (
      user_id,
      workspace_id,
      provider,
      name,
      credentials,
      status,
      last_sync_at,
      sync_message
    )
    VALUES ($1,$2,$3,$4,$5,'active',NOW(),'Connected via Studio V2')
    RETURNING id, provider, name, status, last_sync_at
    `,
    [params.userId, params.workspaceId, params.provider, params.name, JSON.stringify(params.credentials || {})]
  );
  return inserted.rows[0];
}

router.post('/:workspaceId/integrations/slack/connect', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }
    const workspaceId = Number(req.params.workspaceId);
    const result = await upsertIntegrationConnection({
      workspaceId,
      userId: req.user!.id,
      provider: 'slack',
      name: req.body?.name || 'Slack Workspace',
      credentials: req.body?.credentials || req.body || {}
    });
    return res.status(201).json({ data: result });
  } catch (err) {
    console.error('Slack connect failed:', err);
    return res.status(500).json({ error: 'Failed to connect Slack integration' });
  }
});

router.post('/:workspaceId/integrations/sheets/connect', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }
    const workspaceId = Number(req.params.workspaceId);
    const result = await upsertIntegrationConnection({
      workspaceId,
      userId: req.user!.id,
      provider: 'sheets',
      name: req.body?.name || 'Google Sheets',
      credentials: req.body?.credentials || req.body || {}
    });
    return res.status(201).json({ data: result });
  } catch (err) {
    console.error('Sheets connect failed:', err);
    return res.status(500).json({ error: 'Failed to connect Sheets integration' });
  }
});

router.post('/:workspaceId/integrations/sql/connect', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }
    const workspaceId = Number(req.params.workspaceId);
    const provider = String(req.body?.provider || 'sql');
    const result = await upsertIntegrationConnection({
      workspaceId,
      userId: req.user!.id,
      provider,
      name: req.body?.name || `${provider.toUpperCase()} Connection`,
      credentials: req.body?.credentials || req.body || {}
    });
    return res.status(201).json({ data: result });
  } catch (err) {
    console.error('SQL connect failed:', err);
    return res.status(500).json({ error: 'Failed to connect SQL integration' });
  }
});

router.get('/:workspaceId/digests/executive', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);

    const [roomsResult, pendingApprovalsResult, actionItemsResult, decisionBriefsResult, metricSnapshotsResult] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM analysis_rooms WHERE workspace_id = $1 AND is_archived = false`, [workspaceId]),
      query(`SELECT COUNT(*)::int AS count FROM approval_requests WHERE workspace_id = $1 AND status = 'pending'`, [workspaceId]),
      query(
        `
        SELECT COUNT(*)::int AS count
        FROM artifacts
        WHERE workspace_id = $1
          AND artifact_type = 'action_item'
          AND created_at >= NOW() - INTERVAL '30 days'
        `,
        [workspaceId]
      ),
      query(
        `
        SELECT id, room_id, title, created_at
        FROM artifacts
        WHERE workspace_id = $1
          AND artifact_type = 'decision_brief'
        ORDER BY created_at DESC
        LIMIT 10
        `,
        [workspaceId]
      ),
      query(
        `
        SELECT m.metric_key, m.name, s.value, s.observed_at, s.evidence_artifact_id
        FROM metric_value_snapshots s
        JOIN metric_definitions m ON m.id = s.metric_definition_id
        WHERE s.workspace_id = $1
        ORDER BY s.observed_at DESC
        LIMIT 200
        `,
        [workspaceId]
      )
    ]);

    const metricByKey = new Map<string, any[]>();
    metricSnapshotsResult.rows.forEach((row) => {
      const key = row.metric_key;
      const list = metricByKey.get(key) || [];
      list.push(row);
      metricByKey.set(key, list);
    });

    const latestMetrics = Array.from(metricByKey.entries()).slice(0, 20).map(([metricKey, entries]) => {
      const current = entries[0];
      const previous = entries[1];
      const currentValue = Number(current?.value || 0);
      const previousValue = Number(previous?.value || 0);
      const deltaPct = previousValue === 0 ? null : ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
      return {
        metricKey,
        name: current?.name || metricKey,
        currentValue,
        previousValue,
        deltaPct,
        observedAt: current?.observed_at,
        evidenceArtifactId: current?.evidence_artifact_id || null
      };
    });

    const decisions = decisionBriefsResult.rows.map((brief) => ({
      id: brief.id,
      roomId: brief.room_id,
      title: brief.title,
      createdAt: brief.created_at
    }));

    const evidenceCoverageRatio = latestMetrics.length === 0
      ? 0
      : latestMetrics.filter((m) => m.evidenceArtifactId).length / latestMetrics.length;

    return res.json({
      generatedAt: new Date().toISOString(),
      roomCount: roomsResult.rows[0]?.count || 0,
      pendingApprovals: pendingApprovalsResult.rows[0]?.count || 0,
      actionItemsLast30Days: actionItemsResult.rows[0]?.count || 0,
      evidenceCoverageRatio,
      latestMetrics,
      decisions
    });
  } catch (err) {
    console.error('Executive digest failed:', err);
    return res.status(500).json({ error: 'Failed to generate executive digest' });
  }
});

export default router;
