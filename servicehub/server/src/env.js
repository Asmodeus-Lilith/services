// src/env.js
'use strict';

const fs = require('node:fs');

/**
 * Minimal .env reader so the API needs no configuration dependency.
 * Existing process.env values always win, which keeps `DATABASE_URL=... npm start`
 * working the way you would expect.
 */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return false;

  const text = fs.readFileSync(file, 'utf8');

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key) continue;

    let value = line.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    if (quoted && value.length >= 2) value = value.slice(1, -1);

    if (process.env[key] === undefined) process.env[key] = value;
  }

  return true;
}

module.exports = { loadEnvFile };
