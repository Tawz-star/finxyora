import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getDashboardMetrics, getAuditLogs } from '@/lib/db';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const metrics = getDashboardMetrics();
    const auditLogs = getAuditLogs(20);

    return NextResponse.json({
      success: true,
      metrics,
      auditLogs,
      admin: session
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load dashboard metrics' },
      { status: 500 }
    );
  }
}
