import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import { verifyWorkspaceOwnership } from '../middleware/workspace.js';

const router = Router();

// Apply auth and subscription middleware
router.use(authenticateToken);
router.use(checkSubscription);

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
