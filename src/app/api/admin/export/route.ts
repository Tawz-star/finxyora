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
  StallBookingRecord,
  EventRecord
} from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'events';
    const eventId = searchParams.get('eventId');
    const registrationType = (searchParams.get('registrationType')?.toUpperCase() as 'REAL' | 'TEST' | 'ALL') || 'ALL';

    // =========================================================================
    // 1. EVENT REGISTRATIONS REPORT (EXCEL .XLSX WITH SUMMARY & EVENT SHEETS)
    // =========================================================================
    if (type === 'events') {
      const allDbEvents = await getAllEvents();
      const eventsToExport = eventId
        ? allDbEvents.filter((e) => e.id === eventId)
        : allDbEvents;

      if (eventsToExport.length === 0) {
        return NextResponse.json({ success: false, error: `Event "${eventId}" not found` }, { status: 404 });
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Finxyora 2K26 Festival Management';
      workbook.lastModifiedBy = session.username;
      workbook.created = new Date();
      workbook.modified = new Date();

      // -----------------------------------------------------------------------
      // SHEET 1: Executive Overview & Financial Totals
      // -----------------------------------------------------------------------
      const summarySheet = workbook.addWorksheet('Overview & Totals', {
        properties: { tabColor: { argb: 'FF0284C7' } }
      });
      summarySheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];

      summarySheet.columns = [
        { header: 'Event ID', key: 'id', width: 16 },
        { header: 'Competition Name', key: 'title', width: 26 },
        { header: 'Category', key: 'category', width: 18 },
        { header: 'Format', key: 'format', width: 14 },
        { header: 'Fee (₹)', key: 'fee', width: 12 },
        { header: 'Total Registrations', key: 'total_regs', width: 20 },
        { header: 'Verified / Paid', key: 'paid_regs', width: 16 },
        { header: 'Total Delegates', key: 'delegates', width: 16 },
        { header: 'Verified Revenue (₹)', key: 'revenue', width: 22 }
      ];

      // Style summary header
      const summaryHeader = summarySheet.getRow(1);
      summaryHeader.height = 28;
      summaryHeader.eachCell((cell) => {
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

      let summaryDataStartRow = 2;
      for (const ev of eventsToExport) {
        const isSolo = Number(ev.max_participants) <= 1;
        const regRecords = await getAllEventRegistrations({ eventId: ev.id, registrationType });
        const totalRegs = regRecords.length;
        const paidRegs = regRecords.filter(
          (r) => ['verified', 'paid', 'successful'].includes(r.payment_status.toLowerCase()) && r.registration_status !== 'cancelled'
        ).length;
        const totalDelegates = regRecords.reduce((acc, r) => acc + Number(r.participant_count || 1), 0);
        const verifiedRevenue = regRecords
          .filter((r) => ['verified', 'paid', 'successful'].includes(r.payment_status.toLowerCase()) && r.registration_status !== 'cancelled')
          .reduce((acc, r) => acc + Number(r.total_fee || 0), 0);

        const row = summarySheet.addRow({
          id: ev.id,
          title: ev.title,
          category: ev.category,
          format: isSolo ? 'Solo / Individual' : `Team (max ${ev.max_participants})`,
          fee: ev.registration_fee,
          total_regs: totalRegs,
          paid_regs: paidRegs,
          delegates: totalDelegates,
          revenue: verifiedRevenue
        });

        row.alignment = { vertical: 'middle' };
        row.getCell('fee').numFmt = '₹#,##0';
        row.getCell('revenue').numFmt = '₹#,##0';
        row.getCell('total_regs').alignment = { horizontal: 'center' };
        row.getCell('paid_regs').alignment = { horizontal: 'center' };
        row.getCell('delegates').alignment = { horizontal: 'center' };
      }

      const summaryEndRow = summarySheet.rowCount;

      // Add Grand Total Row to Summary Sheet
      if (summaryEndRow >= summaryDataStartRow) {
        const grandTotalRow = summarySheet.addRow({
          id: '—',
          title: 'GRAND TOTAL',
          category: 'All Events',
          format: '—',
          fee: 0,
          total_regs: { formula: `SUM(F${summaryDataStartRow}:F${summaryEndRow})` },
          paid_regs: { formula: `SUM(G${summaryDataStartRow}:G${summaryEndRow})` },
          delegates: { formula: `SUM(H${summaryDataStartRow}:H${summaryEndRow})` },
          revenue: { formula: `SUM(I${summaryDataStartRow}:I${summaryEndRow})` }
        });

        grandTotalRow.height = 24;
        grandTotalRow.eachCell((cell) => {
          cell.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0F2FE' } // Light Sky Blue Tint #E0F2FE
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF0284C7' } },
            bottom: { style: 'double', color: { argb: 'FF0284C7' } }
          };
        });
        grandTotalRow.getCell('fee').value = '';
        grandTotalRow.getCell('revenue').numFmt = '₹#,##0';
      }

      summarySheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: summarySheet.columns.length }
      };

      // -----------------------------------------------------------------------
      // SHEETS 2+: Individual Event Worksheets
      // -----------------------------------------------------------------------
      for (const ev of eventsToExport) {
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
            { header: 'Fee (₹)', key: 'fee', width: 14 },
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

        // Enable auto-filter
        worksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: worksheet.columns.length }
        };

        // Query Registrations for this event
        const regRecords = await getAllEventRegistrations({ eventId: ev.id, registrationType });
        const enriched = await Promise.all(regRecords.map((r) => getEventRegistration(r.id)));
        const validRegs = enriched.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getEventRegistration>>>[];

        const eventDataStartRow = 2;
        validRegs.forEach((reg) => {
          if (isSolo) {
            const p = (reg.participants && reg.participants[0]) || null;
            const r = worksheet.addRow({
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
              fee: Number(reg.total_fee || 0),
              pay_status: reg.payment_status.toUpperCase(),
              status: reg.registration_status.toUpperCase(),
              utr: reg.transaction_id || '—',
              created_at: formatCreatedAtIST(reg.created_at)
            });
            r.getCell('fee').numFmt = '₹#,##0';
          } else {
            const roster = (reg.participants || [])
              .map((p, idx) => `P${idx + 1}: ${p.full_name} (${p.roll_number}, ${p.department}, Yr:${p.year_of_study}, Sec:${p.section})`)
              .join(' | ') || '—';

            const r = worksheet.addRow({
              id: reg.id,
              team_name: reg.team_name || '—',
              leader_name: reg.leader_name,
              leader_email: reg.leader_email,
              leader_phone: reg.leader_phone,
              college_name: reg.college_name || '—',
              college_location: reg.college_location || '—',
              member_count: Number(reg.participant_count || 1),
              roster: roster,
              reg_type: reg.registration_type,
              fee: Number(reg.total_fee || 0),
              pay_status: reg.payment_status.toUpperCase(),
              status: reg.registration_status.toUpperCase(),
              utr: reg.transaction_id || '—',
              created_at: formatCreatedAtIST(reg.created_at)
            });
            r.getCell('fee').numFmt = '₹#,##0';
          }
        });

        const eventEndRow = worksheet.rowCount;

        // Add a bold TOTAL row at the bottom of the worksheet
        if (eventEndRow >= eventDataStartRow) {
          if (isSolo) {
            const totalRow = worksheet.addRow({
              id: 'TOTAL',
              candidate_name: `Total Candidates: ${validRegs.length}`,
              roll_number: '',
              department: '',
              year_of_study: '',
              section: '',
              college_name: '',
              email: '',
              phone: '',
              reg_type: '',
              fee: { formula: `SUM(K${eventDataStartRow}:K${eventEndRow})` },
              pay_status: '',
              status: '',
              utr: '',
              created_at: ''
            });
            totalRow.height = 22;
            totalRow.eachCell((cell) => {
              cell.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF1F5F9' }
              };
              cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'double', color: { argb: 'FF0F172A' } }
              };
            });
            totalRow.getCell('fee').numFmt = '₹#,##0';
          } else {
            const totalRow = worksheet.addRow({
              id: 'TOTAL',
              team_name: `Total Teams: ${validRegs.length}`,
              leader_name: '',
              leader_email: '',
              leader_phone: '',
              college_name: '',
              college_location: '',
              member_count: { formula: `SUM(H${eventDataStartRow}:H${eventEndRow})` },
              roster: '',
              reg_type: '',
              fee: { formula: `SUM(K${eventDataStartRow}:K${eventEndRow})` },
              pay_status: '',
              status: '',
              utr: '',
              created_at: ''
            });
            totalRow.height = 22;
            totalRow.eachCell((cell) => {
              cell.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF1F5F9' }
              };
              cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'double', color: { argb: 'FF0F172A' } }
              };
            });
            totalRow.getCell('fee').numFmt = '₹#,##0';
          }
        }

        // Adjust column widths
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
      const filename = eventId
        ? `Finxyora_${(eventsToExport[0]?.title || 'Event').replace(/[^a-zA-Z0-9]/g, '_')}_Registrations_${new Date().toISOString().slice(0, 10)}.xlsx`
        : `Finxyora_Event_Registrations_${new Date().toISOString().slice(0, 10)}.xlsx`;

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    // =========================================================================
    // 2. STALL REGISTRATIONS REPORT (EXCEL .XLSX WITH TOTALS & IST DATES)
    // =========================================================================
    if (type === 'stalls') {
      const bookings: StallBookingRecord[] = await getAllStallBookings({ registrationType });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Finxyora 2K26 Festival Management';
      workbook.lastModifiedBy = session.username;
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Stall Registrations', {
        properties: { tabColor: { argb: 'FF10B981' } }
      });

      worksheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];

      // Define columns: College Name is intentionally EXCLUDED per requirements
      worksheet.columns = [
        { header: 'Registration ID', key: 'id', width: 18 },
        { header: 'Applicant Name', key: 'contact_name', width: 24 },
        { header: 'Applicant Type', key: 'applicant_type', width: 16 },
        { header: 'Contact Email', key: 'contact_email', width: 28 },
        { header: 'Contact Phone', key: 'contact_phone', width: 16 },
        { header: 'Stall Category', key: 'stall_category', width: 22 },
        { header: 'Booking Duration', key: 'duration', width: 16 },
        { header: 'Selected Day / Dates', key: 'selected_day', width: 26 },
        { header: 'Stall Entity / Brand', key: 'entity_name', width: 22 },
        { header: 'Products / Services', key: 'products_services', width: 32 },
        { header: 'Stalls Requested', key: 'stalls_requested', width: 16 },
        { header: 'Electricity Needed', key: 'has_electricity', width: 16 },
        { header: 'Amount Payable (₹)', key: 'total_amount', width: 18 },
        { header: 'Payment Status', key: 'payment_status', width: 16 },
        { header: 'Refund Status', key: 'refund_status', width: 18 },
        { header: 'Registration Status', key: 'status', width: 18 },
        { header: 'UTR / Transaction Ref', key: 'utr', width: 22 },
        { header: 'Registration Type', key: 'reg_type', width: 16 },
        { header: 'Created At', key: 'created_at', width: 36 }
      ];

      // Style Header Row
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
          bottom: { style: 'medium', color: { argb: 'FF10B981' } } // Emerald
        };
      });

      // Enable filters on header row
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columns.length }
      };

      const dataStartRow = 2;
      // Populate Rows
      bookings.forEach((b: StallBookingRecord) => {
        const cleanApplicantType = formatApplicantType(b.applicant_type, b.stall_category);
        const durationDays = b.duration_days || 1;
        const selectedDay = b.selected_day || (durationDays === 2 ? 'Both Days' : '1 Day');
        const dayDates = b.booking_dates ? `${selectedDay} (${b.booking_dates})` : selectedDay;

        const r = worksheet.addRow({
          id: b.id,
          contact_name: b.contact_name,
          applicant_type: cleanApplicantType,
          contact_email: b.contact_email,
          contact_phone: b.contact_phone,
          stall_category: b.stall_category || '—',
          duration: `${durationDays} Day${durationDays > 1 ? 's' : ''}`,
          selected_day: dayDates,
          entity_name: b.entity_name || '—',
          products_services: b.products_services || '—',
          stalls_requested: Number(b.stalls_requested || 1),
          has_electricity: b.has_electricity ? 'Yes' : 'No',
          total_amount: Number(b.total_amount || 0),
          payment_status: (b.payment_status || 'submitted').toUpperCase(),
          refund_status: (b.refund_status || 'NONE').toUpperCase(),
          status: (b.status || 'pending').toUpperCase(),
          utr: b.transaction_id || '—',
          reg_type: b.registration_type || 'REAL',
          created_at: formatCreatedAtIST(b.created_at)
        });

        r.getCell('total_amount').numFmt = '₹#,##0';
        r.getCell('stalls_requested').alignment = { horizontal: 'center' };
      });

      const dataEndRow = worksheet.rowCount;

      // Add bold TOTAL row to Stall Report
      if (dataEndRow >= dataStartRow) {
        const totalRow = worksheet.addRow({
          id: 'TOTAL',
          contact_name: `Total Bookings: ${bookings.length}`,
          applicant_type: '',
          contact_email: '',
          contact_phone: '',
          stall_category: '',
          duration: '',
          selected_day: '',
          entity_name: '',
          products_services: '',
          stalls_requested: { formula: `SUM(K${dataStartRow}:K${dataEndRow})` },
          has_electricity: '',
          total_amount: { formula: `SUM(M${dataStartRow}:M${dataEndRow})` },
          payment_status: '',
          refund_status: '',
          status: '',
          utr: '',
          reg_type: '',
          created_at: ''
        });

        totalRow.height = 24;
        totalRow.eachCell((cell) => {
          cell.font = { bold: true, size: 10, color: { argb: 'FF065F46' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD1FAE5' } // Soft Emerald Tint #D1FAE5
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF059669' } },
            bottom: { style: 'double', color: { argb: 'FF059669' } }
          };
        });
        totalRow.getCell('total_amount').numFmt = '₹#,##0';
      }

      // Adjust column widths
      worksheet.columns.forEach((col) => {
        let maxLen = col.header ? String(col.header).length : 12;
        col.eachCell?.({ includeEmpty: false }, (cell) => {
          const len = cell.value ? String(cell.value).length : 0;
          if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(Math.max(maxLen + 3, 14), 48);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `Finxyora_Stall_Registrations_${new Date().toISOString().slice(0, 10)}.xlsx`;

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
