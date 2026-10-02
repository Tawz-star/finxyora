import { NextRequest, NextResponse } from 'next/server';
import { sendQueryEmail } from '@/lib/email';
import { logAuditEvent } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: 'Please provide name, email, and message.' },
        { status: 400 }
      );
    }

    await sendQueryEmail({
      name: String(name).trim(),
      email: String(email).trim(),
      subject: String(subject || 'General Query').trim(),
      message: String(message).trim()
    });

    logAuditEvent(email, 'CONTACT_QUERY_SUBMITTED', 'CONTACT', 'finxyora@gmail.com', `Subject: ${subject}`);

    return NextResponse.json({
      success: true,
      message: 'Your query has been dispatched to finxyora@gmail.com. We will respond promptly!'
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to send query' },
      { status: 500 }
    );
  }
}
