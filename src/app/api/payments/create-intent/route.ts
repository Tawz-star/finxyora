import { NextResponse } from 'next/server';

/**
 * DEPRECATED: This route is no longer in use.
 * The Finxyora payment system now uses a static UPI QR (GPay) approach — no payment intent creation needed.
 * All registration + payment submission is handled by /api/payments/confirm
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Payment intent creation is deprecated. Finxyora now uses a direct UPI QR payment flow. Use /api/payments/confirm instead.'
    },
    { status: 410 }
  );
}
