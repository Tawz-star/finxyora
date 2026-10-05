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
  phone?: string;
  subject: string;
  message: string;
}

export interface EmailSendResult {
  success: boolean;
  configured: boolean;
  provider?: 'resend' | 'smtp' | 'none';
  messageId?: string;
  error?: string;
  accepted?: string[];
}

export const DESTINATION_EMAIL = 'finxyora@gmail.com';

export function getEmailServiceStatus(): {
  configured: boolean;
  provider: 'Resend API' | 'Gmail SMTP' | 'None';
  destinationEmail: string;
  senderAddress: string;
} {
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
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
  options?: {
    to?: string | string[];
    cc?: string | string[];
    replyTo?: string;
  }
): Promise<EmailSendResult> {
  const recipientTo = options?.to || DESTINATION_EMAIL;
  const recipientCc = options?.cc;

  console.log(`[EMAIL DISPATCH] To: ${JSON.stringify(recipientTo)} | CC: ${JSON.stringify(recipientCc || '')} | Subject: "${subject}"`);

  // =========================================================================
  // PROVIDER 1: RESEND HTTPS REST API (Port 443 — Immune to SMTP blocks)
  // =========================================================================
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromAddress = process.env.RESEND_FROM || 'Finxyora Portal <onboarding@resend.dev>';
      const toList = Array.isArray(recipientTo) ? recipientTo : [recipientTo];
      const ccList = recipientCc ? (Array.isArray(recipientCc) ? recipientCc : [recipientCc]) : undefined;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress,
          to: toList,
          cc: ccList,
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
        messageId: data.id,
        accepted: toList
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
  const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
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
        from: `"FINXYORA 2026" <${smtpUser}>`,
        to: recipientTo,
        cc: recipientCc,
        replyTo: options?.replyTo || undefined,
        subject,
        text: textBody,
        html: htmlBody
      });

      console.log('✅ Real email dispatched via Gmail SMTP. MessageId:', info.messageId, 'Accepted:', info.accepted);
      return {
        success: true,
        configured: true,
        provider: 'smtp',
        messageId: info.messageId,
        accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : []
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

  return {
    success: false,
    configured: false,
    provider: 'none',
    error: warningMsg
  };
}

export async function sendEventRegistrationEmail(data: EventEmailPayload): Promise<EmailSendResult> {
  const subject = `[FINXYORA 2026] Event Registration Confirmed — ${data.eventName} (ID: ${data.registrationId})`;

  const participantsList = data.participants
    .map((p, idx) => `  ${idx + 1}. ${p.fullName} (Roll: ${p.rollNumber}, Dept: ${p.department}, Year: ${p.yearOfStudy})`)
    .join('\n');

  const textBody = `
FINXYORA 2026 — REGISTRATION CONFIRMATION
===========================================
Dear ${data.leaderName},

Your team's registration for "${data.eventName}" has been successfully logged!

REGISTRATION SUMMARY:
-------------------------------------------
Registration ID:    ${data.registrationId}
Event Name:         ${data.eventName}
College Name:       ${data.collegeName}
Total Fee:          ₹${data.totalAmount.toFixed(2)}
UPI Transaction ID: ${data.utrNumber}
Total Participants: ${data.participantCount}

PARTICIPANT LIST:
${participantsList}

To download your digital entry pass with verification QR code, visit:
https://finxyora.vercel.app/confirmation/${data.registrationId}

For urgent queries, contact our student leadership:
• Tawfeeq Ahmed (Vice President): +91 91599 11721
• Sriram (President): +91 86828 79906

Timestamp: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
===========================================
FINXYORA 2026 • Bishop Heber College, Tiruchirappalli
`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; background: #0b132b; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 600px;">
      <h2 style="color: #38bdf8; margin-top: 0;">FINXYORA 2026 — Registration Confirmed</h2>
      <p>Dear <strong>${data.leaderName}</strong>,</p>
      <p>Your team's registration for <strong style="color: #facc15;">${data.eventName}</strong> has been logged in the festival database.</p>
      <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; border: 1px solid #38bdf8; margin: 16px 0;">
        <p><strong>Registration ID:</strong> <code>${data.registrationId}</code></p>
        <p><strong>Total Amount:</strong> <span style="color: #4ade80; font-size: 16px; font-weight: bold;">₹${data.totalAmount.toFixed(2)}</span></p>
        <p><strong>UPI Reference (UTR):</strong> <code style="background: #1e293b; padding: 3px 6px; border-radius: 4px;">${data.utrNumber}</code></p>
        <p><strong>College:</strong> ${data.collegeName}</p>
        <p><strong>Total Members:</strong> ${data.participantCount}</p>
      </div>
      <p style="margin: 16px 0;">
        <a href="https://finxyora.vercel.app/confirmation/${data.registrationId}" style="background: #0284c7; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          View &amp; Print Digital Pass &rarr;
        </a>
      </p>
      <hr style="border-color: #1e293b; margin: 20px 0;" />
      <p style="font-size: 11px; color: #94a3b8;">Sent automatically by FINXYORA 2026. A copy is archived at ${DESTINATION_EMAIL}.</p>
    </div>
  `;

  // Dispatches to the team leader, with a copy to festival committee
  return sendEmailNotification(subject, textBody, htmlBody, {
    to: data.leaderEmail,
    cc: DESTINATION_EMAIL,
    replyTo: DESTINATION_EMAIL
  });
}

export async function sendStallBookingEmail(data: StallEmailPayload): Promise<EmailSendResult> {
  const subject = `[FINXYORA 2026] Stall Booking Confirmed — ${data.categoryName} (ID: ${data.bookingId})`;

  const textBody = `
FINXYORA 2026 — STALL BOOKING CONFIRMATION
===========================================
Dear ${data.contactName},

Your stall booking for "${data.categoryName}" at FINXYORA 2026 has been received!

BOOKING SUMMARY:
-------------------------------------------
Booking ID:         ${data.bookingId}
Category:           ${data.categoryName}
Brand / Exhibitor:  ${data.entityName}
Total Fee:          ₹${data.totalAmount.toFixed(2)}
UPI Transaction ID: ${data.utrNumber}
Stalls Requested:   ${data.stallsRequested}
Products / Services:${data.productsServices}

Timestamp: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
===========================================
FINXYORA 2026 • Bishop Heber College, Tiruchirappalli
`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; background: #0b132b; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 600px;">
      <h2 style="color: #38bdf8; margin-top: 0;">FINXYORA 2026 — Stall Booking Confirmed</h2>
      <p>Dear <strong>${data.contactName}</strong>,</p>
      <p>Your stall booking for <strong style="color: #facc15;">${data.categoryName}</strong> has been logged in our central festival database.</p>
      <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; border: 1px solid #38bdf8; margin: 16px 0;">
        <p><strong>Booking ID:</strong> <code>${data.bookingId}</code></p>
        <p><strong>Exhibitor / Brand:</strong> ${data.entityName}</p>
        <p><strong>Total Amount:</strong> <span style="color: #4ade80; font-size: 16px; font-weight: bold;">₹${data.totalAmount.toFixed(2)}</span></p>
        <p><strong>UPI Reference (UTR):</strong> <code style="background: #1e293b; padding: 3px 6px; border-radius: 4px;">${data.utrNumber}</code></p>
        <p><strong>Stalls Booked:</strong> ${data.stallsRequested}</p>
      </div>
      <hr style="border-color: #1e293b; margin: 20px 0;" />
      <p style="font-size: 11px; color: #94a3b8;">Sent automatically by FINXYORA 2026. A copy is archived at ${DESTINATION_EMAIL}.</p>
    </div>
  `;

  // Dispatches to exhibitor contact, with a copy to festival committee
  return sendEmailNotification(subject, textBody, htmlBody, {
    to: data.contactEmail,
    cc: DESTINATION_EMAIL,
    replyTo: DESTINATION_EMAIL
  });
}

export async function sendQueryEmail(data: QueryEmailPayload): Promise<EmailSendResult> {
  const status = getEmailServiceStatus();
  console.log(`[CONTACT] Contact enquiry received from ${data.name} <${data.email}> (Phone: ${data.phone || 'N/A'}) - Subject: "${data.subject}"`);
  console.log(`[CONTACT] Email service called: Provider=${status.provider}, Recipient=${DESTINATION_EMAIL}`);

  const subject = `[FINXYORA Enquiry] ${data.subject} — from ${data.name}`;

  const textBody = `
FINXYORA 2026 — NEW CONTACT ENQUIRY
===========================================
You have received a new contact inquiry via the Finxyora website form.

SENDER DETAILS:
-------------------------------------------
Name:       ${data.name}
Email:      ${data.email}
Phone:      ${data.phone || 'Not provided'}
Subject:    ${data.subject}

MESSAGE:
-------------------------------------------
${data.message}
-------------------------------------------

Timestamp:  ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
Recipient:  ${DESTINATION_EMAIL}
Reply-To:   ${data.email}
===========================================
FINXYORA 2026 • Bishop Heber College, Tiruchirappalli
`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; background: #0b132b; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 600px;">
      <h2 style="color: #38bdf8; margin-top: 0;">FINXYORA 2026 — New Contact Enquiry</h2>
      <p style="color: #94a3b8; font-size: 13px;">A new enquiry was submitted through the official website contact form.</p>
      
      <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; border: 1px solid #38bdf8; margin: 16px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #f1f5f9;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; width: 100px;"><strong>Name:</strong></td>
            <td style="padding: 6px 0; font-weight: bold; color: #ffffff;">${data.name}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Email:</strong></td>
            <td style="padding: 6px 0;"><a href="mailto:${data.email}" style="color: #38bdf8; text-decoration: none;">${data.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Phone:</strong></td>
            <td style="padding: 6px 0; color: #4ade80; font-family: monospace; font-size: 14px;">${data.phone || 'Not provided'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Subject:</strong></td>
            <td style="padding: 6px 0; color: #facc15; font-weight: bold;">${data.subject}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Submitted:</strong></td>
            <td style="padding: 6px 0; color: #cbd5e1;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
          </tr>
        </table>
      </div>

      <div style="background: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #38bdf8; margin: 16px 0;">
        <p style="margin-top: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;"><strong>ENQUIRY MESSAGE:</strong></p>
        <div style="color: #f8fafc; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
          ${data.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>
      </div>

      <p style="margin: 20px 0 10px 0;">
        <a href="mailto:${data.email}?subject=${encodeURIComponent(`Re: [FINXYORA 2026] ${data.subject}`)}" style="background: #0284c7; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Reply to ${data.name} &rarr;
        </a>
      </p>

      <hr style="border-color: #1e293b; margin: 20px 0 12px 0;" />
      <p style="font-size: 11px; color: #64748b; margin: 0;">
        FINXYORA 2026 &bull; Dept. of Commerce &bull; Bishop Heber College, Tiruchirappalli<br/>
        Delivered to <code>${DESTINATION_EMAIL}</code>. Reply-To configured as <code>${data.email}</code>.
      </p>
    </div>
  `;

  // Dispatches directly TO finxyora@gmail.com, with replyTo set to inquirer
  const result = await sendEmailNotification(subject, textBody, htmlBody, {
    to: DESTINATION_EMAIL,
    replyTo: `"${data.name}" <${data.email}>`
  });

  if (result.success) {
    console.log(`[CONTACT] Email accepted: ID=${result.messageId || 'OK'} via ${result.provider}`);
  } else {
    console.error(`[CONTACT] Email rejected: ${result.error || 'Unknown error'}`);
  }

  return result;
}
