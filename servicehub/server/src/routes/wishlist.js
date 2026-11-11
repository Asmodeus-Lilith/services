// src/routes/wishlist.js
'use strict';

const express = require('express');
const { query } = require('../db');
const { toService } = require('../lib/serialize');
const { requireUser, ownerKeyFor } = require('../middleware/auth');

const router = express.Router();

/** GET /api/wishlist – list the user's saved services */
router.get('/', requireUser, async (req, res, next) => {
  try {
    const ownerKey = ownerKeyFor(req);
    const { rows } = await query(
      `SELECT s.*
       FROM services s
       JOIN wishlists w ON s.id = w.service_id
       WHERE w.owner_key = $1 AND s.is_active = true
         AND (s.owner_user_id IS NULL OR EXISTS (
           SELECT 1 FROM users service_owner
            WHERE service_owner.id = s.owner_user_id AND service_owner.is_active = true
         ))
       ORDER BY w.created_at DESC`,
      [ownerKey]
    );
    return res.json({ services: rows.map(toService) });
  } catch (error) {
    console.error('[wishlist] GET failed:', error);
    return next(error);
  }
});

/** POST /api/wishlist/:serviceId – add a service to the wishlist */
router.post('/:serviceId', requireUser, async (req, res, next) => {
  try {
    const serviceId = Number.parseInt(req.params.serviceId, 10);
    if (!Number.isInteger(serviceId)) {
      return res.status(400).json({ error: 'Invalid service id' });
    }

    const ownerKey = ownerKeyFor(req);

    // Ensure the service exists (so we fail fast)
    const { rows: serviceRows } = await query(
      `SELECT * FROM services s
        WHERE s.id = $1 AND s.is_active = true
          AND (s.owner_user_id IS NULL OR EXISTS (
            SELECT 1 FROM users service_owner
             WHERE service_owner.id = s.owner_user_id AND service_owner.is_active = true
          ))`,
      [serviceId]
    );
    if (serviceRows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Repeated clicks are harmless; preserve the original saved timestamp.
    await query(
      `INSERT INTO wishlists (user_id, owner_key, service_id, created_at)
       SELECT $1, $2, $3, now()
       WHERE EXISTS (SELECT 1 FROM users WHERE id = $1)
         AND EXISTS (SELECT 1 FROM services WHERE id = $3)`
      + ' ON CONFLICT DO NOTHING',
      [req.user.id, ownerKey, serviceId]
    );

    return res.status(201).end();
  } catch (error) {
    console.error('[wishlist] POST failed:', error);
    return next(error);
  }
});

/** DELETE /api/wishlist/:serviceId – remove a service from the wishlist */
router.delete('/:serviceId', requireUser, async (req, res, next) => {
  try {
    const serviceId = Number.parseInt(req.params.serviceId, 10);
    if (!Number.isInteger(serviceId)) {
      return res.status(400).json({ error: 'Invalid service id' });
    }

    const ownerKey = ownerKeyFor(req);
    const { rowCount } = await query(
      'DELETE FROM wishlists WHERE owner_key = $1 AND service_id = $2',
      [ownerKey, serviceId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    return res.status(204).end();
  } catch (error) {
    console.error('[wishlist] DELETE failed:', error);
    return next(error);
  }
});

module.exports = router;
