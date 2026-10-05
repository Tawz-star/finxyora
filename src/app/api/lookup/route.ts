import { NextRequest, NextResponse } from 'next/server';
import { query, getEventRegistration, getStallBooking } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function performLookup(searchQuery: string) {
  try {
    if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid Registration ID, UTR, email, or phone number.' },
        { status: 400 }
      );
    }

    const trimmed = searchQuery.trim();
    const lower = trimmed.toLowerCase();
    const wildLower = `%${lower}%`;
    const numericOnly = trimmed.replace(/\D/g, '');

    // 1. Direct ID check (Exact lookup for event or stall)
    const directEvent = await getEventRegistration(trimmed);
    if (directEvent) {
      return NextResponse.json({
        success: true,
        query: trimmed,
        eventRegistrations: [directEvent],
        stallBookings: []
      });
    }

    const directStall = await getStallBooking(trimmed);
    if (directStall) {
      return NextResponse.json({
        success: true,
        query: trimmed,
        eventRegistrations: [],
        stallBookings: [directStall]
      });
    }

    // 2. Multi-field Event Registrations Search (Async central SQL)
    const eventConditions = [
      'er.id = ?',
      'er.transaction_id = ?',
      'LOWER(er.leader_email) = ?',
      'er.leader_phone = ?',
      'LOWER(er.leader_name) LIKE ?',
      'LOWER(er.college_name) LIKE ?',
      "LOWER(COALESCE(er.team_name, '')) LIKE ?",
      "LOWER(COALESCE(p.full_name, '')) LIKE ?",
      'p.roll_number = ?'
    ];
    const eventParams: (string | number)[] = [
      trimmed,
      trimmed,
      lower,
      trimmed,
      wildLower,
      wildLower,
      wildLower,
      wildLower,
      trimmed
    ];

    if (numericOnly.length >= 4) {
      eventConditions.push('er.leader_phone LIKE ?');
      eventParams.push(`%${numericOnly}%`);
    }

    const eventRows = await query<{ id: string }>(`
      SELECT DISTINCT er.id, er.created_at
      FROM event_registrations er
      LEFT JOIN participants p ON er.id = p.registration_id
      WHERE ${eventConditions.join(' OR ')}
      ORDER BY er.created_at DESC
      LIMIT 10
    `, eventParams);

    // 3. Multi-field Stall Bookings Search (Async central SQL)
    const stallConditions = [
      'id = ?',
      'transaction_id = ?',
      'LOWER(contact_email) = ?',
      'contact_phone = ?',
      'LOWER(contact_name) LIKE ?',
      'LOWER(entity_name) LIKE ?'
    ];
    const stallParams: (string | number)[] = [
      trimmed,
      trimmed,
      lower,
      trimmed,
      wildLower,
      wildLower
    ];

    if (numericOnly.length >= 4) {
      stallConditions.push('contact_phone LIKE ?');
      stallParams.push(`%${numericOnly}%`);
    }

    const stallRows = await query<{ id: string }>(`
      SELECT DISTINCT id, created_at
      FROM stall_bookings
      WHERE ${stallConditions.join(' OR ')}
      ORDER BY created_at DESC
      LIMIT 10
    `, stallParams);

    // 4. Concurrently resolve full enriched records
    const eventRegistrations = (
      await Promise.all(eventRows.map((r) => getEventRegistration(r.id)))
    ).filter(Boolean);

    const stallBookings = (
      await Promise.all(stallRows.map((r) => getStallBooking(r.id)))
    ).filter(Boolean);

    return NextResponse.json({
      success: true,
      query: trimmed,
      eventRegistrations,
      stallBookings
    });
  } catch (err: unknown) {
    console.error('Lookup API error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return performLookup(body.query);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || searchParams.get('query') || '';
  return performLookup(q);
}
