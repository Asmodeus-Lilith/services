// src/migrate.js
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFile } = require('./env');

loadEnvFile(path.resolve(__dirname, '..', '.env'));

const config = require('./config');
const { pool } = require('./db');
const { ensureDatabase, parseTarget } = require('./lib/ensure-database');

const RESET = process.argv.includes('--reset');

// Child-first so the foreign keys never block a drop.
const DROP_ORDER = [
  'admin_audit_log',
  'cart_items',
  'user_reports',
  'messages',
  'conversations',
  'order_items',
  'orders',
  'promotions',
  'sessions',
  'services',
  'categories',
  'users'
];

async function main() {
  if (RESET && config.isProduction) {
    throw new Error('Database reset is disabled in production');
  }
  // Production databases are provisioned by the platform. The runtime/migration
  // role should not need access to the maintenance database or CREATE DATABASE.
  const { database } = config.isProduction
    ? parseTarget(config.databaseUrl)
    : await ensureDatabase();
  console.log(`[migrate] target database: ${database}`);

  if (RESET) {
    console.warn('[migrate] --reset given: dropping all ServiceHub tables');
    for (const table of DROP_ORDER) {
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
  }

  const schema = fs.readFileSync(
    path.join(config.serverRoot, 'src', 'schema.sql'),
    'utf8'
  );

  await pool.query(schema);

  const { rows } = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name`
  );

  console.log('[migrate] schema is up to date. Tables:');
  for (const row of rows) console.log(`  - ${row.table_name}`);
}

main()
  .catch((error) => {
    console.error('[migrate] failed:', error.message || error.code || error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
