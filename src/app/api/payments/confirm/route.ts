import { NextRequest, NextResponse } from 'next/server';
import { confirmClientSideRegistration } from '@/lib/db';
import { sendEventRegistrationEmail, sendStallBookingEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referenceType, paymentId, registrationId, expectedAmount, utrNumber, timestamp, isTest, eventData, stallData } = body;

    // Validate inputs
    if (!referenceType || !paymentId || !registrationId || expectedAmount === undefined || !utrNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing required confirmation fields (paymentId, registrationId, amount, utrNumber).' },
        { status: 400 }
      );
    }

    const cleanUtr = String(utrNumber).trim();
    if (cleanUtr.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Invalid UPI Reference / UTR Number. Must be at least 6 digits/characters from your payment receipt.' },
        { status: 400 }
      );
    }

    // Atomically save to centralized SQL database
    const result = await confirmClientSideRegistration({
      referenceType,
      paymentId,
      registrationId,
      expectedAmount: Number(expectedAmount),
      utrNumber: cleanUtr,
      timestamp,
      isTest: Boolean(isTest),
      eventData,
      stallData
    });

    // Send automatic notification email to finxyora@gmail.com
    try {
      if (referenceType === 'event' && eventData) {
        await sendEventRegistrationEmail({
          eventName: String(result.ticketDetails.eventName || eventData.eventId),
          registrationId: result.registrationId,
          totalAmount: result.amount,
          utrNumber: result.utrNumber,
          leaderName: eventData.leaderName,
          leaderEmail: eventData.leaderEmail,
          leaderPhone: eventData.leaderPhone,
          collegeName: eventData.collegeName,
          participantCount: eventData.participants?.length || 0,
          participants: eventData.participants || []
        });
      } else if (referenceType === 'stall' && stallData) {
        await sendStallBookingEmail({
          categoryName: String(result.ticketDetails.categoryName || stallData.optionId),
          bookingId: result.registrationId,
          totalAmount: result.amount,
          utrNumber: result.utrNumber,
          entityName: stallData.entityName,
          contactName: stallData.contactName,
          contactEmail: stallData.contactEmail,
          contactPhone: stallData.contactPhone,
          stallsRequested: stallData.stallsRequested,
          productsServices: stallData.productsServices
        });
      }
    } catch (emailErr) {
      console.warn('Failed to send notification email (non-fatal):', emailErr);
    }

    return NextResponse.json({
      success: true,
      registrationId: result.registrationId,
      referenceId: result.registrationId,
      redirectUrl: `/confirmation/${result.registrationId}`,
      amount: result.amount,
      utrNumber: result.utrNumber,
      ticketDetails: result.ticketDetails
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Payment confirmation failed' },
      { status: 400 }
    );
  }
}
