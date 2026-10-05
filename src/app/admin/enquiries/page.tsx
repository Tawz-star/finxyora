'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Send,
  ShieldAlert,
  ShieldCheck,
  Info
} from 'lucide-react';
import { EnquiryRecord } from '@/lib/db';

const STATUS_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  new: {
    bg: 'bg-rose-500/20',
    text: 'text-rose-300',
    border: 'border-rose-500/30'
  },
  'in-progress': {
    bg: 'bg-amber-500/20',
    text: 'text-amber-300',
    border: 'border-amber-500/30'
  },
  resolved: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30'
  }
};

interface EmailServiceInfo {
  configured: boolean;
  provider: 'Resend API' | 'Gmail SMTP' | 'None';
  destinationEmail: string;
  senderAddress: string;
}

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Email diagnostic state
  const [emailInfo, setEmailInfo] = useState<EmailServiceInfo | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    error?: string;
    latencyMs?: number;
    provider?: string;
  } | null>(null);

  const fetchEmailStatus = useCallback(() => {
    fetch('/api/admin/test-email')
      .then(async (res) => {
        const data = await res.json();
        if (data.success && data.status) {
          setEmailInfo(data.status);
        }
      })
      .catch(() => {});
  }, []);

  const fetchEnquiries = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.append('status', statusFilter);

    fetch(`/api/admin/enquiries?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch enquiries');
        setEnquiries(data.enquiries || []);
      })
      .catch(() => setEnquiries([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    fetchEnquiries();
    fetchEmailStatus();
  }, [fetchEnquiries, fetchEmailStatus]);

  const handleSendTestEmail = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        error: data.error,
        latencyMs: data.latencyMs,
        provider: data.provider
      });
      fetchEmailStatus();
    } catch (err: unknown) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Network error triggering test email'
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'new' | 'in-progress' | 'resolved') => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setMessage(`Enquiry marked as ${newStatus}`);
      setTimeout(() => setMessage(null), 3000);
      fetchEnquiries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredEnquiries = enquiries.filter((e) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(term) ||
      e.email.toLowerCase().includes(term) ||
      e.subject.toLowerCase().includes(term) ||
      e.message.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <Mail className="w-7 h-7 text-sky-400" />
            <span>Contact &amp; Student Inquiries</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Incoming support inquiries dispatched to finxyora@gmail.com and recorded in the central database.
          </p>
        </div>

        <button
          onClick={() => {
            fetchEnquiries();
            fetchEmailStatus();
          }}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Email Service Diagnostic Card */}
      <div className="p-5 rounded-2xl glass-card border border-sky-500/20 bg-gradient-to-r from-slate-900/90 to-blue-950/40 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Outbound Email Channel:</span>
              {emailInfo?.configured ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {emailInfo.provider} Active
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  Credentials Missing (Pending Vercel Env Setup)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300">
              Destination Inbox: <strong className="text-white">finxyora@gmail.com</strong> &bull; Sender: <code className="text-sky-300 text-[11px]">{emailInfo?.senderAddress || 'Not set'}</code>
            </p>
          </div>

          <button
            onClick={handleSendTestEmail}
            disabled={testLoading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-lg shadow-sky-500/20 flex items-center gap-2 self-start md:self-auto disabled:opacity-50 transition-all cursor-pointer"
          >
            {testLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{testLoading ? 'Testing Dispatch...' : 'Send Test Email to finxyora@gmail.com'}</span>
          </button>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border ${
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">
                {testResult.success
                  ? `✅ Test email successfully delivered to finxyora@gmail.com via ${testResult.provider} (${testResult.latencyMs}ms)`
                  : `❌ Outbound delivery test failed: ${testResult.error}`}
              </p>
              {!testResult.success && (
                <p className="text-[11px] text-slate-300">
                  Tip: Add <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">GMAIL_USER</code> and{' '}
                  <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">GMAIL_APP_PASSWORD</code> (or{' '}
                  <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">RESEND_API_KEY</code>) to your Vercel Environment Variables.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl glass-card border border-sky-500/20 flex flex-wrap items-center justify-between gap-4">
        
        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {['ALL', 'new', 'in-progress', 'resolved'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all uppercase ${
                statusFilter === s
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {s === 'ALL' ? 'All Inquiries' : s}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sender, email, subject..."
            className="pl-8 pr-3 py-2 rounded-xl glass-input text-xs w-64 text-white placeholder-slate-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Enquiries Feed */}
      <div className="rounded-3xl glass-panel p-6 border border-sky-500/20">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
            <span className="text-xs text-slate-400 font-mono">LOADING CENTRAL INQUIRIES...</span>
          </div>
        ) : filteredEnquiries.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <MessageSquare className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">No Inquiries Found</h3>
            <p className="text-xs text-slate-400">
              {statusFilter !== 'ALL'
                ? `No inquiries currently marked as "${statusFilter}".`
                : 'No contact inquiries have been submitted yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredEnquiries.map((enq) => {
              const badge = STATUS_BADGES[enq.status] || STATUS_BADGES.new;
              const isBusy = actionLoading === enq.id;
              const emailDispatched = enq.email_dispatched === 1;

              return (
                <div key={enq.id} className="py-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-sky-400">
                          {enq.id}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${badge.bg} ${badge.text} ${badge.border}`}>
                          {enq.status}
                        </span>

                        {/* Email Delivery Status Badge per Requirement 9 */}
                        {enq.email_status === 'sent' || enq.email_dispatched === 1 ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <span>Email Delivery: ✅ Sent</span>
                          </span>
                        ) : enq.email_status === 'failed' ? (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1"
                            title={enq.email_error || 'Outbound email delivery failed'}
                          >
                            <span>Email Delivery: ❌ Failed</span>
                          </span>
                        ) : (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                            title={enq.email_error || 'Saved in database, outbound email pending'}
                          >
                            <span>Email Delivery: ⏳ Pending</span>
                          </span>
                        )}

                        <span className="text-[11px] text-slate-500">
                          {new Date(enq.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white pt-0.5">
                        {enq.subject}
                      </h3>

                      <p className="text-xs text-slate-300">
                        From: <strong className="text-white">{enq.name}</strong> &bull;{' '}
                        <a href={`mailto:${enq.email}`} className="text-sky-400 underline font-medium">
                          {enq.email}
                        </a>
                        {enq.phone && (
                          <>
                            {' '}&bull; Phone:{' '}
                            <a href={`tel:${enq.phone}`} className="text-emerald-400 font-mono font-medium hover:underline">
                              {enq.phone}
                            </a>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <a
                        href={`mailto:${enq.email}?subject=${encodeURIComponent(`Re: [FINXYORA 2026] ${enq.subject}`)}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/30 flex items-center gap-1.5 transition-all"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Reply</span>
                      </a>

                      {enq.status !== 'resolved' ? (
                        <button
                          onClick={() => handleUpdateStatus(enq.id, 'resolved')}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>Resolve</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(enq.id, 'new')}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Reopen
                        </button>
                      )}
                    </div>

                  </div>

                  {/* Message body */}
                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                    {enq.message}
                  </div>

                  {/* Delivery Error Notice if failed */}
                  {enq.email_status === 'failed' && enq.email_error && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span><strong>Outbound Error:</strong> {enq.email_error}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
