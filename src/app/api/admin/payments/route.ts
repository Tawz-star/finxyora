import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllPayments, refundPayment, verifyPayment, rejectPayment, retryPaymentEmail, deletePayment } from '@/lib/db';

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
      await verifyPayment(paymentId, session.username, body.notes);
      return NextResponse.json({ success: true, message: 'Payment manually verified against bank records and registration confirmed.' });
    }

    if (action === 'reject') {
      if (!paymentId || !reason) {
        return NextResponse.json({ success: false, error: 'Payment ID and rejection reason are required' }, { status: 400 });
      }
      const result = await rejectPayment(paymentId, session.username, reason);
      return NextResponse.json({
        success: true,
        message: result.message,
        result
      });
    }

    if (action === 'refund') {
      if (!paymentId) {
        return NextResponse.json({ success: false, error: 'Payment ID is required' }, { status: 400 });
      }
      const result = await refundPayment(paymentId, session.username, reason || 'Admin initiated refund');
      return NextResponse.json({
        success: true,
        message: result.message,
        result
      });
    }

    if (action === 'retry_email') {
      if (!paymentId) {
        return NextResponse.json({ success: false, error: 'Payment ID is required' }, { status: 400 });
      }
      const result = await retryPaymentEmail(paymentId, session.username);
      return NextResponse.json({
        success: true,
        message: result.message,
        result
      });
    }

    if (action === 'delete') {
      if (!paymentId) {
        return NextResponse.json({ success: false, error: 'Payment ID is required' }, { status: 400 });
      }
      const result = await deletePayment(paymentId, session.username);
      return NextResponse.json({
        success: true,
        message: result.message,
        result
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Operation failed' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const qId = searchParams.get('id');
    const bId = (await req.json().catch(() => ({}))).paymentId;
    const paymentId = qId || bId;

    if (!paymentId) {
      return NextResponse.json({ success: false, error: 'Payment ID is required' }, { status: 400 });
    }

    const result = await deletePayment(paymentId, session.username);
    return NextResponse.json({ success: true, message: result.message, result });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
