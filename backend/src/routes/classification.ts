/**
 * Classification Routes
 * 
 * API endpoints for the Source Classification system.
 * Part of Phase 1: Intelligent Core Loop
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { classifySource, SourceClassification } from '../services/sourceClassifier.js';

const router = Router();

// Apply auth middleware
router.use(authenticateToken);

/**
 * POST /api/classify-source
 * 
 * Classify uploaded data to determine its type and suggest a workflow.
 * Called immediately after file parsing, before the dataset is saved.
 */
router.post('/classify-source', async (req: AuthRequest, res) => {
    try {
        const { headers, sampleData, useAI } = req.body;

        if (!headers || !Array.isArray(headers)) {
            return res.status(400).json({
                error: 'Headers array is required'
            });
        }

        if (!sampleData || !Array.isArray(sampleData)) {
            return res.status(400).json({
                error: 'Sample data array is required'
            });
        }

        // Classify the source
        const classification = await classifySource(headers, sampleData, {
            useAI: useAI !== false // Default to true
        });

        res.json({
            success: true,
            classification
        });

    } catch (err) {
        console.error('Classification error:', err);
        res.status(500).json({
            error: 'Failed to classify source',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
});

/**
 * PUT /api/workspaces/:workspaceId/datasets/:datasetId/classification
 * 
 * Update or override the classification for a dataset.
 * Called when user confirms or changes the AI's classification.
 */
router.put('/workspaces/:workspaceId/datasets/:datasetId/classification', async (req: AuthRequest, res) => {
    try {
        const { workspaceId, datasetId } = req.params;
        const {
            sourceType,
            suggestedWorkflow,
            userOverride,
            detectedEntities,
            keyInsights,
            classificationReasoning,
            confidence
        } = req.body;

        // Verify ownership
        const ownerCheck = await query(
            `SELECT id FROM datasets 
             WHERE id = $1 AND workspace_id = $2 AND user_id = $3`,
            [datasetId, workspaceId, req.user!.id]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Dataset not found or unauthorized' });
        }

        // Build update query dynamically
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (sourceType) {
            updates.push(`source_type = $${paramIndex++}`);
            params.push(sourceType);
        }
        if (suggestedWorkflow) {
            updates.push(`suggested_workflow = $${paramIndex++}`);
            params.push(suggestedWorkflow);
        }
        if (userOverride !== undefined) {
            updates.push(`user_override_type = $${paramIndex++}`);
            params.push(userOverride);
        }
        if (detectedEntities) {
            updates.push(`detected_entities = $${paramIndex++}`);
            params.push(JSON.stringify(detectedEntities));
        }
        if (keyInsights) {
            updates.push(`key_insights = $${paramIndex++}`);
            params.push(JSON.stringify(keyInsights));
        }
        if (classificationReasoning) {
            updates.push(`classification_reasoning = $${paramIndex++}`);
            params.push(classificationReasoning);
        }
        if (confidence !== undefined) {
            updates.push(`classification_confidence = $${paramIndex++}`);
            params.push(confidence);
        }

        updates.push(`updated_at = NOW()`);

        if (updates.length === 1) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        params.push(datasetId);

        const result = await query(
            `UPDATE datasets SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );

        res.json({
            success: true,
            dataset: result.rows[0]
        });

    } catch (err) {
        console.error('Update classification error:', err);
        res.status(500).json({
            error: 'Failed to update classification',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/workspaces/:workspaceId/datasets/:datasetId/classification
 * 
 * Get the current classification for a dataset.
 */
router.get('/workspaces/:workspaceId/datasets/:datasetId/classification', async (req: AuthRequest, res) => {
    try {
        const { workspaceId, datasetId } = req.params;

        const result = await query(
            `SELECT 
                source_type,
                classification_confidence,
                suggested_workflow,
                detected_entities,
                key_insights,
                classification_reasoning,
                user_override_type,
                current_journey_step,
                journey_progress
             FROM datasets 
             WHERE id = $1 AND workspace_id = $2`,
            [datasetId, workspaceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        const row = result.rows[0];

        res.json({
            success: true,
            classification: {
                sourceType: row.source_type,
                confidence: row.classification_confidence,
                suggestedWorkflow: row.suggested_workflow,
                detectedEntities: row.detected_entities || [],
                keyInsights: row.key_insights || [],
                reasoning: row.classification_reasoning,
                userOverride: row.user_override_type,
                currentJourneyStep: row.current_journey_step,
                journeyProgress: row.journey_progress || {}
            }
        });

    } catch (err) {
        console.error('Get classification error:', err);
        res.status(500).json({
            error: 'Failed to get classification',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
});

/**
 * PUT /api/workspaces/:workspaceId/datasets/:datasetId/journey-progress
 * 
 * Update the journey progress for a dataset.
 * Tracks which steps the user has completed.
 */
router.put('/workspaces/:workspaceId/datasets/:datasetId/journey-progress', async (req: AuthRequest, res) => {
    try {
        const { workspaceId, datasetId } = req.params;
        const { currentStep, progress } = req.body;

        const result = await query(
            `UPDATE datasets 
             SET current_journey_step = $1, 
                 journey_progress = $2,
                 updated_at = NOW()
             WHERE id = $3 AND workspace_id = $4 AND user_id = $5
             RETURNING current_journey_step, journey_progress`,
            [currentStep, JSON.stringify(progress), datasetId, workspaceId, req.user!.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dataset not found or unauthorized' });
        }

        res.json({
            success: true,
            currentStep: result.rows[0].current_journey_step,
            progress: result.rows[0].journey_progress
        });

    } catch (err) {
        console.error('Update journey progress error:', err);
        res.status(500).json({
            error: 'Failed to update journey progress',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
});

export default router;
