
import pg from 'pg';
import { config } from '../config.js';

async function migrate() {
    console.log('🔄 Migrating existing reports from dashboards table...');

    const poolConfig = config.databaseUrl ? { connectionString: config.databaseUrl } : {
        host: "localhost",
        port: 5432,
        user: "postgres",
        password: "password",
        database: "toeasy_dev",
    };

    const pool = new pg.Pool(poolConfig);

    const query = async (text: string, params?: any[]) => {
        const client = await pool.connect();
        try {
            return await client.query(text, params);
        } finally {
            client.release();
        }
    };

    try {
        // 1. Fetch all dashboards with report type
        const res = await query(`SELECT * FROM dashboards WHERE layout->>'type' = 'report'`);
        console.log(`Found ${res.rows.length} reports to migrate.`);

        for (const dash of res.rows) {
            console.log(`Migrating: ${dash.name}`);
            const datasetId = dash.layout?.dataset_id;
            const content = dash.layout?.report || {};

            // Insert into strategic_reports
            await query(`
        INSERT INTO strategic_reports (workspace_id, dataset_id, owner_id, name, description, current_content, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [dash.workspace_id, datasetId, dash.user_id || null, dash.name, dash.description || '', JSON.stringify(content), dash.created_at]);

            console.log(`✅ Migrated: ${dash.name}`);
        }

        console.log('🎉 Migration complete!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

migrate();
