// Email notification service for FINXYORA

export interface EventEmailPayload {
  eventName: string;
  registrationId: string;
  totalAmount: number;
  utrNumber: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  collegeName: string;
  participantCount: number;
  participants: Array<{
    fullName: string;
    rollNumber: string;
    department: string;
    yearOfStudy: string;
    section: string;
  }>;
}

export interface StallEmailPayload {
  categoryName: string;
  bookingId: string;
  totalAmount: number;
  utrNumber: string;
  entityName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  stallsRequested: number;
  productsServices: string;
}

export interface QueryEmailPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface EmailSendResult {
  success: boolean;
  configured: boolean;
  provider?: 'resend' | 'smtp' | 'none';
  messageId?: string;
  error?: string;
}

export const DESTINATION_EMAIL = 'finxyora@gmail.com';

export function getEmailServiceStatus(): {
  configured: boolean;
  provider: 'Resend API' | 'Gmail SMTP' | 'None';
  destinationEmail: string;
  senderAddress: string;
} {
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const hasSmtp = Boolean(smtpUser && smtpPass);

  let provider: 'Resend API' | 'Gmail SMTP' | 'None' = 'None';
  let senderAddress = 'Not configured';

  if (hasResend) {
    provider = 'Resend API';
    senderAddress = process.env.RESEND_FROM || 'Finxyora Portal <onboarding@resend.dev>';
  } else if (hasSmtp) {
    provider = 'Gmail SMTP';
    senderAddress = smtpUser || 'finxyora@gmail.com';
  }

  return {
    configured: hasResend || hasSmtp,
    provider,
    destinationEmail: DESTINATION_EMAIL,
    senderAddress
  };
}

export async function sendEmailNotification(
  subject: string,
  textBody: string,
  htmlBody: string,
  options?: { replyTo?: string }
): Promise<EmailSendResult> {
  console.log(`[EMAIL DISPATCH] Destination: ${DESTINATION_EMAIL} | Subject: "${subject}"`);

  // =========================================================================
  // PROVIDER 1: RESEND HTTPS REST API (Port 443 — Immune to SMTP blocks)
  // =========================================================================
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromAddress = process.env.RESEND_FROM || 'Finxyora Portal <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [DESTINATION_EMAIL],
          reply_to: options?.replyTo || undefined,
          subject,
          text: textBody,
          html: htmlBody
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Resend HTTP error ${res.status}`);
      }

      console.log('✅ Real email dispatched via Resend API. ID:', data.id);
      return {
        success: true,
        configured: true,
        provider: 'resend',
        messageId: data.id
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown Resend error';
      console.error('❌ Resend API dispatch failed:', errMsg);
      // Fall through to SMTP if configured
    }
  }

  // =========================================================================
  // PROVIDER 2: GMAIL / NODEMAILER SMTP (Port 465 SSL or Port 587)
  // =========================================================================
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (smtpUser && smtpPass) {
    try {
      const nodemailer = await import('nodemailer');
      const host = process.env.SMTP_HOST || 'smtp.gmail.com';
      const port = Number(process.env.SMTP_PORT) || 465;
      const isSecure = port === 465;

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: isSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        // Serverless optimizations
        pool: false,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
          rejectUnauthorized: false
        }
      });

      const info = await transporter.sendMail({
        from: `"FINXYORA Portal" <${smtpUser}>`,
        to: DESTINATION_EMAIL,
        replyTo: options?.replyTo || undefined,
        subject,
        text: textBody,
        html: htmlBody
      });

      console.log('✅ Real email dispatched via Gmail SMTP. MessageId:', info.messageId);
      return {
        success: true,
        configured: true,
        provider: 'smtp',
        messageId: info.messageId
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown SMTP error';
      console.error('❌ Outbound SMTP send failed:', errMsg);
      return {
        success: false,
        configured: true,
        provider: 'smtp',
        error: errMsg
      };
    }
  }

  // =========================================================================
  // NO CREDENTIALS CONFIGURED
  // =========================================================================
  const warningMsg = 'No outbound email credentials configured on server (RESEND_API_KEY or GMAIL_APP_PASSWORD missing). Email was not sent.';
  console.warn(`⚠️ [EMAIL SKIPPED] ${warningMsg}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`BODY:\n${textBody}`);

  return {
    success: false,
    configured: false,
    provider: 'none',
    error: warningMsg
  };
}

export async function sendEventRegistrationEmail(data: EventEmailPayload): Promise<EmailSendResult> {
  const subject = `[FINXYORA Event Registration] ${data.eventName} - ₹${data.totalAmount} by ${data.leaderName}`;

  const participantsList = data.participants
    .map((p, idx) => `  ${idx + 1}. ${p.fullName} (Roll: ${p.rollNumber}, Dept: ${p.department}, Year: ${p.yearOfStudy})`)
    .join('\n');

  const textBody = `
NEW EVENT REGISTRATION RECEIVED
===========================================
Event:              ${data.eventName}
Registration ID:    ${data.registrationId}
Total Amount Paid:  ₹${data.totalAmount.toFixed(2)}
Payment UTR / Ref:  ${data.utrNumber}
Team Leader:        ${data.leaderName}
Email:              ${data.leaderEmail}
Phone:              ${data.leaderPhone}
College:            ${data.collegeName}
Total Participants: ${data.participantCount}

Participant List:
${participantsList}

Timestamp:          ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
===========================================
This notification is automatically sent to ${DESTINATION_EMAIL}.
`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; background: #0b132b; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 600px;">
      <h2 style="color: #38bdf8; margin-top: 0;">FINXYORA 2026 — New Event Registration</h2>
      <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; border: 1px solid #38bdf8;">
        <p><strong>Event:</strong> <span style="color: #facc15;">${data.eventName}</span></p>
        <p><strong>Registration ID:</strong> <code>${data.registrationId}</code></p>
        <p><strong>Total Amount Paid:</strong> <span style="color: #4ade80; font-size: 18px; font-weight: bold;">₹${data.totalAmount.toFixed(2)}</span></p>
        <p><strong>UPI Reference (UTR):</strong> <code style="background: #1e293b; padding: 4px 8px; border-radius: 4px;">${data.utrNumber}</code></p>
        <p><strong>Leader:</strong> ${data.leaderName} &bull; ${data.collegeName}</p>
        <p><strong>Phone / Email:</strong> ${data.leaderPhone} &bull; ${data.leaderEmail}</p>
        <p><strong>Total Members:</strong> ${data.participantCount}</p>
      </div>
      <h3 style="color: #38bdf8; margin-top: 20px;">Participants:</h3>
      <ol style="background: rgba(255,255,255,0.02); padding: 16px 30px; border-radius: 8px;">
        ${data.participants
          .map(
            (p) =>
              `<li style="margin-bottom: 6px;"><strong>${p.fullName}</strong> — Roll: <code>${p.rollNumber}</code>, Dept: ${p.department}, Year: ${p.yearOfStudy}</li>`
          )
          .join('')}
      </ol>
      <hr style="border-color: #1e293b; margin: 20px 0;" />
      <p style="font-size: 11px; color: #94a3b8;">Sent automatically to ${DESTINATION_EMAIL}.</p>
    </div>
  `;

  return sendEmailNotification(subject, textBody, htmlBody, { replyTo: data.leaderEmail });
}

export async function sendStallBookingEmail(data: StallEmailPayload): Promise<EmailSendResult> {
  const subject = `[FINXYORA Stall Booking] ${data.categoryName} - ₹${data.totalAmount} by ${data.entityName}`;

  const textBody = `
NEW STALL BOOKING RECEIVED
===========================================
Category:           ${data.categoryName}
Booking ID:         ${data.bookingId}
Total Amount Paid:  ₹${data.totalAmount.toFixed(2)}
Payment UTR / Ref:  ${data.utrNumber}
Brand / Exhibitor:  ${data.entityName}
Contact Person:     ${data.contactName}
Email:              ${data.contactEmail}
Phone:              ${data.contactPhone}
Stalls Requested:   ${data.stallsRequested}
Products / Services:${data.productsServices}

Timestamp:          ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
===========================================
This notification is automatically sent to ${DESTINATION_EMAIL} for stall allocation.
`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; background: #0b132b; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 600px;">
      <h2 style="color: #38bdf8; margin-top: 0;">FINXYORA 2026 — New Stall Booking</h2>
      <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; border: 1px solid #38bdf8;">
        <p><strong>Category:</strong> <span style="color: #facc15;">${data.categoryName}</span></p>
        <p><strong>Booking ID:</strong> <code>${data.bookingId}</code></p>
        <p><strong>Total Amount Paid:</strong> <span style="color: #4ade80; font-size: 18px; font-weight: bold;">₹${data.totalAmount.toFixed(2)}</span></p>
        <p><strong>UPI Reference (UTR):</strong> <code style="background: #1e293b; padding: 4px 8px; border-radius: 4px;">${data.utrNumber}</code></p>
        <p><strong>Exhibitor / Brand:</strong> ${data.entityName}</p>
        <p><strong>Registered Member:</strong> ${data.contactName}</p>
        <p><strong>Phone / Email:</strong> ${data.contactPhone} &bull; ${data.contactEmail}</p>
        <p><strong>Stalls Booked:</strong> ${data.stallsRequested}</p>
        <p><strong>Products / Description:</strong> ${data.productsServices}</p>
      </div>
      <hr style="border-color: #1e293b; margin: 20px 0;" />
      <p style="font-size: 11px; color: #94a3b8;">Sent automatically to ${DESTINATION_EMAIL} for stall coordination.</p>
    </div>
  `;

  return sendEmailNotification(subject, textBody, htmlBody, { replyTo: data.contactEmail });
}

export async function sendQueryEmail(data: QueryEmailPayload): Promise<EmailSendResult> {
  const subject = `[FINXYORA Help Query] ${data.subject} from ${data.name}`;

  const textBody = `
NEW INQUIRY FROM FINXYORA CONTACT PORTAL
===========================================
From:       ${data.name} (${data.email})
Subject:    ${data.subject}
Message:
${data.message}

Timestamp:  ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
===========================================
Received at ${DESTINATION_EMAIL}. Reply directly to this email to respond to ${data.name}.
`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; background: #0b132b; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 600px;">
      <h2 style="color: #38bdf8; margin-top: 0;">FINXYORA 2026 — New Contact Query</h2>
      <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; border: 1px solid #38bdf8;">
        <p><strong>Sender Name:</strong> ${data.name}</p>
        <p><strong>Sender Email:</strong> <a href="mailto:${data.email}" style="color: #38bdf8;">${data.email}</a></p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <p><strong>Message:</strong></p>
        <blockquote style="background: #1e293b; padding: 12px; border-left: 4px solid #38bdf8; color: #e2e8f0; margin: 8px 0;">
          ${data.message.replace(/\n/g, '<br/>')}
        </blockquote>
      </div>
      <p style="font-size: 11px; color: #94a3b8; margin-top: 20px;">Sent automatically to ${DESTINATION_EMAIL}. Click Reply to message the student directly.</p>
    </div>
  `;

  return sendEmailNotification(subject, textBody, htmlBody, { replyTo: data.email });
}
