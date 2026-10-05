import { NextResponse } from 'next/server';

/**
 * DEPRECATED: This route is no longer in use.
 * The Finxyora payment system now uses the manual UPI + admin verification workflow.
 * All payment confirmation is handled by /api/payments/confirm
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'This payment gateway endpoint has been deprecated. Please use the UPI payment flow via /api/payments/confirm.'
    },
    { status: 410 }
  );
}
