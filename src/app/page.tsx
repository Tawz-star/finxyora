import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Trophy,
  Store,
  ArrowRight,
  Shield,
  Zap,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  Users,
  CheckCircle2,
  Building,
  TrendingUp,
  Cpu,
  Award
} from 'lucide-react';
import CountdownTimer from '@/components/CountdownTimer';
import EventCard from '@/components/EventCard';
import { getAllEvents, getAllStallOptions, getSiteSettings } from '@/lib/db';

export const revalidate = 60;

export default async function HomePage() {
  const events = await getAllEvents();
  const stallOptions = await getAllStallOptions();
  const settings = await getSiteSettings();

  const eventDates = settings.event_dates || 'November 12 & 13, 2026';
  const eventVenue = settings.event_venue || 'Golden Jubilee Building';
  const collegeName = settings.college_name || 'Bishop Heber College';
  const defaultFee = settings.default_event_fee || '50';
  const defaultFeeRule = settings.default_fee_rule || 'per_team';

  return (
    <div className="relative overflow-hidden bg-grid-pattern">
      {/* Ambient background glow orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-10 right-10 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute top-[800px] left-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* ============================================================== */}
      {/* HERO SECTION */}
      {/* ============================================================== */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          
          {/* Top Pill / Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border border-sky-400/30 text-sky-300 text-xs sm:text-sm font-medium shadow-md shadow-sky-500/10 animate-fadeIn">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span>Commerce Department &bull; FinTech Association Presents</span>
          </div>

          {/* Official FINXYORA 2K26 Hero Title / Logo */}
          <div className="flex justify-center items-center -my-6 sm:-my-10 md:-my-14 lg:-my-16">
            <h1 className="sr-only">FINXYORA 2K26</h1>
            <Image
              src="/finxyora-hero-logo.png"
              alt="FINXYORA 2K26"
              width={1341}
              height={1677}
              priority
              quality={95}
              sizes="(max-width: 640px) 280px, (max-width: 768px) 360px, (max-width: 1024px) 420px, 460px"
              className="hero-logo-spring w-[280px] sm:w-[360px] md:w-[420px] lg:w-[460px] max-w-[85vw] h-auto object-contain mx-auto select-none pointer-events-none drop-shadow-[0_10px_35px_rgba(56,189,248,0.25)]"
            />
          </div>

          {/* Tagline */}
          <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-sky-200/90 tracking-wide font-sans">
            “Where Finance Meets Innovation.”
          </p>

          {/* Event description */}
          <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
            The premier intra-collegiate technical, management, and cultural festival. Immerse yourself in high-stakes Artificial Intelligence prompt engineering, strategic executive leadership, runway corporate choreography, FinTech quizzing, and football franchise auctions.
          </p>

          {/* Meta Details Pill (Date, Venue, Deadline) */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-2 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-sky-500/20">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>{eventDates}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-sky-500/20">
              <MapPin className="w-4 h-4 text-sky-400" />
              <span>{eventVenue}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-sky-500/20">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Fee: ₹{defaultFee || '50'} per person</span>
            </div>
          </div>

          {/* DUAL PROMINENT CTA PATHWAYS */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <Link
              href="/events"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:to-sky-300 text-white shadow-xl shadow-sky-500/25 hover:shadow-sky-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
            >
              <Trophy className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
              REGISTER FOR EVENTS
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/stalls"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-bold glass-panel hover:bg-slate-800/90 text-sky-300 hover:text-white border border-sky-500/40 hover:border-sky-400 shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
            >
              <Store className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
              BOOK A FESTIVAL STALL
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* COUNTDOWN TIMER */}
          <div className="pt-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Event Inception Countdown
            </p>
            <CountdownTimer targetDate={settings.event_countdown_target || '2026-11-12T09:00:00'} />
          </div>

        </div>
      </section>

      {/* ============================================================== */}
      {/* QUICK HIGHLIGHT STATS (Centered 2 Boxes: Flagship Events & Price Per Person) */}
      {/* ============================================================== */}
      <section className="py-10 border-y border-sky-500/20 bg-slate-950/60 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-center">
            
            <div className="p-6 rounded-2xl glass-card border border-sky-500/20 hover:border-sky-500/40 transition-all">
              <div className="text-3xl sm:text-4xl font-black text-white font-mono">6</div>
              <div className="text-xs font-semibold text-sky-300 uppercase tracking-wider mt-1.5">
                Flagship Events
              </div>
            </div>

            <div className="p-6 rounded-2xl glass-card border border-sky-500/20 hover:border-sky-500/40 transition-all">
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">₹{defaultFee}</div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-1.5">
                Price Per Person
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* PRIZE & AWARDS SHOWCASE SECTION (First & Second Prize) */}
      {/* ============================================================== */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="relative rounded-3xl glass-panel p-8 sm:p-12 border border-amber-500/30 overflow-hidden shadow-2xl">
          {/* Ambient background glow */}
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-amber-500/15 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-sky-500/15 rounded-full blur-[100px] pointer-events-none" />

          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Championship Accolades &amp; Honors</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Grand Championship <br />
              <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                Prizes &amp; Merit Awards
              </span>
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Participants who win the event will receive official First Prize, Second Prize, or Third Prize honours and merit recognition across every competition arena.
            </p>
          </div>

          {/* Three Balanced Prize Cards: First, Second, and Third Prize */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            
            {/* FIRST PRIZE */}
            <div className="relative p-6 sm:p-7 rounded-3xl glass-card border border-amber-400/40 bg-gradient-to-b from-amber-500/10 via-slate-900/60 to-slate-950/80 shadow-xl shadow-amber-500/10 hover:border-amber-400/70 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="text-3xl sm:text-4xl">🥇</span>
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40">
                    Champion
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  FIRST PRIZE
                </h3>
                <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider mt-1 mb-3">
                  Winner Merit Award
                </p>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Awarded to the top-ranking team or participant in each flagship arena, featuring official winner honours, championship merit credentials, and departmental excellence citations.
                </p>
              </div>
              <div className="pt-5 mt-6 border-t border-amber-500/20 flex items-center justify-between text-xs text-amber-200/80">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Highest Distinction
                </span>
                <span className="font-mono font-bold text-amber-300">Rank #1</span>
              </div>
            </div>

            {/* SECOND PRIZE */}
            <div className="relative p-6 sm:p-7 rounded-3xl glass-card border border-sky-400/30 bg-gradient-to-b from-sky-500/10 via-slate-900/60 to-slate-950/80 shadow-xl shadow-sky-500/10 hover:border-sky-400/60 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="text-3xl sm:text-4xl">🥈</span>
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-400/20 text-sky-300 border border-sky-400/40">
                    Runner-Up
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  SECOND PRIZE
                </h3>
                <p className="text-xs font-semibold text-sky-300 uppercase tracking-wider mt-1 mb-3">
                  Runner-Up Merit Award
                </p>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Awarded to the runner-up team or participant in each flagship arena, recognizing competitive distinction, strategic execution, and official merit credentials.
                </p>
              </div>
              <div className="pt-5 mt-6 border-t border-sky-500/20 flex items-center justify-between text-xs text-sky-200/80">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  Runner-Up Citation
                </span>
                <span className="font-mono font-bold text-sky-300">Rank #2</span>
              </div>
            </div>

            {/* THIRD PRIZE */}
            <div className="relative p-6 sm:p-7 rounded-3xl glass-card border border-orange-400/30 bg-gradient-to-b from-orange-500/10 via-slate-900/60 to-slate-950/80 shadow-xl shadow-orange-500/10 hover:border-orange-400/60 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="text-3xl sm:text-4xl">🥉</span>
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-orange-400/20 text-orange-300 border border-orange-400/40">
                    2nd Runner-Up
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  THIRD PRIZE
                </h3>
                <p className="text-xs font-semibold text-orange-300 uppercase tracking-wider mt-1 mb-3">
                  Second Runner-Up Award
                </p>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Awarded to the third-place team or participant in each flagship arena, recognizing exceptional technical execution, strategic acumen, and official podium merit credentials.
                </p>
              </div>
              <div className="pt-5 mt-6 border-t border-orange-500/20 flex items-center justify-between text-xs text-orange-200/80">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  Podium Distinction
                </span>
                <span className="font-mono font-bold text-orange-300">Rank #3</span>
              </div>
            </div>

          </div>

          {/* CTA Button */}
          <div className="text-center pt-8">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-sans shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Trophy className="w-4 h-4" />
              <span>Register to Compete</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <p className="text-[11px] text-slate-400 mt-3">
              Merit &amp; Participation Certificates awarded to all verified participants
            </p>
          </div>

        </div>
      </section>

      {/* ============================================================== */}
      {/* SIX INDIVIDUAL EVENTS SECTION */}
      {/* ============================================================== */}
      <section id="events" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20 mb-3">
              <Trophy className="w-3.5 h-3.5" />
              Intra-Collegiate Arenas
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Explore All Six Flagship Events
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl">
              Each competition features distinct participant limits, rigorous rules, and tailored problem statements. Select an event to view full guidelines and register your team.
            </p>
          </div>

          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors self-start md:self-auto"
          >
            <span>View All Event Details</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 6 Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* FESTIVAL STALLS ADVERTISING SECTION */}
      {/* ============================================================== */}
      <section id="stalls" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="relative rounded-3xl glass-panel p-8 sm:p-12 border border-sky-500/30 overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />

          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 mb-3">
              <Store className="w-3.5 h-3.5" />
              Campus Exhibition &amp; Commercial Pavilion
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Festival Stalls &amp; Exhibition Hub
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Showcase student enterprise, artisanal merchandise, gourmet cuisine, or corporate FinTech products to over 2,500 visiting students and industry guests.
            </p>
          </div>

          {/* Stalls Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {stallOptions.map((opt) => (
              <div
                key={opt.id}
                className="rounded-2xl glass-card p-6 flex flex-col justify-between border border-sky-500/20 hover:border-sky-400/50 relative group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/30">
                      {opt.category === 'STUDENT' ? 'Student Enterprise' : 'Commercial Vendor'}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {opt.available_stalls} Left
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-sky-300 transition-colors">
                    {opt.name}
                  </h3>

                  <div className="mb-4">
                    <span className="text-3xl font-extrabold text-white font-mono">
                      ₹{opt.price}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">/ stall</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {opt.description}
                  </p>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{opt.has_electricity ? 'Dedicated 15A/30A Power Included' : 'No Electricity (Standard Booth)'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Table, Chairs &amp; Canopy Included</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-4 border-t border-slate-800">
                  <Link
                    href={`/stalls?option=${opt.id}`}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold bg-sky-500/20 hover:bg-sky-500 text-sky-200 hover:text-white border border-sky-500/40 hover:border-transparent flex items-center justify-center gap-2 transition-all"
                  >
                    <span>Reserve Stall Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/stalls"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg shadow-sky-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Store className="w-4 h-4" />
              <span>Go to Full Stall Registration Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* ABOUT COMMERCE & FINTECH SECTION */}
      {/* ============================================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-sky-500/20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              <Building className="w-3.5 h-3.5" />
              The Academic Driving Force
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Commerce Department &amp; FinTech Association
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed">
              At <strong className="text-white">{collegeName}</strong>, the Department of Commerce has stood at the vanguard of financial pedagogy, ethical management, and corporate leadership for over four decades.
            </p>

            <p className="text-sm text-slate-300 leading-relaxed">
              The <strong>FinTech Association</strong> represents the cutting-edge technological evolution of our commerce curriculum—bridging traditional banking systems with decentralized ledgers, artificial intelligence, quantitative algorithmic trading, and modern regulatory compliance.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl glass-card">
                <TrendingUp className="w-5 h-5 text-sky-400 mb-2" />
                <h4 className="text-sm font-bold text-white">Innovation Labs</h4>
                <p className="text-xs text-slate-400 mt-1">Hands-on algorithmic trading &amp; blockchain modeling sandbox.</p>
              </div>

              <div className="p-4 rounded-xl glass-card">
                <Cpu className="w-5 h-5 text-indigo-400 mb-2" />
                <h4 className="text-sm font-bold text-white">Industry Connect</h4>
                <p className="text-xs text-slate-400 mt-1">Mentorship from premier investment banks and fintech neo-banks.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Link
                href="/about/commerce"
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                Read Department Profile <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-slate-600">&bull;</span>
              <Link
                href="/about/fintech"
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                Read Association Charter <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Visual Showcase Card */}
          <div className="relative">
            <div className="relative rounded-3xl glass-panel p-8 border border-sky-500/30 overflow-hidden shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-sky-400" />
              </div>

              <h3 className="text-2xl font-bold text-white mb-3">
                FINXYORA Festival Vision
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                FINXYORA is not merely a fest—it is an arena where college students test their mettle against realistic financial crises, AI prompt architectures, runaway budgets, and corporate runway challenges.
              </p>

              <div className="space-y-3 border-t border-slate-800/80 pt-6">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Festival Host</span>
                  <span className="text-white font-medium">{collegeName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Convening Body</span>
                  <span className="text-sky-300 font-medium">FinTech Association Council</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Registration Mode</span>
                  <span className="text-emerald-400 font-medium">100% Online Verified Gateway</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Eligibility</span>
                  <span className="text-white font-medium">Undergraduate &amp; Postgraduate Students</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between">
                <Link
                  href="/lookup"
                  className="text-xs font-semibold text-sky-400 hover:text-white flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  Check Existing Registration
                </Link>
                <Link
                  href="/contact"
                  className="text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Need Help?
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
