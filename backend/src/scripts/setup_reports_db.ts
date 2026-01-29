
import pg from 'pg';
import { config } from '../config.js';

async function setup() {
    console.log('🚀 Setting up Reports & Versioning tables...');

    // Fallback credentials matching knexfile
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
        // 1. Create strategic_reports table
        await query(`
      CREATE TABLE IF NOT EXISTS strategic_reports (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        dataset_id INTEGER REFERENCES datasets(id) ON DELETE SET NULL,
        owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        current_content JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
        console.log('✅ Created strategic_reports table');

        // 2. Create report_versions table
        await query(`
      CREATE TABLE IF NOT EXISTS report_versions (
        id SERIAL PRIMARY KEY,
        report_id INTEGER NOT NULL REFERENCES strategic_reports(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        content JSONB NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        change_summary TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
        console.log('✅ Created report_versions table');

        // 3. Create indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_reports_workspace ON strategic_reports(workspace_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_report_versions_report ON report_versions(report_id);`);
        console.log('✅ Created indexes');

        console.log('🎉 Database setup complete!');
    } catch (error) {
        console.error('❌ Setup failed:', error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

setup();
