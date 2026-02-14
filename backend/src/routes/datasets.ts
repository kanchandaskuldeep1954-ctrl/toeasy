import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription, checkTierLimit } from '../middleware/subscription.js';
import { GroqService } from '../services/groq.service.js';
import { ScraperService } from '../services/scraper.service.js';
import { verifyWorkspaceOwnership } from '../middleware/workspace.js';

const router = Router();
const groqService = new GroqService();

// Apply auth and subscription middleware
router.use(authenticateToken);
router.use(checkSubscription);
router.use('/:workspaceId', verifyWorkspaceOwnership);

// List datasets in workspace (with pagination)
router.get('/:workspaceId/datasets', async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500); // Max 500
    const offset = parseInt(req.query.offset as string) || 0;

    const countResult = await query(
      `SELECT COUNT(*) as total FROM datasets 
       WHERE workspace_id = $1`,
      [req.params.workspaceId]
    );

    const total = parseInt(countResult.rows[0].total);

    const result = await query(
      `SELECT id, name, file_name, row_count, column_count, file_size, health_score, created_at, updated_at 
       FROM datasets 
       WHERE workspace_id = $1 
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.workspaceId, limit, offset]
    );

    res.json({
      data: result.rows,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (err) {
    console.error('List datasets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create/upload dataset
router.post('/:workspaceId/datasets', checkTierLimit('maxDatasets'), checkTierLimit('maxRowsPerDataset'), async (req: AuthRequest, res) => {
  try {
    const { name, data, headers, description } = req.body;

    // Validate auth
    if (!req.user || !req.user.id) {
      console.error('Auth error: req.user or req.user.id missing', { user: req.user });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate input
    if (!name || !data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid dataset data: name and data array required' });
    }

    if (data.length === 0) {
      return res.status(400).json({ error: 'Dataset cannot be empty' });
    }

    const rowCount = data.length;
    const maxRows = (req as any).tierLimit || 500; // Default to basic

    if (rowCount > maxRows) {
      return res.status(403).json({
        error: 'Tier limit exceeded',
        message: `Your current plan allows up to ${maxRows} rows per dataset. You provided ${rowCount}.`
      });
    }

    const columnCount = headers ? headers.length : Object.keys(data[0] || {}).length;
    const fileSize = JSON.stringify(data).length;

    console.log(`Creating dataset: name=${name}, rows=${rowCount}, cols=${columnCount}, workspace=${req.params.workspaceId}, user=${req.user.id}`);

    // Check if workspace belongs to user
    const workspaceCheck = await query(
      'SELECT id FROM workspaces WHERE id = $1 AND user_id = $2',
      [req.params.workspaceId, req.user.id]
    );

    if (workspaceCheck.rows.length === 0) {
      console.error(`Workspace not found or unauthorized: ${req.params.workspaceId}`, { userId: req.user.id });
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Try inserting with description column, if it fails, fall back to without description
    let result;
    try {
      result = await query(
        `INSERT INTO datasets (workspace_id, user_id, name, description, row_count, column_count, file_size, raw_data, original_data) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) 
         RETURNING id, name, row_count, column_count, created_at`,
        [req.params.workspaceId, req.user.id, name, description || '', rowCount, columnCount, fileSize, JSON.stringify(data)]
      );
    } catch (descErr: any) {
      // If description/original_data column issues, try fallback (but migrations should be run)
      if (descErr.message.includes('column') || descErr.message.includes('does not exist')) {
        console.warn('Dataset insert failed, trying fallback without optional columns', descErr);
        result = await query(
          `INSERT INTO datasets (workspace_id, user_id, name, row_count, column_count, file_size, raw_data) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           RETURNING id, name, row_count, column_count, created_at`,
          [req.params.workspaceId, req.user.id, name, rowCount, columnCount, fileSize, JSON.stringify(data)]
        );
      } else {
        throw descErr;
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create dataset error:', err);
    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

// ==================== DATASET VERSIONING ====================

// List versions for a dataset
router.get('/:workspaceId/datasets/:datasetId/versions', async (req: AuthRequest, res) => {
  try {
    const { datasetId } = req.params;

    const result = await query(
      `SELECT id, version_name, description, row_count, created_by_tool, created_at, parent_version_id 
       FROM dataset_versions 
       WHERE dataset_id = $1 
       ORDER BY created_at DESC`,
      [datasetId]
    );

    const versions = result.rows;

    // Always fetch dataset creation info to provide the "Raw Original" entry
    const dsResult = await query('SELECT created_at FROM datasets WHERE id = $1', [datasetId]);

    if (dsResult.rows.length > 0) {
      versions.push({
        id: 'root', // Virtual ID
        version_name: 'Raw Original',
        description: 'Original upload',
        row_count: 0, // Could fetch actual count but '0' or 'Original' is fine for label
        created_by_tool: 'upload',
        created_at: dsResult.rows[0].created_at,
        isVirtual: true
      });
    }

    res.json(versions);
  } catch (err) {
    console.error('List versions error:', err);
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

// Create a new version
router.post('/:workspaceId/datasets/:datasetId/versions', async (req: AuthRequest, res) => {
  try {
    const { datasetId, workspaceId } = req.params;
    const { versionName, description, data, headers, parentVersionId, tool, script } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Valid data array is required' });
    }

    // 1. Save the new version
    const result = await query(
      `INSERT INTO dataset_versions 
       (dataset_id, created_by_user_id, version_name, description, data, headers, row_count, parent_version_id, created_by_tool, transformation_script)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, version_name, created_at`,
      [
        datasetId,
        req.user!.id,
        versionName || `v${Date.now()}`,
        description,
        JSON.stringify(data),
        JSON.stringify(headers || Object.keys(data[0] || {})),
        data.length,
        parentVersionId ? (parentVersionId === 'root' ? null : parentVersionId) : null,
        tool || 'api',
        script
      ]
    );

    // 2. OPTIONAL: Update the main dataset "cleaned_data" pointer if this is a "cleaning" action, 
    // to maintain backward compatibility with old dashboards that just look at "cleaned_data"
    // But for the new system, we rely on the version ID.

    // Log activity
    await query(
      `INSERT INTO activity_logs (user_id, workspace_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'create_version', 'dataset', $3, $4)`,
      [req.user!.id, workspaceId, datasetId, `Created version: ${versionName}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create version error:', err);
    res.status(500).json({ error: 'Failed to create version' });
  }
});

// Get specific version data
router.get('/:workspaceId/datasets/:datasetId/versions/:versionId', async (req: AuthRequest, res) => {
  try {
    const { datasetId, versionId } = req.params;

    // Handle "root" virtual version (Legacy Raw)
    if (versionId === 'root') {
      const dsResult = await query(
        'SELECT raw_data, headers, name FROM datasets WHERE id = $1',
        [datasetId]
      );
      if (dsResult.rows.length === 0) return res.status(404).json({ error: 'Dataset not found' });

      const raw = dsResult.rows[0].raw_data;
      return res.json({
        id: 'root',
        version_name: 'Raw Original',
        data: typeof raw === 'string' ? JSON.parse(raw) : raw,
        headers: typeof dsResult.rows[0].headers === 'string' ? JSON.parse(dsResult.rows[0].headers) : dsResult.rows[0].headers
      });
    }

    const result = await query(
      `SELECT * FROM dataset_versions WHERE id = $1 AND dataset_id = $2`,
      [versionId, datasetId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const ver = result.rows[0];
    res.json({
      ...ver,
      data: typeof ver.data === 'string' ? JSON.parse(ver.data) : ver.data, // Ensure JSON
      headers: typeof ver.headers === 'string' ? JSON.parse(ver.headers) : ver.headers
    });
  } catch (err) {
    console.error('Get version error:', err);
    res.status(500).json({ error: 'Failed to retrieve version' });
  }
});

// Get dataset details
router.get('/:workspaceId/datasets/:datasetId', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, name, row_count, column_count, file_size, raw_data, analysis_result, dashboard_config, strategic_report, created_at 
       FROM datasets 
       WHERE id = $1 AND workspace_id = $2`,
      [req.params.datasetId, req.params.workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const dataset = result.rows[0];

    // Parse raw_data safely - it might already be an object or a JSON string
    // Robust parsing for raw_data
    let parsedRawData = [];
    try {
      if (typeof dataset.raw_data === 'string') {
        const firstPass = JSON.parse(dataset.raw_data || '[]');
        // Handle double-stringification
        parsedRawData = typeof firstPass === 'string' ? JSON.parse(firstPass) : firstPass;
      } else if (Array.isArray(dataset.raw_data)) {
        parsedRawData = dataset.raw_data;
      } else if (dataset.raw_data && typeof dataset.raw_data === 'object') {
        parsedRawData = [dataset.raw_data];
      }

      if (!Array.isArray(parsedRawData)) {
        parsedRawData = [];
      }
    } catch (e) {
      console.error('Raw data parsing error for dataset', req.params.datasetId, e);
      parsedRawData = [];
    }

    // Parse analysis_result safely
    let parsedAnalysis = null;
    try {
      if (dataset.analysis_result) {
        parsedAnalysis = typeof dataset.analysis_result === 'string'
          ? JSON.parse(dataset.analysis_result)
          : dataset.analysis_result;
      }
    } catch (parseErr) {
      console.warn('Failed to parse analysis_result:', parseErr);
    }

    res.json({
      ...dataset,
      raw_data: parsedRawData,
      analysis_result: parsedAnalysis
    });
  } catch (err) {
    console.error('Get dataset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analyze dataset with AI
router.post('/:workspaceId/datasets/:datasetId/analyze', checkTierLimit('aiQueriesPerDay'), async (req: AuthRequest, res) => {
  try {
    // Get dataset
    const datasetResult = await query(
      'SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2 AND user_id = $3',
      [req.params.datasetId, req.params.workspaceId, req.user!.id]
    );

    if (datasetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    // Parse raw_data safely - it might already be an object or a JSON string
    let data: any[] = [];
    try {
      const rawData = datasetResult.rows[0].raw_data;
      if (typeof rawData === 'string') {
        data = JSON.parse(rawData || '[]');
      } else if (Array.isArray(rawData)) {
        data = rawData;
      } else if (rawData && typeof rawData === 'object') {
        data = [rawData];
      }
    } catch (parseErr) {
      console.warn('Failed to parse raw_data in analyze:', parseErr);
      return res.status(400).json({ error: 'Invalid dataset format: unable to parse data' });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Dataset is empty or invalid' });
    }

    const headers = Object.keys(data[0] || {});
    if (headers.length === 0) {
      return res.status(400).json({ error: 'Dataset has no columns' });
    }

    const sample = data.slice(0, 10);

    // Call Groq service
    const analysisText = await GroqService.analyzeDataset(headers, sample);

    // Parse and transform the analysis string into structured format
    let structuredAnalysis: any = {
      summary: analysisText,
      insights: [],
      patterns: [],
      anomalies: [],
      recommendations: [],
      dataQuality: {
        completeness: 85,
        consistency: 85,
        accuracy: 80,
        validity: 85
      }
    };

    try {
      // Try to extract sections from the Groq response
      const textLower = analysisText.toLowerCase();

      // Extract quality issues/anomalies
      if (analysisText.includes('Potential Quality Issues') || textLower.includes('quality issues')) {
        const match = analysisText.match(/(?:Potential Quality Issues|quality issues)[:\n]+([\s\S]*?)(?=\n\n|\*\*|$)/i);
        if (match) {
          const issues = match[1].split(/\d+\.\s+/);
          structuredAnalysis.anomalies = issues.filter((i: string) => i.trim()).map((i: string) => i.trim());
        }
      }

      // Extract recommendations
      if (analysisText.includes('Additional Recommendations') || textLower.includes('recommendation')) {
        const match = analysisText.match(/(?:Additional Recommendations|recommendation)[:\n]+([\s\S]*?)(?=\n\n|$)/i);
        if (match) {
          const recs = match[1].split(/\d+\.\s+/);
          structuredAnalysis.recommendations = recs.filter((r: string) => r.trim()).map((r: string) => r.trim());
        }
      }

      // If we didn't extract any structured data, create default recommendations
      if (structuredAnalysis.recommendations.length === 0) {
        structuredAnalysis.recommendations = [
          'Review data quality - consider data cleansing and validation',
          'Identify and handle missing or inconsistent values',
          'Normalize numeric columns for consistency',
          'Categorize categorical columns for better analysis'
        ];
      }

      if (structuredAnalysis.anomalies.length === 0) {
        structuredAnalysis.anomalies = [
          'Check for null values and missing data',
          'Verify data type consistency across columns',
          'Review for outliers or unusual patterns'
        ];
      }

      structuredAnalysis.insights = [
        `Dataset contains ${headers.length} columns and ${data.length} records`,
        `Primary columns: ${headers.slice(0, 5).join(', ')}`
      ];

      structuredAnalysis.patterns = [
        'Data structure analyzed successfully',
        'Ready for deeper analysis and visualization'
      ];
    } catch (parseErr) {
      console.warn('Failed to parse analysis text, using defaults:', parseErr);
    }

    // Save analysis result
    await query(
      'UPDATE datasets SET analysis_result = $1 WHERE id = $2',
      [JSON.stringify(structuredAnalysis), req.params.datasetId]
    );

    res.json(structuredAnalysis);
  } catch (err) {
    console.error('Analyze dataset error:', err);
    res.status(500).json({ error: 'Failed to analyze dataset' });
  }
});

// Scrape real web data
router.post('/:workspaceId/datasets/scrape', checkTierLimit('maxRowsPerDataset'), async (req: AuthRequest, res) => {
  try {
    const { url, topic, fields, count } = req.body;
    const maxRows = (req as any).tierLimit || 500;

    if (!url || !topic || !count) {
      return res.status(400).json({ error: 'Missing required parameters (url, topic, count)' });
    }

    const targetCount = Math.min(count, maxRows);
    console.log(`Real scrape requested for: ${url}, target count: ${targetCount}`);

    const scrapedData = await ScraperService.scrapeUrl(url, topic, fields || [], targetCount);

    res.json({
      data: scrapedData,
      count: scrapedData.length,
      limitApplied: targetCount < count
    });
  } catch (err) {
    console.error('Real scrape error:', err);
    res.status(500).json({ error: 'Failed to scrape web data' });
  }
});

// Generate synthetic data
router.post('/:workspaceId/datasets/:datasetId/generate', checkTierLimit('maxGenerateRows'), async (req: AuthRequest, res) => {
  try {
    const { topic, fields, count } = req.body;

    if (!topic || !fields || !count) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const syntheticData = await GroqService.generateSyntheticData(topic, fields, count);

    res.json({ data: syntheticData });
  } catch (err) {
    console.error('Generate synthetic data error:', err);
    res.status(500).json({ error: 'Failed to generate synthetic data' });
  }
});

// Export dataset
router.post('/:workspaceId/datasets/:datasetId/export', async (req: AuthRequest, res) => {
  try {
    const { format } = req.body; // 'csv', 'json', 'excel'

    const datasetResult = await query(
      'SELECT name, raw_data FROM datasets WHERE id = $1 AND workspace_id = $2 AND user_id = $3',
      [req.params.datasetId, req.params.workspaceId, req.user!.id]
    );

    if (datasetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const { name, raw_data } = datasetResult.rows[0];
    const data = JSON.parse(raw_data);

    let exportData = '';
    if (format === 'csv') {
      const headers = Object.keys(data[0] || {});
      exportData = headers.join(',') + '\n';
      exportData += data.map((row: any) => headers.map(h => JSON.stringify(row[h])).join(',')).join('\n');
    } else {
      exportData = JSON.stringify(data, null, 2);
    }

    res.json({
      filename: `${name}.${format === 'csv' ? 'csv' : 'json'}`,
      data: exportData
    });
  } catch (err) {
    console.error('Export dataset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dataset preview (sample of rows)
router.get('/:workspaceId/datasets/:datasetId/preview', async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    let result;
    try {
      result = await query(
        'SELECT raw_data, headers FROM datasets WHERE id = $1 AND workspace_id = $2',
        [req.params.datasetId, req.params.workspaceId]
      );
    } catch (e: any) {
      // Backward compatibility if older DB schema doesn't have `headers` column.
      if (e?.message && String(e.message).toLowerCase().includes('headers')) {
        result = await query(
          'SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2',
          [req.params.datasetId, req.params.workspaceId]
        );
      } else {
        throw e;
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const rawData = result.rows[0].raw_data;
    const storedHeaders = (result.rows[0] as any).headers;
    let data: any[] = [];

    if (typeof rawData === 'string') {
      data = JSON.parse(rawData);
    } else {
      data = rawData;
    }

    // Ensure data is an array
    if (!Array.isArray(data)) {
      if (data && typeof data === 'object' && (data as any).data && Array.isArray((data as any).data)) {
        data = (data as any).data;
      } else {
        data = [];
      }
    }

    const totalRows = data.length;

    const safeParse = (value: any) => {
      if (!value) return null;
      if (typeof value === 'string') {
        try { return JSON.parse(value); } catch { return null; }
      }
      return value;
    };

    // Determine headers/columns
    let headers: string[] | null = null;
    const parsedHeaders = safeParse(storedHeaders);
    if (Array.isArray(parsedHeaders)) {
      headers = parsedHeaders.map((h) => String(h));
    }

    const sampleRows = Array.isArray(data) ? data.slice(0, Math.min(200, data.length)) : [];
    if (!headers || headers.length === 0) {
      const headerSet = new Set<string>();
      for (const row of sampleRows) {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
          Object.keys(row).forEach((k) => headerSet.add(k));
        }
      }
      headers = Array.from(headerSet);
    }

    const inferType = (v: any): string => {
      if (v === null || v === undefined) return 'null';
      if (Array.isArray(v)) return 'array';
      const t = typeof v;
      if (t === 'number') return 'number';
      if (t === 'boolean') return 'boolean';
      if (t === 'object') return 'object';
      if (t === 'string') {
        const s = v.trim();
        if (s === '') return 'string';

        if (/^-?\d+(\.\d+)?$/.test(s) && Number.isFinite(Number(s))) return 'number';
        if (s === 'true' || s === 'false') return 'boolean';

        const d = Date.parse(s);
        if (!Number.isNaN(d)) return 'date';

        return 'string';
      }
      return 'string';
    };

    const mergeTypes = (types: Set<string>): string => {
      types.delete('null');
      if (types.size === 0) return 'string';
      if (types.size === 1) return Array.from(types)[0];
      if (types.has('string')) return 'string';
      return 'mixed';
    };

    const columns = (headers || []).map((name) => {
      let nullable = false;
      const typeSet = new Set<string>();

      for (const row of sampleRows) {
        const value = row && typeof row === 'object' ? (row as any)[name] : undefined;
        if (value === null || value === undefined) nullable = true;
        typeSet.add(inferType(value));
      }

      return {
        name,
        type: mergeTypes(typeSet),
        nullable
      };
    });

    res.json({
      data: data.slice(offset, offset + limit),
      columns,
      total_rows: totalRows,
      // Backwards compatibility for older callers
      total: totalRows,
      limit,
      offset,
      preview: true
    });
  } catch (err) {
    console.error('Dataset preview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update dataset (name, description, health_score, etc.)
router.put('/:workspaceId/datasets/:datasetId', async (req: AuthRequest, res) => {
  try {
    const { name, description, health_score, cleaning_confirmed, raw_data, headers, quarantined_data, dashboard_config, strategic_report } = req.body;

    // Support updating data, headers, and quarantined objects in the generic PUT route
    const result = await query(
      `UPDATE datasets 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description),
           health_score = COALESCE($3, health_score),
           cleaning_confirmed = COALESCE($4, cleaning_confirmed),
           raw_data = COALESCE($5, raw_data),
           cleaned_data = CASE WHEN $5 IS NOT NULL THEN NULL ELSE cleaned_data END,
           headers = COALESCE($6, headers),
           quarantined_data = COALESCE($7, quarantined_data),
           dashboard_config = COALESCE($8, dashboard_config),
           strategic_report = COALESCE($9, strategic_report),
           updated_at = NOW()
       WHERE id = $10 AND workspace_id = $11
       RETURNING *`,
      [
        name !== undefined ? name : null,
        description !== undefined ? description : null,
        health_score !== undefined ? health_score : null,
        cleaning_confirmed !== undefined ? cleaning_confirmed : null,
        raw_data !== undefined ? (typeof raw_data === 'string' ? JSON.parse(raw_data) : raw_data) : null,
        headers !== undefined ? (typeof headers === 'string' ? headers : JSON.stringify(headers)) : null,
        quarantined_data !== undefined ? (typeof quarantined_data === 'string' ? quarantined_data : JSON.stringify(quarantined_data)) : null,
        dashboard_config !== undefined ? (typeof dashboard_config === 'string' ? JSON.parse(dashboard_config) : dashboard_config) : null,
        strategic_report !== undefined ? (typeof strategic_report === 'string' ? JSON.parse(strategic_report) : strategic_report) : null,
        req.params.datasetId,
        req.params.workspaceId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update dataset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get quarantined data
router.get('/:workspaceId/datasets/:datasetId/quarantine', async (req: AuthRequest, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(
      'SELECT quarantined_data FROM datasets WHERE id = $1 AND workspace_id = $2',
      [req.params.datasetId, req.params.workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    let quarantined = result.rows[0].quarantined_data;

    // Parse if string
    if (typeof quarantined === 'string') {
      try {
        quarantined = JSON.parse(quarantined);
      } catch (e) {
        quarantined = [];
      }
    }

    if (!Array.isArray(quarantined)) {
      quarantined = [];
    }

    // Pagination
    const start = parseInt(offset as string);
    const end = start + parseInt(limit as string);
    const paginatedData = quarantined.slice(start, end);

    res.json({
      data: paginatedData,
      total: quarantined.length,
      limit: parseInt(limit as string),
      offset: start
    });
  } catch (err) {
    console.error('Get quarantine data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete dataset
router.delete('/:workspaceId/datasets/:datasetId', async (req: AuthRequest, res) => {

  try {
    const result = await query(
      'DELETE FROM datasets WHERE id = $1 AND workspace_id = $2 AND user_id = $3 RETURNING id',
      [req.params.datasetId, req.params.workspaceId, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    res.json({ message: 'Dataset deleted' });
  } catch (err) {
    console.error('Delete dataset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
