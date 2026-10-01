import React from 'react';
import Link from 'next/link';
import { Building, TrendingUp, Award, Users, BookOpen, ArrowRight, ShieldCheck } from 'lucide-react';
import { getSiteSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function AboutCommercePage() {
  const settings = getSiteSettings();
  const collegeName = settings.college_name || "Bishop Heber College";

  return (
    <div className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-16">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border border-sky-400/30 text-sky-300 text-xs sm:text-sm font-medium">
          <Building className="w-3.5 h-3.5" />
          <span>Academic Foundation</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
          Department of <span className="gradient-text">Commerce</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Nurturing financial visionary leaders, ethical accountants, corporate strategists, and innovative entrepreneurs for four decades at {collegeName}.
        </p>
      </div>

      {/* Vision & Mission Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-3xl glass-panel p-8 sm:p-10 border border-sky-500/20 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-sky-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold text-white">Our Academic Legacy</h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            The Department of Commerce has consistently been ranked among the top collegiate institutions for commercial studies, international finance, corporate taxation, and business management. Our alumni lead Fortune 500 boards, Big-Four auditing practices, central banks, and unicorn FinTech enterprises worldwide.
          </p>
          <ul className="space-y-2 text-xs text-slate-300 pt-2">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              Accredited with highest academic distinctions &amp; global curriculum alignment
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              Dedicated Financial Markets Simulation Lab &amp; Bloomberg Terminal access
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              Annual research publications in peer-reviewed international economic journals
            </li>
          </ul>
        </div>

        <div className="rounded-3xl glass-panel p-8 sm:p-10 border border-sky-500/20 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold text-white">The FINXYORA Genesis</h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Conceived as a collaborative platform between academic theorists and industry practitioners, FINXYORA is designed to transcend classroom textbooks. Students are pushed into high-velocity competitive arenas simulating mergers, AI prompt architectures, currency arbitrage, and commercial runway management.
          </p>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 mt-4 space-y-2">
            <span className="font-bold text-white block">Department Leadership</span>
            <p className="text-slate-400">Head of Department &bull; Senior Faculty Advisory Council &bull; Student Fest Conveners</p>
          </div>
        </div>
      </div>

      {/* Key Pillars */}
      <div className="rounded-3xl glass-panel p-8 sm:p-12 border border-sky-500/30">
        <h3 className="text-xl font-bold text-white mb-8 text-center">
          Pillars of Commerce Excellence
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl glass-card text-center space-y-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="text-base font-bold text-white">Ethical Corporate Governance</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Instilling integrity, transparency, and fiduciary responsibility in future boardroom executives.
            </p>
          </div>

          <div className="p-5 rounded-2xl glass-card text-center space-y-3">
            <Users className="w-8 h-8 text-sky-400 mx-auto" />
            <h4 className="text-base font-bold text-white">Student Leadership</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Empowering student bodies to autonomously convene inter-collegiate technical fests and social enterprises.
            </p>
          </div>

          <div className="p-5 rounded-2xl glass-card text-center space-y-3">
            <Award className="w-8 h-8 text-indigo-400 mx-auto" />
            <h4 className="text-base font-bold text-white">Corporate Accreditations</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Partnerships with international professional bodies including ACCA, CMA, and CFA Institute.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center pt-4">
        <Link
          href="/about/fintech"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/25 transition-all"
        >
          <span>Explore FinTech Association</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

    </div>
  );
}
