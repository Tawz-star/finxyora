'use client';

import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate?: string;
}

export default function CountdownTimer({ targetDate = '2026-10-24T09:00:00' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (timeLeft.isExpired) {
    return (
      <div className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold text-sm">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        Festival is Currently Live!
      </div>
    );
  }

  const units = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ];

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
      {units.map((unit, index) => (
        <div
          key={index}
          className="flex flex-col items-center justify-center p-3 sm:p-4 w-20 sm:w-24 rounded-2xl glass-card border border-sky-500/30 shadow-lg shadow-sky-500/10"
        >
          <span className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
            {String(unit.value).padStart(2, '0')}
          </span>
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-sky-400/90 mt-1">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
