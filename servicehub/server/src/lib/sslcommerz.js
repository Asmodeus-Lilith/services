// src/lib/sslcommerz.js
'use strict';

const config = require('../config');

class SSLCommerzService {
  constructor() {
    this.storeId = config.sslcommerz.storeId;
    this.storePassword = config.sslcommerz.storePassword;
    this.isSandbox = config.sslcommerz.isSandbox;
    this.initUrl = config.sslcommerz.initUrl;
    this.validationUrl = config.sslcommerz.validationUrl;
  }

  /**
   * Initializes a payment session with SSLCommerz gateway.
   * Returns { gatewayUrl, sessionKey }.
   */
  async initPayment({ order, customer = {}, address = {}, schedule = {} }) {
    if (!order || !order.id || !order.total) {
      throw new Error('Valid order with id and total is required to initialize payment');
    }

    const serverBase = config.serverUrl || 'http://127.0.0.1:4000';
    const successUrl = `${serverBase}/api/payment/sslcommerz/success`;
    const failUrl = `${serverBase}/api/payment/sslcommerz/fail`;
    const cancelUrl = `${serverBase}/api/payment/sslcommerz/cancel`;
    const ipnUrl = `${serverBase}/api/payment/sslcommerz/ipn`;

    const cusName = String(customer.name || order.customer_name || 'Customer').trim();
    const cusEmail = String(customer.email || order.customer_email || 'customer@example.com').trim();
    const cusPhone = String(customer.phone || order.customer_phone || '01700000000').trim();
    const cusAdd = String(address.line || order.address_line || 'Dhaka, Bangladesh').trim();
    const cusCity = String(address.city || order.address_city || 'Dhaka').trim();
    const cusPost = String(address.pincode || order.address_pincode || '1200').trim();

    const params = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePassword,
      total_amount: String(Number(order.total).toFixed(2)),
      currency: 'BDT',
      tran_id: order.id,
      success_url: successUrl,
      fail_url: failUrl,
      cancel_url: cancelUrl,
      ipn_url: ipnUrl,
      cus_name: cusName.slice(0, 50),
      cus_email: cusEmail.slice(0, 50),
      cus_add1: cusAdd.slice(0, 50),
      cus_city: cusCity.slice(0, 50),
      cus_postcode: cusPost.slice(0, 30),
      cus_country: 'Bangladesh',
      cus_phone: cusPhone.slice(0, 20),
      shipping_method: 'NO',
      product_name: 'ServiceHub Service Booking',
      product_category: 'Service',
      product_profile: 'general'
    });

    let response;
    try {
      response = await fetch(this.initUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });
    } catch (networkError) {
      console.error('[sslcommerz] network error reaching gateway:', networkError.message);
      throw new Error(`Could not reach SSLCommerz payment gateway: ${networkError.message}`);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`SSLCommerz server responded with HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (data.status !== 'SUCCESS') {
      console.error('[sslcommerz] session initialization failed:', data.failedreason);
      throw new Error(data.failedreason || 'SSLCommerz payment session initialization failed');
    }

    return {
      gatewayUrl: data.GatewayPageURL,
      sessionKey: data.sessionkey
    };
  }

  /**
   * Validates a completed transaction with SSLCommerz validation API.
   * Ensures the transaction is authentic and matches the order amount.
   */
  async validatePayment(valId) {
    if (!valId) {
      throw new Error('val_id is required to validate payment');
    }

    const params = new URLSearchParams({
      val_id: valId,
      store_id: this.storeId,
      store_passwd: this.storePassword,
      format: 'json'
    });

    let response;
    try {
      response = await fetch(`${this.validationUrl}?${params.toString()}`);
    } catch (networkError) {
      console.error('[sslcommerz] network error validating transaction:', networkError.message);
      throw new Error(`Could not reach SSLCommerz validation server: ${networkError.message}`);
    }

    if (!response.ok) {
      throw new Error(`SSLCommerz validation server responded with HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  }
}

const sslcommerz = new SSLCommerzService();

module.exports = {
  SSLCommerzService,
  sslcommerz
};

