'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Trophy,
  Store,
  Users,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  Download,
  FileSpreadsheet,
  Activity
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === '/admin/login';

  const navItems = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Events', href: '/admin/events', icon: Trophy },
    { label: 'Stalls', href: '/admin/stalls', icon: Store },
    { label: 'Registrations', href: '/admin/registrations', icon: Users },
    { label: 'Payments', href: '/admin/payments', icon: CreditCard },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
    } catch {
      router.push('/admin/login');
    }
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#07152f] pb-20">
      
      {/* Top Admin Sub-Navbar */}
      <header className="border-b border-sky-500/20 bg-slate-950/80 backdrop-blur-xl sticky top-20 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            
            {/* Left title & badge */}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs font-bold font-mono">
                <Shield className="w-3.5 h-3.5" />
                ADMIN CONSOLE
              </span>
              <span className="hidden sm:inline text-xs text-slate-400">
                FinTech Association Management Suite
              </span>
            </div>

            {/* Right Export and Logout buttons */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <a
                  href="/api/admin/export?type=events"
                  download
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 hover:border-sky-500/30 flex items-center gap-1.5 transition-colors"
                  title="Export all event registrations as CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export Events CSV</span>
                </a>

                <a
                  href="/api/admin/export?type=stalls"
                  download
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 hover:border-emerald-500/30 flex items-center gap-1.5 transition-colors"
                  title="Export all stall bookings as CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export Stalls CSV</span>
                </a>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 transition-colors ml-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>

          </div>

          {/* Sub-nav Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto py-2 -mb-px border-t border-slate-900">
            {navItems.map((item) => {
              const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    active
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

        </div>
      </header>

      {/* Main Admin Page Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {children}
      </div>

    </div>
  );
}
