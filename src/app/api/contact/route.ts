import { NextRequest, NextResponse } from 'next/server';
import { sendQueryEmail, EmailSendResult } from '@/lib/email';
import { createEnquiry, logAuditEvent } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, subject, message } = await req.json();

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
    const cleanPhone = phone && typeof phone === 'string' && phone.trim().length > 0 ? phone.trim() : undefined;
    const cleanSubject = (subject && String(subject).trim()) || 'General Inquiry';
    const cleanMessage = message.trim();

    // Step 1: Log safe diagnostic info - Contact enquiry received
    console.log(`[CONTACT_API] Contact enquiry received from ${cleanName} <${cleanEmail}> (Phone: ${cleanPhone || 'N/A'}) - Subject: "${cleanSubject}"`);

    // Step 2: Call email service
    console.log(`[CONTACT_API] Email service called for enquiry from ${cleanEmail}`);
    let emailResult: EmailSendResult = { success: false, configured: false, error: 'Not attempted' };
    try {
      emailResult = await sendQueryEmail({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        subject: cleanSubject,
        message: cleanMessage
      });
    } catch (emailErr) {
      const errMsg = emailErr instanceof Error ? emailErr.message : 'Email dispatch exception';
      console.error(`[CONTACT_API] Email dispatch exception: ${errMsg}`);
      emailResult = {
        success: false,
        configured: false,
        error: errMsg
      };
    }

    // Step 3: Log safe diagnostic info - Email accepted or rejected
    if (emailResult.success) {
      console.log(`[CONTACT_API] Email accepted: ID=${emailResult.messageId || 'OK'} via ${emailResult.provider}`);
    } else {
      console.error(`[CONTACT_API] Email rejected: ${emailResult.error}`);
    }

    // Step 4: Persist enquiry to centralized SQL database (never lose the enquiry)
    const emailStatus: 'sent' | 'failed' = emailResult.success ? 'sent' : 'failed';
    const savedEnquiry = await createEnquiry({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      subject: cleanSubject,
      message: cleanMessage,
      email_status: emailStatus,
      email_dispatched: emailResult.success ? 1 : 0,
      email_error: emailResult.success ? undefined : (emailResult.error || 'Email dispatch failed')
    });

    console.log(`[CONTACT_API] Database record created: ID=${savedEnquiry.id}, email_status=${emailStatus}`);

    await logAuditEvent(
      cleanEmail,
      'CONTACT_QUERY_SUBMITTED',
      'ENQUIRY',
      savedEnquiry.id,
      `Subject: ${cleanSubject} | Phone: ${cleanPhone || 'N/A'} | Email Dispatched: ${emailResult.success} | Status: ${emailStatus}`
    );

    // Step 5: Accurate HTTP responses per Requirement 4
    if (!emailResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "We couldn't send your enquiry right now. Please try again.",
          enquiryId: savedEnquiry.id,
          emailStatus: 'failed',
          diagnostic: emailResult.error
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your enquiry has been submitted successfully.",
      enquiryId: savedEnquiry.id,
      emailStatus: 'sent'
    });
  } catch (err: unknown) {
    console.error('[CONTACT_API] Unhandled contact enquiry error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to process enquiry' },
      { status: 500 }
    );
  }
}
