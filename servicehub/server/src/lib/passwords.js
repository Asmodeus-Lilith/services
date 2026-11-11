// src/lib/passwords.js
'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const SCHEME = 'scrypt';

/**
 * Hashes a password with a per-user random salt.
 * The stored value carries its own scheme and salt, so the format can change
 * later without invalidating existing accounts.
 */
async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `${SCHEME}$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;

  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== SCHEME || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== KEY_LENGTH) return false;

  const derived = await scrypt(password, salt, KEY_LENGTH);
  return crypto.timingSafeEqual(expected, derived);
}

/**
 * Burns roughly the same time as a real verification. Signing in with an
 * unknown email would otherwise be measurably faster than a wrong password,
 * which leaks whether an account exists.
 */
async function fakeVerify(password) {
  await verifyPassword(
    typeof password === 'string' ? password : '',
    `${SCHEME}$00000000000000000000000000000000$${'0'.repeat(KEY_LENGTH * 2)}`
  );
  return false;
}

module.exports = { hashPassword, verifyPassword, fakeVerify };
