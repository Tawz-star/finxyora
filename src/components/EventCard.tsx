import React from 'react';
import Link from 'next/link';
import { Users, ArrowRight, Sparkles, Shield, Cpu, Briefcase, HelpCircle, Trophy } from 'lucide-react';
import { EventRecord } from '@/lib/db';

interface EventCardProps {
  event: EventRecord;
}

export default function EventCard({ event }: EventCardProps) {
  const getIcon = (id: string) => {
    switch (id) {
      case 'prompt-perfect':
        return <Cpu className="w-6 h-6 text-sky-400" />;
      case 'best-manager':
        return <Briefcase className="w-6 h-6 text-indigo-400" />;
      case 'corporate-walk':
        return <Sparkles className="w-6 h-6 text-amber-400" />;
      case 'best-cfo':
      case 'star-quas':
        return <Shield className="w-6 h-6 text-cyan-400" />;
      case 'b-quiz':
        return <HelpCircle className="w-6 h-6 text-emerald-400" />;
      case 'football-auction':
        return <Trophy className="w-6 h-6 text-blue-400" />;
      default:
        return <Trophy className="w-6 h-6 text-sky-400" />;
    }
  };

  const getTeamSizeLabel = () => {
    if (event.min_participants === event.max_participants) {
      return event.min_participants === 1 ? '1 Participant (Solo)' : `${event.max_participants} Participants`;
    }
    return `${event.min_participants} – ${event.max_participants} Participants`;
  };

  return (
    <div className="group relative rounded-2xl glass-card p-6 flex flex-col justify-between overflow-hidden border border-sky-500/20 hover:border-sky-400/50">
      {/* Subtle background glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl group-hover:bg-sky-500/20 transition-all pointer-events-none" />

      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900/80 border border-sky-500/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
            {getIcon(event.id)}
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/30">
              <Users className="w-3 h-3" />
              {getTeamSizeLabel()}
            </span>
          </div>
        </div>

        {/* Category */}
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/90 mb-1">
          {event.category}
        </p>

        {/* Title */}
        <h3 className="text-xl font-bold text-white group-hover:text-sky-300 transition-colors mb-3">
          {event.title}
        </h3>

        {/* Description snippet */}
        <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-6">
          {event.description}
        </p>
      </div>

      {/* Footer & CTA */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 block">
            Entry Fee
          </span>
          <span className="text-base font-extrabold text-white">
            ₹{event.registration_fee}
            <span className="text-xs font-normal text-slate-400 ml-1">
              {event.fee_type === 'per_participant' ? '/ participant' : '/ team'}
            </span>
          </span>
        </div>

        <Link
          href={`/events/${event.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/30 hover:border-transparent transition-all shadow-sm"
        >
          Details &amp; Register
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
