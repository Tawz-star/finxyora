import crypto from 'node:crypto';

/**
 * razorpay.ts — DEPRECATED GATEWAY MODULE
 *
 * Finxyora no longer uses Razorpay. The payment system now relies on:
 *   - Static GPay QR code (public/gpay-qr.jpg)
 *   - Manual UPI UTR submission via /api/payments/confirm
 *   - Admin manual verification workflow in the Admin Panel
 *
 * This file is retained only for the UPI URI helper which is still used
 * by the PaymentModal for mobile deep-links.
 */

export function isSandboxMode(): boolean {
  return true; // Always — Razorpay integration is permanently disabled
}

export function getRazorpayClientCredentials(): { keyId: string; isSandbox: boolean } {
  return {
    keyId: 'RAZORPAY_DISABLED',
    isSandbox: true
  };
}

/**
 * Signature verification — kept for backward compatibility but always returns false
 * since Razorpay is no longer the payment gateway.
 */
export function verifyRazorpaySignature(_orderId: string, _paymentId: string, _signature: string): boolean {
  return false;
}

/**
 * Generate UPI Intent URL for mobile deep-link tap-to-pay.
 * Used by PaymentModal for the "Open in UPI App" button.
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

// Keep crypto import satisfied
void crypto;
