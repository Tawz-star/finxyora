import { NextRequest, NextResponse } from 'next/server';
import { createStallBooking, getStallBooking } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      optionId,
      applicantType,
      entityName,
      collegeName,
      departmentClass,
      contactName,
      contactEmail,
      contactPhone,
      businessDetails,
      productsServices,
      stallsRequested
    } = body;

    if (!optionId || !applicantType || !entityName || !contactName || !contactEmail || !contactPhone || !productsServices) {
      return NextResponse.json(
        { success: false, error: 'Please fill in all required contact and stall information fields.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return NextResponse.json({ success: false, error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (contactPhone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ success: false, error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    const requested = Number(stallsRequested) || 1;
    if (requested < 1) {
      return NextResponse.json({ success: false, error: 'You must request at least 1 stall.' }, { status: 400 });
    }

    if (applicantType === 'student' && (!collegeName || !departmentClass)) {
      return NextResponse.json(
        { success: false, error: 'College Name and Department/Class are mandatory for student stall applicants.' },
        { status: 400 }
      );
    }

    const result = createStallBooking({
      optionId,
      applicantType: applicantType === 'student' ? 'student' : 'vendor',
      entityName,
      collegeName,
      departmentClass,
      contactName,
      contactEmail,
      contactPhone,
      businessDetails,
      productsServices,
      stallsRequested: requested
    });

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      totalAmount: result.totalAmount
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Stall booking failed' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Booking ID is required' }, { status: 400 });
    }

    const booking = getStallBooking(id);
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Stall booking not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, booking });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to retrieve stall booking' },
      { status: 500 }
    );
  }
}
