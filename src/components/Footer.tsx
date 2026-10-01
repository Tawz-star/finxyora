import React from 'react';
import Link from 'next/link';
import { Zap, Shield, Heart, MapPin, Mail, Phone, Calendar, ArrowRight } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative border-t border-sky-500/20 bg-slate-950/90 backdrop-blur-2xl text-slate-400 no-print">
      {/* Decorative top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-sky-500 to-indigo-500 flex items-center justify-center p-0.5 shadow-md shadow-sky-500/30">
                <div className="w-full h-full bg-slate-950/80 rounded-[10px] flex items-center justify-center">
                  <Zap className="w-5 h-5 text-sky-400" />
                </div>
              </div>
              <span className="text-2xl font-black tracking-wider gradient-text font-sans">
                FINXYORA
              </span>
            </Link>
            
            <p className="text-sm text-slate-300 font-medium">
              “Where Finance Meets Innovation.”
            </p>
            
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              The flagship inter-collegiate festival organized by the Department of Commerce &amp; FinTech Association. Uniting sharp minds in AI, executive leadership, blockchain, financial strategy, and commercial creativity.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                Registrations Live
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                Stalls Booking Open
              </span>
            </div>
          </div>

          {/* Six Events Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
              Festival Events
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/events/prompt-perfect" className="hover:text-sky-300 transition-colors flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-sky-400" />
                  Prompt Perfect (AI)
                </Link>
              </li>
              <li>
                <Link href="/events/best-manager" className="hover:text-sky-300 transition-colors flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-sky-400" />
                  Best Manager (Solo)
                </Link>
              </li>
              <li>
                <Link href="/events/corporate-walk" className="hover:text-sky-300 transition-colors flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-sky-400" />
                  Corporate Walk (6-8)
                </Link>
              </li>
              <li>
                <Link href="/events/star-quas" className="hover:text-sky-300 transition-colors flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-sky-400" />
                  Star Quas
                </Link>
              </li>
              <li>
                <Link href="/events/b-quiz" className="hover:text-sky-300 transition-colors flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-sky-400" />
                  B Quiz (FinTech)
                </Link>
              </li>
              <li>
                <Link href="/events/football-auction" className="hover:text-sky-300 transition-colors flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-sky-400" />
                  Football Auction
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Portals */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
              Portals &amp; Info
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/stalls" className="hover:text-sky-300 transition-colors">
                  Festival Stall Booking
                </Link>
              </li>
              <li>
                <Link href="/lookup" className="hover:text-sky-300 transition-colors">
                  Registration &amp; Receipt Lookup
                </Link>
              </li>
              <li>
                <Link href="/about/commerce" className="hover:text-sky-300 transition-colors">
                  About Commerce Department
                </Link>
              </li>
              <li>
                <Link href="/about/fintech" className="hover:text-sky-300 transition-colors">
                  About FinTech Association
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-sky-300 transition-colors">
                  Contact &amp; Help Desk
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-sky-300 transition-colors flex items-center gap-1 text-slate-300">
                  <Shield className="w-3 h-3 text-sky-400" />
                  Admin Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & College Placeholders */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
              Event Details
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>November 12 &amp; 13, 2026</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>Golden Jubilee Hall, Bishop Heber College</span>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>finxyora@bishopheber.edu.in</span>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>9159911721 / 8682879906</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar & Policy */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} FINXYORA &bull; Department of Commerce &amp; FinTech Association &bull; Bishop Heber College. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs">
            <span>Valid College ID Mandatory</span>
            <span>&bull;</span>
            <span>Non-Refundable Policy</span>
            <span>&bull;</span>
            <span>Standard FinTech Rules Apply</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
