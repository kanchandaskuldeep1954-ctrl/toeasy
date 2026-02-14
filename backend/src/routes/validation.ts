import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import { GroqService } from '../services/groq.service.js';
import { verifyWorkspaceOwnership } from '../middleware/workspace.js';

const router = Router();
const groqService = new GroqService();

const safeParseJson = (value: any) => {
  if (value == null) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

// Apply auth and subscription middleware
router.use(authenticateToken);
router.use(checkSubscription);
router.use('/:workspaceId', verifyWorkspaceOwnership);

// List validation rules for dataset (with pagination)
router.get('/:workspaceId/datasets/:datasetId/rules', async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500); // Max 500
    const offset = parseInt(req.query.offset as string) || 0;

    const datasetCheck = await query(
      `SELECT id FROM datasets WHERE id = $1 AND workspace_id = $2`,
      [req.params.datasetId, req.params.workspaceId]
    );
    if (datasetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

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
      rule_definition: safeParseJson(r.rule_definition)
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

    const datasetCheck = await query(
      `SELECT id FROM datasets WHERE id = $1 AND workspace_id = $2`,
      [req.params.datasetId, req.params.workspaceId]
    );
    if (datasetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
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
      rule_definition: safeParseJson(rule.rule_definition)
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

    const datasetCheck = await query(
      `SELECT id FROM datasets WHERE id = $1 AND workspace_id = $2`,
      [req.params.datasetId, req.params.workspaceId]
    );
    if (datasetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

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
      rule_definition: safeParseJson(rule.rule_definition)
    });
  } catch (err) {
    console.error('Update validation rule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete validation rule
router.delete('/:workspaceId/datasets/:datasetId/rules/:ruleId', async (req: AuthRequest, res) => {
  try {
    const datasetCheck = await query(
      `SELECT id FROM datasets WHERE id = $1 AND workspace_id = $2`,
      [req.params.datasetId, req.params.workspaceId]
    );
    if (datasetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

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
    const datasetResult = await query(
      'SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2',
      [req.params.datasetId, req.params.workspaceId]
    );

    if (datasetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const data = JSON.parse(datasetResult.rows[0].raw_data);
    const headers = Object.keys(data[0] || {});
    // Construct a minimal dataset object for the service
    const datasetObj = { headers, data: data.slice(0, 50) }; // Send sample

    const semanticContext = req.body.semanticContext || '';
    const suggestedRules = await GroqService.suggestValidationRules(datasetObj, semanticContext);

    res.json(suggestedRules);
  } catch (err) {
    console.error('Suggest rules error:', err);
    res.status(500).json({ error: 'Failed to suggest validation rules' });
  }
});

// Deep Semantic Analysis
router.post('/:workspaceId/datasets/:datasetId/analyze', async (req: AuthRequest, res) => {
  try {
    const datasetResult = await query(
      'SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2',
      [req.params.datasetId, req.params.workspaceId]
    );

    if (datasetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const data = JSON.parse(datasetResult.rows[0].raw_data);
    const headers = Object.keys(data[0] || {});

    const analysis = await GroqService.analyzeDatasetSemantics({ headers, data });
    res.json(analysis);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Failed to analyze dataset' });
  }
});

// Generate Logic from NL
router.post('/:workspaceId/datasets/:datasetId/rules/generate-logic', async (req: AuthRequest, res) => {
  try {
    const { description, category } = req.body;
    const datasetResult = await query(
      'SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2',
      [req.params.datasetId, req.params.workspaceId]
    );
    const data = JSON.parse(datasetResult.rows[0].raw_data);
    const headers = Object.keys(data[0] || {});

    const logic = await GroqService.generateLogicFromDescription({ headers, data: data.slice(0, 5) }, category, description);
    res.json(logic);
  } catch (err) {
    console.error('Logic generation error:', err);
    res.status(500).json({ error: 'Failed to generate logic' });
  }
});

// Consult Agent
router.post('/:workspaceId/datasets/:datasetId/consult-agent', async (req: AuthRequest, res) => {
  try {
    const { query: agentQuery, context } = req.body;
    const datasetResult = await query(
      'SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2',
      [req.params.datasetId, req.params.workspaceId]
    );
    const data = JSON.parse(datasetResult.rows[0].raw_data);

    const answer = await GroqService.consultAgent({
      headers: Object.keys(data[0] || {}),
      data: data.slice(0, 50)
    }, agentQuery, context);

    res.json({ answer });
  } catch (err) {
    console.error('Agent consultation error:', err);
    res.status(500).json({ error: 'Failed to consult agent' });
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
  const errors: Array<{ row: number; column?: string; error: string; ruleId?: any }> = [];

  const parsedRules = (rules || []).map((r) => ({
    ...r,
    _type: String((r as any).rule_type || (r as any).ruleType || '').trim(),
    _def: typeof (r as any).rule_definition === 'string' ? safeParseJson((r as any).rule_definition) : ((r as any).rule_definition || {})
  }));

  // Precompute uniqueness violations to avoid O(n^2).
  const uniqueRules = parsedRules.filter((r: any) => r._type === 'unique');
  const uniqueCounts: Array<{ ruleId: any; field: string; counts: Map<string, number> }> = uniqueRules.map((r: any) => {
    const def = r._def || {};
    const field = String(def.field || def.column || '').trim();
    return { ruleId: r.id, field, counts: new Map<string, number>() };
  }).filter((u) => !!u.field);

  if (uniqueCounts.length > 0) {
    for (const row of data) {
      for (const u of uniqueCounts) {
        const raw = row?.[u.field];
        if (raw == null || raw === '') continue;
        const key = String(raw);
        u.counts.set(key, (u.counts.get(key) || 0) + 1);
      }
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    let isValid = true;

    for (const rule of parsedRules as any[]) {
      const type = rule._type;
      const def = rule._def || {};

      // null_check / not_null
      if (type === 'null_check' || type === 'not_null') {
        const columns = Array.isArray(def.columns) ? def.columns : (def.field ? [def.field] : []);
        for (const col of columns) {
          const column = String(col);
          if (row?.[column] == null || row?.[column] === '') {
            isValid = false;
            errors.push({ row: rowIndex, column, error: 'Null value', ruleId: rule.id });
            if (errors.length >= 20) break;
          }
        }
      }

      // pattern (regex)
      if (type === 'pattern') {
        const field = String(def.field || '').trim();
        const pattern = String(def.pattern || '').trim();
        if (!field || !pattern) continue;

        const raw = row?.[field];
        if (raw == null || raw === '') continue;

        let re: RegExp | null = null;
        try {
          re = new RegExp(pattern);
        } catch {
          // Invalid regex; ignore instead of failing validation globally.
          continue;
        }

        if (!re.test(String(raw))) {
          isValid = false;
          errors.push({ row: rowIndex, column: field, error: 'Pattern mismatch', ruleId: rule.id });
        }
      }

      // range (numeric)
      if (type === 'range') {
        const field = String(def.field || '').trim();
        if (!field) continue;
        const raw = row?.[field];
        if (raw == null || raw === '') continue;

        const value = Number(raw);
        if (Number.isNaN(value)) {
          isValid = false;
          errors.push({ row: rowIndex, column: field, error: 'Not a number', ruleId: rule.id });
        } else {
          const hasMin = def.min !== undefined && def.min !== null && def.min !== '';
          const hasMax = def.max !== undefined && def.max !== null && def.max !== '';
          const min = hasMin ? Number(def.min) : null;
          const max = hasMax ? Number(def.max) : null;

          if (min !== null && !Number.isNaN(min) && value < min) {
            isValid = false;
            errors.push({ row: rowIndex, column: field, error: `Below minimum (${min})`, ruleId: rule.id });
          }
          if (max !== null && !Number.isNaN(max) && value > max) {
            isValid = false;
            errors.push({ row: rowIndex, column: field, error: `Above maximum (${max})`, ruleId: rule.id });
          }
        }
      }

      // unique (per-field duplicates)
      if (type === 'unique') {
        const field = String(def.field || def.column || '').trim();
        if (!field) continue;
        const raw = row?.[field];
        if (raw == null || raw === '') continue;

        const u = uniqueCounts.find((u) => u.ruleId === rule.id);
        if (!u) continue;
        const count = u.counts.get(String(raw)) || 0;
        if (count > 1) {
          isValid = false;
          errors.push({ row: rowIndex, column: field, error: 'Duplicate value', ruleId: rule.id });
        }
      }

      // format (email/date)
      if (type === 'format') {
        const field = String(def.field || '').trim();
        if (!field) continue;
        const raw = row?.[field];
        if (raw == null || raw === '') continue;

        const requested = String(def.format || 'auto').toLowerCase();
        const inferred = requested === 'auto'
          ? (/email/i.test(field) ? 'email' : (/date|_at|timestamp/i.test(field) ? 'date' : 'email'))
          : requested;

        if (inferred === 'email') {
          if (!emailRegex.test(String(raw))) {
            isValid = false;
            errors.push({ row: rowIndex, column: field, error: 'Invalid email format', ruleId: rule.id });
          }
        } else if (inferred === 'date') {
          const t = Date.parse(String(raw));
          if (Number.isNaN(t)) {
            isValid = false;
            errors.push({ row: rowIndex, column: field, error: 'Invalid date format', ruleId: rule.id });
          }
        }
      }

      if (errors.length >= 20) break;
    }

    if (isValid) validCount++;
    else invalidCount++;

    if (errors.length >= 20) break;
  }

  return { valid: validCount, invalid: invalidCount, errors: errors.slice(0, 20) };
}

export default router;
