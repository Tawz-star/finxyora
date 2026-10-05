import { NextRequest, NextResponse } from 'next/server';
import { sendQueryEmail } from '@/lib/email';
import { createEnquiry, logAuditEvent } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please provide your full legal name.' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Please enter a message of at least 5 characters.' },
        { status: 400 }
      );
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanSubject = (subject && String(subject).trim()) || 'General Inquiry';
    const cleanMessage = message.trim();

    // 1. Atomically save enquiry into centralized SQL database
    const savedEnquiry = await createEnquiry({
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage
    });

    // 2. Dispatch email to finxyora@gmail.com
    try {
      await sendQueryEmail({
        name: cleanName,
        email: cleanEmail,
        subject: cleanSubject,
        message: cleanMessage
      });
    } catch (emailErr) {
      console.warn('Query email dispatch notification failed (non-fatal):', emailErr);
    }

    await logAuditEvent(
      cleanEmail,
      'CONTACT_QUERY_SUBMITTED',
      'ENQUIRY',
      savedEnquiry.id,
      `Subject: ${cleanSubject}`
    );

    return NextResponse.json({
      success: true,
      enquiryId: savedEnquiry.id,
      message: 'Your query has been dispatched directly to finxyora@gmail.com. We will respond promptly!'
    });
  } catch (err: unknown) {
    console.error('Contact query error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to send query' },
      { status: 500 }
    );
  }
}
