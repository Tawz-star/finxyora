'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  QrCode,
  RefreshCw,
  X,
  ExternalLink,
  Smartphone,
  CheckCircle2,
  IndianRupee,
  Zap,
  Clock
} from 'lucide-react';

export interface EventRegistrationPayload {
  eventId: string;
  collegeName: string;
  collegeLocation: string;
  teamName?: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  participants: Array<{
    fullName: string;
    rollNumber: string;
    department: string;
    yearOfStudy: string;
    section: string;
  }>;
}

export interface StallBookingPayload {
  optionId: string;
  applicantType: 'student' | 'vendor';
  entityName: string;
  collegeName?: string;
  departmentClass?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessDetails?: string;
  productsServices: string;
  stallsRequested: number;
  durationDays: number;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  referenceType: 'event' | 'stall';
  amount: number;
  itemTitle: string;
  payerEmail: string;
  payerPhone: string;
  eventData?: EventRegistrationPayload;
  stallData?: StallBookingPayload;
  initialReferenceId?: string;
  onPaymentSuccess: (receiptUrl: string) => void;
}

const MERCHANT_VPA = 's.venkatesanraja@okaxis';
const MERCHANT_NAME = 'S.venkatesan';

// Build dynamic UPI payment URL with exact amount pre-filled
function buildUpiUrl(amount: number, refId: string): string {
  const note = encodeURIComponent(`FINXYORA 2026 - ${refId}`);
  const vpa = encodeURIComponent(MERCHANT_VPA);
  const name = encodeURIComponent(MERCHANT_NAME);
  const ref = encodeURIComponent(refId);
  return `upi://pay?pa=${vpa}&pn=${name}&am=${amount.toFixed(2)}&cu=INR&tn=${note}&tr=${ref}`;
}

// Generate QR code image URL via qrserver.com API (free, no install)
function buildQrImageUrl(upiUrl: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=M&margin=10&data=${encodeURIComponent(upiUrl)}`;
}

type PaymentStep = 'scan' | 'enter_utr' | 'submitting' | 'success';

export default function PaymentModal({
  isOpen,
  onClose,
  referenceType,
  amount,
  itemTitle,
  payerEmail,
  payerPhone,
  eventData,
  stallData,
  initialReferenceId,
  onPaymentSuccess
}: PaymentModalProps) {
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [registrationId, setRegistrationId] = useState<string>('');
  const [upiUrl, setUpiUrl] = useState<string>('');
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [step, setStep] = useState<PaymentStep>('scan');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrError, setQrError] = useState(false);
  const utrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    setStep('scan');
    setErrorMessage(null);
    setUtrNumber('');
    setQrLoaded(false);
    setQrError(false);

    const now = Date.now();
    const hex = Math.random().toString(16).substring(2, 8).toUpperCase();
    const intentId = `FX-PAY-${now}-${hex}`;
    const regId = initialReferenceId || (referenceType === 'event' ? `FX-EVT-${now}` : `FX-STL-${now}`);

    setPaymentIntentId(intentId);
    setRegistrationId(regId);

    const upi = buildUpiUrl(amount, intentId);
    setUpiUrl(upi);
    setQrImageUrl(buildQrImageUrl(upi));
  }, [isOpen, amount, referenceType, initialReferenceId]);

  // Focus UTR input when step changes to enter_utr
  useEffect(() => {
    if (step === 'enter_utr') {
      setTimeout(() => utrInputRef.current?.focus(), 100);
    }
  }, [step]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, type: 'upi' | 'amount') => {
    navigator.clipboard.writeText(text).catch(() => {});
    if (type === 'upi') {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } else {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUtr = utrNumber.trim().replace(/\s/g, '');
    if (!cleanUtr) {
      setErrorMessage('Please enter the UPI Transaction ID / UTR number from your payment receipt.');
      return;
    }
    if (cleanUtr.length < 6) {
      setErrorMessage('UTR must be at least 6 characters (usually a 12-digit number).');
      return;
    }

    setStep('submitting');

    try {
      const res = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceType,
          paymentId: paymentIntentId,
          registrationId,
          expectedAmount: amount,
          utrNumber: cleanUtr,
          timestamp: Date.now(),
          eventData,
          stallData
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment confirmation failed');

      setStep('success');
      setTimeout(() => {
        onPaymentSuccess(data.redirectUrl || `/confirmation/${data.registrationId || registrationId}`);
      }, 2000);
    } catch (err: unknown) {
      setStep('enter_utr');
      setErrorMessage(err instanceof Error ? err.message : 'Confirmation error. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-md rounded-3xl glass-panel border border-sky-500/30 shadow-2xl my-8 overflow-hidden">

        {/* Top gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-400" />

        <div className="p-6 sm:p-8">

          {/* Close */}
          {step !== 'submitting' && step !== 'success' && (
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/80 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* ─── STEP: SCAN ─── */}
          {step === 'scan' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[11px] font-bold mb-3">
                  <Zap className="w-3 h-3" />
                  UPI Payment — Exact Amount Pre-filled
                </div>
                <h3 className="text-xl font-black text-white">Scan &amp; Pay</h3>
                <p className="text-xs text-slate-400 mt-1">Open GPay, PhonePe, Paytm or BHIM and scan below</p>
              </div>

              {/* Amount badge */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-sky-950/80 to-blue-950/60 border border-sky-500/30">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                    {referenceType === 'event' ? 'Event Registration Fee' : 'Stall Booking Fee'}
                  </span>
                  <span className="text-xs text-slate-300 line-clamp-1 mt-0.5">{itemTitle}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pay Exactly</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">₹{amount.toFixed(2)}</span>
                </div>
              </div>

              {/* Dynamic QR Code */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative p-3 bg-white rounded-2xl shadow-2xl border-4 border-sky-400/60">
                  {!qrLoaded && !qrError && (
                    <div className="w-[240px] h-[240px] flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] text-slate-500 font-mono">Generating QR...</span>
                    </div>
                  )}

                  {qrError && (
                    <div className="w-[240px] h-[240px] flex flex-col items-center justify-center gap-3 text-center px-4">
                      <QrCode className="w-10 h-10 text-slate-400" />
                      <p className="text-xs text-slate-600">QR unavailable offline.<br />Use UPI ID below to pay manually.</p>
                      <button
                        onClick={() => { setQrError(false); setQrLoaded(false); setQrImageUrl(buildQrImageUrl(buildUpiUrl(amount, paymentIntentId))); }}
                        className="text-[11px] text-sky-500 underline"
                      >Retry</button>
                    </div>
                  )}

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImageUrl}
                    alt={`UPI QR Code — Pay ₹${amount} to FINXYORA 2026`}
                    width={240}
                    height={240}
                    className={`rounded-lg object-contain transition-opacity ${qrLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
                    onLoad={() => setQrLoaded(true)}
                    onError={() => setQrError(true)}
                  />

                  {/* Amount watermark on QR */}
                  {qrLoaded && (
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black uppercase px-3 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                      ₹{amount.toFixed(2)} — {MERCHANT_NAME}
                    </div>
                  )}
                </div>

                {/* Merchant */}
                <div className="mt-3 text-center">
                  <span className="text-xs text-white font-bold">{MERCHANT_NAME}</span>
                  <span className="text-[11px] text-slate-400 block">UPI: {MERCHANT_VPA}</span>
                </div>

                {/* Quick copy row */}
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    onClick={() => copyToClipboard(MERCHANT_VPA, 'upi')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
                  >
                    {copiedUpi ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copy UPI ID
                  </button>
                  <button
                    onClick={() => copyToClipboard(amount.toFixed(2), 'amount')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
                  >
                    {copiedAmount ? <Check className="w-3 h-3 text-emerald-400" /> : <IndianRupee className="w-3 h-3" />}
                    Copy Amount
                  </button>
                  <a
                    href={upiUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 transition-all sm:hidden"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open UPI App
                  </a>
                </div>

                {/* Mobile open button — prominent on phones */}
                <a
                  href={upiUrl}
                  className="sm:hidden w-full mt-1 py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-green-600 to-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
                >
                  <Smartphone className="w-4 h-4" />
                  Tap to Pay ₹{amount.toFixed(2)} in UPI App
                </a>
              </div>

              {/* Instruction steps */}
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">How to pay:</p>
                {[
                  'Scan QR with GPay, PhonePe, Paytm or BHIM',
                  `Pay exactly ₹${amount.toFixed(2)} — amount is pre-filled`,
                  'Complete the payment in your UPI app',
                  'Come back here and click the button below'
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[11px] text-slate-400">
                    <span className="w-4 h-4 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep('enter_utr')}
                className="w-full py-4 rounded-2xl text-sm font-black bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:to-sky-300 text-white shadow-xl shadow-sky-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <CheckCircle2 className="w-5 h-5" />
                I Have Paid — Enter Transaction ID
              </button>

              <p className="text-[10px] text-slate-500 text-center">
                Ref: <span className="font-mono">{paymentIntentId}</span>
              </p>
            </div>
          )}

          {/* ─── STEP: ENTER UTR ─── */}
          {step === 'enter_utr' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-7 h-7 text-sky-400" />
                </div>
                <h3 className="text-xl font-black text-white">Enter Transaction ID</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Open your GPay / PhonePe receipt and copy the <strong className="text-white">UPI Transaction ID</strong> (UTR)
                </p>
              </div>

              {/* Amount reminder */}
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                <span className="text-xs text-emerald-300 font-semibold">Amount paid:</span>
                <span className="text-lg font-black text-emerald-400 font-mono">₹{amount.toFixed(2)}</span>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{errorMessage}</p>
                </div>
              )}

              <form onSubmit={handleConfirmPayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    UPI Transaction ID / UTR <span className="text-rose-400">*</span>
                  </label>
                  <input
                    ref={utrInputRef}
                    id="utr-number-input"
                    type="text"
                    required
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="e.g. 528394819203 (12-digit Bank Ref)"
                    className="w-full px-4 py-3.5 rounded-xl glass-input text-sm text-white font-mono placeholder:font-sans placeholder:text-slate-600 tracking-wider"
                    autoComplete="off"
                    inputMode="text"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Found in your UPI app payment receipt → &quot;Transaction ID&quot; or &quot;UTR&quot; or &quot;Bank Ref No.&quot;
                  </p>
                </div>

                {/* Where to find UTR — visual guide */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-300">Where to find your UTR:</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400">
                    <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700">
                      <span className="text-green-400 font-bold block">GPay</span>
                      Payment receipt → Transaction ID
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700">
                      <span className="text-purple-400 font-bold block">PhonePe</span>
                      History → Transaction ID
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700">
                      <span className="text-sky-400 font-bold block">Paytm</span>
                      Passbook → UTR No.
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep('scan'); setErrorMessage(null); }}
                    className="px-4 py-3 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl text-sm font-black bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    Confirm &amp; Register
                  </button>
                </div>
              </form>

              <p className="text-[10px] text-slate-500 text-center">
                Paying to: <span className="font-mono text-slate-400">{MERCHANT_VPA}</span> &bull; Ref: <span className="font-mono">{paymentIntentId}</span>
              </p>
            </div>
          )}

          {/* ─── STEP: SUBMITTING ─── */}
          {step === 'submitting' && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Submitting Registration...</h3>
                <p className="text-xs text-slate-400 mt-1">Saving to FINXYORA Central Database</p>
              </div>
            </div>
          )}

          {/* ─── STEP: SUCCESS ─── */}
          {step === 'success' && (
            <div className="py-10 flex flex-col items-center justify-center gap-5 text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 flex items-center justify-center animate-pulse">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <div className="absolute inset-0 rounded-full bg-emerald-400/10 animate-ping" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-white">Registration Submitted!</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
                  Your payment has been recorded. Our team will verify the transaction and confirm your spot.
                </p>
              </div>

              <div className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Amount Paid</span>
                  <span className="text-emerald-400 font-black font-mono">₹{amount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">UTR Submitted</span>
                  <span className="text-white font-mono font-bold">{utrNumber}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Confirmation Email</span>
                  <span className="text-sky-300 font-semibold truncate max-w-[55%]">{payerEmail}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2.5">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Confirmation may take a few hours. Check your email.</span>
              </div>

              <p className="text-[10px] text-slate-500">Redirecting to your confirmation page...</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
