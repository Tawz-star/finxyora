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
  ArrowRight,
  ShieldCheck,
  Activity,
  DollarSign,
  RotateCcw
} from 'lucide-react';

interface MetricsData {
  totalEventRegs: number;
  confirmedEventRegs: number;
  totalConfirmedParticipants: number;
  totalStallBookings: number;
  studentStallBookings: number;
  vendorStallBookings: number;
  verifiedCollections: number;
  refundedCollections: number;
  pendingPayments: number;
  successfulPayments: number;
  failedPayments: number;
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
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/dashboard')
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
  }, [router]);

  if (loading) {
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

  const netCollections = metrics.verifiedCollections - metrics.refundedCollections;

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Festival Control Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time inter-collegiate registrations, financial collections, and inventory ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/events"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-colors"
          >
            Manage Events
          </Link>
          <Link
            href="/admin/stalls"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Manage Stalls
          </Link>
        </div>
      </div>

      {/* TOP 4 KEY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Registrations */}
        <div className="p-6 rounded-2xl glass-card border border-sky-500/20 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
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
        </div>

        {/* Net Collections */}
        <div className="p-6 rounded-2xl glass-card border border-sky-500/20 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Verified Revenue</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-300 font-mono">
            ₹{netCollections.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Gross: ₹{metrics.verifiedCollections}</span>
            {metrics.refundedCollections > 0 && (
              <span className="text-rose-400 font-semibold">Refunds: ₹{metrics.refundedCollections}</span>
            )}
          </div>
        </div>

        {/* Stall Bookings */}
        <div className="p-6 rounded-2xl glass-card border border-sky-500/20 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
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
        </div>

        {/* Payments Settlement Status */}
        <div className="p-6 rounded-2xl glass-card border border-sky-500/20 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Settlement Ledger</span>
            <CreditCard className="w-5 h-5 text-sky-400" />
          </div>
          <div className="text-3xl font-black text-sky-300 font-mono">
            {metrics.successfulPayments}
            <span className="text-xs text-slate-400 font-normal ml-2">Successful</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span className="text-amber-300 font-semibold">Pending: {metrics.pendingPayments}</span>
            <span className="text-rose-400 font-semibold">Declined: {metrics.failedPayments}</span>
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
