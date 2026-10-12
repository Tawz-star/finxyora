import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { execute, queryOne, logAuditEvent } from '@/lib/db';
import { getRazorpayConfig, verifyRazorpaySignature } from '@/lib/razorpay';
import { sendEmailNotification } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/verify-signature (and /api/verify-payment)
 *
 * 1. Receives checkout response tokens: razorpay_payment_id, razorpay_order_id, razorpay_signature.
 * 2. Cryptographically verifies HMAC-SHA256 signature using Razorpay Secret Key.
 * 3. Uses timing-safe byte comparison to guard against timing analysis.
 * 4. Authoritatively promotes payment & registration status to 'PAID' in SQL.
 * 5. Dispatches confirmation notification email and returns receipt redirect URL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      registrationId,
      referenceType
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required Razorpay payment tokens (order_id, payment_id, signature).'
        },
        { status: 400 }
      );
    }

    const config = getRazorpayConfig();

    // 1. Cryptographic HMAC Signature Verification
    let isAuthentic = false;

    if (config.isConfigured) {
      isAuthentic = verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        config.keySecret
      );
    } else {
      // In development sandbox mode without production keys:
      // Allow orders prefixed with order_test_ if signature starts with 'test_'
      if (razorpay_order_id.startsWith('order_test_') && razorpay_signature.startsWith('test_')) {
        console.warn('⚠️ Sandbox test payment bypass accepted for development mode.');
        isAuthentic = true;
      }
    }

    if (!isAuthentic) {
      await logAuditEvent(
        'SECURITY_AUDIT',
        'SIGNATURE_VERIFICATION_FAILED',
        'PAYMENT',
        razorpay_order_id,
        `Tampered or invalid signature submitted for payment ${razorpay_payment_id}`
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Payment signature verification failed. Untrusted or altered transaction data.'
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 2. Fetch existing payment record
    const payment = await queryOne(
      'SELECT * FROM payments WHERE gateway_order_id = ? OR id = ? OR reference_id = ?',
      [razorpay_order_id, razorpay_order_id, registrationId || '']
    );

    const resolvedRefId = payment?.reference_id || registrationId;
    const resolvedRefType = payment?.reference_type || referenceType || 'event';
    const amount = payment?.amount || 0;

    // 3. Atomically update payment in SQL database
    if (payment) {
      await execute(`
        UPDATE payments SET
          status = 'PAID',
          gateway_order_id = ?,
          gateway_payment_id = ?,
          gateway_signature = ?,
          provider_reference = ?,
          verified_amount = ?,
          verified_at = ?,
          verified_by = 'CLIENT_HMAC_VERIFIED',
          verification_method = 'GATEWAY'
        WHERE id = ?
      `, [
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        razorpay_payment_id,
        amount,
        now,
        payment.id
      ]);
    } else {
      // If payment record wasn't pre-found, create authoritative entry
      await execute(`
        INSERT INTO payments (
          id, reference_type, reference_id, gateway_order_id, gateway_payment_id,
          gateway_signature, amount, currency, status, payment_method,
          created_at, verified_at, verified_by, verification_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', 'PAID', 'RAZORPAY', ?, ?, 'CLIENT_HMAC_VERIFIED', 'GATEWAY')
      `, [
        razorpay_payment_id,
        resolvedRefType,
        resolvedRefId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount,
        now,
        now
      ]);
    }

    // 4. Update Event Registration or Stall Booking
    if (resolvedRefType === 'event') {
      await execute(`
        UPDATE event_registrations SET
          payment_status = 'PAID',
          registration_status = 'confirmed',
          transaction_id = ?,
          updated_at = ?
        WHERE id = ?
      `, [razorpay_payment_id, now, resolvedRefId]);
    } else {
      await execute(`
        UPDATE stall_bookings SET
          payment_status = 'PAID',
          status = 'approved',
          transaction_id = ?,
          updated_at = ?
        WHERE id = ?
      `, [razorpay_payment_id, now, resolvedRefId]);
    }

    // 5. Audit Logging
    await logAuditEvent(
      'PAYMENT_GATEWAY',
      'SIGNATURE_VERIFIED_PAID',
      resolvedRefType.toUpperCase(),
      resolvedRefId,
      `Razorpay payment ${razorpay_payment_id} cryptographically verified for Order ${razorpay_order_id}. Amount ₹${amount}.`
    );

    // 6. Confirmation Notification Dispatch (Fire-and-forget)
    const emailRecipient = payment?.payer_email;
    if (emailRecipient) {
      sendEmailNotification(
        `Finxyora 2026 Confirmation - Payment ID ${razorpay_payment_id}`,
        `Your payment of ₹${amount} for reference ${resolvedRefId} has been successfully verified! Payment ID: ${razorpay_payment_id}`,
        `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0284c7; margin-top: 0;">Payment Verified Successfully</h2>
          <p>Thank you! Your transaction for <strong>FINXYORA 2026</strong> has been cryptographically confirmed.</p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Registration / Booking ID:</strong> ${resolvedRefId}</p>
            <p style="margin: 4px 0;"><strong>Razorpay Payment ID:</strong> ${razorpay_payment_id}</p>
            <p style="margin: 4px 0;"><strong>Razorpay Order ID:</strong> ${razorpay_order_id}</p>
            <p style="margin: 4px 0;"><strong>Amount Paid:</strong> ₹${amount}</p>
            <p style="margin: 4px 0;"><strong>Verification Method:</strong> Automated Gateway HMAC</p>
          </div>
          <p>View your pass anytime at: <a href="https://finxyora.com/lookup/${encodeURIComponent(resolvedRefId)}">finxyora.com/lookup/${resolvedRefId}</a></p>
        </div>
        `,
        { to: emailRecipient }
      ).catch((err) => console.error('Confirmation email error:', err));
    }

    const redirectUrl = resolvedRefId ? `/confirmation/${resolvedRefId}` : '/lookup';

    return NextResponse.json({
      success: true,
      message: 'Payment verified and confirmed successfully.',
      registrationId: resolvedRefId,
      paymentId: razorpay_payment_id,
      redirectUrl
    });
  } catch (err: unknown) {
    console.error('Error in /api/payments/verify-signature:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal payment signature verification error.'
      },
      { status: 500 }
    );
  }
}
