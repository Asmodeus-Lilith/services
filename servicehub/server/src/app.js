// src/app.js
'use strict';

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const { query } = require('./db');
const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const orderRoutes = require('./routes/orders');
const cartRoutes = require('./routes/cart');
const adminRoutes = require('./routes/admin');
const reviewRoutes = require('./routes/reviews');
const wishlistRoutes = require('./routes/wishlist');
const notificationRoutes = require('./routes/notifications');
const providerRoutes = require('./routes/provider');
const messageRoutes = require('./routes/messages');
const promotionRoutes = require('./routes/promotions');
const reportRoutes = require('./routes/reports');
const paymentRoutes = require('./routes/payment');
const config = require('./config');

const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

const allowedOrigins = () => {
  const configured = process.env.CORS_ORIGIN;
  if (!configured) return config.isProduction ? [] : DEFAULT_ORIGINS;
  return configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

function createApp() {
  const app = express();
  const origins = allowedOrigins();

  app.disable('x-powered-by');
  app.disable('etag');
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'DENY');
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    if (config.isProduction) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));

  // The React dev server proxies /api, so same-origin requests never need this.
  // It exists for a production build served from its own port.
  app.use((req, res, next) => {
    const origin = req.get('origin');

    if (origin && (origins.includes('*') || origins.includes(origin))) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Guest-Key'
      );
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }

    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  // Resolves the caller once, for every API route.
  app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));

  // Readiness is intentionally checked before session lookup so container
  // health checks do not need a database query per request just to resolve an
  // optional bearer token.
  app.get('/api/health', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      await query('SELECT 1');
      return res.json({ status: 'ok', database: 'up' });
    } catch (error) {
      console.error('[health] database readiness check failed:', error.message);
      return res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });

  const uploadsDir = config.uploadsDir;
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const staticUploadOptions = {
    maxAge: '7d',
    setHeaders(res) {
      res.set('X-Content-Type-Options', 'nosniff');
    }
  };
  app.use('/api/uploads', express.static(uploadsDir, staticUploadOptions));
  app.use('/uploads', express.static(uploadsDir, staticUploadOptions));

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    return attachUser(req, res, next);
  });

  app.use('/api/auth', authRoutes);
  // Register feature-specific API routers before broader route groups so a
  // future catch-all inside another router cannot shadow messaging endpoints.
  app.use('/api/messages', messageRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/promotions', promotionRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/wishlist', wishlistRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/provider', providerRoutes);

  app.use('/api', (req, res) => {
    console.warn(`[api] unknown endpoint: ${req.method} ${req.path}`);
    return res.status(404).json({ error: 'Unknown API endpoint' });
  });

  if (config.isProduction) {
    app.use(express.static(config.webRoot, {
      index: false,
      maxAge: '1d',
      setHeaders(res, filePath) {
        if (path.basename(filePath) === 'index.html') res.set('Cache-Control', 'no-cache');
        // Vite fingerprints generated assets, so they can be cached for a year.
        else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.set('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req, res, next) => {
      // Only browser document navigations should receive the SPA shell.
      // Missing scripts, images, and API routes must keep their real 404s.
      if (req.path.startsWith('/api/') || path.extname(req.path) || !req.accepts('html')) {
        return next();
      }
      res.set('Cache-Control', 'no-cache');
      return res.sendFile(path.join(config.webRoot, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must be valid JSON' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large' });
    }

    console.error('[api] unhandled error:', error.message);
    return res.status(500).json({ error: 'Something went wrong on our side' });
  });

  return app;
}

module.exports = { createApp, allowedOrigins };
