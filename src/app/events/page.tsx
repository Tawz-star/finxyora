import React from 'react';
import Link from 'next/link';
import { Trophy, ArrowRight, Sparkles, Users, Cpu, Briefcase, HelpCircle, Shield } from 'lucide-react';
import { getAllEvents } from '@/lib/db';
import EventCard from '@/components/EventCard';

export const dynamic = 'force-dynamic';

export default function EventsIndexPage() {
  const events = getAllEvents();

  return (
    <div className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border border-sky-400/30 text-sky-300 text-xs sm:text-sm font-medium">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Inter-Collegiate Arena 2026</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
          Explore All Six <span className="gradient-text">Flagship Events</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          From cutting-edge generative AI prompt optimization to executive boardroom simulations and virtual football franchise auctions. Each event has distinct team quotas, rigorous multi-round formats, and cash rewards.
        </p>
      </div>

      {/* Grid of 6 Events */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {/* Event Participation Guide & Rules Banner */}
      <div className="mt-16 rounded-3xl glass-panel p-8 sm:p-10 border border-sky-500/30">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-sky-400" />
          General Competition Guidelines
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300 leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <h4 className="font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              Eligibility &amp; Verification
            </h4>
            <p>
              Open to bona fide undergraduate and postgraduate students from recognized colleges and universities. Physical college photo ID cards are strictly mandatory at registration desk check-in.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <h4 className="font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              Dynamic Team Limits
            </h4>
            <p>
              Participant quotas are strictly validated both client-side and server-side. Prompt Perfect, Best CFO, and B Quiz accept 2 participants; Best Manager is strictly solo (1); Corporate Walk requires 6&ndash;8; Football Auction accepts 2&ndash;3.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <h4 className="font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              Official Entry Pass
            </h4>
            <p>
              Upon successful online payment verification, a unique Registration ID and digital entry pass with a verification QR code is generated. You can download or print it anytime from the Lookup portal.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
