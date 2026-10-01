import crypto from 'node:crypto';
import { getSiteSettings } from './db';

export interface PaymentVerificationInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export function isSandboxMode(): boolean {
  const settings = getSiteSettings();
  const keyId = process.env.RAZORPAY_KEY_ID || settings.razorpay_key_id;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || settings.razorpay_key_secret;
  const mode = process.env.RAZORPAY_MODE || settings.razorpay_mode || 'sandbox';

  if (!keyId || !keySecret || mode === 'sandbox' || keyId.startsWith('rzp_test_placeholder')) {
    return true;
  }
  return false;
}

export function getRazorpayClientCredentials(): { keyId: string; isSandbox: boolean } {
  const settings = getSiteSettings();
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || settings.razorpay_key_id || 'rzp_test_finxyora_sandbox';
  return {
    keyId,
    isSandbox: isSandboxMode()
  };
}

/**
 * Verify Razorpay payment signature cryptographically on server
 */
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const settings = getSiteSettings();
  const keySecret = process.env.RAZORPAY_KEY_SECRET || settings.razorpay_key_secret;

  // In sandbox simulation mode with explicit sandbox signature
  if (isSandboxMode()) {
    // If client supplied a valid sandbox test token
    if (signature && signature.startsWith('SANDBOX_VERIFIED_')) {
      return true;
    }
  }

  if (!keySecret) {
    // Cannot do live HMAC without secret
    return false;
  }

  const generatedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(generatedSignature), Buffer.from(signature));
}

/**
 * Generate UPI Intent URL for dynamic QR code
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
  const cu = 'INR';

  return `upi://pay?pa=${upi}&pn=${pn}&am=${am}&cu=${cu}&tr=${tr}&tn=${tn}`;
}
