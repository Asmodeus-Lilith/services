// src/seed.js
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFile } = require('./env');

loadEnvFile(path.resolve(__dirname, '..', '.env'));

const config = require('./config');
const { pool, withTransaction } = require('./db');
const { hashPassword } = require('./lib/passwords');

const SERVICE_COLUMNS = [
  'id',
  'name',
  'category',
  'description',
  'price',
  'original_price',
  'unit',
  'rating',
  'reviews',
  'image',
  'discount',
  'popular',
  'provider',
  'experience',
  'duration',
  'availability',
  'subjects',
  'inclusions'
];

function readCatalog() {
  const file = path.join(config.serverRoot, 'src', 'data', 'catalog.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));

  if (!Array.isArray(parsed.services) || !Array.isArray(parsed.categories)) {
    throw new Error(`${file} must contain "services" and "categories" arrays`);
  }

  return parsed;
}

const serviceValues = (service) => [
  service.id,
  service.name,
  service.category,
  service.description ?? '',
  service.price,
  service.originalPrice ?? null,
  service.unit ?? 'session',
  service.rating ?? 0,
  service.reviews ?? 0,
  service.image ?? null,
  service.discount ?? null,
  service.popular ?? false,
  service.provider ?? null,
  service.experience ?? null,
  service.duration ?? null,
  service.availability ?? null,
  service.subjects ?? [],
  service.includes ?? []
];

async function main() {
  const catalog = readCatalog();

  await withTransaction(async (client) => {
    // Categories first: services.category is a foreign key onto this table.
    let sortOrder = 0;
    for (const category of catalog.categories) {
      sortOrder += 1;
      await client.query(
        `INSERT INTO categories (id, name, icon, sort_order)
              VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE
                 SET name = EXCLUDED.name,
                     icon = EXCLUDED.icon,
                     sort_order = EXCLUDED.sort_order`,
        [category.id, category.name, category.icon ?? null, sortOrder]
      );
    }

    const { rows: serviceCount } = await client.query('SELECT count(*)::int AS total FROM services');
    const seedSampleCatalog = process.env.SEED_SAMPLE_CATALOG === 'true' ||
      (!config.isProduction && serviceCount[0].total === 0);
    if (seedSampleCatalog) {
      const placeholders = SERVICE_COLUMNS.map((_, index) => `$${index + 1}`).join(', ');
      const updates = SERVICE_COLUMNS.filter((column) => column !== 'id')
        .map((column) => `${column} = EXCLUDED.${column}`)
        .join(',\n                     ');

      for (const service of catalog.services) {
        await client.query(
          `INSERT INTO services (${SERVICE_COLUMNS.join(', ')})
                VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE
                   SET ${updates}`,
          serviceValues(service)
        );
      }
    }

    // Production admin provisioning is explicit and never uses a shipped password.
    const adminEmail = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
    if (adminEmail || adminPassword) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) || adminPassword.length < 12) {
        throw new Error('Set a valid BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters');
      }
      const passwordHash = await hashPassword(adminPassword);
      await client.query(
        `INSERT INTO users (name, email, password_hash, avatar, user_type)
              VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (lower(email)) DO NOTHING`,
        ['ServiceHub Administrator', adminEmail, passwordHash, null, 'admin']
      );
    }

    // Seed sample reviews only alongside the development/demo catalogue.
    const reviewSeeds = [
      { serviceId: 9, rating: 5, comment: 'Excellent service! The stylist was very professional and the haircut is perfect.' },
      { serviceId: 9, rating: 4, comment: 'Good experience overall. Arrived on time and did a great job.' },
      { serviceId: 10, rating: 5, comment: 'Amazing facial! My skin feels so refreshed and glowing.' },
      { serviceId: 5, rating: 5, comment: 'Best cleaning service ever! My house looks brand new.' },
      { serviceId: 5, rating: 4, comment: 'Very thorough cleaning. The team was punctual and professional.' },
      { serviceId: 1, rating: 5, comment: 'Dr. Sharma is an excellent tutor. My son improved a lot.' },
      { serviceId: 2, rating: 4, comment: 'Ms. Priya is very patient and explains concepts clearly.' },
      { serviceId: 12, rating: 5, comment: 'The bridal makeup was absolutely stunning! Highly recommended.' },
      { serviceId: 15, rating: 4, comment: 'Quick and efficient electrical work. Fair pricing too.' },
      { serviceId: 20, rating: 5, comment: 'Fixed my faucet in no time. Very professional plumber.' },
    ];

    if (seedSampleCatalog) {
      for (const review of reviewSeeds) {
        await client.query(
          `INSERT INTO reviews (service_id, user_id, owner_key, rating, comment)
           SELECT $1, NULL, $2, $3, $4
            WHERE NOT EXISTS (SELECT 1 FROM reviews WHERE owner_key = $2)`,
          [review.serviceId, `seed-review-${review.serviceId}`, review.rating, review.comment]
        );
      }
    }
  });

  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*) FROM categories) AS categories,
       (SELECT count(*) FROM services)   AS services`
  );

  console.log(`[seed] categories ready: ${rows[0].categories}; services: ${rows[0].services}`);
  if (config.isProduction && process.env.BOOTSTRAP_ADMIN_EMAIL) {
    console.log('[seed] bootstrap admin created if it did not already exist');
  }
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error.message || error.code || error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
