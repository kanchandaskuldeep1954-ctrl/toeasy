import knex from 'knex';
import { config } from '../config.js';

// Generic interface for any provider (SQL, SaaS, Ads)
export interface DataProvider {
    fetchData(credentials: any): Promise<{ headers: string[], data: any[] }>;
    verifyConnection(credentials: any): Promise<boolean>;
}

class IntegrationService {
    // In a real app, use a proper encryption lib like 'crypto'
    // For this demo, we'll store as JSON but mark where encryption would happen
    private async encrypt(data: any): Promise<string> {
        return JSON.stringify(data); // TODO: Implement AES-256
    }

    private async decrypt(data: string): Promise<any> {
        return JSON.parse(data);
    }

    async createIntegration(userId: number, workspaceId: string, payload: { provider: string, name: string, credentials: any }, db: any) {
        const encryptedCreds = await this.encrypt(payload.credentials);

        const [id] = await db('integrations').insert({
            user_id: userId,
            workspace_id: workspaceId,
            provider: payload.provider,
            name: payload.name,
            credentials: { data: encryptedCreds },
            status: 'active'
        }).returning('id');

        return id;
    }

    async listIntegrations(workspaceId: string, userId: number, db: any) {
        return db('integrations')
            .where({ workspace_id: workspaceId, user_id: userId })
            .select('id', 'provider', 'name', 'status', 'last_sync_at', 'sync_message');
    }

    async getIntegration(id: string, userId: number, db: any) {
        const integration = await db('integrations').where({ id, user_id: userId }).first();
        if (integration && integration.credentials) {
            integration.decryptedCredentials = await this.decrypt(integration.credentials.data);
        }
        return integration;
    }
}

export const integrationService = new IntegrationService();
