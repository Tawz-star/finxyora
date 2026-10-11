'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trophy,
  Users,
  Store,
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  ArrowRight,
  ShieldCheck,
  Activity,
  DollarSign,
  RotateCcw,
  Clock,
  Filter
} from 'lucide-react';

interface MetricsData {
  totalRealRegistrations: number;
  totalTestRegistrations: number;
  totalEventRegs: number;
  confirmedEventRegs: number;
  totalConfirmedParticipants: number;
  totalStallBookings: number;
  studentStallBookings: number;
  vendorStallBookings: number;
  verifiedCollections: number;
  completedRefunds: number;
  netCollections: number;
  pendingRefunds: number;
  submittedCollections: number;
  pendingCollections: number;
  refundedCollections: number;
  pendingPayments: number;
  successfulPayments: number;
  verifiedPayments: number;
  submittedPayments: number;
  failedPayments: number;
  refundedPayments: number;
  activeFilter: 'REAL' | 'ALL' | 'TEST';
  isCentralizedDatabase: boolean;
  databaseEngine: string;
  eventsBreakdown: Array<{
    id: string;
    title: string;
    total_registrations: number;
    paid_registrations: number;
    total_participants: number;
  }>;
  stallInventorySummary: Array<{
    id: string;
    name: string;
    price: number;
    total_stalls: number;
    booked_count: number;
    available_stalls: number;
  }>;
}

interface AuditLog {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  details?: string;
  created_at: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'REAL' | 'ALL'>('REAL');
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/dashboard?filter=${filter}`)
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/admin/login');
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load dashboard');
        setMetrics(data.metrics);
        setAuditLogs(data.auditLogs || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router, filter]);

  if (loading && !metrics) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-mono">LOADING CENTRAL DASHBOARD METRICS...</p>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-8 rounded-3xl glass-panel text-center max-w-lg mx-auto space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Dashboard Access Error</h3>
        <p className="text-xs text-slate-300">{error || 'Could not fetch dashboard metrics.'}</p>
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 text-white text-xs font-semibold"
        >
          Re-authenticate Admin
        </Link>
      </div>
    );
  }

  const netCollections = metrics.netCollections ?? Math.max(0, metrics.verifiedCollections - metrics.completedRefunds);

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Festival Control Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
              FINXYORA 2K26
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time verified collections, automated reconciliation, and downloadable Excel reporting.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Data Filter Selector */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('REAL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filter === 'REAL'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Real Data Only
            </button>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filter === 'ALL'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Records
            </button>
          </div>

          <Link
            href="/admin/events"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-colors"
          >
            Manage Events
          </Link>
          <Link
            href="/admin/stalls"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Manage Stalls
          </Link>
          <Link
            href="/admin/payments"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 hover:border-sky-500/40 transition-colors flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5 text-sky-400" />
            Reconcile Payments
          </Link>
        </div>
      </div>

      {/* TOP 4 KEY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Event Registrations */}
        <Link
          href="/admin/registrations"
          className="p-6 rounded-2xl glass-card border border-sky-500/20 hover:border-sky-400/50 hover:bg-slate-900/60 transition-all cursor-pointer block space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-sky-300 transition-colors">
            <span className="text-xs font-bold uppercase tracking-wider">Event Registrations</span>
            <Trophy className="w-5 h-5 text-sky-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {metrics.confirmedEventRegs}
            <span className="text-xs text-slate-400 font-normal ml-2">/ {metrics.totalEventRegs} total</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{metrics.totalConfirmedParticipants} Confirmed Student Delegates</span>
          </div>
        </Link>

        {/* Card 2: Total Verified Revenue (Clear, positive, never showing minus amounts) */}
        <Link
          href="/admin/payments"
          className="p-6 rounded-2xl glass-card border border-emerald-500/30 hover:border-emerald-400/60 hover:bg-slate-900/60 transition-all cursor-pointer block space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-emerald-300 transition-colors">
            <span className="text-xs font-bold uppercase tracking-wider">Total Verified Revenue</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-300 font-mono">
            ₹{metrics.verifiedCollections.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified Funds Captured
            </span>
            {metrics.completedRefunds > 0 ? (
              <span className="text-slate-300 font-semibold">Net: ₹{netCollections.toLocaleString('en-IN')}</span>
            ) : (
              <span className="text-slate-400">Refunds: ₹0 (No Deductions)</span>
            )}
          </div>
        </Link>

        {/* Card 3: Stall Bookings */}
        <Link
          href="/admin/stalls"
          className="p-6 rounded-2xl glass-card border border-sky-500/20 hover:border-indigo-400/50 hover:bg-slate-900/60 transition-all cursor-pointer block space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-indigo-300 transition-colors">
            <span className="text-xs font-bold uppercase tracking-wider">Festival Stalls</span>
            <Store className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {metrics.totalStallBookings}
          </div>
          <div className="text-[11px] text-slate-300 flex items-center gap-2">
            <span>Student: <strong className="text-white">{metrics.studentStallBookings}</strong></span>
            <span>&bull;</span>
            <span>Vendor: <strong className="text-white">{metrics.vendorStallBookings}</strong></span>
          </div>
        </Link>

        {/* Card 4: Pending Payments (Separated from collected revenue) */}
        <Link
          href="/admin/payments"
          className="p-6 rounded-2xl glass-card border border-amber-500/20 hover:border-amber-400/50 hover:bg-slate-900/60 transition-all cursor-pointer block space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-amber-300 transition-colors">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Verification</span>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-300 font-mono">
            ₹{metrics.pendingCollections.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
            <span className="text-amber-300 font-semibold">{metrics.pendingPayments} Awaiting Bank Review</span>
            <span className="text-slate-500 text-[10px]">Excluded From Revenue</span>
          </div>
        </Link>

      </div>

      {/* DEDICATED OFFICIAL EXCEL REPORTING CENTER (.XLSX) */}
      <div className="p-6 rounded-3xl glass-panel border border-sky-500/30 space-y-4 shadow-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Official Festival Excel Reports (.xlsx)</h2>
              <p className="text-xs text-slate-400">Download formatted genuine Excel workbooks to review complete registration ledgers and calculate totals easily.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/30 self-start sm:self-auto font-mono">
            GENUINE EXCEL FORMAT (.XLSX)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Event Registrations Excel */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-sky-500/40 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-sky-400" />
                  Event Registrations Workbook
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 font-mono">
                  Multi-Worksheet + Formulas
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Contains an <strong>Overview &amp; Totals</strong> executive summary sheet, followed by individual worksheets for all 6 competitions. Includes candidate details, team rosters, payment statuses, and automatic Excel SUM formulas for total registrations and fee calculations.
              </p>
            </div>

            <a
              href={`/api/admin/export?type=events&registrationType=${filter}`}
              download
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Event Registrations (.xlsx)</span>
            </a>
          </div>

          {/* Card 2: Stall Bookings Excel */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-emerald-400" />
                  Stall Registrations Workbook
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 font-mono">
                  Outsider / Student + Totals
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Complete stall inventory and booking ledger with contact information, accurate <strong>Outsider vs. Student</strong> classification, booking duration, selected dates, electricity, IST timestamps, and automatic SUM formulas. (College name excluded per policy).
              </p>
            </div>

            <a
              href={`/api/admin/export?type=stalls&registrationType=${filter}`}
              download
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Stall Registrations (.xlsx)</span>
            </a>
          </div>
        </div>
      </div>

      {/* FINANCIAL RECONCILIATION BREAKDOWN SUMMARY */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Financial Revenue Breakdown</h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Database Engine: {metrics.databaseEngine} &bull; Only Verified Collections Included In Revenue
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Verified Collections</span>
            <div className="text-xl font-black text-white font-mono">
              ₹{metrics.verifiedCollections.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-emerald-400 block">{metrics.successfulPayments} verified payments captured in bank</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Completed Refunds</span>
            <div className="text-xl font-black text-slate-200 font-mono">
              ₹{metrics.completedRefunds.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-400 block">
              {metrics.completedRefunds > 0 ? 'Deducted from net collections' : 'Zero refunds issued (₹0 deductions)'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-400">Net Retained Revenue</span>
            <div className="text-xl font-black text-emerald-300 font-mono">
              ₹{netCollections.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-400 block">Total Verified Collections − Completed Refunds</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-400">Pending Payments (Separated)</span>
            <div className="text-xl font-black text-amber-300 font-mono">
              ₹{metrics.pendingCollections.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-amber-400/80 block">{metrics.pendingPayments} unconfirmed claims awaiting verification</span>
          </div>
        </div>
      </div>

      {/* TWO COLUMN SECTION: EVENT BREAKDOWN & STALL INVENTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Events Breakdown (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/20 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-sky-400" />
              <span>Registrations by Competition</span>
            </h3>
            <Link
              href="/admin/registrations"
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
            >
              View Full Ledger <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="pb-3">Competition</th>
                  <th className="pb-3 text-center">Paid Teams</th>
                  <th className="pb-3 text-center">Student Delegates</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {metrics.eventsBreakdown.map((evt) => (
                  <tr key={evt.id} className="text-slate-300">
                    <td className="py-3 font-semibold text-white">
                      {evt.title}
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-emerald-400">
                      {evt.paid_registrations}
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-sky-300">
                      {evt.total_participants}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/admin/registrations?eventId=${evt.id}`}
                        className="text-[11px] font-semibold text-sky-400 hover:underline"
                      >
                        Filter &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Stall Inventory Allocation (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/20 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-400" />
              <span>Live Stall Inventory</span>
            </h3>
            <Link
              href="/admin/stalls"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              Edit Capacity <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {metrics.stallInventorySummary.map((stall) => {
              const bookedPercent = stall.total_stalls > 0
                ? Math.round((stall.booked_count / stall.total_stalls) * 100)
                : 0;

              return (
                <div key={stall.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{stall.name}</span>
                    <span className="font-mono text-emerald-300 font-bold">₹{stall.price}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        bookedPercent > 80 ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${bookedPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Booked: <strong className="text-white">{stall.booked_count}</strong></span>
                    <span>Remaining: <strong className="text-emerald-400">{stall.available_stalls}</strong></span>
                    <span>Total: {stall.total_stalls}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* AUDIT LOG PREVIEW */}
      <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/20 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          <span>Recent Activity &amp; Audit Trail</span>
        </h3>

        <div className="divide-y divide-slate-800/80">
          {auditLogs.slice(0, 8).map((log) => (
            <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 text-sky-300 border border-slate-700">
                  {log.action}
                </span>
                <span className="text-white font-medium">{log.actor}</span>
                <span className="text-slate-400 text-[11px]">{log.details || log.target_id}</span>
              </div>
              <span className="text-slate-500 text-[10px]">
                {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
