import React from 'react';
import Link from 'next/link';
import { Zap, Cpu, Shield, Globe, Award, ArrowRight, Code2, LineChart } from 'lucide-react';
import { getSiteSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AboutFinTechPage() {
  const settings = await getSiteSettings();
  const collegeName = settings.college_name || "Bishop Heber College";

  return (
    <div className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-16">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border border-sky-400/30 text-sky-300 text-xs sm:text-sm font-medium">
          <Zap className="w-3.5 h-3.5 text-sky-400" />
          <span>Student Innovation Body</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
          FinTech <span className="gradient-text">Association</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          The premier collegiate student body pioneering the intersection of decentralized technology, algorithmic finance, artificial intelligence, and digital commerce at {collegeName}.
        </p>
      </div>

      {/* Core Focus Areas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-3xl glass-panel p-8 border border-sky-500/20 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Generative AI in Finance</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Exploring prompt engineering, transformer models in algorithmic financial trading, automated compliance tracking, and intelligent risk evaluation algorithms.
          </p>
        </div>

        <div className="rounded-3xl glass-panel p-8 border border-sky-500/20 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Blockchain &amp; Web3 Rails</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Hands-on research in smart contracts, zero-knowledge proofs, decentralized finance protocols, and Central Bank Digital Currency (CBDC) tokenomics.
          </p>
        </div>

        <div className="rounded-3xl glass-panel p-8 border border-sky-500/20 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <LineChart className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Next-Gen Digital Payments</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Demystifying UPI settlement architectures, neo-banking API sandboxes, real-time fraud mitigation, and cross-border digital remittance corridors.
          </p>
        </div>
      </div>

      {/* Association Charter & Organization */}
      <div className="rounded-3xl glass-panel p-8 sm:p-12 border border-sky-500/30 space-y-8">
        <div>
          <h3 className="text-2xl font-bold text-white mb-3">Association Council &amp; Committees</h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            The FinTech Association operates through elected student executives, technical working groups, and faculty mentors. Every year, the council organizes international webinars, hackathons, paper presentation symposiums, and our flagship intra-collegiate festival: <strong>FINXYORA</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-sky-400 font-bold block mb-1">Executive Council</span>
            <p className="text-slate-300">President, Vice President, Secretary &amp; Treasurer supervising annual operations.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-sky-400 font-bold block mb-1">Technical Research Wing</span>
            <p className="text-slate-300">Developers building AI prompts, web apps, and financial simulation tools.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-sky-400 font-bold block mb-1">Event Operations Board</span>
            <p className="text-slate-300">Overseeing logistics, judging tribunals, registrations, and payment gateways.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-sky-400 font-bold block mb-1">Industry Liaison Desk</span>
            <p className="text-slate-300">Connecting corporate fintech sponsors, keynote speakers, and mentors.</p>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="text-center space-y-4 pt-4">
        <h3 className="text-xl font-bold text-white">Experience Innovation in Action</h3>
        <p className="text-xs text-slate-300 max-w-lg mx-auto">
          Participate in one of our six competitive arenas or secure your student stall booth at FINXYORA 2026.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/events"
            className="px-6 py-3 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/25 transition-all"
          >
            Register for Events
          </Link>
          <Link
            href="/stalls"
            className="px-6 py-3 rounded-xl text-xs font-bold glass-panel hover:bg-slate-800 text-sky-300 border border-sky-500/30 transition-all"
          >
            Book Festival Stall
          </Link>
        </div>
      </div>

    </div>
  );
}
