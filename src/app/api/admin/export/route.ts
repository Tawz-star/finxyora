import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllEventRegistrations, getEventRegistration, getAllStallBookings } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'events';

    if (type === 'events') {
      const registrations = getAllEventRegistrations();
      const enriched = registrations.map(r => getEventRegistration(r.id)).filter(Boolean);

      const headers = [
        'Registration ID',
        'Event ID',
        'Event Title',
        'College Name',
        'College Location',
        'Team Name',
        'Leader Name',
        'Leader Email',
        'Leader Phone',
        'Participant Count',
        'Total Fee (INR)',
        'Payment Status',
        'Registered Date',
        'Participants Summary'
      ];

      const rows = enriched.map(reg => {
        const partsSummary = (reg?.participants || [])
          .map((p, idx) => `P${idx + 1}: ${p.full_name} (${p.roll_number}, ${p.department})`)
          .join(' | ');

        return [
          reg?.id,
          reg?.event_id,
          reg?.event?.title || '',
          `"${(reg?.college_name || '').replace(/"/g, '""')}"`,
          `"${(reg?.college_location || '').replace(/"/g, '""')}"`,
          `"${(reg?.team_name || '').replace(/"/g, '""')}"`,
          `"${(reg?.leader_name || '').replace(/"/g, '""')}"`,
          reg?.leader_email,
          reg?.leader_phone,
          reg?.participant_count,
          reg?.total_fee,
          reg?.payment_status,
          reg?.created_at,
          `"${partsSummary.replace(/"/g, '""')}"`
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="FINXYORA_Event_Registrations_${new Date().toISOString().slice(0, 10)}.csv"`
        }
      });
    } else if (type === 'stalls') {
      const bookings = getAllStallBookings();
      const headers = [
        'Booking ID',
        'Option ID',
        'Stall Category',
        'Applicant Type',
        'Entity Name',
        'College Name',
        'Department / Class',
        'Contact Name',
        'Contact Email',
        'Contact Phone',
        'Stalls Requested',
        'Electricity Included',
        'Total Amount (INR)',
        'Status',
        'Admin Notes',
        'Created At'
      ];

      const rows = bookings.map(b => [
        b.id,
        b.option_id,
        b.stall_category,
        b.applicant_type,
        `"${(b.entity_name || '').replace(/"/g, '""')}"`,
        `"${(b.college_name || '').replace(/"/g, '""')}"`,
        `"${(b.department_class || '').replace(/"/g, '""')}"`,
        `"${(b.contact_name || '').replace(/"/g, '""')}"`,
        b.contact_email,
        b.contact_phone,
        b.stalls_requested,
        b.has_electricity ? 'YES' : 'NO',
        b.total_amount,
        b.status,
        `"${(b.admin_notes || '').replace(/"/g, '""')}"`,
        b.created_at
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="FINXYORA_Stall_Bookings_${new Date().toISOString().slice(0, 10)}.csv"`
        }
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid export type' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    );
  }
}
