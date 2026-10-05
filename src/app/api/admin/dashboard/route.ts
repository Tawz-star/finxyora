import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getDashboardMetrics, getAuditLogs } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = (searchParams.get('filter')?.toUpperCase() as 'REAL' | 'ALL' | 'TEST') || 'REAL';

    const metrics = await getDashboardMetrics(filter);
    const auditLogs = await getAuditLogs(25);

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
