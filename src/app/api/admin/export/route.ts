import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getAdminSession } from '@/lib/auth';
import {
  getAllEvents,
  getEventById,
  getAllEventRegistrations,
  getEventRegistration,
  getAllStallBookings,
  formatApplicantType,
  formatCreatedAtIST,
  EventRegistrationRecord,
  StallBookingRecord,
  EventRecord
} from '@/lib/db';

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'events';
    const format = searchParams.get('format');
    const eventId = searchParams.get('eventId');
    const registrationType = (searchParams.get('registrationType')?.toUpperCase() as 'REAL' | 'TEST' | 'ALL') || 'ALL';

    // ==========================================
    // 1. EVENT REGISTRATIONS EXPORT
    // ==========================================
    if (type === 'events') {
      const allDbEvents = await getAllEvents();

      // CASE A: Single Event CSV Export (if requested via format=csv with eventId)
      if (format === 'csv' && eventId) {
        const targetEvent = allDbEvents.find((e) => e.id === eventId) || (await getEventById(eventId));
        if (!targetEvent) {
          return NextResponse.json({ success: false, error: `Event "${eventId}" not found` }, { status: 404 });
        }

        const isSolo = Number(targetEvent.max_participants) <= 1;
        const regRecords = await getAllEventRegistrations({ eventId, registrationType });
        const enriched = await Promise.all(regRecords.map((r) => getEventRegistration(r.id)));
        const validRegs = enriched.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getEventRegistration>>>[];

        let headers: string[];
        let rows: string[][];

        if (isSolo) {
          headers = [
            'Registration ID',
            'Candidate Name',
            'Roll Number',
            'Department',
            'Year of Study',
            'Section',
            'College Name',
            'Candidate Email',
            'Candidate Phone',
            'Registration Type',
            'Total Fee (INR)',
            'Payment Status',
            'Registration Status',
            'UTR / Transaction ID',
            'Registered Date & Time (IST)'
          ];

          rows = validRegs.map((reg) => {
            const p = (reg.participants && reg.participants[0]) || null;
            return [
              reg.id,
              escapeCsvCell(p?.full_name || reg.leader_name),
              escapeCsvCell(p?.roll_number || '—'),
              escapeCsvCell(p?.department || '—'),
              escapeCsvCell(p?.year_of_study || '—'),
              escapeCsvCell(p?.section || '—'),
              escapeCsvCell(reg.college_name),
              reg.leader_email,
              reg.leader_phone,
              reg.registration_type,
              String(reg.total_fee),
              reg.payment_status.toUpperCase(),
              reg.registration_status.toUpperCase(),
              escapeCsvCell(reg.transaction_id || '—'),
              escapeCsvCell(formatCreatedAtIST(reg.created_at))
            ];
          });
        } else {
          headers = [
            'Registration ID',
            'Team Name',
            'Team Leader Name',
            'Leader Email',
            'Leader Phone',
            'College Name',
            'College Location',
            'Participant Count',
            'Team Members Roster',
            'Registration Type',
            'Total Fee (INR)',
            'Payment Status',
            'Registration Status',
            'UTR / Transaction ID',
            'Registered Date & Time (IST)'
          ];

          rows = validRegs.map((reg) => {
            const roster = (reg.participants || [])
              .map((p, idx) => `P${idx + 1}: ${p.full_name} (${p.roll_number}, ${p.department}, Yr:${p.year_of_study}, Sec:${p.section})`)
              .join(' | ') || '—';

            return [
              reg.id,
              escapeCsvCell(reg.team_name || '—'),
              escapeCsvCell(reg.leader_name),
              reg.leader_email,
              reg.leader_phone,
              escapeCsvCell(reg.college_name),
              escapeCsvCell(reg.college_location || '—'),
              String(reg.participant_count),
              escapeCsvCell(roster),
              reg.registration_type,
              String(reg.total_fee),
              reg.payment_status.toUpperCase(),
              reg.registration_status.toUpperCase(),
              escapeCsvCell(reg.transaction_id || '—'),
              escapeCsvCell(formatCreatedAtIST(reg.created_at))
            ];
          });
        }

        const csvString = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
        const filename = `FINXYORA_${targetEvent.title.replace(/[^a-zA-Z0-9]/g, '_')}_Registrations_${new Date().toISOString().slice(0, 10)}.csv`;

        return new NextResponse(csvString, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        });
      }

      // CASE B: Single Excel Workbook (.xlsx) with Separate Worksheets for Each Event
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'FINXYORA 2K26 Festival Management';
      workbook.lastModifiedBy = session.username;
      workbook.created = new Date();
      workbook.modified = new Date();

      for (const ev of allDbEvents) {
        // Sanitize sheet name (Excel limits sheet names to 31 chars and bans \ / ? * [ ] :)
        const safeTitle = ev.title.replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || `Event_${ev.id}`;
        const worksheet = workbook.addWorksheet(safeTitle, {
          properties: { tabColor: { argb: 'FF0284C7' } }
        });

        worksheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];

        const isSolo = Number(ev.max_participants) <= 1;

        if (isSolo) {
          // Solo / Candidate-Specific Columns (e.g., Best CFO, Best Manager)
          worksheet.columns = [
            { header: 'Registration ID', key: 'id', width: 18 },
            { header: 'Candidate Name', key: 'candidate_name', width: 24 },
            { header: 'Roll Number', key: 'roll_number', width: 16 },
            { header: 'Department', key: 'department', width: 22 },
            { header: 'Year of Study', key: 'year_of_study', width: 15 },
            { header: 'Section', key: 'section', width: 12 },
            { header: 'College Name', key: 'college_name', width: 28 },
            { header: 'Candidate Email', key: 'email', width: 26 },
            { header: 'Candidate Phone', key: 'phone', width: 16 },
            { header: 'Registration Type', key: 'reg_type', width: 16 },
            { header: 'Fee (₹)', key: 'fee', width: 12 },
            { header: 'Payment Status', key: 'pay_status', width: 16 },
            { header: 'Status', key: 'status', width: 14 },
            { header: 'UTR / Transaction ID', key: 'utr', width: 22 },
            { header: 'Registered Date & Time (IST)', key: 'created_at', width: 34 }
          ];
        } else {
          // Team-Specific Columns (e.g., Prompt Perfect, Corporate Walk, B Quiz, Football Auction)
          worksheet.columns = [
            { header: 'Registration ID', key: 'id', width: 18 },
            { header: 'Team Name', key: 'team_name', width: 24 },
            { header: 'Team Leader Name', key: 'leader_name', width: 22 },
            { header: 'Leader Email', key: 'leader_email', width: 26 },
            { header: 'Leader Phone', key: 'leader_phone', width: 16 },
            { header: 'College Name', key: 'college_name', width: 28 },
            { header: 'College Location', key: 'college_location', width: 18 },
            { header: 'Member Count', key: 'member_count', width: 14 },
            { header: 'Team Members Roster', key: 'roster', width: 45 },
            { header: 'Registration Type', key: 'reg_type', width: 16 },
            { header: 'Total Fee (₹)', key: 'fee', width: 14 },
            { header: 'Payment Status', key: 'pay_status', width: 16 },
            { header: 'Status', key: 'status', width: 14 },
            { header: 'UTR / Transaction ID', key: 'utr', width: 22 },
            { header: 'Registered Date & Time (IST)', key: 'created_at', width: 34 }
          ];
        }

        // Style the Header Row
        const headerRow = worksheet.getRow(1);
        headerRow.height = 26;
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F172A' } // Sleek Navy Slate #0F172A
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            bottom: { style: 'medium', color: { argb: 'FF38BDF8' } }
          };
        });

        // Query Registrations for this specific event
        const regRecords = await getAllEventRegistrations({ eventId: ev.id, registrationType });
        const enriched = await Promise.all(regRecords.map((r) => getEventRegistration(r.id)));
        const validRegs = enriched.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getEventRegistration>>>[];

        // Populate Rows
        validRegs.forEach((reg) => {
          if (isSolo) {
            const p = (reg.participants && reg.participants[0]) || null;
            worksheet.addRow({
              id: reg.id,
              candidate_name: p?.full_name || reg.leader_name,
              roll_number: p?.roll_number || '—',
              department: p?.department || '—',
              year_of_study: p?.year_of_study || '—',
              section: p?.section || '—',
              college_name: reg.college_name || '—',
              email: reg.leader_email,
              phone: reg.leader_phone,
              reg_type: reg.registration_type,
              fee: reg.total_fee,
              pay_status: reg.payment_status.toUpperCase(),
              status: reg.registration_status.toUpperCase(),
              utr: reg.transaction_id || '—',
              created_at: formatCreatedAtIST(reg.created_at)
            });
          } else {
            const roster = (reg.participants || [])
              .map((p, idx) => `P${idx + 1}: ${p.full_name} (${p.roll_number}, ${p.department}, Yr:${p.year_of_study}, Sec:${p.section})`)
              .join(' | ') || '—';

            worksheet.addRow({
              id: reg.id,
              team_name: reg.team_name || '—',
              leader_name: reg.leader_name,
              leader_email: reg.leader_email,
              leader_phone: reg.leader_phone,
              college_name: reg.college_name || '—',
              college_location: reg.college_location || '—',
              member_count: reg.participant_count,
              roster: roster,
              reg_type: reg.registration_type,
              fee: reg.total_fee,
              pay_status: reg.payment_status.toUpperCase(),
              status: reg.registration_status.toUpperCase(),
              utr: reg.transaction_id || '—',
              created_at: formatCreatedAtIST(reg.created_at)
            });
          }
        });

        // Adjust column widths based on maximum content length
        worksheet.columns.forEach((col) => {
          let maxLen = col.header ? String(col.header).length : 12;
          col.eachCell?.({ includeEmpty: false }, (cell) => {
            const len = cell.value ? String(cell.value).length : 0;
            if (len > maxLen) maxLen = len;
          });
          col.width = Math.min(Math.max(maxLen + 3, 14), 48);
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `FINXYORA_2K26_Event_Registrations_${new Date().toISOString().slice(0, 10)}.xlsx`;

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    // ==========================================
    // 2. STALL REGISTRATIONS CSV EXPORT
    // ==========================================
    if (type === 'stalls') {
      const bookings: StallBookingRecord[] = await getAllStallBookings({ registrationType });

      // Note: College Name is intentionally EXCLUDED from stall CSV export per requirement 5.
      // Applicant Type is accurately mapped using formatApplicantType ('Student' vs 'Outsider') per requirement 4.
      // Created At is formatted as 'Sunday, 11 October 2026, 03:30 PM IST' per requirement 6.
      const headers = [
        'Booking ID',
        'Registration Type',
        'Option ID',
        'Stall Category',
        'Applicant Type',
        'Entity Name',
        'Department / Class',
        'Contact Name',
        'Contact Email',
        'Contact Phone',
        'Products / Services',
        'Stalls Requested',
        'Duration (Days)',
        'Selected Day',
        'Booking Dates',
        'Electricity Included',
        'Total Amount (INR)',
        'Payment Status',
        'Booking Status',
        'UTR / Transaction ID',
        'Admin Notes',
        'Created At'
      ];

      const rows = bookings.map((b: StallBookingRecord) => {
        const cleanApplicantType = formatApplicantType(b.applicant_type, b.stall_category);
        const durationDays = b.duration_days || 1;
        const selectedDay = b.selected_day || (durationDays === 2 ? 'Both Days' : '1 Day');
        const bookingDates = b.booking_dates || '';

        return [
          b.id,
          b.registration_type,
          b.option_id,
          b.stall_category,
          cleanApplicantType,
          escapeCsvCell(b.entity_name),
          escapeCsvCell(b.department_class || ''),
          escapeCsvCell(b.contact_name),
          b.contact_email,
          b.contact_phone,
          escapeCsvCell(b.products_services),
          String(b.stalls_requested),
          String(durationDays),
          escapeCsvCell(selectedDay),
          escapeCsvCell(bookingDates),
          b.has_electricity ? 'YES' : 'NO',
          String(b.total_amount),
          (b.payment_status || 'submitted').toUpperCase(),
          (b.status || 'pending').toUpperCase(),
          escapeCsvCell(b.transaction_id || '—'),
          escapeCsvCell(b.admin_notes || ''),
          escapeCsvCell(formatCreatedAtIST(b.created_at))
        ].join(',');
      });

      const csvContent = [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
      const filename = `FINXYORA_2K26_Stall_Bookings_${new Date().toISOString().slice(0, 10)}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid export type. Must be "events" or "stalls".' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Export error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Export generation failed' },
      { status: 500 }
    );
  }
}
