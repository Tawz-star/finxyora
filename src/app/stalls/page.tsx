'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Store,
  Zap,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ArrowRight,
  Building,
  User,
  ShoppingBag,
  FileCheck,
  RefreshCw
} from 'lucide-react';
import PaymentModal from '@/components/PaymentModal';

interface StallOption {
  id: string;
  category: 'STUDENT' | 'OUTSIDE_VENDOR';
  name: string;
  price: number;
  has_electricity: number;
  description: string;
  total_stalls: number;
  is_active: number;
  booked_count: number;
  available_stalls: number;
}

function StallRegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedOption = searchParams.get('option') || 'student-electric';

  const [options, setOptions] = useState<StallOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Option
  const [selectedOptionId, setSelectedOptionId] = useState<string>(preselectedOption);

  // Form Fields
  const [applicantType, setApplicantType] = useState<'student' | 'vendor'>('student');
  const [entityName, setEntityName] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [departmentClass, setDepartmentClass] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [businessCategory, setBusinessCategory] = useState('Merchandise & Crafts');
  const [businessDetails, setBusinessDetails] = useState('');
  const [productsServices, setProductsServices] = useState('');
  const [stallsRequested, setStallsRequested] = useState<number>(1);

  // Review & Submitting
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Payment Modal Trigger
  const [pendingBooking, setPendingBooking] = useState<{
    id: string;
    totalAmount: number;
  } | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const fetchStalls = () => {
    setLoading(true);
    fetch('/api/stalls')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load stalls');
        setOptions(data.stalls);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStalls();
  }, []);

  const selectedOption = options.find((o) => o.id === selectedOptionId) || options[0];

  // Auto sync applicantType when option changes
  const handleSelectOption = (optId: string) => {
    setSelectedOptionId(optId);
    const chosen = options.find((o) => o.id === optId);
    if (chosen) {
      if (chosen.category === 'STUDENT') {
        setApplicantType('student');
      } else {
        setApplicantType('vendor');
      }
    }
  };

  const calculateTotal = (): number => {
    if (!selectedOption) return 0;
    return selectedOption.price * stallsRequested;
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!entityName.trim() || !contactName.trim() || !contactEmail.trim() || !contactPhone.trim() || !productsServices.trim()) {
      setFormError('Please fill in all mandatory fields.');
      return;
    }

    if (applicantType === 'student' && (!collegeName.trim() || !departmentClass.trim())) {
      setFormError('College Name and Department/Class are mandatory for student exhibitors.');
      return;
    }

    if (stallsRequested < 1) {
      setFormError('You must request at least 1 stall.');
      return;
    }

    if (selectedOption && stallsRequested > selectedOption.available_stalls) {
      setFormError(`Only ${selectedOption.available_stalls} stalls are currently available for this category.`);
      return;
    }

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Client-side payload state for payment modal
  const [stallPayload, setStallPayload] = useState<{
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
  } | null>(null);

  const handleFinalSubmit = () => {
    if (!selectedOption) return;
    setFormError(null);

    const payload = {
      optionId: selectedOption.id,
      applicantType,
      entityName,
      collegeName: applicantType === 'student' ? collegeName : undefined,
      departmentClass: applicantType === 'student' ? departmentClass : undefined,
      contactName,
      contactEmail,
      contactPhone,
      businessDetails: applicantType === 'vendor' ? `${businessCategory} — ${businessDetails}` : undefined,
      productsServices,
      stallsRequested
    };

    setStallPayload(payload);
    setIsPaymentModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-mono tracking-wider">LOADING STALLS INVENTORY...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border border-emerald-400/30 text-emerald-300 text-xs sm:text-sm font-medium">
          <Store className="w-3.5 h-3.5" />
          <span>FINXYORA Festival Exhibition &amp; Commercial Pavilion</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
          Festival Stall <span className="gradient-text">Booking Portal</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Book dedicated exhibition space at FINXYORA 2026. Two distinct categories for Student Innovators and Outside Commercial Brands with transparent real-time inventory allocation.
        </p>
      </div>

      {/* CATEGORY & OPTION SELECTION CARDS */}
      <div className="mb-14">
        {/* TOTAL CAPACITY ALERT BANNER */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 border border-sky-400/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Official Festival Stall Allocation &bull; 25 Vacancies Maximum
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Total availability across all 3 categories combined is strictly capped at <strong className="text-white">25 stalls</strong> for both festival days.
              </p>
            </div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-950/90 border border-sky-500/30 text-center shrink-0">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Total Vacancies</span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              {options[0]?.available_stalls ?? 25} / 25 Available
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Step 1: Choose Your Stall Package</span>
          </h2>
          <button
            onClick={fetchStalls}
            className="text-xs text-slate-400 hover:text-sky-300 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Check Live Inventory
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {options.map((opt) => {
            const isSelected = opt.id === selectedOptionId;
            const isOutOfStock = opt.available_stalls <= 0;

            return (
              <div
                key={opt.id}
                onClick={() => !isOutOfStock && handleSelectOption(opt.id)}
                className={`cursor-pointer rounded-2xl glass-card p-6 flex flex-col justify-between border transition-all relative ${
                  isSelected
                    ? 'border-sky-400 bg-sky-500/10 shadow-xl shadow-sky-500/20 ring-1 ring-sky-400'
                    : isOutOfStock
                    ? 'opacity-60 border-slate-800 pointer-events-none'
                    : 'border-sky-500/20 hover:border-sky-400/50'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300">
                      {opt.category === 'STUDENT' ? 'Student Stall' : 'Outside Commercial'}
                    </span>
                    <span className={`text-xs font-semibold ${opt.available_stalls < 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {opt.available_stalls} of 25 Available
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">
                    {opt.name}
                  </h3>

                  <div className="mb-4">
                    <span className="text-3xl font-extrabold text-white font-mono">
                      ₹{opt.price}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">/ stall</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {opt.description}
                  </p>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Zap className={`w-3.5 h-3.5 ${opt.has_electricity ? 'text-sky-400' : 'text-slate-500'}`} />
                      <span>{opt.has_electricity ? 'Power Access Included (15A/30A)' : 'Without Electricity'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80">
                  <span className={`text-xs font-semibold block text-center py-2 rounded-xl ${
                    isSelected
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-900 text-slate-300'
                  }`}>
                    {isOutOfStock ? 'Sold Out' : isSelected ? 'Package Selected' : 'Select Package'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BOOKING FORM */}
      <div className="max-w-4xl mx-auto rounded-3xl glass-panel p-6 sm:p-10 border border-sky-500/30 shadow-2xl">
        
        {/* Progress header */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className={step === 1 ? 'text-sky-300' : 'text-slate-400'}>
              1. Stall Application Details ({selectedOption?.name})
            </span>
            <span className={step === 2 ? 'text-sky-300' : 'text-slate-400'}>
              2. Review &amp; Payment Verification
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-300"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        {formError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{formError}</p>
          </div>
        )}

        {/* STEP 1: FORM INPUTS */}
        {step === 1 && (
          <form onSubmit={handleProceedToReview} className="space-y-8">
            
            {/* Applicant Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <Building className="w-4 h-4 text-sky-400" />
                {applicantType === 'student' ? 'Student Enterprise Information' : 'Outside Commercial Vendor Details'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {applicantType === 'student' ? 'Student Team / Stall Brand Name' : 'Company / Business Entity Name'} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    placeholder="e.g. ByteBites Cafe or Neon Merch"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                {applicantType === 'student' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      College / Institution Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      placeholder="e.g. St. Joseph College"
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Business Industry Category <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={businessCategory}
                      onChange={(e) => setBusinessCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs bg-slate-900"
                    >
                      <option value="Food & Beverages">Food &amp; Beverages</option>
                      <option value="Merchandise & Crafts">Merchandise &amp; Crafts</option>
                      <option value="FinTech / Tech Services">FinTech / Tech Services</option>
                      <option value="Fashion & Accessories">Fashion &amp; Accessories</option>
                      <option value="Education & Publishing">Education &amp; Publishing</option>
                    </select>
                  </div>
                )}
              </div>

              {applicantType === 'student' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Department &amp; Class / Year <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={departmentClass}
                    onChange={(e) => setDepartmentClass(e.target.value)}
                    placeholder="e.g. B.Com FinTech, 3rd Year"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              )}

              {applicantType === 'vendor' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    GST / Business Registration / Website (Optional)
                  </label>
                  <input
                    type="text"
                    value={businessDetails}
                    onChange={(e) => setBusinessDetails(e.target.value)}
                    placeholder="GSTIN, CIN, or official website URL"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              )}
            </div>

            {/* Primary Contact Person */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <User className="w-4 h-4 text-sky-400" />
                Contact Representative
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Representative Name"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contact@brand.com"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mobile Number (WhatsApp) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="10-digit Mobile"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Products & Stalls Quantity */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <ShoppingBag className="w-4 h-4 text-sky-400" />
                Exhibition Description &amp; Quantity
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Products or Services to be Exhibited / Sold <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={productsServices}
                  onChange={(e) => setProductsServices(e.target.value)}
                  placeholder="Detail items for sale, appliances to be used, or menu items..."
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Number of Stalls Requested <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={stallsRequested}
                    onChange={(e) => setStallsRequested(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs bg-slate-900"
                  >
                    {[1, 2, 3, 4].map((num) => (
                      <option key={num} value={num} disabled={selectedOption && num > selectedOption.available_stalls}>
                        {num} Stall{num > 1 ? 's' : ''} ({num * (selectedOption?.price || 0)} INR)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="text-slate-400 block font-medium">Included Amenities:</span>
                  <span className="text-white font-semibold">
                    {selectedOption?.has_electricity ? 'Power Connection (15A/30A) + 1 Table + 2 Chairs' : '1 Table + 2 Chairs (Dry / Non-Electrical)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Total & Action */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-[11px] text-slate-400 block">Total Stall Fee</span>
                <span className="text-2xl font-black text-sky-300 font-mono">₹{calculateTotal()}</span>
              </div>

              <button
                type="submit"
                className="px-8 py-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-lg shadow-sky-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
              >
                <span>Proceed to Review</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </form>
        )}

        {/* STEP 2: REVIEW SUMMARY */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-200 flex items-start gap-2.5">
              <FileCheck className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
              <p>
                Please verify your stall reservation details. Upon payment verification, your unique booking reference and vendor entry badge will be issued.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs border-b border-slate-800 pb-2">
                Booking Specifications
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block">Package:</span>
                  <span className="text-white font-semibold">{selectedOption?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Entity Name:</span>
                  <span className="text-white font-semibold">{entityName}</span>
                </div>
                {applicantType === 'student' ? (
                  <div>
                    <span className="text-slate-400 block">Institution:</span>
                    <span className="text-white font-semibold">{collegeName} ({departmentClass})</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-slate-400 block">Business Category:</span>
                    <span className="text-white font-semibold">{businessCategory}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block">Representative:</span>
                  <span className="text-white font-semibold">{contactName} ({contactPhone})</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Number of Stalls:</span>
                  <span className="text-white font-semibold">{stallsRequested} Stall(s)</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Electricity Included:</span>
                  <span className="text-emerald-400 font-semibold">{selectedOption?.has_electricity ? 'Yes (Socket Provided)' : 'No'}</span>
                </div>
              </div>
            </div>

            {/* Price Box */}
            <div className="p-5 rounded-2xl bg-blue-950/40 border border-sky-500/30 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-300 block font-medium">Pricing Calculation</span>
                <span className="text-xs text-slate-400">
                  {stallsRequested} stall(s) × ₹{selectedOption?.price}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Total Due</span>
                <span className="text-2xl font-black text-sky-300 font-mono">₹{calculateTotal()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="px-6 py-3 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white transition-all"
              >
                Back to Edit
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-8 py-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-xl shadow-sky-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Locking Inventory...
                  </span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Proceed to Secure Payment</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Payment Modal */}
      {stallPayload && selectedOption && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          referenceType="stall"
          amount={calculateTotal()}
          itemTitle={`${selectedOption.name} (${stallsRequested} Stall)`}
          payerEmail={contactEmail}
          payerPhone={contactPhone}
          stallData={stallPayload}
          onPaymentSuccess={(receiptUrl) => {
            setIsPaymentModalOpen(false);
            router.push(receiptUrl);
          }}
        />
      )}

    </div>
  );
}

export default function StallRegistrationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-mono">LOADING STALLS INVENTORY...</p>
          </div>
        </div>
      }
    >
      <StallRegistrationContent />
    </Suspense>
  );
}
