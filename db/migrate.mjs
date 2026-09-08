import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';

// Use createRequire to resolve deps from server's node_modules
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server');
const require = createRequire(path.join(serverDir, 'noop.mjs'));
const pkg = require('pg');

dotenv.config({ path: '../server/.env' });
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hmwssb',
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, 'migrations');
const TRACKING_TABLE = '_migrations';

async function ensureTrackingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${TRACKING_TABLE}" (
      "Name" TEXT PRIMARY KEY,
      "AppliedAt" TIMESTAMP NOT NULL DEFAULT now(),
      "Checksum" TEXT
    )
  `);
}

async function getAppliedMigrations() {
  const { rows } = await pool.query(`SELECT "Name" FROM "${TRACKING_TABLE}" ORDER BY "Name"`);
  return new Set(rows.map(r => r.Name));
}

async function recordMigration(name) {
  await pool.query(`INSERT INTO "${TRACKING_TABLE}" ("Name") VALUES ($1) ON CONFLICT DO NOTHING`, [name]);
}

async function migrate() {
  await ensureTrackingTable();
  const applied = await getAppliedMigrations();

  const files = fs.readdirSync(migrationsDir).sort();
  let count = 0;

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    if (applied.has(file)) {
      console.log(`  Skipped (already applied): ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
    await recordMigration(file);
    console.log(`  Done.`);
    count++;
  }

  await pool.end();
  if (count === 0) {
    console.log('No new migrations to apply.');
  } else {
    console.log(`Applied ${count} migration(s).`);
  }
}

migrate().catch((err) => { console.error('Migration failed:', err); process.exit(1); });
