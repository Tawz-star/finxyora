import React from 'react';
import {
  BrainCircuit,
  Rocket,
  TrendingUp,
  Landmark,
  HelpCircle,
  Gavel,
  Trophy,
  LucideProps
} from 'lucide-react';

export interface EventIconConfig {
  icon: React.ComponentType<LucideProps>;
  color: string;
  bgGlow: string;
  borderGlow: string;
  label: string;
}

export const EVENT_ICONS: Record<string, EventIconConfig> = {
  'prompt-perfect': {
    icon: BrainCircuit,
    color: 'text-sky-400',
    bgGlow: 'bg-sky-500/10 group-hover:bg-sky-500/20',
    borderGlow: 'border-sky-500/30 group-hover:border-sky-400/60',
    label: 'Generative AI & Prompt Engineering'
  },
  'best-manager': {
    icon: Rocket,
    color: 'text-indigo-400',
    bgGlow: 'bg-indigo-500/10 group-hover:bg-indigo-500/20',
    borderGlow: 'border-indigo-500/30 group-hover:border-indigo-400/60',
    label: 'Venture Incubation & Business Plan'
  },
  'corporate-walk': {
    icon: TrendingUp,
    color: 'text-emerald-400',
    bgGlow: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
    borderGlow: 'border-emerald-500/30 group-hover:border-emerald-400/60',
    label: 'Stock Market Trading & Portfolio War'
  },
  'best-cfo': {
    icon: Landmark,
    color: 'text-amber-400',
    bgGlow: 'bg-amber-500/10 group-hover:bg-amber-500/20',
    borderGlow: 'border-amber-500/30 group-hover:border-amber-400/60',
    label: 'Chief Financial Officer Strategy & Treasury'
  },
  'star-quas': {
    icon: Landmark,
    color: 'text-amber-400',
    bgGlow: 'bg-amber-500/10 group-hover:bg-amber-500/20',
    borderGlow: 'border-amber-500/30 group-hover:border-amber-400/60',
    label: 'Finance & Strategy Leadership'
  },
  'b-quiz': {
    icon: HelpCircle,
    color: 'text-cyan-400',
    bgGlow: 'bg-cyan-500/10 group-hover:bg-cyan-500/20',
    borderGlow: 'border-cyan-500/30 group-hover:border-cyan-400/60',
    label: 'FinTech & Blockchain Arena Quiz'
  },
  'football-auction': {
    icon: Gavel,
    color: 'text-rose-400',
    bgGlow: 'bg-rose-500/10 group-hover:bg-rose-500/20',
    borderGlow: 'border-rose-500/30 group-hover:border-rose-400/60',
    label: 'Live Franchise Player Auction War Room'
  }
};

export function getEventIconConfig(eventId: string): EventIconConfig {
  return (
    EVENT_ICONS[eventId] || {
      icon: Trophy,
      color: 'text-sky-400',
      bgGlow: 'bg-sky-500/10 group-hover:bg-sky-500/20',
      borderGlow: 'border-sky-500/30 group-hover:border-sky-400/60',
      label: 'Flagship Competition'
    }
  );
}

export function EventIcon({
  eventId,
  className = 'w-6 h-6',
  showContainer = false,
  containerClassName = 'w-12 h-12 rounded-xl flex items-center justify-center'
}: {
  eventId: string;
  className?: string;
  showContainer?: boolean;
  containerClassName?: string;
}) {
  const config = getEventIconConfig(eventId);
  const IconComponent = config.icon;

  if (showContainer) {
    return (
      <div
        className={`${containerClassName} ${config.bgGlow} ${config.borderGlow} border transition-all duration-300 shadow-inner`}
      >
        <IconComponent className={`${className} ${config.color} transition-transform duration-300 group-hover:scale-110`} />
      </div>
    );
  }

  return <IconComponent className={`${className} ${config.color}`} />;
}
