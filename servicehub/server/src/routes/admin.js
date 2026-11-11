// src/routes/admin.js
'use strict';

const express = require('express');
const { query, withTransaction } = require('../db');
const { toAdminOrder } = require('../lib/serialize');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const ORDER_COLUMNS = `o.id, o.user_id, o.owner_key, o.status,
  o.customer_name, o.customer_email, o.customer_phone,
  o.address_line, o.address_city, o.address_pincode,
  o.schedule_date, o.schedule_time, o.payment_method,
  o.payment_status, o.transaction_id, o.payment_details,
  o.subtotal, o.tax, o.promo_code, o.discount, o.total, o.created_at`;

const VALID_TRANSITIONS = {
  upcoming: ['in_progress', 'cancelled'],
  in_progress: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: []
};

const moderationReason = (value) => {
  if (typeof value !== 'string') return null;
  const reason = value.trim();
  return reason.length >= 3 && reason.length <= 500 ? reason : null;
};

const pageOptions = (queryParams) => {
  const page = Math.max(1, Number.parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(queryParams.limit, 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
};

const promotionCode = (value) => String(value ?? '').trim().toUpperCase();

router.get('/reports', requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = pageOptions(req.query);
    const status = ['pending', 'reviewed', 'dismissed'].includes(req.query.status)
      ? req.query.status : '';
    const search = String(req.query.q ?? '').trim().slice(0, 120);
    const conditions = [];
    const params = [];
    if (status) {
      params.push(status);
      conditions.push(`r.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(reporter.name ILIKE $${params.length} OR reporter.email ILIKE $${params.length}
        OR target.name ILIKE $${params.length} OR target.email ILIKE $${params.length}
        OR r.description ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const from = `FROM user_reports r
      JOIN users reporter ON reporter.id = r.reporter_user_id
      JOIN users target ON target.id = r.reported_user_id
      LEFT JOIN conversations c ON c.id = r.conversation_id
      LEFT JOIN services s ON s.id = COALESCE(r.service_id, c.service_id)`;
    const count = await query(`SELECT count(*)::int AS total ${from} ${where}`, params);
    const { rows } = await query(
      `SELECT r.id, r.reporter_user_id, r.reported_user_id, r.conversation_id, r.service_id,
              r.reason, r.description, r.status, r.admin_note, r.reviewed_at, r.created_at,
              reporter.name AS reporter_name, reporter.email AS reporter_email,
              reporter.user_type AS reporter_type, target.name AS target_name,
              target.email AS target_email, target.user_type AS target_type,
              COALESCE(r.service_name, s.name) AS service_name, reviewer.name AS reviewer_name
         ${from}
         LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
         ${where}
        ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC, r.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({
      reports: rows.map((row) => ({
        id: row.id,
        reporter: { id: row.reporter_user_id, name: row.reporter_name, email: row.reporter_email, userType: row.reporter_type },
        reportedUser: { id: row.reported_user_id, name: row.target_name, email: row.target_email, userType: row.target_type },
        conversationId: row.conversation_id,
        serviceId: row.service_id,
        serviceName: row.service_name || 'Service conversation',
        reason: row.reason,
        description: row.description,
        status: row.status,
        adminNote: row.admin_note,
        reviewedAt: row.reviewed_at,
        reviewerName: row.reviewer_name,
        createdAt: row.created_at
      })),
      pagination: { page, limit, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / limit) }
    });
  } catch (error) { return next(error); }
});

router.patch('/reports/:id', requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim() : '';
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid report id' });
  if (!['pending', 'reviewed', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Choose pending, reviewed, or dismissed' });
  }
  if (adminNote.length > 1000) return res.status(400).json({ error: 'Admin note must be 1,000 characters or fewer' });
  try {
    const { rows } = await query(
      `UPDATE user_reports
          SET status = $1, admin_note = $2,
              reviewed_by = CASE WHEN $1 = 'pending' THEN NULL ELSE $3 END,
              reviewed_at = CASE WHEN $1 = 'pending' THEN NULL ELSE now() END
        WHERE id = $4
        RETURNING id, status, admin_note, reviewed_at`,
      [status, adminNote, req.user.id, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    return res.json({ report: {
      id: rows[0].id,
      status: rows[0].status,
      adminNote: rows[0].admin_note,
      reviewedAt: rows[0].reviewed_at
    } });
  } catch (error) { return next(error); }
});

router.get('/promotions', requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT code, discount_percent, max_uses, uses, expires_at, is_active, created_at
         FROM promotions ORDER BY created_at DESC, code`
    );
    return res.json({ promotions: rows.map((row) => ({
      code: row.code,
      discountPercent: row.discount_percent,
      maxUses: row.max_uses,
      uses: row.uses,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      createdAt: row.created_at
    })) });
  } catch (error) { return next(error); }
});

router.post('/promotions', requireAdmin, async (req, res, next) => {
  const code = promotionCode(req.body?.code);
  const discountPercent = Number(req.body?.discountPercent);
  const maxUses = req.body?.maxUses === '' || req.body?.maxUses == null
    ? null : Number(req.body.maxUses);
  const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return res.status(400).json({ error: 'Code must be 3–32 letters, numbers, hyphens, or underscores' });
  }
  if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 90) {
    return res.status(400).json({ error: 'Discount must be between 1 and 90 percent' });
  }
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
    return res.status(400).json({ error: 'Maximum uses must be a positive whole number' });
  }
  if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) {
    return res.status(400).json({ error: 'Expiry must be a future date and time' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO promotions (code, discount_percent, max_uses, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO NOTHING
       RETURNING code, discount_percent, max_uses, uses, expires_at, is_active, created_at`,
      [code, discountPercent, maxUses, expiresAt, req.user.id]
    );
    if (!rows[0]) return res.status(409).json({ error: 'That promotion code already exists' });
    const row = rows[0];
    return res.status(201).json({ promotion: {
      code: row.code, discountPercent: row.discount_percent, maxUses: row.max_uses,
      uses: row.uses, expiresAt: row.expires_at, isActive: row.is_active, createdAt: row.created_at
    } });
  } catch (error) { return next(error); }
});

router.patch('/promotions/:code', requireAdmin, async (req, res, next) => {
  if (typeof req.body?.isActive !== 'boolean') {
    return res.status(400).json({ error: 'Provide an active status' });
  }
  try {
    const { rows } = await query(
      `UPDATE promotions SET is_active = $1 WHERE code = $2 RETURNING code, is_active`,
      [req.body.isActive, promotionCode(req.params.code)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Promotion code not found' });
    return res.json({ code: rows[0].code, isActive: rows[0].is_active });
  } catch (error) { return next(error); }
});

const STATUS_MESSAGES = {
  in_progress: {
    title: 'Order Confirmed',
    message: (id) => `Your order #${id} has been confirmed and is now in progress.`
  },
  delivered: {
    title: 'Order Delivered',
    message: (id) => `Your order #${id} has been delivered. Thank you for choosing ServiceHub!`
  },
  cancelled: {
    title: 'Order Cancelled',
    message: (id) => `Your order #${id} has been cancelled.`
  }
};

async function notifyUser(userId, orderId, status) {
  const info = STATUS_MESSAGES[status];
  if (!info) return;
  await query(
    `INSERT INTO notifications (user_id, owner_key, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, `order-${orderId}`, 'order_update', info.title, info.message(orderId), `/order-confirmation/${orderId}`]
  );
}

/** List all orders with optional status filter and pagination. */
router.get('/orders', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      whereClause += ` AND o.status = $${params.length}`;
    }

    // Count total
    const countRes = await query(
      `SELECT count(*)::int AS total FROM orders o ${whereClause}`,
      params
    );
    const total = countRes.rows[0].total;

    // Fetch orders
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT ${ORDER_COLUMNS}
         FROM orders o
         ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Fetch items
    let itemRows = { rows: [] };
    if (rows.length > 0) {
      itemRows = await query(
        'SELECT * FROM order_items WHERE order_id = ANY($1::text[]) ORDER BY id',
        [rows.map((row) => row.id)]
      );
    }

    const grouped = new Map();
    for (const item of itemRows.rows) {
      const existing = grouped.get(item.order_id);
      if (existing) existing.push(item);
      else grouped.set(item.order_id, [item]);
    }

    const orders = rows.map((row) =>
      toAdminOrder(row, grouped.get(row.id) ?? [])
    );

    return res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return next(error);
  }
});

/** Update an order's status. */
router.patch('/orders/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body ?? {};
    if (!status || !VALID_TRANSITIONS[status]) {
      return res.status(400).json({
        error: `Valid statuses: ${Object.keys(VALID_TRANSITIONS).join(', ')}`
      });
    }

    const { rows } = await query(
      'SELECT status FROM orders WHERE id = $1',
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const current = rows[0].status;
    const allowed = VALID_TRANSITIONS[current] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from "${current}" to "${status}"`
      });
    }

    const { rows: updated } = await query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    // Notify the order's user about the status change
    await notifyUser(updated[0].user_id, req.params.id, status);

    const itemRows = await query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id',
      [req.params.id]
    );

    const grouped = new Map();
    for (const item of itemRows.rows) {
      grouped.set(item.order_id, [item]);
    }

    const order = toAdminOrder(updated[0], grouped.get(updated[0].id) ?? []);

    return res.json({ order });
  } catch (error) {
    return next(error);
  }
});

/** Admin summary stats. */
router.get('/stats', requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        count(*)::int AS total_orders,
        count(*) FILTER (WHERE status = 'upcoming')::int AS upcoming,
        count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        count(*) FILTER (WHERE status = 'delivered')::int AS delivered,
        count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        coalesce(sum(total), 0)::numeric(10,2) AS revenue
      FROM orders
    `);

    return res.json({ stats: rows[0] });
  } catch (error) {
    return next(error);
  }
});

/** Search the active and suspended marketplace listings. */
router.get('/moderation/services', requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = pageOptions(req.query);
    const search = String(req.query.q ?? '').trim().slice(0, 120);
    const params = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE s.name ILIKE $1 OR s.provider ILIKE $1 OR owner.name ILIKE $1`;
    }
    const count = await query(
      `SELECT count(*)::int AS total FROM services s
        LEFT JOIN users owner ON owner.id = s.owner_user_id ${where}`,
      params
    );
    const rowsResult = await query(
      `SELECT s.id, s.name, s.category, s.price, s.unit, s.provider,
              s.is_active, s.created_at, owner.id AS owner_user_id,
              owner.name AS owner_name, owner.email AS owner_email,
              owner.is_active AS owner_is_active
         FROM services s
         LEFT JOIN users owner ON owner.id = s.owner_user_id
         ${where}
        ORDER BY s.created_at DESC, s.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({
      services: rowsResult.rows.map((row) => ({
        ...row,
        price: Number(row.price),
        isActive: row.is_active,
        ownerUserId: row.owner_user_id,
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
        ownerIsActive: row.owner_is_active,
        createdAt: row.created_at
      })),
      pagination: { page, limit, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / limit) }
    });
  } catch (error) { return next(error); }
});

/** Search only customer/provider accounts; administrator accounts are protected. */
router.get('/moderation/accounts', requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = pageOptions(req.query);
    const search = String(req.query.q ?? '').trim().slice(0, 120);
    const type = ['customer', 'provider'].includes(req.query.type) ? req.query.type : '';
    const active = ['active', 'suspended'].includes(req.query.status) ? req.query.status : '';
    const conditions = ["user_type IN ('customer', 'provider')"];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }
    if (type) {
      params.push(type);
      conditions.push(`user_type = $${params.length}`);
    }
    if (active) {
      params.push(active === 'active');
      conditions.push(`is_active = $${params.length}`);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const count = await query(`SELECT count(*)::int AS total FROM users ${where}`, params);
    const rows = await query(
      `SELECT u.id, u.name, u.email, u.user_type, u.is_active, u.created_at,
              (SELECT count(*)::int FROM services s WHERE s.owner_user_id = u.id) AS service_count,
              (SELECT count(*)::int FROM orders o WHERE o.user_id = u.id) AS booking_count
         FROM users u ${where}
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({
      accounts: rows.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        userType: row.user_type,
        isActive: row.is_active,
        createdAt: row.created_at,
        serviceCount: row.service_count,
        bookingCount: row.booking_count
      })),
      pagination: { page, limit, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / limit) }
    });
  } catch (error) { return next(error); }
});

/** Delete a listing while retaining order-item snapshots and an audit record. */
router.delete('/moderation/services/:id', requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  const reason = moderationReason(req.body?.reason);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid service id' });
  if (!reason) return res.status(400).json({ error: 'Provide a reason between 3 and 500 characters' });
  try {
    const deleted = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT id, name FROM services WHERE id = $1 FOR UPDATE', [id]);
      if (!rows[0]) return null;
      await client.query('DELETE FROM services WHERE id = $1', [id]);
      await client.query(
        `INSERT INTO admin_audit_log (actor_user_id, target_type, target_id, target_name, action, reason)
         VALUES ($1, 'service', $2, $3, 'service_deleted', $4)`,
        [req.user.id, String(id), rows[0].name, reason]
      );
      return rows[0];
    });
    if (!deleted) return res.status(404).json({ error: 'Service not found' });
    return res.json({ removed: true, id, name: deleted.name });
  } catch (error) { return next(error); }
});

/** Suspend or restore a customer/provider account and record the moderation reason. */
router.patch('/moderation/accounts/:id/status', requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  const { isActive } = req.body ?? {};
  const reason = moderationReason(req.body?.reason);
  if (!Number.isSafeInteger(id) || id < 1 || typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'Provide a valid account id and status' });
  }
  if (!reason) return res.status(400).json({ error: 'Provide a reason between 3 and 500 characters' });
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot suspend your own administrator account' });

  try {
    const account = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, name, email, user_type, is_active FROM users WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const target = rows[0];
      if (!target || !['customer', 'provider'].includes(target.user_type)) return { forbidden: true };
      if (target.is_active === isActive) return { account: target, changed: false };
      const { rows: updated } = await client.query(
        `UPDATE users SET is_active = $1 WHERE id = $2
         RETURNING id, name, email, user_type, is_active`,
        [isActive, id]
      );
      if (!isActive) await client.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      await client.query(
        `INSERT INTO admin_audit_log (actor_user_id, target_type, target_id, target_name, action, reason)
         VALUES ($1, 'account', $2, $3, $4, $5)`,
        [req.user.id, String(id), target.email, isActive ? 'account_restored' : 'account_suspended', reason]
      );
      return { account: updated[0], changed: true };
    });
    if (account.forbidden) return res.status(404).json({ error: 'Customer or provider account not found' });
    return res.json({
      changed: account.changed,
      account: {
        id: account.account.id,
        name: account.account.name,
        email: account.account.email,
        userType: account.account.user_type,
        isActive: account.account.is_active
      }
    });
  } catch (error) { return next(error); }
});

router.get('/moderation/audit', requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT log.id, log.target_type, log.target_id, log.target_name, log.action,
              log.reason, log.created_at, actor.name AS actor_name
         FROM admin_audit_log log
         LEFT JOIN users actor ON actor.id = log.actor_user_id
        ORDER BY log.created_at DESC, log.id DESC LIMIT 100`
    );
    return res.json({ audit: rows.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      targetName: row.target_name,
      action: row.action,
      reason: row.reason,
      createdAt: row.created_at,
      actorName: row.actor_name || 'Former admin'
    })) });
  } catch (error) { return next(error); }
});

module.exports = router;
