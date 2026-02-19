import { NextFunction, Response, Router } from 'express';
import { CronExpressionParser } from 'cron-parser';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import { SafeExecutor } from '../utils/safeExecutor.js';
import { GroqService } from '../services/groq.service.js';
import { emitToDecisionRoom, emitToUser } from '../realtime.js';
import { AutomationExecutionError, executeAutomationPolicy } from '../services/automationExecutionService.js';
import { getAutomationQueueState, requestAutomationDispatch } from '../services/automationQueueService.js';

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
  latestReportBundleId?: string | null;
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

interface SlackPostMessageResponse {
  ok?: boolean;
  error?: string;
  ts?: string;
}

interface MentionableUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  handle: string;
}

type ReportSectionType = 'kpi_delta' | 'trend' | 'pattern' | 'explanation' | 'recommendation';
type ReportClaimConfidence = 'high' | 'medium' | 'low';

interface ReportV2GenerateRequest {
  timeframeDays?: number;
  compareMode?: 'previous_period';
  focus?: 'revops_weekly';
  persist?: boolean;
}

interface ReportClaim {
  id: string;
  statement: string;
  metricKey: string;
  valueCurrent: number | null;
  valuePrevious: number | null;
  deltaPct: number | null;
  confidence: ReportClaimConfidence;
  evidenceArtifactIds: number[];
  supported: boolean;
}

interface ReportSection {
  id: string;
  type: ReportSectionType;
  title: string;
  contentMarkdown: string;
  claims: ReportClaim[];
  chartArtifactIds: number[];
}

interface ReportMetricSnapshot {
  metricKey: string;
  label: string;
  valueCurrent: number | null;
  valuePrevious: number | null;
  deltaPct: number | null;
  evidenceArtifactIds: number[];
}

interface ReportQuality {
  evidenceCoverageRatio: number;
  unsupportedClaims: number;
  publishBlocked: boolean;
  blockers: string[];
  metricPolicyBlocked?: boolean;
  metricPolicyFailures?: MetricPolicyCheck[];
}

interface ReportInputRequirements {
  mappedFields: Record<string, string>;
  missingFields: string[];
  warnings: string[];
}

interface ReportV2Bundle {
  bundleId: string;
  roomId: number;
  generatedAt: string;
  quality: ReportQuality;
  sections: ReportSection[];
  kpiSnapshot: ReportMetricSnapshot[];
  inputRequirements: ReportInputRequirements;
  summaryArtifactId: number | null;
}

interface RevOpsFieldMap {
  dateField: string | null;
  createdDateField: string | null;
  closeDateField: string | null;
  amountField: string | null;
  stageField: string | null;
  ownerField: string | null;
  segmentField: string | null;
  customerField: string | null;
  productField: string | null;
}

interface MetricCatalogItem {
  id: number;
  key: string;
  name: string;
  ownerId: number | null;
  ownerName: string | null;
  certified: boolean;
  validationStatus: 'passed' | 'failed' | 'pending' | 'missing';
  formulaSql: string;
  lastValidatedAt: string | null;
}

interface MetricPolicyCheck {
  metricKey: string;
  metricDefinitionId: number | null;
  ownerId: number | null;
  ownerName: string | null;
  status: 'passed' | 'failed' | 'pending' | 'missing_test' | 'not_mapped';
  blocking: boolean;
  reason: string;
  lastValidatedAt: string | null;
}

interface MetricPolicyEvaluation {
  checks: MetricPolicyCheck[];
  publishBlocked: boolean;
  blockers: string[];
}

interface VisualBuildSpec {
  chartType: string;
  dimensions: string[];
  measures: string[];
  filters?: Array<{ field: string; operator?: string; value: any }>;
  drillPath?: string[];
}

interface AutomationScheduleRecord {
  id: number;
  workspaceId: number;
  roomId: number | null;
  automationPolicyId: number;
  cron: string;
  timezone: string;
  dedupeKey: string | null;
  retryPolicy: { maxAttempts: number; backoffMs: number };
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
}

interface AutomationRunDetail {
  runId: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  attempts: number;
  error: string | null;
  artifacts: number[];
}

interface OutcomeAttribution {
  actionId: number | null;
  metricKey: string;
  baselineValue: number | null;
  latestValue: number | null;
  deltaPct: number | null;
  confidence: ReportClaimConfidence;
  evidenceArtifactIds: number[];
}

interface CommentResolution {
  threadId: number;
  status: 'resolved' | 'reopened';
  resolvedBy: number | null;
  resolvedAt: string;
  resolutionNote: string | null;
}

interface DatasetProfileArtifact {
  datasetVersionId: number | null;
  qualityScore: number;
  missingness: Array<{ field: string; missingCount: number; totalCount: number; ratio: number }>;
  duplicateKeys: Array<{ field: string; duplicateCount: number; totalCount: number; ratio: number }>;
  dateContinuity: Array<{ field: string; expectedDays: number; observedDays: number; continuityRatio: number }>;
  invalidNumerics: Array<{ field: string; invalidCount: number; totalChecked: number; ratio: number }>;
  generatedAt: string;
  summary: {
    rowCount: number;
    columnCount: number;
    topIssues: string[];
  };
}

interface QueryVersion {
  id: number;
  queryId: number | null;
  versionNumber: number;
  sqlTemplate: string;
  parametersSchema: Record<string, any>;
  metadata: Record<string, any>;
  createdBy: number | null;
  createdAt: string;
}

interface PivotComputeSpec {
  dimensions: string[];
  measures: Array<string | { field: string; agg?: 'sum' | 'avg' | 'count' | 'min' | 'max'; as?: string }>;
  calculations: Array<{
    type: 'percent_of_total' | 'rank' | 'formula';
    sourceField?: string;
    as?: string;
    order?: 'asc' | 'desc';
    expression?: string;
  }>;
  filters: Array<{ field: string; operator?: string; value: any }>;
}

interface VisualAnnotation {
  id: number;
  visualId: number;
  text: string;
  anchor: Record<string, any>;
  createdBy: number | null;
  createdAt: string;
}

interface ReviewSubmission {
  id: number;
  roomId: number;
  bundleId: string;
  stage: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  submittedBy: number | null;
  submittedAt: string;
  reviewerId: number | null;
  note: string | null;
  responseNote: string | null;
  respondedBy: number | null;
  respondedAt: string | null;
}

interface CoverageTrendPoint {
  ts: string;
  evidenceCoverageRatio: number;
  unsupportedClaims: number;
}

interface RoomRoiSnapshot {
  timeToInsightMin: number | null;
  timeToActionMin: number | null;
  manualUpdateReductionPct: number;
  evidenceCoverageRatio: number;
}

interface RoomRoiTargetStatus {
  key: string;
  label: string;
  target: number;
  actual: number | null;
  comparator: 'lte' | 'gte';
  unit: 'minutes' | 'percent' | 'ratio';
  met: boolean;
}

interface UserPreferenceProfile {
  workspaceId: number;
  userId: number;
  persona: 'analyst' | 'manager' | 'executive';
  uiMode: 'guided' | 'expert';
  reportStyle: string;
  aiStyle: string;
  notificationPreferences: Record<string, any>;
  panelPreferences: Record<string, any>;
  updatedAt: string;
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
const STUDIO_PANELS = new Set(['sheets', 'query', 'pivot', 'visuals', 'report', 'actions', 'comms']);
const EVIDENCE_ARTIFACT_TYPES = ['dataset_version', 'query_run', 'chart', 'pivot', 'report_block', 'decision_brief'];
const REPORT_V2_REQUIRED_SECTION_TYPES: ReportSectionType[] = ['kpi_delta', 'trend', 'pattern', 'explanation', 'recommendation'];
const REPORT_V2_FOCUS = 'revops_weekly';
const REPORT_V2_FLAG_KEY = 'report_v2_enabled';
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

function toStudioPanel(value: any): 'sheets' | 'query' | 'pivot' | 'visuals' | 'report' | 'actions' | 'comms' {
  const normalized = String(value || '').toLowerCase();
  if (STUDIO_PANELS.has(normalized)) {
    return normalized as 'sheets' | 'query' | 'pivot' | 'visuals' | 'report' | 'actions' | 'comms';
  }
  return 'sheets';
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

function clampTimeframeDays(value: any): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 7;
  return Math.max(1, Math.min(90, Math.floor(parsed)));
}

function normalizeFieldName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function findBestColumnMatch(columns: string[], synonyms: string[]): string | null {
  if (!columns.length) return null;
  const normalizedColumns = columns.map((column) => ({
    column,
    normalized: normalizeFieldName(column)
  }));
  const normalizedSynonyms = synonyms.map(normalizeFieldName).filter(Boolean);

  for (const synonym of normalizedSynonyms) {
    const exact = normalizedColumns.find((entry) => entry.normalized === synonym);
    if (exact) return exact.column;
  }

  for (const synonym of normalizedSynonyms) {
    const contains = normalizedColumns.find((entry) => entry.normalized.includes(synonym) || synonym.includes(entry.normalized));
    if (contains) return contains.column;
  }

  return null;
}

function resolveRevOpsFieldMap(columns: string[]) {
  const createdDateField = findBestColumnMatch(columns, [
    'created_at',
    'created_date',
    'create_date',
    'createdon',
    'opportunity_created',
    'pipeline_date',
    'date_created'
  ]);
  const closeDateField = findBestColumnMatch(columns, [
    'close_date',
    'closed_at',
    'closed_date',
    'closedon',
    'won_date',
    'lost_date',
    'date_closed'
  ]);
  const dateField = findBestColumnMatch(columns, [
    'date',
    'day',
    'ds',
    'event_date',
    'transaction_date',
    'report_date'
  ]);

  const map: RevOpsFieldMap = {
    dateField,
    createdDateField: createdDateField || dateField,
    closeDateField: closeDateField || dateField || createdDateField,
    amountField: findBestColumnMatch(columns, [
      'amount',
      'revenue',
      'arr',
      'mrr',
      'deal_value',
      'value',
      'pipeline_amount',
      'bookings'
    ]),
    stageField: findBestColumnMatch(columns, [
      'stage',
      'status',
      'deal_stage',
      'opportunity_stage',
      'pipeline_stage',
      'lifecycle_stage',
      'outcome'
    ]),
    ownerField: findBestColumnMatch(columns, [
      'owner',
      'sales_rep',
      'rep',
      'account_executive',
      'ae',
      'seller',
      'salesperson'
    ]),
    segmentField: findBestColumnMatch(columns, [
      'segment',
      'region',
      'market',
      'channel',
      'source',
      'vertical'
    ]),
    customerField: findBestColumnMatch(columns, [
      'customer',
      'customer_name',
      'account',
      'company',
      'account_name'
    ]),
    productField: findBestColumnMatch(columns, [
      'product',
      'sku',
      'plan',
      'package',
      'offering'
    ])
  };

  const mappedFields: Record<string, string> = {};
  Object.entries(map).forEach(([key, value]) => {
    if (value) {
      mappedFields[key] = value;
    }
  });

  const missingFields: string[] = [];
  if (!map.amountField) missingFields.push('amount');
  if (!map.stageField) missingFields.push('stage/status');
  if (!map.createdDateField && !map.closeDateField) missingFields.push('created/close date');

  return {
    map,
    mappedFields,
    missingFields
  };
}

function toFiniteNumber(value: any): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const cleaned = trimmed.replace(/[$,%\s,]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toDateMaybe(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWonStage(value: any): boolean {
  const normalized = String(value || '').toLowerCase();
  return normalized.includes('won') || normalized.includes('closed won') || normalized.includes('closed_won');
}

function isLostStage(value: any): boolean {
  const normalized = String(value || '').toLowerCase();
  return normalized.includes('lost') || normalized.includes('closed lost') || normalized.includes('closed_lost');
}

function safeDeltaPct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function computeMad(values: number[]): number | null {
  const med = median(values);
  if (med === null) return null;
  const deviations = values.map((value) => Math.abs(value - med));
  return median(deviations);
}

function formatMetricValue(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value.toFixed(2).replace(/\.00$/, '');
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
  const threadIds = result.rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  const latestResolutionByThread = new Map<number, any>();
  if (threadIds.length > 0) {
    try {
      const resolutions = await query(
        `
        SELECT DISTINCT ON (thread_id)
          thread_id,
          status,
          resolved_by,
          resolution_note,
          resolved_at
        FROM comment_thread_resolutions
        WHERE workspace_id = $1
          AND room_id = $2
          AND thread_id = ANY($3::int[])
        ORDER BY thread_id, resolved_at DESC, id DESC
        `,
        [workspaceId, roomId, threadIds]
      );
      resolutions.rows.forEach((resolution) => {
        latestResolutionByThread.set(Number(resolution.thread_id), resolution);
      });
    } catch (err) {
      // Migration may not be applied yet; keep thread listing available.
      console.warn('Thread resolution lookup skipped:', err);
    }
  }

  return result.rows.map((row) => {
    const resolution = latestResolutionByThread.get(Number(row.id));
    return {
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
    lastCommentContent: row.last_comment_content || null,
    resolution: resolution
      ? {
          status: String(resolution.status || 'resolved'),
          resolvedBy: resolution.resolved_by ? Number(resolution.resolved_by) : null,
          resolvedAt: resolution.resolved_at || null,
          resolutionNote: resolution.resolution_note || null
        }
      : null
  };
  });
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

      const data = (await response.json().catch(() => ({}))) as SlackPostMessageResponse;
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

async function createLineageEdges(params: {
  workspaceId: number;
  roomId: number;
  parentArtifactIds: number[];
  childArtifactId: number;
  relationType: string;
  createdBy: string;
}) {
  const inserted: Array<{ id: number; parent_artifact_id: number; child_artifact_id: number; relation_type: string }> = [];
  const uniqueParents = Array.from(new Set(params.parentArtifactIds))
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  for (const parentId of uniqueParents) {
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
      [params.workspaceId, params.roomId, parentId, params.childArtifactId, params.relationType, params.createdBy]
    );
    inserted.push(...edgeResult.rows);
  }

  return inserted;
}

function parseArtifactRowsFromPayload(payload: Record<string, any>): Record<string, any>[] {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.previewRows)) return payload.previewRows as Record<string, any>[];
  if (Array.isArray(payload.rows)) return payload.rows as Record<string, any>[];
  if (Array.isArray(payload.data)) return payload.data as Record<string, any>[];
  if (payload.chart && Array.isArray(payload.chart.data)) return payload.chart.data as Record<string, any>[];
  return [];
}

function getClaimConfidence(sampleSize: number, hasDelta: boolean): ReportClaimConfidence {
  if (sampleSize >= 20 && hasDelta) return 'high';
  if (sampleSize >= 8) return 'medium';
  return 'low';
}

function getRowDate(row: Record<string, any>, field?: string | null): Date | null {
  if (!field) return null;
  return toDateMaybe(row?.[field]);
}

function getReferenceDate(rows: Record<string, any>[], fieldMap: RevOpsFieldMap): Date | null {
  const candidates: Date[] = [];
  rows.forEach((row) => {
    const createdDate = getRowDate(row, fieldMap.createdDateField);
    const closeDate = getRowDate(row, fieldMap.closeDateField);
    if (createdDate) candidates.push(createdDate);
    if (closeDate) candidates.push(closeDate);
  });
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.getTime() - a.getTime())[0];
}

function computeWindowBounds(referenceDate: Date, timeframeDays: number) {
  const currentEnd = new Date(referenceDate);
  currentEnd.setHours(23, 59, 59, 999);
  const currentStart = new Date(currentEnd);
  currentStart.setDate(currentStart.getDate() - (timeframeDays - 1));
  currentStart.setHours(0, 0, 0, 0);

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  previousEnd.setHours(23, 59, 59, 999);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (timeframeDays - 1));
  previousStart.setHours(0, 0, 0, 0);

  return { currentStart, currentEnd, previousStart, previousEnd };
}

function inRange(target: Date | null, start: Date, end: Date): boolean {
  if (!target) return false;
  const ts = target.getTime();
  return ts >= start.getTime() && ts <= end.getTime();
}

function buildDailySeries(params: {
  rows: Record<string, any>[];
  fieldMap: RevOpsFieldMap;
  windowBounds: ReturnType<typeof computeWindowBounds> | null;
}) {
  const series = new Map<string, { date: string; pipeline_created_amount: number; closed_won_amount: number; closed_lost_count: number }>();
  const amountField = params.fieldMap.amountField;
  const stageField = params.fieldMap.stageField;

  for (const row of params.rows) {
    const createdDate = getRowDate(row, params.fieldMap.createdDateField);
    const closeDate = getRowDate(row, params.fieldMap.closeDateField) || createdDate;
    const amount = toFiniteNumber(amountField ? row?.[amountField] : null) || 0;
    const stageRaw = stageField ? row?.[stageField] : '';

    if (createdDate) {
      if (!params.windowBounds || inRange(createdDate, params.windowBounds.currentStart, params.windowBounds.currentEnd)) {
        const key = toIsoDate(createdDate);
        const bucket = series.get(key) || { date: key, pipeline_created_amount: 0, closed_won_amount: 0, closed_lost_count: 0 };
        bucket.pipeline_created_amount += amount;
        series.set(key, bucket);
      }
    }

    if (closeDate && (!params.windowBounds || inRange(closeDate, params.windowBounds.currentStart, params.windowBounds.currentEnd))) {
      const key = toIsoDate(closeDate);
      const bucket = series.get(key) || { date: key, pipeline_created_amount: 0, closed_won_amount: 0, closed_lost_count: 0 };
      if (isWonStage(stageRaw)) {
        bucket.closed_won_amount += amount;
      }
      if (isLostStage(stageRaw)) {
        bucket.closed_lost_count += 1;
      }
      series.set(key, bucket);
    }
  }

  return Array.from(series.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function computeRevOpsMetrics(params: {
  rows: Record<string, any>[];
  fieldMap: RevOpsFieldMap;
  timeframeDays: number;
  evidenceArtifactIds: number[];
}) {
  const amountField = params.fieldMap.amountField;
  const stageField = params.fieldMap.stageField;
  const referenceDate = getReferenceDate(params.rows, params.fieldMap);
  const windowBounds = referenceDate ? computeWindowBounds(referenceDate, params.timeframeDays) : null;

  const rowsWithDates = params.rows.map((row) => ({
    row,
    createdDate: getRowDate(row, params.fieldMap.createdDateField),
    closeDate: getRowDate(row, params.fieldMap.closeDateField) || getRowDate(row, params.fieldMap.createdDateField)
  }));

  const currentCreatedRows = rowsWithDates.filter(({ createdDate }) =>
    windowBounds ? inRange(createdDate, windowBounds.currentStart, windowBounds.currentEnd) : true
  );
  const previousCreatedRows = rowsWithDates.filter(({ createdDate }) =>
    windowBounds ? inRange(createdDate, windowBounds.previousStart, windowBounds.previousEnd) : false
  );

  const currentClosedRows = rowsWithDates.filter(({ closeDate }) =>
    windowBounds ? inRange(closeDate, windowBounds.currentStart, windowBounds.currentEnd) : true
  );
  const previousClosedRows = rowsWithDates.filter(({ closeDate }) =>
    windowBounds ? inRange(closeDate, windowBounds.previousStart, windowBounds.previousEnd) : false
  );

  const sumAmount = (items: Array<{ row: Record<string, any> }>) =>
    items.reduce((acc, { row }) => {
      const parsed = toFiniteNumber(amountField ? row?.[amountField] : null);
      return acc + (parsed || 0);
    }, 0);

  const pipelineCurrent = amountField ? sumAmount(currentCreatedRows) : null;
  const pipelinePrevious = amountField ? sumAmount(previousCreatedRows) : null;

  const wonCurrentRows = stageField ? currentClosedRows.filter(({ row }) => isWonStage(row?.[stageField])) : [];
  const wonPreviousRows = stageField ? previousClosedRows.filter(({ row }) => isWonStage(row?.[stageField])) : [];
  const lostCurrentRows = stageField ? currentClosedRows.filter(({ row }) => isLostStage(row?.[stageField])) : [];
  const lostPreviousRows = stageField ? previousClosedRows.filter(({ row }) => isLostStage(row?.[stageField])) : [];

  const closedWonCurrent = amountField ? sumAmount(wonCurrentRows) : null;
  const closedWonPrevious = amountField ? sumAmount(wonPreviousRows) : null;

  const closedLostCurrent = stageField ? lostCurrentRows.length : null;
  const closedLostPrevious = stageField ? lostPreviousRows.length : null;

  const winRateCurrent = stageField
    ? (wonCurrentRows.length + lostCurrentRows.length) > 0
      ? (wonCurrentRows.length / (wonCurrentRows.length + lostCurrentRows.length)) * 100
      : 0
    : null;
  const winRatePrevious = stageField
    ? (wonPreviousRows.length + lostPreviousRows.length) > 0
      ? (wonPreviousRows.length / (wonPreviousRows.length + lostPreviousRows.length)) * 100
      : 0
    : null;

  const avgDealSizeCurrent = amountField
    ? currentCreatedRows.length > 0
      ? sumAmount(currentCreatedRows) / currentCreatedRows.length
      : 0
    : null;
  const avgDealSizePrevious = amountField
    ? previousCreatedRows.length > 0
      ? sumAmount(previousCreatedRows) / previousCreatedRows.length
      : 0
    : null;

  const computeCycleDays = (items: Array<{ createdDate: Date | null; closeDate: Date | null }>) => {
    const diffs = items
      .filter((item) => item.createdDate && item.closeDate)
      .map((item) => Number(item.closeDate!.getTime() - item.createdDate!.getTime()) / (1000 * 60 * 60 * 24))
      .filter((value) => Number.isFinite(value) && value >= 0);
    if (!diffs.length) return null;
    return diffs.reduce((acc, value) => acc + value, 0) / diffs.length;
  };

  const cycleCurrent = computeCycleDays(
    stageField ? currentClosedRows.filter(({ row }) => isWonStage(row?.[stageField]) || isLostStage(row?.[stageField])) : []
  );
  const cyclePrevious = computeCycleDays(
    stageField ? previousClosedRows.filter(({ row }) => isWonStage(row?.[stageField]) || isLostStage(row?.[stageField])) : []
  );

  const snapshots: ReportMetricSnapshot[] = [
    {
      metricKey: 'pipeline_created_amount',
      label: 'Pipeline Created Amount',
      valueCurrent: pipelineCurrent,
      valuePrevious: pipelinePrevious,
      deltaPct: safeDeltaPct(pipelineCurrent, pipelinePrevious),
      evidenceArtifactIds: params.evidenceArtifactIds
    },
    {
      metricKey: 'closed_won_amount',
      label: 'Closed Won Amount',
      valueCurrent: closedWonCurrent,
      valuePrevious: closedWonPrevious,
      deltaPct: safeDeltaPct(closedWonCurrent, closedWonPrevious),
      evidenceArtifactIds: params.evidenceArtifactIds
    },
    {
      metricKey: 'closed_lost_count',
      label: 'Closed Lost Count',
      valueCurrent: closedLostCurrent,
      valuePrevious: closedLostPrevious,
      deltaPct: safeDeltaPct(closedLostCurrent, closedLostPrevious),
      evidenceArtifactIds: params.evidenceArtifactIds
    },
    {
      metricKey: 'win_rate',
      label: 'Win Rate (%)',
      valueCurrent: winRateCurrent,
      valuePrevious: winRatePrevious,
      deltaPct: safeDeltaPct(winRateCurrent, winRatePrevious),
      evidenceArtifactIds: params.evidenceArtifactIds
    },
    {
      metricKey: 'avg_deal_size',
      label: 'Average Deal Size',
      valueCurrent: avgDealSizeCurrent,
      valuePrevious: avgDealSizePrevious,
      deltaPct: safeDeltaPct(avgDealSizeCurrent, avgDealSizePrevious),
      evidenceArtifactIds: params.evidenceArtifactIds
    },
    {
      metricKey: 'cycle_time_days',
      label: 'Cycle Time (days)',
      valueCurrent: cycleCurrent,
      valuePrevious: cyclePrevious,
      deltaPct: safeDeltaPct(cycleCurrent, cyclePrevious),
      evidenceArtifactIds: params.evidenceArtifactIds
    }
  ];

  const stageDistribution = new Map<string, { stage: string; count: number; amount: number }>();
  if (stageField) {
    currentCreatedRows.forEach(({ row }) => {
      const stage = String(row?.[stageField] || 'unknown');
      const amount = toFiniteNumber(amountField ? row?.[amountField] : null) || 0;
      const bucket = stageDistribution.get(stage) || { stage, count: 0, amount: 0 };
      bucket.count += 1;
      bucket.amount += amount;
      stageDistribution.set(stage, bucket);
    });
  }

  const ownerDistribution = new Map<string, number>();
  if (params.fieldMap.ownerField) {
    currentCreatedRows.forEach(({ row }) => {
      const owner = String(row?.[params.fieldMap.ownerField!] || 'unassigned');
      const amount = toFiniteNumber(amountField ? row?.[amountField] : null) || 0;
      ownerDistribution.set(owner, (ownerDistribution.get(owner) || 0) + (amountField ? amount : 1));
    });
  }

  const segmentField = params.fieldMap.segmentField || params.fieldMap.productField || params.fieldMap.customerField;
  const segmentCurrent = new Map<string, number>();
  const segmentPrevious = new Map<string, number>();
  if (segmentField) {
    currentCreatedRows.forEach(({ row }) => {
      const segment = String(row?.[segmentField] || 'unknown');
      segmentCurrent.set(segment, (segmentCurrent.get(segment) || 0) + 1);
    });
    previousCreatedRows.forEach(({ row }) => {
      const segment = String(row?.[segmentField] || 'unknown');
      segmentPrevious.set(segment, (segmentPrevious.get(segment) || 0) + 1);
    });
  }

  return {
    referenceDate,
    windowBounds,
    snapshots,
    sampleSizeCurrent: currentCreatedRows.length,
    sampleSizePrevious: previousCreatedRows.length,
    dailySeries: buildDailySeries({
      rows: params.rows,
      fieldMap: params.fieldMap,
      windowBounds
    }),
    stageDistribution: Array.from(stageDistribution.values()).sort((a, b) => b.count - a.count),
    ownerDistribution: Array.from(ownerDistribution.entries()).map(([owner, value]) => ({ owner, value })).sort((a, b) => b.value - a.value),
    segmentCurrent,
    segmentPrevious
  };
}

function detectRevOpsPatterns(params: {
  metrics: ReturnType<typeof computeRevOpsMetrics>;
  evidenceArtifactIds: number[];
}) {
  const patterns: Array<{
    id: string;
    title: string;
    statement: string;
    metricKey: string;
    valueCurrent: number | null;
    valuePrevious: number | null;
    deltaPct: number | null;
    confidence: ReportClaimConfidence;
    evidenceArtifactIds: number[];
  }> = [];

  const totalOwnerValue = params.metrics.ownerDistribution.reduce((acc, item) => acc + item.value, 0);
  if (params.metrics.ownerDistribution.length > 1 && totalOwnerValue > 0) {
    const topOwner = params.metrics.ownerDistribution[0];
    const share = topOwner.value / totalOwnerValue;
    if (share >= 0.45) {
      patterns.push({
        id: `pattern_owner_concentration_${Date.now()}`,
        title: 'Owner concentration risk',
        statement: `${topOwner.owner} accounts for ${(share * 100).toFixed(1)}% of tracked pipeline in the current window.`,
        metricKey: 'owner_concentration_risk',
        valueCurrent: share * 100,
        valuePrevious: null,
        deltaPct: null,
        confidence: getClaimConfidence(params.metrics.sampleSizeCurrent, false),
        evidenceArtifactIds: params.evidenceArtifactIds
      });
    }
  }

  if (params.metrics.stageDistribution.length > 1) {
    const totalCount = params.metrics.stageDistribution.reduce((acc, entry) => acc + entry.count, 0);
    const topStage = params.metrics.stageDistribution[0];
    if (totalCount > 0) {
      const share = topStage.count / totalCount;
      if (share >= 0.5 && !isWonStage(topStage.stage) && !isLostStage(topStage.stage)) {
        patterns.push({
          id: `pattern_stage_bottleneck_${Date.now()}`,
          title: 'Stage bottleneck risk',
          statement: `Stage "${topStage.stage}" contains ${(share * 100).toFixed(1)}% of current opportunities, indicating a potential bottleneck.`,
          metricKey: 'stage_bottleneck_risk',
          valueCurrent: share * 100,
          valuePrevious: null,
          deltaPct: null,
          confidence: getClaimConfidence(params.metrics.sampleSizeCurrent, false),
          evidenceArtifactIds: params.evidenceArtifactIds
        });
      }
    }
  }

  if (params.metrics.dailySeries.length >= 5) {
    const values = params.metrics.dailySeries.map((entry) => entry.pipeline_created_amount);
    const med = median(values);
    const mad = computeMad(values);
    const last = params.metrics.dailySeries[params.metrics.dailySeries.length - 1];
    if (med !== null && mad !== null && mad > 0) {
      const zScoreLike = Math.abs(last.pipeline_created_amount - med) / mad;
      if (zScoreLike >= 3) {
        patterns.push({
          id: `pattern_daily_volatility_${Date.now()}`,
          title: 'Daily volatility anomaly',
          statement: `Latest daily pipeline amount (${formatMetricValue(last.pipeline_created_amount)}) deviates sharply from recent baseline.`,
          metricKey: 'daily_volatility_anomaly',
          valueCurrent: last.pipeline_created_amount,
          valuePrevious: med,
          deltaPct: safeDeltaPct(last.pipeline_created_amount, med),
          confidence: 'medium',
          evidenceArtifactIds: params.evidenceArtifactIds
        });
      }
    }
  }

  const currentSegmentEntries = Array.from(params.metrics.segmentCurrent.entries()).sort((a, b) => b[1] - a[1]);
  const previousSegmentEntries = Array.from(params.metrics.segmentPrevious.entries()).sort((a, b) => b[1] - a[1]);
  if (currentSegmentEntries.length > 0 && previousSegmentEntries.length > 0) {
    const [currentSegment, currentCount] = currentSegmentEntries[0];
    const [previousSegment, previousCount] = previousSegmentEntries[0];
    const currentTotal = currentSegmentEntries.reduce((acc, entry) => acc + entry[1], 0);
    const previousTotal = previousSegmentEntries.reduce((acc, entry) => acc + entry[1], 0);
    if (currentTotal > 0 && previousTotal > 0) {
      const currentShare = currentCount / currentTotal;
      const previousShare = previousCount / previousTotal;
      const changedLeader = currentSegment !== previousSegment;
      const shareShift = Math.abs(currentShare - previousShare);
      if (changedLeader || shareShift >= 0.15) {
        patterns.push({
          id: `pattern_segment_shift_${Date.now()}`,
          title: 'Segment shift detected',
          statement: changedLeader
            ? `Top segment shifted from "${previousSegment}" to "${currentSegment}" in the current window.`
            : `Top segment "${currentSegment}" share moved by ${(shareShift * 100).toFixed(1)} points.`,
          metricKey: 'segment_shift',
          valueCurrent: currentShare * 100,
          valuePrevious: previousShare * 100,
          deltaPct: safeDeltaPct(currentShare * 100, previousShare * 100),
          confidence: getClaimConfidence(params.metrics.sampleSizeCurrent, true),
          evidenceArtifactIds: params.evidenceArtifactIds
        });
      }
    }
  }

  return patterns;
}

function createMetricClaim(params: {
  metric: ReportMetricSnapshot;
  sampleSize: number;
}): ReportClaim {
  const evidenceArtifactIds = params.metric.evidenceArtifactIds || [];
  const supported = evidenceArtifactIds.length > 0;
  const hasDelta = params.metric.deltaPct !== null && Number.isFinite(Number(params.metric.deltaPct));
  const direction = params.metric.deltaPct === null
    ? 'changed'
    : params.metric.deltaPct > 0
      ? 'increased'
      : params.metric.deltaPct < 0
        ? 'decreased'
        : 'remained flat';
  const statement = params.metric.valueCurrent === null
    ? `${params.metric.label} is unavailable due to insufficient mapped data.`
    : `${params.metric.label} is ${formatMetricValue(params.metric.valueCurrent)} and ${direction}${hasDelta ? ` by ${Math.abs(Number(params.metric.deltaPct)).toFixed(1)}%` : ''} versus previous period.`;

  return {
    id: `claim_${params.metric.metricKey}`,
    statement,
    metricKey: params.metric.metricKey,
    valueCurrent: params.metric.valueCurrent,
    valuePrevious: params.metric.valuePrevious,
    deltaPct: params.metric.deltaPct,
    confidence: getClaimConfidence(params.sampleSize, hasDelta),
    evidenceArtifactIds,
    supported
  };
}

function computeReportQuality(sections: ReportSection[]): ReportQuality {
  const claims = sections.flatMap((section) => section.claims || []);
  const unsupportedClaims = claims.filter((claim) => !claim.supported || !claim.evidenceArtifactIds?.length).length;
  const evidenceCoverageRatio = claims.length ? (claims.length - unsupportedClaims) / claims.length : 0;

  const blockers: string[] = [];
  if (unsupportedClaims > 0) {
    blockers.push(`${unsupportedClaims} claim(s) are missing evidence links.`);
  }

  const presentSectionTypes = new Set(sections.map((section) => section.type));
  REPORT_V2_REQUIRED_SECTION_TYPES.forEach((requiredType) => {
    if (!presentSectionTypes.has(requiredType)) {
      blockers.push(`Missing required section: ${requiredType}.`);
    }
  });

  return {
    evidenceCoverageRatio,
    unsupportedClaims,
    publishBlocked: blockers.length > 0,
    blockers
  };
}

function buildReportV2SlackPayload(params: {
  roomName: string;
  bundle: ReportV2Bundle;
  mentionTokens: string[];
}) {
  const topKpis = params.bundle.kpiSnapshot.slice(0, 3).map((metric) => {
    const deltaText = metric.deltaPct === null ? 'n/a' : `${metric.deltaPct.toFixed(1)}%`;
    return `- ${metric.label}: ${formatMetricValue(metric.valueCurrent)} (delta ${deltaText})`;
  });

  const patternSection = params.bundle.sections.find((section) => section.type === 'pattern');
  const patternLines = (patternSection?.claims || []).slice(0, 3).map((claim) => `- ${claim.statement}`);

  const recommendationSection = params.bundle.sections.find((section) => section.type === 'recommendation');
  const recommendationLines = (recommendationSection?.claims || []).slice(0, 3).map((claim) => `- ${claim.statement}`);

  const mentionLine = params.mentionTokens.length ? `\nNotify: ${params.mentionTokens.join(' ')}` : '';
  const text = [
    `Report V2 published for Decision Room "${params.roomName}".`,
    `Bundle: ${params.bundle.bundleId}`,
    `Evidence coverage: ${(params.bundle.quality.evidenceCoverageRatio * 100).toFixed(0)}%`,
    topKpis.length ? `Top KPIs:\n${topKpis.join('\n')}` : 'Top KPIs unavailable.',
    patternLines.length ? `Patterns:\n${patternLines.join('\n')}` : 'Patterns: none detected.',
    recommendationLines.length ? `Recommendations:\n${recommendationLines.join('\n')}` : 'Recommendations unavailable.'
  ].join('\n');

  return {
    text: `${text}${mentionLine}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Report V2: ${params.roomName}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Bundle:* ${params.bundle.bundleId}\n*Evidence coverage:* ${(params.bundle.quality.evidenceCoverageRatio * 100).toFixed(0)}%`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: topKpis.length ? `*Top KPIs*\n${topKpis.join('\n')}` : '*Top KPIs*\nNo KPI snapshot available.'
        }
      },
      ...(patternLines.length
        ? [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Patterns*\n${patternLines.join('\n')}`
            }
          }]
        : []),
      ...(recommendationLines.length
        ? [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Recommendations*\n${recommendationLines.join('\n')}`
            }
          }]
        : []),
      ...(params.mentionTokens.length
        ? [{
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Notify ${params.mentionTokens.join(' ')}`
              }
            ]
          }]
        : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Published at ${new Date().toISOString()}`
          }
        ]
      }
    ]
  };
}

async function isWorkspaceFeatureEnabled(workspaceId: number, flagKey: string, defaultValue: boolean = true): Promise<boolean> {
  try {
    const existsResult = await query(`SELECT to_regclass('public.workspace_feature_flags') AS table_name`);
    if (!existsResult.rows[0]?.table_name) {
      return defaultValue;
    }

    const flagResult = await query(
      `
      SELECT is_enabled
      FROM workspace_feature_flags
      WHERE workspace_id = $1 AND flag_key = $2
      LIMIT 1
      `,
      [workspaceId, flagKey]
    );
    if (flagResult.rows.length === 0) {
      return defaultValue;
    }
    return Boolean(flagResult.rows[0].is_enabled);
  } catch (err) {
    console.warn('Workspace feature flag lookup failed, using default:', err);
    return defaultValue;
  }
}

async function resolveStudioFeatureFlags(workspaceId: number) {
  const [legacySurfacesEnabled, visualsTabEnabled, commsTabEnabled] = await Promise.all([
    isWorkspaceFeatureEnabled(workspaceId, 'legacy_surfaces_enabled', false),
    isWorkspaceFeatureEnabled(workspaceId, 'studio_visuals_tab_enabled', true),
    isWorkspaceFeatureEnabled(workspaceId, 'studio_comms_tab_enabled', true)
  ]);

  return {
    legacySurfacesEnabled,
    visualsTabEnabled,
    commsTabEnabled
  };
}

async function getLatestReportV2BundleId(workspaceId: number, roomId: number): Promise<string | null> {
  const result = await query(
    `
    SELECT payload->>'bundleId' AS bundle_id
    FROM artifacts
    WHERE workspace_id = $1
      AND room_id = $2
      AND artifact_type = 'report_block'
      AND payload->>'reportVersion' = 'v2'
      AND payload ? 'bundleId'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [workspaceId, roomId]
  );
  const bundleId = String(result.rows[0]?.bundle_id || '');
  return bundleId || null;
}

function normalizeReportSectionFromArtifact(row: any): ReportSection | null {
  const payload = parseJsonMaybe<Record<string, any>>(row.payload, {});
  if (!payload || payload.reportVersion !== 'v2') return null;

  const claimsRaw = Array.isArray(payload.claims) ? payload.claims : [];
  const claims: ReportClaim[] = claimsRaw.map((claim, index) => ({
    id: String(claim?.id || `${payload.sectionType || 'section'}_claim_${index + 1}`),
    statement: String(claim?.statement || ''),
    metricKey: String(claim?.metricKey || 'unknown'),
    valueCurrent: claim?.valueCurrent === null || claim?.valueCurrent === undefined ? null : Number(claim.valueCurrent),
    valuePrevious: claim?.valuePrevious === null || claim?.valuePrevious === undefined ? null : Number(claim.valuePrevious),
    deltaPct: claim?.deltaPct === null || claim?.deltaPct === undefined ? null : Number(claim.deltaPct),
    confidence: (claim?.confidence || 'medium') as ReportClaimConfidence,
    evidenceArtifactIds: Array.isArray(claim?.evidenceArtifactIds)
      ? claim.evidenceArtifactIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
      : [],
    supported: Boolean(claim?.supported)
  }));

  return {
    id: String(payload.sectionId || row.id),
    type: (payload.sectionType || 'explanation') as ReportSectionType,
    title: String(payload.title || row.title || 'Report section'),
    contentMarkdown: String(payload.contentMarkdown || ''),
    claims,
    chartArtifactIds: Array.isArray(payload.chartArtifactIds)
      ? payload.chartArtifactIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
      : []
  };
}

async function loadReportV2Bundle(workspaceId: number, roomId: number, bundleId: string): Promise<ReportV2Bundle | null> {
  const sectionResult = await query(
    `
    SELECT id, title, payload, metadata, created_at
    FROM artifacts
    WHERE workspace_id = $1
      AND room_id = $2
      AND artifact_type = 'report_block'
      AND payload->>'bundleId' = $3
      AND payload->>'reportVersion' = 'v2'
    ORDER BY COALESCE(NULLIF(payload->>'order', '')::int, 1000), created_at ASC
    `,
    [workspaceId, roomId, bundleId]
  );

  if (sectionResult.rows.length === 0) return null;

  const sections = sectionResult.rows
    .map((row) => normalizeReportSectionFromArtifact(row))
    .filter((section): section is ReportSection => Boolean(section));

  const firstPayload = parseJsonMaybe<Record<string, any>>(sectionResult.rows[0].payload, {});
  const generatedAt = String(firstPayload.generatedAt || sectionResult.rows[0].created_at || new Date().toISOString());

  const kpiSnapshotRaw = Array.isArray(firstPayload.kpiSnapshot) ? firstPayload.kpiSnapshot : [];
  const kpiSnapshot: ReportMetricSnapshot[] = kpiSnapshotRaw.map((metric) => ({
    metricKey: String(metric?.metricKey || 'unknown'),
    label: String(metric?.label || metric?.metricKey || 'Metric'),
    valueCurrent: metric?.valueCurrent === null || metric?.valueCurrent === undefined ? null : Number(metric.valueCurrent),
    valuePrevious: metric?.valuePrevious === null || metric?.valuePrevious === undefined ? null : Number(metric.valuePrevious),
    deltaPct: metric?.deltaPct === null || metric?.deltaPct === undefined ? null : Number(metric.deltaPct),
    evidenceArtifactIds: Array.isArray(metric?.evidenceArtifactIds)
      ? metric.evidenceArtifactIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
      : []
  }));

  const inputRequirementsPayload = parseJsonMaybe<Record<string, any>>(firstPayload.inputRequirements, firstPayload.inputRequirements || {});
  const inputRequirements: ReportInputRequirements = {
    mappedFields: inputRequirementsPayload?.mappedFields && typeof inputRequirementsPayload.mappedFields === 'object'
      ? inputRequirementsPayload.mappedFields
      : {},
    missingFields: Array.isArray(inputRequirementsPayload?.missingFields)
      ? inputRequirementsPayload.missingFields.map((field: any) => String(field))
      : [],
    warnings: Array.isArray(inputRequirementsPayload?.warnings)
      ? inputRequirementsPayload.warnings.map((warning: any) => String(warning))
      : []
  };

  const summaryResult = await query(
    `
    SELECT id
    FROM artifacts
    WHERE workspace_id = $1
      AND room_id = $2
      AND artifact_type = 'decision_brief'
      AND payload->>'bundleId' = $3
      AND payload->>'reportVersion' = 'v2'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [workspaceId, roomId, bundleId]
  );

  const quality = computeReportQuality(sections);

  return {
    bundleId,
    roomId,
    generatedAt,
    quality,
    sections,
    kpiSnapshot,
    inputRequirements,
    summaryArtifactId: summaryResult.rows.length ? Number(summaryResult.rows[0].id) : null
  };
}

async function evaluateBundleClaimSupport(workspaceId: number, roomId: number, bundle: ReportV2Bundle) {
  const claims = bundle.sections.flatMap((section) => section.claims.map((claim) => ({
    sectionId: section.id,
    sectionType: section.type,
    claim
  })));

  const allEvidenceIds = Array.from(new Set(
    claims.flatMap((entry) => entry.claim.evidenceArtifactIds).filter((id) => Number.isFinite(id))
  ));

  const existingEvidence = new Set<number>();
  if (allEvidenceIds.length > 0) {
    const evidenceResult = await query(
      `
      SELECT id
      FROM artifacts
      WHERE workspace_id = $1
        AND room_id = $2
        AND id = ANY($3::int[])
      `,
      [workspaceId, roomId, allEvidenceIds]
    );
    evidenceResult.rows.forEach((row) => existingEvidence.add(Number(row.id)));
  }

  const claimChecks = claims.map((entry) => {
    const missingEvidenceIds = entry.claim.evidenceArtifactIds.filter((id) => !existingEvidence.has(id));
    const hasEvidence = entry.claim.evidenceArtifactIds.length > 0;
    const supported = hasEvidence && missingEvidenceIds.length === 0;
    return {
      sectionId: entry.sectionId,
      sectionType: entry.sectionType,
      claimId: entry.claim.id,
      statement: entry.claim.statement,
      supported,
      evidenceArtifactIds: entry.claim.evidenceArtifactIds,
      missingEvidenceArtifactIds: missingEvidenceIds,
      blockingIssues: supported
        ? []
        : [
            !hasEvidence ? 'Claim is missing evidence artifact links.' : '',
            ...missingEvidenceIds.map((id) => `Evidence artifact ${id} not found in room.`)
          ].filter(Boolean)
    };
  });

  const unsupportedClaims = claimChecks.filter((check) => !check.supported).length;
  const evidenceCoverageRatio = claimChecks.length ? (claimChecks.length - unsupportedClaims) / claimChecks.length : 0;
  const blockers = claimChecks.flatMap((check) => check.blockingIssues);

  return {
    claimChecks,
    quality: {
      evidenceCoverageRatio,
      unsupportedClaims,
      publishBlocked: unsupportedClaims > 0,
      blockers
    } as ReportQuality
  };
}

async function evaluateBundleMetricPolicy(workspaceId: number, bundle: ReportV2Bundle): Promise<MetricPolicyEvaluation> {
  const metricKeys = Array.from(new Set(
    bundle.sections
      .flatMap((section) => section.claims || [])
      .map((claim) => String(claim.metricKey || '').trim())
      .filter(Boolean)
  ));

  if (metricKeys.length === 0) {
    return {
      checks: [],
      publishBlocked: false,
      blockers: []
    };
  }

  const metricResult = await query(
    `
    SELECT
      m.id,
      m.metric_key,
      m.owner_id,
      COALESCE(u.full_name, u.email) AS owner_name,
      latest_test.status AS latest_status,
      latest_test.last_run_at AS last_validated_at
    FROM metric_definitions m
    LEFT JOIN users u ON u.id = m.owner_id
    LEFT JOIN LATERAL (
      SELECT status, last_run_at
      FROM metric_definition_tests t
      WHERE t.metric_definition_id = m.id
        AND t.workspace_id = $1
      ORDER BY last_run_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    ) latest_test ON TRUE
    WHERE m.workspace_id = $1
      AND m.metric_key = ANY($2::text[])
    `,
    [workspaceId, metricKeys]
  );

  const metricByKey = new Map<string, any>();
  metricResult.rows.forEach((row) => {
    metricByKey.set(String(row.metric_key || ''), row);
  });

  const checks: MetricPolicyCheck[] = metricKeys.map((metricKey) => {
    const row = metricByKey.get(metricKey);
    if (!row) {
      return {
        metricKey,
        metricDefinitionId: null,
        ownerId: null,
        ownerName: null,
        status: 'not_mapped',
        blocking: false,
        reason: 'Metric key is not mapped to semantic metric definitions in this workspace.',
        lastValidatedAt: null
      };
    }

    const latestStatus = String(row.latest_status || '').toLowerCase();
    if (!latestStatus) {
      return {
        metricKey,
        metricDefinitionId: Number(row.id),
        ownerId: row.owner_id ? Number(row.owner_id) : null,
        ownerName: row.owner_name ? String(row.owner_name) : null,
        status: 'missing_test',
        blocking: true,
        reason: 'Metric has no validation run yet. Run metric validation before publish.',
        lastValidatedAt: null
      };
    }

    if (latestStatus === 'passed') {
      return {
        metricKey,
        metricDefinitionId: Number(row.id),
        ownerId: row.owner_id ? Number(row.owner_id) : null,
        ownerName: row.owner_name ? String(row.owner_name) : null,
        status: 'passed',
        blocking: false,
        reason: 'Metric passed latest validation.',
        lastValidatedAt: row.last_validated_at || null
      };
    }

    if (latestStatus === 'failed') {
      return {
        metricKey,
        metricDefinitionId: Number(row.id),
        ownerId: row.owner_id ? Number(row.owner_id) : null,
        ownerName: row.owner_name ? String(row.owner_name) : null,
        status: 'failed',
        blocking: true,
        reason: 'Metric failed latest validation and is blocked for publish.',
        lastValidatedAt: row.last_validated_at || null
      };
    }

    return {
      metricKey,
      metricDefinitionId: Number(row.id),
      ownerId: row.owner_id ? Number(row.owner_id) : null,
      ownerName: row.owner_name ? String(row.owner_name) : null,
      status: 'pending',
      blocking: true,
      reason: `Metric validation status is "${latestStatus}" and must be passed before publish.`,
      lastValidatedAt: row.last_validated_at || null
    };
  });

  const blockingChecks = checks.filter((check) => check.blocking);
  const blockers = blockingChecks.map((check) => `${check.metricKey}: ${check.reason}`);
  return {
    checks,
    publishBlocked: blockingChecks.length > 0,
    blockers
  };
}

async function resolveRoomRowsAndEvidence(workspaceId: number, room: any) {
  const roomId = Number(room.id);
  const artifacts = await listRoomArtifacts(workspaceId, roomId, 500);
  const evidenceArtifactIds = artifacts
    .filter((artifact) => EVIDENCE_ARTIFACT_TYPES.includes(String(artifact.artifact_type)))
    .map((artifact) => Number(artifact.id))
    .filter((id) => Number.isFinite(id))
    .slice(0, 80);

  let rows: Record<string, any>[] = [];
  for (const artifact of artifacts) {
    if (!['query_run', 'pivot', 'dataset_version', 'chart'].includes(String(artifact.artifact_type))) continue;
    const parsed = parseArtifactRowsFromPayload(artifact.payload || {});
    if (parsed.length > 0) {
      rows = parsed;
      break;
    }
  }

  if (!rows.length) {
    const runContext = parseRoomRunContext(room.run_context);
    const source = await resolveDatasetRows(workspaceId, undefined, {
      datasetId: runContext.datasetId || runContext.sourceDatasetId || null
    });
    rows = source.rows;
  }

  return {
    rows,
    columns: extractColumns(rows),
    artifacts,
    evidenceArtifactIds
  };
}

function applyVisualFilters(
  rows: Record<string, any>[],
  filters?: Array<{ field: string; operator?: string; value: any }>
) {
  if (!Array.isArray(filters) || filters.length === 0) return rows;

  return rows.filter((row) => {
    return filters.every((filter) => {
      const field = String(filter?.field || '');
      if (!field) return true;
      const operator = String(filter?.operator || 'eq').toLowerCase();
      const expected = filter?.value;
      const current = row?.[field];

      switch (operator) {
        case 'neq':
          return current !== expected;
        case 'gt':
          return Number(current) > Number(expected);
        case 'gte':
          return Number(current) >= Number(expected);
        case 'lt':
          return Number(current) < Number(expected);
        case 'lte':
          return Number(current) <= Number(expected);
        case 'contains':
          return String(current ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
        case 'in':
          return Array.isArray(expected) ? expected.includes(current) : false;
        case 'eq':
        default:
          return String(current ?? '') === String(expected ?? '');
      }
    });
  });
}

function buildVisualData(rows: Record<string, any>[], spec: VisualBuildSpec) {
  const dimensions = Array.isArray(spec.dimensions) ? spec.dimensions.filter(Boolean) : [];
  const measures = Array.isArray(spec.measures) ? spec.measures.filter(Boolean) : [];
  const filteredRows = applyVisualFilters(rows, spec.filters);

  if (!filteredRows.length) return [];
  if (!dimensions.length) {
    if (!measures.length) {
      return [{ label: 'all_rows', value: filteredRows.length }];
    }
    const totals: Record<string, any> = { label: 'all_rows', count: filteredRows.length };
    measures.forEach((measure) => {
      totals[measure] = filteredRows.reduce((acc, row) => acc + (toFiniteNumber(row?.[measure]) || 0), 0);
    });
    return [totals];
  }

  const grouped = new Map<string, Record<string, any>>();
  for (const row of filteredRows) {
    const keyParts = dimensions.map((dimension) => String(row?.[dimension] ?? '(blank)'));
    const key = keyParts.join('||');
    const existing = grouped.get(key) || {
      count: 0
    };

    dimensions.forEach((dimension, index) => {
      existing[dimension] = keyParts[index];
    });
    existing.count += 1;

    if (measures.length > 0) {
      measures.forEach((measure) => {
        existing[measure] = Number(existing[measure] || 0) + (toFiniteNumber(row?.[measure]) || 0);
      });
    } else {
      existing.value = Number(existing.value || 0) + 1;
    }

    grouped.set(key, existing);
  }

  const aggregated = Array.from(grouped.values());
  const sortMetric = measures[0] || 'value';
  return aggregated
    .sort((a, b) => Number(b?.[sortMetric] || b?.count || 0) - Number(a?.[sortMetric] || a?.count || 0))
    .slice(0, 500);
}

function buildDrillData(
  rows: Record<string, any>[],
  spec: VisualBuildSpec,
  level: number,
  pathValues: Record<string, any>
) {
  const drillPath = (Array.isArray(spec.drillPath) && spec.drillPath.length ? spec.drillPath : spec.dimensions || [])
    .filter(Boolean);
  if (!drillPath.length) {
    return { nextDimension: null, rows: rows.slice(0, 500) };
  }

  const boundedLevel = Math.max(0, Math.min(level, drillPath.length - 1));
  const appliedFilters = drillPath
    .slice(0, boundedLevel + 1)
    .map((dimension) => ({
      field: dimension,
      operator: 'eq',
      value: pathValues?.[dimension]
    }))
    .filter((filter) => filter.value !== undefined && filter.value !== null && filter.value !== '');

  const scopedRows = applyVisualFilters(rows, [...(spec.filters || []), ...appliedFilters]);
  const nextDimension = drillPath[boundedLevel + 1] || null;
  if (!nextDimension) {
    return { nextDimension: null, rows: scopedRows.slice(0, 500) };
  }

  const nextSpec: VisualBuildSpec = {
    ...spec,
    dimensions: [nextDimension],
    drillPath
  };
  return {
    nextDimension,
    rows: buildVisualData(scopedRows, nextSpec)
  };
}

function buildPivotData(
  rows: Record<string, any>[],
  spec: PivotComputeSpec
): Record<string, any>[] {
  const dimensions = Array.isArray(spec.dimensions) ? spec.dimensions.filter(Boolean) : [];
  const measureInput = Array.isArray(spec.measures) ? spec.measures : [];
  const filters = Array.isArray(spec.filters) ? spec.filters : [];
  const calculations = Array.isArray(spec.calculations) ? spec.calculations : [];

  const measures = measureInput.map((measure, index) => {
    if (typeof measure === 'string') {
      return {
        field: measure,
        agg: 'sum' as const,
        as: measure
      };
    }
    const field = String(measure?.field || '');
    const aggRaw = String(measure?.agg || 'sum').toLowerCase();
    const agg = ['sum', 'avg', 'count', 'min', 'max'].includes(aggRaw)
      ? (aggRaw as 'sum' | 'avg' | 'count' | 'min' | 'max')
      : 'sum';
    const alias = String(measure?.as || field || `measure_${index + 1}`);
    return {
      field,
      agg,
      as: alias
    };
  }).filter((measure) => Boolean(measure.as));

  const filteredRows = applyVisualFilters(rows, filters);
  const grouped = new Map<string, Record<string, any>>();

  for (const row of filteredRows) {
    const keyParts = dimensions.map((dimension) => String(row?.[dimension] ?? '(blank)'));
    const key = dimensions.length ? keyParts.join('||') : '__all__';
    const aggregate = grouped.get(key) || {};

    if (dimensions.length === 0) {
      aggregate.group = 'all_rows';
    } else {
      dimensions.forEach((dimension, idx) => {
        aggregate[dimension] = keyParts[idx];
      });
    }

    aggregate.__rowCount = Number(aggregate.__rowCount || 0) + 1;

    for (const measure of measures) {
      const alias = measure.as;
      const numericValue = toFiniteNumber(row?.[measure.field] ?? 0) || 0;
      const currentValue = Number(aggregate[alias] || 0);

      if (measure.agg === 'count') {
        aggregate[alias] = currentValue + 1;
      } else if (measure.agg === 'sum') {
        aggregate[alias] = currentValue + numericValue;
      } else if (measure.agg === 'min') {
        const existing = aggregate[alias];
        aggregate[alias] = existing === undefined ? numericValue : Math.min(Number(existing), numericValue);
      } else if (measure.agg === 'max') {
        const existing = aggregate[alias];
        aggregate[alias] = existing === undefined ? numericValue : Math.max(Number(existing), numericValue);
      } else if (measure.agg === 'avg') {
        const sumKey = `${alias}__sum`;
        const countKey = `${alias}__count`;
        aggregate[sumKey] = Number(aggregate[sumKey] || 0) + numericValue;
        aggregate[countKey] = Number(aggregate[countKey] || 0) + 1;
      }
    }

    grouped.set(key, aggregate);
  }

  const pivotRows = Array.from(grouped.values()).map((entry) => {
    const next = { ...entry };
    for (const measure of measures) {
      if (measure.agg === 'avg') {
        const sumKey = `${measure.as}__sum`;
        const countKey = `${measure.as}__count`;
        const sum = Number(next[sumKey] || 0);
        const count = Number(next[countKey] || 0);
        next[measure.as] = count > 0 ? toRounded(sum / count, 6) : 0;
        delete next[sumKey];
        delete next[countKey];
      }
    }
    return next;
  });

  for (const calculation of calculations) {
    const type = String(calculation?.type || '').toLowerCase();
    const sourceField = String(calculation?.sourceField || '');
    const alias = String(calculation?.as || `${sourceField}_${type}` || 'calc');
    if (!alias) continue;

    if (type === 'percent_of_total') {
      const total = pivotRows.reduce((acc, row) => acc + (toFiniteNumber(row?.[sourceField]) || 0), 0);
      pivotRows.forEach((row) => {
        const value = toFiniteNumber(row?.[sourceField]) || 0;
        row[alias] = total > 0 ? toRounded((value / total) * 100, 4) : 0;
      });
    } else if (type === 'rank') {
      const order = String(calculation?.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const sorted = [...pivotRows]
        .map((row, index) => ({ row, index, value: toFiniteNumber(row?.[sourceField]) || 0 }))
        .sort((a, b) => order === 'asc' ? a.value - b.value : b.value - a.value);
      sorted.forEach((entry, index) => {
        entry.row[alias] = index + 1;
      });
    } else if (type === 'formula') {
      const expression = String(calculation?.expression || '').trim();
      if (!expression) continue;
      pivotRows.forEach((row) => {
        const result = SafeExecutor.execute(expression, row, 200);
        row[alias] = result.success ? result.result : null;
      });
    }
  }

  const primaryMeasure = measures[0]?.as || dimensions[0] || '__rowCount';
  return pivotRows
    .sort((a, b) => {
      const aValue = toFiniteNumber(a?.[primaryMeasure]);
      const bValue = toFiniteNumber(b?.[primaryMeasure]);
      return (bValue || 0) - (aValue || 0);
    })
    .slice(0, 2000)
    .map((row) => {
      const cleaned: Record<string, any> = {};
      Object.keys(row).forEach((key) => {
        if (!key.startsWith('__')) {
          cleaned[key] = row[key];
        }
      });
      return cleaned;
    });
}

function parseRetryPolicy(input: any) {
  const fallback = { maxAttempts: 3, backoffMs: 300 };
  if (!input || typeof input !== 'object') return fallback;
  const maxAttempts = Number(input.maxAttempts);
  const backoffMs = Number(input.backoffMs);
  return {
    maxAttempts: Number.isFinite(maxAttempts) ? Math.max(1, Math.min(20, Math.floor(maxAttempts))) : fallback.maxAttempts,
    backoffMs: Number.isFinite(backoffMs) ? Math.max(50, Math.min(120000, Math.floor(backoffMs))) : fallback.backoffMs
  };
}

function computeStableKeyHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildDeterministicScheduleDedupeKey(params: {
  roomId: number;
  automationPolicyId: number;
  cron: string;
  timezone: string;
}) {
  const normalizedCron = String(params.cron || '').trim().replace(/\s+/g, ' ');
  const normalizedTimezone = String(params.timezone || 'UTC').trim().toLowerCase();
  const fingerprint = `${params.roomId}|${params.automationPolicyId}|${normalizedCron}|${normalizedTimezone}`;
  return `room-${params.roomId}-policy-${params.automationPolicyId}-${computeStableKeyHash(fingerprint)}`;
}

function isLikelyCronExpression(cron: string): boolean {
  const parts = String(cron || '').trim().split(/\s+/g).filter(Boolean);
  return parts.length >= 5 && parts.length <= 6;
}

function computeNextRunAtFromCronExpression(cron: string, timezone: string): string {
  try {
    const expression = CronExpressionParser.parse(cron, {
      currentDate: new Date(),
      tz: timezone || 'UTC'
    });
    return expression.next().toDate().toISOString();
  } catch {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }
}

function toAutomationScheduleRecord(row: any): AutomationScheduleRecord {
  return {
    id: Number(row.id),
    workspaceId: Number(row.workspace_id),
    roomId: row.room_id ? Number(row.room_id) : null,
    automationPolicyId: Number(row.automation_policy_id),
    cron: String(row.cron || ''),
    timezone: String(row.timezone || 'UTC'),
    dedupeKey: row.dedupe_key ? String(row.dedupe_key) : null,
    retryPolicy: parseJsonMaybe(row.retry_policy, { maxAttempts: 3, backoffMs: 300 }),
    isActive: Boolean(row.is_active),
    nextRunAt: row.next_run_at || null,
    lastRunAt: row.last_run_at || null,
    createdAt: row.created_at
  };
}

function toRounded(value: number, digits: number = 4): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeIdempotencyKey(input: any): string | null {
  const value = String(input || '').trim();
  if (!value) return null;
  return value.slice(0, 180);
}

function resolveIdempotencyKey(req: WorkspaceRequest): string | null {
  const header = req.headers['idempotency-key'];
  const headerValue = Array.isArray(header) ? header[0] : header;
  const bodyValue = req.body?.idempotencyKey;
  return normalizeIdempotencyKey(headerValue || bodyValue);
}

interface IdempotencyStartResult {
  idempotencyKey: string | null;
  replay?: { statusCode: number; payload: Record<string, any> };
  inProgress?: boolean;
}

async function beginIdempotentOperation(params: {
  workspaceId: number;
  roomId: number | null;
  endpointKey: string;
  userId: string;
  idempotencyKey: string | null;
}): Promise<IdempotencyStartResult> {
  if (!params.idempotencyKey) {
    return { idempotencyKey: null };
  }

  const readExisting = async () => {
    const existing = await query(
      `
      SELECT id, status_code, response_payload, completed_at
      FROM idempotency_keys
      WHERE workspace_id = $1
        AND endpoint_key = $2
        AND idempotency_key = $3
        AND (($4::int IS NULL AND room_id IS NULL) OR room_id = $4)
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [params.workspaceId, params.endpointKey, params.idempotencyKey, params.roomId]
    );

    if (existing.rows.length === 0) return null;
    return existing.rows[0];
  };

  const existingBeforeInsert = await readExisting();
  if (existingBeforeInsert?.completed_at) {
    return {
      idempotencyKey: params.idempotencyKey,
      replay: {
        statusCode: Number(existingBeforeInsert.status_code || 200),
        payload: parseJsonMaybe(existingBeforeInsert.response_payload, {})
      }
    };
  }
  if (existingBeforeInsert && !existingBeforeInsert.completed_at) {
    return {
      idempotencyKey: params.idempotencyKey,
      inProgress: true
    };
  }

  await query(
    `
    INSERT INTO idempotency_keys (
      workspace_id,
      room_id,
      endpoint_key,
      idempotency_key,
      created_by,
      response_payload
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (workspace_id, room_id, endpoint_key, idempotency_key) DO NOTHING
    `,
    [
      params.workspaceId,
      params.roomId,
      params.endpointKey,
      params.idempotencyKey,
      params.userId,
      JSON.stringify({})
    ]
  );

  const existingAfterInsert = await readExisting();
  if (existingAfterInsert?.completed_at) {
    return {
      idempotencyKey: params.idempotencyKey,
      replay: {
        statusCode: Number(existingAfterInsert.status_code || 200),
        payload: parseJsonMaybe(existingAfterInsert.response_payload, {})
      }
    };
  }
  if (!existingAfterInsert) {
    return { idempotencyKey: params.idempotencyKey };
  }

  return {
    idempotencyKey: params.idempotencyKey
  };
}

async function completeIdempotentOperation(params: {
  workspaceId: number;
  roomId: number | null;
  endpointKey: string;
  idempotencyKey: string | null;
  statusCode: number;
  payload: Record<string, any>;
}) {
  if (!params.idempotencyKey) return;

  await query(
    `
    UPDATE idempotency_keys
    SET status_code = $5,
        response_payload = $6,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE workspace_id = $1
      AND endpoint_key = $2
      AND idempotency_key = $3
      AND (($4::int IS NULL AND room_id IS NULL) OR room_id = $4)
    `,
    [
      params.workspaceId,
      params.endpointKey,
      params.idempotencyKey,
      params.roomId,
      params.statusCode,
      JSON.stringify(params.payload || {})
    ]
  );
}

function computeDatasetProfile(params: {
  rows: Record<string, any>[];
  columns: string[];
  datasetVersionId: number | null;
}): DatasetProfileArtifact {
  const rows = Array.isArray(params.rows) ? params.rows : [];
  const columns = Array.isArray(params.columns) ? params.columns.filter(Boolean) : [];
  const rowCount = rows.length;
  const totalCount = Math.max(rowCount, 1);

  const missingness = columns.map((field) => {
    let missingCount = 0;
    for (const row of rows) {
      const value = row?.[field];
      if (value === null || value === undefined || String(value).trim() === '') {
        missingCount += 1;
      }
    }
    return {
      field,
      missingCount,
      totalCount: rowCount,
      ratio: toRounded(missingCount / totalCount, 5)
    };
  });

  const duplicateCandidates = columns.filter((field) => {
    const normalized = normalizeFieldName(field);
    return normalized.includes('id') || normalized.includes('email') || normalized.includes('name');
  });
  const dedupeFields = (duplicateCandidates.length ? duplicateCandidates : columns.slice(0, 2)).slice(0, 5);
  const duplicateKeys = dedupeFields.map((field) => {
    const seen = new Map<string, number>();
    for (const row of rows) {
      const raw = row?.[field];
      if (raw === null || raw === undefined || String(raw).trim() === '') continue;
      const key = String(raw).trim().toLowerCase();
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    const nonNull = Array.from(seen.values()).reduce((acc, count) => acc + count, 0);
    const duplicateCount = Array.from(seen.values()).reduce((acc, count) => acc + (count > 1 ? count - 1 : 0), 0);
    const ratio = nonNull > 0 ? duplicateCount / nonNull : 0;
    return {
      field,
      duplicateCount,
      totalCount: nonNull,
      ratio: toRounded(ratio, 5)
    };
  });

  const dateContinuity = columns
    .filter((field) => {
      const nonEmpty = rows.filter((row) => row?.[field] !== null && row?.[field] !== undefined && String(row?.[field]).trim() !== '');
      if (nonEmpty.length < 3) return false;
      const parseable = nonEmpty.filter((row) => Boolean(toDateMaybe(row?.[field]))).length;
      return parseable / nonEmpty.length >= 0.6;
    })
    .slice(0, 5)
    .map((field) => {
      const dates = rows
        .map((row) => toDateMaybe(row?.[field]))
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => a.getTime() - b.getTime());

      if (dates.length < 2) {
        return { field, expectedDays: 0, observedDays: dates.length, continuityRatio: 1 };
      }

      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      const expectedDays = Math.max(
        1,
        Math.floor((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      );
      const observedDays = new Set(dates.map((date) => toIsoDate(date))).size;
      return {
        field,
        expectedDays,
        observedDays,
        continuityRatio: toRounded(clampUnit(observedDays / expectedDays), 5)
      };
    });

  const invalidNumerics = columns
    .filter((field) => {
      const nonEmpty = rows.filter((row) => row?.[field] !== null && row?.[field] !== undefined && String(row?.[field]).trim() !== '');
      if (nonEmpty.length < 3) return false;
      const numericLike = nonEmpty.filter((row) => {
        const value = row?.[field];
        if (typeof value === 'number') return Number.isFinite(value);
        return Number.isFinite(Number(String(value).replace(/,/g, '').trim()));
      }).length;
      return numericLike / nonEmpty.length >= 0.5;
    })
    .slice(0, 8)
    .map((field) => {
      const nonEmpty = rows.filter((row) => row?.[field] !== null && row?.[field] !== undefined && String(row?.[field]).trim() !== '');
      const invalidCount = nonEmpty.filter((row) => {
        const value = row?.[field];
        if (typeof value === 'number') return !Number.isFinite(value);
        return !Number.isFinite(Number(String(value).replace(/,/g, '').trim()));
      }).length;
      const checked = nonEmpty.length;
      return {
        field,
        invalidCount,
        totalChecked: checked,
        ratio: checked > 0 ? toRounded(invalidCount / checked, 5) : 0
      };
    });

  const missingPenalty = missingness.length
    ? missingness.reduce((acc, item) => acc + item.ratio, 0) / missingness.length
    : 0;
  const duplicatePenalty = duplicateKeys.length
    ? Math.max(...duplicateKeys.map((item) => item.ratio))
    : 0;
  const datePenalty = dateContinuity.length
    ? dateContinuity.reduce((acc, item) => acc + (1 - item.continuityRatio), 0) / dateContinuity.length
    : 0;
  const numericPenalty = invalidNumerics.length
    ? invalidNumerics.reduce((acc, item) => acc + item.ratio, 0) / invalidNumerics.length
    : 0;

  const qualityScore = toRounded(clampUnit(1 - (
    (0.35 * missingPenalty) +
    (0.25 * duplicatePenalty) +
    (0.2 * datePenalty) +
    (0.2 * numericPenalty)
  )), 5);

  const topIssues: string[] = [];
  const worstMissing = [...missingness].sort((a, b) => b.ratio - a.ratio)[0];
  if (worstMissing && worstMissing.ratio >= 0.2) {
    topIssues.push(`High missingness in "${worstMissing.field}" (${(worstMissing.ratio * 100).toFixed(1)}%).`);
  }
  const worstDuplicate = [...duplicateKeys].sort((a, b) => b.ratio - a.ratio)[0];
  if (worstDuplicate && worstDuplicate.ratio >= 0.05) {
    topIssues.push(`Duplicate key risk in "${worstDuplicate.field}" (${(worstDuplicate.ratio * 100).toFixed(1)}%).`);
  }
  const worstDate = [...dateContinuity].sort((a, b) => a.continuityRatio - b.continuityRatio)[0];
  if (worstDate && worstDate.continuityRatio < 0.8) {
    topIssues.push(`Date continuity gap in "${worstDate.field}" (${(worstDate.continuityRatio * 100).toFixed(1)}%).`);
  }
  const worstNumeric = [...invalidNumerics].sort((a, b) => b.ratio - a.ratio)[0];
  if (worstNumeric && worstNumeric.ratio >= 0.05) {
    topIssues.push(`Invalid numeric values in "${worstNumeric.field}" (${(worstNumeric.ratio * 100).toFixed(1)}%).`);
  }

  return {
    datasetVersionId: params.datasetVersionId,
    qualityScore,
    missingness,
    duplicateKeys,
    dateContinuity,
    invalidNumerics,
    generatedAt: new Date().toISOString(),
    summary: {
      rowCount,
      columnCount: columns.length,
      topIssues
    }
  };
}

function toQueryVersionRecord(row: any): QueryVersion {
  return {
    id: Number(row.id),
    queryId: row.query_id ? Number(row.query_id) : null,
    versionNumber: Number(row.version_number || 1),
    sqlTemplate: String(row.sql_template || ''),
    parametersSchema: parseJsonMaybe<Record<string, any>>(row.parameters_schema, {}),
    metadata: parseJsonMaybe<Record<string, any>>(row.metadata, {}),
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: String(row.created_at)
  };
}

function toVisualAnnotationRecord(row: any): VisualAnnotation {
  return {
    id: Number(row.id),
    visualId: Number(row.visual_id),
    text: String(row.text || ''),
    anchor: parseJsonMaybe<Record<string, any>>(row.anchor, {}),
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: String(row.created_at)
  };
}

function toReviewSubmissionRecord(row: any): ReviewSubmission {
  return {
    id: Number(row.id),
    roomId: Number(row.room_id),
    bundleId: String(row.bundle_id || ''),
    stage: String(row.stage || 'manager_review'),
    status: String(row.status || 'pending') as ReviewSubmission['status'],
    submittedBy: row.submitted_by ? Number(row.submitted_by) : null,
    submittedAt: String(row.created_at),
    reviewerId: row.reviewer_id ? Number(row.reviewer_id) : null,
    note: row.note || null,
    responseNote: row.response_note || null,
    respondedBy: row.responded_by ? Number(row.responded_by) : null,
    respondedAt: row.responded_at || null
  };
}

function normalizeUserPreferenceRow(row: any): UserPreferenceProfile {
  const personaRaw = String(row.persona || 'analyst').toLowerCase();
  const persona: UserPreferenceProfile['persona'] =
    personaRaw === 'manager' || personaRaw === 'executive'
      ? (personaRaw as UserPreferenceProfile['persona'])
      : 'analyst';
  const uiModeRaw = String(row.ui_mode || 'guided').toLowerCase();
  const uiMode: UserPreferenceProfile['uiMode'] = uiModeRaw === 'expert' ? 'expert' : 'guided';

  return {
    workspaceId: Number(row.workspace_id),
    userId: Number(row.user_id),
    persona,
    uiMode,
    reportStyle: String(row.report_style || 'concise'),
    aiStyle: String(row.ai_style || 'tactical'),
    notificationPreferences: parseJsonMaybe<Record<string, any>>(row.notification_preferences, {}),
    panelPreferences: parseJsonMaybe<Record<string, any>>(row.panel_preferences, {}),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString())
  };
}

async function getOrCreateUserPreferenceProfile(workspaceId: number, userId: number): Promise<UserPreferenceProfile> {
  const existing = await query(
    `
    SELECT *
    FROM user_preference_profiles
    WHERE workspace_id = $1
      AND user_id = $2
    LIMIT 1
    `,
    [workspaceId, userId]
  );

  if (existing.rows.length > 0) {
    return normalizeUserPreferenceRow(existing.rows[0]);
  }

  const inserted = await query(
    `
    INSERT INTO user_preference_profiles (
      workspace_id,
      user_id,
      persona,
      ui_mode,
      report_style,
      ai_style,
      notification_preferences,
      panel_preferences
    )
    VALUES ($1,$2,'analyst','guided','concise','tactical',$3,$4)
    RETURNING *
    `,
    [workspaceId, userId, JSON.stringify({}), JSON.stringify({})]
  );

  return normalizeUserPreferenceRow(inserted.rows[0]);
}

async function updateUserPreferenceProfile(params: {
  workspaceId: number;
  userId: number;
  persona?: 'analyst' | 'manager' | 'executive';
  uiMode?: 'guided' | 'expert';
  reportStyle?: string;
  aiStyle?: string;
  notificationPreferences?: Record<string, any>;
  panelPreferences?: Record<string, any>;
}) {
  const current = await getOrCreateUserPreferenceProfile(params.workspaceId, params.userId);
  const next = {
    persona: params.persona || current.persona,
    uiMode: params.uiMode || current.uiMode,
    reportStyle: params.reportStyle || current.reportStyle,
    aiStyle: params.aiStyle || current.aiStyle,
    notificationPreferences: params.notificationPreferences || current.notificationPreferences || {},
    panelPreferences: params.panelPreferences || current.panelPreferences || {}
  };

  const updated = await query(
    `
    UPDATE user_preference_profiles
    SET persona = $1,
        ui_mode = $2,
        report_style = $3,
        ai_style = $4,
        notification_preferences = $5,
        panel_preferences = $6,
        updated_at = NOW()
    WHERE workspace_id = $7
      AND user_id = $8
    RETURNING *
    `,
    [
      next.persona,
      next.uiMode,
      next.reportStyle,
      next.aiStyle,
      JSON.stringify(next.notificationPreferences || {}),
      JSON.stringify(next.panelPreferences || {}),
      params.workspaceId,
      params.userId
    ]
  );

  return normalizeUserPreferenceRow(updated.rows[0]);
}

async function listVisualAnnotations(workspaceId: number, roomId: number, visualId: number): Promise<VisualAnnotation[]> {
  const result = await query(
    `
    SELECT id, visual_id, text, anchor, created_by, created_at
    FROM visual_annotations
    WHERE workspace_id = $1
      AND room_id = $2
      AND visual_id = $3
    ORDER BY created_at ASC
    `,
    [workspaceId, roomId, visualId]
  );
  return result.rows.map(toVisualAnnotationRecord);
}

router.post('/:workspaceId/studio/bootstrap', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const preferredPanel = toStudioPanel(req.body?.preferredPanel);
    const featureFlags = await resolveStudioFeatureFlags(workspaceId);
    const panel =
      (!featureFlags.visualsTabEnabled && preferredPanel === 'visuals')
      || (!featureFlags.commsTabEnabled && preferredPanel === 'comms')
        ? 'sheets'
        : preferredPanel;
    const datasetIdInput = Number(req.body?.datasetId || 0);
    let datasetId: number | null = Number.isFinite(datasetIdInput) && datasetIdInput > 0 ? datasetIdInput : null;

    if (datasetId) {
      const datasetCheck = await query(
        `SELECT id FROM datasets WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
        [datasetId, workspaceId]
      );
      if (datasetCheck.rows.length === 0) {
        datasetId = null;
      }
    }

    let createdProject = false;
    let createdRoom = false;

    let project = null as any;
    const projectResult = await query(
      `
      SELECT id, name, created_at, updated_at
      FROM projects
      WHERE workspace_id = $1
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
      `,
      [workspaceId]
    );
    project = projectResult.rows[0] || null;

    if (!project) {
      if (!canWrite(req.workspaceRole)) {
        return res.status(403).json({ error: 'Project setup requires editor/admin access' });
      }
      const inserted = await query(
        `
        INSERT INTO projects (workspace_id, name, description, objective, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, created_at, updated_at
        `,
        [
          workspaceId,
          'RevOps Weekly Project',
          'Auto-generated project for Studio-first workflow.',
          'Weekly RevOps decision execution',
          req.user!.id
        ]
      );
      project = inserted.rows[0];
      createdProject = true;
    }

    let room = null as any;
    const roomResult = await query(
      `
      SELECT id, name, stage, run_context, created_at, updated_at
      FROM analysis_rooms
      WHERE workspace_id = $1
        AND project_id = $2
        AND is_archived = false
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
      `,
      [workspaceId, Number(project.id)]
    );
    room = roomResult.rows[0] || null;

    if (!room) {
      if (!canWrite(req.workspaceRole)) {
        return res.status(403).json({ error: 'Room setup requires editor/admin access' });
      }
      const insertedRoom = await query(
        `
        INSERT INTO analysis_rooms (workspace_id, project_id, name, description, stage, run_context, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, stage, run_context, created_at, updated_at
        `,
        [
          workspaceId,
          Number(project.id),
          'Weekly Decision Room',
          'Auto-generated room for Studio-first workflow.',
          'ingest',
          JSON.stringify({ datasetId: datasetId || undefined }),
          req.user!.id
        ]
      );
      room = insertedRoom.rows[0];
      createdRoom = true;
    }

    const runContext = parseRoomRunContext(room.run_context);
    const resolvedDatasetId = datasetId || Number(runContext.datasetId || 0) || null;

    if (datasetId && canWrite(req.workspaceRole)) {
      const currentDatasetId = Number(runContext.datasetId || 0);
      if (!Number.isFinite(currentDatasetId) || currentDatasetId !== datasetId) {
        const nextContext = {
          ...runContext,
          datasetId
        };
        const updated = await query(
          `
          UPDATE analysis_rooms
          SET run_context = $1,
              updated_at = NOW()
          WHERE id = $2
          RETURNING id, name, stage, run_context, created_at, updated_at
          `,
          [JSON.stringify(nextContext), Number(room.id)]
        );
        room = updated.rows[0] || room;
      }
    }

    const routeParams = new URLSearchParams();
    routeParams.set('workspace', String(workspaceId));
    if (resolvedDatasetId) routeParams.set('dataset', String(resolvedDatasetId));
    routeParams.set('project', String(project.id));
    routeParams.set('room', String(room.id));
    routeParams.set('panel', panel);

    return res.json({
      workspaceId,
      datasetId: resolvedDatasetId,
      projectId: Number(project.id),
      roomId: Number(room.id),
      panel,
      featureFlags,
      created: {
        project: createdProject,
        room: createdRoom
      },
      route: `/app/studio?${routeParams.toString()}`
    });
  } catch (err) {
    console.error('Studio bootstrap failed:', err);
    return res.status(500).json({ error: 'Failed to bootstrap Studio context' });
  }
});

router.get('/:workspaceId/studio/navigation', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);

    const [projectsResult, roomsResult, datasetsResult] = await Promise.all([
      query(
        `
        SELECT id, name, created_at, updated_at
        FROM projects
        WHERE workspace_id = $1
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 50
        `,
        [workspaceId]
      ),
      query(
        `
        SELECT id, project_id, name, stage, run_context, created_at, updated_at
        FROM analysis_rooms
        WHERE workspace_id = $1
          AND is_archived = false
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 100
        `,
        [workspaceId]
      ),
      query(
        `
        SELECT id, name, created_at, updated_at
        FROM datasets
        WHERE workspace_id = $1
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 30
        `,
        [workspaceId]
      )
    ]);

    const latestRoom = roomsResult.rows[0] || null;
    const latestRunContext = latestRoom ? parseRoomRunContext(latestRoom.run_context) : {};
    const activeDatasetId = Number(latestRunContext.datasetId || 0);
    const featureFlags = await resolveStudioFeatureFlags(workspaceId);

    return res.json({
      active: {
        datasetId: Number.isFinite(activeDatasetId) && activeDatasetId > 0 ? activeDatasetId : undefined,
        projectId: latestRoom?.project_id ? Number(latestRoom.project_id) : undefined,
        roomId: latestRoom?.id ? Number(latestRoom.id) : undefined
      },
      featureFlags,
      projects: projectsResult.rows.map((project) => ({
        id: Number(project.id),
        name: String(project.name || 'Untitled Project'),
        createdAt: project.created_at,
        updatedAt: project.updated_at
      })),
      rooms: roomsResult.rows.map((room) => ({
        id: Number(room.id),
        projectId: Number(room.project_id),
        name: String(room.name || 'Untitled Room'),
        stage: String(room.stage || 'ingest'),
        createdAt: room.created_at,
        updatedAt: room.updated_at
      })),
      recentDatasets: datasetsResult.rows.map((dataset) => ({
        id: Number(dataset.id),
        name: String(dataset.name || `Dataset ${dataset.id}`),
        createdAt: dataset.created_at,
        updatedAt: dataset.updated_at
      }))
    });
  } catch (err) {
    console.error('Studio navigation state failed:', err);
    return res.status(500).json({ error: 'Failed to load Studio navigation state' });
  }
});

router.get('/:workspaceId/preferences/profile', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const profile = await getOrCreateUserPreferenceProfile(workspaceId, Number(req.user!.id));
    return res.json({ profile });
  } catch (err) {
    console.error('Load preference profile failed:', err);
    return res.status(500).json({ error: 'Failed to load preference profile' });
  }
});

router.post('/:workspaceId/preferences/profile', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const personaRaw = req.body?.persona;
    const uiModeRaw = req.body?.uiMode;
    const reportStyleRaw = req.body?.reportStyle;
    const aiStyleRaw = req.body?.aiStyle;

    const persona = ['analyst', 'manager', 'executive'].includes(String(personaRaw))
      ? (String(personaRaw) as UserPreferenceProfile['persona'])
      : undefined;
    const uiMode = ['guided', 'expert'].includes(String(uiModeRaw))
      ? (String(uiModeRaw) as UserPreferenceProfile['uiMode'])
      : undefined;
    const reportStyle = typeof reportStyleRaw === 'string' && reportStyleRaw.trim()
      ? reportStyleRaw.trim().slice(0, 40)
      : undefined;
    const aiStyle = typeof aiStyleRaw === 'string' && aiStyleRaw.trim()
      ? aiStyleRaw.trim().slice(0, 40)
      : undefined;

    const notificationPreferences = req.body?.notificationPreferences && typeof req.body.notificationPreferences === 'object'
      ? req.body.notificationPreferences
      : undefined;
    const panelPreferences = req.body?.panelPreferences && typeof req.body.panelPreferences === 'object'
      ? req.body.panelPreferences
      : undefined;

    const profile = await updateUserPreferenceProfile({
      workspaceId,
      userId: Number(req.user!.id),
      persona,
      uiMode,
      reportStyle,
      aiStyle,
      notificationPreferences,
      panelPreferences
    });

    await recordAnalyticsEvent({
      workspaceId,
      roomId: null,
      userId: req.user!.id,
      eventType: 'decision_room_persona_profile_updated',
      metadata: {
        persona: profile.persona,
        uiMode: profile.uiMode,
        reportStyle: profile.reportStyle,
        aiStyle: profile.aiStyle
      }
    });

    return res.json({ profile });
  } catch (err) {
    console.error('Update preference profile failed:', err);
    return res.status(500).json({ error: 'Failed to update preference profile' });
  }
});

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

router.post('/:workspaceId/rooms/:roomId/data/profile', async (req: WorkspaceRequest, res: Response) => {
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

    const datasetVersionIdInput = Number(req.body?.datasetVersionId || 0);
    const source = await resolveDatasetRows(
      workspaceId,
      Number.isFinite(datasetVersionIdInput) && datasetVersionIdInput > 0 ? datasetVersionIdInput : undefined,
      req.body || {}
    );

    const profile = computeDatasetProfile({
      rows: source.rows,
      columns: source.columns,
      datasetVersionId: source.datasetVersionId
    });

    const profileArtifact = await createArtifact({
      workspaceId,
      projectId: room.project_id,
      roomId,
      artifactType: 'report_block',
      title: `Data Profile - ${new Date().toISOString().slice(0, 10)}`,
      description: 'Automated dataset trust profile generated for room quality checks.',
      payload: {
        profileType: 'dataset_profile',
        profileVersion: 'v1',
        ...profile
      },
      metadata: {
        generatedBy: 'data_profile_endpoint'
      },
      datasetVersionId: source.datasetVersionId,
      sourceDatasetId: source.sourceDatasetId,
      createdBy: req.user!.id
    });

    const profileInsert = await query(
      `
      INSERT INTO dataset_profiles (
        workspace_id,
        room_id,
        dataset_id,
        dataset_version_id,
        artifact_id,
        quality_score,
        missingness,
        duplicate_keys,
        date_continuity,
        invalid_numerics,
        row_count,
        column_count,
        summary,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
      `,
      [
        workspaceId,
        roomId,
        source.sourceDatasetId,
        source.datasetVersionId,
        Number(profileArtifact.id),
        profile.qualityScore,
        JSON.stringify(profile.missingness),
        JSON.stringify(profile.duplicateKeys),
        JSON.stringify(profile.dateContinuity),
        JSON.stringify(profile.invalidNumerics),
        profile.summary.rowCount,
        profile.summary.columnCount,
        JSON.stringify(profile.summary),
        req.user!.id
      ]
    );

    const parentArtifactIds: number[] = [];
    if (source.datasetVersionId) {
      const datasetArtifact = await query(
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
      if (datasetArtifact.rows.length > 0) {
        parentArtifactIds.push(Number(datasetArtifact.rows[0].id));
      }
    }
    if (parentArtifactIds.length > 0) {
      await createLineageEdges({
        workspaceId,
        roomId,
        parentArtifactIds,
        childArtifactId: Number(profileArtifact.id),
        relationType: 'derived_from',
        createdBy: req.user!.id
      });
    }

    const minQualityScore = Number(req.body?.minQualityScore ?? 0);
    const qualityThreshold = Number.isFinite(minQualityScore)
      ? clampUnit(minQualityScore)
      : 0;
    const publishBlocked = profile.qualityScore < qualityThreshold;

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_data_profile_generated',
      metadata: {
        datasetVersionId: source.datasetVersionId,
        datasetId: source.sourceDatasetId,
        artifactId: Number(profileArtifact.id),
        qualityScore: profile.qualityScore,
        publishBlocked
      }
    });

    return res.status(201).json({
      roomId,
      profileId: Number(profileInsert.rows[0].id),
      profile,
      quality: {
        qualityScore: profile.qualityScore,
        threshold: qualityThreshold,
        publishBlocked
      },
      artifact: {
        ...profileArtifact,
        payload: parseJsonMaybe(profileArtifact.payload, {}),
        metadata: parseJsonMaybe(profileArtifact.metadata, {})
      }
    });
  } catch (err) {
    console.error('Generate data profile failed:', err);
    return res.status(500).json({ error: 'Failed to generate room data profile' });
  }
});

router.get('/:workspaceId/rooms/:roomId/data/trust', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const latest = await query(
      `
      SELECT *
      FROM dataset_profiles
      WHERE workspace_id = $1
        AND room_id = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [workspaceId, roomId]
    );
    if (latest.rows.length === 0) {
      return res.status(404).json({ error: 'No data profile found. Generate a profile first.' });
    }

    const profileRow = latest.rows[0];
    const qualityScore = Number(profileRow.quality_score || 0);
    const thresholdRaw = Number(req.query.minQualityScore ?? req.query.threshold ?? 0.65);
    const threshold = Number.isFinite(thresholdRaw) ? clampUnit(thresholdRaw) : 0.65;

    const trust = {
      profileId: Number(profileRow.id),
      qualityScore,
      threshold,
      publishBlocked: qualityScore < threshold,
      datasetId: profileRow.dataset_id ? Number(profileRow.dataset_id) : null,
      datasetVersionId: profileRow.dataset_version_id ? Number(profileRow.dataset_version_id) : null,
      generatedAt: profileRow.created_at,
      summary: parseJsonMaybe(profileRow.summary, {}),
      missingness: parseJsonMaybe(profileRow.missingness, []),
      duplicateKeys: parseJsonMaybe(profileRow.duplicate_keys, []),
      dateContinuity: parseJsonMaybe(profileRow.date_continuity, []),
      invalidNumerics: parseJsonMaybe(profileRow.invalid_numerics, [])
    };

    return res.json({
      roomId,
      trust
    });
  } catch (err) {
    console.error('Load room trust failed:', err);
    return res.status(500).json({ error: 'Failed to load room trust summary' });
  }
});

router.post('/:workspaceId/rooms/:roomId/queries/save-version', async (req: WorkspaceRequest, res: Response) => {
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

    const queryIdRaw = req.body?.queryId;
    const queryId = queryIdRaw === null || queryIdRaw === undefined || queryIdRaw === ''
      ? null
      : Number(queryIdRaw);
    if (queryId !== null && !Number.isFinite(queryId)) {
      return res.status(400).json({ error: 'queryId must be numeric when provided' });
    }

    if (queryId !== null) {
      const queryCheck = await query(
        `
        SELECT id
        FROM queries
        WHERE id = $1
          AND workspace_id = $2
        LIMIT 1
        `,
        [queryId, workspaceId]
      );
      if (queryCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Referenced query not found in workspace' });
      }
    }

    const sqlTemplate = String(
      req.body?.sqlTemplate ||
      req.body?.sql ||
      req.body?.query ||
      ''
    ).trim();
    if (!sqlTemplate) {
      return res.status(400).json({ error: 'sqlTemplate is required' });
    }

    const parametersSchema = req.body?.parametersSchema && typeof req.body.parametersSchema === 'object'
      ? req.body.parametersSchema
      : {};
    const metadata = req.body?.metadata && typeof req.body.metadata === 'object'
      ? req.body.metadata
      : {};

    const versionBaseResult = await query(
      `
      SELECT COALESCE(MAX(version_number), 0)::int AS max_version
      FROM query_versions
      WHERE workspace_id = $1
        AND room_id = $2
        AND (($3::int IS NULL AND query_id IS NULL) OR query_id = $3)
      `,
      [workspaceId, roomId, queryId]
    );
    const versionNumber = Number(versionBaseResult.rows[0]?.max_version || 0) + 1;

    const insertResult = await query(
      `
      INSERT INTO query_versions (
        workspace_id,
        room_id,
        query_id,
        version_number,
        sql_template,
        parameters_schema,
        metadata,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        workspaceId,
        roomId,
        queryId,
        versionNumber,
        sqlTemplate,
        JSON.stringify(parametersSchema),
        JSON.stringify(metadata),
        req.user!.id
      ]
    );

    const version = toQueryVersionRecord(insertResult.rows[0]);
    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_query_version_saved',
      metadata: {
        queryId: version.queryId,
        versionId: version.id,
        versionNumber: version.versionNumber
      }
    });

    return res.status(201).json({
      roomId,
      version
    });
  } catch (err) {
    console.error('Save query version failed:', err);
    return res.status(500).json({ error: 'Failed to save query version' });
  }
});

router.get('/:workspaceId/rooms/:roomId/queries/:queryId/versions', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const queryId = Number(req.params.queryId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!Number.isFinite(queryId)) {
      return res.status(400).json({ error: 'Invalid query id' });
    }

    const versionsResult = await query(
      `
      SELECT *
      FROM query_versions
      WHERE workspace_id = $1
        AND room_id = $2
        AND query_id = $3
      ORDER BY version_number DESC, created_at DESC
      `,
      [workspaceId, roomId, queryId]
    );

    return res.json({
      roomId,
      queryId,
      versions: versionsResult.rows.map(toQueryVersionRecord)
    });
  } catch (err) {
    console.error('List query versions failed:', err);
    return res.status(500).json({ error: 'Failed to list query versions' });
  }
});

router.post('/:workspaceId/rooms/:roomId/pivots/compute', async (req: WorkspaceRequest, res: Response) => {
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

    const specRaw = req.body?.spec || req.body || {};
    const spec: PivotComputeSpec = {
      dimensions: Array.isArray(specRaw.dimensions) ? specRaw.dimensions.map((value: any) => String(value)).filter(Boolean) : [],
      measures: Array.isArray(specRaw.measures) ? specRaw.measures : [],
      calculations: Array.isArray(specRaw.calculations) ? specRaw.calculations : [],
      filters: Array.isArray(specRaw.filters) ? specRaw.filters : []
    };

    if (spec.dimensions.length === 0 && (!Array.isArray(spec.measures) || spec.measures.length === 0)) {
      return res.status(400).json({ error: 'Pivot requires at least one dimension or measure.' });
    }

    const source = await resolveRoomRowsAndEvidence(workspaceId, room);
    const pivotRows = buildPivotData(source.rows, spec);

    const artifact = await createArtifact({
      workspaceId,
      projectId: room.project_id,
      roomId,
      artifactType: 'pivot',
      title: String(req.body?.name || `Pivot - ${spec.dimensions.join(', ') || 'summary'}`),
      description: 'Computed pivot artifact from Pivot Compute API.',
      payload: {
        config: spec,
        rowCount: pivotRows.length,
        previewRows: pivotRows.slice(0, 500)
      },
      metadata: {
        generatedBy: 'pivots_compute_api'
      },
      createdBy: req.user!.id
    });

    if (source.evidenceArtifactIds.length > 0) {
      await createLineageEdges({
        workspaceId,
        roomId,
        parentArtifactIds: source.evidenceArtifactIds,
        childArtifactId: Number(artifact.id),
        relationType: 'derived_from',
        createdBy: req.user!.id
      });
    }

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_pivot_computed',
      metadata: {
        artifactId: Number(artifact.id),
        rowCount: pivotRows.length,
        dimensionCount: spec.dimensions.length
      }
    });

    return res.status(201).json({
      roomId,
      pivot: {
        artifactId: Number(artifact.id),
        rows: pivotRows,
        rowCount: pivotRows.length,
        spec
      }
    });
  } catch (err) {
    console.error('Compute pivot failed:', err);
    return res.status(500).json({ error: 'Failed to compute pivot' });
  }
});

router.get('/:workspaceId/rooms/:roomId/metrics/catalog', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const result = await query(
      `
      SELECT
        m.id,
        m.metric_key,
        m.name,
        m.owner_id,
        COALESCE(u.full_name, u.email) AS owner_name,
        m.formula,
        latest_test.status AS latest_status,
        latest_test.last_run_at AS last_validated_at
      FROM metric_definitions m
      LEFT JOIN users u ON u.id = m.owner_id
      LEFT JOIN LATERAL (
        SELECT status, last_run_at
        FROM metric_definition_tests t
        WHERE t.metric_definition_id = m.id
        ORDER BY last_run_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) latest_test ON TRUE
      WHERE m.workspace_id = $1
      ORDER BY m.created_at DESC
      `,
      [workspaceId]
    );

    const metrics: MetricCatalogItem[] = result.rows.map((row) => ({
      id: Number(row.id),
      key: String(row.metric_key || ''),
      name: String(row.name || row.metric_key || ''),
      ownerId: row.owner_id ? Number(row.owner_id) : null,
      ownerName: row.owner_name ? String(row.owner_name) : null,
      certified: String(row.latest_status || '').toLowerCase() === 'passed',
      validationStatus: (() => {
        const normalized = String(row.latest_status || '').toLowerCase();
        if (normalized === 'passed' || normalized === 'failed' || normalized === 'pending') {
          return normalized;
        }
        return normalized ? 'pending' : 'missing';
      })(),
      formulaSql: String(row.formula || ''),
      lastValidatedAt: row.last_validated_at || null
    }));

    return res.json({
      roomId,
      metrics
    });
  } catch (err) {
    console.error('Load metric catalog failed:', err);
    return res.status(500).json({ error: 'Failed to load metric catalog' });
  }
});

router.post('/:workspaceId/rooms/:roomId/metrics/:metricId/owner', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const metricId = Number(req.params.metricId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!Number.isFinite(metricId) || metricId <= 0) {
      return res.status(400).json({ error: 'Invalid metric id' });
    }

    const metricResult = await query(
      `
      SELECT id, metric_key, name, owner_id
      FROM metric_definitions
      WHERE workspace_id = $1
        AND id = $2
      LIMIT 1
      `,
      [workspaceId, metricId]
    );
    if (metricResult.rows.length === 0) {
      return res.status(404).json({ error: 'Metric definition not found' });
    }

    const ownerIdRaw = req.body?.ownerId;
    const ownerId = ownerIdRaw === null || ownerIdRaw === undefined || ownerIdRaw === ''
      ? null
      : Number(ownerIdRaw);
    if (ownerId !== null && (!Number.isFinite(ownerId) || ownerId <= 0)) {
      return res.status(400).json({ error: 'Invalid ownerId value' });
    }

    let ownerName: string | null = null;
    if (ownerId !== null) {
      const ownerResult = await query(
        `
        SELECT u.id, COALESCE(u.full_name, u.email) AS owner_name
        FROM users u
        WHERE u.id = $1
          AND (
            u.id IN (
              SELECT wm.user_id
              FROM workspace_members wm
              WHERE wm.workspace_id = $2
            )
            OR u.id = (
              SELECT w.user_id
              FROM workspaces w
              WHERE w.id = $2
            )
          )
        LIMIT 1
        `,
        [ownerId, workspaceId]
      );
      if (ownerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Owner must be a member of this workspace' });
      }
      ownerName = ownerResult.rows[0].owner_name ? String(ownerResult.rows[0].owner_name) : null;
    }

    const updatedResult = await query(
      `
      UPDATE metric_definitions
      SET owner_id = $1,
          updated_at = NOW()
      WHERE workspace_id = $2
        AND id = $3
      RETURNING id, metric_key, name, owner_id, updated_at
      `,
      [ownerId, workspaceId, metricId]
    );

    const updated = updatedResult.rows[0];
    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_metric_owner_updated',
      metadata: {
        metricId,
        metricKey: String(updated.metric_key || ''),
        ownerId: updated.owner_id ? Number(updated.owner_id) : null
      }
    });

    return res.json({
      roomId,
      metric: {
        id: Number(updated.id),
        key: String(updated.metric_key || ''),
        name: String(updated.name || updated.metric_key || ''),
        ownerId: updated.owner_id ? Number(updated.owner_id) : null,
        ownerName,
        updatedAt: String(updated.updated_at)
      }
    });
  } catch (err) {
    console.error('Assign metric owner failed:', err);
    return res.status(500).json({ error: 'Failed to assign metric owner' });
  }
});

router.post('/:workspaceId/rooms/:roomId/metrics/validate', async (req: WorkspaceRequest, res: Response) => {
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

    const requestedMetricIds = Array.isArray(req.body?.metricIds)
      ? req.body.metricIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
      : [];

    const metricResult = await query(
      `
      SELECT id, metric_key, name, formula
      FROM metric_definitions
      WHERE workspace_id = $1
      ${requestedMetricIds.length > 0 ? 'AND id = ANY($2::int[])' : ''}
      ORDER BY created_at DESC
      `,
      requestedMetricIds.length > 0 ? [workspaceId, requestedMetricIds] : [workspaceId]
    );

    const roomData = await resolveRoomRowsAndEvidence(workspaceId, room);
    const sourceColumns = new Set(roomData.columns.map((column) => normalizeFieldName(column)));
    const sqlKeywords = new Set([
      'select', 'from', 'where', 'and', 'or', 'case', 'when', 'then', 'else', 'end', 'sum', 'avg', 'min', 'max',
      'count', 'distinct', 'coalesce', 'nullif', 'over', 'partition', 'order', 'by', 'as', 'on', 'join', 'left',
      'right', 'inner', 'outer', 'group', 'having', 'limit'
    ]);

    const validations = [];
    for (const metric of metricResult.rows) {
      const formula = String(metric.formula || '').trim();
      const tokens = (formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [])
        .map((token) => normalizeFieldName(token))
        .filter((token) => token && !sqlKeywords.has(token));
      const referencedColumns = Array.from(new Set(tokens));
      const unknownColumns = referencedColumns.filter((token) => sourceColumns.size > 0 && !sourceColumns.has(token));
      const formulaPresent = formula.length > 0;
      const status = formulaPresent && unknownColumns.length === 0 ? 'passed' : 'failed';

      const validationResult = {
        metricId: Number(metric.id),
        metricKey: String(metric.metric_key || ''),
        name: String(metric.name || metric.metric_key || ''),
        status,
        checks: {
          formulaPresent,
          unknownColumns
        },
        validatedAt: new Date().toISOString()
      };
      validations.push(validationResult);

      await query(
        `
        INSERT INTO metric_definition_tests (
          workspace_id,
          metric_definition_id,
          test_name,
          test_definition,
          status,
          last_result,
          last_run_at,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7)
        `,
        [
          workspaceId,
          Number(metric.id),
          'schema_validation',
          JSON.stringify({ sourceColumns: Array.from(sourceColumns), referencedColumns }),
          status,
          JSON.stringify(validationResult),
          req.user!.id
        ]
      );
    }

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_metric_validation_run',
      metadata: {
        metricCount: validations.length,
        passed: validations.filter((item) => item.status === 'passed').length,
        failed: validations.filter((item) => item.status === 'failed').length
      }
    });

    return res.json({
      roomId,
      validations
    });
  } catch (err) {
    console.error('Metric validation failed:', err);
    return res.status(500).json({ error: 'Failed to validate room metrics' });
  }
});

router.post('/:workspaceId/rooms/:roomId/visuals/build', async (req: WorkspaceRequest, res: Response) => {
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

    const spec = (req.body?.spec || req.body || {}) as VisualBuildSpec;
    const chartType = String(spec.chartType || 'bar').toLowerCase();
    const dimensions = Array.isArray(spec.dimensions) ? spec.dimensions.map((d) => String(d)).filter(Boolean) : [];
    const measures = Array.isArray(spec.measures) ? spec.measures.map((m) => String(m)).filter(Boolean) : [];
    if (!dimensions.length && !measures.length) {
      return res.status(400).json({ error: 'At least one dimension or measure is required to build visual.' });
    }

    const roomData = await resolveRoomRowsAndEvidence(workspaceId, room);
    const visualRows = buildVisualData(roomData.rows, {
      chartType,
      dimensions,
      measures,
      filters: spec.filters || [],
      drillPath: spec.drillPath || dimensions
    });

    const artifact = await createArtifact({
      workspaceId,
      projectId: room.project_id,
      roomId,
      artifactType: 'chart',
      title: String(req.body?.name || `Visual - ${dimensions.join(', ') || measures.join(', ') || chartType}`),
      description: 'Generated visual artifact from Visual Build API.',
      payload: {
        chart: {
          id: `visual_${Date.now()}`,
          type: chartType,
          title: String(req.body?.name || 'Visual'),
          xAxis: dimensions[0] || 'label',
          yAxis: measures[0] || 'value',
          data: visualRows
        },
        previewRows: visualRows
      },
      metadata: {
        generatedBy: 'visuals_build_api'
      },
      createdBy: req.user!.id
    });

    await createLineageEdges({
      workspaceId,
      roomId,
      parentArtifactIds: roomData.evidenceArtifactIds,
      childArtifactId: Number(artifact.id),
      relationType: 'derived_from',
      createdBy: req.user!.id
    });

    const visualInsert = await query(
      `
      INSERT INTO visual_specs (
        workspace_id,
        room_id,
        artifact_id,
        name,
        spec,
        annotations,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        workspaceId,
        roomId,
        Number(artifact.id),
        String(req.body?.name || artifact.title),
        JSON.stringify({
          chartType,
          dimensions,
          measures,
          filters: spec.filters || [],
          drillPath: spec.drillPath || dimensions
        }),
        JSON.stringify(Array.isArray(req.body?.annotations) ? req.body.annotations : []),
        req.user!.id
      ]
    );

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_visual_built',
      metadata: {
        visualId: Number(visualInsert.rows[0].id),
        artifactId: Number(artifact.id),
        chartType,
        rowCount: visualRows.length
      }
    });

    return res.status(201).json({
      visualId: Number(visualInsert.rows[0].id),
      artifact: {
        ...artifact,
        payload: parseJsonMaybe(artifact.payload, {}),
        metadata: parseJsonMaybe(artifact.metadata, {})
      },
      data: visualRows
    });
  } catch (err) {
    console.error('Build visual failed:', err);
    return res.status(500).json({ error: 'Failed to build visual' });
  }
});

router.post('/:workspaceId/rooms/:roomId/visuals/:visualId/drill', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const visualId = Number(req.params.visualId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!Number.isFinite(visualId)) {
      return res.status(400).json({ error: 'Invalid visual id' });
    }

    const visualResult = await query(
      `
      SELECT *
      FROM visual_specs
      WHERE id = $1 AND workspace_id = $2 AND room_id = $3
      LIMIT 1
      `,
      [visualId, workspaceId, roomId]
    );
    if (visualResult.rows.length === 0) {
      return res.status(404).json({ error: 'Visual spec not found' });
    }

    const spec = parseJsonMaybe<VisualBuildSpec>(visualResult.rows[0].spec, {
      chartType: 'bar',
      dimensions: [],
      measures: []
    });

    const level = Number(req.body?.level ?? 0);
    const pathValues = req.body?.pathValues && typeof req.body.pathValues === 'object'
      ? req.body.pathValues
      : {};
    const roomData = await resolveRoomRowsAndEvidence(workspaceId, room);
    const drilled = buildDrillData(roomData.rows, spec, Number.isFinite(level) ? level : 0, pathValues);

    return res.json({
      visualId,
      nextDimension: drilled.nextDimension,
      rows: drilled.rows
    });
  } catch (err) {
    console.error('Visual drill failed:', err);
    return res.status(500).json({ error: 'Failed to drill visual' });
  }
});

router.post('/:workspaceId/rooms/:roomId/visuals/:visualId/annotate', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const visualId = Number(req.params.visualId);
    if (!Number.isFinite(visualId) || visualId <= 0) {
      return res.status(400).json({ error: 'Invalid visual id' });
    }

    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const visualResult = await query(
      `
      SELECT id, artifact_id, annotations
      FROM visual_specs
      WHERE id = $1
        AND workspace_id = $2
        AND room_id = $3
      LIMIT 1
      `,
      [visualId, workspaceId, roomId]
    );
    if (visualResult.rows.length === 0) {
      return res.status(404).json({ error: 'Visual spec not found' });
    }

    const text = String(req.body?.text || req.body?.annotation || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'Annotation text is required' });
    }
    const anchor = req.body?.anchor && typeof req.body.anchor === 'object' ? req.body.anchor : {};
    const artifactIdRaw = Number(visualResult.rows[0].artifact_id || 0);
    const artifactId = Number.isFinite(artifactIdRaw) && artifactIdRaw > 0 ? artifactIdRaw : null;

    const annotationInsert = await query(
      `
      INSERT INTO visual_annotations (
        workspace_id,
        room_id,
        visual_id,
        artifact_id,
        text,
        anchor,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [workspaceId, roomId, visualId, artifactId, text, JSON.stringify(anchor), req.user!.id]
    );

    const annotation = toVisualAnnotationRecord(annotationInsert.rows[0]);
    const currentAnnotations = parseJsonMaybe<any[]>(visualResult.rows[0].annotations, []);
    const compactAnnotation = {
      id: annotation.id,
      text: annotation.text,
      anchor: annotation.anchor,
      createdBy: annotation.createdBy,
      createdAt: annotation.createdAt
    };
    await query(
      `
      UPDATE visual_specs
      SET annotations = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [JSON.stringify([...currentAnnotations, compactAnnotation]), visualId]
    );

    const annotations = await listVisualAnnotations(workspaceId, roomId, visualId);

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_visual_annotated',
      metadata: {
        visualId,
        annotationId: annotation.id,
        artifactId
      }
    });

    emitToDecisionRoom(workspaceId, roomId, 'decision-room:visual-annotated', {
      roomId,
      visualId,
      annotation
    });

    return res.status(201).json({
      visualId,
      annotation,
      annotations
    });
  } catch (err) {
    console.error('Visual annotation failed:', err);
    return res.status(500).json({ error: 'Failed to annotate visual' });
  }
});

router.get('/:workspaceId/rooms/:roomId/visuals/:visualId/annotations', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const visualId = Number(req.params.visualId);
    if (!Number.isFinite(visualId) || visualId <= 0) {
      return res.status(400).json({ error: 'Invalid visual id' });
    }

    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const visualResult = await query(
      `
      SELECT id
      FROM visual_specs
      WHERE id = $1
        AND workspace_id = $2
        AND room_id = $3
      LIMIT 1
      `,
      [visualId, workspaceId, roomId]
    );
    if (visualResult.rows.length === 0) {
      return res.status(404).json({ error: 'Visual spec not found' });
    }

    const annotations = await listVisualAnnotations(workspaceId, roomId, visualId);
    return res.json({
      visualId,
      annotations
    });
  } catch (err) {
    console.error('List visual annotations failed:', err);
    return res.status(500).json({ error: 'Failed to load visual annotations' });
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

router.post('/:workspaceId/rooms/:roomId/comments/:threadId/resolve', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const threadId = Number(req.params.threadId);
    const statusRaw = String(req.body?.status || 'resolved').toLowerCase();
    const status = statusRaw === 'reopened' ? 'reopened' : 'resolved';
    const resolutionNote = req.body?.resolutionNote ? String(req.body.resolutionNote).trim() : null;

    const thread = await getRoomThread(workspaceId, roomId, threadId);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const resolutionInsert = await query(
      `
      INSERT INTO comment_thread_resolutions (
        workspace_id,
        room_id,
        thread_id,
        status,
        resolved_by,
        resolution_note,
        resolved_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      RETURNING *
      `,
      [workspaceId, roomId, threadId, status, req.user!.id, resolutionNote]
    );

    await query(
      `
      UPDATE comment_threads
      SET updated_at = NOW()
      WHERE id = $1
      `,
      [threadId]
    );

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: status === 'resolved' ? 'decision_room_thread_resolved' : 'decision_room_thread_reopened',
      metadata: {
        threadId,
        resolutionNoteLength: resolutionNote?.length || 0
      }
    });

    const resolution: CommentResolution = {
      threadId,
      status,
      resolvedBy: Number(req.user!.id),
      resolvedAt: resolutionInsert.rows[0].resolved_at,
      resolutionNote
    };

    emitToDecisionRoom(workspaceId, roomId, 'decision-room:thread-resolved', {
      roomId,
      threadId,
      resolution
    });

    return res.status(201).json({
      threadId,
      resolution
    });
  } catch (err) {
    console.error('Resolve thread failed:', err);
    return res.status(500).json({ error: 'Failed to resolve thread' });
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

router.post('/:workspaceId/rooms/:roomId/review/submit', async (req: WorkspaceRequest, res: Response) => {
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

    const bundleIdInput = String(req.body?.bundleId || '').trim();
    const bundleId = bundleIdInput || await getLatestReportV2BundleId(workspaceId, roomId);
    if (!bundleId) {
      return res.status(400).json({ error: 'bundleId is required (or generate Report V2 first).' });
    }

    const stage = String(req.body?.stage || 'manager_review').trim() || 'manager_review';
    const reviewerIdRaw = req.body?.reviewerId;
    const reviewerId = reviewerIdRaw === null || reviewerIdRaw === undefined || reviewerIdRaw === ''
      ? null
      : Number(reviewerIdRaw);
    if (reviewerId !== null && !Number.isFinite(reviewerId)) {
      return res.status(400).json({ error: 'reviewerId must be numeric when provided' });
    }

    if (reviewerId !== null) {
      const reviewerCheck = await query(
        `
        SELECT user_id
        FROM workspace_members
        WHERE workspace_id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [workspaceId, reviewerId]
      );
      if (reviewerCheck.rows.length === 0 && String(reviewerId) !== String(req.user!.id)) {
        return res.status(404).json({ error: 'Reviewer is not a member of this workspace.' });
      }
    }

    const note = req.body?.note ? String(req.body.note).trim() : null;
    const insertResult = await query(
      `
      INSERT INTO review_submissions (
        workspace_id,
        room_id,
        bundle_id,
        stage,
        status,
        submitted_by,
        reviewer_id,
        note
      )
      VALUES ($1,$2,$3,$4,'pending',$5,$6,$7)
      RETURNING *
      `,
      [workspaceId, roomId, bundleId, stage, req.user!.id, reviewerId, note]
    );

    const submission = toReviewSubmissionRecord(insertResult.rows[0]);
    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_review_submitted',
      metadata: {
        submissionId: submission.id,
        bundleId: submission.bundleId,
        stage: submission.stage,
        reviewerId: submission.reviewerId
      }
    });

    if (submission.reviewerId && String(submission.reviewerId) !== String(req.user!.id)) {
      try {
        const actorName = await resolveUserDisplayName(req.user!.id);
        const notificationInsert = await query(
          `
          INSERT INTO notifications (user_id, workspace_id, title, message, type, is_read, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
          RETURNING *
          `,
          [
            submission.reviewerId,
            workspaceId,
            'Review requested',
            `${actorName} requested your review for Report bundle ${submission.bundleId} in room "${room.name}".`,
            'approval'
          ]
        );
        emitToUser(submission.reviewerId, 'notification-created', {
          ...notificationInsert.rows[0],
          roomId,
          reviewSubmissionId: submission.id
        });
      } catch (notifyErr) {
        console.warn('Review submit notification skipped:', notifyErr);
      }
    }

    emitToDecisionRoom(workspaceId, roomId, 'decision-room:review-submitted', {
      roomId,
      submission
    });

    return res.status(201).json({
      roomId,
      submission
    });
  } catch (err) {
    console.error('Submit review failed:', err);
    return res.status(500).json({ error: 'Failed to submit review' });
  }
});

router.post('/:workspaceId/rooms/:roomId/review/respond', async (req: WorkspaceRequest, res: Response) => {
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

    const submissionId = Number(req.body?.submissionId);
    if (!Number.isFinite(submissionId)) {
      return res.status(400).json({ error: 'submissionId is required' });
    }

    const decision = String(req.body?.decision || req.body?.status || '').toLowerCase();
    const allowedStatus = decision === 'approved'
      ? 'approved'
      : decision === 'rejected'
        ? 'rejected'
        : decision === 'cancelled'
          ? 'cancelled'
          : null;
    if (!allowedStatus) {
      return res.status(400).json({ error: "decision must be one of 'approved', 'rejected', 'cancelled'" });
    }

    const existingResult = await query(
      `
      SELECT *
      FROM review_submissions
      WHERE id = $1
        AND workspace_id = $2
        AND room_id = $3
      LIMIT 1
      `,
      [submissionId, workspaceId, roomId]
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Review submission not found' });
    }

    const existing = existingResult.rows[0];
    if (String(existing.status || '') !== 'pending') {
      return res.status(400).json({ error: `Review submission already ${existing.status}` });
    }

    const responseNote = req.body?.responseNote ? String(req.body.responseNote).trim() : null;
    const updateResult = await query(
      `
      UPDATE review_submissions
      SET status = $1,
          response_note = $2,
          responded_by = $3,
          responded_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [allowedStatus, responseNote, req.user!.id, submissionId]
    );

    const submission = toReviewSubmissionRecord(updateResult.rows[0]);
    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_review_responded',
      metadata: {
        submissionId: submission.id,
        bundleId: submission.bundleId,
        status: submission.status
      }
    });

    if (existing.submitted_by && String(existing.submitted_by) !== String(req.user!.id)) {
      try {
        const reviewerName = await resolveUserDisplayName(req.user!.id);
        const notificationInsert = await query(
          `
          INSERT INTO notifications (user_id, workspace_id, title, message, type, is_read, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
          RETURNING *
          `,
          [
            Number(existing.submitted_by),
            workspaceId,
            'Review response received',
            `${reviewerName} ${submission.status} review submission ${submission.id} in room "${room.name}".`,
            'approval'
          ]
        );
        emitToUser(Number(existing.submitted_by), 'notification-created', {
          ...notificationInsert.rows[0],
          roomId,
          reviewSubmissionId: submission.id
        });
      } catch (notifyErr) {
        console.warn('Review response notification skipped:', notifyErr);
      }
    }

    emitToDecisionRoom(workspaceId, roomId, 'decision-room:review-responded', {
      roomId,
      submission
    });

    return res.json({
      roomId,
      submission
    });
  } catch (err) {
    console.error('Respond review failed:', err);
    return res.status(500).json({ error: 'Failed to respond review submission' });
  }
});

router.get('/:workspaceId/rooms/:roomId/review/submissions', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const result = await query(
      `
      SELECT *
      FROM review_submissions
      WHERE workspace_id = $1
        AND room_id = $2
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [workspaceId, roomId]
    );

    return res.json({
      roomId,
      submissions: result.rows.map(toReviewSubmissionRecord)
    });
  } catch (err) {
    console.error('List review submissions failed:', err);
    return res.status(500).json({ error: 'Failed to load review submissions' });
  }
});

router.get('/:workspaceId/rooms/:roomId/evidence/coverage-trend', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const artifactResult = await query(
      `
      SELECT id, payload, created_at
      FROM artifacts
      WHERE workspace_id = $1
        AND room_id = $2
        AND artifact_type IN ('report_block', 'decision_brief')
        AND payload->>'reportVersion' = 'v2'
      ORDER BY created_at ASC
      LIMIT 1500
      `,
      [workspaceId, roomId]
    );

    const pointsByBundle = new Map<string, CoverageTrendPoint>();
    for (const row of artifactResult.rows) {
      const payload = parseJsonMaybe<Record<string, any>>(row.payload, {});
      const bundleId = String(payload.bundleId || '').trim();
      if (!bundleId || pointsByBundle.has(bundleId)) continue;
      const quality = payload.quality && typeof payload.quality === 'object' ? payload.quality : {};
      const ratio = Number(quality?.evidenceCoverageRatio);
      const unsupportedClaims = Number(quality?.unsupportedClaims);
      const ts = String(payload.generatedAt || row.created_at || new Date().toISOString());
      if (!Number.isFinite(ratio) || !Number.isFinite(unsupportedClaims)) continue;
      pointsByBundle.set(bundleId, {
        ts,
        evidenceCoverageRatio: clampUnit(ratio),
        unsupportedClaims: Math.max(0, Math.floor(unsupportedClaims))
      });
    }

    let points = Array.from(pointsByBundle.values())
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    if (points.length === 0) {
      const analyticsResult = await query(
        `
        SELECT metadata, created_at
        FROM analytics_events
        WHERE workspace_id = $1
          AND room_id = $2
          AND event_type IN (
            'decision_room_report_v2_generated',
            'decision_room_report_v2_publish_blocked',
            'decision_room_report_v2_published',
            'decision_room_report_v2_quality_checked'
          )
        ORDER BY created_at ASC
        LIMIT 500
        `,
        [workspaceId, roomId]
      );
      points = analyticsResult.rows.map((row) => {
        const metadata = parseJsonMaybe<Record<string, any>>(row.metadata, {});
        return {
          ts: String(row.created_at),
          evidenceCoverageRatio: clampUnit(Number(metadata.evidenceCoverageRatio || 0)),
          unsupportedClaims: Math.max(0, Number(metadata.unsupportedClaims || 0))
        };
      });
    }

    return res.json({
      roomId,
      points,
      sampleSize: points.length
    });
  } catch (err) {
    console.error('Load evidence coverage trend failed:', err);
    return res.status(500).json({ error: 'Failed to load evidence coverage trend' });
  }
});

router.get('/:workspaceId/rooms/:roomId/roi', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const [firstRunResult, firstActionResult, statusDraftEventsResult, latestBundleId] = await Promise.all([
      query(
        `
        SELECT created_at
        FROM artifacts
        WHERE workspace_id = $1
          AND room_id = $2
          AND artifact_type = 'query_run'
        ORDER BY created_at ASC
        LIMIT 1
        `,
        [workspaceId, roomId]
      ),
      query(
        `
        SELECT created_at
        FROM artifacts
        WHERE workspace_id = $1
          AND room_id = $2
          AND artifact_type = 'action_item'
        ORDER BY created_at ASC
        LIMIT 1
        `,
        [workspaceId, roomId]
      ),
      query(
        `
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'decision_room_status_draft_generated')::int AS drafted_count,
          COUNT(*) FILTER (WHERE event_type = 'decision_room_actions_synced')::int AS synced_count
        FROM analytics_events
        WHERE workspace_id = $1
          AND room_id = $2
        `,
        [workspaceId, roomId]
      ),
      getLatestReportV2BundleId(workspaceId, roomId)
    ]);

    const roomCreatedAt = new Date(room.created_at).getTime();
    const firstRunAt = firstRunResult.rows[0]?.created_at ? new Date(firstRunResult.rows[0].created_at).getTime() : null;
    const firstActionAt = firstActionResult.rows[0]?.created_at ? new Date(firstActionResult.rows[0].created_at).getTime() : null;
    const timeToInsightMin = firstRunAt ? toRounded(Math.max(0, (firstRunAt - roomCreatedAt) / 60000), 2) : null;
    const timeToActionMin = firstRunAt && firstActionAt
      ? toRounded(Math.max(0, (firstActionAt - firstRunAt) / 60000), 2)
      : null;

    let evidenceCoverageRatio = 0;
    if (latestBundleId) {
      const bundle = await loadReportV2Bundle(workspaceId, roomId, latestBundleId);
      if (bundle) {
        const quality = await evaluateBundleClaimSupport(workspaceId, roomId, bundle);
        evidenceCoverageRatio = clampUnit(Number(quality.quality.evidenceCoverageRatio || 0));
      }
    }

    if (evidenceCoverageRatio === 0) {
      const artifacts = await listRoomArtifacts(workspaceId, roomId, 400);
      const actions = artifacts.filter((artifact) => artifact.artifact_type === 'action_item');
      if (actions.length > 0) {
        const { evidenceByAction } = await getActionEvidenceMap(
          workspaceId,
          roomId,
          actions.map((artifact) => Number(artifact.id))
        );
        const covered = actions.filter((action) => (evidenceByAction.get(Number(action.id)) || 0) > 0).length;
        evidenceCoverageRatio = clampUnit(covered / actions.length);
      }
    }

    const draftedCount = Number(statusDraftEventsResult.rows[0]?.drafted_count || 0);
    const syncedCount = Number(statusDraftEventsResult.rows[0]?.synced_count || 0);
    const manualUpdateReductionPct = draftedCount > 0
      ? Math.min(95, 30 + (syncedCount * 10) + (draftedCount * 12))
      : 0;

    const snapshot: RoomRoiSnapshot = {
      timeToInsightMin,
      timeToActionMin,
      manualUpdateReductionPct: toRounded(manualUpdateReductionPct, 2),
      evidenceCoverageRatio: toRounded(evidenceCoverageRatio, 5)
    };

    const scorecard: RoomRoiTargetStatus[] = [
      {
        key: 'time_to_first_insight',
        label: 'Time to first insight',
        target: 30,
        actual: snapshot.timeToInsightMin,
        comparator: 'lte',
        unit: 'minutes',
        met: snapshot.timeToInsightMin !== null && snapshot.timeToInsightMin <= 30
      },
      {
        key: 'insight_to_action',
        label: 'Insight to assigned action',
        target: 24 * 60,
        actual: snapshot.timeToActionMin,
        comparator: 'lte',
        unit: 'minutes',
        met: snapshot.timeToActionMin !== null && snapshot.timeToActionMin <= (24 * 60)
      },
      {
        key: 'manual_status_reduction',
        label: 'Manual status update reduction',
        target: 60,
        actual: snapshot.manualUpdateReductionPct,
        comparator: 'gte',
        unit: 'percent',
        met: snapshot.manualUpdateReductionPct >= 60
      },
      {
        key: 'evidence_coverage',
        label: 'Published evidence coverage',
        target: 0.9,
        actual: snapshot.evidenceCoverageRatio,
        comparator: 'gte',
        unit: 'ratio',
        met: snapshot.evidenceCoverageRatio >= 0.9
      }
    ];
    const scoredTargets = scorecard.filter((item) => item.actual !== null);
    const metTargets = scoredTargets.filter((item) => item.met).length;
    const overallStatus = scoredTargets.length === 0
      ? 'unknown'
      : metTargets === scoredTargets.length
        ? 'on_track'
        : metTargets >= Math.ceil(scoredTargets.length / 2)
          ? 'mixed'
          : 'at_risk';

    return res.json({
      roomId,
      snapshot,
      scorecard: {
        totalTargets: scorecard.length,
        measuredTargets: scoredTargets.length,
        metTargets,
        overallStatus,
        items: scorecard
      },
      basedOn: {
        latestBundleId: latestBundleId || null,
        draftedStatusEvents: draftedCount,
        syncedActionEvents: syncedCount
      }
    });
  } catch (err) {
    console.error('Load room ROI failed:', err);
    return res.status(500).json({ error: 'Failed to load room ROI snapshot' });
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
    const latestReportBundleId = await getLatestReportV2BundleId(workspaceId, roomId);

    const rowsAnalyzed = queryRuns.reduce((acc, artifact) => acc + Number(artifact.payload?.rowCount || 0), 0);
    const summary = [
      `Room "${room.name}" is in ${room.stage} stage.`,
      `${queryRuns.length} analysis run(s) processed ${rowsAnalyzed} row(s).`,
      `${actionItems.length} action item(s): ${completedActions.length} completed, ${inProgressActions.length} in progress, ${blockedActions.length} blocked.`,
      latestBrief ? `Latest brief: ${latestBrief.title}.` : 'Decision brief is still missing.',
      latestReportBundleId ? `Latest Report V2 bundle: ${latestReportBundleId}.` : 'Report V2 bundle has not been generated yet.',
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
      latestReportBundleId,
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
        latestReportBundleId: latestReportBundleId || null,
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

router.get('/:workspaceId/rooms/:roomId/outcomes/attribution', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const existing = await query(
      `
      SELECT *
      FROM room_outcome_attributions
      WHERE workspace_id = $1
        AND room_id = $2
      ORDER BY observed_at DESC, created_at DESC
      LIMIT 200
      `,
      [workspaceId, roomId]
    );

    const normalizeAttribution = (row: any): OutcomeAttribution => ({
      actionId: row.action_artifact_id ? Number(row.action_artifact_id) : null,
      metricKey: String(row.metric_key || ''),
      baselineValue: row.baseline_value === null || row.baseline_value === undefined ? null : Number(row.baseline_value),
      latestValue: row.latest_value === null || row.latest_value === undefined ? null : Number(row.latest_value),
      deltaPct: row.delta_pct === null || row.delta_pct === undefined ? null : Number(row.delta_pct),
      confidence: String(row.confidence || 'medium') as ReportClaimConfidence,
      evidenceArtifactIds: parseJsonMaybe<number[]>(row.evidence_artifact_ids, []).map((id) => Number(id)).filter((id) => Number.isFinite(id))
    });

    if (existing.rows.length > 0) {
      return res.json({
        roomId,
        attributions: existing.rows.map(normalizeAttribution),
        generated: false
      });
    }

    const artifacts = await listRoomArtifacts(workspaceId, roomId, 500);
    const actionItems = artifacts.filter((artifact) => artifact.artifact_type === 'action_item');
    const actionIds = actionItems.map((artifact) => Number(artifact.id)).filter((id) => Number.isFinite(id));

    if (!actionIds.length) {
      return res.json({
        roomId,
        attributions: [],
        generated: true
      });
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
      [workspaceId, roomId, actionIds, EVIDENCE_ARTIFACT_TYPES]
    );
    const evidenceByAction = new Map<number, number[]>();
    evidenceRows.rows.forEach((row) => {
      const actionId = Number(row.child_artifact_id);
      const evidenceId = Number(row.parent_artifact_id);
      const list = evidenceByAction.get(actionId) || [];
      list.push(evidenceId);
      evidenceByAction.set(actionId, list);
    });

    const snapshotRows = await query(
      `
      SELECT m.metric_key, s.value, s.observed_at
      FROM metric_value_snapshots s
      JOIN metric_definitions m ON m.id = s.metric_definition_id
      WHERE s.workspace_id = $1
        AND (s.room_id = $2 OR s.room_id IS NULL)
      ORDER BY s.observed_at DESC
      LIMIT 400
      `,
      [workspaceId, roomId]
    );
    const snapshotsByMetric = new Map<string, Array<{ value: number; observedAt: string }>>();
    snapshotRows.rows.forEach((row) => {
      const key = String(row.metric_key || '');
      if (!key) return;
      const list = snapshotsByMetric.get(key) || [];
      const parsedValue = Number(row.value);
      if (Number.isFinite(parsedValue)) {
        list.push({ value: parsedValue, observedAt: row.observed_at });
      }
      snapshotsByMetric.set(key, list);
    });

    const fallbackMetricKey = snapshotsByMetric.keys().next().value || 'pipeline_created_amount';
    const attributions: OutcomeAttribution[] = actionItems.slice(0, 120).map((action) => {
      const payload = action.payload || {};
      const metricKey = String(payload.metricKey || payload.expectedMetricKey || fallbackMetricKey);
      const metricSnapshots = snapshotsByMetric.get(metricKey) || [];
      const latestValue = metricSnapshots[0]?.value ?? null;
      const baselineValue = metricSnapshots[1]?.value ?? null;
      const deltaPct = safeDeltaPct(latestValue, baselineValue);
      const evidenceIds = evidenceByAction.get(Number(action.id)) || [];
      const status = String(payload.status || '').toLowerCase();
      const confidence: ReportClaimConfidence = evidenceIds.length === 0
        ? 'low'
        : ['done', 'completed', 'closed'].includes(status)
          ? 'high'
          : 'medium';

      return {
        actionId: Number(action.id),
        metricKey,
        baselineValue,
        latestValue,
        deltaPct,
        confidence,
        evidenceArtifactIds: evidenceIds
      };
    });

    const persist = String(req.query.persist || 'false').toLowerCase() === 'true';
    if (persist && attributions.length > 0) {
      for (const attribution of attributions) {
        await query(
          `
          INSERT INTO room_outcome_attributions (
            workspace_id,
            room_id,
            action_artifact_id,
            metric_key,
            baseline_value,
            latest_value,
            delta_pct,
            confidence,
            evidence_artifact_ids,
            observed_at,
            created_by
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10)
          `,
          [
            workspaceId,
            roomId,
            attribution.actionId,
            attribution.metricKey,
            attribution.baselineValue,
            attribution.latestValue,
            attribution.deltaPct,
            attribution.confidence,
            JSON.stringify(attribution.evidenceArtifactIds || []),
            req.user!.id
          ]
        );
      }
    }

    return res.json({
      roomId,
      attributions,
      generated: true
    });
  } catch (err) {
    console.error('Load outcome attribution failed:', err);
    return res.status(500).json({ error: 'Failed to load outcome attribution' });
  }
});

router.get('/:workspaceId/rooms/:roomId/playbooks/recommendations', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const artifacts = await listRoomArtifacts(workspaceId, roomId, 500);
    const guide = await buildRoomGuide(workspaceId, room, artifacts);
    const actionItems = artifacts.filter((artifact) => artifact.artifact_type === 'action_item');
    const queryRuns = artifacts.filter((artifact) => artifact.artifact_type === 'query_run');
    const briefs = artifacts.filter((artifact) => artifact.artifact_type === 'decision_brief');
    const latestBundleId = await getLatestReportV2BundleId(workspaceId, roomId);
    const latestBundle = latestBundleId
      ? await loadReportV2Bundle(workspaceId, roomId, latestBundleId)
      : null;
    const quality = latestBundle ? await evaluateBundleClaimSupport(workspaceId, roomId, latestBundle) : null;

    const recommendations: Array<{
      id: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      reason: string;
      action: string;
      blockers: string[];
    }> = [];

    if (queryRuns.length === 0) {
      recommendations.push({
        id: 'run_first_analysis',
        priority: 'high',
        title: 'Run first analysis query',
        reason: 'No query artifacts are available for this room yet.',
        action: 'Open Query panel and run SQL/NL analysis to generate evidence artifacts.',
        blockers: ['No query_run artifacts']
      });
    }

    if (briefs.length === 0) {
      recommendations.push({
        id: 'generate_brief',
        priority: 'medium',
        title: 'Generate decision brief',
        reason: 'Room has analysis but no decision brief for stakeholder alignment.',
        action: 'Generate brief/report and include evidence-linked claims.',
        blockers: ['No decision_brief artifact']
      });
    }

    if (!latestBundle) {
      recommendations.push({
        id: 'generate_report_v2',
        priority: 'high',
        title: 'Generate Report V2 bundle',
        reason: 'Weekly evidence-first report is missing.',
        action: 'Generate Report V2 from Report panel and review quality blockers.',
        blockers: ['No Report V2 bundle']
      });
    } else if (quality?.quality.publishBlocked) {
      recommendations.push({
        id: 'fix_report_quality',
        priority: 'high',
        title: 'Fix report publish blockers',
        reason: `${quality.quality.unsupportedClaims} unsupported claim(s) prevent publish.`,
        action: 'Attach missing evidence artifacts to unsupported claims and regenerate report sections.',
        blockers: quality.quality.blockers
      });
    }

    if (actionItems.length === 0) {
      recommendations.push({
        id: 'create_actions',
        priority: 'medium',
        title: 'Create owner action items',
        reason: 'No action items exist to convert insights into execution.',
        action: 'Create actions with owner, due date, and evidence links.',
        blockers: ['No action_item artifacts']
      });
    }

    if (guide.nextBestStep) {
      recommendations.push({
        id: `guide_${guide.nextBestStep.stepId}`,
        priority: 'medium',
        title: `Complete guide step: ${guide.nextBestStep.stepId}`,
        reason: guide.nextBestStep.reason,
        action: 'Use guided rail completion after resolving blockers.',
        blockers: guide.nextBestStep.blockingIssues || []
      });
    }

    return res.json({
      roomId,
      completionRatio: guide.completionRatio,
      nextBestStep: guide.nextBestStep,
      recommendations
    });
  } catch (err) {
    console.error('Playbook recommendations failed:', err);
    return res.status(500).json({ error: 'Failed to load playbook recommendations' });
  }
});

router.get('/:workspaceId/rooms/:roomId/playbooks/onboarding', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const profile = await getOrCreateUserPreferenceProfile(workspaceId, Number(req.user!.id));
    const artifacts = await listRoomArtifacts(workspaceId, roomId, 500);
    const guide = await buildRoomGuide(workspaceId, room, artifacts);

    const panelMap: Record<string, 'sheets' | 'query' | 'pivot' | 'visuals' | 'report' | 'actions' | 'comms'> = {
      connect_data: 'sheets',
      analyze_data: 'query',
      build_brief: 'report',
      assign_actions: 'actions',
      sync_actions: 'actions'
    };

    const onboardingSteps = guide.steps.map((step) => ({
      id: step.id,
      label: step.label,
      stage: step.stage,
      completed: step.completed,
      completedAt: step.completedAt,
      blockers: step.blockingIssues || [],
      panel: panelMap[step.id] || 'sheets',
      actionLabel: step.completed ? 'Review' : 'Open step'
    }));

    return res.json({
      roomId,
      persona: profile.persona,
      uiMode: profile.uiMode,
      completionRatio: guide.completionRatio,
      nextBestStep: guide.nextBestStep,
      steps: onboardingSteps
    });
  } catch (err) {
    console.error('Onboarding playbook load failed:', err);
    return res.status(500).json({ error: 'Failed to load onboarding playbook' });
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

router.post('/:workspaceId/rooms/:roomId/reports/v2/generate', async (req: WorkspaceRequest, res: Response) => {
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

    const featureEnabled = await isWorkspaceFeatureEnabled(workspaceId, REPORT_V2_FLAG_KEY, true);
    if (!featureEnabled) {
      return res.status(404).json({ error: 'Report V2 is not enabled for this workspace.' });
    }

    const body = (req.body || {}) as ReportV2GenerateRequest;
    const timeframeDays = clampTimeframeDays(body.timeframeDays);
    const compareMode = body.compareMode || 'previous_period';
    const focus = body.focus || REPORT_V2_FOCUS;
    const persist = body.persist !== false;

    if (compareMode !== 'previous_period') {
      return res.status(400).json({ error: "compareMode must be 'previous_period'" });
    }
    if (focus !== REPORT_V2_FOCUS) {
      return res.status(400).json({ error: `focus must be '${REPORT_V2_FOCUS}' for MVP` });
    }

    const sourceArtifactsResult = await query(
      `
      SELECT id, artifact_type, title, payload, created_at
      FROM artifacts
      WHERE workspace_id = $1
        AND room_id = $2
        AND artifact_type IN ('dataset_version', 'query_run', 'chart', 'pivot', 'report_block', 'decision_brief')
      ORDER BY created_at DESC
      LIMIT 250
      `,
      [workspaceId, roomId]
    );

    const sourceArtifacts = sourceArtifactsResult.rows.map((artifact) => ({
      ...artifact,
      payload: parseJsonMaybe(artifact.payload, {})
    }));

    const sourceArtifactIds = sourceArtifacts
      .map((artifact) => Number(artifact.id))
      .filter((id) => Number.isFinite(id))
      .slice(0, 40);

    let sourceRows: Record<string, any>[] = [];
    for (const artifact of sourceArtifacts) {
      if (!['query_run', 'pivot', 'chart', 'dataset_version'].includes(String(artifact.artifact_type))) continue;
      const rows = parseArtifactRowsFromPayload(artifact.payload || {});
      if (rows.length > 0) {
        sourceRows = rows;
        break;
      }
    }

    if (!sourceRows.length) {
      const runContext = parseRoomRunContext(room.run_context);
      const datasetResolution = await resolveDatasetRows(workspaceId, undefined, {
        datasetId: runContext.datasetId || runContext.sourceDatasetId || null
      });
      sourceRows = datasetResolution.rows;
    }

    const sourceColumns = extractColumns(sourceRows);
    const fieldResolution = resolveRevOpsFieldMap(sourceColumns);
    const metrics = computeRevOpsMetrics({
      rows: sourceRows,
      fieldMap: fieldResolution.map,
      timeframeDays,
      evidenceArtifactIds: sourceArtifactIds
    });
    const patterns = detectRevOpsPatterns({
      metrics,
      evidenceArtifactIds: sourceArtifactIds
    });

    const kpiClaims = metrics.snapshots.map((metric) => createMetricClaim({
      metric,
      sampleSize: metrics.sampleSizeCurrent
    }));

    const topDeltaMetric = metrics.snapshots
      .filter((metric) => metric.deltaPct !== null && Number.isFinite(Number(metric.deltaPct)))
      .sort((a, b) => Math.abs(Number(b.deltaPct || 0)) - Math.abs(Number(a.deltaPct || 0)))[0] || null;

    const patternClaims: ReportClaim[] = patterns.length > 0
      ? patterns.map((pattern) => ({
          id: pattern.id,
          statement: pattern.statement,
          metricKey: pattern.metricKey,
          valueCurrent: pattern.valueCurrent,
          valuePrevious: pattern.valuePrevious,
          deltaPct: pattern.deltaPct,
          confidence: pattern.confidence,
          evidenceArtifactIds: pattern.evidenceArtifactIds,
          supported: pattern.evidenceArtifactIds.length > 0
        }))
      : [{
          id: `pattern_none_${Date.now()}`,
          statement: 'No major bottlenecks or volatility anomalies were detected in the current window.',
          metricKey: 'pattern_none',
          valueCurrent: null,
          valuePrevious: null,
          deltaPct: null,
          confidence: 'medium',
          evidenceArtifactIds: sourceArtifactIds,
          supported: sourceArtifactIds.length > 0
        }];

    const explanationClaim: ReportClaim = {
      id: `explanation_${Date.now()}`,
      statement: topDeltaMetric
        ? `Largest movement this week is ${topDeltaMetric.label} with ${topDeltaMetric.deltaPct?.toFixed(1)}% period-over-period change.`
        : 'Trend explanation is limited due to insufficient previous-period data.',
      metricKey: topDeltaMetric?.metricKey || 'report_explanation',
      valueCurrent: topDeltaMetric?.valueCurrent ?? null,
      valuePrevious: topDeltaMetric?.valuePrevious ?? null,
      deltaPct: topDeltaMetric?.deltaPct ?? null,
      confidence: topDeltaMetric ? getClaimConfidence(metrics.sampleSizeCurrent, true) : 'low',
      evidenceArtifactIds: sourceArtifactIds,
      supported: sourceArtifactIds.length > 0
    };

    const recommendationClaims: ReportClaim[] = patterns.slice(0, 3).map((pattern, index) => ({
      id: `recommendation_${index + 1}_${Date.now()}`,
      statement: `Assign owner follow-up for "${pattern.title}" and review supporting evidence before next weekly sync.`,
      metricKey: `recommendation_${pattern.metricKey}`,
      valueCurrent: null,
      valuePrevious: null,
      deltaPct: null,
      confidence: 'medium',
      evidenceArtifactIds: pattern.evidenceArtifactIds,
      supported: pattern.evidenceArtifactIds.length > 0
    }));

    if (!recommendationClaims.length) {
      recommendationClaims.push({
        id: `recommendation_default_${Date.now()}`,
        statement: 'Proceed with weekly action review and keep evidence links attached to owner updates.',
        metricKey: 'recommendation_default',
        valueCurrent: null,
        valuePrevious: null,
        deltaPct: null,
        confidence: 'medium',
        evidenceArtifactIds: sourceArtifactIds,
        supported: sourceArtifactIds.length > 0
      });
    }

    const bundleId = `rptv2_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const generatedAt = new Date().toISOString();
    const trendSectionId = `section_trend_${bundleId}`;
    const stageSectionId = `section_stage_${bundleId}`;

    let trendChartArtifactId: number | null = null;
    let stageChartArtifactId: number | null = null;

    if (persist) {
      const trendChartArtifact = await createArtifact({
        workspaceId,
        projectId: room.project_id,
        roomId,
        artifactType: 'chart',
        title: `RevOps Trend - ${bundleId}`,
        description: 'Auto-generated trend chart for Report V2.',
        payload: {
          chart: {
            id: `report_v2_trend_${bundleId}`,
            type: 'line',
            title: 'Pipeline vs Closed Won (Daily)',
            xAxis: 'date',
            yAxis: 'pipeline_created_amount',
            data: metrics.dailySeries
          },
          previewRows: metrics.dailySeries
        },
        metadata: { reportVersion: 'v2', bundleId, generatedAt },
        createdBy: req.user!.id
      });
      trendChartArtifactId = Number(trendChartArtifact.id);
      await createLineageEdges({
        workspaceId,
        roomId,
        parentArtifactIds: sourceArtifactIds,
        childArtifactId: trendChartArtifactId,
        relationType: 'derived_from',
        createdBy: req.user!.id
      });

      const stageChartArtifact = await createArtifact({
        workspaceId,
        projectId: room.project_id,
        roomId,
        artifactType: 'chart',
        title: `Stage Distribution - ${bundleId}`,
        description: 'Auto-generated stage bottleneck view for Report V2.',
        payload: {
          chart: {
            id: `report_v2_stage_${bundleId}`,
            type: 'bar',
            title: 'Current Stage Distribution',
            xAxis: 'stage',
            yAxis: 'count',
            data: metrics.stageDistribution
          },
          previewRows: metrics.stageDistribution
        },
        metadata: { reportVersion: 'v2', bundleId, generatedAt },
        createdBy: req.user!.id
      });
      stageChartArtifactId = Number(stageChartArtifact.id);
      await createLineageEdges({
        workspaceId,
        roomId,
        parentArtifactIds: sourceArtifactIds,
        childArtifactId: stageChartArtifactId,
        relationType: 'derived_from',
        createdBy: req.user!.id
      });
    }

    const sections: ReportSection[] = [
      {
        id: `section_kpi_${bundleId}`,
        type: 'kpi_delta',
        title: 'KPI Deltas (Current vs Previous Period)',
        contentMarkdown: kpiClaims.map((claim) => `- ${claim.statement}`).join('\n'),
        claims: kpiClaims,
        chartArtifactIds: []
      },
      {
        id: trendSectionId,
        type: 'trend',
        title: 'Trend View',
        contentMarkdown: metrics.dailySeries.length
          ? 'Daily trend shows movement in pipeline creation and closed-won outcomes.'
          : 'Trend view is limited due to missing date-aligned records.',
        claims: [
          {
            id: `trend_claim_${bundleId}`,
            statement: metrics.dailySeries.length
              ? `Trend chart includes ${metrics.dailySeries.length} day(s) from the selected window.`
              : 'Insufficient date coverage to produce a full trend profile.',
            metricKey: 'trend_coverage',
            valueCurrent: metrics.dailySeries.length,
            valuePrevious: null,
            deltaPct: null,
            confidence: metrics.dailySeries.length >= 5 ? 'high' : 'low',
            evidenceArtifactIds: sourceArtifactIds,
            supported: sourceArtifactIds.length > 0
          }
        ],
        chartArtifactIds: [trendChartArtifactId, stageChartArtifactId].filter((id): id is number => Number.isFinite(Number(id)))
      },
      {
        id: stageSectionId,
        type: 'pattern',
        title: 'Pattern Findings',
        contentMarkdown: patternClaims.map((claim) => `- ${claim.statement}`).join('\n'),
        claims: patternClaims,
        chartArtifactIds: stageChartArtifactId ? [stageChartArtifactId] : []
      },
      {
        id: `section_explanation_${bundleId}`,
        type: 'explanation',
        title: 'Evidence-First Explanation',
        contentMarkdown: explanationClaim.statement,
        claims: [explanationClaim],
        chartArtifactIds: [trendChartArtifactId].filter((id): id is number => Number.isFinite(Number(id)))
      },
      {
        id: `section_recommendation_${bundleId}`,
        type: 'recommendation',
        title: 'Recommended Actions',
        contentMarkdown: recommendationClaims.map((claim) => `- ${claim.statement}`).join('\n'),
        claims: recommendationClaims,
        chartArtifactIds: []
      }
    ];

    const quality = computeReportQuality(sections);
    const inputRequirements: ReportInputRequirements = {
      mappedFields: fieldResolution.mappedFields,
      missingFields: fieldResolution.missingFields,
      warnings: [
        ...fieldResolution.missingFields.map((field) => `Missing mapped field: ${field}`),
        ...(sourceRows.length === 0 ? ['No row-level evidence found. Report sections are generated with limited confidence.'] : [])
      ]
    };

    let summaryArtifactId: number | null = null;
    const sectionArtifactIds: number[] = [];
    if (persist) {
      for (let index = 0; index < sections.length; index += 1) {
        const section = sections[index];
        const sectionArtifact = await createArtifact({
          workspaceId,
          projectId: room.project_id,
          roomId,
          artifactType: 'report_block',
          title: section.title,
          description: `Report V2 section (${section.type})`,
          payload: {
            reportVersion: 'v2',
            bundleId,
            generatedAt,
            sectionId: section.id,
            sectionType: section.type,
            order: index + 1,
            title: section.title,
            contentMarkdown: section.contentMarkdown,
            claims: section.claims,
            chartArtifactIds: section.chartArtifactIds,
            quality,
            kpiSnapshot: metrics.snapshots,
            inputRequirements
          },
          metadata: {
            focus,
            compareMode,
            timeframeDays
          },
          createdBy: req.user!.id
        });

        const sectionArtifactId = Number(sectionArtifact.id);
        sectionArtifactIds.push(sectionArtifactId);
        await createLineageEdges({
          workspaceId,
          roomId,
          parentArtifactIds: sourceArtifactIds,
          childArtifactId: sectionArtifactId,
          relationType: 'derived_from',
          createdBy: req.user!.id
        });
        if (section.chartArtifactIds.length > 0) {
          await createLineageEdges({
            workspaceId,
            roomId,
            parentArtifactIds: section.chartArtifactIds,
            childArtifactId: sectionArtifactId,
            relationType: 'derived_from',
            createdBy: req.user!.id
          });
        }
      }

      const briefArtifact = await createArtifact({
        workspaceId,
        projectId: room.project_id,
        roomId,
        artifactType: 'decision_brief',
        title: `Report V2 Weekly Brief - ${new Date().toLocaleDateString()}`,
        description: 'Evidence-first RevOps weekly report bundle summary.',
        payload: {
          reportVersion: 'v2',
          bundleId,
          generatedAt,
          focus,
          compareMode,
          timeframeDays,
          highlights: sections.slice(0, 3).flatMap((section) => section.claims.slice(0, 1).map((claim) => claim.statement)),
          quality,
          kpiSnapshot: metrics.snapshots,
          inputRequirements
        },
        metadata: {
          reportVersion: 'v2'
        },
        createdBy: req.user!.id
      });
      summaryArtifactId = Number(briefArtifact.id);
      await createLineageEdges({
        workspaceId,
        roomId,
        parentArtifactIds: [...sourceArtifactIds, ...sectionArtifactIds].slice(0, 120),
        childArtifactId: summaryArtifactId,
        relationType: 'evidence_for',
        createdBy: req.user!.id
      });

      const autoThreadResult = await query(
        `
        INSERT INTO comment_threads (workspace_id, room_id, artifact_id, anchor, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [workspaceId, roomId, summaryArtifactId, JSON.stringify({ type: 'report_v2', bundleId }), req.user!.id]
      );
      const threadId = Number(autoThreadResult.rows[0]?.id || 0);
      if (threadId > 0) {
        const summaryMessage = [
          `Report V2 bundle generated: ${bundleId}`,
          `Coverage: ${(quality.evidenceCoverageRatio * 100).toFixed(0)}%`,
          quality.publishBlocked
            ? `Publish blocked: ${quality.blockers.join(' | ')}`
            : 'Ready for publish to Slack.'
        ].join('\n');
        await query(
          `
          INSERT INTO comments (thread_id, user_id, content, mentions)
          VALUES ($1, $2, $3, $4)
          `,
          [threadId, req.user!.id, summaryMessage, JSON.stringify([])]
        );
      }
    }

    const bundle: ReportV2Bundle = {
      bundleId,
      roomId,
      generatedAt,
      quality,
      sections,
      kpiSnapshot: metrics.snapshots,
      inputRequirements,
      summaryArtifactId
    };

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_report_v2_generated',
      metadata: {
        bundleId,
        timeframeDays,
        compareMode,
        focus,
        sectionCount: sections.length,
        unsupportedClaims: quality.unsupportedClaims,
        evidenceCoverageRatio: quality.evidenceCoverageRatio,
        publishBlocked: quality.publishBlocked
      }
    });

    emitToDecisionRoom(workspaceId, roomId, 'decision-room:report-generated', {
      roomId,
      bundleId,
      quality
    });

    return res.status(201).json(bundle);
  } catch (err) {
    console.error('Generate Report V2 failed:', err);
    return res.status(500).json({ error: 'Failed to generate Report V2 bundle' });
  }
});

router.get('/:workspaceId/rooms/:roomId/reports/v2/latest', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const featureEnabled = await isWorkspaceFeatureEnabled(workspaceId, REPORT_V2_FLAG_KEY, true);
    if (!featureEnabled) {
      return res.status(404).json({ error: 'Report V2 is not enabled for this workspace.' });
    }

    const bundleId = await getLatestReportV2BundleId(workspaceId, roomId);
    if (!bundleId) {
      return res.status(404).json({ error: 'No Report V2 bundle found for this room.' });
    }

    const bundle = await loadReportV2Bundle(workspaceId, roomId, bundleId);
    if (!bundle) {
      return res.status(404).json({ error: 'Report V2 bundle not found.' });
    }

    return res.json(bundle);
  } catch (err) {
    console.error('Load latest Report V2 failed:', err);
    return res.status(500).json({ error: 'Failed to load latest Report V2 bundle' });
  }
});

router.get('/:workspaceId/rooms/:roomId/reports/v2/:bundleId/quality', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const bundleId = String(req.params.bundleId || '').trim();
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!bundleId) {
      return res.status(400).json({ error: 'bundleId is required' });
    }

    const featureEnabled = await isWorkspaceFeatureEnabled(workspaceId, REPORT_V2_FLAG_KEY, true);
    if (!featureEnabled) {
      return res.status(404).json({ error: 'Report V2 is not enabled for this workspace.' });
    }

    const bundle = await loadReportV2Bundle(workspaceId, roomId, bundleId);
    if (!bundle) {
      return res.status(404).json({ error: 'Report V2 bundle not found.' });
    }

    const [qualityCheck, metricPolicy] = await Promise.all([
      evaluateBundleClaimSupport(workspaceId, roomId, bundle),
      evaluateBundleMetricPolicy(workspaceId, bundle)
    ]);
    const mergedQuality: ReportQuality = {
      ...qualityCheck.quality,
      publishBlocked: qualityCheck.quality.publishBlocked || metricPolicy.publishBlocked,
      blockers: [...qualityCheck.quality.blockers, ...metricPolicy.blockers],
      metricPolicyBlocked: metricPolicy.publishBlocked,
      metricPolicyFailures: metricPolicy.checks.filter((check) => check.blocking)
    };

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_report_v2_quality_checked',
      metadata: {
        bundleId,
        evidenceCoverageRatio: mergedQuality.evidenceCoverageRatio,
        unsupportedClaims: mergedQuality.unsupportedClaims,
        publishBlocked: mergedQuality.publishBlocked,
        metricPolicyBlocked: metricPolicy.publishBlocked
      }
    });

    return res.json({
      bundleId,
      quality: mergedQuality,
      claimChecks: qualityCheck.claimChecks,
      metricPolicy
    });
  } catch (err) {
    console.error('Load Report V2 quality failed:', err);
    return res.status(500).json({ error: 'Failed to evaluate Report V2 quality' });
  }
});

router.post('/:workspaceId/rooms/:roomId/reports/v2/:bundleId/publish', async (req: WorkspaceRequest, res: Response) => {
  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const bundleId = String(req.params.bundleId || '').trim();
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!bundleId) {
      return res.status(400).json({ error: 'bundleId is required' });
    }

    const featureEnabled = await isWorkspaceFeatureEnabled(workspaceId, REPORT_V2_FLAG_KEY, true);
    if (!featureEnabled) {
      return res.status(404).json({ error: 'Report V2 is not enabled for this workspace.' });
    }

    const bundle = await loadReportV2Bundle(workspaceId, roomId, bundleId);
    if (!bundle) {
      return res.status(404).json({ error: 'Report V2 bundle not found.' });
    }

    const idempotencyKey = resolveIdempotencyKey(req);
    const idempotency = await beginIdempotentOperation({
      workspaceId,
      roomId,
      endpointKey: `reports_v2_publish:${bundleId}`,
      userId: req.user!.id,
      idempotencyKey
    });
    if (idempotency.replay) {
      return res.status(idempotency.replay.statusCode).json({
        ...idempotency.replay.payload,
        replayed: true,
        idempotencyKey: idempotency.idempotencyKey
      });
    }
    if (idempotency.inProgress) {
      return res.status(409).json({
        error: 'A request with the same idempotency key is already in progress.',
        idempotencyKey: idempotency.idempotencyKey
      });
    }

    const [qualityCheck, metricPolicy] = await Promise.all([
      evaluateBundleClaimSupport(workspaceId, roomId, bundle),
      evaluateBundleMetricPolicy(workspaceId, bundle)
    ]);
    const mergedQuality: ReportQuality = {
      ...qualityCheck.quality,
      publishBlocked: qualityCheck.quality.publishBlocked || metricPolicy.publishBlocked,
      blockers: [...qualityCheck.quality.blockers, ...metricPolicy.blockers],
      metricPolicyBlocked: metricPolicy.publishBlocked,
      metricPolicyFailures: metricPolicy.checks.filter((check) => check.blocking)
    };

    const profileThresholdRaw = Number(req.body?.minProfileQualityScore ?? 0.65);
    const profileQualityThreshold = Number.isFinite(profileThresholdRaw)
      ? clampUnit(profileThresholdRaw)
      : 0.65;
    const latestProfileResult = await query(
      `
      SELECT id, quality_score, created_at
      FROM dataset_profiles
      WHERE workspace_id = $1
        AND room_id = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [workspaceId, roomId]
    );
    const latestProfile = latestProfileResult.rows[0] || null;
    const profileQualityScore = latestProfile ? Number(latestProfile.quality_score || 0) : null;
    const profileGateBlocked = profileQualityScore !== null && profileQualityScore < profileQualityThreshold;

    if (profileGateBlocked) {
      const profileBlockedResponse = {
        error: 'Publish blocked due to data trust gate.',
        trustGate: {
          profileId: Number(latestProfile.id),
          qualityScore: profileQualityScore,
          threshold: profileQualityThreshold,
          profileGeneratedAt: latestProfile.created_at
        },
        quality: mergedQuality
      };

      await recordAnalyticsEvent({
        workspaceId,
        roomId,
        userId: req.user!.id,
        eventType: 'decision_room_report_v2_publish_blocked',
        metadata: {
          bundleId,
          reason: 'data_profile_gate',
          qualityScore: profileQualityScore,
          threshold: profileQualityThreshold
        }
      });

      await completeIdempotentOperation({
        workspaceId,
        roomId,
        endpointKey: `reports_v2_publish:${bundleId}`,
        idempotencyKey: idempotency.idempotencyKey,
        statusCode: 400,
        payload: profileBlockedResponse
      });

      return res.status(400).json(profileBlockedResponse);
    }

    if (mergedQuality.publishBlocked) {
      await recordAnalyticsEvent({
        workspaceId,
        roomId,
        userId: req.user!.id,
        eventType: 'decision_room_report_v2_publish_blocked',
        metadata: {
          bundleId,
          unsupportedClaims: mergedQuality.unsupportedClaims,
          blockers: mergedQuality.blockers,
          metricPolicyBlocked: metricPolicy.publishBlocked
        }
      });
      const blockedResponse = {
        error: metricPolicy.publishBlocked
          ? 'Publish blocked due to metric validation policy.'
          : 'Publish blocked due to unsupported claims.',
        quality: mergedQuality,
        claimChecks: qualityCheck.claimChecks,
        metricPolicy
      };
      await completeIdempotentOperation({
        workspaceId,
        roomId,
        endpointKey: `reports_v2_publish:${bundleId}`,
        idempotencyKey: idempotency.idempotencyKey,
        statusCode: 400,
        payload: blockedResponse
      });
      return res.status(400).json(blockedResponse);
    }

    const channel = String(req.body?.channel || 'slack').toLowerCase();
    const mentionTokensRaw = Array.isArray(req.body?.mentionTokens)
      ? req.body.mentionTokens
      : typeof req.body?.mentionTokens === 'string'
        ? req.body.mentionTokens.split(/\s+/g)
        : typeof req.body?.mentions === 'string'
          ? req.body.mentions.split(/\s+/g)
          : [];
    const mentionTokens = mentionTokensRaw
      .map((token: any) => String(token || '').trim())
      .filter((token: string) => token.startsWith('@'));

    let slackDelivery: SlackDeliveryResult = {
      posted: false,
      attempts: 0,
      destination: channel,
      error: 'Slack delivery not requested.'
    };

    if (channel === 'slack') {
      const slackConnection = await getSlackConnection(workspaceId, req.user!.id);
      if (!slackConnection) {
        const missingSlackResponse = { error: 'Slack integration is not connected.' };
        await completeIdempotentOperation({
          workspaceId,
          roomId,
          endpointKey: `reports_v2_publish:${bundleId}`,
          idempotencyKey: idempotency.idempotencyKey,
          statusCode: 400,
          payload: missingSlackResponse
        });
        return res.status(400).json(missingSlackResponse);
      }

      const credentials = normalizeSlackCredentials(slackConnection.credentials);
      if (!credentials.webhookUrl && !credentials.botToken) {
        const invalidSlackResponse = {
          error: 'Slack integration is connected but missing webhookUrl/botToken credentials.'
        };
        await completeIdempotentOperation({
          workspaceId,
          roomId,
          endpointKey: `reports_v2_publish:${bundleId}`,
          idempotencyKey: idempotency.idempotencyKey,
          statusCode: 400,
          payload: invalidSlackResponse
        });
        return res.status(400).json(invalidSlackResponse);
      }

      const slackPayload = buildReportV2SlackPayload({
        roomName: room.name,
        bundle,
        mentionTokens
      });

      slackDelivery = await postSlackWithRetry({
        webhookUrl: credentials.webhookUrl,
        botToken: credentials.botToken,
        channel: credentials.channel || '#general',
        payload: slackPayload
      });

      if (!slackDelivery.posted) {
        const slackFailureResponse = {
          error: `Slack delivery failed: ${slackDelivery.error || 'unknown error'}`,
          quality: mergedQuality
        };
        await completeIdempotentOperation({
          workspaceId,
          roomId,
          endpointKey: `reports_v2_publish:${bundleId}`,
          idempotencyKey: idempotency.idempotencyKey,
          statusCode: 502,
          payload: slackFailureResponse
        });
        return res.status(502).json(slackFailureResponse);
      }
    }

    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_report_v2_published',
      metadata: {
        bundleId,
        channel,
        slackPosted: slackDelivery.posted,
        slackAttempts: slackDelivery.attempts,
        evidenceCoverageRatio: mergedQuality.evidenceCoverageRatio
      }
    });

    emitToDecisionRoom(workspaceId, roomId, 'decision-room:report-published', {
      roomId,
      bundleId,
      channel,
      quality: mergedQuality,
      slackDelivery
    });

    const successResponse = {
      bundleId,
      channel,
      quality: mergedQuality,
      slackDelivery,
      publishedAt: new Date().toISOString(),
      message: 'Report V2 published successfully.'
    };
    await completeIdempotentOperation({
      workspaceId,
      roomId,
      endpointKey: `reports_v2_publish:${bundleId}`,
      idempotencyKey: idempotency.idempotencyKey,
      statusCode: 200,
      payload: successResponse
    });

    return res.json(successResponse);
  } catch (err) {
    console.error('Publish Report V2 failed:', err);
    return res.status(500).json({ error: 'Failed to publish Report V2 bundle' });
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

    const idempotencyKey = resolveIdempotencyKey(req);
    const idempotency = await beginIdempotentOperation({
      workspaceId,
      roomId,
      endpointKey: `actions_sync:${roomId}`,
      userId: req.user!.id,
      idempotencyKey
    });
    if (idempotency.replay) {
      return res.status(idempotency.replay.statusCode).json({
        ...idempotency.replay.payload,
        replayed: true,
        idempotencyKey: idempotency.idempotencyKey
      });
    }
    if (idempotency.inProgress) {
      return res.status(409).json({
        error: 'A request with the same idempotency key is already in progress.',
        idempotencyKey: idempotency.idempotencyKey
      });
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
      const noActionsResponse = { error: 'No action items found to sync.' };
      await completeIdempotentOperation({
        workspaceId,
        roomId,
        endpointKey: `actions_sync:${roomId}`,
        idempotencyKey: idempotency.idempotencyKey,
        statusCode: 400,
        payload: noActionsResponse
      });
      return res.status(400).json(noActionsResponse);
    }

    const actionItemIds = actionItems.map((artifact) => Number(artifact.id));
    const { evidenceByAction, evidenceArtifactIds } = await getActionEvidenceMap(workspaceId, roomId, actionItemIds);
    const missingEvidenceActionIds = actionItemIds.filter((id) => (evidenceByAction.get(id) || 0) === 0);
    if (missingEvidenceActionIds.length > 0) {
      const missingEvidenceResponse = {
        error: 'Cannot sync actions. Every action item must include at least one linked evidence artifact.',
        missingEvidenceActionIds
      };
      await completeIdempotentOperation({
        workspaceId,
        roomId,
        endpointKey: `actions_sync:${roomId}`,
        idempotencyKey: idempotency.idempotencyKey,
        statusCode: 400,
        payload: missingEvidenceResponse
      });
      return res.status(400).json(missingEvidenceResponse);
    }

    const roomArtifacts = await listRoomArtifacts(workspaceId, roomId, 500);
    const guide = await buildRoomGuide(workspaceId, room, roomArtifacts);
    const requiredForSync = new Set(['connect_data', 'analyze_data', 'build_brief', 'assign_actions']);
    const missingGuideSteps = guide.steps
      .filter((step) => requiredForSync.has(step.id) && !step.completed)
      .map((step) => ({ stepId: step.id, blockingIssues: step.blockingIssues }));

    if (missingGuideSteps.length > 0) {
      const missingGuideResponse = {
        error: 'Cannot sync actions until required guide steps are complete.',
        missingGuideSteps
      };
      await completeIdempotentOperation({
        workspaceId,
        roomId,
        endpointKey: `actions_sync:${roomId}`,
        idempotencyKey: idempotency.idempotencyKey,
        statusCode: 400,
        payload: missingGuideResponse
      });
      return res.status(400).json(missingGuideResponse);
    }

    const normalizedChannel = String(channel).toLowerCase();
    let slackConnection: SlackConnection | null = null;
    let slackDestination = '#general';
    let slackWebhookUrl = '';
    let slackBotToken = '';

    if (normalizedChannel === 'slack') {
      slackConnection = await getSlackConnection(workspaceId, req.user!.id);
      if (!slackConnection) {
        const missingSlackResponse = {
          error: 'Slack integration is not connected. Connect Slack before syncing actions.'
        };
        await completeIdempotentOperation({
          workspaceId,
          roomId,
          endpointKey: `actions_sync:${roomId}`,
          idempotencyKey: idempotency.idempotencyKey,
          statusCode: 400,
          payload: missingSlackResponse
        });
        return res.status(400).json(missingSlackResponse);
      }

      const credentials = normalizeSlackCredentials(slackConnection.credentials);
      slackDestination = credentials.channel || '#general';
      slackWebhookUrl = credentials.webhookUrl;
      slackBotToken = credentials.botToken;

      if (!slackWebhookUrl && !slackBotToken) {
        const invalidSlackResponse = {
          error: 'Slack integration is connected but missing webhookUrl/botToken credentials.'
        };
        await completeIdempotentOperation({
          workspaceId,
          roomId,
          endpointKey: `actions_sync:${roomId}`,
          idempotencyKey: idempotency.idempotencyKey,
          statusCode: 400,
          payload: invalidSlackResponse
        });
        return res.status(400).json(invalidSlackResponse);
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

        const slackFailureResponse = {
          error: `Slack delivery failed: ${slackDelivery.error || 'unknown error'}`,
          createdTasks: createdTaskIds.length,
          skippedTasks: skippedTaskIds.length,
          createdTaskIds,
          skippedTaskIds
        };
        await completeIdempotentOperation({
          workspaceId,
          roomId,
          endpointKey: `actions_sync:${roomId}`,
          idempotencyKey: idempotency.idempotencyKey,
          statusCode: 502,
          payload: slackFailureResponse
        });
        return res.status(502).json(slackFailureResponse);
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

    const successResponse = {
      syncedCount: actionItems.length,
      createdTasks: createdTaskIds.length,
      createdTaskIds,
      skippedTasks: skippedTaskIds.length,
      skippedTaskIds,
      evidenceArtifactIds,
      slackDelivery,
      channel,
      message: `Synced ${actionItems.length} action item(s) for ${String(channel).toUpperCase()} handoff.`
    };
    await completeIdempotentOperation({
      workspaceId,
      roomId,
      endpointKey: `actions_sync:${roomId}`,
      idempotencyKey: idempotency.idempotencyKey,
      statusCode: 200,
      payload: successResponse
    });

    return res.json(successResponse);
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
  const workspaceId = Number(req.params.workspaceId);
  const automationId = Number(req.params.automationId);
  const endpointKey = `automation_execute:${automationId}`;
  const idempotencyKey = resolveIdempotencyKey(req);
  const idempotency = await beginIdempotentOperation({
    workspaceId,
    roomId: null,
    endpointKey,
    userId: req.user?.id || '0',
    idempotencyKey
  });
  if (idempotency.replay) {
    return res.status(idempotency.replay.statusCode).json({
      ...idempotency.replay.payload,
      replayed: true,
      idempotencyKey: idempotency.idempotencyKey
    });
  }
  if (idempotency.inProgress) {
    return res.status(409).json({
      error: 'A request with the same idempotency key is already in progress.',
      idempotencyKey: idempotency.idempotencyKey
    });
  }

  try {
    if (!canWrite(req.workspaceRole)) {
      const payload = { error: 'Write access required', idempotencyKey: idempotency.idempotencyKey };
      await completeIdempotentOperation({
        workspaceId,
        roomId: null,
        endpointKey,
        idempotencyKey: idempotency.idempotencyKey,
        statusCode: 403,
        payload
      });
      return res.status(403).json(payload);
    }

    const actorUserId = Number(req.user?.id || 0);
    const execution = await executeAutomationPolicy({
      workspaceId,
      automationId,
      actorUserId,
      inputPayload: req.body?.input || {},
      reason: req.body?.reason || null,
      source: 'manual'
    });

    const payload = {
      run: execution.run,
      approvalRequest: execution.approvalRequest,
      idempotencyKey: idempotency.idempotencyKey
    };
    await completeIdempotentOperation({
      workspaceId,
      roomId: null,
      endpointKey,
      idempotencyKey: idempotency.idempotencyKey,
      statusCode: 201,
      payload
    });
    return res.status(201).json(payload);
  } catch (err: any) {
    if (err instanceof AutomationExecutionError) {
      const payload = { error: err.message, idempotencyKey: idempotency.idempotencyKey };
      await completeIdempotentOperation({
        workspaceId,
        roomId: null,
        endpointKey,
        idempotencyKey: idempotency.idempotencyKey,
        statusCode: err.statusCode,
        payload
      });
      return res.status(err.statusCode).json(payload);
    }
    console.error('Execute automation failed:', err);
    const payload = { error: 'Failed to execute automation policy', idempotencyKey: idempotency.idempotencyKey };
    await completeIdempotentOperation({
      workspaceId,
      roomId: null,
      endpointKey,
      idempotencyKey: idempotency.idempotencyKey,
      statusCode: 500,
      payload
    });
    return res.status(500).json(payload);
  }
});

router.post('/:workspaceId/rooms/:roomId/automations/schedule', async (req: WorkspaceRequest, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);
  const roomId = Number(req.params.roomId);
  let endpointKey = 'automation_schedule_create';
  let idempotency: IdempotencyStartResult = { idempotencyKey: null };

  try {
    if (!canWrite(req.workspaceRole)) {
      return res.status(403).json({ error: 'Write access required' });
    }

    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const automationPolicyId = Number(req.body?.policyId || req.body?.automationPolicyId);
    if (!Number.isFinite(automationPolicyId)) {
      return res.status(400).json({ error: 'policyId is required' });
    }

    const policyResult = await query(
      `
      SELECT id, room_id, name
      FROM automation_policies
      WHERE id = $1
        AND workspace_id = $2
        AND is_active = true
      LIMIT 1
      `,
      [automationPolicyId, workspaceId]
    );
    if (policyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Automation policy not found' });
    }

    const cron = String(req.body?.cron || '').trim();
    if (!cron || !isLikelyCronExpression(cron)) {
      return res.status(400).json({ error: 'Valid cron expression is required' });
    }

    const timezone = String(req.body?.timezone || 'UTC').trim() || 'UTC';
    const dedupeKeyInput = String(req.body?.dedupeKey || '').trim();
    const dedupeKey = dedupeKeyInput || buildDeterministicScheduleDedupeKey({
      roomId,
      automationPolicyId,
      cron,
      timezone
    });
    const retryPolicy = parseRetryPolicy(req.body?.retryPolicy);
    const isActive = req.body?.isActive !== false;
    endpointKey = `automation_schedule_create:${automationPolicyId}`;
    idempotency = await beginIdempotentOperation({
      workspaceId,
      roomId,
      endpointKey,
      userId: req.user?.id || '0',
      idempotencyKey: resolveIdempotencyKey(req)
    });
    if (idempotency.replay) {
      return res.status(idempotency.replay.statusCode).json({
        ...idempotency.replay.payload,
        replayed: true,
        idempotencyKey: idempotency.idempotencyKey
      });
    }
    if (idempotency.inProgress) {
      return res.status(409).json({
        error: 'A request with the same idempotency key is already in progress.',
        idempotencyKey: idempotency.idempotencyKey
      });
    }

    const existingScheduleResult = await query(
      `
      SELECT *
      FROM automation_schedules
      WHERE workspace_id = $1
        AND dedupe_key = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [workspaceId, dedupeKey]
    );
    if (existingScheduleResult.rows.length > 0) {
      const existingSchedule = existingScheduleResult.rows[0];
      const sameIntent = Number(existingSchedule.room_id || 0) === roomId
        && Number(existingSchedule.automation_policy_id || 0) === automationPolicyId
        && String(existingSchedule.cron || '') === cron
        && String(existingSchedule.timezone || 'UTC') === timezone;
      if (!sameIntent) {
        const payload = {
          error: 'dedupeKey is already used by a different schedule. Use a different dedupeKey.'
        };
        await completeIdempotentOperation({
          workspaceId,
          roomId,
          endpointKey,
          idempotencyKey: idempotency.idempotencyKey,
          statusCode: 409,
          payload
        });
        return res.status(409).json(payload);
      }
      const payload = {
        roomId,
        schedule: toAutomationScheduleRecord(existingSchedule),
        deduped: true,
        idempotencyKey: idempotency.idempotencyKey
      };
      await completeIdempotentOperation({
        workspaceId,
        roomId,
        endpointKey,
        idempotencyKey: idempotency.idempotencyKey,
        statusCode: 200,
        payload
      });
      return res.status(200).json(payload);
    }

    const nextRunAt = computeNextRunAtFromCronExpression(cron, timezone);
    const insert = await query(
      `
      INSERT INTO automation_schedules (
        workspace_id,
        room_id,
        automation_policy_id,
        cron,
        timezone,
        dedupe_key,
        retry_policy,
        is_active,
        next_run_at,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        workspaceId,
        roomId,
        automationPolicyId,
        cron,
        timezone,
        dedupeKey,
        JSON.stringify(retryPolicy),
        isActive,
        nextRunAt,
        req.user!.id
      ]
    );

    const schedule = toAutomationScheduleRecord(insert.rows[0]);
    await recordAnalyticsEvent({
      workspaceId,
      roomId,
      userId: req.user!.id,
      eventType: 'decision_room_automation_schedule_created',
      metadata: {
        scheduleId: schedule.id,
        policyId: automationPolicyId,
        cron,
        timezone,
        dedupeKey
      }
    });

    await requestAutomationDispatch('schedule_created');
    const payload = {
      roomId,
      schedule,
      idempotencyKey: idempotency.idempotencyKey
    };
    await completeIdempotentOperation({
      workspaceId,
      roomId,
      endpointKey,
      idempotencyKey: idempotency.idempotencyKey,
      statusCode: 201,
      payload
    });
    return res.status(201).json(payload);
  } catch (err: any) {
    console.error('Create automation schedule failed:', err);
    const message = String(err?.message || '');
    if (message.toLowerCase().includes('duplicate key')) {
      const payload = {
        error: 'dedupeKey already exists in this workspace. Use a different dedupeKey.',
        idempotencyKey: idempotency.idempotencyKey
      };
      await completeIdempotentOperation({
        workspaceId,
        roomId,
        endpointKey,
        idempotencyKey: idempotency.idempotencyKey,
        statusCode: 409,
        payload
      });
      return res.status(409).json(payload);
    }
    const payload = { error: 'Failed to create automation schedule', idempotencyKey: idempotency.idempotencyKey };
    await completeIdempotentOperation({
      workspaceId,
      roomId,
      endpointKey,
      idempotencyKey: idempotency.idempotencyKey,
      statusCode: 500,
      payload
    });
    return res.status(500).json(payload);
  }
});

router.get('/:workspaceId/rooms/:roomId/automations/runs', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const [runsResult, eventsResult, schedulesResult] = await Promise.all([
      query(
        `
        SELECT r.*
        FROM automation_runs r
        WHERE r.workspace_id = $1
          AND (r.room_id = $2 OR r.room_id IS NULL)
        ORDER BY COALESCE(r.started_at, r.created_at) DESC
        LIMIT 200
        `,
        [workspaceId, roomId]
      ),
      query(
        `
        SELECT e.*
        FROM automation_run_events e
        WHERE e.workspace_id = $1
          AND (e.room_id = $2 OR e.room_id IS NULL)
        ORDER BY e.created_at DESC
        LIMIT 500
        `,
        [workspaceId, roomId]
      ),
      query(
        `
        SELECT *
        FROM automation_schedules
        WHERE workspace_id = $1
          AND (room_id = $2 OR room_id IS NULL)
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 100
        `,
        [workspaceId, roomId]
      )
    ]);

    const eventsByRun = new Map<number, any[]>();
    eventsResult.rows.forEach((event) => {
      const runId = Number(event.automation_run_id);
      const list = eventsByRun.get(runId) || [];
      list.push(event);
      eventsByRun.set(runId, list);
    });

    const runs: AutomationRunDetail[] = runsResult.rows.map((run) => {
      const runId = Number(run.id);
      const events = eventsByRun.get(runId) || [];
      const attempts = events.length > 0
        ? Math.max(...events.map((event) => Number(event.attempt || 1)))
        : 1;
      const output = parseJsonMaybe<Record<string, any>>(run.output, {});
      const artifacts = Array.isArray(output?.artifactIds)
        ? output.artifactIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
        : [];

      return {
        runId,
        status: String(run.status || 'unknown'),
        startedAt: run.started_at || null,
        completedAt: run.completed_at || null,
        attempts,
        error: run.error || null,
        artifacts
      };
    });

    const schedules = schedulesResult.rows.map(toAutomationScheduleRecord);
    return res.json({
      roomId,
      runs,
      schedules,
      events: eventsResult.rows.map((event) => ({
        id: Number(event.id),
        runId: Number(event.automation_run_id),
        eventType: String(event.event_type || 'unknown'),
        status: String(event.status || 'info'),
        attempt: Number(event.attempt || 1),
        error: event.error || null,
        metadata: parseJsonMaybe(event.metadata, {}),
        createdAt: event.created_at
      }))
    });
  } catch (err) {
    console.error('List automation runs failed:', err);
    return res.status(500).json({ error: 'Failed to load automation runs' });
  }
});

router.get('/:workspaceId/rooms/:roomId/automations/queue-state', async (req: WorkspaceRequest, res: Response) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const roomId = Number(req.params.roomId);
    const room = await getRoom(workspaceId, roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const [scheduleStats, runStats] = await Promise.all([
      query(
        `
        SELECT
          COUNT(*) FILTER (WHERE is_active = true)::int AS active_schedules,
          COUNT(*) FILTER (WHERE is_active = true AND next_run_at IS NOT NULL AND next_run_at <= NOW())::int AS due_schedules
        FROM automation_schedules
        WHERE workspace_id = $1
          AND (room_id = $2 OR room_id IS NULL)
        `,
        [workspaceId, roomId]
      ),
      query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'running')::int AS running_runs,
          COUNT(*) FILTER (WHERE status = 'awaiting_approval')::int AS awaiting_approval_runs
        FROM automation_runs
        WHERE workspace_id = $1
          AND (room_id = $2 OR room_id IS NULL)
        `,
        [workspaceId, roomId]
      )
    ]);

    const scheduleRow = scheduleStats.rows[0] || {};
    const runRow = runStats.rows[0] || {};
    return res.json({
      roomId,
      queue: getAutomationQueueState(),
      metrics: {
        activeSchedules: Number(scheduleRow.active_schedules || 0),
        dueSchedules: Number(scheduleRow.due_schedules || 0),
        runningRuns: Number(runRow.running_runs || 0),
        awaitingApprovalRuns: Number(runRow.awaiting_approval_runs || 0)
      }
    });
  } catch (err) {
    console.error('Load automation queue state failed:', err);
    return res.status(500).json({ error: 'Failed to load automation queue state' });
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

      try {
        await query(
          `
          INSERT INTO automation_run_events (
            workspace_id,
            room_id,
            automation_run_id,
            event_type,
            status,
            attempt,
            error,
            metadata,
            created_at
          )
          VALUES ($1,$2,$3,'approval_response',$4,1,$5,$6,NOW())
          `,
          [
            workspaceId,
            approval.room_id || null,
            approval.automation_run_id,
            runStatus,
            decision === 'rejected' ? 'Rejected by approver' : null,
            JSON.stringify({ decision, note: req.body?.note || null, responderId: req.user!.id })
          ]
        );
      } catch (err) {
        console.warn('Automation approval event insert skipped:', err);
      }
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
