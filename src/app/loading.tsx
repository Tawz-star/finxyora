import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 animate-fadeIn">
      {/* Top indeterminate progress line */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-indigo-500 animate-pulse z-50" />

      {/* Futuristic Spinner */}
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-12 h-12 rounded-full border-2 border-sky-500/20 border-t-sky-400 animate-spin" />
        <div className="absolute w-6 h-6 rounded-full border-2 border-indigo-500/30 border-b-indigo-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-sky-400 uppercase">
        FINXYORA
      </span>
      <span className="text-[11px] text-slate-400 mt-1 font-mono">
        Optimizing Arena Data...
      </span>
    </div>
  );
}
