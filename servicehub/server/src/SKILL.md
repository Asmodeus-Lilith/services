---
name: postgresql-setup-node
description: "Configure Node.js projects to use PostgreSQL as the database."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [database, postgresql, node, backend, sql]
---

# PostgreSQL Setup for Node.js Projects

Use this skill when setting up PostgreSQL as the database for a Node.js backend application. This covers connection configuration, schema management, migrations, and deployment patterns.

## Quick Start Commands

```bash
# Install PostgreSQL driver
npm install pg

# Run migrations
npm run migrate    # Creates database and tables

# Seed test data
npm run seed

# Reset database
npm run reset      # DROP + recreate + seed

# Start server
npm start
```

## Core Components

### 1. Connection Pool (`src/db.js`)

```javascript
const { Pool, types } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

module.exports = { pool, query, withTransaction };
```

**Pitfall**: Always use a connection pool with proper timeouts. Direct client connections in production will exhaust database connections.

### 2. Database URL Environmental Variable

```
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/database_name
```

**Always** set this in `.env` file and add to `.gitignore`. Never commit credentials.

### 3. Environment Loading (`.env` handling)

```javascript
const path = require('node:path');
const { loadEnvFile } = require('./env');

loadEnvFile(path.resolve(__dirname, '..', '.env'));
```

Create `env.js` to load env files early before other imports read `process.env`.

## Migration Workflow

### Self-Healing Migrations

Migration scripts should be idempotent - safe to run multiple times. This allows `npm run migrate` to serve as both initial setup and "current state verification".

```javascript
// In migrate.js
await pool.query(schema);  // schema.sql uses CREATE TABLE IF NOT EXISTS
```

### Database Auto-Creation

The `ensureDatabase` helper creates the target database if missing:

```javascript
async function ensureDatabase() {
  const client = new Client({ connectionString: maintenanceUrl });
  await client.connect();
  // Check if database exists, create if not
}
```

This enables one-command setup: users only run `npm run migrate` without needing to manually create the database first.

## Schema Design Patterns

### Use SERIAL for Auto-Increment IDs

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
```

**Pitfall**: SERIAL creates a sequence. Use IDENTITY (SQL:2003) instead if you need standard-conforming auto-increment.

### Case-Insensitive Unique Indexes

```sql
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
```

This prevents `john@example.com` and `JOHN@example.com` from both being registered.

### NUMERIC for Money

```sql
price NUMERIC(10,2) NOT NULL CHECK (price >= 0)
```

NUMERIC avoids floating-point precision issues. In `db.js`, configure the driver to parse as Number:

```javascript
const { types } = require('pg');
types.setTypeParser(types.builtins.NUMERIC, (value) =>
  value === null ? null : Number(value)
);
```

### Keep DATE as String

```javascript
types.setTypeParser(types.builtins.DATE, (value) => value);
```

**Pitfall**: pg's default DATE parser converts to local midnight Date objects. This can shift dates when serialized to JSON across time zones. Keeping as 'YYYY-MM-DD' string avoids this.

## Transaction Helper Pattern

```javascript
async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
```

Use this pattern for any multi-statement operation that should succeed or fail atomically.

## Seed Data Pattern

`seed.js` loads initial reference data:

```javascript
const { query } = require('./db');
const categories = ['Cleaning', 'Repair', 'Design'];
for (const name of categories) {
  await query(
    'INSERT INTO categories (id, name, sort_order) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
    [name.toLowerCase(), name, categories.indexOf(name)]
  );
}
```

Use `ON CONFLICT ... DO NOTHING` for idempotent seeding.

## Drop Order for Resets

Child tables before parents (foreign key constraints):

```javascript
const DROP_ORDER = [
  'cart_items',
  'order_items',
  'orders',
  'sessions',
  'services',
  'categories',
  'users'
];
```

## Security Considerations

- Password in `DATABASE_URL` will be masked in logs
- Use `.env.example` to document required variables without secrets
- Consider connection pooling for all backend requests
- Enable SSL for cloud databases

## References

- [pg npm package](https://www.npmjs.com/package/pg) - PostgreSQL client for Node.js
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatypes.html)