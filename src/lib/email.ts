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

const DESTINATION_EMAIL = 'finxyora@gmail.com';

export async function sendEmailNotification(
  subject: string,
  textBody: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[EMAIL NOTIFICATION TO: ${DESTINATION_EMAIL}]`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`BODY:\n${textBody}`);

  // If SMTP environment variables are configured (e.g. on Vercel), attempt outbound SMTP or webhook
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (smtpUser && smtpPass) {
    try {
      // Lazy load nodemailer if available
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      await transporter.sendMail({
        from: `"FINXYORA Portal" <${smtpUser}>`,
        to: DESTINATION_EMAIL,
        subject,
        text: textBody,
        html: htmlBody
      });
      console.log('✅ Real email successfully dispatched to ' + DESTINATION_EMAIL);
      return { success: true };
    } catch (err: unknown) {
      console.warn('Outbound SMTP send attempted but encountered error:', err);
      // Return success true because the registration itself must succeed even if SMTP credentials are being configured
      return { success: true, error: err instanceof Error ? err.message : 'SMTP delivery skipped' };
    }
  }

  return { success: true };
}

export async function sendEventRegistrationEmail(data: EventEmailPayload) {
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
College / Inst:     ${data.collegeName}
Primary Contact:    ${data.leaderName} (${data.leaderPhone} / ${data.leaderEmail})
Total Participants: ${data.participantCount}

Participants List:
${participantsList}

Timestamp:          ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
===========================================
This notification is automatically sent to ${DESTINATION_EMAIL} for participant verification.
`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; background: #0b132b; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 600px;">
      <h2 style="color: #38bdf8; margin-top: 0;">FINXYORA 2026 — New Event Registration</h2>
      <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; border: 1px solid #38bdf8;">
        <p><strong>Event:</strong> <span style="color: #facc15;">${data.eventName}</span></p>
        <p><strong>Registration ID:</strong> <code>${data.registrationId}</code></p>
        <p><strong>Total Amount Paid:</strong> <span style="color: #4ade80; font-size: 18px; font-weight: bold;">₹${data.totalAmount.toFixed(2)}</span></p>
        <p><strong>UPI Reference (UTR):</strong> <code style="background: #1e293b; padding: 4px 8px; border-radius: 4px;">${data.utrNumber}</code></p>
        <p><strong>College:</strong> ${data.collegeName}</p>
        <p><strong>Primary Delegate:</strong> ${data.leaderName} &bull; ${data.leaderPhone} &bull; ${data.leaderEmail}</p>
        <p><strong>Participant Count:</strong> ${data.participantCount}</p>
      </div>
      <h3 style="color: #93c5fd; margin-top: 20px;">Registered Participants</h3>
      <ol style="color: #cbd5e1;">
        ${data.participants.map(p => `<li><strong>${p.fullName}</strong> — ${p.rollNumber} (${p.department}, ${p.yearOfStudy})</li>`).join('')}
      </ol>
      <hr style="border-color: #1e293b; margin: 20px 0;" />
      <p style="font-size: 11px; color: #94a3b8;">Sent automatically to ${DESTINATION_EMAIL} for verification and record management.</p>
    </div>
  `;

  return sendEmailNotification(subject, textBody, htmlBody);
}

export async function sendStallBookingEmail(data: StallEmailPayload) {
  const subject = `[FINXYORA Stall Booking] ${data.categoryName} - ₹${data.totalAmount} by ${data.contactName}`;

  const textBody = `
NEW FESTIVAL STALL BOOKING RECEIVED
===========================================
Stall Category:     ${data.categoryName}
Booking ID:         ${data.bookingId}
Total Amount Paid:  ₹${data.totalAmount.toFixed(2)}
Payment UTR / Ref:  ${data.utrNumber}
Registered Name:    ${data.contactName}
Entity / Brand:     ${data.entityName}
Contact Details:    ${data.contactPhone} / ${data.contactEmail}
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

  return sendEmailNotification(subject, textBody, htmlBody);
}

export async function sendQueryEmail(data: QueryEmailPayload) {
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
Received at ${DESTINATION_EMAIL}
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
      <p style="font-size: 11px; color: #94a3b8; margin-top: 20px;">Sent automatically to ${DESTINATION_EMAIL}. Reply directly to the sender.</p>
    </div>
  `;

  return sendEmailNotification(subject, textBody, htmlBody);
}
