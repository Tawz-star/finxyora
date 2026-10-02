'use client';

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Edit3,
  Check,
  X,
  AlertCircle,
  Save,
  Users,
  CreditCard,
  Calendar,
  Lock,
  Unlock,
  RefreshCw
} from 'lucide-react';
import { EventRecord } from '@/lib/db';

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Modal State
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchEvents = () => {
    setLoading(true);
    fetch('/api/admin/events')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch events');
        setEvents(data.events);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEvent)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update event');

      setSuccessMsg(`Event "${editingEvent.title}" updated successfully.`);
      setEditingEvent(null);
      fetchEvents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (event: EventRecord) => {
    try {
      const updatedStatus = event.is_open ? 0 : 1;
      await fetch('/api/admin/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...event, is_open: updatedStatus })
      });
      fetchEvents();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-sky-400" />
            <span>Event Management &amp; Fee Rules</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure titles, participant limits, registration fees, rules, and portal access for all six festival competitions.
          </p>
        </div>

        <button
          onClick={fetchEvents}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Events Table */}
      <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/20 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="pb-3">Event Key / Title</th>
                <th className="pb-3">Category</th>
                <th className="pb-3 text-center">Team Limit</th>
                <th className="pb-3 text-center">Fee Rule</th>
                <th className="pb-3 text-center">Portal Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {events.map((evt) => (
                <tr key={evt.id} className="text-slate-300 hover:bg-slate-900/30 transition-colors">
                  <td className="py-4">
                    <span className="font-bold text-white block text-sm">{evt.title}</span>
                    <span className="font-mono text-[10px] text-slate-500">{evt.id}</span>
                  </td>
                  <td className="py-4 text-slate-400 max-w-xs truncate">
                    {evt.category}
                  </td>
                  <td className="py-4 text-center">
                    <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 font-semibold font-mono">
                      {evt.min_participants === evt.max_participants
                        ? `${evt.max_participants} Member${evt.max_participants > 1 ? 's' : ''}`
                        : `${evt.min_participants} – ${evt.max_participants} Members`}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <span className="font-mono font-bold text-white">₹{evt.registration_fee}</span>
                    <span className="text-[10px] text-slate-400 block">
                      {evt.fee_type === 'per_participant' ? 'per participant' : 'per team'}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <button
                      onClick={() => handleToggleStatus(evt)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                        evt.is_open
                          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-rose-500/20 hover:text-rose-300'
                          : 'bg-rose-500/20 text-rose-300 hover:bg-emerald-500/20 hover:text-emerald-300'
                      }`}
                      title="Click to toggle registration status"
                    >
                      {evt.is_open ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{evt.is_open ? 'OPEN' : 'CLOSED'}</span>
                    </button>
                  </td>
                  <td className="py-4 text-right">
                    <button
                      onClick={() => setEditingEvent(evt)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/30 flex items-center gap-1.5 ml-auto transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Event</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT EVENT MODAL */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/30 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setEditingEvent(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-sky-400" />
              <span>Edit Competition: {editingEvent.title}</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6 font-mono">ID: {editingEvent.id}</p>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Display Title (e.g. BEST CFO)
                </label>
                <input
                  type="text"
                  required
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Category Tag
                </label>
                <input
                  type="text"
                  required
                  value={editingEvent.category}
                  onChange={(e) => setEditingEvent({ ...editingEvent, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Event Description
                </label>
                <textarea
                  required
                  rows={3}
                  value={editingEvent.description}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Min Members
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editingEvent.min_participants}
                    onChange={(e) => setEditingEvent({ ...editingEvent, min_participants: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Max Members
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editingEvent.max_participants}
                    onChange={(e) => setEditingEvent({ ...editingEvent, max_participants: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Fee (INR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={editingEvent.registration_fee}
                    onChange={(e) => setEditingEvent({ ...editingEvent, registration_fee: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Fee Calculation
                  </label>
                  <select
                    value={editingEvent.fee_type}
                    onChange={(e) => setEditingEvent({ ...editingEvent, fee_type: e.target.value as 'per_team' | 'per_participant' })}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs bg-slate-900"
                  >
                    <option value="per_team">Per Team</option>
                    <option value="per_participant">Per Participant</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Portal Registration Status
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="is_open"
                      checked={editingEvent.is_open === 1}
                      onChange={() => setEditingEvent({ ...editingEvent, is_open: 1 })}
                    />
                    <span className="text-emerald-400 font-semibold">Open (Accepting Registrations)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="is_open"
                      checked={editingEvent.is_open === 0}
                      onChange={() => setEditingEvent({ ...editingEvent, is_open: 0 })}
                    />
                    <span className="text-rose-400 font-semibold">Closed</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white flex items-center gap-2 shadow-lg shadow-sky-500/25"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
