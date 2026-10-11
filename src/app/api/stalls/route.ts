import { NextResponse } from 'next/server';
import { getAllStallOptions, getSiteSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stalls = await getAllStallOptions();
    const settings = await getSiteSettings();
    const day1Date = settings.event_day1_date || 'November 12, 2026';
    const day2Date = settings.event_day2_date || 'November 13, 2026';
    const eventDates = settings.event_dates || `${day1Date} & ${day2Date}`;

    return NextResponse.json({
      success: true,
      stalls,
      day1Date,
      day2Date,
      eventDates,
      settings
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch stalls' },
      { status: 500 }
    );
  }
}
