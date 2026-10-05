import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllEventRegistrations, getEventRegistration, deleteTestRegistrations, deleteRegistration } from '@/lib/db';

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
    const registrationType = (searchParams.get('registrationType')?.toUpperCase() as 'REAL' | 'TEST' | 'ALL') || 'REAL';
    const singleId = searchParams.get('id') || undefined;

    if (singleId) {
      const reg = await getEventRegistration(singleId);
      return NextResponse.json({ success: true, registration: reg });
    }

    const registrations = await getAllEventRegistrations({ eventId, status, registrationType, search });

    // Enrich with full participant rosters
    const enriched = await Promise.all(
      registrations.map((r) => getEventRegistration(r.id))
    );

    return NextResponse.json({
      success: true,
      registrations: enriched.filter(Boolean)
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // Support query-param style: ?deleteAllTest=true or ?id=FIN-XXX&confirmReal=true
    const deleteAllTest = searchParams.get('deleteAllTest') === 'true';
    const qParamId = searchParams.get('id') || '';
    const confirmReal = searchParams.get('confirmReal') === 'true';

    if (deleteAllTest) {
      const result = await deleteTestRegistrations();
      return NextResponse.json({
        success: true,
        message: `Deleted ${result.deletedCount} test registration(s) and associated records.`,
        deletedCount: result.deletedCount
      });
    }

    if (qParamId) {
      const ok = await deleteRegistration(qParamId, session.username, confirmReal);
      return NextResponse.json({
        success: ok,
        message: `Registration ${qParamId} permanently deleted.`
      });
    }

    // Fallback: Try JSON body (for API clients)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body, handled above
    }

    const { action, ids, id, confirmReal: bodyConfirmReal } = body;

    if (action === 'delete_test') {
      const result = await deleteTestRegistrations(ids);
      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${result.deletedCount} test registration(s).`,
        deletedCount: result.deletedCount
      });
    }

    if (action === 'delete_single' && id) {
      const ok = await deleteRegistration(id, session.username, Boolean(bodyConfirmReal));
      return NextResponse.json({
        success: ok,
        message: `Registration ${id} deleted successfully.`
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid delete parameters.' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Delete operation failed' },
      { status: 400 }
    );
  }
}
