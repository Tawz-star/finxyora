import crypto from 'node:crypto';

/**
 * razorpay.ts — Official Razorpay Gateway Integration Module
 *
 * Provides cryptographic HMAC verification, Razorpay Orders API communications,
 * and client/webhook signature validation for zero-touch automated payments.
 */

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  isConfigured: boolean;
  isSandbox: boolean;
}

export function getRazorpayConfig(): RazorpayConfig {
  const keyId = (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || '').trim();

  const isConfigured = Boolean(
    keyId &&
    keySecret &&
    keyId !== 'RAZORPAY_DISABLED' &&
    keyId !== 'undefined'
  );

  return {
    keyId,
    keySecret,
    webhookSecret,
    isConfigured,
    isSandbox: keyId.startsWith('rzp_test_')
  };
}

export function isSandboxMode(): boolean {
  return getRazorpayConfig().isSandbox;
}

export function getRazorpayClientCredentials(): { keyId: string; isConfigured: boolean; isSandbox: boolean } {
  const config = getRazorpayConfig();
  return {
    keyId: config.keyId,
    isConfigured: config.isConfigured,
    isSandbox: config.isSandbox
  };
}

/**
 * Verify Razorpay payment signature returned by the frontend Checkout modal.
 * Formula: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  customSecret?: string
): boolean {
  if (!orderId || !paymentId || !signature) return false;
  const secret = customSecret || getRazorpayConfig().keySecret;
  if (!secret) return false;

  try {
    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const signatureBuf = Buffer.from(signature, 'utf-8');

    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch (err) {
    console.error('Razorpay signature verification exception:', err);
    return false;
  }
}

/**
 * Verify Razorpay Webhook signature received in the 'x-razorpay-signature' header.
 * Formula: HMAC-SHA256(raw_request_body, webhook_secret)
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  customSecret?: string
): boolean {
  if (!rawBody || !signature) return false;
  const secret = customSecret || getRazorpayConfig().webhookSecret;
  if (!secret) return false;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const signatureBuf = Buffer.from(signature, 'utf-8');

    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch (err) {
    console.error('Razorpay webhook signature verification exception:', err);
    return false;
  }
}

export interface CreateOrderParams {
  amountInInr: number;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number; // in paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

/**
 * Creates an order directly via the Razorpay Orders REST API.
 * Uses native fetch with HTTP Basic Auth.
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrderResponse> {
  const config = getRazorpayConfig();
  if (!config.isConfigured) {
    throw new Error('Razorpay gateway credentials are not configured in environment.');
  }

  const amountInPaise = Math.round(params.amountInInr * 100);
  const authHeader = 'Basic ' + Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt: params.receipt.substring(0, 40),
      notes: params.notes || {}
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data?.error?.description || data?.error?.message || 'Failed to create Razorpay order';
    throw new Error(`Razorpay API error (${response.status}): ${errorMsg}`);
  }

  return data as RazorpayOrderResponse;
}

/**
 * Generate UPI Intent URL for mobile deep-link tap-to-pay (kept for fallback compatibility).
 */
export function generateUpiUrl(params: {
  upiId: string;
  payeeName: string;
  amount: number;
  transactionRef: string;
  notes: string;
}): string {
  const upi = encodeURIComponent(params.upiId);
  const pn = encodeURIComponent(params.payeeName);
  const tr = encodeURIComponent(params.transactionRef);
  const tn = encodeURIComponent(params.notes.substring(0, 40));
  const am = params.amount.toFixed(2);

  return `upi://pay?pa=${upi}&pn=${pn}&am=${am}&cu=INR&tr=${tr}&tn=${tn}`;
}
