// src/lib/ensure-database.js
'use strict';

const { Client } = require('pg');
const config = require('../config');

/** Splits a connection string into the parts we need to reach the server itself. */
function parseTarget(databaseUrl) {
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));

  if (!database) {
    throw new Error(
      `DATABASE_URL must include a database name, got: ${databaseUrl}`
    );
  }

  url.pathname = '/postgres';
  return { database, maintenanceUrl: url.toString() };
}

/**
 * Creates the target database if it is missing. Connecting to the maintenance
 * `postgres` database first keeps `npm run migrate` a genuine one-command setup.
 */
async function ensureDatabase({ log = console.log } = {}) {
  const { database, maintenanceUrl } = parseTarget(config.databaseUrl);

  const client = new Client({ connectionString: maintenanceUrl });
  await client.connect();

  try {
    const { rows } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database]
    );

    if (rows.length > 0) {
      log(`[db] database "${database}" already exists`);
      return { created: false, database };
    }

    // Identifiers cannot be parameterised, so quote it defensively instead.
    await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
    log(`[db] created database "${database}"`);
    return { created: true, database };
  } finally {
    await client.end();
  }
}

module.exports = { ensureDatabase, parseTarget };
