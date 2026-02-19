import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import studioRouter from './studio.js';
import { generateToken } from '../middleware/auth.js';
import { resetQueryOverrideForTests, setQueryOverrideForTests } from '../db.js';

type MockRow = Record<string, any>;
type StudioQueryMockOptions = {
  includeRecoveredAutomationRun?: boolean;
};

function normalizeSql(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function createStudioQueryMock(options: StudioQueryMockOptions = {}) {
  const includeRecoveredAutomationRun = Boolean(options.includeRecoveredAutomationRun);
  const calls: Array<{ sql: string; params: any[] }> = [];
  let nextArtifactId = 400;
  let nextVisualSpecId = 600;
  let nextQueryVersionId = 700;
  let nextReviewSubmissionId = 800;
  let nextScheduleId = 900;
  let nextIdempotencyId = 1000;
  let nextNotificationId = 2000;
  let nextMetricTestId = 3000;

  const state = {
    analysisRoom: {
      id: 101,
      workspace_id: 1,
      project_id: 11,
      name: 'RevOps Weekly',
      stage: 'analyze',
      run_context: JSON.stringify({ datasetId: 99 }),
      is_archived: false
    },
    artifacts: [
      {
        id: 101,
        workspace_id: 1,
        project_id: 11,
        room_id: 101,
        artifact_type: 'query_run',
        title: 'Weekly Query',
        description: null,
        payload: JSON.stringify({
          previewRows: [
            { owner: 'alice', amount: 120, stage: 'won', day: '2026-02-18' },
            { owner: 'bob', amount: 80, stage: 'lost', day: '2026-02-17' },
            { owner: 'alice', amount: 40, stage: 'won', day: '2026-02-16' }
          ]
        }),
        metadata: JSON.stringify({ source: 'test' }),
        dataset_version_id: null,
        source_dataset_id: 99,
        created_by: '1',
        created_at: nowIso(),
        updated_at: nowIso()
      },
      {
        id: 102,
        workspace_id: 1,
        project_id: 11,
        room_id: 101,
        artifact_type: 'action_item',
        title: 'Follow up enterprise deal',
        description: null,
        payload: JSON.stringify({
          status: 'open',
          metricKey: 'pipeline_created_amount'
        }),
        metadata: JSON.stringify({}),
        dataset_version_id: null,
        source_dataset_id: 99,
        created_by: '1',
        created_at: nowIso(),
        updated_at: nowIso()
      },
      {
        id: 103,
        workspace_id: 1,
        project_id: 11,
        room_id: 101,
        artifact_type: 'decision_brief',
        title: 'Weekly Decision Brief',
        description: null,
        payload: JSON.stringify({
          reportVersion: 'v2',
          bundleId: 'bundle_sync_seed'
        }),
        metadata: JSON.stringify({}),
        dataset_version_id: null,
        source_dataset_id: 99,
        created_by: '1',
        created_at: nowIso(),
        updated_at: nowIso()
      },
      {
        id: 104,
        workspace_id: 1,
        project_id: 11,
        room_id: 101,
        artifact_type: 'report_block',
        title: 'KPI Delta',
        description: null,
        payload: JSON.stringify({
          reportVersion: 'v2',
          bundleId: 'bundle_publish_seed',
          sectionId: 'kpi_delta_1',
          sectionType: 'kpi_delta',
          order: 1,
          title: 'KPI Delta',
          contentMarkdown: 'Pipeline moved week-over-week.',
          claims: [
            {
              id: 'claim_1',
              statement: 'Pipeline created amount increased by 20%.',
              metricKey: 'pipeline_created_amount',
              valueCurrent: 120,
              valuePrevious: 100,
              deltaPct: 20,
              confidence: 'high',
              evidenceArtifactIds: [],
              supported: false
            }
          ],
          chartArtifactIds: [],
          kpiSnapshot: [
            {
              metricKey: 'pipeline_created_amount',
              label: 'Pipeline Created Amount',
              valueCurrent: 120,
              valuePrevious: 100,
              deltaPct: 20,
              evidenceArtifactIds: []
            }
          ],
          generatedAt: '2026-02-19T12:00:00.000Z'
        }),
        metadata: JSON.stringify({}),
        dataset_version_id: null,
        source_dataset_id: 99,
        created_by: '1',
        created_at: nowIso(),
        updated_at: nowIso()
      },
      {
        id: 105,
        workspace_id: 1,
        project_id: 11,
        room_id: 101,
        artifact_type: 'decision_brief',
        title: 'Publish Seed Brief',
        description: null,
        payload: JSON.stringify({
          reportVersion: 'v2',
          bundleId: 'bundle_publish_seed'
        }),
        metadata: JSON.stringify({}),
        dataset_version_id: null,
        source_dataset_id: 99,
        created_by: '1',
        created_at: nowIso(),
        updated_at: nowIso()
      }
    ] as MockRow[],
    lineageEdges: [
      {
        id: 201,
        workspace_id: 1,
        room_id: 101,
        parent_artifact_id: 101,
        child_artifact_id: 102,
        relation_type: 'derived_from',
        created_by: '1'
      }
    ] as MockRow[],
    visualSpecs: [] as MockRow[],
    queryVersions: [] as MockRow[],
    reviewSubmissions: [] as MockRow[],
    roomOutcomeAttributions: [] as MockRow[],
    automationSchedules: [] as MockRow[],
    idempotencyKeys: [] as MockRow[],
    datasetProfiles: [] as MockRow[]
  };

  const query = async (text: string, params: any[] = []) => {
    const sql = normalizeSql(text);
    calls.push({ sql, params });

    if (sql.includes('from subscriptions')) {
      return {
        rows: [
          {
            tier: 'pro',
            status: 'active',
            renewal_date: '2099-01-01T00:00:00.000Z'
          }
        ]
      };
    }

    if (sql.includes('from workspaces w') && sql.includes('left join workspace_members')) {
      return {
        rows: [
          {
            id: 1,
            owner_id: 1,
            role: 'admin'
          }
        ]
      };
    }

    if (sql.includes('from analysis_rooms where id = $1 and workspace_id = $2')) {
      const [roomId, workspaceId] = params.map(Number);
      if (roomId === state.analysisRoom.id && workspaceId === state.analysisRoom.workspace_id) {
        return { rows: [state.analysisRoom] };
      }
      return { rows: [] };
    }

    if (
      sql.includes('from artifacts') &&
      sql.includes('where workspace_id = $1 and room_id = $2') &&
      sql.includes('order by created_at desc') &&
      !sql.includes('artifact_type = \'action_item\'')
    ) {
      const workspaceId = Number(params[0]);
      const roomId = Number(params[1]);
      const limit = Number(params[2] || 500);
      const rows = state.artifacts
        .filter((row) => Number(row.workspace_id) === workspaceId && Number(row.room_id) === roomId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
      return { rows };
    }

    if (sql.includes('from artifacts') && sql.includes('artifact_type = \'report_block\'') && sql.includes('payload->>\'bundleid\' = $3')) {
      const [workspaceId, roomId, bundleId] = params;
      const rows = state.artifacts
        .filter(
          (row) =>
            Number(row.workspace_id) === Number(workspaceId) &&
            Number(row.room_id) === Number(roomId) &&
            String(row.artifact_type) === 'report_block' &&
            String(JSON.parse(String(row.payload || '{}')).bundleId || '') === String(bundleId)
        )
        .map((row) => ({
          id: row.id,
          title: row.title,
          payload: row.payload,
          metadata: row.metadata,
          created_at: row.created_at
        }));
      return { rows };
    }

    if (sql.includes('from artifacts') && sql.includes('artifact_type = \'decision_brief\'') && sql.includes('payload->>\'bundleid\' = $3')) {
      const [workspaceId, roomId, bundleId] = params;
      const row = state.artifacts.find(
        (item) =>
          Number(item.workspace_id) === Number(workspaceId) &&
          Number(item.room_id) === Number(roomId) &&
          String(item.artifact_type) === 'decision_brief' &&
          String(JSON.parse(String(item.payload || '{}')).bundleId || '') === String(bundleId)
      );
      return { rows: row ? [{ id: row.id }] : [] };
    }

    if (sql.includes('from artifacts') && sql.includes('artifact_type = \'action_item\'')) {
      const workspaceId = Number(params[0]);
      const roomId = Number(params[1]);
      const rows = state.artifacts
        .filter(
          (row) =>
            Number(row.workspace_id) === workspaceId &&
            Number(row.room_id) === roomId &&
            String(row.artifact_type) === 'action_item'
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { rows };
    }

    if (
      sql.includes('from artifacts') &&
      sql.includes('where workspace_id = $1') &&
      sql.includes('room_id = $2') &&
      sql.includes('id = any($3::int[])')
    ) {
      const [workspaceId, roomId, artifactIds] = params;
      const scopedIds = new Set((Array.isArray(artifactIds) ? artifactIds : []).map((id: any) => Number(id)));
      const rows = state.artifacts
        .filter(
          (row) =>
            Number(row.workspace_id) === Number(workspaceId) &&
            Number(row.room_id) === Number(roomId) &&
            scopedIds.has(Number(row.id))
        )
        .map((row) => ({ id: Number(row.id) }));
      return { rows };
    }

    if (
      sql.includes('select payload->>\'bundleid\' as bundle_id') &&
      sql.includes('from artifacts') &&
      sql.includes('artifact_type = \'report_block\'')
    ) {
      const [workspaceId, roomId] = params;
      const row = state.artifacts
        .filter(
          (artifact) =>
            Number(artifact.workspace_id) === Number(workspaceId) &&
            Number(artifact.room_id) === Number(roomId) &&
            String(artifact.artifact_type) === 'report_block' &&
            String(JSON.parse(String(artifact.payload || '{}')).reportVersion || '') === 'v2'
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return {
        rows: row
          ? [{ bundle_id: String(JSON.parse(String(row.payload || '{}')).bundleId || '') }]
          : []
      };
    }

    if (sql.includes('from metric_definitions') && sql.includes('where workspace_id = $1')) {
      return {
        rows: [
          {
            id: 301,
            metric_key: 'pipeline_created_amount',
            name: 'Pipeline Created Amount',
            formula: 'SUM(amount)',
            owner_id: 2,
            owner_name: 'Manager User',
            latest_status: 'passed',
            last_validated_at: '2026-02-19T08:00:00.000Z'
          }
        ]
      };
    }

    if (sql.includes('select id, raw_data, headers from datasets where id = $1 and workspace_id = $2 limit 1')) {
      const [datasetId, workspaceId] = params.map(Number);
      if (datasetId === 99 && workspaceId === 1) {
        return {
          rows: [
            {
              id: 99,
              raw_data: JSON.stringify([
                { owner: 'alice', amount: 120, stage: 'won', created_at: '2026-02-18' },
                { owner: 'bob', amount: 80, stage: 'lost', created_at: '2026-02-17' },
                { owner: 'alice', amount: '', stage: 'won', created_at: '2026-02-16' }
              ]),
              headers: JSON.stringify(['owner', 'amount', 'stage', 'created_at'])
            }
          ]
        };
      }
      return { rows: [] };
    }

    if (sql.includes('insert into metric_definition_tests')) {
      const row = {
        id: nextMetricTestId++,
        workspace_id: params[0],
        metric_definition_id: params[1],
        test_name: params[2],
        test_definition: params[3],
        status: params[4],
        last_result: params[5],
        created_by: params[6],
        last_run_at: nowIso()
      };
      return { rows: [row] };
    }

    if (sql.includes('insert into artifacts')) {
      const row = {
        id: nextArtifactId++,
        workspace_id: Number(params[0]),
        project_id: params[1] == null ? null : Number(params[1]),
        room_id: Number(params[2]),
        artifact_type: String(params[3]),
        title: String(params[4]),
        description: params[5] ?? null,
        payload: params[6],
        metadata: params[7],
        dataset_version_id: params[8] ?? null,
        source_dataset_id: params[9] ?? null,
        created_by: String(params[10]),
        created_at: nowIso(),
        updated_at: nowIso()
      };
      state.artifacts.push(row);
      return { rows: [row] };
    }

    if (sql.includes('insert into lineage_edges')) {
      const row = {
        id: state.lineageEdges.length + 1000,
        workspace_id: Number(params[0]),
        room_id: Number(params[1]),
        parent_artifact_id: Number(params[2]),
        child_artifact_id: Number(params[3]),
        relation_type: String(params[4]),
        created_by: String(params[5])
      };
      const exists = state.lineageEdges.some(
        (edge) =>
          Number(edge.parent_artifact_id) === row.parent_artifact_id &&
          Number(edge.child_artifact_id) === row.child_artifact_id &&
          String(edge.relation_type) === row.relation_type
      );
      if (!exists) state.lineageEdges.push(row);
      return { rows: exists ? [] : [row] };
    }

    if (sql.includes('insert into visual_specs')) {
      const row = {
        id: nextVisualSpecId++,
        workspace_id: Number(params[0]),
        room_id: Number(params[1]),
        artifact_id: Number(params[2]),
        name: String(params[3]),
        spec: params[4],
        annotations: params[5],
        created_by: String(params[6]),
        created_at: nowIso(),
        updated_at: nowIso()
      };
      state.visualSpecs.push(row);
      return { rows: [row] };
    }

    if (sql.includes('from visual_specs') && sql.includes('where id = $1 and workspace_id = $2 and room_id = $3')) {
      const [visualId, workspaceId, roomId] = params.map(Number);
      const row = state.visualSpecs.find(
        (item) =>
          Number(item.id) === visualId &&
          Number(item.workspace_id) === workspaceId &&
          Number(item.room_id) === roomId
      );
      return { rows: row ? [row] : [] };
    }

    if (sql.includes('from room_outcome_attributions')) {
      const [workspaceId, roomId] = params.map(Number);
      const rows = state.roomOutcomeAttributions.filter(
        (item) => Number(item.workspace_id) === workspaceId && Number(item.room_id) === roomId
      );
      return { rows };
    }

    if (sql.includes('insert into dataset_profiles')) {
      const row = {
        id: state.datasetProfiles.length + 1,
        workspace_id: Number(params[0]),
        room_id: Number(params[1]),
        dataset_id: params[2] == null ? null : Number(params[2]),
        dataset_version_id: params[3] == null ? null : Number(params[3]),
        artifact_id: Number(params[4]),
        quality_score: Number(params[5]),
        missingness: params[6],
        duplicate_keys: params[7],
        date_continuity: params[8],
        invalid_numerics: params[9],
        row_count: Number(params[10]),
        column_count: Number(params[11]),
        summary: params[12],
        created_by: String(params[13]),
        created_at: nowIso(),
        updated_at: nowIso()
      };
      state.datasetProfiles.push(row);
      return { rows: [row] };
    }

    if (sql.includes('from dataset_profiles') && sql.includes('where workspace_id = $1') && sql.includes('room_id = $2')) {
      const [workspaceId, roomId] = params.map(Number);
      const rows = state.datasetProfiles
        .filter((item) => Number(item.workspace_id) === workspaceId && Number(item.room_id) === roomId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 1);
      return { rows };
    }

    if (sql.includes('from lineage_edges le') && sql.includes('join artifacts parent')) {
      const [workspaceId, roomId, actionIds] = params;
      const actionSet = new Set((actionIds || []).map((id: any) => Number(id)));
      const rows = state.lineageEdges
        .filter(
          (edge) =>
            Number(edge.workspace_id) === Number(workspaceId) &&
            Number(edge.room_id) === Number(roomId) &&
            actionSet.has(Number(edge.child_artifact_id))
        )
        .map((edge) => ({
          child_artifact_id: edge.child_artifact_id,
          parent_artifact_id: edge.parent_artifact_id
        }));
      return { rows };
    }

    if (sql.includes('from metric_value_snapshots s') && sql.includes('join metric_definitions m')) {
      return {
        rows: [
          {
            metric_key: 'pipeline_created_amount',
            value: 120,
            observed_at: '2026-02-18T00:00:00.000Z'
          },
          {
            metric_key: 'pipeline_created_amount',
            value: 100,
            observed_at: '2026-02-11T00:00:00.000Z'
          }
        ]
      };
    }

    if (sql.includes('from queries') && sql.includes('where id = $1') && sql.includes('workspace_id = $2')) {
      return { rows: [{ id: Number(params[0]) }] };
    }

    if (sql.includes('select coalesce(max(version_number), 0)::int as max_version') && sql.includes('from query_versions')) {
      const [workspaceId, roomId, queryId] = params;
      const scoped = state.queryVersions.filter(
        (row) =>
          Number(row.workspace_id) === Number(workspaceId) &&
          Number(row.room_id) === Number(roomId) &&
          (queryId == null ? row.query_id == null : Number(row.query_id) === Number(queryId))
      );
      const maxVersion = scoped.reduce((max, row) => Math.max(max, Number(row.version_number || 0)), 0);
      return { rows: [{ max_version: maxVersion }] };
    }

    if (sql.includes('insert into query_versions')) {
      const row = {
        id: nextQueryVersionId++,
        workspace_id: Number(params[0]),
        room_id: Number(params[1]),
        query_id: params[2] == null ? null : Number(params[2]),
        version_number: Number(params[3]),
        sql_template: String(params[4]),
        parameters_schema: params[5],
        metadata: params[6],
        created_by: String(params[7]),
        created_at: nowIso(),
        updated_at: nowIso()
      };
      state.queryVersions.push(row);
      return { rows: [row] };
    }

    if (sql.includes('from query_versions') && sql.includes('where workspace_id = $1') && sql.includes('query_id = $3')) {
      const [workspaceId, roomId, queryId] = params.map(Number);
      const rows = state.queryVersions
        .filter(
          (row) =>
            Number(row.workspace_id) === workspaceId &&
            Number(row.room_id) === roomId &&
            Number(row.query_id) === queryId
        )
        .sort((a, b) => Number(b.version_number) - Number(a.version_number));
      return { rows };
    }

    if (sql.includes('from workspace_members') && sql.includes('workspace_id = $1') && sql.includes('user_id = $2')) {
      const [workspaceId, userId] = params.map(Number);
      if (workspaceId === 1 && userId === 2) {
        return { rows: [{ user_id: 2 }] };
      }
      return { rows: [] };
    }

    if (sql.includes('insert into review_submissions')) {
      const row = {
        id: nextReviewSubmissionId++,
        workspace_id: Number(params[0]),
        room_id: Number(params[1]),
        bundle_id: String(params[2]),
        stage: String(params[3]),
        status: 'pending',
        submitted_by: Number(params[4]),
        reviewer_id: params[5] == null ? null : Number(params[5]),
        note: params[6] ?? null,
        response_note: null,
        responded_by: null,
        responded_at: null,
        submitted_at: nowIso(),
        created_at: nowIso(),
        updated_at: nowIso()
      };
      state.reviewSubmissions.push(row);
      return { rows: [row] };
    }

    if (sql.includes('from review_submissions') && sql.includes('where id = $1') && sql.includes('workspace_id = $2') && sql.includes('room_id = $3')) {
      const [submissionId, workspaceId, roomId] = params.map(Number);
      const row = state.reviewSubmissions.find(
        (item) =>
          Number(item.id) === submissionId &&
          Number(item.workspace_id) === workspaceId &&
          Number(item.room_id) === roomId
      );
      return { rows: row ? [row] : [] };
    }

    if (sql.includes('update review_submissions') && sql.includes('returning *')) {
      const [status, responseNote, respondedBy, submissionId] = params;
      const row = state.reviewSubmissions.find((item) => Number(item.id) === Number(submissionId));
      if (!row) return { rows: [] };
      row.status = status;
      row.response_note = responseNote ?? null;
      row.responded_by = Number(respondedBy);
      row.responded_at = nowIso();
      row.updated_at = nowIso();
      return { rows: [row] };
    }

    if (sql.includes('select full_name, email from users where id = $1 limit 1')) {
      const userId = Number(params[0]);
      if (userId === 1) return { rows: [{ full_name: 'Analyst User', email: 'analyst@example.com' }] };
      if (userId === 2) return { rows: [{ full_name: 'Manager User', email: 'manager@example.com' }] };
      return { rows: [] };
    }

    if (sql.includes('insert into notifications') && sql.includes('returning *')) {
      const row = {
        id: nextNotificationId++,
        user_id: Number(params[0]),
        workspace_id: Number(params[1]),
        title: String(params[2]),
        message: String(params[3]),
        type: String(params[4]),
        is_read: false,
        created_at: nowIso(),
        updated_at: nowIso()
      };
      return { rows: [row] };
    }

    if (sql.includes('from automation_policies') && sql.includes('where id = $1')) {
      const [policyId, workspaceId] = params.map(Number);
      if (policyId === 501 && workspaceId === 1) {
        return {
          rows: [{ id: 501, room_id: 101, name: 'Weekly Sync', is_active: true }]
        };
      }
      return { rows: [] };
    }

    if (sql.includes('from idempotency_keys') && sql.includes('where workspace_id = $1')) {
      const [workspaceId, endpointKey, idempotencyKey, roomId] = params;
      const row = state.idempotencyKeys.find(
        (item) =>
          Number(item.workspace_id) === Number(workspaceId) &&
          String(item.endpoint_key) === String(endpointKey) &&
          String(item.idempotency_key) === String(idempotencyKey) &&
          (roomId == null ? item.room_id == null : Number(item.room_id) === Number(roomId))
      );
      return { rows: row ? [row] : [] };
    }

    if (sql.includes('insert into idempotency_keys')) {
      const [workspaceId, roomId, endpointKey, idempotencyKey, createdBy, responsePayload] = params;
      const exists = state.idempotencyKeys.some(
        (item) =>
          Number(item.workspace_id) === Number(workspaceId) &&
          String(item.endpoint_key) === String(endpointKey) &&
          String(item.idempotency_key) === String(idempotencyKey) &&
          (roomId == null ? item.room_id == null : Number(item.room_id) === Number(roomId))
      );
      if (exists) return { rows: [] };
      state.idempotencyKeys.push({
        id: nextIdempotencyId++,
        workspace_id: Number(workspaceId),
        room_id: roomId == null ? null : Number(roomId),
        endpoint_key: String(endpointKey),
        idempotency_key: String(idempotencyKey),
        created_by: String(createdBy),
        status_code: null,
        response_payload: responsePayload,
        completed_at: null,
        created_at: nowIso(),
        updated_at: nowIso()
      });
      return { rows: [] };
    }

    if (sql.includes('update idempotency_keys') && sql.includes('set status_code = $5')) {
      const [workspaceId, endpointKey, idempotencyKey, roomId, statusCode, responsePayload] = params;
      const row = state.idempotencyKeys.find(
        (item) =>
          Number(item.workspace_id) === Number(workspaceId) &&
          String(item.endpoint_key) === String(endpointKey) &&
          String(item.idempotency_key) === String(idempotencyKey) &&
          (roomId == null ? item.room_id == null : Number(item.room_id) === Number(roomId))
      );
      if (row) {
        row.status_code = Number(statusCode);
        row.response_payload = responsePayload;
        row.completed_at = nowIso();
        row.updated_at = nowIso();
      }
      return { rows: [] };
    }

    if (sql.includes('from automation_schedules') && sql.includes('dedupe_key = $2')) {
      const [workspaceId, dedupeKey] = params;
      const rows = state.automationSchedules
        .filter(
          (item) =>
            Number(item.workspace_id) === Number(workspaceId) &&
            String(item.dedupe_key) === String(dedupeKey)
        )
        .slice(0, 1);
      return { rows };
    }

    if (sql.includes('from automation_runs r') && sql.includes('where r.workspace_id = $1')) {
      const rows = [
        {
          id: 5011,
          workspace_id: 1,
          room_id: 101,
          automation_policy_id: 501,
          status: 'failed',
          error: 'transient slack timeout',
          output: JSON.stringify({ artifactIds: [102] }),
          started_at: '2026-02-19T09:00:00.000Z',
          completed_at: '2026-02-19T09:02:00.000Z',
          created_at: '2026-02-19T09:00:00.000Z'
        }
      ];
      if (includeRecoveredAutomationRun) {
        rows.unshift({
          id: 5012,
          workspace_id: 1,
          room_id: 101,
          automation_policy_id: 501,
          status: 'completed',
          error: null,
          output: JSON.stringify({ artifactIds: [102], recoveredFromRunId: 5011 }),
          started_at: '2026-02-19T09:04:00.000Z',
          completed_at: '2026-02-19T09:05:00.000Z',
          created_at: '2026-02-19T09:04:00.000Z'
        });
      }
      return {
        rows
      };
    }

    if (sql.includes('from automation_run_events e') && sql.includes('where e.workspace_id = $1')) {
      const rows = [
        {
          id: 7101,
          workspace_id: 1,
          room_id: 101,
          automation_run_id: 5011,
          event_type: 'execution_failed',
          status: 'retrying',
          attempt: 1,
          error: 'HTTP 429 too many requests',
          metadata: JSON.stringify({ queueAttempt: 1, queueMaxAttempts: 3, retryBackoffMs: 2000 }),
          created_at: '2026-02-19T09:00:30.000Z'
        },
        {
          id: 7102,
          workspace_id: 1,
          room_id: 101,
          automation_run_id: 5011,
          event_type: 'execution_retry_scheduled',
          status: 'retrying',
          attempt: 2,
          error: null,
          metadata: JSON.stringify({ queueAttempt: 2, queueMaxAttempts: 3, retryBackoffMs: 2000 }),
          created_at: '2026-02-19T09:01:00.000Z'
        }
      ];
      if (includeRecoveredAutomationRun) {
        rows.push({
          id: 7103,
          workspace_id: 1,
          room_id: 101,
          automation_run_id: 5012,
          event_type: 'execution_completed',
          status: 'completed',
          attempt: 2,
          error: null,
          metadata: JSON.stringify({ queueAttempt: 2, recoveredFromRunId: 5011 }),
          created_at: '2026-02-19T09:05:00.000Z'
        });
      }
      return {
        rows
      };
    }

    if (sql.includes('from automation_schedules') && sql.includes('order by updated_at desc')) {
      const [workspaceId, roomId] = params;
      const rows = state.automationSchedules.filter(
        (item) =>
          Number(item.workspace_id) === Number(workspaceId) &&
          (item.room_id == null || Number(item.room_id) === Number(roomId))
      );
      return { rows };
    }

    if (sql.includes('count(*) filter (where is_active = true)::int as active_schedules') && sql.includes('from automation_schedules')) {
      return {
        rows: [
          {
            active_schedules: 1,
            due_schedules: 0
          }
        ]
      };
    }

    if (sql.includes('count(*) filter (where status = \'running\')::int as running_runs') && sql.includes('from automation_runs')) {
      return {
        rows: [
          {
            running_runs: 0,
            awaiting_approval_runs: 1
          }
        ]
      };
    }

    if (sql.includes('insert into automation_schedules') && sql.includes('returning *')) {
      const row = {
        id: nextScheduleId++,
        workspace_id: Number(params[0]),
        room_id: Number(params[1]),
        automation_policy_id: Number(params[2]),
        cron: String(params[3]),
        timezone: String(params[4]),
        dedupe_key: String(params[5]),
        retry_policy: params[6],
        is_active: Boolean(params[7]),
        next_run_at: params[8],
        last_run_at: null,
        created_by: String(params[9]),
        created_at: nowIso(),
        updated_at: nowIso()
      };
      state.automationSchedules.push(row);
      return { rows: [row] };
    }

    if (sql.includes('insert into analytics_events')) {
      return { rows: [] };
    }

    return { rows: [] };
  };

  return { query, calls, state };
}

async function startStudioServer(queryImpl: (text: string, params?: any[]) => Promise<any>) {
  setQueryOverrideForTests(queryImpl);
  const app = express();
  app.use(express.json());
  app.use('/api/workspaces', studioRouter);
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve test server address');
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function stopStudioServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  resetQueryOverrideForTests();
}

async function requestJson(params: {
  baseUrl: string;
  token: string;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, any>;
  headers?: Record<string, string>;
}) {
  const response = await fetch(`${params.baseUrl}${params.path}`, {
    method: params.method,
    headers: {
      Authorization: `Bearer ${params.token}`,
      ...(params.body ? { 'Content-Type': 'application/json' } : {}),
      ...(params.headers || {})
    },
    body: params.body ? JSON.stringify(params.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

test('visual build + drill, metric validation, and outcomes attribution work in one route-level flow', async () => {
  const mock = createStudioQueryMock();
  const { server, baseUrl } = await startStudioServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');

  try {
    const metricsResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/metrics/validate',
      body: {}
    });
    assert.equal(metricsResult.response.status, 200);
    assert.equal(Array.isArray(metricsResult.payload.validations), true);
    assert.equal(metricsResult.payload.validations.length, 1);
    assert.equal(metricsResult.payload.validations[0].status, 'passed');

    const buildResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/visuals/build',
      body: {
        name: 'Owner Pipeline',
        spec: {
          chartType: 'bar',
          dimensions: ['owner'],
          measures: ['amount']
        }
      }
    });
    assert.equal(buildResult.response.status, 201);
    assert.equal(typeof buildResult.payload.visualId, 'number');
    assert.equal(Array.isArray(buildResult.payload.data), true);
    assert.ok(buildResult.payload.data.length > 0);

    const drillResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: `/api/workspaces/1/rooms/101/visuals/${buildResult.payload.visualId}/drill`,
      body: { level: 0, pathValues: {} }
    });
    assert.equal(drillResult.response.status, 200);
    assert.equal(Array.isArray(drillResult.payload.rows), true);

    const outcomesResult = await requestJson({
      baseUrl,
      token,
      method: 'GET',
      path: '/api/workspaces/1/rooms/101/outcomes/attribution'
    });
    assert.equal(outcomesResult.response.status, 200);
    assert.equal(Array.isArray(outcomesResult.payload.attributions), true);
    assert.ok(outcomesResult.payload.attributions.length > 0);
    assert.equal(outcomesResult.payload.attributions[0].metricKey, 'pipeline_created_amount');
    assert.deepEqual(outcomesResult.payload.attributions[0].evidenceArtifactIds, [101]);
  } finally {
    await stopStudioServer(server);
  }
});

test('query version and review lifecycle endpoints persist expected state', async () => {
  const mock = createStudioQueryMock();
  const { server, baseUrl } = await startStudioServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');

  try {
    const saveVersionResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/queries/save-version',
      body: {
        queryId: 55,
        sqlTemplate: 'SELECT owner, amount FROM deals',
        parametersSchema: { owner: 'string' }
      }
    });
    assert.equal(saveVersionResult.response.status, 201);
    assert.equal(saveVersionResult.payload.version.versionNumber, 1);

    const listVersionResult = await requestJson({
      baseUrl,
      token,
      method: 'GET',
      path: '/api/workspaces/1/rooms/101/queries/55/versions'
    });
    assert.equal(listVersionResult.response.status, 200);
    assert.equal(listVersionResult.payload.versions.length, 1);
    assert.equal(listVersionResult.payload.versions[0].queryId, 55);

    const submitReviewResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/review/submit',
      body: {
        bundleId: 'bundle_test_1',
        stage: 'manager_review',
        reviewerId: 2,
        note: 'Ready for manager review'
      }
    });
    assert.equal(submitReviewResult.response.status, 201);
    assert.equal(submitReviewResult.payload.submission.status, 'pending');

    const respondReviewResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/review/respond',
      body: {
        submissionId: submitReviewResult.payload.submission.id,
        decision: 'approved',
        responseNote: 'Looks good'
      }
    });
    assert.equal(respondReviewResult.response.status, 200);
    assert.equal(respondReviewResult.payload.submission.status, 'approved');
  } finally {
    await stopStudioServer(server);
  }
});

test('data profile generation and trust summary endpoints persist dataset quality snapshot', async () => {
  const mock = createStudioQueryMock();
  const { server, baseUrl } = await startStudioServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');

  try {
    const profileResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/data/profile',
      body: {
        datasetId: 99,
        minQualityScore: 0.7
      }
    });
    assert.equal(profileResult.response.status, 201);
    assert.equal(typeof profileResult.payload.profile?.qualityScore, 'number');
    assert.equal(typeof profileResult.payload.profileId, 'number');

    const trustResult = await requestJson({
      baseUrl,
      token,
      method: 'GET',
      path: '/api/workspaces/1/rooms/101/data/trust'
    });
    assert.equal(trustResult.response.status, 200);
    assert.equal(typeof trustResult.payload.trust?.qualityScore, 'number');
    assert.equal(trustResult.payload.trust?.datasetId, 99);
  } finally {
    await stopStudioServer(server);
  }
});

test('automation schedule endpoint replays deterministic response for same idempotency key', async () => {
  const mock = createStudioQueryMock();
  const { server, baseUrl } = await startStudioServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');

  try {
    const first = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/automations/schedule',
      body: {
        policyId: 501,
        cron: '0 9 * * 1',
        timezone: 'UTC'
      },
      headers: {
        'Idempotency-Key': 'schedule-idem-1'
      }
    });
    assert.equal(first.response.status, 201);
    assert.equal(first.payload.replayed, undefined);
    assert.equal(typeof first.payload.schedule?.id, 'number');

    const second = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/automations/schedule',
      body: {
        policyId: 501,
        cron: '0 9 * * 1',
        timezone: 'UTC'
      },
      headers: {
        'Idempotency-Key': 'schedule-idem-1'
      }
    });
    assert.equal(second.response.status, 201);
    assert.equal(second.payload.replayed, true);
    assert.equal(second.payload.schedule?.id, first.payload.schedule?.id);
  } finally {
    await stopStudioServer(server);
  }
});

test('report publish endpoint replays blocked response for same idempotency key', async () => {
  const mock = createStudioQueryMock();
  const { server, baseUrl } = await startStudioServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');

  try {
    const first = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/reports/v2/bundle_publish_seed/publish',
      body: {
        channel: 'in_app'
      },
      headers: {
        'Idempotency-Key': 'report-publish-idem-1'
      }
    });
    assert.equal(first.response.status, 400);
    assert.equal(typeof first.payload.error, 'string');

    const second = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/reports/v2/bundle_publish_seed/publish',
      body: {
        channel: 'in_app'
      },
      headers: {
        'Idempotency-Key': 'report-publish-idem-1'
      }
    });
    assert.equal(second.response.status, 400);
    assert.equal(second.payload.replayed, true);
    assert.equal(second.payload.error, first.payload.error);
  } finally {
    await stopStudioServer(server);
  }
});

test('actions sync endpoint replays deterministic response for same idempotency key', async () => {
  const mock = createStudioQueryMock();
  const { server, baseUrl } = await startStudioServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');

  try {
    const first = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/actions/sync',
      body: {
        channel: 'in_app',
        createTasks: false
      },
      headers: {
        'Idempotency-Key': 'actions-sync-idem-1'
      }
    });
    assert.equal(first.response.status, 200, JSON.stringify(first.payload));
    assert.equal(first.payload.syncedCount, 1);

    const second = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/actions/sync',
      body: {
        channel: 'in_app',
        createTasks: false
      },
      headers: {
        'Idempotency-Key': 'actions-sync-idem-1'
      }
    });
    assert.equal(second.response.status, 200);
    assert.equal(second.payload.replayed, true);
    assert.equal(second.payload.syncedCount, first.payload.syncedCount);
  } finally {
    await stopStudioServer(server);
  }
});

test('automation schedule dedupe returns existing schedule for same dedupe key intent', async () => {
  const mock = createStudioQueryMock();
  const { server, baseUrl } = await startStudioServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');

  try {
    const first = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/automations/schedule',
      body: {
        policyId: 501,
        cron: '0 9 * * 1',
        timezone: 'UTC',
        dedupeKey: 'revops-weekly-sync'
      },
      headers: {
        'Idempotency-Key': 'schedule-idem-dedupe-a'
      }
    });
    assert.equal(first.response.status, 201);
    const createdScheduleId = Number(first.payload.schedule?.id);
    assert.ok(Number.isFinite(createdScheduleId));

    const second = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/automations/schedule',
      body: {
        policyId: 501,
        cron: '0 9 * * 1',
        timezone: 'UTC',
        dedupeKey: 'revops-weekly-sync'
      },
      headers: {
        'Idempotency-Key': 'schedule-idem-dedupe-b'
      }
    });
    assert.equal(second.response.status, 200);
    assert.equal(second.payload.deduped, true);
    assert.equal(Number(second.payload.schedule?.id), createdScheduleId);
  } finally {
    await stopStudioServer(server);
  }
});

test('automation runs and queue-state endpoints surface retry/backoff visibility', async () => {
  const mock = createStudioQueryMock();
  const { server, baseUrl } = await startStudioServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');

  try {
    const runsResult = await requestJson({
      baseUrl,
      token,
      method: 'GET',
      path: '/api/workspaces/1/rooms/101/automations/runs'
    });
    assert.equal(runsResult.response.status, 200);
    assert.equal(Array.isArray(runsResult.payload.runs), true);
    assert.equal(runsResult.payload.runs.length, 1);
    assert.equal(runsResult.payload.runs[0].attempts, 2);
    assert.equal(Array.isArray(runsResult.payload.events), true);
    assert.equal(runsResult.payload.events.some((event: any) => event.eventType === 'execution_retry_scheduled'), true);

    const queueStateResult = await requestJson({
      baseUrl,
      token,
      method: 'GET',
      path: '/api/workspaces/1/rooms/101/automations/queue-state'
    });
    assert.equal(queueStateResult.response.status, 200);
    assert.equal(queueStateResult.payload.metrics.activeSchedules, 1);
    assert.equal(queueStateResult.payload.metrics.awaitingApprovalRuns, 1);
  } finally {
    await stopStudioServer(server);
  }
});

test('weekly room full-flow e2e covers run -> pivot -> visuals -> report -> review -> publish -> action sync -> status draft', async () => {
  const mock = createStudioQueryMock();
  const { server, baseUrl } = await startStudioServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');

  try {
    const profileResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/data/profile',
      body: {
        datasetId: 99,
        minQualityScore: 0.6
      }
    });
    assert.equal(profileResult.response.status, 201);

    const runResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/run',
      body: {
        mode: 'sql',
        payload: {
          datasetId: 99,
          sql: 'SELECT owner, amount, stage, created_at FROM data ORDER BY created_at DESC LIMIT 3'
        }
      }
    });
    assert.equal(runResult.response.status, 201, JSON.stringify(runResult.payload));
    assert.equal(Array.isArray(runResult.payload.rows), true);
    assert.ok(runResult.payload.rows.length > 0);

    const pivotResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/pivots/compute',
      body: {
        spec: {
          dimensions: ['owner'],
          measures: [{ field: 'amount', agg: 'sum', as: 'amount_total' }],
          calculations: [{ type: 'percent_of_total', sourceField: 'amount_total', as: 'amount_share' }],
          filters: []
        }
      }
    });
    assert.equal(pivotResult.response.status, 201, JSON.stringify(pivotResult.payload));
    assert.ok(Number(pivotResult.payload?.pivot?.rowCount || 0) > 0);

    const visualResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/visuals/build',
      body: {
        name: 'Owner Amount Trend',
        spec: {
          chartType: 'bar',
          dimensions: ['owner'],
          measures: ['amount']
        }
      }
    });
    assert.equal(visualResult.response.status, 201, JSON.stringify(visualResult.payload));
    assert.ok(Number.isFinite(Number(visualResult.payload.visualId)));

    const reportGenerateResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/reports/v2/generate',
      body: {
        timeframeDays: 7,
        compareMode: 'previous_period',
        focus: 'revops_weekly',
        persist: true
      }
    });
    assert.equal(reportGenerateResult.response.status, 201, JSON.stringify(reportGenerateResult.payload));
    const bundleId = String(reportGenerateResult.payload.bundleId || '');
    assert.ok(bundleId.length > 0);

    const reviewSubmitResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/review/submit',
      body: {
        bundleId,
        stage: 'manager_review',
        reviewerId: 2,
        note: 'Weekly report ready for approval'
      }
    });
    assert.equal(reviewSubmitResult.response.status, 201, JSON.stringify(reviewSubmitResult.payload));
    assert.equal(reviewSubmitResult.payload.submission.status, 'pending');

    const reviewRespondResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/review/respond',
      body: {
        submissionId: Number(reviewSubmitResult.payload.submission.id),
        decision: 'approved',
        responseNote: 'Approved for publish'
      }
    });
    assert.equal(reviewRespondResult.response.status, 200, JSON.stringify(reviewRespondResult.payload));
    assert.equal(reviewRespondResult.payload.submission.status, 'approved');

    const qualityResult = await requestJson({
      baseUrl,
      token,
      method: 'GET',
      path: `/api/workspaces/1/rooms/101/reports/v2/${bundleId}/quality`
    });
    assert.equal(qualityResult.response.status, 200, JSON.stringify(qualityResult.payload));
    assert.equal(Boolean(qualityResult.payload.quality?.publishBlocked), false);

    const publishResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: `/api/workspaces/1/rooms/101/reports/v2/${bundleId}/publish`,
      body: {
        channel: 'in_app',
        minProfileQualityScore: 0
      },
      headers: {
        'Idempotency-Key': `e2e-publish-${bundleId}`
      }
    });
    assert.equal(publishResult.response.status, 200, JSON.stringify(publishResult.payload));
    assert.equal(Boolean(publishResult.payload.quality?.publishBlocked), false);

    const actionSyncResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/actions/sync',
      body: {
        channel: 'in_app',
        createTasks: false
      },
      headers: {
        'Idempotency-Key': 'e2e-actions-sync-1'
      }
    });
    assert.equal(actionSyncResult.response.status, 200, JSON.stringify(actionSyncResult.payload));
    assert.ok(Number(actionSyncResult.payload.syncedCount) >= 1);

    const statusDraftResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      path: '/api/workspaces/1/rooms/101/status/draft',
      body: {
        persist: false
      }
    });
    assert.equal(statusDraftResult.response.status, 200, JSON.stringify(statusDraftResult.payload));
    assert.equal(typeof statusDraftResult.payload.draft?.summary, 'string');
    assert.ok(String(statusDraftResult.payload.draft.summary).length > 0);
  } finally {
    await stopStudioServer(server);
  }
});

test('failed automation schedule recovery is visible as completed recovery run without duplicate side effects', async () => {
  const mock = createStudioQueryMock({ includeRecoveredAutomationRun: true });
  const { server, baseUrl } = await startStudioServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');

  try {
    const runsResult = await requestJson({
      baseUrl,
      token,
      method: 'GET',
      path: '/api/workspaces/1/rooms/101/automations/runs'
    });
    assert.equal(runsResult.response.status, 200, JSON.stringify(runsResult.payload));
    assert.equal(Array.isArray(runsResult.payload.runs), true);
    assert.ok(runsResult.payload.runs.some((run: any) => run.status === 'failed'));
    assert.ok(runsResult.payload.runs.some((run: any) => run.status === 'completed'));

    const failedEvents = (runsResult.payload.events || []).filter((event: any) => event.eventType === 'execution_failed');
    const retryEvents = (runsResult.payload.events || []).filter((event: any) => event.eventType === 'execution_retry_scheduled');
    const recoveredEvents = (runsResult.payload.events || []).filter((event: any) => event.eventType === 'execution_completed');
    assert.ok(failedEvents.length >= 1);
    assert.ok(retryEvents.length >= 1);
    assert.ok(recoveredEvents.length >= 1);

    const recoveredMetadata = recoveredEvents[0]?.metadata || {};
    assert.equal(Number(recoveredMetadata.recoveredFromRunId), 5011);
    assert.equal(runsResult.payload.runs.filter((run: any) => run.status === 'completed').length, 1);
  } finally {
    await stopStudioServer(server);
  }
});
