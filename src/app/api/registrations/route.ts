import { NextRequest, NextResponse } from 'next/server';
import { createEventRegistration, getEventRegistration } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventId,
      collegeName,
      collegeLocation,
      teamName,
      leaderName,
      leaderEmail,
      leaderPhone,
      participants
    } = body;

    // Strict validation
    if (!eventId || !collegeName || !collegeLocation || !leaderName || !leaderEmail || !leaderPhone) {
      return NextResponse.json(
        { success: false, error: 'Missing required team or institution fields.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one participant must be provided.' },
        { status: 400 }
      );
    }

    // Validate each participant's individual fields
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.fullName || !p.rollNumber || !p.department || !p.yearOfStudy || !p.section) {
        return NextResponse.json(
          { success: false, error: `Incomplete details for Participant #${i + 1}. All fields are required.` },
          { status: 400 }
        );
      }
    }

    // Email and phone basic sanity check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(leaderEmail)) {
      return NextResponse.json({ success: false, error: 'Invalid leader email address.' }, { status: 400 });
    }

    if (leaderPhone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ success: false, error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    const result = createEventRegistration({
      eventId,
      collegeName,
      collegeLocation,
      teamName,
      leaderName,
      leaderEmail,
      leaderPhone,
      participants
    });

    return NextResponse.json({
      success: true,
      registrationId: result.registrationId,
      totalFee: result.totalFee
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Registration failed' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Registration ID required' }, { status: 400 });
    }

    const reg = getEventRegistration(id);
    if (!reg) {
      return NextResponse.json({ success: false, error: 'Registration not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, registration: reg });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to retrieve registration' },
      { status: 500 }
    );
  }
}
