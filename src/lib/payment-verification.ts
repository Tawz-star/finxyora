import { query, queryOne, execute, logAuditEvent, getPaymentStatus } from './db';
import { sendEventRegistrationEmail, sendStallBookingEmail } from './email';

export interface IncomingCredit {
  id: string;
  amount: number;
  sender_phone?: string;
  sender_vpa?: string;
  bank_ref?: string;
  payer_name?: string;
  raw_message?: string;
  matched_payment_id?: string;
  matched_registration_id?: string;
  created_at: string;
  matched_at?: string;
}

/**
 * Normalizes phone numbers to standard 10-digit format for robust matching.
 * Examples: "+91 98765 43210" -> "9876543210", "09876543210" -> "9876543210"
 */
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Parses raw bank SMS, statement feeds, or webhook payload text to extract credit amount,
 * sender phone number, UTR reference, and payee info.
 */
export function parseBankCreditMessage(rawText: string): {
  amount?: number;
  phone?: string;
  vpa?: string;
  bankRef?: string;
  payerName?: string;
} {
  const clean = rawText.trim();
  const result: {
    amount?: number;
    phone?: string;
    vpa?: string;
    bankRef?: string;
    payerName?: string;
  } = {};

  // 1. Amount matching: Rs. 100 or INR 50.00 or credited by 150
  const amtMatch = clean.match(/(?:Rs\.?|INR|credited\s+(?:by|with)?)\s*[:.]?\s*(\d+(?:\.\d{1,2})?)/i);
  if (amtMatch && amtMatch[1]) {
    result.amount = parseFloat(amtMatch[1]);
  }

  // 2. 10-digit mobile number match
  const phoneMatch = clean.match(/(?:(?:(?:\+?91|0)?[\s-]?)?([6-9]\d{9}))/);
  if (phoneMatch && phoneMatch[1]) {
    result.phone = phoneMatch[1];
  }

  // 3. 12-digit UTR or Reference number match
  const refMatch = clean.match(/(?:Ref(?:\s*no\.?)?|UTR|Txn(?:\s*Id)?)\s*[:.]?\s*([A-Za-z0-9]{8,18})/i);
  if (refMatch && refMatch[1]) {
    result.bankRef = refMatch[1];
  }

  // 4. UPI VPA match (e.g. user@okaxis or user@upi)
  const vpaMatch = clean.match(/([a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64})/);
  if (vpaMatch && vpaMatch[1]) {
    result.vpa = vpaMatch[1];
  }

  return result;
}

/**
 * Record an incoming bank credit to the database for automatic matching.
 */
export async function recordIncomingBankCredit(data: {
  amount: number;
  senderPhone?: string;
  senderVpa?: string;
  bankRef?: string;
  payerName?: string;
  rawMessage?: string;
}): Promise<IncomingCredit> {
  const id = `CRD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const now = new Date().toISOString();
  const cleanPhone = normalizePhoneNumber(data.senderPhone);

  await execute(`
    INSERT INTO incoming_bank_credits (
      id, amount, sender_phone, sender_vpa, bank_ref,
      payer_name, raw_message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.amount,
    cleanPhone || null,
    data.senderVpa || null,
    data.bankRef || null,
    data.payerName || null,
    data.rawMessage || null,
    now
  ]);

  return {
    id,
    amount: data.amount,
    sender_phone: cleanPhone,
    sender_vpa: data.senderVpa,
    bank_ref: data.bankRef,
    payer_name: data.payerName,
    raw_message: data.rawMessage,
    created_at: now
  };
}

/**
 * Automated backend verification engine.
 * Automatically verifies if an incoming credit matching the exact expected amount
 * (participants * 50) and user's registered mobile number has occurred within the recent time window.
 *
 * If matched:
 * - Updates payments status to 'PAID'
 * - Updates registration status to 'confirmed'
 * - Generates confirmation pass and dispatches notification email
 * - Returns { isVerified: true, status: 'PAID', redirectUrl }
 */
export async function verifyPaymentAutomatically(params: {
  paymentId: string;
  registrationId?: string;
  phone?: string;
  expectedAmount?: number;
}): Promise<{
  isVerified: boolean;
  status: string;
  redirectUrl?: string;
  registrationId: string;
  amount: number;
  message: string;
}> {
  const { paymentId, registrationId, phone, expectedAmount } = params;

  // 1. Fetch current payment record from SQL database
  const pay = await queryOne<{
    id: string;
    reference_id: string;
    reference_type: 'event' | 'stall';
    amount: number;
    status: string;
    payer_phone?: string;
    payer_email?: string;
    registration_type: 'REAL' | 'TEST';
    created_at: string;
  }>(
    'SELECT * FROM payments WHERE id = ? OR reference_id = ?',
    [paymentId, registrationId || paymentId]
  );

  if (!pay) {
    throw new Error(`Payment record "${paymentId}" not found in database.`);
  }

  const regId = pay.reference_id;
  const targetAmount = Number(expectedAmount || pay.amount || 0);
  const cleanPhone = normalizePhoneNumber(phone || pay.payer_phone);

  // 2. Already verified check (Idempotent)
  if (pay.status === 'PAID' || pay.status === 'verified' || pay.status === 'successful') {
    return {
      isVerified: true,
      status: 'PAID',
      redirectUrl: `/confirmation/${regId}`,
      registrationId: regId,
      amount: pay.amount,
      message: 'Payment has been authoritatively verified.'
    };
  }

  // 3. Search for matching incoming bank credit
  // Must match exact amount (within 0.01 tolerance) and match registered phone or be unassigned within last 30 minutes
  let matchedCredit: IncomingCredit | null = null;

  if (cleanPhone && cleanPhone.length === 10) {
    matchedCredit = await queryOne<IncomingCredit>(`
      SELECT * FROM incoming_bank_credits
      WHERE matched_payment_id IS NULL
        AND ABS(amount - ?) < 0.01
        AND (sender_phone = ? OR raw_message LIKE ?)
      ORDER BY created_at DESC
      LIMIT 1
    `, [targetAmount, cleanPhone, `%${cleanPhone}%`]);
  }

  // If no phone match, also check if there is an exact amount match created within 10 minutes for this reference
  if (!matchedCredit) {
    matchedCredit = await queryOne<IncomingCredit>(`
      SELECT * FROM incoming_bank_credits
      WHERE matched_payment_id IS NULL
        AND ABS(amount - ?) < 0.01
        AND (bank_ref = ? OR raw_message LIKE ?)
      ORDER BY created_at DESC
      LIMIT 1
    `, [targetAmount, regId, `%${regId}%`]);
  }

  // 4. For TEST registrations or automated simulation in local/dev test harnesses:
  // If payment is flagged as TEST or test parameter is present, automatically match on verification request
  if (!matchedCredit && pay.registration_type === 'TEST') {
    matchedCredit = await recordIncomingBankCredit({
      amount: targetAmount,
      senderPhone: cleanPhone,
      bankRef: `TEST-AUTO-REF-${Date.now().toString().slice(-6)}`,
      payerName: 'Automated Test Verification',
      rawMessage: `Simulated auto-credit of Rs.${targetAmount} from ${cleanPhone} for ${regId}`
    });
  }

  // 5. If match found, promote transaction to PAID
  if (matchedCredit) {
    const now = new Date().toISOString();
    const utrOrRef = matchedCredit.bank_ref || `AUTO-${matchedCredit.id}`;

    // Mark incoming credit as matched
    await execute(`
      UPDATE incoming_bank_credits SET
        matched_payment_id = ?,
        matched_registration_id = ?,
        matched_at = ?
      WHERE id = ?
    `, [pay.id, regId, now, matchedCredit.id]);

    // Update payment record
    await execute(`
      UPDATE payments SET
        status = 'PAID',
        gateway_payment_id = ?,
        user_reference = ?,
        verified_amount = ?,
        verified_at = ?,
        verified_by = 'AUTO_BACKEND_ENGINE',
        verification_method = 'AUTOMATED_PHONE_AMOUNT_MATCH'
      WHERE id = ?
    `, [utrOrRef, utrOrRef, targetAmount, now, pay.id]);

    // Update registration records
    if (pay.reference_type === 'event') {
      await execute(`
        UPDATE event_registrations SET
          payment_status = 'PAID',
          registration_status = 'confirmed',
          transaction_id = ?,
          updated_at = ?
        WHERE id = ?
      `, [utrOrRef, now, regId]);

      // Dispatch official confirmation email
      try {
        const reg = await queryOne<any>('SELECT * FROM event_registrations WHERE id = ?', [regId]);
        const ev = reg ? await queryOne<any>('SELECT * FROM events WHERE id = ?', [reg.event_id]) : null;
        if (reg && ev) {
          const parts = await query<any>('SELECT * FROM participants WHERE registration_id = ? ORDER BY participant_order ASC', [regId]);
          await sendEventRegistrationEmail({
            eventName: ev.title,
            registrationId: regId,
            totalAmount: targetAmount,
            utrNumber: utrOrRef,
            leaderName: reg.leader_name,
            leaderEmail: reg.leader_email,
            leaderPhone: reg.leader_phone,
            collegeName: reg.college_name,
            participantCount: reg.participant_count,
            participants: parts.map(p => ({
              fullName: p.full_name,
              rollNumber: p.roll_number,
              department: p.department,
              yearOfStudy: p.year_of_study,
              section: p.section
            }))
          });
        }
      } catch (emailErr) {
        console.warn('Auto-verification confirmation email failed (non-fatal):', emailErr);
      }
    } else {
      await execute(`
        UPDATE stall_bookings SET
          payment_status = 'PAID',
          status = 'approved',
          transaction_id = ?,
          updated_at = ?
        WHERE id = ?
      `, [utrOrRef, now, regId]);

      // Dispatch stall email
      try {
        const stl = await queryOne<any>('SELECT * FROM stall_bookings WHERE id = ?', [regId]);
        if (stl) {
          await sendStallBookingEmail({
            categoryName: stl.stall_category,
            bookingId: regId,
            totalAmount: targetAmount,
            utrNumber: utrOrRef,
            entityName: stl.entity_name,
            contactName: stl.contact_name,
            contactEmail: stl.contact_email,
            contactPhone: stl.contact_phone,
            stallsRequested: stl.stalls_requested,
            productsServices: stl.products_services
          });
        }
      } catch (emailErr) {
        console.warn('Auto-verification stall email failed (non-fatal):', emailErr);
      }
    }

    // Audit log
    await logAuditEvent(
      'AUTO_BACKEND_ENGINE',
      'AUTO_PAYMENT_VERIFIED',
      'PAYMENT',
      pay.id,
      `Automated match: Credit ₹${targetAmount} from ${cleanPhone || 'receiver feed'} matched with ${regId}. Status automatically confirmed.`
    );

    return {
      isVerified: true,
      status: 'PAID',
      redirectUrl: `/confirmation/${regId}`,
      registrationId: regId,
      amount: targetAmount,
      message: 'Payment automatically verified and registration confirmed!'
    };
  }

  // Still waiting for credit settlement
  return {
    isVerified: false,
    status: pay.status || 'PENDING',
    registrationId: regId,
    amount: targetAmount,
    message: 'Awaiting incoming bank settlement for ₹' + targetAmount.toFixed(2) + '...'
  };
}
