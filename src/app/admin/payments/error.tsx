'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, ArrowLeft, Shield } from 'lucide-react';

export default function AdminPaymentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin Payments Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="py-12 px-4 max-w-xl mx-auto space-y-6 text-center animate-fadeIn">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
        <AlertCircle className="w-7 h-7" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white tracking-tight">Payments Section Recovery</h2>
        <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
          {error?.message || 'An error occurred while loading payment transactions.'}
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white flex items-center gap-2 shadow-lg shadow-sky-500/25 transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>

        <Link
          href="/admin/login"
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 flex items-center gap-2 transition-all"
        >
          <Shield className="w-4 h-4" /> Re-authenticate
        </Link>

        <Link
          href="/admin"
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
      </div>
    </div>
  );
}
