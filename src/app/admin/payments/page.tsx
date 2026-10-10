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
  Layers
} from 'lucide-react';
import { PaymentRecord, normalizePaymentStatus } from '@/lib/payment-types';

type RegType = 'ALL' | 'REAL' | 'TEST';

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  verified: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  successful: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  REVIEW_REQUIRED: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  submitted: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  VERIFYING: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  PENDING: 'bg-slate-700/50 text-slate-400 border-slate-600',
  pending: 'bg-slate-700/50 text-slate-400 border-slate-600',
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
  const [regTypeFilter, setRegTypeFilter] = useState<RegType>('REAL');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [verifyModal, setVerifyModal] = useState<{ id: string; amount: number; utr: string; referenceId: string } | null>(null);
  const [verifyNotes, setVerifyNotes] = useState('');

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

  const handleAction = async (action: 'verify' | 'reject' | 'refund', paymentId: string, reasonOrNotes?: string) => {
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
            Authoritatively verify submitted UPI UTRs against bank statements, reject invalid claims, and issue refunds.
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

      {/* Manual Verification Modal */}
      {verifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Confirm Bank Receipt</h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              Please verify that <strong className="text-emerald-400 font-mono">₹{Number(verifyModal.amount || 0).toFixed(2)}</strong> with UTR <strong className="text-amber-300 font-mono">{verifyModal.utr || 'N/A'}</strong> has been received in the festival Axis Bank / GPay account (<code className="text-sky-300">s.venkatesanraja@okaxis</code>).
            </p>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] space-y-1">
              <div><span className="text-slate-400">Payment ID:</span> <span className="font-mono text-white">{verifyModal.id}</span></div>
              <div><span className="text-slate-400">Registration Ref:</span> <span className="font-mono text-sky-300">{verifyModal.referenceId}</span></div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                Verification Notes (Optional, logged to audit ledger):
              </label>
              <input
                type="text"
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="e.g. Confirmed in Axis Bank passbook on 11 Oct"
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
                {actionLoading === verifyModal.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Confirm Payment &amp; Authorize Pass
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
                  <th className="px-4 py-3">Payment / UTR</th>
                  <th className="px-4 py-3">Registration Ref</th>
                  <th className="px-4 py-3">Event / Item</th>
                  <th className="px-4 py-3 text-center">Amount</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-center">Status</th>
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
                  const statusStyle = STATUS_STYLES[p.status] || STATUS_STYLES[norm] || STATUS_STYLES.PENDING;
                  const isActing = actionLoading === p.id;
                  const utr = p.user_reference || p.gateway_payment_id;

                  return (
                    <tr key={p.id} className={`text-slate-300 hover:bg-slate-900/30 transition-colors ${isTest ? 'opacity-80' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-sky-400 text-[10px] truncate max-w-[140px]">{p.id}</div>
                        {utr && (
                          <div className="text-[10px] text-amber-300 font-mono font-semibold mt-0.5">
                            UTR: {utr}
                          </div>
                        )}
                        {p.verified_by && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            By: {p.verified_by}
                          </div>
                        )}
                        {p.verification_method && (
                          <span className="text-[9px] text-slate-500 font-mono block">
                            via {p.verification_method}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/confirmation/${p.reference_id}`}
                          target="_blank"
                          className="font-mono text-[10px] text-white hover:text-sky-300 hover:underline font-semibold flex items-center gap-1"
                        >
                          <span>{p.reference_id}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </Link>
                        <span className="text-[10px] text-slate-500 block capitalize">{p.reference_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white font-semibold truncate max-w-[120px]">{p.item_title || '—'}</div>
                        {p.participant_count && (
                          <div className="text-[10px] text-slate-500">{p.participant_count} participant(s)</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-white">
                        ₹{Number(p.amount || 0).toFixed(2)}
                      </td>
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
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle} inline-flex items-center gap-1`}>
                          {isReviewRequired && <Clock className="w-2.5 h-2.5" />}
                          {isVerified && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {norm.replace('_', ' ')}
                        </span>
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
                      <td className="px-4 py-3 text-center text-[11px] text-slate-400">
                        {formatDate(p.created_at)}
                        {p.verified_at && (
                          <div className="text-[10px] text-emerald-400">
                            ✓ {formatDate(p.verified_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          {/* Verify */}
                          {isReviewRequired && (
                            <button
                              onClick={() => setVerifyModal({
                                id: p.id,
                                amount: Number(p.amount || 0),
                                utr: utr || '',
                                referenceId: p.reference_id
                              })}
                              disabled={isActing}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Verify against bank records"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              Verify
                            </button>
                          )}

                          {/* Reject */}
                          {isReviewRequired && (
                            <button
                              onClick={() => setRejectModal(p.id)}
                              disabled={isActing}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 flex items-center gap-1 transition-all disabled:opacity-50"
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
