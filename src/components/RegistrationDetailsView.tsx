'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Printer,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  Building,
  Users,
  Trophy,
  Store,
  ArrowRight,
  Search,
  AlertCircle,
  Sparkles,
  ArrowLeft
} from 'lucide-react';

interface EventRegistrationView {
  id: string;
  event_id: string;
  college_name: string;
  college_location: string;
  team_name?: string;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  participant_count: number;
  total_fee: number | string;
  payment_status: string;
  registration_status?: string;
  transaction_id?: string;
  created_at: string;
  event?: {
    title: string;
    category: string;
  };
  participants?: Array<{
    id: string;
    full_name: string;
    roll_number: string;
    department: string;
    year_of_study: string;
    section: string;
    participant_order: number;
  }>;
}

interface StallBookingView {
  id: string;
  option_id: string;
  option_name?: string;
  stall_category: string;
  applicant_type: string;
  entity_name: string;
  college_name?: string;
  department_class?: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  products_services: string;
  business_details?: string;
  stalls_requested: number | string;
  has_electricity: number;
  total_amount: number | string;
  payment_status?: string;
  status: string;
  transaction_id?: string;
  created_at: string;
}

interface RegistrationDetailsViewProps {
  referenceId: string;
  source?: 'lookup' | 'confirmation';
}

export default function RegistrationDetailsView({
  referenceId,
  source = 'lookup'
}: RegistrationDetailsViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [eventReg, setEventReg] = useState<EventRegistrationView | null>(null);
  const [stallBooking, setStallBooking] = useState<StallBookingView | null>(null);

  useEffect(() => {
    if (!referenceId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const cleanId = referenceId.trim();
    const cleanUpper = cleanId.toUpperCase();
    const isStall =
      cleanUpper.startsWith('FIN-STL-') ||
      cleanUpper.startsWith('FX-STL-') ||
      cleanUpper.startsWith('STL-') ||
      cleanUpper.includes('-STL-') ||
      cleanUpper.includes('STL');
    const isEvent =
      !isStall &&
      (cleanUpper.startsWith('FIN-') ||
        cleanUpper.startsWith('FX-EVT-') ||
        cleanUpper.startsWith('EVT-') ||
        cleanUpper.includes('-EVT-'));

    if (isStall) {
      // 1. Fetch direct stall endpoint, with fallback to multi-field /api/lookup
      fetch(`/api/stalls/book?id=${encodeURIComponent(cleanId)}`)
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.booking) {
            return data.booking;
          }
          // Secondary fallback to lookup API
          const fallbackRes = await fetch('/api/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: cleanId })
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackData.stallBookings && fallbackData.stallBookings.length > 0) {
            return fallbackData.stallBookings[0];
          }
          throw new Error('Registration ID not found');
        })
        .then(async (booking) => {
          if (!isMounted) return;
          setStallBooking(booking);

          const verifyPayload = `FINXYORA-STALL-VERIFIED:${cleanId}:${booking.status}:${booking.contact_email}`;
          const qr = await QRCode.toDataURL(verifyPayload, {
            width: 200,
            margin: 1,
            color: { dark: '#07152f', light: '#ffffff' }
          });
          if (isMounted) setQrDataUrl(qr);

          try {
            confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
          } catch {
            // ignore confetti
          }
        })
        .catch((err) => {
          if (isMounted) setError(err.message || 'Lookup failed');
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else if (isEvent) {
      // 2. Fetch direct event endpoint, with fallback to multi-field /api/lookup
      fetch(`/api/registrations?id=${encodeURIComponent(cleanId)}`)
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.registration) {
            return data.registration;
          }
          // Secondary fallback to lookup API
          const fallbackRes = await fetch('/api/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: cleanId })
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackData.eventRegistrations && fallbackData.eventRegistrations.length > 0) {
            return fallbackData.eventRegistrations[0];
          }
          throw new Error('Registration ID not found');
        })
        .then(async (registration) => {
          if (!isMounted) return;
          setEventReg(registration);

          // Generate QR code safely
          const verifyPayload = `FINXYORA-VERIFIED:${cleanId}:${registration.payment_status}:${registration.leader_email}`;
          const qr = await QRCode.toDataURL(verifyPayload, {
            width: 200,
            margin: 1,
            color: { dark: '#07152f', light: '#ffffff' }
          });
          if (isMounted) setQrDataUrl(qr);

          try {
            confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
          } catch {
            // ignore confetti error
          }
        })
        .catch((err) => {
          if (isMounted) setError(err.message || 'Lookup failed');
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      // 3. General multi-table SQL search fallback
      fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleanId })
      })
        .then(async (res) => {
          const data = await res.json();
          if (!isMounted) return;
          if (!res.ok) throw new Error(data.error || 'Record not found');

          if (data.stallBookings && data.stallBookings.length > 0) {
            const stl = data.stallBookings[0];
            setStallBooking(stl);
            const qr = await QRCode.toDataURL(
              `FINXYORA-STALL-VERIFIED:${cleanId}:${stl.status}:${stl.contact_email}`,
              { width: 200, margin: 1, color: { dark: '#07152f', light: '#ffffff' } }
            );
            if (isMounted) setQrDataUrl(qr);
          } else if (data.eventRegistrations && data.eventRegistrations.length > 0) {
            const reg = data.eventRegistrations[0];
            setEventReg(reg);
            const qr = await QRCode.toDataURL(
              `FINXYORA-VERIFIED:${cleanId}:${reg.payment_status}:${reg.leader_email}`,
              { width: 200, margin: 1, color: { dark: '#07152f', light: '#ffffff' } }
            );
            if (isMounted) setQrDataUrl(qr);
          } else {
            throw new Error('Registration ID not found');
          }
        })
        .catch((err) => {
          if (isMounted) setError(err.message || 'Lookup failed');
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [referenceId]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-16 px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full animate-spin shadow-lg shadow-sky-500/20" />
          <p className="text-sm text-white font-semibold tracking-wide">
            Retrieving Registration Details...
          </p>
          <p className="text-xs text-slate-400 font-mono">
            Connecting to Central SQL Database for <span className="text-sky-300 font-bold">{referenceId}</span>
          </p>
        </div>
      </div>
    );
  }

  // 2. Error State (Complies strictly with Requirements 8 & 10)
  if (error || (!eventReg && !stallBooking)) {
    const errorString = (error || '').toLowerCase();
    const isNetworkOrServerError =
      errorString.includes('network') ||
      errorString.includes('failed to fetch') ||
      errorString.includes('500') ||
      errorString.includes('server error') ||
      errorString.includes('temporarily');

    return (
      <div className="max-w-xl mx-auto my-16 p-8 sm:p-10 rounded-3xl glass-panel text-center space-y-5 border border-sky-500/30 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Registration Details
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            {isNetworkOrServerError
              ? 'Unable to retrieve registration details right now. Please try again later.'
              : 'Registration ID not found. Please check the ID and try again.'}
          </p>
          {referenceId && (
            <p className="text-[11px] font-mono text-slate-400 pt-1">
              Queried ID: <strong className="text-sky-300">{referenceId}</strong>
            </p>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/lookup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all"
          >
            <Search className="w-4 h-4" />
            <span>Try Another Search</span>
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl glass-card text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Homepage</span>
          </Link>
        </div>
      </div>
    );
  }

  const isEvent = !!eventReg;
  const isVerifiedOrPaid = isEvent
    ? eventReg?.payment_status === 'paid' || eventReg?.payment_status === 'verified'
    : stallBooking?.status === 'paid' || stallBooking?.status === 'approved';
  const isSubmitted = isEvent
    ? eventReg?.payment_status === 'submitted'
    : stallBooking?.status === 'submitted' || stallBooking?.payment_status === 'submitted';

  const numericFee = isEvent
    ? Number(eventReg?.total_fee || 0)
    : Number(stallBooking?.total_amount || 0);

  return (
    <div className="py-10 md:py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      
      {/* Top Banner Notice & Actions (Hidden on print) */}
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl glass-card border border-sky-500/30 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              {source === 'lookup' ? 'Registration Record Verified' : 'Official Confirmation Pass'}
            </h4>
            <p className="text-xs text-slate-300">
              Retrieved directly from the central FINXYORA database. You can save or print this official badge.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
          <Link
            href="/lookup"
            className="px-4 py-2.5 rounded-xl text-xs font-semibold glass-card text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 flex items-center gap-1.5 transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Another</span>
          </Link>

          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20 flex items-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE RECEIPT / DETAILS CARD */}
      <div className="relative rounded-3xl glass-panel p-8 sm:p-12 border border-sky-500/30 shadow-2xl overflow-hidden print:border-none print:shadow-none print:p-0">
        
        {/* Decorative Top Edge Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-sky-400 to-indigo-500" />

        {/* Receipt Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-slate-800 pb-8">
          <div>
            <span className="text-[11px] font-mono tracking-widest uppercase text-sky-400 font-bold block mb-1">
              DEPARTMENT OF COMMERCE &bull; FINTECH ASSOCIATION
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              FINXYORA 2026
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Official Festival Participation &amp; Entry Pass
            </p>
          </div>

          <div className="flex flex-col sm:items-end">
            <span className="text-xs text-slate-400 font-medium">Registration ID:</span>
            <span className="text-xl sm:text-2xl font-mono font-black text-sky-300 tracking-wider">
              {referenceId}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mt-2 ${
              isVerifiedOrPaid
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : isSubmitted
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isVerifiedOrPaid
                ? 'PAYMENT VERIFIED & CONFIRMED'
                : isSubmitted
                ? 'PAYMENT SUBMITTED (VERIFICATION PENDING)'
                : 'PAYMENT PENDING'}
            </span>
          </div>
        </div>

        {/* Middle Grid: QR Code & Main Pass Data */}
        <div className="py-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center border-b border-slate-800">
          
          {/* QR Code Column (4 cols) */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-sky-500/20 text-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Verification QR Code" className="w-40 h-40 rounded-xl bg-white p-2 shadow-lg" />
            ) : (
              <div className="w-40 h-40 bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                Generating QR...
              </div>
            )}
            <span className="text-[10px] text-slate-400 mt-3 font-mono">
              Scan at Venue Security Desk
            </span>
          </div>

          {/* Details Column (8 cols) */}
          <div className="md:col-span-8 space-y-4 text-xs">
            {isEvent ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block font-medium">Registered Competition</span>
                    <span className="text-base font-bold text-white">{eventReg?.event?.title || eventReg?.event_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Team Name</span>
                    <span className="text-base font-bold text-sky-300">{eventReg?.team_name || 'Solo Participant'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">College / University</span>
                    <span className="text-sm font-semibold text-white">{eventReg?.college_name}</span>
                    <span className="text-[11px] text-slate-400 block">{eventReg?.college_location}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Primary Contact / Leader</span>
                    <span className="text-sm font-semibold text-white">{eventReg?.leader_name}</span>
                    <span className="text-[11px] text-slate-400 block">{eventReg?.leader_phone} &bull; {eventReg?.leader_email}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Total Delegates Authorized:</span>
                  <span className="text-sm font-bold text-white">{Number(eventReg?.participant_count || 1)} Registered Participant(s)</span>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block font-medium">Stall Package</span>
                    <span className="text-base font-bold text-white">{stallBooking?.option_name || stallBooking?.stall_category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Stall / Business Name</span>
                    <span className="text-base font-bold text-sky-300">{stallBooking?.entity_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Exhibitor Classification</span>
                    <span className="text-sm font-semibold text-white">
                      {stallBooking?.applicant_type === 'student' ? `Student: ${stallBooking?.college_name}` : 'Commercial Outside Brand'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Contact Person</span>
                    <span className="text-sm font-semibold text-white">{stallBooking?.contact_name}</span>
                    <span className="text-[11px] text-slate-400 block">{stallBooking?.contact_phone} &bull; {stallBooking?.contact_email}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Stalls Allocated:</span>
                  <span className="text-sm font-bold text-white">
                    {Number(stallBooking?.stalls_requested || 1)} Stall(s) &bull; {stallBooking?.has_electricity ? 'Power 15A/30A Included' : 'Standard Dry'}
                  </span>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Participant List (for Event Registrations) */}
        {isEvent && eventReg?.participants && eventReg.participants.length > 0 && (
          <div className="py-8 border-b border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              Verified Participant Roster
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-2">Pass #</th>
                    <th className="pb-2">Full Legal Name</th>
                    <th className="pb-2">Roll / Reg Number</th>
                    <th className="pb-2">Department</th>
                    <th className="pb-2">Year &amp; Section</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {eventReg.participants.map((p, idx) => (
                    <tr key={p.id} className="text-slate-300">
                      <td className="py-2.5 font-mono text-sky-400 font-bold">PASS-0{idx + 1}</td>
                      <td className="py-2.5 font-bold text-white">{p.full_name}</td>
                      <td className="py-2.5 font-mono">{p.roll_number}</td>
                      <td className="py-2.5">{p.department}</td>
                      <td className="py-2.5">{p.year_of_study} (Sec {p.section})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Registered Members & Exhibitors List (for Stall Bookings) */}
        {!isEvent && stallBooking && (
          <div className="py-8 border-b border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-400" />
              Registered Stall Exhibitor &amp; Member Details
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-2">Badge #</th>
                    <th className="pb-2">Registered Representative / Lead</th>
                    <th className="pb-2">Affiliation / Entity</th>
                    <th className="pb-2">Department / Class</th>
                    <th className="pb-2">Contact Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr className="text-slate-300">
                    <td className="py-3 font-mono text-emerald-400 font-bold">EXHIBITOR-01</td>
                    <td className="py-3 font-bold text-white">{stallBooking.contact_name}</td>
                    <td className="py-3">
                      <div className="font-semibold text-white">{stallBooking.entity_name}</div>
                      <div className="text-[11px] text-slate-400">{stallBooking.college_name || 'Autonomous Institution / Commercial'}</div>
                    </td>
                    <td className="py-3">{stallBooking.department_class || 'Registered Commercial Vendor'}</td>
                    <td className="py-3 font-mono text-[11px]">
                      <div>{stallBooking.contact_phone}</div>
                      <div className="text-slate-400">{stallBooking.contact_email}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={`grid grid-cols-1 ${stallBooking.business_details ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 pt-2`}>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Products &amp; Commercial Services</span>
                <span className="text-xs text-white font-medium block">{stallBooking.products_services}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Stall Space Specifications</span>
                <span className="text-xs text-emerald-300 font-medium block">
                  {Number(stallBooking.stalls_requested || 1)} Allocated Unit(s) &bull; {stallBooking.has_electricity ? 'Dedicated 15A/30A Electrical Power Provided' : 'Standard Dry Layout'}
                </span>
              </div>
              {stallBooking.business_details && (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Industry &amp; Entity Profile</span>
                  <span className="text-xs text-sky-300 font-medium block">{stallBooking.business_details}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Financial Settlement Breakdown */}
        <div className="py-8 border-b border-slate-800 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              Payment Verification &amp; Registration Record
            </span>
            <span className="text-[11px] text-slate-400">
              Recorded: {new Date(isEvent ? eventReg!.created_at : stallBooking!.created_at).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Registration ID</span>
              <span className="text-xs font-mono font-bold text-sky-300">{referenceId}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Competition / Item</span>
              <span className="text-xs font-bold text-white truncate block">
                {isEvent ? eventReg?.event?.title || eventReg?.event_id : stallBooking?.option_name || stallBooking?.stall_category}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Participant Count</span>
              <span className="text-xs font-mono font-bold text-white">
                {isEvent ? `${Number(eventReg?.participant_count || 1)} Person(s)` : `${Number(stallBooking?.stalls_requested || 1)} Stall(s)`}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Amount Paid</span>
              <span className="text-base font-mono font-black text-emerald-400">
                ₹{numericFee.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Transaction / Verification ID</span>
              <span className="text-xs font-mono font-bold text-amber-300">
                {isEvent ? eventReg?.transaction_id || 'Recorded On Submission' : stallBooking?.transaction_id || 'Recorded On Submission'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Payment Status</span>
              <span className={`text-xs font-bold uppercase ${
                isVerifiedOrPaid ? 'text-emerald-400' : 'text-sky-300'
              }`}>
                {isEvent ? eventReg?.payment_status : stallBooking?.status}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Registration Status</span>
              <span className="text-xs font-bold text-white uppercase">
                {isEvent ? (eventReg?.registration_status || 'REGISTERED') : (stallBooking?.status || 'SUBMITTED')}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Instructions */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Central FINXYORA SQL Database Verification Verified</span>
          </div>
          <div>
            <span>Present printed pass or digital QR code at event entrance</span>
          </div>
        </div>

      </div>

      {/* Helpful Links Below (Hidden on print) */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs no-print">
        <Link
          href="/lookup"
          className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Lookup Another Registration</span>
        </Link>
        <span className="text-slate-600">&bull;</span>
        <Link
          href="/events"
          className="text-slate-300 hover:text-white flex items-center gap-1"
        >
          <Trophy className="w-3.5 h-3.5 text-sky-400" />
          <span>Explore All Flagship Events</span>
        </Link>
        <span className="text-slate-600">&bull;</span>
        <Link
          href="/stalls"
          className="text-slate-300 hover:text-white flex items-center gap-1"
        >
          <Store className="w-3.5 h-3.5 text-emerald-400" />
          <span>Book Festival Stalls</span>
        </Link>
      </div>

    </div>
  );
}
