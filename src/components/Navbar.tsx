'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Zap,
  Menu,
  X,
  Search,
  Trophy,
  Store,
  Calendar,
  Sparkles,
  ArrowRight,
  Shield,
  Award
} from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 24) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Events', href: '/events', icon: Trophy },
    { label: 'Book Stall', href: '/stalls', icon: Store },
    { label: 'Lookup', href: '/lookup', icon: Search },
    { label: 'Contact', href: '/contact', icon: Calendar },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      
      {/* ============================================================== */}
      {/* 1. TOP INSTITUTIONAL STRIP (Visible at top, smoothly collapses on scroll) */}
      {/* ============================================================== */}
      <div
        className={`w-full transition-all duration-300 overflow-hidden ${
          isScrolled
            ? 'max-h-0 opacity-0 py-0 pointer-events-none'
            : 'max-h-16 opacity-100 py-1.5 bg-slate-950/90 border-b border-sky-500/15 backdrop-blur-md'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs">
          
          {/* Left: Bishop Heber College Branding with Official Logo */}
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-7 shrink-0">
              <Image
                src="/bhc-logo.png"
                alt="Bishop Heber College Logo"
                fill
                priority
                sizes="32px"
                className="object-contain drop-shadow"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-100 tracking-wide text-xs sm:text-sm leading-tight">
                BISHOP HEBER COLLEGE <span className="text-[10px] text-sky-400 font-semibold">(AUTONOMOUS)</span>
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline leading-tight">
                Tiruchirappalli, Tamil Nadu &bull; Nationally Re-accredited with &lsquo;A++&rsquo; Grade
              </span>
            </div>
          </div>

          {/* Center: Department Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-300 font-medium">
            <Sparkles className="w-3 h-3 text-sky-400" />
            <span>Dept. of Commerce &bull; FinTech Association</span>
          </div>

          {/* Right: Festival Dates Badge */}
          <div className="hidden sm:flex items-center gap-2 text-right">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
              <Calendar className="w-3 h-3 text-amber-400" />
              <span>Nov 12 &amp; 13, 2026</span>
            </div>
          </div>

        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. MAIN NAVIGATION DOCK (Transforms intelligently on scroll) */}
      {/* ============================================================== */}
      <div
        className={`transition-all duration-300 ${
          isScrolled
            ? 'max-w-6xl mx-auto px-3 sm:px-6 mt-2'
            : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'
        }`}
      >
        <div
          className={`flex items-center justify-between transition-all duration-300 ${
            isScrolled
              ? 'h-14 rounded-2xl glass-panel bg-slate-950/85 border border-sky-500/25 px-4 sm:px-6 shadow-2xl backdrop-blur-2xl'
              : 'h-16 sm:h-20 bg-transparent'
          }`}
        >

          {/* Brand Logo & Title */}
          <Link href="/" className="flex items-center gap-3 group">
            {/* Show BHC Logo when scrolled so institutional branding is always present */}
            {isScrolled && (
              <div className="relative h-8 w-6 shrink-0 transition-transform group-hover:scale-105">
                <Image
                  src="/bhc-logo.png"
                  alt="Bishop Heber College"
                  fill
                  sizes="28px"
                  className="object-contain"
                />
              </div>
            )}

            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-sky-500 to-indigo-500 flex items-center justify-center p-0.5 shadow-lg shadow-sky-500/30 group-hover:scale-105 transition-transform shrink-0">
              <div className="w-full h-full bg-slate-950/90 rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-sky-400 group-hover:text-white transition-colors" />
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black tracking-wider gradient-text leading-tight">
                FINXYORA
              </span>
              <span className="text-[9px] uppercase tracking-widest text-sky-400 font-semibold -mt-0.5">
                Intra-Collegiate Fest 2026
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    active
                      ? 'text-sky-300 bg-sky-500/15 border border-sky-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span>{link.label}</span>
                  {active && (
                    <span className="absolute bottom-0.5 left-3 right-3 h-[2px] bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-2.5">
            <Link
              href="/lookup"
              className="p-2 text-slate-400 hover:text-sky-300 hover:bg-slate-800/60 rounded-xl transition-colors border border-transparent hover:border-sky-500/20"
              title="Lookup Ticket / Booking"
            >
              <Search className="w-4 h-4" />
            </Link>

            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:to-sky-300 text-white shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>Register Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl border border-sky-500/20"
              aria-label="Toggle navigation menu"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. MOBILE DRAWER MENU */}
      {/* ============================================================== */}
      {isOpen && (
        <div className="md:hidden glass-panel border-b border-sky-500/30 px-4 pt-3 pb-6 space-y-2 animate-fadeIn mx-3 mt-2 rounded-2xl shadow-2xl bg-slate-950/95">
          {/* College Info in mobile drawer */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 border border-sky-500/20 mb-3">
            <div className="relative h-10 w-8 shrink-0">
              <Image
                src="/bhc-logo.png"
                alt="Bishop Heber College"
                fill
                sizes="36px"
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">BISHOP HEBER COLLEGE</p>
              <p className="text-[10px] text-sky-400 leading-tight">Dept. of Commerce &bull; FinTech Association</p>
              <p className="text-[9px] text-slate-400">Nov 12 &amp; 13, 2026 &bull; Golden Jubilee Building</p>
            </div>
          </div>

          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? 'text-sky-300 bg-sky-500/15 border border-sky-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {link.icon && <link.icon className="w-4 h-4 text-sky-400" />}
                {link.label}
              </Link>
            );
          })}

          <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
            <Link
              href="/events"
              onClick={() => setIsOpen(false)}
              className="w-full py-2.5 text-center rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md shadow-sky-500/30"
            >
              Register for Events
            </Link>
            <Link
              href="/admin/login"
              onClick={() => setIsOpen(false)}
              className="w-full py-2 text-center rounded-xl text-[11px] text-slate-400 hover:text-white flex items-center justify-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>Admin Portal</span>
            </Link>
          </div>
        </div>
      )}

    </header>
  );
}
