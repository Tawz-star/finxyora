import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllEnquiries, updateEnquiryStatus, logAuditEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    const enquiries = await getAllEnquiries(status);

    return NextResponse.json({
      success: true,
      enquiries
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch enquiries' },
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

    const { id, status } = await req.json();

    if (!id || !['new', 'in-progress', 'resolved'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Valid enquiry ID and status (new, in-progress, resolved) required.' },
        { status: 400 }
      );
    }

    const success = await updateEnquiryStatus(id, status);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Enquiry not found or not updated' }, { status: 404 });
    }

    await logAuditEvent(
      session.username,
      'UPDATE_ENQUIRY_STATUS',
      'ENQUIRY',
      id,
      `Status updated to: ${status}`
    );

    return NextResponse.json({
      success: true,
      message: `Enquiry status updated to ${status}`
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update enquiry status' },
      { status: 500 }
    );
  }
}
