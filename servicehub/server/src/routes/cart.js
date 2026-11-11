// src/routes/cart.js
'use strict';

const express = require('express');
const { query, withTransaction } = require('../db');
const { toCartItem } = require('../lib/serialize');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

const MAX_QUANTITY = 20;

const CART_SELECT = `
  SELECT s.id, s.name, s.category, s.description, s.price, s.original_price,
         s.unit, s.rating, s.reviews, s.image, s.discount, s.popular,
         s.provider, s.experience, s.duration, s.availability,
         s.subjects, s.inclusions,
         c.quantity
    FROM cart_items c
    JOIN services s ON s.id = c.service_id
   WHERE c.user_id = $1 AND s.is_active = true
     AND (s.owner_user_id IS NULL OR EXISTS (
       SELECT 1 FROM users service_owner
        WHERE service_owner.id = s.owner_user_id AND service_owner.is_active = true
     ))
   ORDER BY s.id`;

const clampQuantity = (value) => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity)));
};

const readCart = async (userId) => {
  const { rows } = await query(CART_SELECT, [userId]);
  return rows.map(toCartItem);
};

// A guest has no account to hang a cart on, so the React app keeps those in
// localStorage and only calls this once someone is signed in.
router.use(requireUser);

router.get('/', async (req, res, next) => {
  try {
    return res.json({ items: await readCart(req.user.id) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Replaces the whole cart. Sending one list keeps "add", "remove" and "change
 * quantity" from needing three endpoints that could drift out of sync.
 */
router.put('/', async (req, res, next) => {
  try {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

    const wanted = new Map();
    for (const item of rawItems) {
      const id = Number.parseInt(item?.id, 10);
      if (!Number.isInteger(id)) continue;
      // A later duplicate wins, so the map also de-duplicates.
      wanted.set(id, clampQuantity(item?.quantity));
    }

    let available = new Set();
    if (wanted.size > 0) {
      const { rows } = await query(
        `SELECT s.id FROM services s
          WHERE s.id = ANY($1::int[]) AND s.is_active = true
            AND (s.owner_user_id IS NULL OR EXISTS (
              SELECT 1 FROM users service_owner
               WHERE service_owner.id = s.owner_user_id AND service_owner.is_active = true
            ))`,
        [[...wanted.keys()]]
      );
      available = new Set(rows.map((row) => row.id));
    }

    await withTransaction(async (client) => {
      await client.query('DELETE FROM cart_items WHERE user_id = $1', [
        req.user.id
      ]);

      for (const [serviceId, quantity] of wanted) {
        if (!available.has(serviceId)) continue;
        await client.query(
          `INSERT INTO cart_items (user_id, service_id, quantity)
                VALUES ($1, $2, $3)`,
          [req.user.id, serviceId, quantity]
        );
      }
    });

    return res.json({ items: await readCart(req.user.id) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    await query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
