'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy,
  Users,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  Shield,
  AlertCircle,
  Cpu,
  Briefcase,
  Sparkles,
  HelpCircle,
  Building,
  User,
  CreditCard,
  FileCheck
} from 'lucide-react';
import PaymentModal from '@/components/PaymentModal';
import { EventIcon } from '@/lib/event-icons';

interface ParticipantFormState {
  fullName: string;
  rollNumber: string;
  department: string;
  yearOfStudy: string;
  section: string;
}

interface EventData {
  id: string;
  title: string;
  category: string;
  description: string;
  rules: string;
  min_participants: number;
  max_participants: number;
  registration_fee: number;
  fee_type: 'per_team' | 'per_participant';
  is_open: number;
  deadline?: string;
}

export default function SingleEventPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Steps: 1 = Details & Participants, 2 = Review & Confirm
  const [step, setStep] = useState<1 | 2>(1);

  // Team & College Details
  const [collegeName, setCollegeName] = useState('');
  const [collegeLocation, setCollegeLocation] = useState('');
  const [teamName, setTeamName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [leaderPhone, setLeaderPhone] = useState('');

  // Dynamic participant count selection (for events like Corporate Walk [6-8] or Football Auction [2-3])
  const [selectedCount, setSelectedCount] = useState<number>(2);

  // Participants Form Array
  const [participants, setParticipants] = useState<ParticipantFormState[]>([]);

  // Submitting state & Error
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Payment Modal Trigger
  const [pendingRegistration, setPendingRegistration] = useState<{
    id: string;
    totalFee: number;
  } | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Fetch Event Details
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/events/${slug}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Event not found');
        setEvent(data.event);

        // Initialize participant count based on event rules
        const initialCount = data.event.min_participants;
        setSelectedCount(initialCount);

        // Pre-fill participants array
        const initialList: ParticipantFormState[] = Array.from({ length: initialCount }, () => ({
          fullName: '',
          rollNumber: '',
          department: '',
          yearOfStudy: 'Final Year',
          section: 'A'
        }));
        setParticipants(initialList);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  // Adjust participant forms when count changes (e.g. Corporate Walk selector between 6 and 8)
  const handleCountChange = (newCount: number) => {
    setSelectedCount(newCount);
    setParticipants((prev) => {
      if (newCount > prev.length) {
        const added: ParticipantFormState[] = Array.from(
          { length: newCount - prev.length },
          () => ({
            fullName: '',
            rollNumber: '',
            department: '',
            yearOfStudy: '3rd Year',
            section: 'A'
          })
        );
        return [...prev, ...added];
      } else {
        return prev.slice(0, newCount);
      }
    });
  };

  const handleParticipantChange = (index: number, field: keyof ParticipantFormState, val: string) => {
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  // Dynamic Participant-Based Payment Calculation: Total Amount = Number of Participants × ₹50
  const calculateTotalFee = (): number => {
    const feePerHead = event?.registration_fee || 50;
    return feePerHead * selectedCount;
  };

  // Step 1 Validation
  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!collegeName.trim() || !collegeLocation.trim() || !leaderName.trim() || !leaderEmail.trim() || !leaderPhone.trim()) {
      setFormError('Please fill in all team and college information fields.');
      return;
    }

    // Business Plan and all other events require team name
    if (!teamName.trim()) {
      setFormError('Please specify a Team Name.');
      return;
    }

    // Validate participant count
    if (event) {
      if (selectedCount < event.min_participants || selectedCount > event.max_participants) {
        setFormError(`Participant count must be between ${event.min_participants} and ${event.max_participants}.`);
        return;
      }
    }

    // Validate each participant
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.fullName.trim() || !p.rollNumber.trim() || !p.department.trim() || !p.yearOfStudy.trim() || !p.section.trim()) {
        setFormError(`Please complete all fields for Participant #${i + 1}.`);
        return;
      }
    }

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // State for client-side registration payload
  const [eventPayload, setEventPayload] = useState<{
    eventId: string;
    collegeName: string;
    collegeLocation: string;
    teamName?: string;
    leaderName: string;
    leaderEmail: string;
    leaderPhone: string;
    participants: ParticipantFormState[];
  } | null>(null);

  // Submit and launch unified client payment modal
  const handleFinalSubmit = () => {
    if (!event) return;
    setFormError(null);

    const payload = {
      eventId: event.id,
      collegeName,
      collegeLocation,
      teamName: teamName,
      leaderName,
      leaderEmail,
      leaderPhone,
      participants
    };

    setEventPayload(payload);
    setIsPaymentModalOpen(true);
  };


  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-mono tracking-wider">LOADING EVENT PORTAL...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-2xl mx-auto my-20 p-8 rounded-3xl glass-panel text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white">Event Portal Not Found</h2>
        <p className="text-sm text-slate-300">{error || 'The requested competition could not be located.'}</p>
        <Link
          href="/events"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-500 text-white font-semibold text-xs"
        >
          <ArrowLeft className="w-4 h-4" /> Back to All Events
        </Link>
      </div>
    );
  }

  const parsedRules: string[] = (() => {
    try {
      return JSON.parse(event.rules);
    } catch {
      return [event.rules];
    }
  })();

  const isStockWar = event.id === 'corporate-walk';
  const isFootballAuction = event.id === 'football-auction';

  return (
    <div className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Navigation Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 text-xs text-slate-400">
        <Link href="/events" className="hover:text-sky-300 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Events Catalog
        </Link>
        <span>/</span>
        <span className="text-sky-300 font-semibold">{event.title}</span>
      </div>

      {/* Header Banner */}
      <div className="relative rounded-3xl glass-panel p-8 sm:p-10 border border-sky-500/30 overflow-hidden mb-12 shadow-2xl">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-3xl">
            
            <div className="flex items-center gap-3">
              <EventIcon
                eventId={event.id}
                showContainer
                className="w-8 h-8"
                containerClassName="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-900/80 shadow-lg"
              />
              <div>
                <span className="text-xs uppercase font-bold tracking-widest text-sky-400">
                  {event.category}
                </span>
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                  {event.title}
                </h1>
              </div>
            </div>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {event.description}
            </p>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/30">
                <Users className="w-3.5 h-3.5" />
                {isStockWar
                  ? 'Team Size: Exactly 2 Participants'
                  : isFootballAuction
                  ? 'Team Size: 2 to 3 Participants'
                  : event.min_participants === event.max_participants
                  ? `Team Size: Exactly ${event.max_participants} Participants`
                  : `Team Size: ${event.min_participants} to ${event.max_participants} Participants`}
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <CreditCard className="w-3.5 h-3.5" />
                Registration Fee: ₹{event.registration_fee || 50} per person
              </span>

              {event.is_open ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  Registrations Open
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                  Registrations Closed
                </span>
              )}
            </div>

          </div>

          {/* Quick Summary Card */}
          <div className="lg:w-80 rounded-2xl bg-slate-900/80 border border-sky-500/20 p-6 space-y-4 shrink-0 shadow-lg">
            <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Registration Fee Summary
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Fee per Participant:</span>
                <span className="text-white font-semibold font-mono">₹{event.registration_fee || 50} / person</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Active Participants:</span>
                <span className="text-white font-semibold">{selectedCount} Member{selectedCount > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800">
                <span className="font-semibold text-slate-200">Total Registration Fee:</span>
                <span className="text-emerald-400 font-black font-mono text-base">₹{calculateTotalFee()}</span>
              </div>
            </div>
            <a
              href="#registration-form"
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-500/30"
            >
              Fill Registration Form <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

      </div>

      {/* Main Content Grid: Rules on Left, Form on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left Column: Rules & Format (4 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl glass-panel p-6 border border-sky-500/20 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-sky-400" />
              Official Rules &amp; Regulations
            </h3>

            <ul className="space-y-3">
              {parsedRules.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl glass-card p-6 border border-sky-500/20 text-xs text-slate-300 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2 text-sm">
              <Building className="w-4 h-4 text-sky-400" />
              Intra-Collegiate Terms
            </h4>
            <p className="leading-relaxed">
              &bull; Multiple teams from the same college are permitted to participate in this event.
            </p>
            <p className="leading-relaxed">
              &bull; One participant cannot register in multiple concurrent events scheduled at the same time slot.
            </p>
            <p className="leading-relaxed">
              &bull; The organizing committee and chief judges hold final authority on all evaluation scores.
            </p>
          </div>
        </div>

        {/* Right Column: Registration Form (7 cols) */}
        <div id="registration-form" className="lg:col-span-7">
          <div className="rounded-3xl glass-panel p-6 sm:p-10 border border-sky-500/30 shadow-2xl">
            
            {/* Form Step Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className={step === 1 ? 'text-sky-300' : 'text-slate-400'}>
                  1. Team &amp; Participant Information
                </span>
                <span className={step === 2 ? 'text-sky-300' : 'text-slate-400'}>
                  2. Review &amp; Payment
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-300"
                  style={{ width: step === 1 ? '50%' : '100%' }}
                />
              </div>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{formError}</p>
              </div>
            )}

            {/* STEP 1: FORM INPUTS */}
            {step === 1 && (
              <form onSubmit={handleProceedToReview} className="space-y-8">
                
                {/* Section A: College & Institution */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Building className="w-4 h-4 text-sky-400" />
                    College &amp; Primary Contact
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        College / Institution Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={collegeName}
                        onChange={(e) => setCollegeName(e.target.value)}
                        placeholder="e.g. Loyola College"
                        className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        College City / Location <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={collegeLocation}
                        onChange={(e) => setCollegeLocation(e.target.value)}
                        placeholder="e.g. Chennai, Tamil Nadu"
                        className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Team Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Alpha FinTech Squad"
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Team Leader Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={leaderName}
                        onChange={(e) => setLeaderName(e.target.value)}
                        placeholder="Full Name"
                        className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Leader Email Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={leaderEmail}
                        onChange={(e) => setLeaderEmail(e.target.value)}
                        placeholder="leader@college.edu"
                        className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Mobile Number (WhatsApp) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={leaderPhone}
                        onChange={(e) => setLeaderPhone(e.target.value)}
                        placeholder="10-digit Mobile"
                        className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Dynamic Participant Count Selector */}
                {event.min_participants !== event.max_participants ? (
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/50 via-slate-900 to-blue-950/40 border border-sky-500/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="block text-xs font-bold text-sky-300 uppercase tracking-wider">
                        Select Participant Count ({event.min_participants} to {event.max_participants} Members) <span className="text-rose-400">*</span>
                      </label>
                      <span className="text-xs font-extrabold font-mono text-emerald-400">
                        {selectedCount} participant{selectedCount > 1 ? 's' : ''} × ₹50 = ₹{calculateTotalFee()}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                       {isStockWar
                        ? 'Stock War requires exactly 2 members per team (₹50/person).'
                        : isFootballAuction
                        ? 'Football Auction allows 2 or 3 managers per franchise squad (₹50/person).'
                        : `Select between ${event.min_participants} and ${event.max_participants} members. The registration fee is ₹50 per participant.`}
                    </p>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      {Array.from(
                        { length: event.max_participants - event.min_participants + 1 },
                        (_, idx) => event.min_participants + idx
                      ).map((count) => {
                        const isSelected = selectedCount === count;
                        const subTotal = count * (event.registration_fee || 50);
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => handleCountChange(count)}
                            className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                              isSelected
                                ? 'bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/30 scale-[1.02]'
                                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-sky-500/50 hover:bg-slate-800'
                            }`}
                          >
                            <span>{count} Members</span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded font-extrabold ${
                                isSelected ? 'bg-black/35 text-white' : 'bg-slate-800 text-emerald-400'
                              }`}
                            >
                              ₹{subTotal}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-sky-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {event.min_participants === 1
                          ? 'Solo Participation (1 Candidate)'
                          : `Team Event (Strictly ${event.min_participants} Participants)`}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Fee rule: ₹{event.registration_fee || 50} per person &bull; Total: {event.min_participants} × ₹{event.registration_fee || 50} = ₹{event.min_participants * (event.registration_fee || 50)}
                      </span>
                    </div>
                    <span className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl text-xs font-black font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                      ₹{event.min_participants * (event.registration_fee || 50)} Total
                    </span>
                  </div>
                )}

                {/* Section C: Individual Participant Fields (Dynamically generated) */}
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4 text-sky-400" />
                      Participant Details ({participants.length} Member{participants.length > 1 ? 's' : ''})
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      All fields mandatory for festival ID badging
                    </span>
                  </h4>

                  <div className="space-y-5">
                    {participants.map((part, index) => (
                      <div
                        key={index}
                        className="p-5 rounded-2xl bg-slate-900/60 border border-sky-500/20 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                            Participant #{index + 1} {index === 0 && '(Team Leader)'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              Full Legal Name <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={part.fullName}
                              onChange={(e) => handleParticipantChange(index, 'fullName', e.target.value)}
                              placeholder="e.g. Rahul Sharma"
                              className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              College Roll No / Reg No <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={part.rollNumber}
                              onChange={(e) => handleParticipantChange(index, 'rollNumber', e.target.value)}
                              placeholder="e.g. 23COM1042"
                              className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              Department <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={part.department}
                              onChange={(e) => handleParticipantChange(index, 'department', e.target.value)}
                              placeholder="e.g. B.Com FinTech"
                              className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              Year of Study <span className="text-rose-400">*</span>
                            </label>
                            <select
                              value={part.yearOfStudy}
                              onChange={(e) => handleParticipantChange(index, 'yearOfStudy', e.target.value)}
                              className="w-full px-3 py-2 rounded-xl glass-input text-xs bg-slate-900"
                            >
                              <option value="1st Year">1st Year</option>
                              <option value="2nd Year">2nd Year</option>
                              <option value="3rd Year">3rd Year</option>
                              <option value="Final Year">Final Year</option>
                              <option value="Postgraduate">Postgraduate</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              Section <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={part.section}
                              onChange={(e) => handleParticipantChange(index, 'section', e.target.value)}
                              placeholder="e.g. A"
                              className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit to Review */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">
                      Calculated Fee ({selectedCount} participant{selectedCount > 1 ? 's' : ''} × ₹{event.registration_fee || 50})
                    </span>
                    <span className="text-2xl font-black text-emerald-400 font-mono">₹{calculateTotalFee()}</span>
                  </div>

                  <button
                    type="submit"
                    className="px-8 py-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:to-sky-300 text-white shadow-lg shadow-sky-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                  >
                    <span>Proceed to Review</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </form>
            )}

            {/* STEP 2: REVIEW SUMMARY BEFORE PAYMENT */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-200 flex items-start gap-2.5">
                  <FileCheck className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
                  <p>
                    Please inspect all details carefully. Once payment is authorized, your registration ID and event passes will be generated immediately.
                  </p>
                </div>

                {/* Team & College Summary */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
                  <h4 className="font-bold text-white uppercase tracking-wider text-xs border-b border-slate-800 pb-2">
                    Institution &amp; Team Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block">Competition:</span>
                      <span className="text-white font-semibold">{event.title}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">College:</span>
                      <span className="text-white font-semibold">{collegeName} ({collegeLocation})</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Team Name:</span>
                      <span className="text-white font-semibold">{teamName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Primary Contact:</span>
                      <span className="text-white font-semibold">{leaderName} ({leaderPhone})</span>
                    </div>
                  </div>
                </div>

                {/* Participants Summary List */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
                  <h4 className="font-bold text-white uppercase tracking-wider text-xs border-b border-slate-800 pb-2">
                    Registered Participants ({participants.length})
                  </h4>
                  <div className="space-y-2">
                    {participants.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
                        <div>
                          <span className="font-bold text-white">
                            #{idx + 1}: {p.fullName}
                          </span>
                          <span className="text-slate-400 ml-2">
                            ({p.rollNumber} &bull; {p.department} &bull; {p.yearOfStudy} Sec {p.section})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fee Breakdown Box */}
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-sky-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-200 block font-bold">Dynamic Registration Fee</span>
                    <span className="text-xs text-slate-400">
                      {participants.length} participant{participants.length > 1 ? 's' : ''} × ₹{event.registration_fee || 50} per person
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Total Due</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono">₹{calculateTotalFee()}</span>
                  </div>
                </div>

                {/* Actions: Edit vs Proceed to Pay */}
                <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                    className="px-6 py-3 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" /> Edit Details
                  </button>

                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={submitting}
                    className="px-8 py-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-xl shadow-sky-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating Reference...
                      </span>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>Proceed to Secure Payment</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>

      </div>

      {/* Payment Modal */}
      {eventPayload && event && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          referenceType="event"
          amount={calculateTotalFee()}
          itemTitle={`${event.title} Registration`}
          payerEmail={leaderEmail}
          payerPhone={leaderPhone}
          eventData={eventPayload}
          onPaymentSuccess={(receiptUrl) => {
            setIsPaymentModalOpen(false);
            router.push(receiptUrl);
          }}
        />
      )}

    </div>
  );
}
