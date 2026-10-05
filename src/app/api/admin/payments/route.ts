import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllPayments, refundPayment, verifyPayment, rejectPayment } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const registrationType = (searchParams.get('registrationType')?.toUpperCase() as 'REAL' | 'TEST' | 'ALL') || 'ALL';

    const payments = await getAllPayments({ status, registrationType, search });
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

    if (action === 'verify') {
      if (!paymentId) {
        return NextResponse.json({ success: false, error: 'Payment ID is required' }, { status: 400 });
      }
      await verifyPayment(paymentId, session.username);
      return NextResponse.json({ success: true, message: 'Payment manually verified and registration confirmed.' });
    }

    if (action === 'reject') {
      if (!paymentId || !reason) {
        return NextResponse.json({ success: false, error: 'Payment ID and rejection reason are required' }, { status: 400 });
      }
      await rejectPayment(paymentId, session.username, reason);
      return NextResponse.json({ success: true, message: 'Payment rejected and applicant notified.' });
    }

    if (action === 'refund') {
      if (!paymentId) {
        return NextResponse.json({ success: false, error: 'Payment ID is required' }, { status: 400 });
      }
      await refundPayment(paymentId, session.username, reason || 'Admin initiated refund');
      return NextResponse.json({ success: true, message: 'Payment successfully marked as refunded.' });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Operation failed' },
      { status: 400 }
    );
  }
}
