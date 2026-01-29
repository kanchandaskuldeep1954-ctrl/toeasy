
import pg from 'pg';
import { config } from '../config.js';
import { closeRedis } from '../services/cacheService.js';

async function setupAlertsDB() {
  console.log('Setting up Alerts & Notifications database tables...');

  // Fallback credentials
  const poolConfig = config.databaseUrl ? { connectionString: config.databaseUrl } : {
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "password",
    database: "toeasy_dev",
  };

  console.log('Connecting with config:', config.databaseUrl ? 'DATABASE_URL' : 'Fallback Defaults');

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
    // 1. Create Alerts Table
    await query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        metric_id INTEGER REFERENCES metrics(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        condition_type VARCHAR(20) NOT NULL CHECK (condition_type IN ('GT', 'LT', 'EQ')),
        threshold_value DECIMAL NOT NULL,
        frequency VARCHAR(20) DEFAULT 'daily',
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Created alerts table');

    // 2. Create Notifications Table
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Created notifications table');

    // 3. Create Alert History Table
    await query(`
      CREATE TABLE IF NOT EXISTS alert_history (
        id SERIAL PRIMARY KEY,
        alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
        value_at_trigger DECIMAL,
        triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Created alert_history table');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
  } finally {
    // Attempt to close redis only if initialized (it might not be here, but imported service might have auto-initialized?)
    // Actually closeRedis from cacheService is safe to call.
    try { await closeRedis(); } catch { }
    await pool.end();
    process.exit(0);
  }
}

setupAlertsDB();
