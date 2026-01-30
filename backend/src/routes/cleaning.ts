import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import { verifyWorkspaceOwnership } from '../middleware/workspace.js';
import { GroqService } from '../services/groq.service.js';
import { ProCleaningAgent } from '../services/cleaningAgent.js';
import { SafeExecutor } from '../utils/safeExecutor.js';
import { logger } from '../utils/logger.js';
import { validateResource } from '../middleware/validateResource.js';
import { cleaningProcessSchema } from '../schemas/validation.js';

const router = Router();

// Apply auth and subscription middleware
router.use(authenticateToken);
router.use(checkSubscription);
router.use('/:workspaceId', verifyWorkspaceOwnership);

// ==================== RECOVERY SCRIPTS ====================

// List recovery scripts for a dataset
router.get('/:workspaceId/datasets/:datasetId/scripts', async (req: AuthRequest, res) => {
    try {
        const { datasetId, workspaceId } = req.params;
        const includeTemplates = req.query.includeTemplates === 'true';

        let sql = `
      SELECT id, name, description, target_column, category, expression, heal_function, 
             reasoning, is_active, is_template, test_results, created_at, updated_at
      FROM recovery_scripts 
      WHERE (dataset_id = $1 OR (is_template = true AND workspace_id = $2))
    `;

        if (!includeTemplates) {
            sql += ` AND (is_template = false OR dataset_id = $1)`;
        }

        sql += ` ORDER BY created_at DESC`;

        const result = await query(sql, [datasetId, workspaceId]);

        res.json({
            scripts: result.rows,
            count: result.rows.length
        });
    } catch (err) {
        console.error('List recovery scripts error:', err);
        res.status(500).json({ error: 'Failed to list recovery scripts' });
    }
});

// Create a new recovery script
router.post('/:workspaceId/datasets/:datasetId/scripts', async (req: AuthRequest, res) => {
    try {
        const { datasetId, workspaceId } = req.params;
        const { name, description, targetColumn, category, expression, healFunction, reasoning, isTemplate } = req.body;

        if (!name || !expression) {
            return res.status(400).json({ error: 'Name and expression are required' });
        }

        const result = await query(
            `INSERT INTO recovery_scripts 
       (dataset_id, workspace_id, user_id, name, description, target_column, category, expression, heal_function, reasoning, is_template)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
            [datasetId, workspaceId, req.user!.id, name, description || '', targetColumn || '',
                category || 'Recovery', expression, healFunction || '', reasoning || '', isTemplate || false]
        );

        // Log to cleaning history
        await query(
            `INSERT INTO cleaning_history (dataset_id, user_id, action_type, details, rows_affected)
       VALUES ($1, $2, 'script_created', $3, 0)`,
            [datasetId, req.user!.id, JSON.stringify({ scriptId: result.rows[0].id, name })]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create recovery script error:', err);
        res.status(500).json({ error: 'Failed to create recovery script' });
    }
});

// Update a recovery script
router.put('/:workspaceId/datasets/:datasetId/scripts/:scriptId', async (req: AuthRequest, res) => {
    try {
        const { scriptId, datasetId, workspaceId } = req.params;
        const { name, description, targetColumn, category, expression, healFunction, reasoning, isActive, isTemplate } = req.body;

        const result = await query(
            `UPDATE recovery_scripts 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description),
           target_column = COALESCE($3, target_column),
           category = COALESCE($4, category),
           expression = COALESCE($5, expression),
           heal_function = COALESCE($6, heal_function),
           reasoning = COALESCE($7, reasoning),
           is_active = COALESCE($8, is_active),
           is_template = COALESCE($9, is_template),
           updated_at = NOW()
       WHERE id = $10 AND (dataset_id = $11 OR workspace_id = $12)
       RETURNING *`,
            [name, description, targetColumn, category, expression, healFunction, reasoning, isActive, isTemplate,
                scriptId, datasetId, workspaceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Script not found or unauthorized' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update recovery script error:', err);
        res.status(500).json({ error: 'Failed to update recovery script' });
    }
});

// Delete a recovery script
router.delete('/:workspaceId/datasets/:datasetId/scripts/:scriptId', async (req: AuthRequest, res) => {
    try {
        const { scriptId, datasetId, workspaceId } = req.params;

        const result = await query(
            `DELETE FROM recovery_scripts WHERE id = $1 AND (dataset_id = $2 OR workspace_id = $3) RETURNING id, name`,
            [scriptId, datasetId, workspaceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Script not found or unauthorized' });
        }

        // Log deletion
        await query(
            `INSERT INTO cleaning_history (dataset_id, user_id, action_type, details, rows_affected)
       VALUES ($1, $2, 'script_deleted', $3, 0)`,
            [datasetId, req.user!.id, JSON.stringify({ scriptId, name: result.rows[0].name })]
        );

        res.json({ message: 'Script deleted', id: result.rows[0].id });
    } catch (err) {
        console.error('Delete recovery script error:', err);
        res.status(500).json({ error: 'Failed to delete recovery script' });
    }
});

// Test a script on sample data
router.post('/:workspaceId/datasets/:datasetId/scripts/:scriptId/test', async (req: AuthRequest, res) => {
    try {
        const { scriptId, datasetId, workspaceId } = req.params;
        const { sampleSize } = req.body;

        // Get script
        const scriptResult = await query(
            `SELECT * FROM recovery_scripts WHERE id = $1`,
            [scriptId]
        );

        if (scriptResult.rows.length === 0) {
            return res.status(404).json({ error: 'Script not found' });
        }

        const script = scriptResult.rows[0];

        // Get sample data
        const datasetResult = await query(
            `SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2`,
            [datasetId, workspaceId]
        );

        if (datasetResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        const rawDataRaw = datasetResult.rows[0].raw_data;
        const rawData = typeof rawDataRaw === 'string' ? JSON.parse(rawDataRaw) : rawDataRaw;
        const sample = rawData.slice(0, sampleSize || 10);

        // Test the script
        const testResults = {
            totalTested: sample.length,
            passed: 0,
            failed: 0,
            healed: 0,
            errors: [] as any[]
        };

        for (let i = 0; i < sample.length; i++) {
            const row = sample[i];
            try {
                // Test expression
                // Prepare sandboxed scripts
                const checkCode = `(function(value, row, index, fullData) { try { return (${script.expression}); } catch(e) { return true; } })(value, row, index, fullData)`;
                const checkScript = SafeExecutor.compile(checkCode);

                const healCode = script.heal_function
                    ? `(function(value, row, index, fullData) { try { ${script.heal_function} } catch(e) { console.warn('[Cleaning] Heal function error:', e); } })(value, row, index, fullData)`
                    : null;
                const healScript = healCode ? SafeExecutor.compile(healCode) : null;

                // Execute check
                let isValid = true;
                if (checkScript) {
                    const res = SafeExecutor.executeScript(checkScript, { value: row[script.target_column], row, index: i, fullData: sample });
                    // Explicitly check for boolean false to fail validation
                    if (res.success && res.result === false) {
                        isValid = false;
                    }
                }

                if (isValid) {
                    testResults.passed++;
                } else {
                    testResults.failed++;

                    // Try heal function if available
                    if (script.heal_function && healScript) {
                        try {
                            const originalValue = row[script.target_column];
                            SafeExecutor.executeScript(healScript, { value: row[script.target_column], row, index: i, fullData: sample });
                            if (row[script.target_column] !== originalValue) {
                                testResults.healed++;
                            }
                        } catch (healErr) {
                            testResults.errors.push({ row: i, error: 'Heal function error', details: String(healErr) });
                        }
                    }
                }
            } catch (testErr) {
                testResults.errors.push({ row: i, error: 'Expression error', details: String(testErr) });
            }
        }

        // Save test results
        await query(
            `UPDATE recovery_scripts SET test_results = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(testResults), scriptId]
        );

        res.json(testResults);
    } catch (err) {
        console.error('Test script error:', err);
        res.status(500).json({ error: 'Failed to test script' });
    }
});

// Generate a recovery script using AI
router.post('/:workspaceId/datasets/:datasetId/scripts/generate', async (req: AuthRequest, res) => {
    try {
        const { datasetId, workspaceId } = req.params;
        const { description, targetColumn, category } = req.body;

        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }

        // Get dataset sample
        const datasetResult = await query(
            `SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2`,
            [datasetId, workspaceId]
        );

        if (datasetResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        const rawDataRaw = datasetResult.rows[0].raw_data;
        const rawData = typeof rawDataRaw === 'string' ? JSON.parse(rawDataRaw) : rawDataRaw;
        const headers = Object.keys(rawData[0] || {});
        const sample = rawData.slice(0, 5);

        // Generate logic using AI
        const generatedLogic = await GroqService.generateLogicFromDescription(
            { headers, data: sample },
            category || 'Recovery',
            description
        );

        res.json({
            name: description.substring(0, 50),
            description: description,
            targetColumn: targetColumn || headers[0],
            category: category || 'Recovery',
            expression: generatedLogic.expression,
            healFunction: generatedLogic.healFunction || '',
            reasoning: generatedLogic.reasoning || `AI-generated rule for: ${description}`
        });
    } catch (err) {
        console.error('Generate script error:', err);
        res.status(500).json({ error: 'Failed to generate script' });
    }
});

// ==================== PRO CLEANING AGENT ====================

// Deep analyze dataset using Pro Agent
router.post('/:workspaceId/datasets/:datasetId/analyze-pro', async (req: AuthRequest, res) => {
    try {
        const { datasetId, workspaceId } = req.params;

        // Get dataset data
        const datasetResult = await query(
            `SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2`,
            [datasetId, workspaceId]
        );

        if (datasetResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        const rawDataRaw = datasetResult.rows[0].raw_data;
        const rawData = typeof rawDataRaw === 'string' ? JSON.parse(rawDataRaw) : rawDataRaw;
        const headers = Object.keys(rawData[0] || {});

        // Run Pro Agent Analysis
        const analysis = await ProCleaningAgent.analyze(headers, rawData);

        res.json(analysis);
    } catch (err) {
        console.error('Pro Analyze error:', err);
        res.status(500).json({ error: 'Failed to run Pro Analysis' });
    }
});

// Apply a specific suggested fix rule
router.post('/:workspaceId/datasets/:datasetId/apply-suggested-fix', async (req: AuthRequest, res) => {
    try {
        const { datasetId, workspaceId } = req.params;
        const { rule } = req.body;

        if (!rule) {
            return res.status(400).json({ error: 'Rule is required' });
        }

        // Get current data
        const datasetResult = await query(
            `SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2`,
            [datasetId, workspaceId]
        );

        if (datasetResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        const rawDataRaw = datasetResult.rows[0].raw_data;
        const rawData = typeof rawDataRaw === 'string' ? JSON.parse(rawDataRaw) : rawDataRaw;
        const headers = Object.keys(rawData[0] || {});

        // Apply fix via Agent
        const { data: newData, headers: newHeaders, affected } = await ProCleaningAgent.applyFix(rawData, rule, headers);

        // Update dataset with new cleaned data and headers
        await query(
            `UPDATE datasets SET raw_data = $1, headers = $2, updated_at = NOW() WHERE id = $3`,
            [JSON.stringify(newData), JSON.stringify(newHeaders), datasetId]
        );

        // Log to history
        await query(
            `INSERT INTO cleaning_history (dataset_id, user_id, action_type, details, rows_affected)
             VALUES ($1, $2, 'fix_applied', $3, $4)`,
            [datasetId, req.user!.id, JSON.stringify({ rule: rule.description, category: rule.category }), affected]
        );

        res.json({
            message: 'Fix applied successfully',
            rowsAffected: affected,
            newData: newData.slice(0, 100) // Return sample for UI update
        });
    } catch (err) {
        console.error('Apply fix error:', err);
        res.status(500).json({ error: 'Failed to apply fix' });
    }
});

// Chat with Pro Cleaning Agent
router.post('/:workspaceId/datasets/:datasetId/chat', async (req: AuthRequest, res) => {
    try {
        const { datasetId, workspaceId } = req.params;
        const { message, context } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get dataset sample
        const datasetResult = await query(
            `SELECT raw_data FROM datasets WHERE id = $1 AND workspace_id = $2`,
            [datasetId, workspaceId]
        );

        if (datasetResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        const rawDataRaw = datasetResult.rows[0].raw_data;
        const rawData = typeof rawDataRaw === 'string' ? JSON.parse(rawDataRaw) : rawDataRaw;
        const headers = Object.keys(rawData[0] || {});
        const sample = rawData.slice(0, 20); // First 20 rows context

        // Generate response
        const prompt = `You are the "Pro Data Cleaning Agent" for this dataset.
User Question: "${message}"

Dataset Context:
Headers: ${headers.join(', ')}
Sample Data: ${JSON.stringify(sample)}
Previous Analysis Context: ${JSON.stringify(context || {})}

Answer the user briefly and professionally. If they ask about data quality, cite specific columns. If they ask for a fix, explain the logic you would use (valid JavaScript).`;

        const reply = await GroqService.callGroq(prompt, 1000);

        res.json({ reply });
    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ error: 'Failed to generate chat response' });
    }
});

// ==================== CLEANING OPERATIONS ====================

// Save cleaned data (without overwriting original)
router.put('/:workspaceId/datasets/:datasetId/cleaned', async (req: AuthRequest, res) => {
    try {
        const { datasetId, workspaceId } = req.params;
        const { cleanedData, quarantinedData, healthScore, cleaningSummary } = req.body;

        if (!cleanedData || !Array.isArray(cleanedData)) {
            return res.status(400).json({ error: 'cleanedData array is required' });
        }

        // Resolve workspace ID (handle 'default' or numeric string)
        let resolvedWorkspaceId: number | null = null;
        if (workspaceId === 'default') {
            // Find user's first/default workspace
            if (req.user?.id) {
                const wsResult = await query(`SELECT id FROM workspaces WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`, [req.user.id]);
                if (wsResult.rows.length > 0) {
                    resolvedWorkspaceId = wsResult.rows[0].id;
                }
            }
        } else {
            resolvedWorkspaceId = parseInt(workspaceId, 10) || null;
        }

        // Get current state for comparison - use dataset_id primarily (it's unique)
        const currentResult = await query(
            `SELECT health_score, workspace_id FROM datasets WHERE id = $1`,
            [datasetId]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        const previousHealthScore = currentResult.rows[0].health_score || 100;
        const actualWorkspaceId = currentResult.rows[0].workspace_id;

        // Try to update with all columns, fallback if columns don't exist
        let updateSuccess = false;

        // Try full update first (with all cleaning columns)
        try {
            await query(
                `UPDATE datasets 
           SET cleaned_data = $1, 
               quarantined_data = $2,
               health_score = $3,
               cleaning_summary = $4,
               cleaning_confirmed = false,
               updated_at = NOW()
           WHERE id = $5`,
                [JSON.stringify(cleanedData), JSON.stringify(quarantinedData || []),
                healthScore || 100, JSON.stringify(cleaningSummary || {}), datasetId]
            );
            updateSuccess = true;
        } catch (updateError: any) {
            // If columns don't exist, try updating just raw_data
            console.warn('Full update failed, trying fallback:', updateError.message);
            try {
                await query(
                    `UPDATE datasets 
               SET raw_data = $1,
                   updated_at = NOW()
               WHERE id = $2`,
                    [cleanedData.map(row => Object.values(row)), datasetId]
                );
                updateSuccess = true;
            } catch (fallbackError) {
                console.error('Fallback update also failed:', fallbackError);
                throw fallbackError;
            }
        }

        if (!updateSuccess) {
            throw new Error('Failed to update dataset');
        }

        // Log to cleaning history (optional - skip if table doesn't exist or user not authenticated)
        try {
            if (req.user?.id) {
                await query(
                    `INSERT INTO cleaning_history (dataset_id, user_id, action_type, details, rows_affected, health_score_before, health_score_after)
           VALUES ($1, $2, 'cleaned', $3, $4, $5, $6)`,
                    [datasetId, req.user.id, JSON.stringify(cleaningSummary || {}),
                        cleanedData.length, previousHealthScore, healthScore || 100]
                );
            }
        } catch (historyError) {
            // Log error but don't fail the request
            console.warn('Failed to log cleaning history:', historyError);
        }

        res.json({
            message: 'Cleaned data saved',
            cleanedRows: cleanedData.length,
            quarantinedRows: (quarantinedData || []).length,
            healthScore: healthScore || 100
        });
    } catch (err: any) {
        console.error('Save cleaned data error:', err);
        res.status(500).json({
            error: 'Failed to save cleaned data',
            details: err.message || JSON.stringify(err)
        });
    }
});

// Confirm cleaning - overwrite original with cleaned data
router.post('/:workspaceId/datasets/:datasetId/confirm-clean', async (req: AuthRequest, res) => {
    try {
        const { datasetId, workspaceId } = req.params;
        const { keepQuarantined } = req.body;

        // Get dataset
        const datasetResult = await query(
            `SELECT raw_data, cleaned_data, quarantined_data, health_score, cleaning_confirmed FROM datasets 
       WHERE id = $1 AND workspace_id = $2`,
            [datasetId, workspaceId]
        );

        if (datasetResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        const dataset = datasetResult.rows[0];

        let cleanedData;
        let originalData;

        // SCENARIO 1: Server-side staging (Standard)
        if (dataset.cleaned_data) {
            cleanedData = typeof dataset.cleaned_data === 'string'
                ? JSON.parse(dataset.cleaned_data)
                : dataset.cleaned_data;

            originalData = typeof dataset.raw_data === 'string'
                ? JSON.parse(dataset.raw_data)
                : dataset.raw_data;

            // Overwrite raw_data with cleaned_data
            await query(
                `UPDATE datasets 
           SET raw_data = cleaned_data,
               row_count = $1,
               cleaning_confirmed = true,
               updated_at = NOW()
           WHERE id = $2`,
                [cleanedData.length, datasetId]
            );
        }
        // SCENARIO 2: Client-side direct cleaning (UniverCleanView)
        // The client ALREADY updated raw_data via PUT, so we just need to log it and cleanup
        else if (dataset.cleaning_confirmed) {
            console.log('[ConfirmClean] Cleaning already confirmed via PUT. Finalizing logs.');
            // Treat current raw_data as the "cleaned" outcome
            cleanedData = typeof dataset.raw_data === 'string'
                ? JSON.parse(dataset.raw_data)
                : dataset.raw_data;

            // We don't have the "original" original anymore if it was overwritten, 
            // but we can estimate or just log the current state.
            originalData = cleanedData;
        } else {
            return res.status(400).json({ error: 'No cleaned data to confirm. Run cleaning first.' });
        }

        // If not keeping quarantined, clear it
        if (!keepQuarantined) {
            await query(
                `UPDATE datasets SET quarantined_data = NULL WHERE id = $1`,
                [datasetId]
            );
        }

        // Log to cleaning history (if not duplicate?)
        // We'll log it anyway to track the "Confirmation" event
        await query(
            `INSERT INTO cleaning_history (dataset_id, user_id, action_type, details, rows_affected, health_score_before, health_score_after)
       VALUES ($1, $2, 'confirmed', $3, $4, $5, $6)`,
            [datasetId, req.user!.id,
                JSON.stringify({
                    mode: dataset.cleaned_data ? 'staged' : 'direct',
                    finalRows: cleanedData.length,
                    quarantinedRows: dataset.quarantined_data ? (typeof dataset.quarantined_data === 'string' ? JSON.parse(dataset.quarantined_data).length : dataset.quarantined_data.length) : 0
                }),
                cleanedData.length, 0, dataset.health_score || 100]
        );

        res.json({
            message: 'Cleaning confirmed successfully.',
            newRowCount: cleanedData.length,
            confirmed: true
        });
    } catch (err) {
        console.error('Confirm cleaning error:', err);
        res.status(500).json({ error: 'Failed to confirm cleaning' });
    }
});

// Revert to original data
router.post('/:workspaceId/datasets/:datasetId/revert-clean', async (req: AuthRequest, res) => {
    try {
        const { datasetId, workspaceId } = req.params;

        // Clear cleaned data and reset flags
        await query(
            `UPDATE datasets 
       SET cleaned_data = NULL,
           quarantined_data = NULL,
           cleaning_confirmed = false,
           health_score = 100,
           cleaning_summary = NULL,
           updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2`,
            [datasetId, workspaceId]
        );

        // Log to cleaning history
        await query(
            `INSERT INTO cleaning_history (dataset_id, user_id, action_type, details, rows_affected)
       VALUES ($1, $2, 'reverted', '{"reason": "User reverted to original data"}', 0)`,
            [datasetId, req.user!.id]
        );

        res.json({ message: 'Reverted to original data' });
    } catch (err) {
        console.error('Revert cleaning error:', err);
        res.status(500).json({ error: 'Failed to revert cleaning' });
    }
});

// Get cleaning history
router.get('/:workspaceId/datasets/:datasetId/cleaning-history', async (req: AuthRequest, res) => {
    try {
        const { datasetId } = req.params;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const offset = parseInt(req.query.offset as string) || 0;

        const result = await query(
            `SELECT ch.*, u.name as user_name, u.email as user_email
       FROM cleaning_history ch
       LEFT JOIN users u ON ch.user_id = u.id
       WHERE ch.dataset_id = $1
       ORDER BY ch.created_at DESC
       LIMIT $2 OFFSET $3`,
            [datasetId, limit, offset]
        );

        const countResult = await query(
            `SELECT COUNT(*) as total FROM cleaning_history WHERE dataset_id = $1`,
            [datasetId]
        );

        res.json({
            history: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset
        });
    } catch (err) {
        console.error('Get cleaning history error:', err);
        res.status(500).json({ error: 'Failed to get cleaning history' });
    }
});

export default router;
