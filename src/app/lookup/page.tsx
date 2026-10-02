'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Printer,
  CreditCard,
  Building,
  Users,
  AlertCircle,
  ShieldCheck,
  Store,
  Trophy
} from 'lucide-react';
import PaymentModal from '@/components/PaymentModal';

interface LookupEventReg {
  id: string;
  event_id: string;
  college_name: string;
  team_name?: string;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  participant_count: number;
  total_fee: number;
  payment_status: string;
  created_at: string;
  event?: { title: string };
}

interface LookupStallBooking {
  id: string;
  option_id: string;
  option_name?: string;
  stall_category: string;
  applicant_type: string;
  entity_name: string;
  college_name?: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  stalls_requested: number;
  total_amount: number;
  status: string;
  created_at: string;
}

export default function LookupPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventResults, setEventResults] = useState<LookupEventReg[]>([]);
  const [stallResults, setStallResults] = useState<LookupStallBooking[]>([]);

  // Payment Modal Trigger for pending registrations
  const [pendingItem, setPendingItem] = useState<{
    referenceType: 'event' | 'stall';
    referenceId: string;
    amount: number;
    title: string;
    email: string;
    phone: string;
  } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed');

      setEventResults(data.eventRegistrations || []);
      setStallResults(data.stallBookings || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
      setEventResults([]);
      setStallResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border border-sky-400/30 text-sky-300 text-xs sm:text-sm font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Central Verification &amp; Pass Retrieval</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
          Registration <span className="gradient-text">Lookup Portal</span>
        </h1>

        <p className="text-sm text-slate-300 leading-relaxed">
          Verify registration status, check payment settlement records, or retrieve and reprint your official FINXYORA festival entry pass.
        </p>
      </div>

      {/* Search Input Card */}
      <div className="max-w-2xl mx-auto rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/30 mb-12 shadow-2xl">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Enter Registration ID, Contact Email, or Mobile Number
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. FX-EVT-XXXXXX, leader@college.edu, or 9876543210"
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl glass-input text-sm text-white placeholder-slate-500"
              />
              <Search className="w-5 h-5 text-sky-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Querying Database...
              </span>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Search Records</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* SEARCH RESULTS */}
      {hasSearched && (
        <div className="space-y-8 animate-fadeIn">
          
          {/* Event Registrations Results */}
          {eventResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-sky-400" />
                <span>Event Registrations ({eventResults.length})</span>
              </h3>

              <div className="space-y-4">
                {eventResults.map((reg) => {
                  const isPaid = reg.payment_status === 'paid';
                  return (
                    <div
                      key={reg.id}
                      className="rounded-2xl glass-card p-6 border border-sky-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold text-sky-300">
                            {reg.id}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isPaid
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {isPaid ? 'CONFIRMED & PAID' : 'PAYMENT PENDING'}
                          </span>
                        </div>

                        <h4 className="text-lg font-bold text-white">
                          {reg.event?.title || reg.event_id}
                        </h4>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                          <span>Team: <strong className="text-white">{reg.team_name || 'Solo'}</strong></span>
                          <span>&bull;</span>
                          <span>College: <strong className="text-white">{reg.college_name}</strong></span>
                          <span>&bull;</span>
                          <span>Leader: <strong className="text-white">{reg.leader_name}</strong></span>
                          <span>&bull;</span>
                          <span>Participants: <strong className="text-white">{reg.participant_count}</strong></span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                        {isPaid ? (
                          <Link
                            href={`/confirmation/${reg.id}`}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20 flex items-center gap-2 transition-all"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>View &amp; Print Pass</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingItem({
                                referenceType: 'event',
                                referenceId: reg.id,
                                amount: reg.total_fee,
                                title: `${reg.event?.title || reg.event_id} Registration`,
                                email: reg.leader_email,
                                phone: reg.leader_phone
                              })
                            }
                            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Complete ₹{reg.total_fee} Payment</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stall Bookings Results */}
          {stallResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-400" />
                <span>Festival Stall Bookings ({stallResults.length})</span>
              </h3>

              <div className="space-y-4">
                {stallResults.map((stl) => {
                  const isPaid = stl.status === 'paid';
                  return (
                    <div
                      key={stl.id}
                      className="rounded-2xl glass-card p-6 border border-emerald-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold text-emerald-300">
                            {stl.id}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isPaid
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {isPaid ? 'STALL RESERVED & PAID' : 'PAYMENT PENDING'}
                          </span>
                        </div>

                        <h4 className="text-lg font-bold text-white">
                          {stl.entity_name} &bull; <span className="text-sm text-slate-300 font-normal">{stl.option_name || stl.stall_category}</span>
                        </h4>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                          <span>Representative: <strong className="text-white">{stl.contact_name}</strong></span>
                          <span>&bull;</span>
                          <span>Stalls: <strong className="text-white">{stl.stalls_requested}</strong></span>
                          <span>&bull;</span>
                          <span>Total Amount: <strong className="text-white font-mono">₹{stl.total_amount}</strong></span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                        {isPaid ? (
                          <Link
                            href={`/confirmation/${stl.id}`}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>View &amp; Print Pass</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingItem({
                                referenceType: 'stall',
                                referenceId: stl.id,
                                amount: stl.total_amount,
                                title: `Stall Reservation (${stl.entity_name})`,
                                email: stl.contact_email,
                                phone: stl.contact_phone
                              })
                            }
                            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Complete ₹{stl.total_amount} Payment</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Results Fallback */}
          {eventResults.length === 0 && stallResults.length === 0 && (
            <div className="p-10 rounded-3xl glass-panel text-center space-y-4 max-w-lg mx-auto">
              <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">No Matching Records Found</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We could not find any active event registration or stall booking matching &ldquo;{query}&rdquo;. Please verify the spelling or check the phone/email provided during registration.
              </p>
              <div className="pt-2">
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 text-white text-xs font-semibold"
                >
                  Register for an Event
                </Link>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Payment Modal for Pending items */}
      {pendingItem && (
        <PaymentModal
          isOpen={!!pendingItem}
          onClose={() => setPendingItem(null)}
          referenceType={pendingItem.referenceType}
          initialReferenceId={pendingItem.referenceId}
          amount={pendingItem.amount}
          itemTitle={pendingItem.title}
          payerEmail={pendingItem.email}
          payerPhone={pendingItem.phone}
          onPaymentSuccess={(receiptUrl) => {
            setPendingItem(null);
            window.location.href = receiptUrl;
          }}
        />
      )}

    </div>
  );
}
