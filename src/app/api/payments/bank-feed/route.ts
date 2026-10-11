import { NextRequest, NextResponse } from 'next/server';
import { recordIncomingBankCredit, parseBankCreditMessage, verifyPaymentAutomatically } from '@/lib/payment-verification';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/bank-feed
 *
 * Secure feed endpoint to ingest incoming credit notifications from:
 * 1. Bank SMS parser feeds (Android/iOS automated forwarders)
 * 2. Axis Bank statement CSV / webhook callbacks
 * 3. UPI aggregator notifications
 *
 * Automatically checks and fulfills any pending registrations waiting for this credit.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let amount: number | undefined;
    let senderPhone: string | undefined;
    let senderVpa: string | undefined;
    let bankRef: string | undefined;
    let payerName: string | undefined;
    let rawMessage: string | undefined;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      rawMessage = body.rawMessage || body.message || body.text;

      if (rawMessage) {
        const parsed = parseBankCreditMessage(rawMessage);
        amount = body.amount ?? parsed.amount;
        senderPhone = body.senderPhone ?? body.phone ?? parsed.phone;
        senderVpa = body.senderVpa ?? body.vpa ?? parsed.vpa;
        bankRef = body.bankRef ?? body.utr ?? body.ref ?? parsed.bankRef;
        payerName = body.payerName ?? body.name ?? parsed.payerName;
      } else {
        amount = Number(body.amount);
        senderPhone = body.senderPhone || body.phone;
        senderVpa = body.senderVpa || body.vpa;
        bankRef = body.bankRef || body.utr || body.ref;
        payerName = body.payerName || body.name;
      }
    } else {
      rawMessage = await req.text();
      const parsed = parseBankCreditMessage(rawMessage);
      amount = parsed.amount;
      senderPhone = parsed.phone;
      senderVpa = parsed.vpa;
      bankRef = parsed.bankRef;
      payerName = parsed.payerName;
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Could not extract valid credit amount from incoming feed' },
        { status: 400 }
      );
    }

    // 1. Record incoming credit in SQL table
    const credit = await recordIncomingBankCredit({
      amount,
      senderPhone,
      senderVpa,
      bankRef,
      payerName,
      rawMessage
    });

    // 2. Proactively search for any pending payment awaiting this credit
    let matchedResult = null;
    if (senderPhone) {
      const cleanPhone = senderPhone.replace(/\D/g, '').slice(-10);
      const pendingPayment = await queryOne<{ id: string; reference_id: string }>(`
        SELECT id, reference_id FROM payments
        WHERE status IN ('pending', 'submitted', 'REVIEW_REQUIRED', 'verifying')
          AND ABS(amount - ?) < 0.01
          AND payer_phone LIKE ?
        ORDER BY created_at DESC
        LIMIT 1
      `, [amount, `%${cleanPhone}%`]);

      if (pendingPayment) {
        matchedResult = await verifyPaymentAutomatically({
          paymentId: pendingPayment.id,
          registrationId: pendingPayment.reference_id,
          phone: cleanPhone,
          expectedAmount: amount
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Incoming bank credit recorded successfully',
      credit,
      matched: Boolean(matchedResult?.isVerified),
      matchedDetails: matchedResult
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to process bank feed'
      },
      { status: 500 }
    );
  }
}
