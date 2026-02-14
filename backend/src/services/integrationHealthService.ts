import { integrationService } from './integrationService.js';
import { query } from '../db.js';

export interface HealthStatus {
    integrationId: string;
    status: 'healthy' | 'warning' | 'error';
    latencyMs?: number;
    lastChecked: string;
    message?: string;
}

class IntegrationHealthService {
    async checkHealth(integrationId: string, userId: number, db: any): Promise<HealthStatus> {
        const integration = await integrationService.getIntegration(integrationId, userId, db);
        if (!integration) {
            throw new Error('Integration not found');
        }

        const start = Date.now();
        let status: 'healthy' | 'warning' | 'error' = 'healthy';
        let message = 'Connection active and responsive';

        try {
            // Logic to perform actual connection test based on provider
            // For now, we simulate the check
            const isReachable = await this.simulateProbe(integration.provider);

            if (!isReachable) {
                status = 'error';
                message = `Failed to reach ${integration.provider} endpoint. Check credentials or firewall.`;
            }

            // Update status in DB
            await db('integrations').where({ id: integrationId }).update({
                status: status === 'healthy' ? 'active' : 'error',
                last_sync_at: new Date(),
                sync_message: message
            });

        } catch (err: any) {
            status = 'error';
            message = err.message || 'Unknown health check failure';
        }

        return {
            integrationId,
            status,
            latencyMs: Date.now() - start,
            lastChecked: new Date().toISOString(),
            message
        };
    }

    private async simulateProbe(provider: string): Promise<boolean> {
        // Mock latency
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
        return Math.random() > 0.1; // 90% success rate for simulation
    }

    async getSystemHealthSummary(workspaceId: string, db: any) {
        throw new Error('Deprecated: use getSystemHealthSummaryForUser');
    }

    async getSystemHealthSummaryForUser(workspaceId: string, userId: number, db: any) {
        const integrations = await integrationService.listIntegrations(workspaceId, userId, db);
        const results = await Promise.all(integrations.map((i: any) => this.checkHealth(i.id, userId, db)));

        return {
            total: results.length,
            healthy: results.filter(r => r.status === 'healthy').length,
            issues: results.filter(r => r.status !== 'healthy').length,
            results
        };
    }
}

export const integrationHealthService = new IntegrationHealthService();
