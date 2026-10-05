'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Event Registration Query');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch query');
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send query');
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    {
      q: 'How do I know my event registration is confirmed?',
      a: 'Registrations are confirmed immediately once payment is verified via our secure gateway. You will receive an official Registration ID (e.g. FIN-2026-XXXX) and a digital pass with a verification QR code, which can also be retrieved at any time from the Lookup portal.'
    },
    {
      q: 'What is the refund policy if a team cannot attend?',
      a: 'As per festival regulations, registration fees for events and stall bookings are strictly non-refundable and non-transferable once verified.'
    },
    {
      q: 'What are the check-in and identification requirements?',
      a: 'All delegates must present their original, valid college photo ID card along with their printed or digital QR code pass at the registration desk by 08:30 AM on Day 1.'
    },
    {
      q: 'What is included with a festival stall booking?',
      a: 'Stall bookings include a sheltered booth space, 1 exhibition table, and 2 chairs. The "Student Stall With Electricity" and "Outside Commercial Stall" options also include dedicated 15A/30A electrical power sockets.'
    }
  ];

  return (
    <div className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-16">
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border border-sky-400/30 text-sky-300 text-xs sm:text-sm font-medium">
          <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
          <span>Support &amp; Help Desk</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
          Get in <span className="gradient-text">Touch</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Have queries regarding event rules, team eligibility, stall allocations, or payment verification? Our organizing committee is here to assist.
        </p>
      </div>

      {/* Main Grid: Details on Left, Message Form on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Contact Info (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/30 space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
              Official Help Desk
            </h3>

            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">General Inquiries</span>
                  <a href="mailto:finxyora@gmail.com" className="text-sm font-bold text-white hover:text-sky-300 transition-colors">
                    finxyora@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Festival Venue</span>
                  <p className="text-xs text-white font-medium leading-relaxed">
                    Golden Jubilee Building &bull; Bishop Heber College, Tiruchirappalli
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Support Hours</span>
                  <p className="text-xs text-white font-medium">
                    Monday to Saturday &bull; 09:00 AM &ndash; 06:00 PM IST
                  </p>
                </div>
              </div>
            </div>

            {/* Student Helpline Dedicated Leadership Cards */}
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <span className="text-xs uppercase font-bold tracking-wider text-sky-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                Student Leadership Helpline
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Tawfeeq Ahmed — Vice President */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-sky-500/25 hover:border-sky-400/50 transition-colors space-y-1">
                  <span className="text-xs font-bold text-white block">Tawfeeq Ahmed</span>
                  <span className="text-[11px] font-semibold text-sky-300 block">Vice President</span>
                  <a
                    href="tel:+919159911721"
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 pt-1 transition-colors"
                  >
                    <span>📞 9159911721</span>
                  </a>
                </div>

                {/* Sriram — President */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-sky-500/25 hover:border-sky-400/50 transition-colors space-y-1">
                  <span className="text-xs font-bold text-white block">Sriram</span>
                  <span className="text-[11px] font-semibold text-sky-300 block">President</span>
                  <a
                    href="tel:+918682879906"
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 pt-1 transition-colors"
                  >
                    <span>📞 8682879906</span>
                  </a>
                </div>

              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-950/40 border border-sky-500/20 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-sky-300 block">Fast-Track Pass Retrieval</span>
              <p className="text-slate-400">
                Already registered? You don&apos;t need to email us to find your pass. Check the live database instantly via the{' '}
                <Link href="/lookup" className="text-sky-300 underline font-semibold">
                  Lookup Portal
                </Link>.
              </p>
            </div>
          </div>
        </div>

        {/* Inquiry Form (7 cols) */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl glass-panel p-6 sm:p-10 border border-sky-500/30 shadow-2xl">
            {submitted ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white">Inquiry Dispatched</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  Thank you, <strong>{name}</strong>! Your inquiry regarding &ldquo;{subject}&rdquo; has been routed to the student convener desk. We will respond to <strong>{email}</strong> within 12 hours.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-sky-500 text-white"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
                  Submit an Inquiry
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Your Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Aditi Rao"
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Your Email Address <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="aditi@college.edu"
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Inquiry Category <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs bg-slate-900"
                  >
                    <option value="Event Registration Query">Event Registration Query</option>
                    <option value="Stall Booking & Facilities">Stall Booking &amp; Facilities</option>
                    <option value="Payment Verification Issue">Payment Verification Issue</option>
                    <option value="Stock War Accommodation">Stock War Accommodation</option>
                    <option value="Sponsorship & Partnership">Sponsorship &amp; Partnership</option>
                    <option value="Other Assistance">Other Assistance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Detailed Message <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide your college name, registration ID (if applicable), and query details..."
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>Transmit Inquiry</span>
                </button>
              </form>
            )}
          </div>
        </div>

      </div>

      {/* Frequently Asked Questions Accordion */}
      <div className="rounded-3xl glass-panel p-8 sm:p-12 border border-sky-500/30 space-y-8">
        <div className="text-center max-w-xl mx-auto">
          <h3 className="text-2xl font-bold text-white">Frequently Answered Questions</h3>
          <p className="text-xs text-slate-400 mt-1">Quick answers to common participant inquiries.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqs.map((faq, idx) => (
            <div key={idx} className="p-5 rounded-2xl glass-card border border-sky-500/10 space-y-2">
              <h4 className="text-sm font-bold text-white flex items-start gap-2">
                <span className="text-sky-400 font-mono font-bold">0{idx + 1}.</span>
                <span>{faq.q}</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed pl-6">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
