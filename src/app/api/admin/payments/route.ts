import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllPayments, refundPayment } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const payments = getAllPayments({ status, search });
    return NextResponse.json({ success: true, payments });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, paymentId, reason } = body;

    if (action === 'refund') {
      if (!paymentId) {
        return NextResponse.json({ success: false, error: 'Payment ID is required' }, { status: 400 });
      }

      refundPayment(paymentId, session.username, reason || 'Admin initiated refund');
      return NextResponse.json({ success: true, message: 'Payment successfully marked as refunded' });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Operation failed' },
      { status: 400 }
    );
  }
}
