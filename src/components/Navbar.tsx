'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, Menu, X, Shield, Search, Calendar, Store, Trophy, Info } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Events', href: '/events', icon: Trophy },
    { label: 'Book Stall', href: '/stalls', icon: Store },
    { label: 'Verify / Lookup', href: '/lookup', icon: Search },
    { label: 'About', href: '/about/commerce', icon: Info },
    { label: 'Contact', href: '/contact', icon: Calendar },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-sky-500/20 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-sky-500 to-indigo-500 flex items-center justify-center p-0.5 shadow-lg shadow-sky-500/30 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950/80 rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-sky-400 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-wider gradient-text font-sans">
                FINXYORA
              </span>
              <span className="text-[10px] uppercase tracking-widest text-sky-400/80 font-semibold -mt-1">
                FinTech Festival 2026
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'text-sky-300 bg-sky-500/10 border border-sky-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/lookup"
              className="p-2 text-slate-400 hover:text-sky-300 hover:bg-slate-800/60 rounded-lg transition-colors border border-transparent hover:border-sky-500/30"
              title="Lookup Registration"
            >
              <Search className="w-4 h-4" />
            </Link>

            <Link
              href="/admin"
              className="p-2 text-slate-400 hover:text-sky-300 hover:bg-slate-800/60 rounded-lg transition-colors border border-transparent hover:border-sky-500/30"
              title="Admin Portal"
            >
              <Shield className="w-4 h-4" />
            </Link>

            <Link
              href="/events"
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Register Now
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-sky-500/20"
              aria-label="Toggle navigation menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isOpen && (
        <div className="md:hidden glass-panel border-b border-sky-500/30 px-4 pt-2 pb-6 space-y-2 animate-fadeIn">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                  active
                    ? 'text-sky-300 bg-sky-500/15 border border-sky-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {link.icon && <link.icon className="w-5 h-5 text-sky-400" />}
                {link.label}
              </Link>
            );
          })}

          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
            <Link
              href="/events"
              onClick={() => setIsOpen(false)}
              className="w-full py-3 text-center rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md shadow-sky-500/30"
            >
              Register for Events
            </Link>
            <Link
              href="/stalls"
              onClick={() => setIsOpen(false)}
              className="w-full py-3 text-center rounded-xl text-sm font-semibold bg-slate-800/80 hover:bg-slate-700 text-sky-300 border border-sky-500/30"
            >
              Book a Festival Stall
            </Link>
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              className="w-full py-2.5 text-center rounded-xl text-xs font-medium text-slate-400 hover:text-white flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4 text-sky-400" />
              FinTech Association Admin Portal
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
