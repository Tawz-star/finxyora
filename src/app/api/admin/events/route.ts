import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllEvents, updateEvent, logAuditEvent } from '@/lib/db';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const events = getAllEvents();
    return NextResponse.json({ success: true, events });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch events' },
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
    const { id, title, category, description, rules, min_participants, max_participants, registration_fee, fee_type, is_open, deadline } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Event ID required' }, { status: 400 });
    }

    updateEvent(id, {
      title,
      category,
      description,
      rules: typeof rules === 'string' ? rules : JSON.stringify(rules),
      min_participants: Number(min_participants),
      max_participants: Number(max_participants),
      registration_fee: Number(registration_fee),
      fee_type: fee_type === 'per_participant' ? 'per_participant' : 'per_team',
      is_open: is_open ? 1 : 0,
      deadline
    });

    logAuditEvent(
      session.username,
      'UPDATE_EVENT',
      'EVENT',
      id,
      `Updated event settings: title=${title}, fee=${registration_fee}, open=${is_open}`
    );

    return NextResponse.json({ success: true, message: 'Event updated successfully' });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update event' },
      { status: 500 }
    );
  }
}
