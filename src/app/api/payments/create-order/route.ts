import { NextRequest, NextResponse } from 'next/server';
import { createPaymentOrder, execute, queryOne } from '@/lib/db';
import { getRazorpayConfig, createRazorpayOrder } from '@/lib/razorpay';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/create-order (and /api/create-order)
 *
 * 1. Validates registration details strictly on the server and enforces fee calculation.
 * 2. Creates/retrieves pending registration and payment records in the central SQL database.
 * 3. Calls the official Razorpay Orders API to generate a unique gateway order ID.
 * 4. Persists the gateway_order_id in the database.
 * 5. Returns order_id, amount (in paise), currency, and public keyId to the frontend.
 */
export async function POST(req: NextRequest) {
  try {
    const rzpConfig = getRazorpayConfig();
    const body = await req.json();
    const { referenceType, eventData, stallData, registrationId, isTest } = body;

    if (!referenceType || (referenceType !== 'event' && referenceType !== 'stall')) {
      return NextResponse.json(
        { success: false, error: 'Invalid referenceType. Must be "event" or "stall".' },
        { status: 400 }
      );
    }

    // 1. Authoritative Server-Side Validation & Local Record Creation
    const orderRecord = await createPaymentOrder({
      referenceType,
      registrationId,
      isTest: Boolean(isTest),
      eventData,
      stallData
    });

    const amountInInr = Number(orderRecord.amount);
    if (!amountInInr || amountInInr <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid or zero payment amount calculated.' },
        { status: 400 }
      );
    }

    const regId = orderRecord.registrationId;
    const receipt = `RCP-${regId.replace(/[^a-zA-Z0-9_-]/g, '').slice(-20)}-${Date.now().toString().slice(-6)}`;

    // 2. Generate Razorpay Gateway Order
    let razorpayOrderId: string;
    let amountInPaise = Math.round(amountInInr * 100);
    let currency = 'INR';

    if (rzpConfig.isConfigured) {
      // Official Razorpay API Call
      const rzpOrder = await createRazorpayOrder({
        amountInInr,
        receipt,
        notes: {
          referenceType,
          registrationId: regId,
          itemTitle: orderRecord.itemTitle || 'Finxyora 2026',
          payerEmail: eventData?.leaderEmail || stallData?.contactEmail || ''
        }
      });

      razorpayOrderId = rzpOrder.id;
      amountInPaise = rzpOrder.amount;
      currency = rzpOrder.currency;
    } else {
      // Development / Test Fallback when credentials are pending configuration
      console.warn('⚠️ Razorpay credentials not configured. Generating sandbox order reference for local development.');
      razorpayOrderId = `order_test_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    }

    // 3. Update local database payment with the generated gateway_order_id
    await execute(`
      UPDATE payments SET
        gateway_order_id = ?,
        payment_method = 'RAZORPAY',
        verification_method = 'GATEWAY'
      WHERE id = ? OR reference_id = ?
    `, [razorpayOrderId, orderRecord.paymentId, regId]);

    // 4. Return order tokens to frontend
    return NextResponse.json({
      success: true,
      order_id: razorpayOrderId,
      orderId: razorpayOrderId,
      amount: amountInPaise,
      amountInInr,
      currency,
      keyId: rzpConfig.keyId || 'rzp_test_placeholder',
      registrationId: regId,
      paymentId: orderRecord.paymentId,
      itemTitle: orderRecord.itemTitle
    });
  } catch (err: unknown) {
    console.error('Error in /api/payments/create-order:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create payment order.'
      },
      { status: 500 }
    );
  }
}
