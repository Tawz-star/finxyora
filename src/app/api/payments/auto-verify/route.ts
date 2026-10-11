import { NextRequest, NextResponse } from 'next/server';
import { verifyPaymentAutomatically } from '@/lib/payment-verification';

export const dynamic = 'force-dynamic';

/**
 * GET & POST /api/payments/auto-verify
 *
 * Real-time automated verification endpoint called by PaymentModal while in the
 * "Processing payment..." state.
 *
 * Automatically verifies if an incoming credit matching the exact expected amount
 * (participants * 50) and user's registered mobile number has arrived in the receiver's account.
 * Once verified, updates database records to PAID/confirmed and returns redirectUrl.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('paymentId') || searchParams.get('id') || '';
    const registrationId = searchParams.get('registrationId') || searchParams.get('ref') || '';
    const phone = searchParams.get('phone') || '';
    const amountStr = searchParams.get('amount') || '';
    const expectedAmount = amountStr ? parseFloat(amountStr) : undefined;

    if (!paymentId && !registrationId) {
      return NextResponse.json(
        { success: false, error: 'paymentId or registrationId parameter is required' },
        { status: 400 }
      );
    }

    const result = await verifyPaymentAutomatically({
      paymentId: paymentId || registrationId,
      registrationId: registrationId || undefined,
      phone: phone || undefined,
      expectedAmount
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Automated verification check failed'
      },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const paymentId = body.paymentId || body.id || '';
    const registrationId = body.registrationId || body.ref || '';
    const phone = body.phone || body.payerPhone || '';
    const expectedAmount = body.expectedAmount || body.amount;

    if (!paymentId && !registrationId) {
      return NextResponse.json(
        { success: false, error: 'paymentId or registrationId is required' },
        { status: 400 }
      );
    }

    const result = await verifyPaymentAutomatically({
      paymentId: paymentId || registrationId,
      registrationId: registrationId || undefined,
      phone: phone || undefined,
      expectedAmount: expectedAmount ? Number(expectedAmount) : undefined
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Automated verification check failed'
      },
      { status: 400 }
    );
  }
}
