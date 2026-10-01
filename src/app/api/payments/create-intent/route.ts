import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referenceType, referenceId, payerEmail, payerPhone, idempotencyKey } = body;

    if (!referenceType || !referenceId) {
      return NextResponse.json(
        { success: false, error: 'Reference type and reference ID are required.' },
        { status: 400 }
      );
    }

    if (referenceType !== 'event' && referenceType !== 'stall') {
      return NextResponse.json(
        { success: false, error: "Invalid reference type. Must be 'event' or 'stall'." },
        { status: 400 }
      );
    }

    const payment = createPaymentIntent({
      referenceType,
      referenceId,
      payerEmail,
      payerPhone,
      idempotencyKey
    });

    return NextResponse.json({ success: true, payment });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to create payment intent' },
      { status: 400 }
    );
  }
}
