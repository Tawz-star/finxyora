'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { ShieldCheck, AlertCircle, Copy, Check, QrCode, CreditCard, RefreshCw, X } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  referenceType: 'event' | 'stall';
  referenceId: string;
  amount: number;
  itemTitle: string;
  payerEmail: string;
  payerPhone: string;
  onPaymentSuccess: (receiptUrl: string) => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  referenceType,
  referenceId,
  amount,
  itemTitle,
  payerEmail,
  payerPhone,
  onPaymentSuccess
}: PaymentModalProps) {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'upi' | 'razorpay'>('sandbox');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<{ id: string; gateway_order_id: string } | null>(null);

  const testUpiId = 'finxyora@okaxis';

  // Create payment intent on modal open
  useEffect(() => {
    if (isOpen && referenceId) {
      setIsProcessing(true);
      setErrorMessage(null);

      fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceType,
          referenceId,
          payerEmail,
          payerPhone
        })
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to initialize payment');
          setPaymentIntent(data.payment);

          // Generate dynamic UPI payload
          const upiString = `upi://pay?pa=${testUpiId}&pn=FINXYORA%20FESTIVAL&am=${amount.toFixed(2)}&cu=INR&tr=${referenceId}&tn=${encodeURIComponent(itemTitle.slice(0, 30))}`;
          const qrUrl = await QRCode.toDataURL(upiString, { width: 280, margin: 1, color: { dark: '#07152f', light: '#ffffff' } });
          setQrCodeDataUrl(qrUrl);
        })
        .catch((err) => {
          setErrorMessage(err.message);
        })
        .finally(() => {
          setIsProcessing(false);
        });
    }
  }, [isOpen, referenceId, referenceType, amount, itemTitle, payerEmail, payerPhone]);

  if (!isOpen) return null;

  const handleSimulatePayment = async (status: 'success' | 'fail') => {
    if (!paymentIntent) return;

    if (status === 'fail') {
      setErrorMessage('Payment was declined or cancelled by user in test sandbox. Please retry.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: paymentIntent.id,
          gatewayPaymentId: `pay_sandbox_${Date.now()}`,
          gatewayOrderId: paymentIntent.gateway_order_id,
          gatewaySignature: `SANDBOX_VERIFIED_${Date.now()}`,
          verifiedAmount: amount
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server payment verification failed');

      onPaymentSuccess(`/confirmation/${referenceId}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Payment verification failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(testUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/30 shadow-2xl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/80 transition-colors"
          disabled={isProcessing}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-3">
            <CreditCard className="w-6 h-6 text-sky-400" />
          </div>
          <h3 className="text-xl font-bold text-white">
            Secure Payment Gateway
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Reference: <span className="font-mono text-sky-300 font-semibold">{referenceId}</span>
          </p>
        </div>

        {/* Pricing Summary Box */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-sky-500/20 mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Item Description</span>
            <span className="text-sm font-bold text-white line-clamp-1">{itemTitle}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">Total Amount</span>
            <span className="text-xl font-extrabold text-sky-300 font-mono">₹{amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Tabs */}
        <div className="flex rounded-xl bg-slate-900/60 p-1 mb-6 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('sandbox')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'sandbox'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Sandbox Gateway
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upi')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'upi'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            UPI Dynamic QR
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* TAB 1: Sandbox Simulator */}
        {activeTab === 'sandbox' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-950/40 border border-sky-500/20 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-sky-300 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Authorized FinTech Sandbox Mode</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Test the complete production workflow safely. The server verifies transaction signatures, checks idempotency, locks inventory, and logs audit events in the database.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleSimulatePayment('success')}
                disabled={isProcessing}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Simulate Successful Pay
              </button>

              <button
                type="button"
                onClick={() => handleSimulatePayment('fail')}
                disabled={isProcessing}
                className="w-full py-3 px-4 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition-all disabled:opacity-50"
              >
                Simulate Gateway Decline
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Dynamic UPI QR Code */}
        {activeTab === 'upi' && (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-3 bg-white rounded-2xl shadow-xl border border-sky-400/40">
              {qrCodeDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCodeDataUrl} alt="UPI Dynamic QR Code" className="w-48 h-48 rounded-xl object-contain" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                </div>
              )}
            </div>

            <div className="w-full space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <span className="text-slate-400">Merchant UPI ID:</span>
                <div className="flex items-center gap-2">
                  <code className="text-sky-300 font-mono font-bold">{testUpiId}</code>
                  <button
                    onClick={copyToClipboard}
                    className="p-1 text-slate-400 hover:text-white rounded"
                    title="Copy UPI ID"
                  >
                    {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSimulatePayment('success')}
                disabled={isProcessing}
                className="w-full py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                I Have Completed UPI Payment &ndash; Verify Now
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-[11px] text-slate-500">
            Encrypted with 256-bit SSL &bull; Strict server-side verification &bull; No duplicate debits
          </p>
        </div>

      </div>
    </div>
  );
}
