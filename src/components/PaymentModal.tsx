'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Clock,
  ArrowRight
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

// Dynamic fallback builder if server pre-creation is offline
function buildUpiUrl(amount: number, refId: string): string {
  const note = encodeURIComponent(`FINXYORA 2026 - ${refId}`);
  const vpa = encodeURIComponent(MERCHANT_VPA);
  const name = encodeURIComponent(MERCHANT_NAME);
  const ref = encodeURIComponent(refId);
  return `upi://pay?pa=${vpa}&pn=${name}&am=${amount.toFixed(2)}&cu=INR&tn=${note}&tr=${ref}`;
}

function buildQrImageUrl(upiUrl: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=M&margin=10&data=${encodeURIComponent(upiUrl)}`;
}

type PaymentStep = 'loading_order' | 'scan' | 'enter_utr' | 'submitting' | 'review_required' | 'verified_success';

export default function PaymentModal({
  isOpen,
  onClose,
  referenceType,
  amount: initialAmount,
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
  const [serverAmount, setServerAmount] = useState<number>(initialAmount);
  const [upiUrl, setUpiUrl] = useState<string>('');
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [step, setStep] = useState<PaymentStep>('loading_order');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusCheckMessage, setStatusCheckMessage] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrError, setQrError] = useState(false);
  const utrInputRef = useRef<HTMLInputElement>(null);

  // Initialize server-side payment order on open
  useEffect(() => {
    if (!isOpen) return;

    setStep('loading_order');
    setErrorMessage(null);
    setStatusCheckMessage(null);
    setUtrNumber('');
    setQrLoaded(false);
    setQrError(false);

    let isMounted = true;

    // Contact backend to validate and create order
    fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceType,
        eventData,
        stallData,
        registrationId: initialReferenceId
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to initialize payment order on server.');
        return data;
      })
      .then((order) => {
        if (!isMounted) return;
        setRegistrationId(order.registrationId);
        setPaymentIntentId(order.paymentId);
        setServerAmount(Number(order.amount || initialAmount));
        setUpiUrl(order.upiUrl);
        setQrImageUrl(order.qrImageUrl);

        if (order.status === 'PAID') {
          setStep('verified_success');
        } else if (order.status === 'REVIEW_REQUIRED') {
          setStep('review_required');
        } else {
          setStep('scan');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Server order pre-creation failed, using direct client parameters:', err);
        // Resilient fallback
        const now = Date.now();
        const fallbackReg = initialReferenceId || (referenceType === 'event' ? `FIN-EVT-${now}` : `FIN-STL-${now}`);
        const fallbackPay = `PAY-${fallbackReg}-${now.toString().slice(-6)}`;
        setRegistrationId(fallbackReg);
        setPaymentIntentId(fallbackPay);
        setServerAmount(initialAmount);

        const upi = buildUpiUrl(initialAmount, fallbackPay);
        setUpiUrl(upi);
        setQrImageUrl(buildQrImageUrl(upi));
        setStep('scan');
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, referenceType, eventData, stallData, initialReferenceId, initialAmount]);

  // Focus UTR input when step changes to enter_utr
  useEffect(() => {
    if (step === 'enter_utr') {
      setTimeout(() => utrInputRef.current?.focus(), 100);
    }
  }, [step]);

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

  // Submit 12-digit UTR reference
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUtr = utrNumber.trim().replace(/\s/g, '');
    if (!cleanUtr) {
      setErrorMessage('Please enter the UPI Transaction ID / UTR number from your payment receipt.');
      return;
    }
    if (cleanUtr.length < 6) {
      setErrorMessage('UTR must be at least 6 characters (typically a 12-digit bank reference number).');
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
          expectedAmount: serverAmount,
          utrNumber: cleanUtr,
          timestamp: Date.now(),
          eventData,
          stallData
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment confirmation failed');

      // Authentic verification rule:
      // Direct UPI is recorded as REVIEW_REQUIRED, not fabricated auto-success!
      if (data.status === 'PAID') {
        setStep('verified_success');
        setTimeout(() => {
          onPaymentSuccess(data.redirectUrl || `/confirmation/${registrationId}`);
        }, 2000);
      } else {
        setStep('review_required');
      }
    } catch (err: unknown) {
      setStep('enter_utr');
      setErrorMessage(err instanceof Error ? err.message : 'Confirmation error. Please try again.');
    }
  };

  // Manual status check query
  const handleCheckStatus = useCallback(async () => {
    if (!paymentIntentId && !registrationId) return;
    setCheckingStatus(true);
    setStatusCheckMessage(null);

    try {
      const idToQuery = paymentIntentId || registrationId;
      const res = await fetch(`/api/payments/verify?paymentId=${encodeURIComponent(idToQuery)}`);
      const data = await res.json();

      if (data.isVerified || data.status === 'PAID') {
        setStep('verified_success');
        setTimeout(() => {
          onPaymentSuccess(`/confirmation/${registrationId}`);
        }, 1500);
      } else if (data.status === 'REVIEW_REQUIRED') {
        setStatusCheckMessage('Your UTR is currently queued for manual reconciliation against bank statements. Spot confirmed upon verification.');
      } else {
        setStatusCheckMessage(data.message || 'Payment status: ' + data.status);
      }
    } catch {
      setStatusCheckMessage('Unable to connect to status endpoint right now. Please try again.');
    } finally {
      setCheckingStatus(false);
    }
  }, [paymentIntentId, registrationId, onPaymentSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-md rounded-3xl glass-panel border border-sky-500/30 shadow-2xl my-8 overflow-hidden">

        {/* Top gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-400" />

        <div className="p-6 sm:p-8">

          {/* Close */}
          {step !== 'submitting' && (
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/80 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* ─── STEP: LOADING ORDER ─── */}
          {step === 'loading_order' && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Generating Payment Order...</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Validating fee rules &amp; reserving spot in Central SQL Database
                </p>
              </div>
            </div>
          )}

          {/* ─── STEP: SCAN ─── */}
          {step === 'scan' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[11px] font-bold mb-3">
                  <Zap className="w-3 h-3" />
                  Direct UPI Payment — Exact Amount Pre-filled
                </div>
                <h3 className="text-xl font-black text-white">Scan &amp; Pay</h3>
                <p className="text-xs text-slate-400 mt-1">Open GPay, PhonePe, Paytm or BHIM and scan below</p>
              </div>

              {/* Amount badge with server-calculated verification */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-sky-950/80 to-blue-950/60 border border-sky-500/30">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                    {referenceType === 'event' ? 'Event Fee (₹50 / Participant)' : 'Stall Booking Package'}
                  </span>
                  <span className="text-xs text-slate-300 line-clamp-1 mt-0.5">{itemTitle}</span>
                  {registrationId && (
                    <span className="text-[10px] text-sky-300 font-mono font-bold block mt-1">
                      ID: {registrationId}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pay Exactly</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">₹{serverAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Dynamic QR Code */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative p-3 bg-white rounded-2xl shadow-2xl border-4 border-sky-400/60">
                  {!qrLoaded && !qrError && (
                    <div className="w-[240px] h-[240px] flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] text-slate-500 font-mono">Rendering QR...</span>
                    </div>
                  )}

                  {qrError && (
                    <div className="w-[240px] h-[240px] flex flex-col items-center justify-center gap-3 text-center px-4">
                      <QrCode className="w-10 h-10 text-slate-400" />
                      <p className="text-xs text-slate-600">QR unavailable offline.<br />Use UPI ID below to pay manually.</p>
                      <button
                        onClick={() => { setQrError(false); setQrLoaded(false); setQrImageUrl(buildQrImageUrl(upiUrl)); }}
                        className="text-[11px] text-sky-500 underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImageUrl}
                    alt={`UPI QR Code — Pay ₹${serverAmount} to FINXYORA 2026`}
                    width={240}
                    height={240}
                    className={`rounded-lg object-contain transition-opacity ${qrLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
                    onLoad={() => setQrLoaded(true)}
                    onError={() => setQrError(true)}
                  />

                  {/* Watermark on QR */}
                  {qrLoaded && (
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black uppercase px-3 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                      ₹{serverAmount.toFixed(2)} — {MERCHANT_NAME}
                    </div>
                  )}
                </div>

                {/* Merchant Information */}
                <div className="mt-3 text-center">
                  <span className="text-xs text-white font-bold">{MERCHANT_NAME}</span>
                  <span className="text-[11px] text-slate-400 block font-mono">UPI: {MERCHANT_VPA}</span>
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
                    onClick={() => copyToClipboard(serverAmount.toFixed(2), 'amount')}
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

                {/* Mobile direct tap button */}
                <a
                  href={upiUrl}
                  className="sm:hidden w-full mt-1 py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-green-600 to-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
                >
                  <Smartphone className="w-4 h-4" />
                  Tap to Pay ₹{serverAmount.toFixed(2)} in UPI App
                </a>
              </div>

              {/* Step instructions */}
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">How to pay:</p>
                {[
                  'Scan QR with GPay, PhonePe, Paytm or BHIM',
                  `Pay exactly ₹${serverAmount.toFixed(2)} — amount is pre-filled`,
                  'Complete the payment in your UPI app',
                  'Return here and enter the 12-digit UPI Transaction ID (UTR)'
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[11px] text-slate-400">
                    <span className="w-4 h-4 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {s}
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

              <p className="text-[10px] text-slate-500 text-center font-mono">
                Order Ref: {paymentIntentId || registrationId}
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
                  Open your UPI payment receipt and enter the <strong className="text-white">12-Digit Reference / UTR Number</strong>
                </p>
              </div>

              {/* Amount reminder */}
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-300 font-semibold block">Expected Amount:</span>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {registrationId}</span>
                </div>
                <span className="text-lg font-black text-emerald-400 font-mono">₹{serverAmount.toFixed(2)}</span>
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
                    placeholder="e.g. 528394819203 (12-digit UTR)"
                    className="w-full px-4 py-3.5 rounded-xl glass-input text-sm text-white font-mono placeholder:font-sans placeholder:text-slate-600 tracking-wider"
                    autoComplete="off"
                    inputMode="text"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Found in your UPI app receipt → &quot;UPI Ref No.&quot; or &quot;UTR&quot; or &quot;Transaction ID&quot;.
                  </p>
                </div>

                {/* Where to find UTR visual card */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-300">Where to find your UTR:</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400">
                    <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700">
                      <span className="text-green-400 font-bold block">GPay</span>
                      UPI Transaction ID
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700">
                      <span className="text-purple-400 font-bold block">PhonePe</span>
                      UTR Number
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700">
                      <span className="text-sky-400 font-bold block">Paytm</span>
                      UPI Ref No.
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/20 text-[11px] text-sky-300 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
                  <p>
                    Submitted UTR references are logged in the central SQL ledger and reconciled against our bank records before registration confirmation.
                  </p>
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
                    Submit For Verification
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ─── STEP: SUBMITTING ─── */}
          {step === 'submitting' && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Recording Payment Reference...</h3>
                <p className="text-xs text-slate-400 mt-1">Connecting to Central FINXYORA Database</p>
              </div>
            </div>
          )}

          {/* ─── STEP: REVIEW REQUIRED (ACCURATE DIRECT UPI FLOW) ─── */}
          {step === 'review_required' && (
            <div className="py-6 flex flex-col items-center justify-center gap-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-400" />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold mb-2">
                  <Clock className="w-3 h-3" />
                  STATUS: REVIEW REQUIRED (Verification Pending)
                </div>
                <h3 className="text-xl font-black text-white">Payment Submitted for Verification</h3>
                <p className="text-xs text-slate-300 mt-2 max-w-sm mx-auto leading-relaxed">
                  Payment received or submitted for verification. Your registration will be confirmed after payment verification against bank records.
                </p>
              </div>

              <div className="w-full p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-left text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Registration ID</span>
                  <span className="text-sky-300 font-mono font-bold">{registrationId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Amount Due</span>
                  <span className="text-emerald-400 font-mono font-bold">₹{serverAmount.toFixed(2)}</span>
                </div>
                {utrNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Submitted UTR</span>
                    <span className="text-amber-300 font-mono font-bold">{utrNumber}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Payee Account</span>
                  <span className="text-white font-medium">{MERCHANT_NAME} ({MERCHANT_VPA})</span>
                </div>
              </div>

              {statusCheckMessage && (
                <div className="w-full p-3 rounded-xl bg-sky-950/60 border border-sky-500/30 text-sky-300 text-xs text-left flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{statusCheckMessage}</span>
                </div>
              )}

              <div className="w-full space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={checkingStatus}
                  className="w-full py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                  {checkingStatus ? 'Checking Verification Ledger...' : 'Check Payment Status'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.location.href = `/confirmation/${registrationId}`;
                  }}
                  className="w-full py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
                >
                  <span>View Official Registration Pass</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP: VERIFIED SUCCESS ─── */}
          {step === 'verified_success' && (
            <div className="py-8 flex flex-col items-center justify-center gap-5 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 flex items-center justify-center animate-pulse">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-white">Payment Verified!</h3>
                <p className="text-xs text-emerald-300 font-semibold mt-1">Registration Confirmed</p>
                <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto">
                  Your payment has been authoritatively verified in the central ledger. Your participation pass is ready.
                </p>
              </div>

              <div className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2 text-left text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Registration ID</span>
                  <span className="text-white font-mono font-bold">{registrationId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Verified Amount</span>
                  <span className="text-emerald-400 font-mono font-bold">₹{serverAmount.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onPaymentSuccess(`/confirmation/${registrationId}`);
                }}
                className="w-full py-3.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
              >
                <span>Proceed to Confirmation Pass</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
