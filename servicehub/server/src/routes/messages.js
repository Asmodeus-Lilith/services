'use strict';

const crypto = require('node:crypto');
const express = require('express');
const { query, withTransaction } = require('../db');
const { requireUser } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rate-limit');

const router = express.Router();
const MAX_MESSAGE_LENGTH = 2000;

router.use(requireUser);

function requireCustomer(req, res, next) {
  if (req.user.userType !== 'customer') {
    return res.status(403).json({ error: 'Customer access required to start a conversation' });
  }
  return next();
}

function conversationId(req) {
  const id = String(req.params.id ?? '');
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

function messageId(req) {
  const id = String(req.params.messageId ?? '');
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

function messageBody(value) {
  if (typeof value !== 'string') return null;
  const body = value.trim();
  return body.length > 0 && body.length <= MAX_MESSAGE_LENGTH ? body : null;
}

const inboxLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: 'You are sending messages too quickly. Please try again shortly.'
});

router.get('/conversations', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.service_id, c.customer_user_id, c.provider_user_id,
              s.name AS service_name, c.created_at, c.updated_at,
              customer.name AS customer_name, customer.avatar AS customer_avatar,
              provider.name AS provider_name, provider.avatar AS provider_avatar,
              latest.body AS last_message, latest.created_at AS last_message_at,
              (SELECT count(*)::int FROM messages unread
                WHERE unread.conversation_id = c.id
                  AND unread.sender_user_id <> $1 AND unread.read_at IS NULL) AS unread_count
         FROM conversations c
         JOIN users customer ON customer.id = c.customer_user_id
         JOIN users provider ON provider.id = c.provider_user_id
         LEFT JOIN services s ON s.id = c.service_id
         LEFT JOIN LATERAL (
           SELECT body, created_at FROM messages
            WHERE conversation_id = c.id ORDER BY created_at DESC, id DESC LIMIT 1
         ) latest ON true
        WHERE c.customer_user_id = $1 OR c.provider_user_id = $1
        ORDER BY c.updated_at DESC, c.id DESC
        LIMIT 100`,
      [req.user.id]
    );

    const conversations = rows.map((row) => {
      const customerSide = req.user.id === row.customer_user_id;
      return {
        id: row.id,
        serviceId: row.service_id,
        serviceName: row.service_name || 'Service conversation',
        customerName: row.customer_name,
        providerName: row.provider_name,
        otherName: customerSide ? row.provider_name : row.customer_name,
        otherAvatar: customerSide ? row.provider_avatar : row.customer_avatar,
        lastMessage: row.last_message || '',
        lastMessageAt: row.last_message_at || row.updated_at,
        unreadCount: Number(row.unread_count),
        updatedAt: row.updated_at
      };
    });
    return res.json({ conversations });
  } catch (error) { return next(error); }
});

router.post('/conversations', requireCustomer, inboxLimiter, async (req, res, next) => {
  const serviceId = Number(req.body?.serviceId);
  const body = messageBody(req.body?.message);
  if (!Number.isSafeInteger(serviceId) || serviceId < 1) {
    return res.status(400).json({ error: 'Choose a valid service' });
  }
  if (!body) {
    return res.status(400).json({ error: `Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters` });
  }

  try {
    const { rows: services } = await query(
      `SELECT s.id, s.owner_user_id, u.user_type
         FROM services s
         JOIN users u ON u.id = s.owner_user_id AND u.is_active = true
        WHERE s.id = $1 AND s.is_active = true`,
      [serviceId]
    );
    const service = services[0];
    if (!service || service.user_type !== 'provider') {
      return res.status(404).json({ error: 'This service does not have an available provider account' });
    }
    if (service.owner_user_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot message yourself about your own service' });
    }

    const result = await withTransaction(async (client) => {
      const { rows: threads } = await client.query(
        `INSERT INTO conversations (id, customer_user_id, provider_user_id, service_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (customer_user_id, provider_user_id, service_id)
         DO UPDATE SET updated_at = conversations.updated_at
         RETURNING id`,
        [crypto.randomUUID(), req.user.id, service.owner_user_id, service.id]
      );
      const threadId = threads[0].id;
      const messageId = crypto.randomUUID();
      const { rows: messages } = await client.query(
        `INSERT INTO messages (id, conversation_id, sender_user_id, body)
         VALUES ($1, $2, $3, $4) RETURNING id, sender_user_id, body, created_at, read_at`,
        [messageId, threadId, req.user.id, body]
      );
      await client.query('UPDATE conversations SET updated_at = now() WHERE id = $1', [threadId]);
      return { conversationId: threadId, message: messages[0] };
    });

    return res.status(201).json({
      conversationId: result.conversationId,
      message: {
        id: result.message.id,
        senderId: result.message.sender_user_id,
        body: result.message.body,
        createdAt: result.message.created_at,
        readAt: result.message.read_at
      }
    });
  } catch (error) { return next(error); }
});

router.get('/conversations/:id/messages', async (req, res, next) => {
  const id = conversationId(req);
  if (!id) return res.status(400).json({ error: 'Invalid conversation id' });

  try {
    const { rows: conversations } = await query(
      `SELECT c.id, c.customer_user_id, c.service_id, s.name AS service_name,
              customer.name AS customer_name, provider.name AS provider_name,
              customer.avatar AS customer_avatar, provider.avatar AS provider_avatar
         FROM conversations c
         JOIN users customer ON customer.id = c.customer_user_id
         JOIN users provider ON provider.id = c.provider_user_id
         LEFT JOIN services s ON s.id = c.service_id
        WHERE c.id = $1 AND (c.customer_user_id = $2 OR c.provider_user_id = $2)`,
      [id, req.user.id]
    );
    const conversation = conversations[0];
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    await query(
      `UPDATE messages SET read_at = now()
        WHERE conversation_id = $1 AND sender_user_id <> $2 AND read_at IS NULL`,
      [id, req.user.id]
    );
    const { rows: messages } = await query(
      `SELECT id, sender_user_id, body, created_at, read_at
         FROM messages WHERE conversation_id = $1
        ORDER BY created_at, id LIMIT 500`,
      [id]
    );
    const customerSide = req.user.id === conversation.customer_user_id;
    return res.json({
      conversation: {
        id: conversation.id,
        serviceId: conversation.service_id,
        serviceName: conversation.service_name || 'Service conversation',
        customerName: conversation.customer_name,
        providerName: conversation.provider_name,
        otherName: customerSide ? conversation.provider_name : conversation.customer_name,
        otherAvatar: customerSide ? conversation.provider_avatar : conversation.customer_avatar
      },
      messages: messages.map((row) => ({
        id: row.id,
        senderId: row.sender_user_id,
        body: row.body,
        createdAt: row.created_at,
        readAt: row.read_at
      }))
    });
  } catch (error) { return next(error); }
});

router.post('/conversations/:id/messages', inboxLimiter, async (req, res, next) => {
  const id = conversationId(req);
  const body = messageBody(req.body?.message);
  if (!id) return res.status(400).json({ error: 'Invalid conversation id' });
  if (!body) {
    return res.status(400).json({ error: `Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters` });
  }

  try {
    const { rows: threads } = await query(
      `UPDATE conversations SET updated_at = now()
        WHERE id = $1 AND (customer_user_id = $2 OR provider_user_id = $2)
        RETURNING id`,
      [id, req.user.id]
    );
    if (!threads[0]) return res.status(404).json({ error: 'Conversation not found' });
    const { rows } = await query(
      `INSERT INTO messages (id, conversation_id, sender_user_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_user_id, body, created_at, read_at`,
      [crypto.randomUUID(), id, req.user.id, body]
    );
    const message = rows[0];
    return res.status(201).json({
      message: {
        id: message.id,
        senderId: message.sender_user_id,
        body: message.body,
        createdAt: message.created_at,
        readAt: message.read_at
      }
    });
  } catch (error) { return next(error); }
});

router.delete('/conversations/:id', async (req, res, next) => {
  const id = conversationId(req);
  if (!id) return res.status(400).json({ error: 'Invalid conversation id' });

  try {
    const { rows } = await query(
      `DELETE FROM conversations
        WHERE id = $1 AND (customer_user_id = $2 OR provider_user_id = $2)
       RETURNING id`,
      [id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ success: true, id: rows[0].id });
  } catch (error) { return next(error); }
});

router.delete('/conversations/:id/messages/:messageId', async (req, res, next) => {
  const id = conversationId(req);
  const mId = messageId(req);
  if (!id) return res.status(400).json({ error: 'Invalid conversation id' });
  if (!mId) return res.status(400).json({ error: 'Invalid message id' });

  try {
    const { rows } = await query(
      `DELETE FROM messages
        WHERE id = $1 AND conversation_id = $2 AND sender_user_id = $3
       RETURNING id`,
      [mId, id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Message not found or you cannot delete this message' });
    await query('UPDATE conversations SET updated_at = now() WHERE id = $1', [id]);
    return res.json({ success: true, id: rows[0].id });
  } catch (error) { return next(error); }
});

module.exports = router;
