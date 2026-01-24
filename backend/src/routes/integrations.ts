import { Router } from 'express';
import { integrationService } from '../services/integrationService.js';
import { integrationHealthService } from '../services/integrationHealthService.js';
import knex from 'knex';
import knexConfig from '../../knexfile.js';

const db = knex(knexConfig.production || knexConfig.development);
const router = Router();

import { integrationAnalyticsService } from '../services/integrationAnalyticsService.js';

// Get sync throughput analytics
router.get('/analytics/throughput', async (req: any, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'Workspace ID required' });
        const throughput = await integrationAnalyticsService.getWorkspaceThroughput(workspaceId.toString(), db);
        res.json(throughput);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Create new integration
router.post('/', async (req: any, res) => {
    try {
        const { provider, name, credentials, workspaceId } = req.body;
        const userId = req.user.id;

        if (!provider || !name || !credentials || !workspaceId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const id = await integrationService.createIntegration(userId, workspaceId, {
            provider,
            name,
            credentials
        }, db);

        res.status(201).json({ id, message: 'Integration created successfully' });
    } catch (error: any) {
        console.error('Create Integration Error:', error);
        res.status(500).json({ message: error.message || 'Failed to create integration' });
    }
});

// List integrations
router.get('/', async (req: any, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'Workspace ID required' });

        const list = await integrationService.listIntegrations(workspaceId.toString(), db);
        res.json(list);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to list integrations' });
    }
});

// Health check for specific integration
router.get('/:id/health', async (req: any, res) => {
    try {
        const status = await integrationHealthService.checkHealth(req.params.id, db);
        res.json(status);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Health summary for all integrations in workspace
router.get('/health-summary', async (req: any, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'Workspace ID required' });
        const summary = await integrationHealthService.getSystemHealthSummary(workspaceId.toString(), db);
        res.json(summary);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Delete integration
router.delete('/:id', async (req: any, res) => {
    try {
        await db('integrations').where({ id: req.params.id }).delete();
        res.json({ message: 'Integration deleted' });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to delete integration' });
    }
});

export default router;
