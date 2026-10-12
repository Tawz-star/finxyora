'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  X,
  Smartphone,
  CheckCircle2,
  IndianRupee,
  Zap,
  ArrowRight,
  CreditCard,
  Lock,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

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
  applicantType: 'student' | 'vendor' | 'outsider';
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
  selectedDay?: string;
  bookingDates?: string;
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

interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

type PaymentStep =
  | 'loading_order'
  | 'ready_to_pay'
  | 'verifying_signature'
  | 'verified_success'
  | 'payment_failed';

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
  const [step, setStep] = useState<PaymentStep>('loading_order');
  const [razorpayOrderId, setRazorpayOrderId] = useState<string>('');
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('');
  const [registrationId, setRegistrationId] = useState<string>(initialReferenceId || '');
  const [verifiedPaymentId, setVerifiedPaymentId] = useState<string>('');
  const [serverAmount, setServerAmount] = useState<number>(initialAmount);
  const [amountInPaise, setAmountInPaise] = useState<number>(initialAmount * 100);
  const [currency, setCurrency] = useState<string>('INR');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSdkLoaded, setIsSdkLoaded] = useState<boolean>(false);
  const [isLaunchingCheckout, setIsLaunchingCheckout] = useState<boolean>(false);

  const payerName =
    eventData?.leaderName ||
    eventData?.participants?.[0]?.fullName ||
    stallData?.contactName ||
    'Participant';
  const registeredEmail = payerEmail || eventData?.leaderEmail || stallData?.contactEmail || '';
  const registeredPhone = payerPhone || eventData?.leaderPhone || stallData?.contactPhone || '';

  // 1. Dynamically Load Official Razorpay Checkout Script
  useEffect(() => {
    if (!isOpen) return;

    const scriptId = 'razorpay-checkout-sdk';
    if (document.getElementById(scriptId)) {
      setIsSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setIsSdkLoaded(true);
    script.onerror = () => {
      console.warn('Failed to load Razorpay Checkout SDK from CDN.');
    };
    document.body.appendChild(script);
  }, [isOpen]);

  // 2. Initialize Backend Order on Modal Open
  useEffect(() => {
    if (!isOpen) return;

    setStep('loading_order');
    setErrorMessage(null);
    setVerifiedPaymentId('');

    let isMounted = true;

    fetch('/api/payments/create-order', {
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
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create payment order on server.');
        }
        return data;
      })
      .then((order) => {
        if (!isMounted) return;
        setRazorpayOrderId(order.order_id || order.orderId);
        setRazorpayKeyId(order.keyId || '');
        setRegistrationId(order.registrationId);
        setServerAmount(Number(order.amountInInr || initialAmount));
        setAmountInPaise(Number(order.amount || initialAmount * 100));
        setCurrency(order.currency || 'INR');
        setStep('ready_to_pay');
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Order creation error:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Unable to initialize order.');
        setStep('payment_failed');
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, referenceType, eventData, stallData, initialReferenceId, initialAmount]);

  // 3. Complete and Verify Payment using Backend Signature Endpoint
  const handleVerifyTokens = useCallback(
    async (tokens: RazorpayCheckoutResponse) => {
      setStep('verifying_signature');
      setErrorMessage(null);

      try {
        const verifyRes = await fetch('/api/payments/verify-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: tokens.razorpay_order_id,
            razorpay_payment_id: tokens.razorpay_payment_id,
            razorpay_signature: tokens.razorpay_signature,
            registrationId,
            referenceType
          })
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.success) {
          throw new Error(verifyData.error || 'Payment signature verification failed.');
        }

        setVerifiedPaymentId(tokens.razorpay_payment_id);
        setStep('verified_success');

        // Trigger celebratory confetti
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch {
          // Ignore confetti errors if canvas unavailable
        }

        // Auto-redirect after 2.5s
        setTimeout(() => {
          onPaymentSuccess(verifyData.redirectUrl || `/confirmation/${registrationId}`);
        }, 2500);
      } catch (err) {
        console.error('Verification error:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'Cryptographic signature verification failed.'
        );
        setStep('payment_failed');
      }
    },
    [registrationId, referenceType, onPaymentSuccess]
  );

  // 4. Launch Razorpay Checkout Popup
  const handleOpenRazorpayCheckout = () => {
    if (!razorpayOrderId) {
      setErrorMessage('Order is not initialized yet. Please wait.');
      return;
    }

    setIsLaunchingCheckout(true);
    setErrorMessage(null);

    // If real Razorpay key is configured and SDK is loaded
    if (typeof window !== 'undefined' && (window as any).Razorpay && razorpayKeyId && razorpayKeyId !== 'rzp_test_placeholder') {
      const options = {
        key: razorpayKeyId,
        amount: amountInPaise,
        currency: currency,
        name: 'FINXYORA 2026',
        description: itemTitle,
        order_id: razorpayOrderId,
        prefill: {
          name: payerName,
          email: registeredEmail,
          contact: registeredPhone
        },
        theme: {
          color: '#0284c7'
        },
        handler: function (response: RazorpayCheckoutResponse) {
          setIsLaunchingCheckout(false);
          handleVerifyTokens(response);
        },
        modal: {
          ondismiss: function () {
            setIsLaunchingCheckout(false);
          }
        }
      };

      try {
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          setIsLaunchingCheckout(false);
          setErrorMessage(resp.error?.description || 'Payment was declined by bank or user.');
        });
        rzp.open();
      } catch (err) {
        setIsLaunchingCheckout(false);
        setErrorMessage('Failed to open Razorpay modal: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } else {
      // Sandbox / Mock Mode when Razorpay Key is not set or in test mode
      console.warn('Sandbox / Simulated checkout triggered.');
      setIsLaunchingCheckout(false);
      // Simulate authentic token generation for sandbox test
      const testPaymentId = `pay_test_${Date.now().toString(36)}`;
      const testSignature = `test_${Date.now()}`;
      handleVerifyTokens({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: testPaymentId,
        razorpay_signature: testSignature
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white">
        {/* Glow ambient background effect */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative px-6 py-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Automated Razorpay Checkout
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Instant Verification
                </span>
              </h2>
              <p className="text-xs text-slate-400">Zero manual transaction ID verification</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative p-6 space-y-6">

          {/* ─── STEP: LOADING ORDER ─── */}
          {step === 'loading_order' && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shadow-lg shadow-sky-500/20">
                <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Initializing Razorpay Order...</h3>
                <p className="text-xs text-slate-400 mt-1">Generating unique order tokens with Razorpay API</p>
              </div>
            </div>
          )}

          {/* ─── STEP: READY TO PAY ─── */}
          {step === 'ready_to_pay' && (
            <div className="space-y-5">
              {/* Order summary card */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Item / Competition
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5 line-clamp-1">{itemTitle}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Amount Due
                    </span>
                    <p className="text-xl font-black text-emerald-400">
                      ₹{serverAmount.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/40 flex justify-between text-xs text-slate-300">
                  <span className="text-slate-400">Registration ID:</span>
                  <span className="font-mono font-semibold text-sky-300">{registrationId}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="text-slate-400">Order Reference:</span>
                  <span className="font-mono text-slate-400">{razorpayOrderId}</span>
                </div>
              </div>

              {/* Supported payment badges */}
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-300">
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 flex flex-col items-center gap-1">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  <span>UPI / QR / Apps</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 flex flex-col items-center gap-1">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span>Cards & NetBanking</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 flex flex-col items-center gap-1">
                  <Lock className="w-4 h-4 text-blue-400" />
                  <span>256-Bit Encrypted</span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Main Checkout Button */}
              <button
                onClick={handleOpenRazorpayCheckout}
                disabled={isLaunchingCheckout}
                className="w-full py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:to-sky-300 text-white shadow-xl shadow-sky-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isLaunchingCheckout ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Opening Razorpay Gateway...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Pay ₹{serverAmount.toFixed(2)} with Razorpay
                  </>
                )}
              </button>

              <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                Clicking above launches Razorpay. Upon completing payment, your status updates to{' '}
                <strong className="text-white">PAID</strong> automatically with an official pass generated.
              </p>
            </div>
          )}

          {/* ─── STEP: VERIFYING SIGNATURE ─── */}
          {step === 'verifying_signature' && (
            <div className="py-10 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-sky-500/20 animate-ping opacity-75" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 border border-sky-300 flex items-center justify-center shadow-xl shadow-sky-500/40">
                  <RefreshCw className="w-7 h-7 text-white animate-spin" />
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-xs font-bold mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
                  HMAC Cryptographic Verification
                </div>
                <h3 className="text-xl font-bold text-white">Verifying Payment Tokens...</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                  Performing timing-safe HMAC SHA-256 signature verification against server secret.
                </p>
              </div>
            </div>
          )}

          {/* ─── STEP: VERIFIED SUCCESS ─── */}
          {step === 'verified_success' && (
            <div className="py-6 flex flex-col items-center justify-center gap-4 text-center animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/60 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Payment Verified Authoritatively
                </div>
                <h3 className="text-2xl font-black text-white">Payment Confirmed!</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Your spot is locked and recorded in the database.
                </p>
              </div>

              <div className="w-full p-4 rounded-2xl bg-slate-800/50 border border-emerald-500/30 space-y-2 text-left text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Registration ID:</span>
                  <span className="font-mono font-bold text-white">{registrationId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Razorpay Payment ID:</span>
                  <span className="font-mono font-bold text-emerald-400">{verifiedPaymentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Verified Amount:</span>
                  <span className="font-bold text-emerald-400">₹{serverAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-bold text-emerald-400 uppercase">PAID (CONFIRMED)</span>
                </div>
              </div>

              <button
                onClick={() => onPaymentSuccess(`/confirmation/${registrationId}`)}
                className="w-full py-3.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
              >
                <span>View Official Registration Pass</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ─── STEP: PAYMENT FAILED ─── */}
          {step === 'payment_failed' && (
            <div className="py-6 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Payment Incomplete</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                  {errorMessage || 'Payment could not be verified. You can retry with Razorpay.'}
                </p>
              </div>

              <div className="w-full space-y-2 pt-2">
                <button
                  onClick={() => setStep('ready_to_pay')}
                  className="w-full py-3.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white transition-colors"
                >
                  Retry Payment
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl font-semibold text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
