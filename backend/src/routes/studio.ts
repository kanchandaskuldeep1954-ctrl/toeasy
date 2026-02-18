import { NextFunction, Response, Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import { SafeExecutor } from '../utils/safeExecutor.js';
import { GroqService } from '../services/groq.service.js';

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

    return res.status(201).json({ data: result.rows[0] });
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

    const createdTaskIds: string[] = [];
    if (createTasks) {
      for (const action of actionItems) {
        try {
          const taskPayload = action.payload || {};
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
              JSON.stringify(taskPayload.tags || ['room-sync'])
            ]
          );
          createdTaskIds.push(taskInsert.rows[0].id);
        } catch (taskErr) {
          console.warn('Task sync failed for action item, skipping:', taskErr);
        }
      }
    }

    return res.json({
      syncedCount: actionItems.length,
      createdTasks: createdTaskIds.length,
      createdTaskIds,
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
