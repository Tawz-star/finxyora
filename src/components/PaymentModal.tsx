'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  QrCode,
  CreditCard,
  RefreshCw,
  X,
  ExternalLink,
  Smartphone,
  CheckCircle2
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
  // Client-generated identifiers
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [registrationId, setRegistrationId] = useState<string>('');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedIntent, setCopiedIntent] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const MERCHANT_VPA = 'finxyora@okaxis';
  const MERCHANT_NAME = 'FINXYORA 2026';

  // Step 2 & 3: Generate client-side tokens and render dynamic canvas QR without any network call
  useEffect(() => {
    if (!isOpen) return;

    // Reset state
    setErrorMessage(null);
    setSuccessMessage(null);
    setUtrNumber('');

    const now = Date.now();
    const hex = Math.random().toString(16).substring(2, 8).toUpperCase();
    const generatedPaymentId = `FX-PAY-${now}-${hex}`;
    const generatedRegId =
      initialReferenceId ||
      (referenceType === 'event' ? `FX-EVT-${now}` : `FX-STL-${now}`);

    setPaymentIntentId(generatedPaymentId);
    setRegistrationId(generatedRegId);

    // Standard NPCI UPI URI string
    const upiUri = `upi://pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(
      MERCHANT_NAME
    )}&am=${amount.toFixed(2)}&cu=INR&tn=${generatedPaymentId}`;

    // Render directly on HTML5 <canvas>
    setTimeout(() => {
      if (canvasRef.current) {
        QRCode.toCanvas(
          canvasRef.current,
          upiUri,
          {
            width: 240,
            margin: 1,
            color: {
              dark: '#030712',
              light: '#ffffff'
            }
          },
          (err) => {
            if (err) console.error('Canvas QR rendering error:', err);
          }
        );
      }
    }, 50);
  }, [isOpen, amount, referenceType, initialReferenceId]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, type: 'upi' | 'intent') => {
    navigator.clipboard.writeText(text);
    if (type === 'upi') {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } else {
      setCopiedIntent(true);
      setTimeout(() => setCopiedIntent(false), 2000);
    }
  };

  // Step 4: Single submission to /api/payments/confirm
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUtr = utrNumber.trim();
    if (!cleanUtr) {
      setErrorMessage('Please enter the 12-digit UPI Reference Number / UTR from your payment receipt.');
      return;
    }

    if (cleanUtr.length < 6) {
      setErrorMessage('UTR / Transaction reference must be at least 6 characters (usually 12 digits).');
      return;
    }

    setIsProcessing(true);

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

      setSuccessMessage('Payment verified & registration confirmed successfully!');
      setTimeout(() => {
        onPaymentSuccess(data.redirectUrl || `/confirmation/${registrationId}`);
      }, 900);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Confirmation error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper for instant quick-test in development / testing environments
  const handleSimulateQuickTest = () => {
    const randomUtr = `UPI${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    setUtrNumber(randomUtr);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/30 shadow-2xl my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/80 transition-colors"
          disabled={isProcessing}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-500 flex items-center justify-center p-0.5 shadow-lg shadow-sky-500/30 mb-3">
            <div className="w-full h-full bg-slate-950/90 rounded-[14px] flex items-center justify-center">
              <QrCode className="w-6 h-6 text-sky-400" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            UPI Dynamic QR Payment
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Intent ID: <span className="font-mono text-sky-300 font-semibold">{paymentIntentId}</span>
          </p>
        </div>

        {/* Pricing Summary Box */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-sky-500/20 mb-5 flex items-center justify-between">
          <div className="max-w-[70%]">
            <span className="text-[11px] text-slate-400 block font-medium uppercase tracking-wider">
              {referenceType === 'event' ? 'Event Registration' : 'Festival Stall Booking'}
            </span>
            <span className="text-sm font-bold text-white line-clamp-1">{itemTitle}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
              Reg ID: {registrationId}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-medium uppercase tracking-wider">Total Fee</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">₹{amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Canvas QR Code Display */}
        <div className="flex flex-col items-center justify-center mb-5">
          <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-sky-400/40 relative">
            <canvas ref={canvasRef} className="rounded-lg max-w-full" />
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-sky-500 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow">
              NPCI UPI Instant
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
            <span>Scan with GPay, PhonePe, Paytm, or BHIM</span>
          </div>
        </div>

        {/* Merchant VPA Copy Box */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <span className="text-slate-400">Merchant UPI ID:</span>
            <div className="flex items-center gap-2">
              <code className="text-sky-300 font-mono font-bold">{MERCHANT_VPA}</code>
              <button
                type="button"
                onClick={() => copyToClipboard(MERCHANT_VPA, 'upi')}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                title="Copy UPI ID"
              >
                {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <span className="text-slate-400">Payment Intent Reference:</span>
            <div className="flex items-center gap-2">
              <code className="text-slate-300 font-mono text-[11px]">{paymentIntentId}</code>
              <button
                type="button"
                onClick={() => copyToClipboard(paymentIntentId, 'intent')}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                title="Copy Intent ID"
              >
                {copiedIntent ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Error / Success Feedback */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <p className="leading-relaxed">{successMessage}</p>
          </div>
        )}

        {/* Confirmation Form (UTR Input) */}
        <form onSubmit={handleConfirmPayment} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-200">
                Enter 12-Digit UPI Reference / UTR Number <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={handleSimulateQuickTest}
                className="text-[10px] text-sky-400 hover:text-sky-300 underline font-medium"
              >
                Auto-fill test UTR
              </button>
            </div>
            <input
              type="text"
              required
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value)}
              placeholder="e.g. 528394819203 or Bank Ref ID"
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs text-white font-mono placeholder:font-sans"
              disabled={isProcessing}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Find this 12-digit number in your GPay / PhonePe / Paytm payment receipt under "UPI Transaction ID" or "UTR".
            </p>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:to-sky-300 text-white shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Confirming Registration with Backend...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm Payment &amp; Issue Pass</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Encrypted Client Pipeline &bull; Direct Backend Verification &bull; Notification sent to finxyora@gmail.com
          </p>
        </div>

      </div>
    </div>
  );
}
