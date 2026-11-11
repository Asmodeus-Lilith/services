// src/routes/notifications.js
'use strict';

const express = require('express');
const { query } = require('../db');
const { attachUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(attachUser);

const toNotification = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  message: row.message,
  read: row.read,
  link: row.link,
  createdAt: row.created_at
});

/** Get all notifications for the current user */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM notifications
        WHERE user_id = $1 OR owner_key = $2
        ORDER BY created_at DESC
        LIMIT 50`,
      [req.user?.id || null, req.user?.email || req.guestKey || 'anonymous']
    );

    return res.json({ notifications: rows.map(toNotification) });
  } catch (error) {
    return next(error);
  }
});

/** Get unread count */
router.get('/unread-count', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*) AS count FROM notifications
        WHERE (user_id = $1 OR owner_key = $2) AND read = false`,
      [req.user?.id || null, req.user?.email || req.guestKey || 'anonymous']
    );

    return res.json({ count: Number(rows[0].count) });
  } catch (error) {
    return next(error);
  }
});

/** Mark a notification as read */
router.patch('/:id/read', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Notification id must be a number' });
    }

    const { rows } = await query(
      `UPDATE notifications
          SET read = true
        WHERE id = $1 AND (user_id = $2 OR owner_key = $3)
        RETURNING *`,
      [id, req.user?.id || null, req.user?.email || req.guestKey || 'anonymous']
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json({ notification: toNotification(rows[0]) });
  } catch (error) {
    return next(error);
  }
});

/** Mark all notifications as read */
router.post('/mark-all-read', async (req, res, next) => {
  try {
    await query(
      `UPDATE notifications
          SET read = true
        WHERE user_id = $1 OR owner_key = $2`,
      [req.user?.id || null, req.user?.email || req.guestKey || 'anonymous']
    );

    return res.json({ marked: true });
  } catch (error) {
    return next(error);
  }
});

/** Create a notification (internal use) */
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { userId, ownerKey, type, title, message, link } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ error: 'title and message are required' });
    }

    const { rows } = await query(
      `INSERT INTO notifications (user_id, owner_key, type, title, message, link)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId || null, ownerKey || 'anonymous', type || 'info', title, message, link || null]
    );

    return res.status(201).json({ notification: toNotification(rows[0]) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
