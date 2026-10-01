'use client';

import React, { useState, useEffect } from 'react';
import {
  Store,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Save,
  Zap,
  RefreshCw,
  Search,
  Filter,
  FileSpreadsheet
} from 'lucide-react';
import { StallOptionRecord, StallBookingRecord } from '@/lib/db';

export default function AdminStallsPage() {
  const [options, setOptions] = useState<StallOptionRecord[]>([]);
  const [bookings, setBookings] = useState<StallBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Option Modal
  const [editingOption, setEditingOption] = useState<StallOptionRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchStallData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (search) params.append('search', search);

    fetch(`/api/admin/stalls?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch stall data');
        setOptions(data.options || []);
        setBookings(data.bookings || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStallData();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStallData();
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOption) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/stalls', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingOption)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update stall option');

      setSuccessMsg(`Package "${editingOption.name}" updated successfully.`);
      setEditingOption(null);
      fetchStallData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBookingStatus = async (id: string, newStatus: string) => {
    try {
      const notes = prompt(`Optional admin notes for updating booking ${id} to ${newStatus}:`);
      const res = await fetch('/api/admin/stalls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, adminNotes: notes || undefined })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      setSuccessMsg(`Booking ${id} status updated to ${newStatus}`);
      fetchStallData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Store className="w-6 h-6 text-emerald-400" />
            <span>Stall Management &amp; Inventory Allocation</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Adjust stall inventory limits, update package pricing, review vendor applications, and approve or reject reservations.
          </p>
        </div>

        <a
          href="/api/admin/export?type=stalls"
          download
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 self-start sm:self-auto shadow-md shadow-emerald-600/20"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Stalls CSV</span>
        </a>
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

      {/* SECTION 1: INVENTORY PACKAGES CONFIGURATION */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span>Stall Packages &amp; Pricing Rules</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {options.map((opt) => (
            <div
              key={opt.id}
              className="rounded-2xl glass-card p-6 border border-sky-500/20 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 text-sky-300 border border-slate-700">
                    {opt.category}
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    {opt.available_stalls} Remaining
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1">
                  {opt.name}
                </h3>

                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-black text-white font-mono">
                    ₹{opt.price}
                  </span>
                  <span className="text-xs text-slate-400">/ stall</span>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-3">
                  {opt.description}
                </p>

                <div className="space-y-1 text-xs text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Total Stall Quota:</span>
                    <strong className="text-white">{opt.total_stalls}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Power Socket:</span>
                    <strong className={opt.has_electricity ? 'text-sky-300' : 'text-slate-500'}>
                      {opt.has_electricity ? '15A/30A Included' : 'No Electricity'}
                    </strong>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setEditingOption(opt)}
                className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-sky-500 text-slate-300 hover:text-white border border-slate-700 hover:border-transparent flex items-center justify-center gap-1.5 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Capacity &amp; Price</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: STALL BOOKINGS LEDGER */}
      <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/20 shadow-2xl space-y-6">
        
        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Stall Applications &amp; Reservations ({bookings.length})</span>
          </h3>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl glass-input text-xs bg-slate-900 text-slate-300"
            >
              <option value="">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="refunded">Refunded</option>
            </select>

            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendor / contact..."
                className="pl-8 pr-3 py-2 rounded-xl glass-input text-xs w-48 text-white placeholder-slate-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            <button
              type="submit"
              className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white"
              title="Search"
            >
              <Filter className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Bookings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="pb-3">Booking ID</th>
                <th className="pb-3">Entity / Brand</th>
                <th className="pb-3">Applicant Type</th>
                <th className="pb-3">Contact</th>
                <th className="pb-3 text-center">Stalls</th>
                <th className="pb-3 text-center">Amount</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {bookings.map((b) => (
                <tr key={b.id} className="text-slate-300 hover:bg-slate-900/30 transition-colors">
                  <td className="py-3 font-mono font-bold text-emerald-400">
                    {b.id}
                  </td>
                  <td className="py-3">
                    <span className="font-bold text-white block">{b.entity_name}</span>
                    <span className="text-[11px] text-slate-400 truncate max-w-xs block">{b.products_services}</span>
                  </td>
                  <td className="py-3">
                    <span className="capitalize text-slate-300">{b.applicant_type}</span>
                    {b.college_name && (
                      <span className="text-[10px] text-slate-400 block">{b.college_name}</span>
                    )}
                  </td>
                  <td className="py-3">
                    <span className="text-white block font-medium">{b.contact_name}</span>
                    <span className="text-[10px] text-slate-400 block">{b.contact_phone}</span>
                  </td>
                  <td className="py-3 text-center font-mono font-bold text-white">
                    {b.stalls_requested}
                  </td>
                  <td className="py-3 text-center font-mono font-bold text-sky-300">
                    ₹{b.total_amount}
                  </td>
                  <td className="py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      b.status === 'paid'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : b.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-300'
                        : b.status === 'approved'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {b.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {b.status !== 'approved' && b.status !== 'paid' && (
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'approved')}
                          className="px-2 py-1 rounded bg-blue-500/15 hover:bg-blue-500 text-blue-300 hover:text-white text-[11px] transition-colors"
                          title="Approve booking manually"
                        >
                          Approve
                        </button>
                      )}
                      {b.status !== 'rejected' && (
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'rejected')}
                          className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-[11px] transition-colors"
                          title="Reject booking"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT OPTION MODAL */}
      {editingOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/30 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">
              Configure Stall Option: {editingOption.name}
            </h3>

            <form onSubmit={handleSaveOption} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Package Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editingOption.name}
                  onChange={(e) => setEditingOption({ ...editingOption, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Price per Stall (INR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    required
                    value={editingOption.price}
                    onChange={(e) => setEditingOption({ ...editingOption, price: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Total Inventory Quota
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    required
                    value={editingOption.total_stalls}
                    onChange={(e) => setEditingOption({ ...editingOption, total_stalls: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Electricity Availability
                </label>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={editingOption.has_electricity === 1}
                    onChange={(e) => setEditingOption({ ...editingOption, has_electricity: e.target.checked ? 1 : 0 })}
                  />
                  <span className="text-white">Provide Dedicated 15A/30A Electrical Socket</span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Description &amp; Rules
                </label>
                <textarea
                  rows={3}
                  value={editingOption.description}
                  onChange={(e) => setEditingOption({ ...editingOption, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingOption(null)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Update Package'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
