# ServiceHub

ServiceHub is a React service marketplace with an Express API and PostgreSQL. Customers can browse and book services, message providers privately, and manage their account; providers can manage listings, reply to customers, and view booking value; administrators can manage orders, remove services, and suspend or restore customer/provider accounts with an audit trail.

## Production deployment with Docker Compose

The included Compose setup builds a production React bundle, serves it from the API as one origin, runs PostgreSQL on a private container network, applies idempotent schema migrations at startup, and persists database data in a named volume.

### Requirements

- Docker Engine and Docker Compose
- A Node.js 24 LTS environment only if building or running outside Docker

### First deployment

1. Copy `.env.example` to `.env`.
2. Replace the example database password with a strong random URL-safe value. Use the same value in `POSTGRES_PASSWORD` and `DATABASE_URL`; URL-encode it if it contains reserved URL characters.
3. Set a real administrator email and a unique password of at least 12 characters in `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`.
4. Start the application:

   ```sh
   docker compose up --build -d
   ```

5. Check readiness at `http://localhost:4000/api/health` and open `http://localhost:4000`.
6. After the first successful start, remove both bootstrap administrator values from `.env` and restart the app. The created administrator remains in the database.

The app container runs as a non-root user, has a read-only root filesystem, and does not publish PostgreSQL's port. Put it behind a TLS-terminating reverse proxy before exposing it to the public internet. Set `TRUST_PROXY=true` only when exactly one trusted proxy is directly in front of the app. Set `CORS_ORIGIN` only when the browser frontend is hosted on a separate origin.

Production seeds service categories but does not load demo service data. Providers can publish the actual offerings after registering. Set `SEED_SAMPLE_CATALOG=true` only when demo services are wanted.

### Operations

- `docker compose logs -f app` shows API logs.
- `docker compose ps` shows the app and database health checks.
- `docker compose down` stops the stack and keeps the named database volume.
- `docker compose down -v` also deletes the database volume. This is destructive.
- Back up PostgreSQL with `pg_dump` and verify restore procedures before handling real customer data.

## Local development

1. Install dependencies:

   ```sh
   npm ci
   npm --prefix server ci
   ```

2. Copy `server/.env.example` to `server/.env`; set `DATABASE_URL` to a PostgreSQL database you control. Local development defaults to `postgres://postgres:postgres@localhost:5432/servicehub`.
3. To provision a local administrator, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters) in `server/.env` before seeding.
4. Start the full local app with one command:

   ```sh
   npm run dev
   ```

   This applies database migrations, prepares the sample catalogue when the database is empty, and starts both the API and Vite frontend. Open <http://localhost:3000>. Keep this terminal running; Ctrl+C stops both processes.

Useful commands: `npm run build` creates the frontend bundle; `npm run start:production` serves that build with the API when `NODE_ENV=production` and database settings are configured; `npm run db:reset` drops ServiceHub tables and data, so use it only for disposable development databases. `npm run dev` requires PostgreSQL to be running but no separate migration, seed, API, or frontend commands.

### Messaging API returns “Unknown API endpoint”

The browser is reaching an API version that does not have the messaging route. In local development, make sure PostgreSQL is running, stop any older ServiceHub API process, and start the whole app with `npm run dev`; this applies migrations and launches the API and frontend together. For Docker Compose deployments, rebuild and restart the app with `docker compose up --build -d`. The current messages API is mounted at `/api/messages`.

## Deployment boundaries

Checkout currently creates demo bookings; it does not charge cards, settle provider balances, issue refunds, or execute payouts. Provider earnings are booking-value estimates. Profile photos are stored in PostgreSQL as small data URLs. Before a real-money launch, integrate a payment provider with signed webhooks, reconciliation, refunds, and a payout ledger, and move user media to object storage.

This repository provides a deployable single-instance baseline. For multiple API replicas, use a shared rate limiter, set database pool sizes against the database connection budget, and run schema migrations as a single deployment job rather than concurrently at every replica startup.
