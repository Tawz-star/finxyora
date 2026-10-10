import { NextRequest, NextResponse } from 'next/server';
import { createPaymentOrder } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/create-intent
 *
 * Validates registration details strictly on the server, calculates authoritative
 * fee (₹50 per participant for events, category rate × stalls × days for stalls),
 * pre-creates the pending order in the central SQL database, and returns the
 * server-generated UPI QR code and payment reference.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referenceType, eventData, stallData, registrationId, isTest } = body;

    if (!referenceType || (referenceType !== 'event' && referenceType !== 'stall')) {
      return NextResponse.json(
        { success: false, error: 'Invalid referenceType. Must be "event" or "stall".' },
        { status: 400 }
      );
    }

    const order = await createPaymentOrder({
      referenceType,
      registrationId,
      isTest: Boolean(isTest),
      eventData,
      stallData
    });

    return NextResponse.json(order);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to initialize payment order on server.'
      },
      { status: 400 }
    );
  }
}
