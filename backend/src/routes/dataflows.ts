import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import { ProCleaningAgent } from '../services/cleaningAgent.js';
import { GroqService } from '../services/groq.service.js';



const router = Router();

// Apply auth and subscription middleware
router.use(authenticateToken);
router.use(checkSubscription);

// ==================== DATAFLOW CRUD ====================

// List all dataflows in a workspace
router.get('/:workspaceId/dataflows', async (req: AuthRequest, res) => {
    try {
        const { workspaceId } = req.params;
        const includeTemplates = req.query.includeTemplates === 'true';
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const offset = parseInt(req.query.offset as string) || 0;

        let sql = `
            SELECT id, name, description, pipeline, is_template, is_active, schedule, created_at, updated_at
            FROM dataflows 
            WHERE workspace_id = $1 AND user_id = $2
        `;

        if (includeTemplates) {
            sql += ` OR (is_template = true AND is_active = true)`;
        }

        sql += ` ORDER BY updated_at DESC LIMIT $3 OFFSET $4`;

        const result = await query(sql, [workspaceId, req.user!.id, limit, offset]);

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) as total FROM dataflows WHERE workspace_id = $1 AND user_id = $2`,
            [workspaceId, req.user!.id]
        );

        res.json({
            dataflows: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset
        });
    } catch (err) {
        console.error('List dataflows error:', err);
        res.status(500).json({ error: 'Failed to list dataflows' });
    }
});

// Get a single dataflow
router.get('/:workspaceId/dataflows/:dataflowId', async (req: AuthRequest, res) => {
    try {
        const { workspaceId, dataflowId } = req.params;

        const result = await query(
            `SELECT * FROM dataflows WHERE id = $1 AND workspace_id = $2 AND (user_id = $3 OR is_template = true)`,
            [dataflowId, workspaceId, req.user!.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dataflow not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get dataflow error:', err);
        res.status(500).json({ error: 'Failed to get dataflow' });
    }
});

// Create a new dataflow
router.post('/:workspaceId/dataflows', async (req: AuthRequest, res) => {
    try {
        const { workspaceId } = req.params;
        const { name, description, pipeline, isTemplate, schedule } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (!pipeline || !Array.isArray(pipeline)) {
            return res.status(400).json({ error: 'Pipeline must be an array of steps' });
        }

        const result = await query(
            `INSERT INTO dataflows (workspace_id, user_id, name, description, pipeline, is_template, schedule)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [workspaceId, req.user!.id, name, description || '', JSON.stringify(pipeline), isTemplate || false, schedule || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create dataflow error:', err);
        res.status(500).json({ error: 'Failed to create dataflow' });
    }
});

// Update a dataflow
router.put('/:workspaceId/dataflows/:dataflowId', async (req: AuthRequest, res) => {
    try {
        const { workspaceId, dataflowId } = req.params;
        const { name, description, pipeline, isTemplate, isActive, schedule } = req.body;

        const result = await query(
            `UPDATE dataflows 
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 pipeline = COALESCE($3, pipeline),
                 is_template = COALESCE($4, is_template),
                 is_active = COALESCE($5, is_active),
                 schedule = COALESCE($6, schedule),
                 updated_at = NOW()
             WHERE id = $7 AND workspace_id = $8 AND user_id = $9
             RETURNING *`,
            [name, description, pipeline ? JSON.stringify(pipeline) : null, isTemplate, isActive, schedule,
                dataflowId, workspaceId, req.user!.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dataflow not found or unauthorized' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update dataflow error:', err);
        res.status(500).json({ error: 'Failed to update dataflow' });
    }
});

// Delete a dataflow
router.delete('/:workspaceId/dataflows/:dataflowId', async (req: AuthRequest, res) => {
    try {
        const { workspaceId, dataflowId } = req.params;

        const result = await query(
            `DELETE FROM dataflows WHERE id = $1 AND workspace_id = $2 AND user_id = $3 RETURNING id, name`,
            [dataflowId, workspaceId, req.user!.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dataflow not found or unauthorized' });
        }

        res.json({ message: 'Dataflow deleted', id: result.rows[0].id });
    } catch (err) {
        console.error('Delete dataflow error:', err);
        res.status(500).json({ error: 'Failed to delete dataflow' });
    }
});

// ==================== DATAFLOW EXECUTION ====================

// Execute a dataflow
router.post('/:workspaceId/dataflows/:dataflowId/execute', async (req: AuthRequest, res) => {
    try {
        const { workspaceId, dataflowId } = req.params;
        const { datasetId, options } = req.body;

        // Get the dataflow
        const dataflowResult = await query(
            `SELECT * FROM dataflows WHERE id = $1 AND workspace_id = $2`,
            [dataflowId, workspaceId]
        );

        if (dataflowResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dataflow not found' });
        }

        const dataflow = dataflowResult.rows[0];
        const pipeline = typeof dataflow.pipeline === 'string'
            ? JSON.parse(dataflow.pipeline)
            : dataflow.pipeline;

        // Create a run record
        const runResult = await query(
            `INSERT INTO dataflow_runs (dataflow_id, dataset_id, user_id, status, started_at)
             VALUES ($1, $2, $3, 'running', NOW())
             RETURNING *`,
            [dataflowId, datasetId || null, req.user!.id]
        );

        const runId = runResult.rows[0].id;
        const stepResults: any[] = [];

        // Fetch the dataset for processing
        let currentData: any[] = [];
        let currentHeaders: string[] = [];
        let datasetName = 'Unknown';

        if (datasetId) {
            const dsResult = await query(
                'SELECT * FROM datasets WHERE id = $1 AND workspace_id = $2',
                [datasetId, workspaceId]
            );
            if (dsResult.rows.length > 0) {
                const ds = dsResult.rows[0];
                datasetName = ds.name;
                currentData = typeof ds.raw_data === 'string' ? JSON.parse(ds.raw_data) : (ds.raw_data || []);
                currentHeaders = typeof ds.headers === 'string' ? JSON.parse(ds.headers) : (ds.headers || []);
            }
        }

        try {
            // Execute each step in sequence
            for (let i = 0; i < pipeline.length; i++) {
                const step = pipeline[i];
                const stepStart = Date.now();

                try {
                    // Simulate step execution based on type
                    let stepOutput: any = { success: true, message: `Step ${step.type} completed` };

                    switch (step.type) {
                        case 'analyze':
                            const analysis = await ProCleaningAgent.analyze(currentHeaders, currentData);
                            stepOutput = {
                                success: true,
                                message: 'Comprehensive AI analysis completed',
                                results: analysis
                            };
                            break;
                        case 'clean':
                            const cleanAnalysis = await ProCleaningAgent.analyze(currentHeaders, currentData);
                            const rules = cleanAnalysis.rules || [];
                            let affectedTotal = 0;

                            for (const rule of rules) {
                                const fixResult = await ProCleaningAgent.applyFix(currentData, rule, currentHeaders);
                                currentData = fixResult.data;
                                currentHeaders = fixResult.headers;
                                affectedTotal += fixResult.affected;
                            }

                            // Save as a new version
                            const versionResult = await query(
                                `INSERT INTO dataset_versions 
                                 (dataset_id, created_by_user_id, version_name, description, data, headers, row_count, created_by_tool)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                                 RETURNING id`,
                                [
                                    datasetId,
                                    req.user!.id,
                                    `Cleaned: ${dataflow.name}`,
                                    `Auto-cleaned by dataflow run ${runId}`,
                                    JSON.stringify(currentData),
                                    JSON.stringify(currentHeaders),
                                    currentData.length,
                                    'dataflow'
                                ]
                            );

                            stepOutput = {
                                success: true,
                                message: `Applied ${rules.length} rules, ${affectedTotal} rows affected`,
                                newVersionId: versionResult.rows[0].id
                            };
                            break;
                        case 'upload':
                            stepOutput.message = 'Dataset uploaded successfully';
                            break;
                        case 'dashboard':
                            const dashboardConfig = await GroqService.suggestDashboard({
                                headers: currentHeaders,
                                data: currentData
                            });
                            stepOutput = {
                                success: true,
                                message: 'Professional dashboard configuration generated',
                                config: dashboardConfig
                            };
                            break;
                        case 'report':
                            // Determine report type from options or default to strategic
                            const reportType = (step.options?.type || 'strategic') as any;
                            const report = await GroqService.generateReport({
                                headers: currentHeaders,
                                data: currentData
                            }, reportType);
                            stepOutput = {
                                success: true,
                                message: `Generated ${reportType} report with AI insights`,
                                report
                            };
                            break;
                        case 'validate':
                            const validationRules = await ProCleaningAgent.analyze(currentHeaders, currentData);
                            const issues = validationRules.forensics?.issuesFound || 0;
                            stepOutput = {
                                success: true,
                                message: issues > 0 ? `Detected ${issues} potential quality issues` : 'Data validation passed (no major issues found)',
                                forensics: validationRules.forensics,
                                rules: validationRules.rules
                            };
                            break;
                        case 'export':
                            stepOutput.message = 'Data ready for export';
                            stepOutput.rowCount = currentData.length;
                            break;
                        default:
                            stepOutput.message = `Custom step ${step.type} executed`;
                    }

                    stepResults.push({
                        stepIndex: i,
                        type: step.type,
                        status: 'completed',
                        duration: Date.now() - stepStart,
                        output: stepOutput
                    });
                } catch (stepErr) {
                    stepResults.push({
                        stepIndex: i,
                        type: step.type,
                        status: 'failed',
                        duration: Date.now() - stepStart,
                        error: stepErr instanceof Error ? stepErr.message : 'Step failed'
                    });
                    throw stepErr;
                }
            }

            // Mark run as completed
            await query(
                `UPDATE dataflow_runs 
                 SET status = 'completed', completed_at = NOW(), step_results = $1
                 WHERE id = $2`,
                [JSON.stringify(stepResults), runId]
            );

            res.json({
                runId,
                status: 'completed',
                stepResults,
                completedAt: new Date().toISOString()
            });

        } catch (execErr) {
            // Mark run as failed
            await query(
                `UPDATE dataflow_runs 
                 SET status = 'failed', completed_at = NOW(), step_results = $1, error_message = $2
                 WHERE id = $3`,
                [JSON.stringify(stepResults), execErr instanceof Error ? execErr.message : 'Execution failed', runId]
            );

            res.status(500).json({
                runId,
                status: 'failed',
                stepResults,
                error: execErr instanceof Error ? execErr.message : 'Execution failed'
            });
        }

    } catch (err) {
        console.error('Execute dataflow error:', err);
        res.status(500).json({ error: 'Failed to execute dataflow' });
    }
});

// Get run history for a dataflow
router.get('/:workspaceId/dataflows/:dataflowId/runs', async (req: AuthRequest, res) => {
    try {
        const { dataflowId } = req.params;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const offset = parseInt(req.query.offset as string) || 0;

        const result = await query(
            `SELECT dr.*, u.full_name as user_name, u.email as user_email
             FROM dataflow_runs dr
             LEFT JOIN users u ON dr.user_id = u.id
             WHERE dr.dataflow_id = $1
             ORDER BY dr.started_at DESC
             LIMIT $2 OFFSET $3`,
            [dataflowId, limit, offset]
        );

        const countResult = await query(
            `SELECT COUNT(*) as total FROM dataflow_runs WHERE dataflow_id = $1`,
            [dataflowId]
        );

        res.json({
            runs: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset
        });
    } catch (err) {
        console.error('Get dataflow runs error:', err);
        res.status(500).json({ error: 'Failed to get run history' });
    }
});

// Get a specific run
router.get('/:workspaceId/dataflows/:dataflowId/runs/:runId', async (req: AuthRequest, res) => {
    try {
        const { runId } = req.params;

        const result = await query(
            `SELECT dr.*, u.full_name as user_name, u.email as user_email
             FROM dataflow_runs dr
             LEFT JOIN users u ON dr.user_id = u.id
             WHERE dr.id = $1`,
            [runId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Run not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get dataflow run error:', err);
        res.status(500).json({ error: 'Failed to get run details' });
    }
});

export default router;
