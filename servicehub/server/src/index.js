// src/index.js
'use strict';

const path = require('node:path');
const { loadEnvFile } = require('./env');

loadEnvFile(path.resolve(__dirname, '..', '.env'));

const config = require('./config');
const { pool } = require('./db');
const { createApp } = require('./app');

const maskPassword = (url) => url.replace(/:\/\/([^:@/]+):[^@]*@/, '://$1:***@');

async function start() {
  try {
    config.validateConfig();
  } catch (error) {
    console.error('[config] invalid server configuration:', error.message);
    process.exitCode = 1;
    return;
  }
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    console.error('[api] could not reach PostgreSQL.');
    console.error(`[api] ${maskPassword(config.databaseUrl)}`);
    console.error(`[api] ${error.message}`);
    console.error('[api] check the database is available and the schema has been migrated.');
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[api] ServiceHub API listening on port ${config.port}`);
    console.log(`[api] database: ${maskPassword(config.databaseUrl)}`);
  });

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 30_000;

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[api] ${signal} received, closing connections`);
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    server.close(async () => {
      try { await pool.end(); process.exitCode = 0; }
      catch (error) { console.error('[api] shutdown error:', error.message); process.exitCode = 1; }
      finally { clearTimeout(forceExit); }
    });
    server.closeIdleConnections?.();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
