'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Plus, Pencil, Trash2, Link2, Loader2, X, Check, Users2,
  Phone, Mail, LayoutGrid, List, ChevronLeft, ChevronRight,
  UserPlus, CalendarDays, Clock, MapPin, Users, ExternalLink, Save,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Extra {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  access_token: string;
}

interface QuoteOption {
  id: string;
  event_type: string;
  event_date: string | null;
  client_name: string;
}

interface QuoteDetail extends QuoteOption {
  event_location: string | null;
  guest_count: number | null;
}

interface Assignment {
  id: string;
  extra_id: string;
  status: Status;
  arrival_time: string | null;
  mission_notes: string | null;
  quote: QuoteOption;
}

type Status = 'a_solliciter' | 'confirme' | 'present';

const ROLES = ['Cuisinier', 'Sous-chef', 'Serveur', 'Barman', 'Aide', 'Autre'];

const STATUSES: { value: Status; label: string; bg: string; text: string; ring: string; dot: string }[] = [
  { value: 'a_solliciter', label: 'À solliciter', bg: 'bg-amber-50',    text: 'text-amber-700',   ring: 'ring-amber-200',   dot: 'bg-amber-400'   },
  { value: 'confirme',     label: 'Confirmé',     bg: 'bg-blue-50',     text: 'text-blue-700',    ring: 'ring-blue-200',    dot: 'bg-blue-500'    },
  { value: 'present',      label: 'Présent',      bg: 'bg-emerald-50',  text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
];

function st(s: Status) { return STATUSES.find((x) => x.value === s) ?? STATUSES[0]; }

function dateFr(d: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return '—';
  return new Date(d + 'T00:00').toLocaleDateString('fr-FR', opts ?? { weekday: 'short', day: '2-digit', month: 'short' });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const cls = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-14 w-14 text-base' : 'h-10 w-10 text-sm';
  return (
    <div className={`${cls} rounded-xl bg-gradient-to-br from-[#7b1fa2] to-[#ab47bc] flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-bold">{initials}</span>
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ value, onChange }: { value: Status; onChange?: (s: Status) => void }) {
  const [open, setOpen] = useState(false);
  const s = st(value);
  const content = (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
  if (!onChange) return content;
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((v) => !v)} className="focus:outline-none">{content}</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[150px] py-1">
            {STATUSES.map((sx) => (
              <button key={sx.value} onClick={() => { onChange(sx.value); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${sx.value === value ? 'font-bold' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${sx.dot}`} />
                {sx.label}
                {sx.value === value && <Check className="h-3 w-3 ml-auto text-[#9c27b0]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Event sheet (right drawer) ─────────────────────────────────────────────────
interface SheetProps {
  assignment: Assignment;
  extra: Extra;
  onClose: () => void;
  onStatusChange: (id: string, s: Status) => void;
  onRemove: (id: string) => void;
  onSave: (id: string, arrivalTime: string, notes: string) => Promise<void>;
}

function EventSheet({ assignment, extra, onClose, onStatusChange, onRemove, onSave }: SheetProps) {
  const [detail, setDetail]     = useState<QuoteDetail | null>(null);
  const [arrTime, setArrTime]   = useState(assignment.arrival_time ?? '');
  const [notes, setNotes]       = useState(assignment.mission_notes ?? '');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createClient()
      .from('quotes')
      .select('id, event_type, event_date, client_name, event_location, guest_count')
      .eq('id', assignment.quote.id)
      .single()
      .then(({ data }) => { if (data) setDetail(data as QuoteDetail); });
  }, [assignment.quote.id]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(assignment.id, arrTime, notes);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const q = detail ?? assignment.quote;
  const s = st(assignment.status);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer */}
      <div ref={sheetRef}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 mb-1">Mission de</p>
              <div className="flex items-center gap-2">
                <Avatar name={extra.name} size="sm" />
                <div>
                  <p className="font-bold text-gray-900">{extra.name}</p>
                  {extra.role && <p className="text-xs text-gray-400">{extra.role}</p>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Event card */}
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-base leading-snug">{q.event_type || 'Événement'}</p>
                <p className="text-sm text-gray-500">{q.client_name}</p>
              </div>
              <StatusPill value={assignment.status} onChange={(s) => onStatusChange(assignment.id, s)} />
            </div>
            <div className="space-y-1.5 text-sm text-gray-600">
              {q.event_date && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-[#9c27b0] flex-shrink-0" />
                  <span className="font-medium">{dateFr(q.event_date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
              )}
              {detail?.event_location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-[#9c27b0] flex-shrink-0" />
                  <span>{detail.event_location}</span>
                </div>
              )}
              {detail?.guest_count && (
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-[#9c27b0] flex-shrink-0" />
                  <span>{detail.guest_count} convives</span>
                </div>
              )}
            </div>
            <Link href={`/evenements/${q.id}`}
              className="inline-flex items-center gap-1.5 text-xs text-[#9c27b0] font-medium hover:underline">
              <ExternalLink className="h-3 w-3" />Voir l&apos;événement complet
            </Link>
          </div>

          {/* Arrival time */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              <Clock className="h-3.5 w-3.5 inline mr-1" />Heure d&apos;arrivée
            </label>
            <input type="time" value={arrTime} onChange={(e) => setArrTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Notes de mission</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Instructions spécifiques, tenue, matériel à apporter…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] resize-none"
            />
          </div>

          {/* Contact de l'extra */}
          {(extra.phone || extra.email) && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-xs text-gray-500">
              <p className="font-semibold text-gray-400 uppercase tracking-widest text-[10px] mb-1">Contact</p>
              {extra.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3" />{extra.phone}</div>}
              {extra.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3" />{extra.email}</div>}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 border-t border-gray-100 px-5 py-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
            {saved ? 'Sauvegardé !' : 'Enregistrer'}
          </button>
          <button
            onClick={() => { if (confirm('Retirer cet extra de l\'événement ?')) { onRemove(assignment.id); onClose(); } }}
            className="px-4 py-2.5 text-sm text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
          >
            Retirer
          </button>
        </div>
      </div>
    </>
  );
}

// ── Assign modal ───────────────────────────────────────────────────────────────
function AssignModal({
  extra, userId, assignedQuoteIds, onSave, onClose,
}: {
  extra: Extra;
  userId: string;
  assignedQuoteIds: string[];
  onSave: (quoteId: string, status: Status, arrivalTime: string) => Promise<void>;
  onClose: () => void;
}) {
  const [quotes, setQuotes]   = useState<QuoteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [quoteId, setQuoteId] = useState('');
  const [status, setStatus]   = useState<Status>('a_solliciter');
  const [arrTime, setArrTime] = useState('');

  useEffect(() => {
    createClient()
      .from('quotes')
      .select('id, event_type, event_date, client_name')
      .eq('user_id', userId)
      .order('event_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        setQuotes(((data ?? []) as QuoteOption[]).filter((q) => !assignedQuoteIds.includes(q.id)));
        setLoading(false);
      });
  }, [userId, assignedQuoteIds]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Assigner à un événement</h2>
            <p className="text-xs text-gray-400">{extra.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Événement *</label>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-[#9c27b0]" /></div>
            ) : quotes.length === 0 ? (
              <p className="text-xs text-gray-400 py-2 text-center">Aucun événement disponible. Créez des devis depuis l&apos;onglet Devis.</p>
            ) : (
              <select value={quoteId} onChange={(e) => setQuoteId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] bg-white">
                <option value="">— Choisir un événement —</option>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.event_type || 'Événement'} — {q.client_name}{q.event_date ? ` (${dateFr(q.event_date, { day: '2-digit', month: 'short' })})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Statut initial</label>
            <div className="flex gap-2">
              {STATUSES.map((sx) => (
                <button key={sx.value} onClick={() => setStatus(sx.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold ring-1 transition-colors ${status === sx.value ? `${sx.bg} ${sx.text} ${sx.ring}` : 'bg-gray-50 text-gray-400 ring-gray-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sx.dot}`} />{sx.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Heure d&apos;arrivée</label>
            <input type="time" value={arrTime} onChange={(e) => setArrTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Annuler</button>
          <button onClick={async () => { if (!quoteId) return; setSaving(true); await onSave(quoteId, status, arrTime); setSaving(false); }}
            disabled={!quoteId || saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#9c27b0] text-white text-sm font-bold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}Assigner
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Extra modal ────────────────────────────────────────────────────────────────
function ExtraModal({ initial, onSave, onClose, saving }: {
  initial?: Partial<Extra>;
  onSave: (d: { name: string; role: string; phone: string; email: string }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName]   = useState(initial?.name  ?? '');
  const [role, setRole]   = useState(initial?.role  ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{initial?.id ? "Modifier l'extra" : 'Nouvel extra'}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { label: 'Nom complet *', value: name, set: setName, type: 'text', ph: 'Jean Dupont' },
            { label: 'Téléphone', value: phone, set: setPhone, type: 'tel', ph: '06 00 00 00 00' },
            { label: 'Email', value: email, set: setEmail, type: 'email', ph: 'jean@exemple.fr' },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input type={f.type} value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.ph}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rôle</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] bg-white">
              <option value="">— Sélectionner —</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Annuler</button>
          <button onClick={() => onSave({ name, role, phone, email })} disabled={!name.trim() || saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#9c27b0] text-white text-sm font-bold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {initial?.id ? 'Mettre à jour' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agenda ─────────────────────────────────────────────────────────────────────
function mondayOf(d: Date) {
  const day = d.getDay();
  const m = new Date(d);
  m.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  m.setHours(0, 0, 0, 0);
  return m;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isoDate(d: Date) { return d.toISOString().split('T')[0]; }

function AgendaView({ extras, assignments, onTagClick }: {
  extras: Extra[];
  assignments: Assignment[];
  onTagClick: (a: Assignment, e: Extra) => void;
}) {
  const COLS = 8;
  const [offset, setOffset] = useState(0); // in weeks

  const weeks = useMemo(() => {
    const monday = addDays(mondayOf(new Date()), offset * COLS * 7 / COLS);
    // Actually offset in weeks
    const base = addDays(mondayOf(new Date()), offset * COLS);
    return Array.from({ length: COLS }, (_, i) => {
      const start = addDays(base, i * 7);
      return { start, end: addDays(start, 6), label: `${start.getDate()}/${start.getMonth() + 1}` };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const byExtra = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const a of assignments) {
      if (!map[a.extra_id]) map[a.extra_id] = [];
      map[a.extra_id].push(a);
    }
    return map;
  }, [assignments]);

  const extraMap = useMemo(() => Object.fromEntries(extras.map((e) => [e.id, e])), [extras]);

  const periodLabel = () => {
    const s = weeks[0].start;
    const e = weeks[COLS - 1].end;
    return `${s.getDate()} ${s.toLocaleDateString('fr-FR', { month: 'short' })} — ${e.getDate()} ${e.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <button onClick={() => setOffset((v) => v - 1)}
          className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-500">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-700">{periodLabel()}</p>
          <div className="flex items-center justify-center gap-3 mt-1">
            {STATUSES.map((s) => (
              <span key={s.value} className="flex items-center gap-1 text-[10px] text-gray-400">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {offset !== 0 && (
            <button onClick={() => setOffset(0)}
              className="text-[10px] px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-400 transition-colors mr-1">
              Auj.
            </button>
          )}
          <button onClick={() => setOffset((v) => v + 1)}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-500">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 font-semibold text-gray-500 min-w-[130px] sticky left-0 bg-white z-10">Extra</th>
              {weeks.map((w, i) => (
                <th key={i} className="text-center px-1.5 py-2.5 font-medium text-gray-400 min-w-[90px]">
                  <div className="text-[11px]">{w.start.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                  <div className="font-bold text-gray-600">{w.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {extras.map((extra) => {
              const rows = byExtra[extra.id] ?? [];
              return (
                <tr key={extra.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <Avatar name={extra.name} size="sm" />
                      <div>
                        <div className="font-semibold text-gray-800 text-xs leading-snug">{extra.name}</div>
                        {extra.role && <div className="text-[10px] text-gray-400">{extra.role}</div>}
                      </div>
                    </div>
                  </td>
                  {weeks.map((w, i) => {
                    const hits = rows.filter((r) => {
                      if (!r.quote.event_date) return false;
                      return r.quote.event_date >= isoDate(w.start) && r.quote.event_date <= isoDate(w.end);
                    });
                    return (
                      <td key={i} className="text-center px-1.5 py-2">
                        {hits.length > 0 ? (
                          <div className="flex flex-col gap-1 items-center">
                            {hits.map((h) => {
                              const s = st(h.status);
                              return (
                                <button key={h.id}
                                  onClick={() => onTagClick(h, extraMap[h.extra_id] ?? extra)}
                                  title={`${h.quote.event_type} — ${h.quote.client_name}\nCliquer pour voir les détails`}
                                  className={`w-full px-1.5 py-1 rounded-lg text-[10px] font-semibold ring-1 hover:opacity-80 transition-opacity cursor-pointer ${s.bg} ${s.text} ${s.ring}`}>
                                  {h.quote.event_date
                                    ? new Date(h.quote.event_date + 'T00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                                    : '—'}
                                  <div className="truncate max-w-[72px] text-[9px] opacity-70">{h.quote.client_name}</div>
                                </button>
                              );
                            })}
                          </div>
                        ) : <span className="text-gray-100">·</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Extra card (list) ─────────────────────────────────────────────────────────
function ExtraCard({
  extra, assignments, onEdit, onDelete, onAssign, onCopyLink, copied, onTagClick,
}: {
  extra: Extra;
  assignments: Assignment[];
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  onCopyLink: () => void;
  copied: boolean;
  onTagClick: (a: Assignment) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const upcoming = assignments
    .filter((a) => !a.quote.event_date || a.quote.event_date >= today)
    .sort((a, b) => (a.quote.event_date ?? '').localeCompare(b.quote.event_date ?? ''));
  const past = assignments
    .filter((a) => a.quote.event_date && a.quote.event_date < today)
    .sort((a, b) => (b.quote.event_date ?? '').localeCompare(a.quote.event_date ?? ''));

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <Avatar name={extra.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900">{extra.name}</p>
            {extra.role && (
              <span className="px-2 py-0.5 bg-purple-50 text-[#9c27b0] text-xs font-semibold rounded-full">{extra.role}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            {extra.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{extra.phone}</span>}
            {extra.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{extra.email}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onAssign} title="Assigner à un événement"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#9c27b0] border border-[#9c27b0]/30 rounded-xl hover:bg-purple-50 transition-colors">
            <UserPlus className="h-3.5 w-3.5" />Assigner
          </button>
          <button onClick={onCopyLink}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Copier le lien">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-[#9c27b0] hover:bg-purple-50 rounded-lg transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Missions tags — always visible */}
      {assignments.length === 0 ? (
        <div className="px-4 pb-4">
          <button onClick={onAssign}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-[#9c27b0]/40 hover:text-[#9c27b0] hover:bg-purple-50/50 transition-colors">
            <UserPlus className="h-3.5 w-3.5" />Assigner à un événement
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-2">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {upcoming.map((a) => {
                const s = st(a.status);
                return (
                  <button key={a.id} onClick={() => onTagClick(a)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold ring-1 hover:opacity-80 transition-all cursor-pointer ${s.bg} ${s.text} ${s.ring}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                    <span className="font-bold">{a.quote.event_date ? dateFr(a.quote.event_date, { day: '2-digit', month: 'short' }) : '—'}</span>
                    <span className="opacity-75 max-w-[120px] truncate">{a.quote.event_type || a.quote.client_name}</span>
                    <CalendarDays className="h-3 w-3 opacity-50 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
          {/* Past (compact) */}
          {past.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {past.slice(0, 3).map((a) => (
                <button key={a.id} onClick={() => onTagClick(a)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors cursor-pointer">
                  {a.quote.event_date ? dateFr(a.quote.event_date, { day: '2-digit', month: 'short' }) : '—'} — {a.quote.client_name}
                </button>
              ))}
              {past.length > 3 && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] text-gray-300">+{past.length - 3} passé{past.length - 3 > 1 ? 's' : ''}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExtrasPage() {
  const { user } = useAuth();
  const [extras,      setExtras]      = useState<Extra[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState<Extra | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [copied,      setCopied]      = useState<string | null>(null);
  const [assignFor,   setAssignFor]   = useState<Extra | null>(null);
  const [viewMode,    setViewMode]    = useState<'list' | 'agenda'>('list');
  const [openSheet,   setOpenSheet]   = useState<{ assignment: Assignment; extra: Extra } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data: extrasData } = await supabase.from('extras').select('*').eq('user_id', user.id).order('name');
    const extras = (extrasData ?? []) as Extra[];
    const extraIds = extras.map((e) => e.id);
    let assigns: Assignment[] = [];
    if (extraIds.length > 0) {
      const { data: aData } = await supabase
        .from('event_extras')
        .select('id, extra_id, status, arrival_time, mission_notes, quote:quotes(id, event_type, event_date, client_name)')
        .in('extra_id', extraIds);
      assigns = ((aData ?? []) as unknown as Assignment[]).filter((a) => a.quote?.id);
    }
    setExtras(extras);
    setAssignments(assigns);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const assignmentsByExtra = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const a of assignments) {
      if (!map[a.extra_id]) map[a.extra_id] = [];
      map[a.extra_id].push(a);
    }
    return map;
  }, [assignments]);

  const extraMap = useMemo(() => Object.fromEntries(extras.map((e) => [e.id, e])), [extras]);

  const handleSaveExtra = async (form: { name: string; role: string; phone: string; email: string }) => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    if (editing) {
      const { data } = await supabase.from('extras')
        .update({ name: form.name, role: form.role || null, phone: form.phone || null, email: form.email || null })
        .eq('id', editing.id).select().single();
      if (data) setExtras((p) => p.map((e) => e.id === editing.id ? data as Extra : e));
    } else {
      const { data } = await supabase.from('extras')
        .insert({ user_id: user.id, name: form.name, role: form.role || null, phone: form.phone || null, email: form.email || null })
        .select().single();
      if (data) setExtras((p) => [...p, data as Extra].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    }
    setSaving(false);
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet extra ?')) return;
    await createClient().from('extras').delete().eq('id', id);
    setExtras((p) => p.filter((e) => e.id !== id));
    setAssignments((p) => p.filter((a) => a.extra_id !== id));
  };

  const handleStatusChange = async (assignId: string, status: Status) => {
    await createClient().from('event_extras').update({ status }).eq('id', assignId);
    setAssignments((p) => p.map((a) => a.id === assignId ? { ...a, status } : a));
    if (openSheet?.assignment.id === assignId) {
      setOpenSheet((s) => s ? { ...s, assignment: { ...s.assignment, status } } : s);
    }
  };

  const handleRemoveAssignment = async (assignId: string) => {
    await createClient().from('event_extras').delete().eq('id', assignId);
    setAssignments((p) => p.filter((a) => a.id !== assignId));
  };

  const handleSaveSheet = async (assignId: string, arrivalTime: string, notes: string) => {
    await createClient().from('event_extras')
      .update({ arrival_time: arrivalTime || null, mission_notes: notes || null })
      .eq('id', assignId);
    setAssignments((p) => p.map((a) =>
      a.id === assignId ? { ...a, arrival_time: arrivalTime || null, mission_notes: notes || null } : a
    ));
    if (openSheet?.assignment.id === assignId) {
      setOpenSheet((s) => s ? {
        ...s,
        assignment: { ...s.assignment, arrival_time: arrivalTime || null, mission_notes: notes || null }
      } : s);
    }
  };

  const handleAssign = async (quoteId: string, status: Status, arrivalTime: string) => {
    if (!assignFor) return;
    const { data } = await createClient()
      .from('event_extras')
      .insert({ extra_id: assignFor.id, quote_id: quoteId, status, arrival_time: arrivalTime || null, mission_notes: null })
      .select('id, extra_id, status, arrival_time, mission_notes, quote:quotes(id, event_type, event_date, client_name)')
      .single();
    if (data) setAssignments((p) => [...p, data as unknown as Assignment]);
    setAssignFor(null);
  };

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/e/${token}`).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestion des Extras</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez votre équipe et leurs missions événementielles</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            {([['list', 'Liste', List], ['agenda', 'Agenda', LayoutGrid]] as const).map(([mode, label, Icon]) => (
              <button key={mode} onClick={() => setViewMode(mode as 'list' | 'agenda')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
          <button onClick={() => { setEditing(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-bold rounded-xl hover:bg-[#7b1fa2] transition-colors">
            <Plus className="h-4 w-4" />Ajouter un extra
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" /></div>
      ) : viewMode === 'agenda' ? (
        <AgendaView
          extras={extras}
          assignments={assignments}
          onTagClick={(a, e) => setOpenSheet({ assignment: a, extra: e })}
        />
      ) : extras.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
          <Users2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">Aucun extra enregistré</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Ajoutez votre équipe pour gérer le staffing événementiel.</p>
          <button onClick={() => { setEditing(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#9c27b0] text-white text-sm font-bold rounded-xl hover:bg-[#7b1fa2] transition-colors">
            <Plus className="h-4 w-4" />Ajouter un extra
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {extras.map((extra) => (
            <ExtraCard
              key={extra.id}
              extra={extra}
              assignments={assignmentsByExtra[extra.id] ?? []}
              onEdit={() => { setEditing(extra); setShowModal(true); }}
              onDelete={() => handleDelete(extra.id)}
              onAssign={() => setAssignFor(extra)}
              onCopyLink={() => copyLink(extra.access_token, extra.id)}
              copied={copied === extra.id}
              onTagClick={(a) => setOpenSheet({ assignment: a, extra })}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <ExtraModal
          initial={editing ?? undefined}
          onSave={handleSaveExtra}
          onClose={() => { setShowModal(false); setEditing(null); }}
          saving={saving}
        />
      )}
      {assignFor && user && (
        <AssignModal
          extra={assignFor}
          userId={user.id}
          assignedQuoteIds={(assignmentsByExtra[assignFor.id] ?? []).map((a) => a.quote.id)}
          onSave={handleAssign}
          onClose={() => setAssignFor(null)}
        />
      )}

      {/* Event sheet */}
      {openSheet && (
        <EventSheet
          assignment={openSheet.assignment}
          extra={openSheet.extra}
          onClose={() => setOpenSheet(null)}
          onStatusChange={handleStatusChange}
          onRemove={handleRemoveAssignment}
          onSave={handleSaveSheet}
        />
      )}
    </div>
  );
}
