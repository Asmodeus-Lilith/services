'use strict';

const express = require('express');
const { query } = require('../db');
const { rateLimit } = require('../middleware/rate-limit');

const router = express.Router();
const validateLimit = rateLimit({ windowMs: 60_000, max: 30, message: 'Please wait before trying more promotion codes.' });

router.post('/validate', validateLimit, async (req, res, next) => {
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  const subtotal = Number(req.body?.subtotal);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !Number.isFinite(subtotal) || subtotal < 0) {
    return res.status(400).json({ error: 'Enter a valid promotion code' });
  }
  try {
    const { rows } = await query(
      `SELECT discount_percent, max_uses, uses
         FROM promotions
        WHERE code = $1 AND is_active = true
          AND (expires_at IS NULL OR expires_at > now())`,
      [code]
    );
    const promo = rows[0];
    if (!promo || (promo.max_uses !== null && promo.uses >= promo.max_uses)) {
      return res.status(404).json({ error: 'That promotion code is invalid, expired, or fully redeemed' });
    }
    const discount = Math.min(subtotal, Math.round(subtotal * Number(promo.discount_percent) / 100));
    return res.json({ code, discountPercent: promo.discount_percent, discount });
  } catch (error) { return next(error); }
});

module.exports = router;
