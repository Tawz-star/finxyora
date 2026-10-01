import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllEventRegistrations, getEventRegistration } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const singleId = searchParams.get('id') || undefined;

    if (singleId) {
      const reg = getEventRegistration(singleId);
      return NextResponse.json({ success: true, registration: reg });
    }

    const registrations = getAllEventRegistrations({ eventId, status, search });
    // Expand participants for each registration
    const enriched = registrations.map((r) => getEventRegistration(r.id)).filter(Boolean);

    return NextResponse.json({ success: true, registrations: enriched });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}
