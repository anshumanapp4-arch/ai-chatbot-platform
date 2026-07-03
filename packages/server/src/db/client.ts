// ============================================
// PostgreSQL Client + pgvector Setup
// ============================================

import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.db.url,
  min: config.db.poolMin,
  max: config.db.poolMax,
});

// Helper to run queries
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

// Helper to get a client from the pool (for transactions)
export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

// Helper to run a transaction
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Test connection
export async function testConnection(): Promise<void> {
  try {
    const result = await query('SELECT NOW()');
    console.log('✅ Database connected at:', result.rows[0].now);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}
