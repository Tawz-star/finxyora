'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  RefreshCw,
  Clock
} from 'lucide-react';
import { PaymentRecord } from '@/lib/db';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPayments = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (search) params.append('search', search);

    fetch(`/api/admin/payments?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch payments');
        setPayments(data.payments || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments();
  };

  const handleRefund = async (paymentId: string) => {
    const reason = prompt('Please enter an official administrative reason for issuing this refund:');
    if (!reason) return;

    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund', paymentId, reason })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refund failed');

      setSuccessMsg(`Payment ${paymentId} was refunded and recorded in the audit log.`);
      fetchPayments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Refund operation failed');
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-sky-400" />
            <span>Payment Reconciliations &amp; Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Verified financial transactions, cryptographic gateway references, and administrative refund controls.
          </p>
        </div>

        <button
          onClick={fetchPayments}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Ledger
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="rounded-2xl glass-card p-4 border border-sky-500/20 flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl glass-input text-xs bg-slate-900 text-slate-300"
          >
            <option value="">All Transactions</option>
            <option value="successful">Successful</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed / Declined</option>
            <option value="refunded">Refunded</option>
          </select>

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Payment ID or Ref..."
              className="pl-8 pr-3 py-2 rounded-xl glass-input text-xs w-64 text-white placeholder-slate-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 text-white hover:bg-sky-400 transition-colors"
          >
            Filter
          </button>
        </form>

        <span className="text-xs text-slate-400">
          Total Transactions: <strong>{payments.length}</strong>
        </span>
      </div>

      {/* Transactions Table */}
      <div className="rounded-3xl glass-panel p-6 border border-sky-500/20 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="pb-3">Payment ID</th>
                <th className="pb-3">Linked Reference</th>
                <th className="pb-3">Gateway Order ID</th>
                <th className="pb-3">Gateway Txn Ref</th>
                <th className="pb-3 text-center">Amount</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 text-center">Settled Timestamp</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {payments.map((p) => {
                const isSuccessful = p.status === 'successful';
                const isRefunded = p.status === 'refunded';

                return (
                  <tr key={p.id} className="text-slate-300 hover:bg-slate-900/30 transition-colors">
                    <td className="py-3 font-mono font-bold text-sky-400">
                      {p.id}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/confirmation/${p.reference_id}`}
                        target="_blank"
                        className="font-mono text-white hover:text-sky-300 hover:underline font-semibold"
                      >
                        {p.reference_id}
                      </Link>
                      <span className="text-[10px] text-slate-400 block capitalize">
                        {p.reference_type}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[11px] text-slate-400">
                      {p.gateway_order_id || 'N/A'}
                    </td>
                    <td className="py-3 font-mono text-[11px] text-slate-300 truncate max-w-[120px]">
                      {p.gateway_payment_id || 'Pending'}
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-white text-sm">
                      ₹{p.amount.toFixed(2)}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isSuccessful
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : isRefunded
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-center text-[11px] text-slate-400">
                      {p.verified_at
                        ? new Date(p.verified_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                        : new Date(p.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 text-right">
                      {isSuccessful && (
                        <button
                          onClick={() => handleRefund(p.id)}
                          className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-semibold transition-colors"
                          title="Issue refund and update registration status"
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
