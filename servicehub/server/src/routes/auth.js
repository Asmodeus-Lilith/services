// src/routes/auth.js
'use strict';

const crypto = require('node:crypto');
const express = require('express');

const config = require('../config');
const { query } = require('../db');
const { hashPassword, verifyPassword, fakeVerify } = require('../lib/passwords');
const { toUser } = require('../lib/serialize');
const { rateLimit } = require('../middleware/rate-limit');
const {
  requireUser,
  claimGuestOrders,
  guestKey,
  bearerToken
} = require('../middleware/auth');

const router = express.Router();
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many sign-in attempts. Please try again later.'
});
const registerLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many account creation attempts. Please try again later.'
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const UNIQUE_VIOLATION = '23505';
const MAX_AVATAR_DATA_URL_LENGTH = 250_000;
const AVATAR_DATA_URL_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

const sanitizeError = (error, originalMessage) => {
  if (!error || typeof error.code !== 'string') return originalMessage;
  if (error.code === UNIQUE_VIOLATION) return 'An account with that email already exists';
  return originalMessage;
};

/** Real-looking avatars, derived from the email so they stay stable. */
const avatarFor = (email) =>
  `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`;

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');

  await query(
    `INSERT INTO sessions (token, user_id, expires_at)
          VALUES ($1, $2, now() + make_interval(days => $3::int))`,
    [token, userId, config.sessionDays]
  );

  return token;
}

/** Housekeeping: expired rows are only ever noticed when someone signs in. */
const pruneExpiredSessions = () =>
  query('DELETE FROM sessions WHERE expires_at < now()');

router.post('/register', registerLimit, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const name = String(body.name ?? '').trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? '');
    const avatar = body.avatar == null || body.avatar === ''
      ? avatarFor(email)
      : body.avatar;
    // Public registration must never grant administrator privileges.
    const userType = body.userType === 'provider' ? 'provider' : 'customer';

    if (!name) {
      return res.status(400).json({ error: 'Please enter your full name' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    if (
      typeof avatar !== 'string' ||
      avatar.length > MAX_AVATAR_DATA_URL_LENGTH ||
      (body.avatar && !AVATAR_DATA_URL_RE.test(avatar))
    ) {
      return res.status(400).json({ error: 'Profile photo must be a small JPG, PNG, or WebP image' });
    }

    const passwordHash = await hashPassword(password);

    let user;
    try {
      const { rows } = await query(
        `INSERT INTO users (name, email, password_hash, avatar, user_type)
              VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
        [name, email, passwordHash, avatar, userType]
      );
      user = rows[0];
    } catch (error) {
      const friendly = sanitizeError(error, 'Registration failed');
      if (error.code === UNIQUE_VIOLATION) {
        return res.status(409).json({ error: friendly });
      }
      console.error('[auth/register]', error.message);
      return res.status(500).json({ error: 'Unable to create account right now' });
    }

    const token = await createSession(user.id);
    const claimedOrders = await claimGuestOrders(user.id, user.email, guestKey(req));

    return res.status(201).json({ user: toUser(user), token, claimedOrders });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', loginLimit, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter your email and password' });
    }

    const { rows } = await query(
      'SELECT * FROM users WHERE lower(email) = $1',
      [email]
    );
    const user = rows[0];

    // Unknown emails still pay the hashing cost, so response time does not
    // reveal which addresses have accounts.
    const valid = user
      ? await verifyPassword(password, user.password_hash)
      : await fakeVerify(password);

    if (!valid) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    if (user.is_active === false) {
      return res.status(403).json({ error: 'This account has been suspended. Contact ServiceHub support.' });
    }

    const requestedType = ['customer', 'provider', 'admin'].includes(body.userType)
      ? body.userType
      : null;
    if (requestedType && user.user_type !== requestedType) {
      return res.status(403).json({
        error: `This account is not registered for ${requestedType} sign-in`
      });
    }

    await pruneExpiredSessions();

    let token;
    try {
      token = await createSession(user.id);
    } catch (error) {
      console.error('[auth/login] session creation failed:', error.message);
      return res.status(500).json({ error: 'Unable to create session. Please try again.' });
    }

    let claimedOrders = 0;
    try {
      claimedOrders = await claimGuestOrders(user.id, user.email, guestKey(req));
    } catch (error) {
      console.error('[auth/login] guest order claim failed:', error.message);
    }

    return res.json({ user: toUser(user), token, claimedOrders });
  } catch (error) {
    console.error('[auth/login] top-level error:', error);
    return next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = bearerToken(req);
    if (token) await query('DELETE FROM sessions WHERE token = $1', [token]);
    return res.status(204).end();
  } catch (error) {
    console.error('[auth/logout] failed:', error);
    return next(error);
  }
});

router.get('/me', requireUser, (req, res) => res.json({ user: req.user }));

module.exports = router;
