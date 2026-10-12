import crypto from 'node:crypto';

/**
 * FINXYORA PAYMENT PROVIDER & GATEWAY INTEGRATION
 *
 * Direct UPI Assessment:
 * The current Finxyora setup uses a personal Axis Bank UPI VPA:
 *   - VPA: s.venkatesanraja@okaxis
 *   - Payee: S.venkatesan
 *
 * TECHNICAL REALITY:
 * Personal UPI VPAs (GPay/PhonePe/Axis) do NOT expose a public bank query API,
 * webhook, or server-to-server transaction status endpoint.
 * Therefore:
 * 1. Incoming payments through direct personal UPI must be recorded as REVIEW_REQUIRED.
 * 2. The user-entered UTR serves as a reconciliation hint for administrators.
 * 3. Automatic marking of payments as PAID without gateway integration is strictly forbidden.
 * 4. To enable fully automatic server-to-server verification, official merchant gateway
 *    credentials (e.g. Razorpay or Cashfree) can be supplied via environment variables.
 */

export const DIRECT_UPI_CONFIG = {
  vpa: 's.venkatesanraja@okaxis',
  payeeName: 'S.venkatesan',
  bankName: 'Axis Bank / Google Pay',
  currency: 'INR'
};

export interface GatewayCredentials {
  isConfigured: boolean;
  provider: 'DIRECT_UPI' | 'RAZORPAY';
  keyId?: string;
  isSandbox?: boolean;
}

export function getPaymentGatewayInfo(): GatewayCredentials {
  const razorpayKey = process.env.RAZORPAY_KEY_ID;
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

  if (razorpayKey && razorpaySecret && razorpayKey !== 'RAZORPAY_DISABLED') {
    return {
      isConfigured: true,
      provider: 'RAZORPAY',
      keyId: razorpayKey,
      isSandbox: razorpayKey.startsWith('rzp_test_')
    };
  }

  return {
    isConfigured: false,
    provider: 'DIRECT_UPI'
  };
}

/**
 * Build dynamic UPI Intent URL with pre-filled amount and reference.
 */
export function buildDynamicUpiUrl(params: {
  amount: number;
  referenceId: string;
  vpa?: string;
  payeeName?: string;
}): string {
  const vpa = encodeURIComponent(params.vpa || DIRECT_UPI_CONFIG.vpa);
  const name = encodeURIComponent(params.payeeName || DIRECT_UPI_CONFIG.payeeName);
  const ref = encodeURIComponent(params.referenceId);
  const note = encodeURIComponent(`FINXYORA 2026 - ${params.referenceId}`.substring(0, 45));
  const amountStr = params.amount.toFixed(2);

  return `upi://pay?pa=${vpa}&pn=${name}&am=${amountStr}&cu=INR&tn=${note}&tr=${ref}`;
}

/**
 * Generate QR code URL via reliable public QR endpoint.
 */
export function buildQrCodeImageUrl(upiUrl: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=M&margin=10&data=${encodeURIComponent(upiUrl)}`;
}

/**
 * Verify Razorpay Webhook signature (HMAC SHA256) when configured.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!rawBody || !signature || !secret) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
