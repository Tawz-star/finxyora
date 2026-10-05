import { NextResponse } from 'next/server';
import { getAllStallOptions } from '@/lib/db';

export async function GET() {
  try {
    const stalls = await getAllStallOptions();
    return NextResponse.json({ success: true, stalls });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch stalls' },
      { status: 500 }
    );
  }
}
