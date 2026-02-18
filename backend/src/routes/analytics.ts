import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import { verifyWorkspaceOwnership } from '../middleware/workspace.js';

const router = Router();

// Apply auth and subscription middleware
router.use(authenticateToken);
router.use(checkSubscription);

const MVP_EVIDENCE_TYPES = ['dataset_version', 'query_run', 'chart', 'pivot', 'report_block', 'decision_brief'];

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

const parseJsonMaybe = (value: any, fallback: Record<string, any> = {}) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
};

// Telemetry sink for product events
router.post('/events', async (req: AuthRequest, res) => {
  try {
    const eventType = String(req.body?.event || req.body?.eventType || '').trim();
    if (!eventType) {
      return res.status(400).json({ error: 'event is required' });
    }

    const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
    const workspaceIdRaw = req.body?.workspaceId ?? metadata.workspaceId ?? null;
    const roomIdRaw = req.body?.roomId ?? metadata.roomId ?? null;
    const workspaceId = workspaceIdRaw && Number.isFinite(Number(workspaceIdRaw)) ? Number(workspaceIdRaw) : null;
    const roomId = roomIdRaw && Number.isFinite(Number(roomIdRaw)) ? Number(roomIdRaw) : null;

    if (workspaceId) {
      // Soft ownership check for telemetry writes
      const ownerCheck = await query(
        `SELECT id FROM workspaces WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [workspaceId, req.user!.id]
      );
      if (ownerCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Unauthorized workspace for telemetry event' });
      }
    }

    await query(
      `
      INSERT INTO analytics_events (workspace_id, room_id, user_id, event_type, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [workspaceId, roomId, req.user!.id, eventType, JSON.stringify(metadata)]
    );

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Track analytics event error:', err);
    return res.status(500).json({ error: 'Failed to track analytics event' });
  }
});

// Decision Room MVP KPI snapshot
router.get('/workspaces/:workspaceId/mvp-kpis', verifyWorkspaceOwnership, async (req: AuthRequest, res) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));

    const eventResult = await query(
      `
      SELECT room_id, event_type, metadata, created_at
      FROM analytics_events
      WHERE workspace_id = $1
        AND created_at >= NOW() - ($2::text || ' days')::interval
      ORDER BY created_at ASC
      `,
      [workspaceId, days]
    );

    const events = eventResult.rows.map((row) => ({
      roomId: row.room_id ? Number(row.room_id) : null,
      eventType: String(row.event_type),
      metadata: parseJsonMaybe(row.metadata, {}),
      createdAt: new Date(row.created_at)
    }));

    const eventsByRoom = new Map<number, typeof events>();
    events.forEach((event) => {
      if (!event.roomId) return;
      const roomEvents = eventsByRoom.get(event.roomId) || [];
      roomEvents.push(event);
      eventsByRoom.set(event.roomId, roomEvents);
    });

    const firstInsightMinutes: number[] = [];
    const insightToActionMinutes: number[] = [];

    eventsByRoom.forEach((roomEvents) => {
      const start = roomEvents.find((event) => event.eventType === 'decision_room_flow_started');
      const firstInsight = roomEvents.find((event) =>
        event.eventType === 'decision_room_first_insight' || event.eventType === 'decision_room_run_completed'
      );
      const firstActionSync = roomEvents.find((event) => event.eventType === 'decision_room_actions_synced');

      if (start && firstInsight) {
        firstInsightMinutes.push((firstInsight.createdAt.getTime() - start.createdAt.getTime()) / (1000 * 60));
      }
      if (firstInsight && firstActionSync) {
        insightToActionMinutes.push((firstActionSync.createdAt.getTime() - firstInsight.createdAt.getTime()) / (1000 * 60));
      }
    });

    const autoStatusDrafts = events.filter((event) => event.eventType === 'decision_room_status_draft_generated').length;
    const manualStatusUpdates = events.filter((event) => event.eventType === 'decision_room_manual_status_update').length;
    const statusUpdateReductionPct = (autoStatusDrafts + manualStatusUpdates) > 0
      ? (autoStatusDrafts / (autoStatusDrafts + manualStatusUpdates)) * 100
      : null;

    const actionCoverageResult = await query(
      `
      WITH action_items AS (
        SELECT id
        FROM artifacts
        WHERE workspace_id = $1
          AND artifact_type = 'action_item'
          AND created_at >= NOW() - ($2::text || ' days')::interval
      ),
      covered AS (
        SELECT DISTINCT le.child_artifact_id
        FROM lineage_edges le
        JOIN artifacts parent ON parent.id = le.parent_artifact_id
        WHERE le.workspace_id = $1
          AND le.child_artifact_id IN (SELECT id FROM action_items)
          AND parent.artifact_type = ANY($3::text[])
      )
      SELECT
        (SELECT COUNT(*)::int FROM action_items) AS total_actions,
        (SELECT COUNT(*)::int FROM covered) AS covered_actions
      `,
      [workspaceId, days, MVP_EVIDENCE_TYPES]
    );

    const totalActions = Number(actionCoverageResult.rows[0]?.total_actions || 0);
    const coveredActions = Number(actionCoverageResult.rows[0]?.covered_actions || 0);
    const evidenceCoverageRatio = totalActions > 0 ? coveredActions / totalActions : 0;

    const weeklyActiveRoomsResult = await query(
      `
      SELECT COUNT(DISTINCT room_id)::int AS count
      FROM analytics_events
      WHERE workspace_id = $1
        AND room_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '7 days'
      `,
      [workspaceId]
    );

    const weeklyActiveRooms = Number(weeklyActiveRoomsResult.rows[0]?.count || 0);

    return res.json({
      generatedAt: new Date().toISOString(),
      windowDays: days,
      metrics: {
        timeToFirstInsightMedianMinutes: median(firstInsightMinutes),
        timeToFirstInsightP90Minutes: percentile(firstInsightMinutes, 90),
        timeFromInsightToActionMedianMinutes: median(insightToActionMinutes),
        timeFromInsightToActionP90Minutes: percentile(insightToActionMinutes, 90),
        manualStatusUpdateReductionPct: statusUpdateReductionPct,
        evidenceCoverageRatio,
        weeklyActiveRooms
      },
      counters: {
        trackedRooms: eventsByRoom.size,
        firstInsightSamples: firstInsightMinutes.length,
        insightToActionSamples: insightToActionMinutes.length,
        totalActions,
        coveredActions,
        autoStatusDrafts,
        manualStatusUpdates
      }
    });
  } catch (err) {
    console.error('Get MVP KPI snapshot error:', err);
    return res.status(500).json({ error: 'Failed to fetch MVP KPI snapshot' });
  }
});

// Get workspace statistics
router.get('/:workspaceId/stats', verifyWorkspaceOwnership, async (req: AuthRequest, res) => {
  try {
    const statsResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM datasets WHERE workspace_id = $1 AND user_id = $2) as dataset_count,
        (SELECT COUNT(*) FROM dashboards WHERE workspace_id = $1) as dashboard_count,
        (SELECT COUNT(*) FROM queries WHERE workspace_id = $1) as query_count,
        (SELECT SUM(row_count) FROM datasets WHERE workspace_id = $1 AND user_id = $2) as total_rows`,
      [req.params.workspaceId, req.user!.id]
    );

    if (statsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const stats = statsResult.rows[0];
    res.json({
      datasets: stats.dataset_count || 0,
      dashboards: stats.dashboard_count || 0,
      queries: stats.query_count || 0,
      totalRows: stats.total_rows || 0
    });
  } catch (err) {
    console.error('Get workspace stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get activity logs for workspace (with pagination)
router.get('/:workspaceId/activity', verifyWorkspaceOwnership, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500); // Max 500
    const offset = parseInt(req.query.offset as string) || 0;

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM activity_logs 
       WHERE user_id = $1 AND workspace_id = $2`,
      [req.user!.id, req.params.workspaceId]
    );

    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const result = await query(
      `SELECT id, action, resource_type, resource_id, created_at 
       FROM activity_logs 
       WHERE user_id = $1 AND workspace_id = $2
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4`,
      [req.user!.id, req.params.workspaceId, limit, offset]
    );

    res.json({
      data: result.rows,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (err) {
    console.error('Get activity logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user analytics across all workspaces
router.get('/user/analytics', async (req: AuthRequest, res) => {
  try {
    const analyticsResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM workspaces WHERE user_id = $1) as workspace_count,
        (SELECT COUNT(*) FROM datasets WHERE user_id = $1) as dataset_count,
        (SELECT COUNT(*) FROM dashboards WHERE workspace_id IN (SELECT id FROM workspaces WHERE user_id = $1)) as dashboard_count,
        (SELECT COUNT(*) FROM queries WHERE executed_by = $1) as query_count,
        (SELECT SUM(row_count) FROM datasets WHERE user_id = $1) as total_rows,
        (SELECT MAX(created_at) FROM activity_logs WHERE user_id = $1) as last_activity`,
      [req.user!.id]
    );

    if (analyticsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Analytics not found' });
    }

    const analytics = analyticsResult.rows[0];
    res.json({
      workspaces: analytics.workspace_count || 0,
      datasets: analytics.dataset_count || 0,
      dashboards: analytics.dashboard_count || 0,
      queriesExecuted: analytics.query_count || 0,
      totalRowsProcessed: analytics.total_rows || 0,
      lastActivity: analytics.last_activity
    });
  } catch (err) {
    console.error('Get user analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get usage by subscription tier
router.get('/subscription-usage', async (req: AuthRequest, res) => {
  try {
    const subResult = await query(
      'SELECT tier FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.user!.id, 'active']
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active subscription' });
    }

    const tier = subResult.rows[0].tier;

    // Get usage stats
    const usageResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM workspaces WHERE user_id = $1) as workspace_used,
        (SELECT COUNT(*) FROM datasets WHERE user_id = $1) as dataset_used,
        (SELECT COALESCE(SUM(row_count), 0) FROM datasets WHERE user_id = $1) as rows_used`,
      [req.user!.id]
    );

    const usage = usageResult.rows[0];

    const tierLimits: any = {
      basic: { maxDatasets: 3, maxRowsPerDataset: 500, maxWorkspaces: 1 },
      pro: { maxDatasets: 50, maxRowsPerDataset: 100000, maxWorkspaces: 10 },
      enterprise: { maxDatasets: null, maxRowsPerDataset: null, maxWorkspaces: null }
    };

    const limits = tierLimits[tier];

    res.json({
      tier,
      limits,
      usage: {
        workspaces: {
          used: usage.workspace_used,
          limit: limits.maxWorkspaces,
          percentage: limits.maxWorkspaces ? (usage.workspace_used / limits.maxWorkspaces) * 100 : 0
        },
        datasets: {
          used: usage.dataset_used,
          limit: limits.maxDatasets,
          percentage: limits.maxDatasets ? (usage.dataset_used / limits.maxDatasets) * 100 : 0
        },
        rows: {
          used: usage.rows_used,
          limit: limits.maxRowsPerDataset ? limits.maxRowsPerDataset * limits.maxDatasets : null,
          percentage: limits.maxRowsPerDataset ? (usage.rows_used / (limits.maxRowsPerDataset * limits.maxDatasets)) * 100 : 0
        }
      }
    });
  } catch (err) {
    console.error('Get subscription usage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dataset usage statistics
router.get('/:workspaceId/datasets/:datasetId/stats', verifyWorkspaceOwnership, async (req: AuthRequest, res) => {
  try {
    const dsCheck = await query(
      `SELECT id FROM datasets WHERE id = $1 AND workspace_id = $2`,
      [req.params.datasetId, req.params.workspaceId]
    );

    if (dsCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const statsResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM queries WHERE dataset_id = $1) as query_count,
        (SELECT COUNT(*) FROM validation_rules WHERE dataset_id = $1) as rule_count,
        (SELECT MAX(created_at) FROM queries WHERE dataset_id = $1) as last_queried`,
      [req.params.datasetId]
    );

    const stats = statsResult.rows[0];
    res.json({
      queriesExecuted: stats.query_count || 0,
      validationRules: stats.rule_count || 0,
      lastQueried: stats.last_queried
    });
  } catch (err) {
    console.error('Get dataset stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export analytics report
router.post('/:workspaceId/analytics/export', verifyWorkspaceOwnership, async (req: AuthRequest, res) => {
  try {
    const { format } = req.body; // 'csv' or 'json'

    // Get comprehensive analytics
    const analyticsResult = await query(
      `SELECT 
        'Workspaces' as category, COUNT(*) as count FROM workspaces WHERE user_id = $1
      UNION ALL
      SELECT 'Datasets', COUNT(*) FROM datasets WHERE user_id = $1
      UNION ALL
      SELECT 'Dashboards', COUNT(*) FROM dashboards WHERE workspace_id IN (SELECT id FROM workspaces WHERE user_id = $1)
      UNION ALL
      SELECT 'Queries', COUNT(*) FROM queries WHERE executed_by = $1`,
      [req.user!.id]
    );

    const reportData = analyticsResult.rows;

    let exportData = '';
    if (format === 'csv') {
      exportData = 'Category,Count\n';
      exportData += reportData.map(r => `${r.category},${r.count}`).join('\n');
    } else {
      exportData = JSON.stringify(reportData, null, 2);
    }

    res.json({
      filename: `analytics-report.${format === 'csv' ? 'csv' : 'json'}`,
      data: exportData
    });
  } catch (err) {
    console.error('Export analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
