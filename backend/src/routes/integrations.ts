import { Router } from 'express';
import { integrationService } from '../services/integrationService.js';
import { integrationHealthService } from '../services/integrationHealthService.js';
import db from '../knex.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

import { integrationAnalyticsService } from '../services/integrationAnalyticsService.js';

async function ensureWorkspaceAccess(workspaceId: any, userId: any) {
    if (!workspaceId || !userId) return null;
    return db('workspaces').where({ id: workspaceId, user_id: userId }).first();
}

// Get sync throughput analytics
router.get('/analytics/throughput', async (req: AuthRequest, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'Workspace ID required' });

        const ws = await ensureWorkspaceAccess(workspaceId, req.user!.id);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        const throughput = await integrationAnalyticsService.getWorkspaceThroughput(workspaceId.toString(), db);
        res.json(throughput);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Create new integration
router.post('/', async (req: AuthRequest, res) => {
    try {
        const { provider, name, credentials, workspaceId } = req.body;
        const userId = Number(req.user!.id);

        if (!provider || !name || !credentials || !workspaceId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const ws = await ensureWorkspaceAccess(workspaceId, req.user!.id);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

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
router.get('/', async (req: AuthRequest, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'Workspace ID required' });

        const ws = await ensureWorkspaceAccess(workspaceId, req.user!.id);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        const list = await integrationService.listIntegrations(workspaceId.toString(), Number(req.user!.id), db);
        res.json(list);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to list integrations' });
    }
});

// Health check for specific integration
router.get('/:id/health', async (req: AuthRequest, res) => {
    try {
        const integration = await db('integrations')
            .where({ id: req.params.id, user_id: req.user!.id })
            .first();
        if (!integration) return res.status(404).json({ message: 'Integration not found' });

        const status = await integrationHealthService.checkHealth(req.params.id, Number(req.user!.id), db);
        res.json(status);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Health summary for all integrations in workspace
router.get('/health-summary', async (req: AuthRequest, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'Workspace ID required' });

        const ws = await ensureWorkspaceAccess(workspaceId, req.user!.id);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        const summary = await integrationHealthService.getSystemHealthSummaryForUser(workspaceId.toString(), Number(req.user!.id), db);
        res.json(summary);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Delete integration
router.delete('/:id', async (req: AuthRequest, res) => {
    try {
        const deleted = await db('integrations')
            .where({ id: req.params.id, user_id: req.user!.id })
            .delete();

        if (!deleted) return res.status(404).json({ message: 'Integration not found' });

        res.json({ message: 'Integration deleted' });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to delete integration' });
    }
});

export default router;
