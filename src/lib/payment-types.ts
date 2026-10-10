export type PaymentStatus =
  | 'PENDING'
  | 'VERIFYING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'REVIEW_REQUIRED';

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
  created_at: string;
  updated_at?: string;
  item_title?: string;
  participant_count?: number;
}

export function normalizePaymentStatus(status?: string | null): PaymentStatus {
  if (!status) return 'PENDING';
  const s = status.toUpperCase();
  if (s === 'PAID' || s === 'VERIFIED' || s === 'SUCCESSFUL' || s === 'CONFIRMED') return 'PAID';
  if (s === 'REVIEW_REQUIRED' || s === 'SUBMITTED') return 'REVIEW_REQUIRED';
  if (s === 'VERIFYING' || s === 'PROCESSING') return 'VERIFYING';
  if (s === 'FAILED' || s === 'REJECTED') return 'FAILED';
  if (s === 'EXPIRED') return 'EXPIRED';
  return 'PENDING';
}
