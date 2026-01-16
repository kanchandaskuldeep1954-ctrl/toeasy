import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import { GroqService } from '../services/groq.service.js';

const router = Router();
const groqService = new GroqService();

// Apply auth and subscription middleware
router.use(authenticateToken);
router.use(checkSubscription);

// List validation rules for dataset (with pagination)
router.get('/:workspaceId/datasets/:datasetId/rules', async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500); // Max 500
    const offset = parseInt(req.query.offset as string) || 0;

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM validation_rules WHERE dataset_id = $1`,
      [req.params.datasetId]
    );

    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const result = await query(
      `SELECT id, name, rule_type, rule_definition, is_active, created_at 
       FROM validation_rules 
       WHERE dataset_id = $1 
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.datasetId, limit, offset]
    );

    const rules = result.rows.map(r => ({
      ...r,
      rule_definition: JSON.parse(r.rule_definition)
    }));

    res.json({
      data: rules,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (err) {
    console.error('List validation rules error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create validation rule
router.post('/:workspaceId/datasets/:datasetId/rules', async (req: AuthRequest, res) => {
  try {
    const { name, ruleType, ruleDefinition } = req.body;

    if (!name || !ruleType || !ruleDefinition) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await query(
      `INSERT INTO validation_rules (dataset_id, name, rule_type, rule_definition, is_active) 
       VALUES ($1, $2, $3, $4, true) 
       RETURNING id, name, rule_type, rule_definition, is_active, created_at`,
      [req.params.datasetId, name, ruleType, JSON.stringify(ruleDefinition)]
    );

    const rule = result.rows[0];
    res.status(201).json({
      ...rule,
      rule_definition: JSON.parse(rule.rule_definition)
    });
  } catch (err) {
    console.error('Create validation rule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update validation rule
router.put('/:workspaceId/datasets/:datasetId/rules/:ruleId', async (req: AuthRequest, res) => {
  try {
    const { name, ruleType, ruleDefinition, isActive } = req.body;

    const result = await query(
      `UPDATE validation_rules 
       SET name = $1, rule_type = $2, rule_definition = $3, is_active = $4, updated_at = NOW() 
       WHERE id = $5 AND dataset_id = $6 
       RETURNING id, name, rule_type, rule_definition, is_active, updated_at`,
      [name, ruleType, JSON.stringify(ruleDefinition), isActive, req.params.ruleId, req.params.datasetId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Validation rule not found' });
    }

    const rule = result.rows[0];
    res.json({
      ...rule,
      rule_definition: JSON.parse(rule.rule_definition)
    });
  } catch (err) {
    console.error('Update validation rule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete validation rule
router.delete('/:workspaceId/datasets/:datasetId/rules/:ruleId', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'DELETE FROM validation_rules WHERE id = $1 AND dataset_id = $2 RETURNING id',
      [req.params.ruleId, req.params.datasetId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Validation rule not found' });
    }

    res.json({ message: 'Validation rule deleted' });
  } catch (err) {
    console.error('Delete validation rule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get AI-suggested validation rules
router.post('/:workspaceId/datasets/:datasetId/rules/suggest', async (req: AuthRequest, res) => {
  try {
    // Get dataset
    const datasetResult = await query(
      'SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2',
      [req.params.datasetId, req.params.workspaceId]
    );

    if (datasetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const data = JSON.parse(datasetResult.rows[0].raw_data);
    const headers = Object.keys(data[0] || {});
    const sample = data.slice(0, 10);

    // Analyze dataset to suggest rules
    const analysis = await GroqService.analyzeDataset(headers, sample);

    // Extract suggested rules from analysis
    // This is a simplified version - in production, parse Groq's response properly
    const suggestedRules = [
      {
        name: 'Null Check',
        ruleType: 'null_check',
        ruleDefinition: { columns: headers }
      },
      {
        name: 'Data Type Consistency',
        ruleType: 'type_check',
        ruleDefinition: { columns: headers }
      }
    ];

    res.json({ suggestedRules });
  } catch (err) {
    console.error('Suggest rules error:', err);
    res.status(500).json({ error: 'Failed to suggest validation rules' });
  }
});

// Run validation on dataset
router.post('/:workspaceId/datasets/:datasetId/validate', async (req: AuthRequest, res) => {
  try {
    // Get dataset
    const datasetResult = await query(
      'SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2',
      [req.params.datasetId, req.params.workspaceId]
    );

    if (datasetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    // Get active rules
    const rulesResult = await query(
      'SELECT * FROM validation_rules WHERE dataset_id = $1 AND is_active = true',
      [req.params.datasetId]
    );

    const data = JSON.parse(datasetResult.rows[0].raw_data);
    const rules = rulesResult.rows;

    // Run validation
    const validationResults = validateData(data, rules);

    res.json({
      totalRecords: data.length,
      validRecords: validationResults.valid,
      invalidRecords: validationResults.invalid,
      errors: validationResults.errors
    });
  } catch (err) {
    console.error('Validate dataset error:', err);
    res.status(500).json({ error: 'Failed to validate dataset' });
  }
});

function validateData(data: any[], rules: any[]): any {
  let validCount = 0;
  let invalidCount = 0;
  const errors: any[] = [];

  for (const row of data) {
    let isValid = true;

    for (const rule of rules) {
      const ruleDef = typeof rule.rule_definition === 'string' 
        ? JSON.parse(rule.rule_definition) 
        : rule.rule_definition;

      if (rule.rule_type === 'null_check') {
        for (const col of ruleDef.columns) {
          if (row[col] == null || row[col] === '') {
            isValid = false;
            errors.push({ row: data.indexOf(row), column: col, error: 'Null value' });
          }
        }
      }
    }

    if (isValid) validCount++;
    else invalidCount++;
  }

  return {
    valid: validCount,
    invalid: invalidCount,
    errors: errors.slice(0, 20) // Limit to first 20 errors
  };
}

export default router;
