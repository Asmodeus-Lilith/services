// src/lib/serialize.js
'use strict';

/**
 * Database rows in, API JSON out. Keeping the mapping in one place means the
 * snake_case columns and the camelCase the React app already expects can never
 * drift apart.
 */

const iso = (value) => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
};

const toUser = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        avatar: row.avatar,
        userType: row.user_type
      }
    : null;

const toService = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description,
        price: row.price,
        originalPrice: row.original_price,
        unit: row.unit,
        rating: row.rating,
        reviews: row.reviews,
        image: row.image || (Array.isArray(row.images) && row.images[0]) || null,
        images: Array.isArray(row.images) && row.images.length > 0
          ? row.images
          : (row.image ? [row.image] : []),
        discount: row.discount,
        popular: row.popular,
        provider: row.provider,
        providerAccountAvailable: Boolean(row.owner_user_id),
        experience: row.experience,
        duration: row.duration,
        availability: row.availability,
        subjects: row.subjects || [],
        // Stored as `inclusions` because INCLUDES is awkward in SQL; the app
        // has always called this field `includes`.
        includes: row.inclusions || [],
        isActive: row.is_active !== false
      }
    : null;

const toCategory = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
        icon: row.icon,
        count: Number(row.service_count ?? row.count ?? 0)
      }
    : null;

const toOrderItem = (row) => ({
  // `service_id` keeps the same identity the cart used. A deleted service
  // leaves the snapshot intact, so fall back to the line's own id.
  id: row.service_id ?? row.id,
  name: row.name,
  price: row.price,
  quantity: row.quantity,
  image: row.image,
  unit: row.unit,
  category: row.category,
  provider: row.provider
});

const toOrder = (row, itemRows = []) => ({
  id: row.id,
  createdAt: iso(row.created_at),
  status: row.status,
  ownerKey: row.owner_key,
  paymentStatus: row.payment_status || 'unpaid',
  transactionId: row.transaction_id || null,
  paymentDetails: row.payment_details || null,
  customer: {
    name: row.customer_name,
    email: row.customer_email,
    phone: row.customer_phone
  },
  address: {
    line: row.address_line,
    city: row.address_city,
    pincode: row.address_pincode
  },
  schedule: {
    date: row.schedule_date ?? null,
    time: row.schedule_time ?? null
  },
  paymentMethod: row.payment_method,
  promoCode: row.promo_code || null,
  items: itemRows.map(toOrderItem),
  subtotal: row.subtotal,
  tax: row.tax,
  discount: row.discount ?? 0,
  total: row.total
});

/** Admin view: includes customer email + userId for lookup. */
const toAdminOrder = (row, itemRows = []) => ({
  ...toOrder(row, itemRows),
  userId: row.user_id,
  customerEmail: row.customer_email
});

/** Cart rows come back joined against the catalogue. */
const toCartItem = (row) => ({
  ...toService(row),
  quantity: row.quantity
});

module.exports = {
  toUser,
  toService,
  toCategory,
  toOrder,
  toAdminOrder,
  toOrderItem,
  toCartItem
};
