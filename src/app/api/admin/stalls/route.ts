import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllStallOptions, getAllStallBookings, updateStallOption, updateStallBookingStatus, logAuditEvent } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;

    const options = getAllStallOptions();
    const bookings = getAllStallBookings({ status, category, search });

    return NextResponse.json({ success: true, options, bookings });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch stalls' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, price, has_electricity, description, total_stalls, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Stall Option ID required' }, { status: 400 });
    }

    updateStallOption(id, {
      name,
      price: Number(price),
      has_electricity: has_electricity ? 1 : 0,
      description,
      total_stalls: Number(total_stalls),
      is_active: is_active ? 1 : 0
    });

    logAuditEvent(session.username, 'UPDATE_STALL_OPTION', 'STALL_OPTION', id, `Updated price=${price}, total=${total_stalls}`);

    return NextResponse.json({ success: true, message: 'Stall option updated' });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update stall option' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, adminNotes } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'Booking ID and status required' }, { status: 400 });
    }

    updateStallBookingStatus(id, status, adminNotes);
    logAuditEvent(session.username, 'UPDATE_STALL_BOOKING_STATUS', 'STALL_BOOKING', id, `Status updated to ${status}. Notes: ${adminNotes || 'None'}`);

    return NextResponse.json({ success: true, message: 'Stall booking updated' });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update booking status' },
      { status: 500 }
    );
  }
}
