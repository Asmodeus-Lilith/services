// src/routes/catalog.js
'use strict';

const express = require('express');
const { query } = require('../db');
const { toService, toCategory } = require('../lib/serialize');

const router = express.Router();

const SERVICE_COLUMNS = `id, name, category, description, price, original_price, unit,
  rating, reviews, image, images, discount, popular, provider, owner_user_id, experience, duration,
  availability, subjects, inclusions, is_active`;

const ALL_CATEGORY = 'all';

/**
 * Categories carry a live service count. `all` is a UI filter rather than a
 * real category, so its count is the whole catalogue.
 */
async function loadCategories() {
  const { rows } = await query(
    `SELECT c.id, c.name, c.icon,
            (SELECT count(*) FROM services s
              WHERE s.category = c.id AND s.is_active = true
                AND (s.owner_user_id IS NULL OR EXISTS (
                  SELECT 1 FROM users service_owner
                   WHERE service_owner.id = s.owner_user_id AND service_owner.is_active = true
                ))) AS service_count
       FROM categories c
      ORDER BY c.sort_order, c.id`
  );

  const total = rows
    .filter((row) => row.id !== ALL_CATEGORY)
    .reduce((sum, row) => sum + Number(row.service_count), 0);

  return rows.map((row) =>
    toCategory(row.id === ALL_CATEGORY ? { ...row, service_count: total } : row)
  );
}

async function loadServices({ category, search } = {}) {
  const conditions = [
    'is_active = true',
    `(owner_user_id IS NULL OR EXISTS (
      SELECT 1 FROM users service_owner
       WHERE service_owner.id = services.owner_user_id AND service_owner.is_active = true
    ))`
  ];
  const params = [];

  if (category && category !== ALL_CATEGORY) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(name ILIKE $${params.length} OR description ILIKE $${params.length})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await query(
      `SELECT ${SERVICE_COLUMNS}
       FROM services
       ${where}
       ORDER BY reviews DESC, id`,
      params
    );
    return rows.map(toService);
  } catch (error) {
    console.error('[catalog/loadServices] failed:', error);
    throw error;
  }
}

router.get('/services', async (req, res, next) => {
  try {
    const services = await loadServices({
      category: req.query.category ? String(req.query.category) : null,
      search: req.query.search ? String(req.query.search).trim() : null
    });

    return res.json({ services });
  } catch (error) {
    return next(error);
  }
});

router.get('/services/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Service id must be a number' });
    }

    const { rows } = await query(
      `SELECT ${SERVICE_COLUMNS} FROM services
        WHERE id = $1 AND is_active = true
          AND (owner_user_id IS NULL OR EXISTS (
            SELECT 1 FROM users service_owner
             WHERE service_owner.id = services.owner_user_id AND service_owner.is_active = true
          ))`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'That service does not exist' });
    }

    return res.json({ service: toService(rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.get('/categories', async (_req, res, next) => {
  try {
    return res.json({ categories: await loadCategories() });
  } catch (error) {
    return next(error);
  }
});

/** One round trip for everything the React app needs to render the catalogue. */
router.get('/catalog', async (req, res, next) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : null;
    const [services, categories] = await Promise.all([
      loadServices({ search }),
      loadCategories()
    ]);

    return res.json({ services, categories });
  } catch (error) {
    console.error('[catalog/catalog] failed:', error);
    return next(error);
  }
});

module.exports = router;
