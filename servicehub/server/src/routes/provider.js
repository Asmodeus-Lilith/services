'use strict';

const express = require('express');
const { query, withTransaction } = require('../db');
const { toService } = require('../lib/serialize');
const { requireUser } = require('../middleware/auth');
const { collectStreamBuffer, parseMultipartBody, saveImageFile } = require('../lib/upload');

const router = express.Router();
const MAX_PRICE = 99_999_999.99;

function requireProvider(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue' });
  if (req.user.userType !== 'provider') {
    return res.status(403).json({ error: 'Service provider access required' });
  }
  return next();
}

router.use(requireUser, requireProvider);

function isValidImageRef(value) {
  if (!value || typeof value !== 'string') return false;
  const str = value.trim();
  if (!str) return false;
  // Local or relative uploads
  if (/^\/(?:api\/)?uploads\/[a-zA-Z0-9_\-.]+$/.test(str)) return true;
  // Base64 data URLs
  if (/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(str)) return true;
  // HTTPS URLs
  try {
    const parsed = new URL(str);
    return parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function serviceInput(body = {}) {
  const name = String(body.name ?? '').trim();
  const category = String(body.category ?? '').trim();
  const description = String(body.description ?? '').trim();
  const price = Number(body.price);
  const unit = String(body.unit ?? 'session').trim();
  const rawImage = String(body.image ?? '').trim();
  const rawImages = Array.isArray(body.images)
    ? body.images.map((entry) => String(entry).trim()).filter(Boolean)
    : (body.images ? String(body.images).split(',').map((entry) => entry.trim()).filter(Boolean) : []);

  if (!name || name.length > 120) throw new Error('Service name is required (up to 120 characters)');
  if (!category) throw new Error('Choose a service category');
  if (description.length < 20 || description.length > 5000) {
    throw new Error('Description must be between 20 and 5000 characters');
  }
  if (!Number.isFinite(price) || price < 1 || price > MAX_PRICE) {
    throw new Error('Enter a valid price greater than zero');
  }
  if (!unit || unit.length > 40) throw new Error('Enter a price unit up to 40 characters');

  const images = [];
  if (rawImage) images.push(rawImage);
  for (const img of rawImages) {
    if (!images.includes(img)) images.push(img);
  }

  for (const img of images) {
    if (!isValidImageRef(img)) {
      throw new Error('Service images must be valid HTTPS URLs or uploaded image files');
    }
  }

  const primaryImage = images[0] || null;

  const list = (value) => Array.isArray(value)
    ? value.map((entry) => String(entry).trim().slice(0, 120)).filter(Boolean).slice(0, 20)
    : String(value ?? '').split(',').map((entry) => entry.trim().slice(0, 120)).filter(Boolean).slice(0, 20);

  return {
    name,
    category,
    description,
    price: Math.round(price * 100) / 100,
    unit,
    image: primaryImage,
    images,
    experience: String(body.experience ?? '').trim().slice(0, 80) || null,
    duration: String(body.duration ?? '').trim().slice(0, 80) || null,
    availability: String(body.availability ?? '').trim().slice(0, 160) || null,
    subjects: list(body.subjects),
    inclusions: list(body.includes)
  };
}

async function validateCategory(category) {
  const { rows } = await query('SELECT 1 FROM categories WHERE id = $1', [category]);
  return rows.length > 0;
}

const providerServiceColumns = `id, name, category, description, price, original_price,
  unit, rating, reviews, image, images, discount, popular, provider, experience,
  duration, availability, subjects, inclusions, is_active`;

router.post('/upload', async (req, res, next) => {
  try {
    const contentType = req.headers['content-type'] || '';
    let filesToProcess = [];

    if (contentType.includes('multipart/form-data')) {
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]).trim() : null;
      if (!boundary) {
        return res.status(400).json({ error: 'Malformed multipart request: missing boundary' });
      }
      const rawBuffer = await collectStreamBuffer(req);
      filesToProcess = parseMultipartBody(rawBuffer, boundary);
    } else if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
      const rawBuffer = await collectStreamBuffer(req);
      filesToProcess = [{
        filename: req.headers['x-file-name'] ? decodeURIComponent(req.headers['x-file-name']) : 'service-photo.jpg',
        contentType,
        data: rawBuffer
      }];
    } else if (req.body && (req.body.data || Array.isArray(req.body.files))) {
      const items = Array.isArray(req.body.files) ? req.body.files : [req.body];
      for (const item of items) {
        const dataUrl = item.data || item.url || '';
        const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (match) {
          filesToProcess.push({
            filename: item.filename || item.name || 'service-photo.jpg',
            contentType: match[1],
            data: Buffer.from(match[2], 'base64')
          });
        }
      }
    }

    if (!filesToProcess || filesToProcess.length === 0) {
      return res.status(400).json({ error: 'No image file found in the request. Please choose an image from your PC.' });
    }

    const savedFiles = [];
    for (const file of filesToProcess) {
      if (!file.data || file.data.length === 0) continue;
      const saved = await saveImageFile(file.data, file.filename);
      savedFiles.push(saved);
    }

    if (savedFiles.length === 0) {
      return res.status(400).json({ error: 'No valid image data was received.' });
    }

    return res.status(201).json({
      url: savedFiles[0].url,
      urls: savedFiles.map((f) => f.url),
      files: savedFiles
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
});

router.get('/services', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ${providerServiceColumns} FROM services
        WHERE owner_user_id = $1 ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );
    return res.json({ services: rows.map((row) => ({ ...toService(row), isActive: row.is_active })) });
  } catch (error) { return next(error); }
});

router.post('/services', async (req, res, next) => {
  try {
    let input;
    try { input = serviceInput(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    if (!(await validateCategory(input.category))) {
      return res.status(400).json({ error: 'That service category does not exist' });
    }

    const { rows } = await withTransaction(async (client) => {
      // Serialize id allocation because the existing catalogue uses explicit IDs.
      await client.query('SELECT pg_advisory_xact_lock(74102, 1)');
      const { rows: ids } = await client.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM services');
      return client.query(
        `INSERT INTO services
          (id, name, category, description, price, unit, image, images, provider, experience,
           duration, availability, subjects, inclusions, owner_user_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
         RETURNING ${providerServiceColumns}`,
        [ids[0].id, input.name, input.category, input.description, input.price, input.unit,
          input.image, input.images, req.user.name, input.experience, input.duration,
          input.availability, input.subjects, input.inclusions, req.user.id]
      );
    });
    return res.status(201).json({ service: { ...toService(rows[0]), isActive: true } });
  } catch (error) { return next(error); }
});

router.put('/services/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Service id must be a number' });
    let input;
    try { input = serviceInput(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    if (!(await validateCategory(input.category))) {
      return res.status(400).json({ error: 'That service category does not exist' });
    }

    const { rows } = await query(
      `UPDATE services SET name = $1, category = $2, description = $3, price = $4,
          unit = $5, image = $6, images = $7, provider = $8, experience = $9, duration = $10,
          availability = $11, subjects = $12, inclusions = $13
        WHERE id = $14 AND owner_user_id = $15
        RETURNING ${providerServiceColumns}`,
      [input.name, input.category, input.description, input.price, input.unit, input.image,
        input.images, req.user.name, input.experience, input.duration, input.availability,
        input.subjects, input.inclusions, id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Service not found' });
    return res.json({ service: { ...toService(rows[0]), isActive: rows[0].is_active } });
  } catch (error) { return next(error); }
});

router.patch('/services/:id/availability', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || typeof req.body?.isActive !== 'boolean') {
      return res.status(400).json({ error: 'Provide a valid service id and availability' });
    }
    const { rows } = await query(
      `UPDATE services SET is_active = $1 WHERE id = $2 AND owner_user_id = $3
       RETURNING id, is_active`,
      [req.body.isActive, id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Service not found' });
    return res.json({ id: rows[0].id, isActive: rows[0].is_active });
  } catch (error) { return next(error); }
});

router.get('/payments', async (req, res, next) => {
  try {
    const [paymentResult, totalResult] = await Promise.all([
      query(
        `SELECT oi.order_id, oi.name AS service_name, oi.quantity, oi.price,
                o.status, o.payment_method, o.created_at
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN services s ON s.id = oi.service_id
          WHERE s.owner_user_id = $1 AND o.status <> 'cancelled'
          ORDER BY o.created_at DESC, oi.id DESC
          LIMIT 100`,
        [req.user.id]
      ),
      query(
        `SELECT
           COALESCE(SUM(oi.price * oi.quantity) FILTER (WHERE o.status = 'delivered'), 0) AS completed,
           COALESCE(SUM(oi.price * oi.quantity) FILTER (WHERE o.status IN ('upcoming', 'in_progress')), 0) AS pending
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN services s ON s.id = oi.service_id
         WHERE s.owner_user_id = $1 AND o.status <> 'cancelled'`,
        [req.user.id]
      )
    ]);
    const { rows } = paymentResult;
    const payments = rows.map((row) => ({
      orderId: row.order_id,
      serviceName: row.service_name,
      quantity: row.quantity,
      amount: Number(row.price) * row.quantity,
      status: row.status,
      paymentMethod: row.payment_method,
      createdAt: row.created_at
    }));
    const totals = {
      completed: Number(totalResult.rows[0].completed),
      pending: Number(totalResult.rows[0].pending)
    };
    return res.json({ payments, totals });
  } catch (error) { return next(error); }
});

module.exports = router;
