// src/routes/orders.js
'use strict';

const express = require('express');
const { query, withTransaction } = require('../db');
const { toOrder } = require('../lib/serialize');
const { ownerKeyFor } = require('../middleware/auth');
const { sslcommerz } = require('../lib/sslcommerz');

const router = express.Router();

const ORDER_COLUMNS = `id, user_id, owner_key, status, customer_name, customer_email,
  customer_phone, address_line, address_city, address_pincode, schedule_date,
  schedule_time, payment_method, payment_status, transaction_id, payment_details,
  subtotal, tax, promo_code, discount, total, created_at`;

// Columns needed to snapshot a cart line into an order.
const SERVICE_LOOKUP_COLUMNS =
  'id, name, price, unit, category, provider, image';

// Matches the 18% the checkout screen shows.
const TAX_RATE = 0.18;
const MAX_QUANTITY = 20;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value) => String(value ?? '').trim();

const createOrderId = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `ORD-${stamp}${random}`;
};

const clampQuantity = (value) => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity)));
};

/** Loads the line items for a set of orders in one extra round trip. */
async function attachItems(rows) {
  if (rows.length === 0) return [];

  const { rows: itemRows } = await query(
    'SELECT * FROM order_items WHERE order_id = ANY($1::text[]) ORDER BY id',
    [rows.map((row) => row.id)]
  );

  const grouped = new Map();
  for (const item of itemRows) {
    const existing = grouped.get(item.order_id);
    if (existing) existing.push(item);
    else grouped.set(item.order_id, [item]);
  }

  return rows.map((row) => toOrder(row, grouped.get(row.id) ?? []));
}

router.get('/', async (req, res, next) => {
  try {
    const ownerKey = ownerKeyFor(req);
    if (!ownerKey) {
      return res
        .status(400)
        .json({ error: 'Sign in or send a guest key to list bookings' });
    }

    const { rows } = await query(
      `SELECT ${ORDER_COLUMNS}
         FROM orders
        WHERE owner_key = $1
        ORDER BY created_at DESC`,
      [ownerKey]
    );

    return res.json({ orders: await attachItems(rows) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const ownerKey = ownerKeyFor(req);
    if (!ownerKey) {
      return res
        .status(400)
        .json({ error: 'Sign in or send a guest key to read a booking' });
    }

    const { rows } = await query(
      `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1 AND owner_key = $2`,
      [req.params.id, ownerKey]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'We could not find that order' });
    }

    const [order] = await attachItems(rows);
    return res.json({ order });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const ownerKey = ownerKeyFor(req);
    if (!ownerKey) {
      return res
        .status(400)
        .json({ error: 'Sign in or send a guest key to place a booking' });
    }

    const body = req.body ?? {};
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (rawItems.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty' });
    }

    const customer = body.customer ?? {};
    const address = body.address ?? {};
    const schedule = body.schedule ?? {};

    // Mirrors the checkout screen's required fields, enforced for real here.
    const required = [
      [customer.name, 'full name'],
      [customer.email, 'email address'],
      [customer.phone, 'phone number'],
      [address.line, 'service address'],
      [address.city, 'city'],
      [address.pincode, 'pincode'],
      [schedule.date, 'preferred date'],
      [schedule.time, 'preferred time']
    ];

    const missing = required.find(([value]) => !text(value));
    if (missing) {
      return res.status(400).json({ error: `Please provide your ${missing[1]}` });
    }

    if (!DATE_RE.test(text(schedule.date))) {
      return res
        .status(400)
        .json({ error: 'Preferred date must look like YYYY-MM-DD' });
    }

    const wanted = new Map();
    for (const item of rawItems) {
      const id = Number.parseInt(item?.id, 10);
      if (!Number.isInteger(id)) continue;
      wanted.set(id, clampQuantity(item?.quantity));
    }

    if (wanted.size === 0) {
      return res.status(400).json({ error: 'None of those services are valid' });
    }

    // Prices are read from the catalogue rather than trusted from the request,
    // so a tampered payload cannot change what a booking costs.
    const { rows: serviceRows } = await query(
      `SELECT ${SERVICE_LOOKUP_COLUMNS} FROM services
        WHERE id = ANY($1::int[]) AND is_active = true
          AND (owner_user_id IS NULL OR EXISTS (
            SELECT 1 FROM users service_owner
             WHERE service_owner.id = services.owner_user_id AND service_owner.is_active = true
          ))`,
      [[...wanted.keys()]]
    );

    if (serviceRows.length !== wanted.size) {
      return res
        .status(400)
        .json({ error: 'One or more of those services is no longer available' });
    }

    const lines = serviceRows.map((service) => ({
      serviceId: service.id,
      name: service.name,
      price: service.price,
      quantity: wanted.get(service.id),
      image: service.image,
      unit: service.unit,
      category: service.category,
      provider: service.provider
    }));

    const subtotal = lines.reduce(
      (sum, line) => sum + line.price * line.quantity,
      0
    );
    const tax = Math.round(subtotal * TAX_RATE);
    const requestedPromo = text(body.promoCode).toUpperCase();
    const id = createOrderId();

    const order = await withTransaction(async (client) => {
      let promo = null;
      let discount = 0;
      if (requestedPromo) {
        const { rows: promotions } = await client.query(
          `SELECT code, discount_percent, max_uses, uses
             FROM promotions
            WHERE code = $1 AND is_active = true
              AND (expires_at IS NULL OR expires_at > now())
            FOR UPDATE`,
          [requestedPromo]
        );
        promo = promotions[0];
        if (!promo || (promo.max_uses !== null && promo.uses >= promo.max_uses)) {
          return { invalidPromotion: true };
        }
        discount = Math.min(subtotal, Math.round(subtotal * Number(promo.discount_percent) / 100));
      }
      const total = subtotal + tax - discount;
      const rawPaymentMethod = text(body.paymentMethod).toLowerCase() || 'sslcommerz';
      const isCod = rawPaymentMethod === 'cod';
      const paymentMethod = isCod ? 'cod' : 'sslcommerz';
      const initialPaymentStatus = isCod ? 'pending' : 'unpaid';
      const initialStatus = isCod ? 'upcoming' : 'pending_payment';

      await client.query(
        `INSERT INTO orders (id, user_id, owner_key, status, customer_name, customer_email,
                             customer_phone, address_line, address_city, address_pincode,
                             schedule_date, schedule_time, payment_method, payment_status,
                             subtotal, tax, promo_code, discount, total)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          id,
          req.user?.id ?? null,
          ownerKey,
          initialStatus,
          text(customer.name),
          text(customer.email),
          text(customer.phone),
          text(address.line),
          text(address.city),
          text(address.pincode),
          text(schedule.date),
          text(schedule.time),
          paymentMethod,
          initialPaymentStatus,
          subtotal,
          tax,
          promo?.code ?? null,
          discount,
          total
        ]
      );

      if (promo) {
        await client.query('UPDATE promotions SET uses = uses + 1 WHERE code = $1', [promo.code]);
      }

      const columnsPerLine = 9;
      const tuples = [];
      const params = [];

      lines.forEach((line, index) => {
        const base = index * columnsPerLine;
        const placeholders = Array.from(
          { length: columnsPerLine },
          (_, offset) => `$${base + offset + 1}`
        );
        tuples.push(`(${placeholders.join(', ')})`);
        params.push(
          id,
          line.serviceId,
          line.name,
          line.price,
          line.quantity,
          line.image,
          line.unit,
          line.category,
          line.provider
        );
      });

      await client.query(
        `INSERT INTO order_items
           (order_id, service_id, name, price, quantity, image, unit, category, provider)
         VALUES ${tuples.join(', ')}`,
        params
      );

      const { rows } = await client.query(
        `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1`,
        [id]
      );
      const { rows: itemRows } = await client.query(
        'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id',
        [id]
      );

      return toOrder(rows[0], itemRows);
    });

    if (order.invalidPromotion) {
      return res.status(400).json({ error: 'That promotion code is invalid, expired, or fully redeemed' });
    }

    let gatewayUrl = null;
    if (order.paymentMethod === 'sslcommerz') {
      try {
        const paymentSession = await sslcommerz.initPayment({
          order,
          customer,
          address,
          schedule
        });
        gatewayUrl = paymentSession.gatewayUrl;
        if (paymentSession.sessionKey) {
          await query('UPDATE orders SET transaction_id = $1 WHERE id = $2', [paymentSession.sessionKey, order.id]);
        }
      } catch (sslErr) {
        console.error('[orders] SSLCommerz initialization failed:', sslErr.message);
        return res.status(502).json({
          error: `Could not initialize SSLCommerz payment: ${sslErr.message}. You can try again or select Cash on Service.`
        });
      }
    }

    return res.status(201).json({ order, gatewayUrl });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
