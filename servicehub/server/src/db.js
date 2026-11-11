// src/db.js
'use strict';

const { Pool, types } = require('pg');
const config = require('./config');

// `pg` hands NUMERIC back as a string to protect precision. Every money column
// in this schema is a small rupee amount, so numbers are safe and far more
// convenient for the JSON API.
types.setTypeParser(types.builtins.NUMERIC, (value) =>
  value === null ? null : Number(value)
);

// DATE columns must stay 'YYYY-MM-DD'. The default parser turns them into a
// JS Date at local midnight, which can slip a day once serialised to JSON.
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

pool.on('error', (error) => {
  console.error('[db] idle client error:', error.message);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[db] slow query (${duration}ms):`, text.slice(0, 80));
    }
    return result;
  } catch (error) {
    console.error('[db] query error:', error, { text: text.slice(0, 80) });
    throw error;
  }
};

/** Runs `work` inside a transaction, rolling back if it throws. */
async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
