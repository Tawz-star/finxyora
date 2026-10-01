import { NextRequest, NextResponse } from 'next/server';
import { confirmPayment } from '@/lib/db';
import { verifyRazorpaySignature, isSandboxMode } from '@/lib/razorpay';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, gatewayPaymentId, gatewayOrderId, gatewaySignature, verifiedAmount } = body;

    if (!paymentId || !gatewayPaymentId || verifiedAmount === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing payment verification credentials.' },
        { status: 400 }
      );
    }

    // Verify cryptographic signature if in production mode
    if (!isSandboxMode()) {
      if (!gatewaySignature || !gatewayOrderId) {
        return NextResponse.json(
          { success: false, error: 'Cryptographic signature and Order ID are required in production mode.' },
          { status: 400 }
        );
      }

      const isValid = verifyRazorpaySignature(gatewayOrderId, gatewayPaymentId, gatewaySignature);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Security alert: Invalid gateway payment signature.' },
          { status: 403 }
        );
      }
    }

    const result = confirmPayment({
      paymentId,
      gatewayPaymentId,
      gatewayOrderId,
      gatewaySignature,
      verifiedAmount: Number(verifiedAmount)
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Payment confirmation failed' },
      { status: 400 }
    );
  }
}
