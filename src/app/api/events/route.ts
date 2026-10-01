import { NextResponse } from 'next/server';
import { getAllEvents } from '@/lib/db';

export async function GET() {
  try {
    const events = getAllEvents();
    return NextResponse.json({ success: true, events });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
