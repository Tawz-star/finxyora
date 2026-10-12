import { NextRequest, NextResponse } from 'next/server';
import { verifyRazorpayWebhookSignature, getPaymentGatewayInfo } from '@/lib/payment-gateway';
import { queryOne, execute, logAuditEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/webhook
 *
 * Official Webhook Handler for authenticated payment gateway notifications.
 * Validates HMAC SHA256 signatures, prevents duplicate processing idempotently,
 * and updates payment records in the central SQL database.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || req.headers.get('x-webhook-signature') || '';
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || '';

    const gatewayInfo = getPaymentGatewayInfo();
    if (!gatewayInfo.isConfigured || !webhookSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook receiver is not active because gateway credentials or webhook secret are not configured.'
        },
        { status: 400 }
      );
    }

    const isValid = verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid webhook signature.' },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id || payload.payload?.order?.entity?.id;
    const paymentId = paymentEntity?.id;
    const amountInPaise = paymentEntity?.amount;
    const amountInInr = amountInPaise ? amountInPaise / 100 : 0;

    if (!orderId) {
      return NextResponse.json({ success: true, message: 'Unhandled webhook event type without order ID.' });
    }

    // Match payment in central SQL database
    const payment = await queryOne(
      'SELECT * FROM payments WHERE gateway_order_id = ? OR id = ?',
      [orderId, orderId]
    );

    if (!payment) {
      return NextResponse.json({ success: false, error: 'Order reference not found in database.' }, { status: 404 });
    }

    // Idempotency check
    if (payment.status === 'PAID' || payment.status === 'verified') {
      return NextResponse.json({ success: true, message: 'Payment order has already been verified idempotently.' });
    }

    // Amount match check
    if (amountInInr > 0 && Math.abs(payment.amount - amountInInr) > 0.01) {
      await logAuditEvent(
        'WEBHOOK_SECURITY',
        'AMOUNT_MISMATCH',
        'PAYMENT',
        payment.id,
        `Expected ₹${payment.amount}, webhook received ₹${amountInInr}`
      );
      return NextResponse.json({ success: false, error: 'Payment amount mismatch detected.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Transactionally update payment and registration
    await execute(`
      UPDATE payments SET
        status = 'PAID',
        gateway_payment_id = ?,
        provider_reference = ?,
        verified_amount = ?,
        verified_at = ?,
        verified_by = 'GATEWAY_WEBHOOK',
        verification_method = 'GATEWAY_WEBHOOK'
      WHERE id = ?
    `, [paymentId, paymentId, payment.amount, now, payment.id]);

    if (payment.reference_type === 'event') {
      await execute(`
        UPDATE event_registrations SET
          payment_status = 'PAID',
          registration_status = 'confirmed',
          transaction_id = ?,
          updated_at = ?
        WHERE id = ?
      `, [paymentId, now, payment.reference_id]);
    } else {
      await execute(`
        UPDATE stall_bookings SET
          payment_status = 'PAID',
          status = 'approved',
          transaction_id = ?,
          updated_at = ?
        WHERE id = ?
      `, [paymentId, now, payment.reference_id]);
    }

    await logAuditEvent(
      'GATEWAY_WEBHOOK',
      'PAYMENT_VERIFIED',
      'PAYMENT',
      payment.id,
      `Authoritatively verified via gateway webhook (${event}): Payment ID ${paymentId}, Amount ₹${payment.amount}`
    );

    return NextResponse.json({ success: true, message: 'Payment successfully verified via webhook.' });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Webhook processing error' },
      { status: 500 }
    );
  }
}
