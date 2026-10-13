export type PaymentStatus =
  | 'PENDING'
  | 'VERIFYING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'REVIEW_REQUIRED'
  | 'REFUNDED';

export interface PaymentRecord {
  id: string;
  reference_id: string;
  reference_type: 'event' | 'stall';
  amount: number;
  currency: string;
  gateway: string;
  gateway_payment_id?: string | null;
  user_reference?: string | null;
  provider_reference?: string | null;
  payment_method?: string | null;
  payer_email?: string | null;
  status: string;
  registration_type: 'REAL' | 'TEST';
  verified_at?: string | null;
  verified_by?: string | null;
  verified_amount?: number | null;
  review_notes?: string | null;
  verification_method?: string | null;
  rejection_reason?: string | null;
  refunded_at?: string | null;
  refund_reason?: string | null;
  refund_status?: string | null;
  refund_amount?: number | null;
  email_status?: string | null;
  email_sent_at?: string | null;
  email_error?: string | null;
  created_at: string;
  updated_at?: string;
  item_title?: string;
  participant_count?: number;
  payment_screenshot?: string | null;
  leader_name?: string | null;
  leader_email?: string | null;
  leader_phone?: string | null;
  college_name?: string | null;
  team_name?: string | null;
  participants_list?: Array<{
    fullName: string;
    rollNumber: string;
    department: string;
    yearOfStudy: string;
    section: string;
  }>;
}

export function normalizePaymentStatus(status?: string | null): PaymentStatus {
  if (!status) return 'PENDING';
  const s = status.toUpperCase();
  if (s === 'REFUNDED') return 'REFUNDED';
  if (s === 'PAID' || s === 'VERIFIED' || s === 'SUCCESSFUL' || s === 'CONFIRMED') return 'PAID';
  if (s === 'REVIEW_REQUIRED' || s === 'SUBMITTED') return 'REVIEW_REQUIRED';
  if (s === 'VERIFYING' || s === 'PROCESSING') return 'VERIFYING';
  if (s === 'FAILED' || s === 'REJECTED') return 'FAILED';
  if (s === 'EXPIRED') return 'EXPIRED';
  return 'PENDING';
}

export function getEventKeyIdentifier(eventId?: string | null): string {
  if (!eventId) return 'EVT';
  const clean = eventId.toLowerCase().trim();
  if (clean === 'best-cfo' || clean.includes('cfo')) return 'CFO';
  if (clean === 'prompt-perfect' || clean.includes('prompt')) return 'PP';
  if (clean === 'best-manager' || clean.includes('business-plan') || clean.includes('plan')) return 'BP';
  if (clean === 'corporate-walk' || clean.includes('stock-war') || clean.includes('stock')) return 'SW';
  if (clean === 'b-quiz' || clean.includes('quiz')) return 'BQ';
  if (clean === 'football-auction' || clean.includes('football') || clean.includes('auction')) return 'FA';
  if (clean === 'star-quas') return 'SQ';
  const letters = clean.replace(/[^a-z0-9]/g, '').toUpperCase().slice(0, 4);
  return letters || 'EVT';
}

