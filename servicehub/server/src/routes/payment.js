// src/routes/payment.js
'use strict';

const express = require('express');
const { query } = require('../db');
const { sslcommerz } = require('../lib/sslcommerz');
const { ownerKeyFor } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

/**
 * Re-initiates an SSLCommerz payment session for an existing order.
 */
router.post('/sslcommerz/init/:orderId', async (req, res, next) => {
  try {
    const ownerKey = ownerKeyFor(req);
    const orderId = req.params.orderId;

    const { rows } = await query(
      `SELECT * FROM orders WHERE id = $1 AND (owner_key = $2 OR $3 = 'admin')`,
      [orderId, ownerKey, req.user?.userType || '']
    );

    const order = rows[0];
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.payment_status === 'paid') {
      return res.status(400).json({ error: 'This order has already been paid' });
    }

    const { gatewayUrl, sessionKey } = await sslcommerz.initPayment({
      order,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone
      },
      address: {
        line: order.address_line,
        city: order.address_city,
        pincode: order.address_pincode
      }
    });

    await query(
      `UPDATE orders SET transaction_id = $1 WHERE id = $2`,
      [sessionKey, order.id]
    );

    return res.json({ gatewayUrl, sessionKey });
  } catch (error) {
    console.error('[payment] error re-initiating SSLCommerz payment:', error.message);
    return res.status(502).json({ error: error.message || 'Could not initialize payment' });
  }
});

/**
 * SSLCommerz Success Callback.
 * SSLCommerz POSTs (or GETs) transaction details here on successful checkout.
 */
router.all('/sslcommerz/success', async (req, res, next) => {
  try {
    const payload = { ...req.query, ...req.body };
    const { val_id, tran_id, amount, card_type, bank_tran_id } = payload;

    console.log(`[sslcommerz] success callback for transaction: ${tran_id}, val_id: ${val_id}`);

    if (!tran_id) {
      return res.redirect(303, `${config.clientUrl}/checkout?error=MissingTransactionId`);
    }

    const { rows } = await query('SELECT * FROM orders WHERE id = $1', [tran_id]);
    const order = rows[0];

    if (!order) {
      console.warn(`[sslcommerz] order not found for tran_id: ${tran_id}`);
      return res.redirect(303, `${config.clientUrl}/checkout?error=OrderNotFound`);
    }

    // If order is already paid, redirect straight to confirmation
    if (order.payment_status === 'paid') {
      return res.redirect(303, `${config.clientUrl}/order-confirmation/${order.id}?payment=success`);
    }

    if (!val_id) {
      console.error(`[sslcommerz] missing val_id for tran_id: ${tran_id}`);
      return res.redirect(303, `${config.clientUrl}/order-confirmation/${order.id}?payment=failed&reason=MissingValidationId`);
    }

    // Validate with SSLCommerz server
    let validation;
    try {
      validation = await sslcommerz.validatePayment(val_id);
    } catch (valErr) {
      console.error(`[sslcommerz] validation request failed: ${valErr.message}`);
      return res.redirect(303, `${config.clientUrl}/order-confirmation/${order.id}?payment=failed&reason=ValidationServerUnavailable`);
    }

    const isValid = validation && (validation.status === 'VALID' || validation.status === 'VALIDATED');
    const amountMatches = Math.abs(Number(validation.amount || amount || 0) - Number(order.total)) < 1.0;

    if (isValid && amountMatches) {
      const paymentMethod = validation.card_type
        ? `SSLCommerz (${validation.card_type})`
        : (card_type ? `SSLCommerz (${card_type})` : 'SSLCommerz');
      const transactionId = validation.bank_tran_id || bank_tran_id || val_id;

      await query(
        `UPDATE orders
            SET payment_status = 'paid',
                status = 'upcoming',
                payment_method = $1,
                transaction_id = $2,
                payment_details = $3
          WHERE id = $4`,
        [paymentMethod, transactionId, JSON.stringify(validation), order.id]
      );

      console.log(`[sslcommerz] order ${order.id} verified and marked as paid via ${paymentMethod}`);
      return res.redirect(303, `${config.clientUrl}/order-confirmation/${order.id}?payment=success`);
    } else {
      console.warn(`[sslcommerz] validation failed for order ${order.id}: status=${validation?.status}, amountMatches=${amountMatches}`);
      await query(
        `UPDATE orders
            SET payment_status = 'failed',
                payment_details = $1
          WHERE id = $2`,
        [JSON.stringify(validation || payload), order.id]
      );
      return res.redirect(303, `${config.clientUrl}/order-confirmation/${order.id}?payment=failed&reason=ValidationFailed`);
    }
  } catch (error) {
    console.error('[sslcommerz] unhandled error in success callback:', error.message);
    return next(error);
  }
});

/**
 * SSLCommerz Failure Callback.
 */
router.all('/sslcommerz/fail', async (req, res, next) => {
  try {
    const payload = { ...req.query, ...req.body };
    const { tran_id, failedreason, error: errReason } = payload;
    const reason = failedreason || errReason || 'Payment failed';

    console.log(`[sslcommerz] fail callback for tran_id: ${tran_id}, reason: ${reason}`);

    if (tran_id) {
      await query(
        `UPDATE orders
            SET payment_status = 'failed',
                payment_details = $1
          WHERE id = $2 AND payment_status <> 'paid'`,
        [JSON.stringify(payload), tran_id]
      );
      return res.redirect(303, `${config.clientUrl}/order-confirmation/${tran_id}?payment=failed&reason=${encodeURIComponent(reason)}`);
    }

    return res.redirect(303, `${config.clientUrl}/checkout?error=${encodeURIComponent(reason)}`);
  } catch (error) {
    return next(error);
  }
});

/**
 * SSLCommerz Cancel Callback.
 */
router.all('/sslcommerz/cancel', async (req, res, next) => {
  try {
    const payload = { ...req.query, ...req.body };
    const { tran_id } = payload;

    console.log(`[sslcommerz] cancel callback for tran_id: ${tran_id}`);

    if (tran_id) {
      await query(
        `UPDATE orders
            SET payment_status = 'cancelled',
                payment_details = $1
          WHERE id = $2 AND payment_status <> 'paid'`,
        [JSON.stringify(payload), tran_id]
      );
      return res.redirect(303, `${config.clientUrl}/order-confirmation/${tran_id}?payment=cancelled`);
    }

    return res.redirect(303, `${config.clientUrl}/checkout?cancelled=true`);
  } catch (error) {
    return next(error);
  }
});

/**
 * SSLCommerz IPN (Instant Payment Notification) Webhook.
 */
router.all('/sslcommerz/ipn', async (req, res, next) => {
  try {
    const payload = { ...req.query, ...req.body };
    const { val_id, tran_id, amount, card_type, bank_tran_id } = payload;

    console.log(`[sslcommerz] IPN received for transaction ${tran_id}, val_id: ${val_id}`);

    if (!tran_id || !val_id) {
      return res.status(400).send('Missing tran_id or val_id');
    }

    const { rows } = await query('SELECT * FROM orders WHERE id = $1', [tran_id]);
    const order = rows[0];

    if (!order) {
      return res.status(404).send('Order not found');
    }

    if (order.payment_status === 'paid') {
      return res.status(200).send('Order already paid');
    }

    const validation = await sslcommerz.validatePayment(val_id);
    const isValid = validation && (validation.status === 'VALID' || validation.status === 'VALIDATED');
    const amountMatches = Math.abs(Number(validation.amount || amount || 0) - Number(order.total)) < 1.0;

    if (isValid && amountMatches) {
      const paymentMethod = validation.card_type
        ? `SSLCommerz (${validation.card_type})`
        : (card_type ? `SSLCommerz (${card_type})` : 'SSLCommerz');
      const transactionId = validation.bank_tran_id || bank_tran_id || val_id;

      await query(
        `UPDATE orders
            SET payment_status = 'paid',
                status = 'upcoming',
                payment_method = $1,
                transaction_id = $2,
                payment_details = $3
          WHERE id = $4`,
        [paymentMethod, transactionId, JSON.stringify(validation), order.id]
      );
      console.log(`[sslcommerz] IPN successfully verified and marked order ${order.id} as paid`);
      return res.status(200).send('IPN verified and order updated');
    }

    return res.status(400).send('Validation failed');
  } catch (error) {
    console.error('[sslcommerz] error processing IPN:', error.message);
    return res.status(500).send('IPN processing error');
  }
});

module.exports = router;

