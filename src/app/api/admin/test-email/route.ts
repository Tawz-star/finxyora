import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getEmailServiceStatus, sendEmailNotification, DESTINATION_EMAIL } from '@/lib/email';
import { logAuditEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const status = getEmailServiceStatus();
    return NextResponse.json({
      success: true,
      status
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to get email status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const testRecipient = body.recipient || DESTINATION_EMAIL;

    const testSubject = `[FINXYORA Diagnostic] Test Email Triggered by ${session.displayName} at ${new Date().toLocaleTimeString('en-IN')}`;
    const testText = `
FINXYORA EMAIL DIAGNOSTIC TEST
======================================================
Triggered by:     ${session.displayName} (${session.username})
Destination:      ${testRecipient}
Timestamp:        ${new Date().toISOString()}

If you are reading this email in your inbox, your outbound email
service is functioning 100% properly! Contact queries and registration
notifications will successfully arrive.
======================================================
`;

    const testHtml = `
      <div style="font-family: Arial, sans-serif; background: #0b132b; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 600px;">
        <h2 style="color: #38bdf8; margin-top: 0;">🎉 FINXYORA Outbound Email Verification</h2>
        <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; border: 1px solid #38bdf8;">
          <p><strong>Status:</strong> <span style="color: #4ade80; font-weight: bold;">Verified & Operational</span></p>
          <p><strong>Triggered By:</strong> ${session.displayName} (<code>${session.username}</code>)</p>
          <p><strong>Destination Inbox:</strong> <code>${testRecipient}</code></p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        </div>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 16px;">
          This confirms that contact enquiries and registration notifications from the Finxyora portal will arrive safely.
        </p>
      </div>
    `;

    const startTime = Date.now();
    const result = await sendEmailNotification(testSubject, testText, testHtml);
    const latency = Date.now() - startTime;

    await logAuditEvent(
      session.username,
      'TEST_EMAIL_DISPATCH',
      'EMAIL_SERVICE',
      testRecipient,
      `Success: ${result.success} | Provider: ${result.provider} | Latency: ${latency}ms | Error: ${result.error || 'None'}`
    );

    return NextResponse.json({
      success: result.success,
      configured: result.configured,
      provider: result.provider,
      messageId: result.messageId,
      error: result.error,
      latencyMs: latency,
      destinationEmail: testRecipient
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Test email failed' },
      { status: 500 }
    );
  }
}
