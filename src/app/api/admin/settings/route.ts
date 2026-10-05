import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSiteSettings, updateSiteSettings, logAuditEvent } from '@/lib/db';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getSiteSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid settings body' }, { status: 400 });
    }

    await updateSiteSettings(body);
    await logAuditEvent(session.username, 'UPDATE_SITE_SETTINGS', 'SYSTEM_SETTINGS', 'GLOBAL', 'Updated festival settings and credentials');

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update settings' },
      { status: 500 }
    );
  }
}
