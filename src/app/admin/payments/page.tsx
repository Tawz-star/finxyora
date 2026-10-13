'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  XCircle,
  RotateCcw,
  RefreshCw,
  Filter,
  TestTube,
  BadgeCheck,
  Clock,
  ExternalLink,
  Shield,
  Layers,
  Trash2,
  Eye,
  Maximize2,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  Building,
  ImageIcon
} from 'lucide-react';
import { PaymentRecord, normalizePaymentStatus } from '@/lib/payment-types';

type RegType = 'ALL' | 'REAL' | 'TEST';

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Verified / Completed': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  verified: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  successful: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Pending upon submission': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  REVIEW_REQUIRED: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  submitted: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  VERIFYING: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  PENDING: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  FAILED: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  rejected: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  failed: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  refunded: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  EXPIRED: 'bg-slate-800 text-slate-500 border-slate-700'
};

function formatDate(val?: string | null): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [regTypeFilter, setRegTypeFilter] = useState<RegType>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [verifyModal, setVerifyModal] = useState<{
    id: string;
    amount: number;
    utr: string;
    referenceId: string;
    leaderEmail?: string;
    leaderName?: string;
    screenshot?: string | null;
  } | null>(null);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string; utr?: string } | null>(null);
  const [expandedParticipants, setExpandedParticipants] = useState<Record<string, boolean>>({});

  const fetchPayments = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (search) params.append('search', search);
    params.append('registrationType', regTypeFilter);

    fetch(`/api/admin/payments?${params.toString()}`)
      .then(async (res) => {
        if (res.status === 401) {
          setError('Administrator session required. Please log in.');
          setPayments([]);
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch payments');
        setPayments(data.payments || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Network error loading payments');
        setPayments([]);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, search, regTypeFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleAction = async (action: 'verify' | 'reject' | 'refund' | 'retry_email' | 'delete', paymentId: string, reasonOrNotes?: string) => {
    setActionLoading(paymentId);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          paymentId,
          reason: action === 'reject' || action === 'refund' ? reasonOrNotes : undefined,
          notes: action === 'verify' ? reasonOrNotes : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action} failed`);

      setSuccessMsg(data.message || `Payment ${action} action completed and audit-logged.`);
      fetchPayments();

      if (action === 'reject') {
        setRejectModal(null);
        setRejectReason('');
      }
      if (action === 'verify') {
        setVerifyModal(null);
        setVerifyNotes('');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const isAuthError = error && (error.toLowerCase().includes('session') || error.toLowerCase().includes('unauthorized') || error.toLowerCase().includes('log in'));

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-sky-400" />
            <span>Payment Reconciliation &amp; Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Authoritatively verify submitted UPI UTRs against bank statements, reject invalid claims, issue refunds, or permanently delete any erroneous payment record to correct festival revenue totals.
          </p>
        </div>

        <button
          onClick={fetchPayments}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 flex items-center gap-1.5 self-start sm:self-auto transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Session Expired / Unauthorized Banner */}
      {isAuthError && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-bold text-white text-sm">Administrator Session Required</p>
              <p className="text-slate-400 mt-0.5">Please re-authenticate to view live transaction records and manage financial approvals.</p>
            </div>
          </div>
          <Link
            href="/admin/login"
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold transition-all shrink-0"
          >
            Log In to Admin
          </Link>
        </div>
      )}

      {error && !isAuthError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchPayments}
            className="text-[11px] font-bold text-sky-400 hover:underline shrink-0"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Screenshot Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fadeIn"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-slate-900 border border-sky-500/30 rounded-3xl p-5 shadow-2xl overflow-hidden space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-sky-400" />
                  {lightboxImage.title}
                </h3>
                {lightboxImage.utr && (
                  <p className="text-xs text-amber-300 font-mono mt-0.5">
                    UPI Transaction ID: {lightboxImage.utr}
                  </p>
                )}
              </div>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-center max-h-[70vh] overflow-auto bg-slate-950 rounded-2xl p-2 border border-slate-800">
              <img
                src={lightboxImage.src}
                alt="Payment screenshot"
                className="max-h-[65vh] object-contain w-auto rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Click outside or the close button to dismiss</span>
              <a
                href={lightboxImage.src}
                download={`payment-screenshot-${lightboxImage.utr || 'proof'}.jpg`}
                className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500 hover:text-white border border-sky-500/30 font-semibold transition-colors"
              >
                Download Screenshot
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Manual Verification Modal (Verified / Completed) */}
      {verifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Mark as Verified / Completed</h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              Verify receipt of <strong className="text-emerald-400 font-mono">₹{Number(verifyModal.amount || 0).toFixed(2)}</strong> for registration <code className="text-sky-300 font-mono">{verifyModal.referenceId}</code>.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Participant / Leader:</span>
                <span className="font-semibold text-white">{verifyModal.leaderName || 'Participant'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Registered Email:</span>
                <span className="font-mono text-sky-300">{verifyModal.leaderEmail || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">UPI Transaction ID:</span>
                <span className="font-mono text-amber-300 font-bold">{verifyModal.utr || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment ID:</span>
                <span className="font-mono text-slate-400">{verifyModal.id}</span>
              </div>
            </div>

            {verifyModal.screenshot && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Attached Payment Screenshot:</span>
                  <button
                    type="button"
                    onClick={() => setLightboxImage({ src: verifyModal.screenshot!, title: `Payment Proof - ${verifyModal.referenceId}`, utr: verifyModal.utr })}
                    className="text-sky-400 hover:text-sky-300 underline text-[11px] font-semibold"
                  >
                    Enlarge &rarr;
                  </button>
                </div>
                <div
                  className="relative rounded-lg overflow-hidden border border-slate-700/80 max-h-36 flex items-center justify-center bg-slate-950 cursor-pointer"
                  onClick={() => setLightboxImage({ src: verifyModal.screenshot!, title: `Payment Proof - ${verifyModal.referenceId}`, utr: verifyModal.utr })}
                >
                  <img
                    src={verifyModal.screenshot}
                    alt="Payment Screenshot Preview"
                    className="max-h-36 object-contain w-auto rounded"
                  />
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <p>
                Action: Status will update to <strong className="text-white">Verified / Completed</strong> and an official confirmation email will be automatically dispatched to <strong className="text-white">{verifyModal.leaderEmail || 'the participant'}</strong>.
              </p>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                Verification Notes (Optional, logged to audit ledger):
              </label>
              <input
                type="text"
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="e.g. Confirmed in Axis Bank passbook"
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs text-white"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => { setVerifyModal(null); setVerifyNotes(''); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('verify', verifyModal.id, verifyNotes || 'Confirmed against bank records')}
                disabled={actionLoading === verifyModal.id}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-emerald-500/25"
              >
                {actionLoading === verifyModal.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Mark Verified / Completed &amp; Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Reject Payment Claim</h3>
            <p className="text-xs text-slate-400 mb-4">
              Payment ID: <code className="text-rose-300 font-mono">{rejectModal}</code>
              <br />Provide an official reason (saved to audit trail):
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. UTR not found in bank records, amount mismatch, duplicate submission..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs text-white mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('reject', rejectModal, rejectReason)}
                disabled={!rejectReason.trim() || actionLoading === rejectModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading === rejectModal ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Reject Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="rounded-2xl glass-card p-4 border border-sky-500/20 space-y-3">
        {/* REAL/TEST toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Data Classification:
          </span>
          {(['REAL', 'TEST', 'ALL'] as RegType[]).map((t) => (
            <button
              key={t}
              onClick={() => setRegTypeFilter(t)}
              className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5 ${
                regTypeFilter === t
                  ? t === 'REAL'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : t === 'TEST'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              {t === 'REAL' && <BadgeCheck className="w-3 h-3" />}
              {t === 'TEST' && <TestTube className="w-3 h-3" />}
              {t === 'ALL' && <Layers className="w-3 h-3" />}
              {t}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); fetchPayments(); }}
          className="flex flex-wrap items-center gap-3"
        >
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl glass-input text-xs bg-slate-900 text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="REVIEW_REQUIRED">Review Required (Submitted UTR)</option>
            <option value="PAID">Verified / Paid</option>
            <option value="PENDING">Pending (Not Submitted)</option>
            <option value="FAILED">Rejected / Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Payment ID / UTR / Ref / Email..."
              className="pl-8 pr-3 py-2 rounded-xl glass-input text-xs w-72 text-white placeholder-slate-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 text-white hover:bg-sky-400 transition-colors"
          >
            Search
          </button>
        </form>

        <span className="text-xs text-slate-400">
          {payments.length} transaction{payments.length !== 1 ? 's' : ''} found
          {regTypeFilter !== 'ALL' && (
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${regTypeFilter === 'REAL' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
              {regTypeFilter} ONLY
            </span>
          )}
        </span>
      </div>

      {/* Payments Table */}
      <div className="rounded-3xl glass-panel border border-sky-500/20 shadow-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            LOADING PAYMENT RECORDS FROM CENTRAL SQL DATABASE...
          </div>
        ) : payments.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-xs text-slate-400">
              No payment records matching the selected filters.
            </p>
            {regTypeFilter === 'REAL' && (
              <button
                onClick={() => setRegTypeFilter('ALL')}
                className="text-xs text-sky-400 hover:text-sky-300 underline font-semibold"
              >
                Switch to ALL data (includes test registrations)
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                  <th className="px-3 py-3 text-center">Screenshot</th>
                  <th className="px-4 py-3">Payment &amp; UPI Ref</th>
                  <th className="px-4 py-3">Participant Details</th>
                  <th className="px-4 py-3">Registration &amp; Event</th>
                  <th className="px-4 py-3 text-center">Amount</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-center">Payment Status</th>
                  <th className="px-4 py-3 text-center">Submitted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.map((p) => {
                  const norm = normalizePaymentStatus(p.status);
                  const isVerified = norm === 'PAID';
                  const isReviewRequired = norm === 'REVIEW_REQUIRED';
                  const isTest = p.registration_type === 'TEST';
                  const statusStyle = isVerified ? STATUS_STYLES.PAID : STATUS_STYLES['Pending upon submission'];
                  const isActing = actionLoading === p.id;
                  const utr = p.user_reference || p.gateway_payment_id;

                  return (
                    <tr key={p.id} className={`text-slate-300 hover:bg-slate-900/30 transition-colors ${isTest ? 'opacity-80' : ''}`}>
                      {/* 1. Payment Screenshot */}
                      <td className="px-3 py-3 text-center">
                        {p.payment_screenshot ? (
                          <div
                            onClick={() => setLightboxImage({ src: p.payment_screenshot!, title: `Payment Proof - ${p.reference_id}`, utr: utr || undefined })}
                            className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-700 hover:border-sky-400 cursor-pointer group bg-slate-950 transition-all shadow-sm mx-auto"
                            title="Click to view full-size payment screenshot"
                          >
                            <img
                              src={p.payment_screenshot}
                              alt="Payment Screenshot"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-4 h-4 text-white drop-shadow" />
                            </div>
                          </div>
                        ) : (
                          <span className="px-2 py-1 rounded-md text-[10px] text-slate-500 bg-slate-900 border border-slate-800 inline-block">
                            No image
                          </span>
                        )}
                      </td>

                      {/* 2. Payment & UPI Reference */}
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-sky-400 text-[10px] truncate max-w-[140px]">{p.id}</div>
                        {utr ? (
                          <div className="text-[11px] text-amber-300 font-mono font-bold mt-0.5">
                            UPI: {utr}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">No UPI Ref</div>
                        )}
                        <span className="text-[10px] text-slate-400 block mt-0.5">{p.payment_method || 'UPI - GPay'}</span>
                        {p.verified_by && (
                          <div className="text-[10px] text-emerald-400 mt-0.5">
                            ✓ Verified by: {p.verified_by}
                          </div>
                        )}
                      </td>

                      {/* 3. Participant Details alongside UPI ID */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-white text-xs">{p.leader_name || 'Participant'}</div>
                        {p.college_name && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{p.college_name}</div>
                        )}
                        {p.leader_email && (
                          <div className="text-[10px] text-sky-300 font-mono truncate max-w-[180px]">{p.leader_email}</div>
                        )}
                        {p.leader_phone && (
                          <div className="text-[10px] text-slate-400 font-mono">{p.leader_phone}</div>
                        )}
                        {p.team_name && (
                          <div className="text-[10px] text-indigo-300 font-medium">Team: {p.team_name}</div>
                        )}
                        {p.participants_list && p.participants_list.length > 0 && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => setExpandedParticipants(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                              className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                            >
                              <span>{p.participants_list.length} Members</span>
                              {expandedParticipants[p.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            {expandedParticipants[p.id] && (
                              <div className="mt-1.5 p-2 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1 text-[10px] max-w-[220px]">
                                {p.participants_list.map((m, idx) => (
                                  <div key={idx} className="text-slate-300 border-b border-slate-900 pb-0.5 last:border-0">
                                    <span className="text-white font-medium">{idx + 1}. {m.fullName}</span>
                                    <span className="text-slate-500 ml-1">({m.rollNumber})</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 4. Registration Ref & Item */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/confirmation/${p.reference_id}`}
                          target="_blank"
                          className="font-mono text-[10px] text-white hover:text-sky-300 hover:underline font-semibold flex items-center gap-1"
                        >
                          <span>{p.reference_id}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </Link>
                        <div className="text-white font-semibold truncate max-w-[130px] mt-0.5">{p.item_title || '—'}</div>
                        <span className="text-[10px] text-slate-500 capitalize block">{p.reference_type}</span>
                      </td>

                      {/* 5. Amount */}
                      <td className="px-4 py-3 text-center font-mono font-bold text-white">
                        ₹{Number(p.amount || 0).toFixed(2)}
                      </td>

                      {/* 6. Classification Type */}
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 justify-center ${
                          isTest
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                        }`}>
                          {isTest ? <TestTube className="w-2.5 h-2.5" /> : <BadgeCheck className="w-2.5 h-2.5" />}
                          {p.registration_type}
                        </span>
                      </td>

                      {/* 7. Status Column */}
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle} inline-flex items-center gap-1`}>
                          {isVerified ? (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Verified / Completed
                            </>
                          ) : (
                            <>
                              <Clock className="w-2.5 h-2.5" />
                              Pending upon submission
                            </>
                          )}
                        </span>
                        {p.refund_status && p.refund_status !== 'NONE' && (
                          <div className="mt-1">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border inline-flex items-center gap-1 ${
                              p.refund_status === 'COMPLETED'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            }`}>
                              Refund: {p.refund_status}
                              {p.refund_amount ? ` (₹${Number(p.refund_amount).toFixed(2)})` : ''}
                            </span>
                          </div>
                        )}
                        {p.email_status && p.email_status !== 'NONE' && (
                          <div className="mt-1 flex items-center justify-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border inline-flex items-center gap-1 ${
                              p.email_status === 'SENT'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`} title={p.email_error || (p.email_sent_at ? `Sent at ${p.email_sent_at}` : '')}>
                              ✉ {p.email_status === 'SENT' ? 'Email Sent' : 'Email Failed'}
                            </span>
                            {p.email_status === 'FAILED' && (
                              <button
                                onClick={() => handleAction('retry_email', p.id)}
                                disabled={isActing}
                                className="text-[9px] font-bold text-sky-400 hover:text-sky-300 underline disabled:opacity-50"
                                title="Retry sending notification"
                              >
                                Retry
                              </button>
                            )}
                          </div>
                        )}
                        {p.rejection_reason && (
                          <div className="text-[10px] text-rose-400 mt-0.5 max-w-[120px] truncate" title={p.rejection_reason}>
                            {p.rejection_reason}
                          </div>
                        )}
                        {p.review_notes && (
                          <div className="text-[10px] text-sky-400 mt-0.5 max-w-[120px] truncate" title={p.review_notes}>
                            {p.review_notes}
                          </div>
                        )}
                      </td>

                      {/* 8. Submitted Date */}
                      <td className="px-4 py-3 text-center text-[11px] text-slate-400">
                        {formatDate(p.created_at)}
                        {p.verified_at && (
                          <div className="text-[10px] text-emerald-400">
                            ✓ {formatDate(p.verified_at)}
                          </div>
                        )}
                      </td>

                      {/* 9. Actions Column */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          {/* Clear action button to update payment status to "Verified / Completed" */}
                          {!isVerified && (
                            <button
                              onClick={() => setVerifyModal({
                                id: p.id,
                                amount: Number(p.amount || 0),
                                utr: utr || '',
                                referenceId: p.reference_id,
                                leaderEmail: p.leader_email || p.payer_email || '',
                                leaderName: p.leader_name || 'Participant',
                                screenshot: p.payment_screenshot
                              })}
                              disabled={isActing}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/20 flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Update payment status to Verified / Completed and dispatch confirmation email to participant"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Verified / Completed
                            </button>
                          )}

                          {/* Reject */}
                          {!isVerified && (
                            <button
                              onClick={() => setRejectModal(p.id)}
                              disabled={isActing}
                              className="px-2 py-1.5 rounded-lg text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Reject this payment claim"
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                          )}

                          {/* Refund */}
                          {isVerified && (
                            <button
                              onClick={() => {
                                if (confirm(`Issue refund for payment ${p.id} (₹${Number(p.amount || 0).toFixed(2)})?`)) {
                                  const reason = prompt('Reason for refund:');
                                  if (reason) handleAction('refund', p.id, reason);
                                }
                              }}
                              disabled={isActing}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white border border-purple-500/30 flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Mark as refunded"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Refund
                            </button>
                          )}

                          {/* Retry Email */}
                          {p.email_status === 'FAILED' && (
                            <button
                              onClick={() => handleAction('retry_email', p.id)}
                              disabled={isActing}
                              className="px-2 py-1.5 rounded-lg text-[10px] font-bold bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/30 flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Retry Email Notification"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Email
                            </button>
                          )}

                          {/* Delete Payment Record */}
                          <button
                            onClick={() => {
                              const msg = `⚠️ Permanently delete payment record "${p.id}" (₹${Number(p.amount || 0).toFixed(2)}) for ${p.reference_id}?\n\nThis will remove it from the payment ledger and immediately deduct it from festival revenue calculations.`;
                              if (window.confirm(msg)) {
                                handleAction('delete', p.id);
                              }
                            }}
                            disabled={isActing}
                            className="px-2 py-1.5 rounded-lg text-[10px] font-bold bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 flex items-center gap-1 transition-all disabled:opacity-50"
                            title="Permanently delete payment and recalculate festival revenue"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
