import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription, checkTierLimit } from '../middleware/subscription.js';
import { GroqService } from '../services/groq.service.js';
import { verifyWorkspaceOwnership } from '../middleware/workspace.js';
import { SafeExecutor } from '../utils/safeExecutor.js';

const router = Router();
const groqService = new GroqService();

// Apply auth and subscription middleware
router.use(authenticateToken);
router.use(checkSubscription);
router.use('/:workspaceId', verifyWorkspaceOwnership);

// Execute query on dataset
router.post('/:workspaceId/datasets/:datasetId/query', checkTierLimit('aiQueriesPerDay'), async (req: AuthRequest, res) => {
  try {
    // Accept query_text / queryText / sql for compatibility.
    const queryText = req.body.query_text || req.body.queryText || req.body.sql;
    const type = req.body.type || 'sql';

    if (!queryText) {
      return res.status(400).json({ error: 'Query text required' });
    }

    // Get dataset
    const datasetResult = await query(
      'SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2',
      [req.params.datasetId, req.params.workspaceId]
    );

    if (datasetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    let rawData = datasetResult.rows[0].raw_data;
    let data: any[] = [];

    // Parse raw_data if it's a string
    if (typeof rawData === 'string') {
      data = JSON.parse(rawData);
    } else {
      data = rawData;
    }

    // Ensure data is an array
    if (!Array.isArray(data)) {
      const parsedData = data as any;
      if (parsedData && typeof parsedData === 'object' && parsedData.data && Array.isArray(parsedData.data)) {
        data = parsedData.data;
      } else {
        data = [];
      }
    }

    let results: any[] = data;

    if (type === 'natural') {
      // Convert natural language to SQL using Groq
      const sqlResponse = await GroqService.generateSQL({ data }, queryText) as any;

      // Execute SQL-like operations on in-memory data
      results = executeSimpleSQL(data, sqlResponse.sql);
    } else if (type === 'sql') {
      // Execute SQL-like query on in-memory data
      results = executeSimpleSQL(data, queryText);
    }

    // --- History Deduplication & Save Logic ---
    const { workspaceId, datasetId } = req.params;

    // Check for existing history entry with identical SQL
    const existingResult = await query(
      'SELECT id FROM queries WHERE workspace_id = $1 AND dataset_id = $2 AND query_text = $3 AND executed_by = $4 AND is_saved = false',
      [workspaceId, datasetId, queryText, req.user!.id]
    );

    if (existingResult.rows.length > 0) {
      // Update existing entry's timestamp and results
      await query(
        'UPDATE queries SET result_count = $1, updated_at = NOW() WHERE id = $2',
        [results.length, existingResult.rows[0].id]
      );
    } else {
      // Save new query to history
      await query(
        `INSERT INTO queries(workspace_id, dataset_id, query_text, query_type, result_count, executed_by, is_saved)
VALUES($1, $2, $3, $4, $5, $6, false)`,
        [workspaceId, datasetId, queryText, type, results.length, req.user!.id]
      );
    }

    res.json({
      results,
      count: results.length,
      executedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Execute query error:', err);
    res.status(500).json({ error: 'Failed to execute query' });
  }
});

// List all queries in a workspace
router.get('/:workspaceId/queries', async (req: AuthRequest, res) => {
  try {
    const { workspaceId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const countResult = await query(
      'SELECT COUNT(*) as total FROM queries WHERE workspace_id = $1',
      [workspaceId]
    );

    const result = await query(
      `SELECT q.*, d.name as dataset_name 
       FROM queries q
       LEFT JOIN datasets d ON q.dataset_id = d.id
       WHERE q.workspace_id = $1 AND q.is_saved = false
       ORDER BY q.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset]
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
      hasMore: offset + limit < parseInt(countResult.rows[0].total)
    });
  } catch (err) {
    console.error('List workspace queries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete query history entry
router.delete('/:workspaceId/queries/:queryId', async (req: AuthRequest, res) => {
  try {
    const { workspaceId, queryId } = req.params;
    const result = await query(
      'DELETE FROM queries WHERE id = $1 AND workspace_id = $2 RETURNING id',
      [queryId, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }

    res.json({ message: 'Query deleted' });
  } catch (err) {
    console.error('Delete query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific query
router.get('/:workspaceId/queries/:queryId', async (req: AuthRequest, res) => {
  try {
    const { workspaceId, queryId } = req.params;
    const result = await query(
      'SELECT * FROM queries WHERE id = $1 AND workspace_id = $2',
      [queryId, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// List query history (with pagination)
router.get('/:workspaceId/datasets/:datasetId/queries', async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500); // Max 500
    const offset = parseInt(req.query.offset as string) || 0;

    const countResult = await query(
      `SELECT COUNT(*) as total FROM queries 
       WHERE dataset_id = $1 AND workspace_id = $2 AND is_saved = true`,
      [req.params.datasetId, req.params.workspaceId]
    );

    const total = parseInt(countResult.rows[0].total);

    const result = await query(
      `SELECT id, query_text, query_type, result_count, name, description, created_at 
       FROM queries 
       WHERE dataset_id = $1 AND workspace_id = $2 AND is_saved = true
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4`,
      [req.params.datasetId, req.params.workspaceId, limit, offset]
    );

    res.json({
      data: result.rows,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (err) {
    console.error('List queries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save a new query
router.post('/:workspaceId/datasets/:datasetId/queries', async (req: AuthRequest, res) => {
  try {
    const { name, description, sql, type, resultCount } = req.body;

    if (!name || !sql) {
      return res.status(400).json({ error: 'Name and SQL required' });
    }

    const result = await query(
      `INSERT INTO queries(workspace_id, dataset_id, query_text, query_type, name, description, executed_by, result_count, is_saved)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING id, created_at`,
      [
        req.params.workspaceId,
        req.params.datasetId,
        sql,
        type || 'sql',
        name,
        description || '',
        req.user!.id,
        resultCount || 0
      ]
    );

    res.status(201).json({
      id: result.rows[0].id,
      name,
      description: description || '',
      sql,
      type: type || 'sql',
      rowCount: resultCount || 0,
      createdAt: result.rows[0].created_at
    });
  } catch (err) {
    console.error('Save query error:', err);
    res.status(500).json({ error: 'Failed to save query' });
  }
});

// Delete a specific query from a dataset
router.delete('/:workspaceId/datasets/:datasetId/queries/:queryId', async (req: AuthRequest, res) => {
  try {
    const { workspaceId, datasetId, queryId } = req.params;
    const result = await query(
      'DELETE FROM queries WHERE id = $1 AND workspace_id = $2 AND dataset_id = $3 AND executed_by = $4 RETURNING id',
      [queryId, workspaceId, datasetId, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }

    res.json({ message: 'Query deleted' });
  } catch (err) {
    console.error('Delete dataset query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:workspaceId/datasets/:datasetId/queries/:queryId/export', async (req: AuthRequest, res) => {
  try {
    const { format } = req.body; // 'csv', 'json'

    // For now, return a template response
    // In production, you would fetch the actual query results
    const result = {
      filename: `query -export.${format === 'csv' ? 'csv' : 'json'} `,
      data: format === 'csv' ? 'col1,col2\n1,2' : '[]'
    };

    res.json(result);
  } catch (err) {
    console.error('Export query results error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simple in-memory SQL executor for basic queries
function executeSimpleSQL(data: any[], sqlQuery: string): any[] {
  try {
    // Very basic SQL-like filtering
    // This is a simplified implementation
    // In production, use a proper SQL query engine like sql.js

    const lowerQuery = sqlQuery.toLowerCase().trim();

    // Handle COUNT(*) or COUNT queries
    if (lowerQuery.includes('count(*)') || lowerQuery.includes('count(')) {
      console.log('Executing COUNT query');
      return [{ count: data.length }];
    }

    // Handle SELECT with WHERE clause
    if (lowerQuery.includes('select') && lowerQuery.includes('where')) {
      const whereMatch = sqlQuery.match(/where\s+(.+?)(?:order\s+by|limit|$)/i);
      if (whereMatch) {
        const condition = whereMatch[1].trim();
        let filtered = data.filter(row => {
          try {
            // Simple evaluation of conditions like "age > 25"
            for (const [key, value] of Object.entries(row)) {
              // Create a sandboxed context for this row
              const context = { ...row, [key]: value };
              // Better approach: regex replace is brittle. 
              // Ideally, we should parse the SQL WHERE clause properly.
              // But preserving existing logic for now with SafeExecutor.

              const conditionWithValue = condition.replace(new RegExp(`\\b${key} \\b`, 'g'), JSON.stringify(value));

              const res = SafeExecutor.execute(conditionWithValue);
              if (res.success && res.result === true) return true;
            }
            return false;
          } catch {
            return true;
          }
        });

        // Handle ORDER BY
        const orderMatch = sqlQuery.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
        if (orderMatch) {
          const orderColumn = orderMatch[1];
          const orderDirection = (orderMatch[2] || 'asc').toLowerCase();
          filtered = filtered.sort((a, b) => {
            const aVal = a[orderColumn];
            const bVal = b[orderColumn];
            if (aVal < bVal) return orderDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return orderDirection === 'asc' ? 1 : -1;
            return 0;
          });
        }

        // Handle LIMIT
        const limitMatch = sqlQuery.match(/limit\s+(\d+)/i);
        if (limitMatch) {
          const limit = parseInt(limitMatch[1]);
          filtered = filtered.slice(0, limit);
        }

        return filtered;
      }
    }

    // Handle SELECT with just LIMIT
    if (lowerQuery.includes('select') && lowerQuery.includes('limit')) {
      const limitMatch = sqlQuery.match(/limit\s+(\d+)/i);
      if (limitMatch) {
        const limit = parseInt(limitMatch[1]);
        return data.slice(0, limit);
      }
    }

    // Handle ORDER BY without WHERE
    if (lowerQuery.includes('order\s+by')) {
      const orderMatch = sqlQuery.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
      if (orderMatch) {
        const orderColumn = orderMatch[1];
        const orderDirection = (orderMatch[2] || 'asc').toLowerCase();
        const sorted = [...data].sort((a, b) => {
          const aVal = a[orderColumn];
          const bVal = b[orderColumn];
          if (aVal < bVal) return orderDirection === 'asc' ? -1 : 1;
          if (aVal > bVal) return orderDirection === 'asc' ? 1 : -1;
          return 0;
        });
        return sorted;
      }
    }

    // Default: return all data
    console.log('Executing simple SELECT - returning all rows');
    return data;
  } catch (err) {
    console.error('SQL execution error:', err);
    return data;
  }
}

export default router;
