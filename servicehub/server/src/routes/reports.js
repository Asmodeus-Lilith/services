'use strict';

const express = require('express');
const { query } = require('../db');
const { requireUser } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rate-limit');

const router = express.Router();
const allowedReasons = new Set([
  'harassment', 'fraud', 'inappropriate_behavior', 'service_quality',
  'safety_concern', 'other'
]);
const reportLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'You have submitted several reports recently. Please try again later.'
});

router.use(requireUser);

router.post('/', reportLimit, async (req, res, next) => {
  const conversationId = String(req.body?.conversationId ?? '').trim();
  const serviceId = Number(req.body?.serviceId);
  const reason = String(req.body?.reason ?? '');
  const description = typeof req.body?.description === 'string'
    ? req.body.description.trim() : '';

  const hasConversation = /^[0-9a-f-]{36}$/i.test(conversationId);
  const hasService = Number.isSafeInteger(serviceId) && serviceId > 0;
  if (hasConversation === hasService) {
    return res.status(400).json({ error: 'Choose a conversation or service to report' });
  }
  if (!allowedReasons.has(reason)) {
    return res.status(400).json({ error: 'Choose a reason for this report' });
  }
  if (description.length < 20 || description.length > 2000) {
    return res.status(400).json({ error: 'Describe what happened in 20 to 2,000 characters' });
  }
  if (!['customer', 'provider'].includes(req.user.userType)) {
    return res.status(403).json({ error: 'Only customers and providers can submit reports' });
  }

  try {
    if (hasService) {
      if (req.user.userType !== 'customer') {
        return res.status(403).json({ error: 'Only customers can report a provider from a service page' });
      }
      const { rows: services } = await query(
        `SELECT s.id, s.name, s.owner_user_id
           FROM services s
           JOIN users provider ON provider.id = s.owner_user_id AND provider.user_type = 'provider'
          WHERE s.id = $1 AND s.is_active = true AND provider.is_active = true`,
        [serviceId]
      );
      const service = services[0];
      if (!service) return res.status(404).json({ error: 'Service provider not found' });
      if (service.owner_user_id === req.user.id) return res.status(400).json({ error: 'You cannot report yourself' });
      const { rows } = await query(
        `INSERT INTO user_reports
          (reporter_user_id, reported_user_id, service_id, service_name, reason, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, status, created_at`,
        [req.user.id, service.owner_user_id, service.id, service.name, reason, description]
      );
      return res.status(201).json({ report: {
        id: rows[0].id, status: rows[0].status, createdAt: rows[0].created_at
      } });
    }

    const { rows: conversations } = await query(
      `SELECT customer_user_id, provider_user_id, service_id
         FROM conversations
        WHERE id = $1 AND (customer_user_id = $2 OR provider_user_id = $2)`,
      [conversationId, req.user.id]
    );
    const conversation = conversations[0];
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const reportedUserId = req.user.id === conversation.customer_user_id
      ? conversation.provider_user_id : conversation.customer_user_id;
    if (reportedUserId === req.user.id) return res.status(400).json({ error: 'You cannot report yourself' });
    const { rows } = await query(
      `INSERT INTO user_reports
        (reporter_user_id, reported_user_id, conversation_id, service_id, reason, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, created_at`,
      [req.user.id, reportedUserId, conversationId, conversation.service_id, reason, description]
    );
    return res.status(201).json({ report: {
      id: rows[0].id,
      status: rows[0].status,
      createdAt: rows[0].created_at
    } });
  } catch (error) { return next(error); }
});

module.exports = router;
