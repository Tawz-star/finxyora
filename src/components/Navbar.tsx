'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, Award, Shield, Store, Search } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Primary desktop navigation links required by Bishop Heber College institutional style
  const primaryLinks = [
    { label: 'HOME', href: '/' },
    { label: 'EVENTS', href: '/events' },
    { label: 'CONTACT', href: '/contact' },
  ];

  // Additional secondary links accessible in mobile drawer and footer
  const secondaryLinks = [
    { label: 'BOOK STALL', href: '/stalls', icon: Store },
    { label: 'VERIFY / LOOKUP', href: '/lookup', icon: Search },
    { label: 'ADMIN PORTAL', href: '/admin', icon: Shield },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 banner-maroon-gradient border-b border-amber-500/30 shadow-2xl backdrop-blur-md">
      {/* Soft horizontal light accent line at the very top */}
      <div className="w-full h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ============================================================== */}
        {/* TOP TIER: Institutional Branding Row */}
        {/* ============================================================== */}
        <div className="flex items-center justify-between py-2 sm:py-3 gap-2 sm:gap-4 border-b border-amber-500/20">
          
          {/* Left: Bishop Heber College Crest */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group" title="Bishop Heber College">
            <div className="relative w-12 h-14 sm:w-16 sm:h-20 transition-transform group-hover:scale-105 duration-200">
              <Image
                src="/bishop-heber-crest.png"
                alt="Bishop Heber College Pelican Crest - NISI DOMINUS FRUSTRA"
                fill
                priority
                sizes="(max-width: 640px) 48px, 64px"
                className="object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]"
              />
            </div>
            {/* Mobile-only condensed institution title */}
            <div className="flex flex-col sm:hidden">
              <span className="font-institutional-serif text-sm font-bold tracking-wider text-gold-institutional uppercase">
                BISHOP HEBER COLLEGE
              </span>
              <span className="font-institutional-serif text-[9px] tracking-widest text-amber-300/80 uppercase">
                (AUTONOMOUS) &bull; FINXYORA
              </span>
            </div>
          </Link>

          {/* Center: Prominent Institution Title in Bold Uppercase Serif */}
          <div className="hidden sm:flex flex-col items-center text-center flex-grow px-2">
            <Link href="/" className="group">
              <h1 className="font-institutional-serif text-xl sm:text-2xl md:text-3xl font-extrabold tracking-widest text-gold-institutional uppercase group-hover:brightness-110 transition-all">
                BISHOP HEBER COLLEGE
              </h1>
            </Link>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="w-6 sm:w-10 h-[1px] bg-gradient-to-r from-transparent to-amber-400/60" />
              <p className="font-institutional-serif text-[10px] sm:text-xs md:text-sm tracking-widest text-amber-200/90 font-medium uppercase">
                (AUTONOMOUS) &bull; TIRUCHIRAPPALLI &bull; TAMIL NADU
              </p>
              <span className="w-6 sm:w-10 h-[1px] bg-gradient-to-l from-transparent to-amber-400/60" />
            </div>
            <p className="font-institutional-serif text-[9px] sm:text-[10px] md:text-xs tracking-wider text-amber-300/80 font-medium uppercase mt-0.5">
              DEPARTMENT OF COMMERCE &bull; FINXYORA 2026
            </p>
          </div>

          {/* Right: Symmetrical Department / Festival / Accreditation Emblem Badge */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Symmetrical Emblem Box */}
            <div className="hidden sm:flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border border-amber-500/40 bg-black/30 shadow-inner group hover:border-amber-400 transition-colors">
              <div className="flex items-center gap-1.5 text-amber-300">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="font-institutional-serif text-[11px] font-bold tracking-wider text-amber-200 uppercase">
                  NAAC &lsquo;A++&rsquo;
                </span>
              </div>
              <span className="font-institutional-serif text-[9px] text-amber-400/80 tracking-widest uppercase">
                CGPA 3.58 / 4.0
              </span>
              <span className="text-[8px] font-semibold text-amber-300/60 tracking-tight uppercase">
                NIRF TOP 50 RANKED
              </span>
            </div>

            {/* Mobile Hamburger Menu Toggle */}
            <div className="flex md:hidden items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-amber-200 hover:text-white rounded-lg border border-amber-500/30 bg-black/25"
                aria-label="Toggle navigation menu"
              >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

        </div>

        {/* ============================================================== */}
        {/* BOTTOM TIER: Centered Navigation Menu */}
        {/* ============================================================== */}
        <nav className="hidden md:flex items-center justify-center py-2 relative">
          <div className="flex items-center gap-8 lg:gap-14">
            {primaryLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative py-1 font-institutional-serif text-sm tracking-widest uppercase font-semibold transition-all group ${
                    active ? 'text-amber-200' : 'text-slate-200 hover:text-amber-200'
                  }`}
                >
                  <span>{link.label}</span>

                  {/* Active Warm Gold Underline Indicator */}
                  {active && (
                    <span className="absolute -bottom-1.5 left-0 right-0 h-[2.5px] bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 gold-nav-indicator rounded-full" />
                  )}

                  {/* Hover Warm Gold Underline (when not active) */}
                  {!active && (
                    <span className="absolute -bottom-1.5 left-1/2 right-1/2 h-[2px] bg-amber-400/80 group-hover:left-0 group-hover:right-0 transition-all duration-300 rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Quick subtle secondary links on the right corner of bottom tier */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-4 text-xs font-institutional-serif">
            <Link
              href="/stalls"
              className="text-amber-200/80 hover:text-amber-100 transition-colors tracking-wider uppercase text-[11px]"
            >
              Stalls
            </Link>
            <span className="text-amber-500/40">&bull;</span>
            <Link
              href="/lookup"
              className="text-amber-200/80 hover:text-amber-100 transition-colors tracking-wider uppercase text-[11px]"
            >
              Lookup
            </Link>
          </div>
        </nav>

      </div>

      {/* ============================================================== */}
      {/* MOBILE DRAWER: Institutional Styled Drawer */}
      {/* ============================================================== */}
      {isOpen && (
        <div className="md:hidden banner-maroon-gradient border-b-2 border-amber-500/40 px-4 pt-3 pb-6 space-y-2 animate-fadeIn shadow-2xl">
          <div className="space-y-1">
            {primaryLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl font-institutional-serif text-sm tracking-widest uppercase transition-all ${
                    active
                      ? 'text-amber-200 bg-amber-500/20 border border-amber-500/40 font-bold'
                      : 'text-slate-200 hover:text-amber-200 hover:bg-black/30'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-amber-500/20 space-y-1.5">
            {secondaryLinks.map((sec) => (
              <Link
                key={sec.href}
                href={sec.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-institutional-serif tracking-wider text-amber-200/80 hover:text-white hover:bg-black/20"
              >
                {sec.icon && <sec.icon className="w-4 h-4 text-amber-400" />}
                {sec.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
