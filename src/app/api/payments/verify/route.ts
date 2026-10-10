import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStatus } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET & POST /api/payments/verify
 *
 * Checks authoritative payment verification status in the central SQL database.
 * Returns standard status: PENDING, VERIFYING, PAID, FAILED, EXPIRED, or REVIEW_REQUIRED.
 * 
 * IMPORTANT: This endpoint inspects real database state; it does NOT fabricate
 * confirmation or mark unverified payments as PAID.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryId = searchParams.get('paymentId') || searchParams.get('registrationId') || searchParams.get('id') || '';

    if (!queryId) {
      return NextResponse.json(
        { success: false, error: 'Missing paymentId or registrationId parameter.' },
        { status: 400 }
      );
    }

    const status = await getPaymentStatus(queryId);
    return NextResponse.json(status);
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Status verification failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const queryId = body.paymentId || body.registrationId || body.id || '';

    if (!queryId) {
      return NextResponse.json(
        { success: false, error: 'Missing paymentId or registrationId in request body.' },
        { status: 400 }
      );
    }

    const status = await getPaymentStatus(queryId);
    return NextResponse.json(status);
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Status verification failed' },
      { status: 500 }
    );
  }
}
