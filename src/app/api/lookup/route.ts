import { NextRequest, NextResponse } from 'next/server';
import { getDb, getEventRegistration, getStallBooking } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Please enter a valid search query.' }, { status: 400 });
    }

    const trimmed = query.trim();
    const db = getDb();

    // 1. Direct ID lookup
    if (trimmed.startsWith('FX-EVT-')) {
      const reg = getEventRegistration(trimmed);
      if (reg) {
        return NextResponse.json({ success: true, eventRegistrations: [reg], stallBookings: [] });
      }
    }

    if (trimmed.startsWith('FX-STL-')) {
      const stl = getStallBooking(trimmed);
      if (stl) {
        return NextResponse.json({ success: true, eventRegistrations: [], stallBookings: [stl] });
      }
    }

    // 2. Email or Phone or fuzzy search
    const eventRows = db.prepare(`
      SELECT id FROM event_registrations
      WHERE id = ? OR leader_email = ? OR leader_phone = ? OR college_name LIKE ?
      ORDER BY created_at DESC LIMIT 10
    `).all(trimmed, trimmed.toLowerCase(), trimmed, `%${trimmed}%`) as Array<{ id: string }>;

    const stallRows = db.prepare(`
      SELECT id FROM stall_bookings
      WHERE id = ? OR contact_email = ? OR contact_phone = ? OR entity_name LIKE ?
      ORDER BY created_at DESC LIMIT 10
    `).all(trimmed, trimmed.toLowerCase(), trimmed, `%${trimmed}%`) as Array<{ id: string }>;

    const eventRegistrations = eventRows.map(r => getEventRegistration(r.id)).filter(Boolean);
    const stallBookings = stallRows.map(r => getStallBooking(r.id)).filter(Boolean);

    return NextResponse.json({
      success: true,
      eventRegistrations,
      stallBookings
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 }
    );
  }
}
