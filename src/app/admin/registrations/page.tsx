'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  Printer,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  TestTube,
  BadgeCheck
} from 'lucide-react';
import { EventRegistrationRecord } from '@/lib/db';

type RegType = 'ALL' | 'REAL' | 'TEST';

const STATUS_COLORS: Record<string, string> = {
  verified: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  submitted: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  pending: 'bg-slate-700/50 text-slate-400 border-slate-600',
  rejected: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  refunded: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  paid: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

export default function AdminRegistrationsPage() {
  const [registrations, setRegistrations] = useState<EventRegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [regTypeFilter, setRegTypeFilter] = useState<RegType>('REAL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState<{ regId: string; payId?: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchRegistrations = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (eventFilter) params.append('eventId', eventFilter);
    if (search) params.append('search', search);
    params.append('registrationType', regTypeFilter);

    fetch(`/api/admin/registrations?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch registrations');
        setRegistrations(data.registrations || []);
      })
      .catch(() => setRegistrations([]))
      .finally(() => setLoading(false));
  }, [statusFilter, eventFilter, search, regTypeFilter]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRegistrations();
  };

  const handleVerifyPayment = async (registrationId: string) => {
    // Find associated payment via the payments API
    setActionLoading(registrationId);
    try {
      // Fetch payments for this registration
      const pRes = await fetch(`/api/admin/payments?search=${registrationId}&registrationType=ALL`);
      const pData = await pRes.json();
      const payment = pData.payments?.find((p: any) => p.reference_id === registrationId);

      if (!payment) {
        alert('No payment found for this registration. Try from the Payments tab.');
        return;
      }

      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', paymentId: payment.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchRegistrations();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectMode || !rejectReason.trim()) return;
    setActionLoading(rejectMode.regId);
    try {
      const pRes = await fetch(`/api/admin/payments?search=${rejectMode.regId}&registrationType=ALL`);
      const pData = await pRes.json();
      const payment = pData.payments?.find((p: any) => p.reference_id === rejectMode.regId);

      if (!payment) {
        alert('No payment found. Try from the Payments tab.');
        return;
      }

      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', paymentId: payment.id, reason: rejectReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRejectMode(null);
      setRejectReason('');
      fetchRegistrations();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRegistration = async (id: string, isReal: boolean) => {
    if (isReal) {
      const confirmText = window.prompt(
        `⚠️ DANGER: This is a REAL genuine student registration.\n\nType "CONFIRM DELETE" to permanently remove this record from the centralized database:`
      );
      if (confirmText !== 'CONFIRM DELETE') return;
    }

    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/registrations?id=${id}&confirmReal=${isReal}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeleteMode(null);
      fetchRegistrations();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearAllTest = async () => {
    if (!confirm('Delete ALL TEST registrations from the database? This cannot be undone.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/registrations?deleteAllTest=true', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Deleted ${data.deletedCount} test registration(s).`);
      fetchRegistrations();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-400" />
            <span>Event Registrations Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse, inspect attendee rosters, verify/reject payments, and export delegate records.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {regTypeFilter === 'TEST' && (
            <button
              onClick={handleClearAllTest}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 flex items-center gap-1.5 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Test Data</span>
            </button>
          )}
          <a
            href="/api/admin/export?type=events"
            download
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white flex items-center gap-1.5 shadow-md shadow-sky-500/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl glass-card p-4 border border-sky-500/20 space-y-3">
        {/* REAL vs TEST toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Data Filter:
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
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              {t === 'REAL' && <BadgeCheck className="w-3 h-3" />}
              {t === 'TEST' && <TestTube className="w-3 h-3" />}
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="px-3 py-2 rounded-xl glass-input text-xs bg-slate-900 text-slate-300"
          >
            <option value="">All Competitions</option>
            <option value="prompt-perfect">Prompt Perfect</option>
            <option value="best-manager">Business Plan</option>
            <option value="corporate-walk">Stock War</option>
            <option value="best-cfo">Best CFO</option>
            <option value="b-quiz">B Quiz</option>
            <option value="football-auction">Football Auction</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl glass-input text-xs bg-slate-900 text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="submitted">Submitted (Pending Verification)</option>
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
              placeholder="Search leader / college / UTR / ID..."
              className="pl-8 pr-3 py-2 rounded-xl glass-input text-xs w-64 text-white placeholder-slate-500"
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

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Showing <strong className="text-white">{registrations.length}</strong> record{registrations.length === 1 ? '' : 's'}
            {regTypeFilter !== 'ALL' && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${regTypeFilter === 'REAL' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                {regTypeFilter} ONLY
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Reject Payment</h3>
            <p className="text-xs text-slate-400 mb-4">Provide a reason for rejection (will be logged in audit trail):</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. UTR not found in bank records, Insufficient amount transferred..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs text-white mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setRejectMode(null); setRejectReason(''); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectPayment}
                disabled={!rejectReason.trim() || actionLoading === rejectMode.regId}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading === rejectMode.regId ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registrations List */}
      <div className="rounded-3xl glass-panel p-6 border border-sky-500/20 shadow-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            QUERYING CENTRAL DATABASE...
          </div>
        ) : registrations.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No registrations matching the selected filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {registrations.map((reg) => {
              const isExpanded = expandedId === reg.id;
              const isTest = reg.registration_type === 'TEST';
              const statusColor = STATUS_COLORS[reg.payment_status] || STATUS_COLORS.pending;
              const isVerified = reg.payment_status === 'verified' || reg.payment_status === 'paid';
              const isPendingVerification = reg.payment_status === 'submitted';
              const isActionLoading = actionLoading === reg.id;

              return (
                <div
                  key={reg.id}
                  className={`py-4 space-y-3 ${isTest ? 'opacity-80' : ''}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">

                    {/* Left Details */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-sky-400 shrink-0">
                          {reg.id}
                        </span>

                        {/* REAL / TEST badge — visually prominent */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 shrink-0 ${
                          isTest
                            ? 'bg-amber-500/25 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {isTest ? <TestTube className="w-2.5 h-2.5" /> : <BadgeCheck className="w-2.5 h-2.5" />}
                          {isTest ? 'TEST' : 'REAL'}
                        </span>

                        {/* Payment status */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}>
                          PAY: {reg.payment_status.toUpperCase()}
                        </span>

                        {/* Registration status */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-500/15 text-blue-300 border-blue-500/30">
                          REG: {reg.registration_status ? reg.registration_status.toUpperCase() : 'REGISTERED'}
                        </span>

                        <span className="text-[11px] text-slate-500">
                          {new Date(reg.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white truncate">
                          {(reg as any).event?.title || reg.event_id}
                        </h3>
                        {reg.team_name && (
                          <span className="text-xs text-sky-300 font-medium shrink-0">&bull; {reg.team_name}</span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400">
                        <span className="text-white font-semibold">{reg.leader_name}</span>{' '}
                        ({reg.leader_email}) &bull; {reg.college_name}, {reg.college_location}
                      </p>

                      {reg.transaction_id && (
                        <p className="text-[11px] text-slate-500 font-mono">
                          UTR: <span className="text-amber-300 font-bold">{reg.transaction_id}</span>
                        </p>
                      )}
                    </div>

                    {/* Right: Amount + Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-lg font-black text-white font-mono">₹{reg.total_fee}</span>
                        <span className="text-[10px] text-slate-400 block">{reg.participant_count} participant{(reg.participant_count || 0) > 1 ? 's' : ''}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">

                        {/* Verify payment if submitted */}
                        {isPendingVerification && (
                          <button
                            onClick={() => handleVerifyPayment(reg.id)}
                            disabled={isActionLoading}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/40 flex items-center gap-1 transition-all disabled:opacity-50"
                            title="Mark payment as verified"
                          >
                            {isActionLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                            Verify
                          </button>
                        )}

                        {/* Reject if submitted */}
                        {isPendingVerification && (
                          <button
                            onClick={() => setRejectMode({ regId: reg.id })}
                            disabled={isActionLoading}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 flex items-center gap-1 transition-all disabled:opacity-50"
                            title="Reject this payment"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        )}

                        {/* Expand roster */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center gap-1 border border-slate-700 transition-colors"
                        >
                          {isExpanded ? 'Hide' : 'Roster'}
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {/* View pass */}
                        <Link
                          href={`/confirmation/${reg.id}`}
                          target="_blank"
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/30 flex items-center gap-1 transition-all"
                        >
                          <Printer className="w-3 h-3" />
                          Pass
                        </Link>

                        {/* Delete — always available but warned for REAL */}
                        <button
                          onClick={() => handleDeleteRegistration(reg.id, !isTest)}
                          disabled={isActionLoading}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all disabled:opacity-50 ${
                            isTest
                              ? 'bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-300 border-slate-800 hover:border-rose-500/30'
                              : 'bg-slate-900 hover:bg-rose-500/20 text-slate-600 hover:text-rose-300 border-slate-800 hover:border-rose-500/30'
                          }`}
                          title={isTest ? 'Delete test record' : '⚠️ Delete REAL registration — requires confirmation'}
                        >
                          {isTest ? <Trash2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable participant roster */}
                  {isExpanded && (
                    <div className="mt-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 animate-fadeIn space-y-3">
                      <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                        Participant Roster — {reg.id}
                      </h4>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="pb-1.5 pr-3">#</th>
                              <th className="pb-1.5 pr-3">Name</th>
                              <th className="pb-1.5 pr-3">Roll / Reg No.</th>
                              <th className="pb-1.5 pr-3">Department</th>
                              <th className="pb-1.5">Year &amp; Section</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {((reg as any).participants || []).map((p: any, idx: number) => (
                              <tr key={p.id || idx} className="text-slate-300">
                                <td className="py-2 pr-3 text-slate-500 font-mono">{idx + 1}</td>
                                <td className="py-2 pr-3 font-bold text-white">{p.full_name}</td>
                                <td className="py-2 pr-3 font-mono text-sky-300">{p.roll_number}</td>
                                <td className="py-2 pr-3">{p.department}</td>
                                <td className="py-2">{p.year_of_study} (Sec {p.section})</td>
                              </tr>
                            ))}
                            {((reg as any).participants || []).length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-4 text-center text-slate-500 text-xs">
                                  No participant details loaded. Click &apos;Roster&apos; again to reload.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Registration metadata */}
                      <div className="pt-2 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Registration Status</span>
                          <span className="text-white font-semibold capitalize">{reg.registration_status}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Payment Status</span>
                          <span className={`font-bold capitalize ${isVerified ? 'text-emerald-300' : 'text-amber-300'}`}>{reg.payment_status}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">UTR / Transaction</span>
                          <span className="text-amber-300 font-mono font-bold">{reg.transaction_id || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Data Type</span>
                          <span className={`font-black ${isTest ? 'text-amber-300' : 'text-emerald-300'}`}>{reg.registration_type}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
