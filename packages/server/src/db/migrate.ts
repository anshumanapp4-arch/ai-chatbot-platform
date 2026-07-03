// ============================================
// Migration Runner
// ============================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log('🔄 Running database migrations...');

  // Create migrations tracking table
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Get list of already-executed migrations
  const executed = await query<{ name: string }>('SELECT name FROM _migrations ORDER BY id');
  const executedNames = new Set(executed.rows.map(r => r.name));

  // Read migration files
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (executedNames.has(file)) {
      console.log(`  ⏭  ${file} (already executed)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      await query(sql);
      await query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      console.log(`  ✅ ${file}`);
    } catch (error) {
      console.error(`  ❌ ${file} failed:`, error);
      throw error;
    }
  }

  console.log('✅ All migrations complete.');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
