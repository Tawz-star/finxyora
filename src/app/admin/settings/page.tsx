'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  Building,
  Calendar,
  CreditCard,
  Mail,
  Shield,
  HelpCircle
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch settings');
        setSettings(data.settings || {});
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update settings');

      setSuccessMsg('Festival configuration and payment credentials successfully saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-slate-400 font-mono">
        LOADING FESTIVAL SYSTEM CONFIGURATION...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-sky-400" />
          <span>Festival &amp; Institution Configuration</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Customize official college details, dates, venue, pricing calculation rules, and payment gateway credentials.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: COLLEGE & INSTITUTION PLACEHOLDERS */}
        <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/20 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Building className="w-4 h-4 text-sky-400" />
            <span>College &amp; Organizing Body Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                College Official Name
              </label>
              <input
                type="text"
                value={settings.college_name || ''}
                onChange={(e) => handleChange('college_name', e.target.value)}
                placeholder="e.g. St. Xavier's Autonomous College"
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Department / Association Name
              </label>
              <input
                type="text"
                value={settings.college_department || ''}
                onChange={(e) => handleChange('college_department', e.target.value)}
                placeholder="Department of Commerce & FinTech Association"
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">
                College Address &amp; Campus Location
              </label>
              <input
                type="text"
                value={settings.college_address || ''}
                onChange={(e) => handleChange('college_address', e.target.value)}
                placeholder="Campus Square, FinTech Block, Metro City"
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: SCHEDULE & VENUE CONFIG */}
        <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/20 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            <span>Festival Dates, Target &amp; Venue</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Display Event Dates
              </label>
              <input
                type="text"
                value={settings.event_dates || ''}
                onChange={(e) => handleChange('event_dates', e.target.value)}
                placeholder="October 24 – 25, 2026"
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Countdown Target ISO String
              </label>
              <input
                type="text"
                value={settings.event_countdown_target || ''}
                onChange={(e) => handleChange('event_countdown_target', e.target.value)}
                placeholder="2026-10-24T09:00:00"
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Campus Venue
              </label>
              <input
                type="text"
                value={settings.event_venue || ''}
                onChange={(e) => handleChange('event_venue', e.target.value)}
                placeholder="Main Auditorium & FinTech Block"
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: PRICING RULES & POLICIES */}
        <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/20 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <CreditCard className="w-4 h-4 text-sky-400" />
            <span>Event Registration Pricing Rules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Default Competition Entry Fee (INR)
              </label>
              <input
                type="number"
                min={0}
                value={settings.default_event_fee || '50'}
                onChange={(e) => handleChange('default_event_fee', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Fee Calculation Rule
              </label>
              <select
                value={settings.default_fee_rule || 'per_team'}
                onChange={(e) => handleChange('default_fee_rule', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs bg-slate-900 text-white"
              >
                <option value="per_team">Fixed Per Team Registration (e.g. ₹50 / team)</option>
                <option value="per_participant">Per Participant (e.g. ₹50 × team members)</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 4: PAYMENT GATEWAY CREDENTIALS */}
        <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/20 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Shield className="w-4 h-4 text-sky-400" />
            <span>Payment Provider &amp; Gateway Mode (Razorpay / UPI)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Gateway Operating Mode
              </label>
              <select
                value={settings.razorpay_mode || 'sandbox'}
                onChange={(e) => handleChange('razorpay_mode', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs bg-slate-900 text-sky-300 font-bold"
              >
                <option value="sandbox">Sandbox (Simulated Verification)</option>
                <option value="live">Live Production (Razorpay Gateway)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Merchant UPI ID
              </label>
              <input
                type="text"
                value={settings.upi_id || 'finxyora@okaxis'}
                onChange={(e) => handleChange('upi_id', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-mono text-emerald-300 font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Razorpay Key ID
              </label>
              <input
                type="text"
                value={settings.razorpay_key_id || ''}
                onChange={(e) => handleChange('razorpay_key_id', e.target.value)}
                placeholder="rzp_live_xxxxxxxxxxxx or leave blank for sandbox"
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-mono"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-300 mb-1">
                Razorpay Key Secret (Server-side HMAC validation)
              </label>
              <input
                type="password"
                value={settings.razorpay_key_secret || ''}
                onChange={(e) => handleChange('razorpay_key_secret', e.target.value)}
                placeholder="Never exposed to client browsers"
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 5: CONTACT & SUPPORT */}
        <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/20 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Mail className="w-4 h-4 text-sky-400" />
            <span>Support Help Desk Contacts</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Official Contact Email
              </label>
              <input
                type="email"
                value={settings.contact_email || ''}
                onChange={(e) => handleChange('contact_email', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Support Phone Number
              </label>
              <input
                type="text"
                value={settings.contact_phone || ''}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-xl shadow-sky-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving System Settings...' : 'Save All Settings'}</span>
          </button>
        </div>

      </form>

    </div>
  );
}
