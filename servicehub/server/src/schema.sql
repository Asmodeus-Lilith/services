-- schema.sql
-- ServiceHub database schema. Safe to run repeatedly: every statement is
-- idempotent, so `npm run migrate` doubles as "make sure the schema is current".

BEGIN;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  avatar        TEXT,
  user_type     TEXT        NOT NULL DEFAULT 'customer',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Case-insensitive uniqueness: nobody should be able to register John@x.com
-- on top of john@x.com.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

-- Opaque bearer tokens. Storing them server side means a sign-out actually
-- revokes access, which a self-contained token could not do.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT        PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  icon       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS services (
  id             INTEGER       PRIMARY KEY,
  name           TEXT          NOT NULL,
  category       TEXT          NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description    TEXT          NOT NULL DEFAULT '',
  price          NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  original_price NUMERIC(10,2) CHECK (original_price >= 0),
  unit           TEXT          NOT NULL DEFAULT 'session',
  rating         NUMERIC(2,1)  NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  reviews        INTEGER       NOT NULL DEFAULT 0 CHECK (reviews >= 0),
  image          TEXT,
  images         TEXT[]        NOT NULL DEFAULT '{}',
  discount       INTEGER       CHECK (discount BETWEEN 0 AND 100),
  popular        BOOLEAN       NOT NULL DEFAULT false,
  provider       TEXT,
  experience     TEXT,
  duration       TEXT,
  availability   TEXT,
  subjects       TEXT[]        NOT NULL DEFAULT '{}',
  -- `includes` is awkward to quote everywhere in SQL, so the column is called
  -- `inclusions`; the API still returns it as `includes`.
  inclusions     TEXT[]        NOT NULL DEFAULT '{}',
  owner_user_id  INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  is_active      BOOLEAN       NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Add provider ownership safely for databases created before provider tools.
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS services_category_idx ON services (category);
CREATE INDEX IF NOT EXISTS services_popular_idx ON services (popular);
CREATE INDEX IF NOT EXISTS services_owner_user_id_idx ON services (owner_user_id);

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS promotions (
  code            TEXT PRIMARY KEY,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),
  max_uses        INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses            INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT          PRIMARY KEY,
  user_id         INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  -- Mirrors the front end's owner concept: a signed-in user's email, or
  -- 'guest:<browser-key>' for bookings made before signing in.
  owner_key       TEXT          NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'upcoming',
  customer_name   TEXT          NOT NULL,
  customer_email  TEXT          NOT NULL,
  customer_phone  TEXT,
  address_line    TEXT,
  address_city    TEXT,
  address_pincode TEXT,
  schedule_date   DATE,
  schedule_time   TEXT,
  payment_method  TEXT          NOT NULL DEFAULT 'sslcommerz',
  payment_status  TEXT          NOT NULL DEFAULT 'unpaid',
  transaction_id  TEXT,
  payment_details JSONB,
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(10,2) NOT NULL DEFAULT 0,
  promo_code      TEXT,
  discount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_details JSONB;

CREATE INDEX IF NOT EXISTS orders_owner_key_idx ON orders (owner_key, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id);

-- Line items are snapshots: renaming or repricing a service must never rewrite
-- the receipt of an order that was already placed.
CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL        PRIMARY KEY,
  order_id   TEXT          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id INTEGER       REFERENCES services(id) ON DELETE SET NULL,
  name       TEXT          NOT NULL,
  price      NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  quantity   INTEGER       NOT NULL CHECK (quantity > 0),
  image      TEXT,
  unit       TEXT,
  category   TEXT,
  provider   TEXT
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

-- A signed-in visitor's cart lives here so it follows the account across
-- devices. Guests keep theirs in localStorage instead.
CREATE TABLE IF NOT EXISTS cart_items (
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id INTEGER     NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  quantity   INTEGER     NOT NULL CHECK (quantity > 0 AND quantity <= 20),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, service_id)
);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  service_id INTEGER     NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id    INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  owner_key  TEXT        NOT NULL,
  rating     INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_service_id_idx ON reviews (service_id);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews (user_id);
CREATE INDEX IF NOT EXISTS reviews_owner_key_idx ON reviews (owner_key);

-- ---------------------------------------------------------------------------
-- Wishlists
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wishlists (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  owner_key  TEXT        NOT NULL,
  service_id INTEGER     NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_id),
  UNIQUE (owner_key, service_id)
);

CREATE INDEX IF NOT EXISTS wishlists_user_id_idx ON wishlists (user_id);
CREATE INDEX IF NOT EXISTS wishlists_owner_key_idx ON wishlists (owner_key);
CREATE INDEX IF NOT EXISTS wishlists_service_id_idx ON wishlists (service_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  owner_key  TEXT        NOT NULL,
  type       TEXT        NOT NULL DEFAULT 'info',
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  read       BOOLEAN     NOT NULL DEFAULT false,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_owner_key_idx ON notifications (owner_key);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications (read);

-- ---------------------------------------------------------------------------
-- Private customer/provider conversations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conversations (
  id                TEXT        PRIMARY KEY,
  customer_user_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_user_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id        INTEGER     REFERENCES services(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_user_id, provider_user_id, service_id),
  CHECK (customer_user_id <> provider_user_id)
);

CREATE INDEX IF NOT EXISTS conversations_customer_idx ON conversations (customer_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_provider_idx ON conversations (provider_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id                 TEXT        PRIMARY KEY,
  conversation_id    TEXT        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body               TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at, id);
CREATE INDEX IF NOT EXISTS messages_unread_idx ON messages (conversation_id, sender_user_id) WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- User/provider reports
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_reports (
  id                BIGSERIAL PRIMARY KEY,
  reporter_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id   TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  service_id        INTEGER,
  service_name      TEXT NOT NULL DEFAULT '',
  reason            TEXT NOT NULL CHECK (reason IN (
    'harassment', 'fraud', 'inappropriate_behavior', 'service_quality',
    'safety_concern', 'other'
  )),
  description       TEXT NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  admin_note        TEXT NOT NULL DEFAULT '' CHECK (char_length(admin_note) <= 1000),
  reviewed_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reporter_user_id <> reported_user_id),
  CHECK (conversation_id IS NOT NULL OR service_id IS NOT NULL)
);

ALTER TABLE user_reports ALTER COLUMN conversation_id DROP NOT NULL;
ALTER TABLE user_reports ADD COLUMN IF NOT EXISTS service_id INTEGER;
ALTER TABLE user_reports ADD COLUMN IF NOT EXISTS service_name TEXT NOT NULL DEFAULT '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_reports_context_check') THEN
    ALTER TABLE user_reports ADD CONSTRAINT user_reports_context_check
      CHECK (conversation_id IS NOT NULL OR service_id IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints
    WHERE constraint_name = 'user_reports_conversation_id_fkey' AND delete_rule <> 'SET NULL'
  ) THEN
    ALTER TABLE user_reports DROP CONSTRAINT user_reports_conversation_id_fkey;
    ALTER TABLE user_reports ADD CONSTRAINT user_reports_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_reports_status_created_idx ON user_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS user_reports_reporter_idx ON user_reports (reporter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_reports_target_idx ON user_reports (reported_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            BIGSERIAL   PRIMARY KEY,
  actor_user_id INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  target_type   TEXT        NOT NULL CHECK (target_type IN ('service', 'account')),
  target_id     TEXT        NOT NULL,
  target_name   TEXT        NOT NULL,
  action        TEXT        NOT NULL CHECK (action IN ('service_deleted', 'account_suspended', 'account_restored')),
  reason        TEXT        NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON admin_audit_log (target_type, target_id, created_at DESC);

COMMIT;
