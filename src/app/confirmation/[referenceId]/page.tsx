'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Printer,
  Download,
  Share2,
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
  AlertCircle
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
  total_fee: number;
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
  stalls_requested: number;
  has_electricity: number;
  total_amount: number;
  payment_status?: string;
  status: string;
  transaction_id?: string;
  created_at: string;
}

export default function ConfirmationReceiptPage() {
  const params = useParams();
  const referenceId = params?.referenceId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [eventReg, setEventReg] = useState<EventRegistrationView | null>(null);
  const [stallBooking, setStallBooking] = useState<StallBookingView | null>(null);

  useEffect(() => {
    if (!referenceId) return;

    setLoading(true);
    // Trigger celebratory confetti on initial load
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Ignore if confetti fails
    }

    // Determine type by reference prefix
    const isStall = referenceId.startsWith('FIN-STL-') || referenceId.startsWith('FX-STL-');
    const isEvent = referenceId.startsWith('FIN-') || referenceId.startsWith('FX-EVT-');

    const fetchUrl = isStall
      ? `/api/stalls/book?id=${referenceId}`
      : isEvent
      ? `/api/registrations?id=${referenceId}`
      : `/api/lookup`;

    if (isEvent) {
      fetch(fetchUrl)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Registration record not found');
          setEventReg(data.registration);

          // Generate QR code
          const verifyPayload = `FINXYORA-VERIFIED:${referenceId}:${data.registration.payment_status}:${data.registration.leader_email}`;
          const qr = await QRCode.toDataURL(verifyPayload, { width: 200, margin: 1, color: { dark: '#07152f', light: '#ffffff' } });
          setQrDataUrl(qr);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else if (isStall) {
      fetch(fetchUrl)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Stall booking record not found');
          setStallBooking(data.booking);

          const verifyPayload = `FINXYORA-STALL-VERIFIED:${referenceId}:${data.booking.status}:${data.booking.contact_email}`;
          const qr = await QRCode.toDataURL(verifyPayload, { width: 200, margin: 1, color: { dark: '#07152f', light: '#ffffff' } });
          setQrDataUrl(qr);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      // General lookup fallback
      fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: referenceId })
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Record not found');
          if (data.eventRegistrations && data.eventRegistrations.length > 0) {
            setEventReg(data.eventRegistrations[0]);
          } else if (data.stallBookings && data.stallBookings.length > 0) {
            setStallBooking(data.stallBookings[0]);
          } else {
            throw new Error('Reference record not found.');
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [referenceId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-mono">LOADING CONFIRMATION RECEIPT...</p>
        </div>
      </div>
    );
  }

  if (error || (!eventReg && !stallBooking)) {
    return (
      <div className="max-w-xl mx-auto my-20 p-8 rounded-3xl glass-panel text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Record Not Found</h2>
        <p className="text-xs text-slate-300">{error || 'Unable to retrieve receipt for this reference.'}</p>
        <Link
          href="/lookup"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-500 text-white font-semibold text-xs"
        >
          <Search className="w-4 h-4" /> Go to Lookup Portal
        </Link>
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

  return (
    <div className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      
      {/* Top Banner Notice (Hidden on print) */}
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl glass-card border border-sky-500/30 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Official Confirmation Pass</h4>
            <p className="text-xs text-slate-300">
              Your registration is secured in the central FINXYORA database. Please save or print this badge.
            </p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20 flex items-center gap-2 transition-all shrink-0"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save PDF</span>
        </button>
      </div>

      {/* PRINTABLE RECEIPT CARD */}
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
            <span className="text-xs text-slate-400 font-medium">Unique Reference ID:</span>
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
                  <span className="text-sm font-bold text-white">{eventReg?.participant_count} Registered Participant(s)</span>
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
                  <span className="text-sm font-bold text-white">{stallBooking?.stalls_requested} Stall(s) &bull; {stallBooking?.has_electricity ? 'Power 15A/30A Included' : 'Standard Dry'}</span>
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

        {/* Financial Settlement Breakdown (All 7 Parameters Displayed) */}
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
                {isEvent ? `${eventReg?.participant_count} Person(s)` : `${stallBooking?.stalls_requested} Stall(s)`}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Amount Paid</span>
              <span className="text-base font-mono font-black text-emerald-400">
                ₹{isEvent ? eventReg?.total_fee.toFixed(2) : stallBooking?.total_amount.toFixed(2)}
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

        {/* Important Venue Instructions */}
        <div className="pt-8 space-y-2 text-[11px] text-slate-400">
          <p className="font-bold text-white text-xs">Important Check-In Instructions:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Physical College Photo ID card is strictly mandatory for every participant at security entry.</li>
            <li>Present this digital or printed pass with the QR code at the registration desk by 08:30 AM on Day 1.</li>
            <li>Registration fees are strictly non-refundable and non-transferable under festival policy.</li>
          </ul>
        </div>

      </div>

      {/* Bottom Navigation CTAs (No print) */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
        <Link
          href="/events"
          className="text-xs font-semibold text-slate-400 hover:text-sky-300 flex items-center gap-1.5 transition-colors"
        >
          <Trophy className="w-4 h-4" /> Register for Another Competition
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/lookup"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Lookup Other Passes
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-500 text-white hover:bg-sky-400 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>

    </div>
  );
}
