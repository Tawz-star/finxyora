'use client';

import React, { useState, useEffect } from 'react';
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
  Clock,
  RotateCcw,
  Building,
  RefreshCw,
  Trophy
} from 'lucide-react';
import { EventRegistrationRecord } from '@/lib/db';

export default function AdminRegistrationsPage() {
  const [registrations, setRegistrations] = useState<EventRegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRegistrations = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (eventFilter) params.append('eventId', eventFilter);
    if (search) params.append('search', search);

    fetch(`/api/admin/registrations?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch registrations');
        setRegistrations(data.registrations || []);
      })
      .catch(() => setRegistrations([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRegistrations();
  }, [statusFilter, eventFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRegistrations();
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
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
            Browse, inspect attendee rosters, verify payments, and export delegate records.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
      <div className="rounded-2xl glass-card p-4 border border-sky-500/20 flex flex-wrap items-center justify-between gap-4">
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
            <option value="star-quas">Star Quas (Alias)</option>
            <option value="b-quiz">B Quiz</option>
            <option value="football-auction">Football Auction</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl glass-input text-xs bg-slate-900 text-slate-300"
          >
            <option value="">All Payment Statuses</option>
            <option value="paid">Confirmed (Paid)</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
          </select>

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leader / college / ID..."
              className="pl-8 pr-3 py-2 rounded-xl glass-input text-xs w-60 text-white placeholder-slate-500"
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
          Showing <strong>{registrations.length}</strong> record{registrations.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Registrations List */}
      <div className="rounded-3xl glass-panel p-6 border border-sky-500/20 shadow-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-mono">
            SEARCHING REGISTRATION DATABASE...
          </div>
        ) : registrations.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No registrations matching the selected filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {registrations.map((reg) => {
              const isExpanded = expandedId === reg.id;
              const isPaid = reg.payment_status === 'paid';

              return (
                <div key={reg.id} className="py-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Left Details */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-sky-400">
                          {reg.id}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isPaid
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {reg.payment_status.toUpperCase()}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(reg.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">
                          {reg.event?.title || reg.event_id}
                        </h3>
                        <span className="text-xs text-sky-300 font-medium">
                          &bull; {reg.team_name || 'Solo'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400">
                        {reg.college_name} ({reg.college_location}) &bull; Contact: <strong className="text-white">{reg.leader_name}</strong> ({reg.leader_phone})
                      </p>
                    </div>

                    {/* Right Fee & Actions */}
                    <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                      <div className="text-right mr-2">
                        <span className="text-base font-black text-white font-mono">
                          ₹{reg.total_fee}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {reg.participant_count} Participant(s)
                        </span>
                      </div>

                      <button
                        onClick={() => toggleExpand(reg.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center gap-1 border border-slate-700 transition-colors"
                      >
                        <span>{isExpanded ? 'Hide Members' : 'Inspect Roster'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <Link
                        href={`/confirmation/${reg.id}`}
                        target="_blank"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/30 flex items-center gap-1 transition-all"
                        title="View printable ticket pass"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Pass</span>
                      </Link>
                    </div>

                  </div>

                  {/* EXPANDABLE PARTICIPANT ROSTER */}
                  {isExpanded && (
                    <div className="mt-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 animate-fadeIn space-y-3">
                      <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                        Roster Participants for {reg.id}
                      </h4>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="pb-1.5">#</th>
                              <th className="pb-1.5">Student Name</th>
                              <th className="pb-1.5">Roll / Reg Number</th>
                              <th className="pb-1.5">Department</th>
                              <th className="pb-1.5">Year &amp; Section</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {(reg.participants || []).map((p, idx) => (
                              <tr key={p.id} className="text-slate-300">
                                <td className="py-2 text-slate-500 font-mono">{idx + 1}</td>
                                <td className="py-2 font-bold text-white">{p.full_name}</td>
                                <td className="py-2 font-mono text-sky-300">{p.roll_number}</td>
                                <td className="py-2">{p.department}</td>
                                <td className="py-2">{p.year_of_study} (Sec {p.section})</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
