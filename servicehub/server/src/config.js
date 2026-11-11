// src/config.js
'use strict';

const path = require('node:path');

const serverRoot = path.resolve(__dirname, '..');

const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 4000);
const sessionDays = Number(process.env.SESSION_DAYS || 30);
const dbPoolMax = Number(process.env.DB_POOL_MAX || 10);
const databaseUrl = process.env.DATABASE_URL ||
  (isProduction ? '' : 'postgres://postgres:postgres@localhost:5432/servicehub');

function validateConfig() {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  if (!Number.isInteger(sessionDays) || sessionDays < 1 || sessionDays > 365) {
    throw new Error('SESSION_DAYS must be an integer between 1 and 365');
  }
  if (!Number.isInteger(dbPoolMax) || dbPoolMax < 1 || dbPoolMax > 100) {
    throw new Error('DB_POOL_MAX must be an integer between 1 and 100');
  }
  if (!databaseUrl) throw new Error('DATABASE_URL is required in production');
  let parsed;
  try { parsed = new URL(databaseUrl); } catch (_) { throw new Error('DATABASE_URL must be a valid PostgreSQL URL'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol');
  }
  if (isProduction && (process.env.CORS_ORIGIN || '').split(',').some((origin) => origin.trim() === '*')) {
    throw new Error('CORS_ORIGIN cannot include * in production');
  }
}

const isSandbox = process.env.SSLCOMMERZ_IS_SANDBOX !== 'false';
const sslcommerz = {
  storeId: process.env.SSLCOMMERZ_STORE_ID || 'testbox',
  storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || 'qwerty',
  isSandbox,
  initUrl: isSandbox
    ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
    : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php',
  validationUrl: isSandbox
    ? 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
    : 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'
};
const clientUrl = process.env.CLIENT_URL || (isProduction ? '' : 'http://127.0.0.1:3000');
const serverUrl = process.env.SERVER_URL || (isProduction ? '' : `http://127.0.0.1:${port}`);

module.exports = {
  serverRoot,
  webRoot: path.resolve(serverRoot, '..', 'build'),
  uploadsDir: process.env.UPLOADS_DIR || path.resolve(serverRoot, 'uploads'),
  port,
  databaseUrl,
  sessionDays,
  dbPoolMax,
  isProduction,
  validateConfig,
  sslcommerz,
  clientUrl,
  serverUrl
};
