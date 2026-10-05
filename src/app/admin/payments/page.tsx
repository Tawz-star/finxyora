'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  BadgeCheck
} from 'lucide-react';
import { PaymentRecord } from '@/lib/db';

type RegType = 'ALL' | 'REAL' | 'TEST';

const STATUS_STYLES: Record<string, string> = {
  verified: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  successful: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  submitted: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  pending: 'bg-slate-700/50 text-slate-400 border-slate-600',
  rejected: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  failed: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  refunded: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

export default function AdminPaymentsPage() {
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

  const fetchPayments = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (search) params.append('search', search);
    params.append('registrationType', regTypeFilter);

    fetch(`/api/admin/payments?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch payments');
        setPayments(data.payments || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, search, regTypeFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleAction = async (action: 'verify' | 'reject' | 'refund', paymentId: string, reason?: string) => {
    setActionLoading(paymentId);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, paymentId, reason })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action} failed`);

      setSuccessMsg(data.message || `Payment ${action} action completed and audit-logged.`);
      fetchPayments();

      if (action === 'reject') {
        setRejectModal(null);
        setRejectReason('');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

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
            Review submitted UPI payments, manually verify UTRs, reject invalid claims, and issue refunds.
          </p>
        </div>

        <button
          onClick={fetchPayments}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reject reason modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Reject Payment</h3>
            <p className="text-xs text-slate-400 mb-4">
              Payment ID: <code className="text-rose-300 font-mono">{rejectModal}</code>
              <br />Provide an official reason (saved to audit log):
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. UTR not found in bank records, amount mismatch, fraudulent submission..."
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
            Data Type:
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
            <option value="submitted">Submitted (Awaiting Verification)</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
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
            LOADING PAYMENT RECORDS FROM CENTRAL DATABASE...
          </div>
        ) : payments.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No payment records matching the selected filters.
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
                  const isVerified = p.status === 'verified' || p.status === 'successful';
                  const isSubmitted = p.status === 'submitted';
                  const isRefunded = p.status === 'refunded';
                  const isTest = p.registration_type === 'TEST';
                  const statusStyle = STATUS_STYLES[p.status] || STATUS_STYLES.pending;
                  const isActing = actionLoading === p.id;

                  return (
                    <tr key={p.id} className={`text-slate-300 hover:bg-slate-900/30 transition-colors ${isTest ? 'opacity-80' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-sky-400 text-[10px] truncate max-w-[140px]">{p.id}</div>
                        {p.gateway_payment_id && (
                          <div className="text-[10px] text-amber-300 font-mono font-semibold mt-0.5">
                            UTR: {p.gateway_payment_id}
                          </div>
                        )}
                        {p.verified_by && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            By: {p.verified_by}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/confirmation/${p.reference_id}`}
                          target="_blank"
                          className="font-mono text-[10px] text-white hover:text-sky-300 hover:underline font-semibold"
                        >
                          {p.reference_id}
                        </Link>
                        <span className="text-[10px] text-slate-500 block capitalize">{p.reference_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white font-semibold truncate max-w-[120px]">{(p as any).item_title || '—'}</div>
                        {(p as any).participant_count && (
                          <div className="text-[10px] text-slate-500">{(p as any).participant_count} participant(s)</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-white">
                        ₹{p.amount.toFixed(2)}
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
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle}`}>
                          {p.status.toUpperCase()}
                        </span>
                        {p.rejection_reason && (
                          <div className="text-[10px] text-rose-400 mt-0.5 max-w-[100px] truncate" title={p.rejection_reason}>
                            {p.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-[11px] text-slate-400">
                        {new Date(p.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        {p.verified_at && (
                          <div className="text-[10px] text-emerald-400">
                            ✓ {new Date(p.verified_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          {/* Verify */}
                          {isSubmitted && (
                            <button
                              onClick={() => handleAction('verify', p.id)}
                              disabled={isActing}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Manually verify this UPI payment"
                            >
                              {isActing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                              Verify
                            </button>
                          )}

                          {/* Reject */}
                          {isSubmitted && (
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

                          {/* Refund for verified */}
                          {isVerified && (
                            <button
                              onClick={() => {
                                const reason = window.prompt('Enter reason for refund (required, logged to audit trail):');
                                if (reason) handleAction('refund', p.id, reason);
                              }}
                              disabled={isActing}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white border border-purple-500/30 flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Issue refund"
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
