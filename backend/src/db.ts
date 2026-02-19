import pg from 'pg';
import { config } from './config.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

type QueryOverrideFn = (text: string, params?: any[]) => Promise<any>;
let queryOverride: QueryOverrideFn | null = null;

export async function query(text: string, params?: any[]) {
  if (queryOverride) {
    return queryOverride(text, params);
  }
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export function setQueryOverrideForTests(fn: QueryOverrideFn | null) {
  queryOverride = fn;
}

export function resetQueryOverrideForTests() {
  queryOverride = null;
}

export async function getClient() {
  return pool.connect();
}

export default pool;
