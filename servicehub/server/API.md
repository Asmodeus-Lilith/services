# ServiceHub API

Express + PostgreSQL backend for the ServiceHub React app. It is the only thing
that talks to the database; the browser talks to it over JSON.

Base URL in development: `http://localhost:4000` (the React dev server proxies
`/api` here, so the app itself just calls `/api/...`).

## Conventions

- Requests and responses are JSON.
- Signed-in calls send `Authorization: Bearer <token>`.
- Guests send `X-Guest-Key: <random id>`, which keeps their bookings private to
  that browser and lets a later sign-in claim them.
- Errors are `{ "error": "human readable message" }` with a matching status code.
- Money is `numeric(10,2)` in Postgres and a plain number in JSON.

## Health

| Method | Path          | Auth | Notes                        |
| ------ | ------------- | ---- | ---------------------------- |
| GET    | `/api/health` | –    | `200` when Postgres answers. |
| GET    | `/healthz` | – | Process liveness, without a database query. |

## Accounts

| Method | Path                 | Auth | Body                                   | Returns            |
| ------ | -------------------- | ---- | -------------------------------------- | ------------------ |
| POST   | `/api/auth/register` | –    | `{ name, email, password, userType? }` | `201 { user, token, claimedOrders }` |
| POST   | `/api/auth/login`    | –    | `{ email, password }`                  | `200 { user, token, claimedOrders }` |
| POST   | `/api/auth/logout`   | –    | –                                      | `204`              |
| GET    | `/api/auth/me`       | ✓    | –                                      | `200 { user }`     |

Passwords are hashed with `scrypt` and a per-user salt; the plaintext is never
stored. Sessions are opaque 32-byte tokens kept in the `sessions` table, so a
sign-out genuinely revokes access.

`user` is `{ id, name, email, avatar, userType }`.

`claimedOrders` counts bookings this browser placed as a guest that were just
handed to the account, which is what makes "order before signing in, then sign
in" behave the way it always has.

Statuses: `400` invalid input, `401` wrong credentials, `409` email taken.

## Catalogue

| Method | Path                       | Auth | Returns                       |
| ------ | -------------------------- | ---- | ----------------------------- |
| GET    | `/api/catalog`             | –    | `{ services, categories }`    |
| GET    | `/api/services`            | –    | `{ services }`                |
| GET    | `/api/services/:id`        | –    | `{ service }`                 |
| GET    | `/api/categories`          | –    | `{ categories }`              |

`/api/services` accepts optional `?category=` and `?search=` filters.

Categories include a computed `count`, and the pseudo-category `all` reports the
size of the whole catalogue.

## Bookings

| Method | Path              | Auth      | Body        | Returns        |
| ------ | ----------------- | --------- | ----------- | -------------- |
| GET    | `/api/orders`     | ✓ or guest| –           | `{ orders }`   |
| GET    | `/api/orders/:id` | ✓ or guest| –           | `{ order }`    |
| POST   | `/api/orders`     | ✓ or guest| see below   | `201 { order }`|

```jsonc
{
  "items": [{ "id": 1, "quantity": 2 }],
  "customer": { "name": "…", "email": "…", "phone": "…" },
  "address":  { "line": "…", "city": "…", "pincode": "…" },
  "schedule": { "date": "2030-05-04", "time": "10:00" },
  "paymentMethod": "card" | "upi" | "netbanking" | "cod",
  "promoCode": "WELCOME10"
}
```

Only `id` and `quantity` are read from each line item. **Subtotal, tax (18%) and
total are calculated from the catalogue on the server**. Promotion codes are
rechecked during booking and redemption is recorded atomically. Each line is
stored as a snapshot, so editing a service later never rewrites an existing receipt.

An `order` is:

```jsonc
{
  "id": "ORD-…",
  "createdAt": "2030-05-04T09:12:00.000Z",
  "status": "upcoming",
  "ownerKey": "you@example.com",
  "customer": { "name": "…", "email": "…", "phone": "…" },
  "address":  { "line": "…", "city": "…", "pincode": "…" },
  "schedule": { "date": "2030-05-04", "time": "10:00" },
  "paymentMethod": "card",
  "items": [
    { "id": 1, "name": "…", "price": 500, "quantity": 2,
      "image": "…", "unit": "hour", "category": "tuition", "provider": "…" }
  ],
  "subtotal": 1500, "tax": 270, "promoCode": "WELCOME10",
  "discount": 150, "total": 1620
}
```

Orders belonging to someone else answer `404`, never `403`, so the API does not
confirm that a booking exists.

## Cart

Only signed-in visitors have a server-side cart; guests keep theirs in
`localStorage` so an anonymous visit needs no account.

| Method | Path          | Auth | Body                              | Returns      |
| ------ | ------------- | ---- | --------------------------------- | ------------ |
| GET    | `/api/cart`   | ✓    | –                                 | `{ items }`  |
| PUT    | `/api/cart`   | ✓    | `{ items: [{ id, quantity }] }`   | `{ items }`  |
| DELETE | `/api/cart`   | ✓    | –                                 | `204`        |

`PUT` replaces the whole cart, which keeps "add", "remove" and "change quantity"
from needing three endpoints that could drift apart. Quantities are clamped to
`1…20` and unknown service ids are dropped.

## Provider workspace

All routes require a signed-in provider account. Providers can only read or
change services they created.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/provider/services` | List the provider's listings. |
| POST | `/api/provider/services` | Create a listing with name, category, description, price, unit and optional details. |
| PUT | `/api/provider/services/:id` | Update an owned listing. |
| PATCH | `/api/provider/services/:id/availability` | Set `{ "isActive": true|false }`. |
| GET | `/api/provider/payments` | Booking-value estimates and the customer's selected payment method. |

Provider payments are estimates only. Checkout does not process charges or
payouts; integrate a payment provider before handling real money.

## Customer/provider messages

Customers can start a private, service-specific conversation from an active
provider listing. Signed-in customers and providers can view and reply only to
conversations where they are a participant. Message text is limited to 2,000
characters; inbox previews show unread counts. The web app refreshes the open
thread periodically for near-live text updates.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/messages/conversations` | Customer or provider | List the caller's inbox. |
| POST | `/api/messages/conversations` | Customer | Start/reopen a service conversation and send its first message. Body: `{ "serviceId": 123, "message": "..." }`. |
| GET | `/api/messages/conversations/:id/messages` | Participant | Read a thread and mark received messages as read. |
| POST | `/api/messages/conversations/:id/messages` | Participant | Reply with `{ "message": "..." }`. |
| DELETE | `/api/messages/conversations/:id` | Participant | Delete an entire conversation and all its messages. |
| DELETE | `/api/messages/conversations/:id/messages/:messageId` | Sender | Delete an individual message sent by the caller. |

## User reports

Signed-in customers can report the provider in a conversation, and providers can
report the customer. Reports must be submitted from a conversation they
participate in, include a reason and a 20–2,000 character description, and are
limited to five submissions per hour per client address.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/reports` | Customer or provider | Submit `{ "conversationId", "reason", "description" }`. |
| GET | `/api/admin/reports?status=&q=&page=&limit=` | Admin | Review and filter reports. |
| PATCH | `/api/admin/reports/:id` | Admin | Set `{ "status": "pending"|"reviewed"|"dismissed", "adminNote": "..." }`. |

Report reasons are harassment, fraud, inappropriate behavior, service quality,
safety concern, or other. Reports appear in the Reports tab under Marketplace
moderation; only administrators can read or update them.

## Administrator moderation

All moderation routes require an active administrator session. Service removal
keeps booking snapshots. Account removal is a reversible suspension: active
sessions are revoked, provider listings are hidden, and booking/message history
is retained. Every action requires a reason and is written to the audit log.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/moderation/services?q=&page=&limit=` | Search marketplace services, including hidden listings. |
| DELETE | `/api/admin/moderation/services/:id` | Remove a service. Body: `{ "reason": "..." }`. |
| GET | `/api/admin/moderation/accounts?q=&type=&status=&page=&limit=` | Search customer/provider accounts; `status` is `active` or `suspended`. |
| PATCH | `/api/admin/moderation/accounts/:id/status` | Suspend/restore with `{ "isActive": false, "reason": "..." }`. |
| GET | `/api/admin/moderation/audit` | Read the latest 100 moderation actions. |

## Promotions

Customers preview a code with `POST /api/promotions/validate` and
`{ "code": "WELCOME10", "subtotal": 1500 }`. The preview is informational;
the booking endpoint recalculates the discount from catalogue prices. Admins
manage codes from the Promotions page or these endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/promotions` | List codes, redemption counts, expiry and status. |
| POST | `/api/admin/promotions` | Create `{ "code", "discountPercent", "maxUses?", "expiresAt?" }`. |
| PATCH | `/api/admin/promotions/:code` | Activate or deactivate with `{ "isActive": true|false }`. |

Codes accept 3–32 letters, digits, hyphens or underscores; discounts are 1–90%.
Expiry and maximum redemptions are optional.

## Environment

| Variable       | Default                                                        |
| -------------- | -------------------------------------------------------------- |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/servicehub`         |
| `PORT`         | `4000`                                                           |
| `SESSION_DAYS` | `30`                                                             |
| `CORS_ORIGIN`  | `http://localhost:3000,http://127.0.0.1:3000` (comma separated)  |
| `DB_POOL_MAX` | `10` |
| `TRUST_PROXY` | `false`; set `true` only behind one trusted reverse proxy |

Copy `server/.env.example` to `server/.env` to override them.
