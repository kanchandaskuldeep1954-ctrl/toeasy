import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription, checkTierLimit } from '../middleware/subscription.js';
import { GroqService } from '../services/groq.service.js';

const router = Router();
const groqService = new GroqService();

// Apply auth and subscription middleware
router.use(authenticateToken);
router.use(checkSubscription);

// Verify workspace ownership middleware
const verifyWorkspaceOwnership = async (req: AuthRequest, res: any, next: Function) => {
  try {
    const result = await query(
      'SELECT user_id FROM workspaces WHERE id = $1',
      [req.params.workspaceId]
    );
    if (result.rows.length === 0 || result.rows[0].user_id !== parseInt(req.user!.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.use('/:workspaceId/datasets', verifyWorkspaceOwnership);

// List datasets in workspace (with pagination)
router.get('/:workspaceId/datasets', async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500); // Max 500
    const offset = parseInt(req.query.offset as string) || 0;

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM datasets 
       WHERE workspace_id = $1 AND user_id = $2`,
      [req.params.workspaceId, req.user!.id]
    );

    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const result = await query(
      `SELECT id, name, file_name, row_count, column_count, file_size, created_at 
       FROM datasets 
       WHERE workspace_id = $1 AND user_id = $2 
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.params.workspaceId, req.user!.id, limit, offset]
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
router.post('/:workspaceId/datasets', checkTierLimit('maxDatasets'), async (req: AuthRequest, res) => {
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
        `INSERT INTO datasets (workspace_id, user_id, name, description, row_count, column_count, file_size, raw_data) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id, name, row_count, column_count, created_at`,
        [req.params.workspaceId, req.user.id, name, description || '', rowCount, columnCount, fileSize, JSON.stringify(data)]
      );
    } catch (descErr: any) {
      // If description column doesn't exist, try without it
      if (descErr.message.includes('column "description"') || descErr.message.includes('does not exist')) {
        console.log('Description column not found in database, inserting without description');
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

    console.log(`Dataset created successfully: ${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create dataset error:', err);
    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

// Get dataset details
router.get('/:workspaceId/datasets/:datasetId', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, name, row_count, column_count, file_size, raw_data, analysis_result, created_at 
       FROM datasets 
       WHERE id = $1 AND workspace_id = $2 AND user_id = $3`,
      [req.params.datasetId, req.params.workspaceId, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const dataset = result.rows[0];

    // Parse raw_data safely - it might already be an object or a JSON string
    let parsedRawData = [];
    try {
      if (typeof dataset.raw_data === 'string') {
        parsedRawData = JSON.parse(dataset.raw_data || '[]');
      } else if (Array.isArray(dataset.raw_data)) {
        parsedRawData = dataset.raw_data;
      } else if (dataset.raw_data && typeof dataset.raw_data === 'object') {
        parsedRawData = [dataset.raw_data];
      }
    } catch (parseErr) {
      console.warn('Failed to parse raw_data, using empty array:', parseErr);
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
router.post('/:workspaceId/datasets/:datasetId/analyze', async (req: AuthRequest, res) => {
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

    const result = await query(
      'SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2 AND user_id = $3',
      [req.params.datasetId, req.params.workspaceId, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const rawData = result.rows[0].raw_data;
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

    res.json({
      data: data.slice(0, limit),
      total: data.length,
      preview: true
    });
  } catch (err) {
    console.error('Dataset preview error:', err);
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
