// src/routes/reviews.js
'use strict';

const express = require('express');
const { query } = require('../db');
const { attachUser } = require('../middleware/auth');

const router = express.Router();

router.use(attachUser);

const toReview = (row) => ({
  id: row.id,
  serviceId: row.service_id,
  userId: row.user_id,
  rating: row.rating,
  comment: row.comment,
  createdAt: row.created_at,
  userName: row.user_name || 'Anonymous',
  userAvatar: row.user_avatar || null
});

/** Get all reviews for a service */
router.get('/service/:serviceId', async (req, res, next) => {
  try {
    const serviceId = Number.parseInt(req.params.serviceId, 10);
    if (!Number.isInteger(serviceId)) {
      return res.status(400).json({ error: 'Service id must be a number' });
    }

    const { rows } = await query(
      `SELECT r.*, u.name AS user_name, u.avatar AS user_avatar
         FROM reviews r
         LEFT JOIN users u ON u.id = r.user_id
        WHERE r.service_id = $1
        ORDER BY r.created_at DESC`,
      [serviceId]
    );

    return res.json({ reviews: rows.map(toReview) });
  } catch (error) {
    return next(error);
  }
});

/** Create a review */
router.post('/', async (req, res, next) => {
  try {
    const { serviceId, rating, comment } = req.body || {};

    if (!serviceId || !rating) {
      return res.status(400).json({ error: 'serviceId and rating are required' });
    }

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    const { rows } = await query(
      `INSERT INTO reviews (service_id, user_id, owner_key, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        serviceId,
        req.user?.id || null,
        req.user?.email || req.guestKey || 'anonymous',
        ratingNum,
        comment || ''
      ]
    );

    // Update service rating and review count
    await query(
      `UPDATE services
          SET rating = (SELECT AVG(rating)::NUMERIC(2,1) FROM reviews WHERE service_id = $1),
              reviews = (SELECT COUNT(*) FROM reviews WHERE service_id = $1)
        WHERE id = $1`,
      [serviceId]
    );

    return res.status(201).json({ review: toReview(rows[0]) });
  } catch (error) {
    return next(error);
  }
});

/** Delete a review (only by the author) */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Review id must be a number' });
    }

    const { rows } = await query(
      `DELETE FROM reviews
        WHERE id = $1 AND (user_id = $2 OR owner_key = $3)
        RETURNING service_id`,
      [id, req.user?.id || null, req.user?.email || req.guestKey || 'anonymous']
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Review not found or not authorized' });
    }

    // Update service rating and review count
    await query(
      `UPDATE services
          SET rating = COALESCE((SELECT AVG(rating)::NUMERIC(2,1) FROM reviews WHERE service_id = $1), 0),
              reviews = (SELECT COUNT(*) FROM reviews WHERE service_id = $1)
        WHERE id = $1`,
      [rows[0].service_id]
    );

    return res.json({ deleted: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
