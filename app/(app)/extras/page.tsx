'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Trash2, Link2, Loader2, Check, ChevronLeft, ChevronRight,
  UserPlus, CalendarDays, MapPin, Users, ArrowRight, Phone, Mail,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, iconBtn, iconBtnDanger, inputCls, labelCls, pill } from '@/components/ui/kit';
import { ErrorBanner } from '@/components/evenements/shared';

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

const STATUSES: { value: Status; label: string; cls: string; dot: string }[] = [
  { value: 'a_solliciter', label: 'À solliciter', cls: 'bg-primary-50 text-primary-700', dot: 'bg-primary-500' },
  { value: 'confirme',     label: 'Confirmé',     cls: 'bg-sage-100 text-sage',          dot: 'bg-sage' },
  { value: 'present',      label: 'Présent',      cls: 'bg-gray-100 text-gray-700',      dot: 'bg-gray-500' },
];

function st(s: Status) { return STATUSES.find((x) => x.value === s) ?? STATUSES[0]; }

function dateFr(d: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return 'Sans date';
  return new Date(d + 'T00:00').toLocaleDateString('fr-FR', opts ?? { weekday: 'short', day: '2-digit', month: 'short' });
}

/** Date du jour au format AAAA-MM-JJ, en heure locale (toISOString décalerait d'un jour le soir et près de minuit). */
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center flex-shrink-0">
      {initialsOf(name)}
    </span>
  );
}

function StatusPill({ value }: { value: Status }) {
  const s = st(value);
  return (
    <span className={cn(pill, 'gap-1.5', s.cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />{s.label}
    </span>
  );
}

/** Choix du statut en onglets segmentés : visible d'un coup d'œil, confortable au doigt. */
function StatusChoice({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <div className="flex p-1 rounded-xl bg-gray-200/70" role="radiogroup" aria-label="Statut">
      {STATUSES.map((s) => (
        <button key={s.value} type="button" role="radio" aria-checked={value === s.value} onClick={() => onChange(s.value)}
          className={cn('flex-1 flex items-center justify-center gap-1.5 h-10 px-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
            value === s.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', s.dot)} />{s.label}
        </button>
      ))}
    </div>
  );
}

// ── Fiche d'une mission ──────────────────────────────────────────────────────
interface SheetProps {
  assignment: Assignment;
  extra: Extra;
  onClose: () => void;
  onStatusChange: (id: string, s: Status) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onSave: (id: string, arrivalTime: string, notes: string) => Promise<boolean>;
}

function MissionModal({ assignment, extra, onClose, onStatusChange, onRemove, onSave }: SheetProps) {
  const [detail, setDetail]   = useState<QuoteDetail | null>(null);
  const [arrTime, setArrTime] = useState(assignment.arrival_time ?? '');
  const [notes, setNotes]     = useState(assignment.mission_notes ?? '');
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from('quotes')
      .select('id, event_type, event_date, client_name, event_location, guest_count')
      .eq('id', assignment.quote.id)
      .single()
      .then(({ data }) => { if (data) setDetail(data as QuoteDetail); });
  }, [assignment.quote.id]);

  const handleSave = async () => {
    setSaving(true); setError(null);
    const ok = await onSave(assignment.id, arrTime, notes);
    setSaving(false);
    if (!ok) { setError('La mission n’a pas pu être enregistrée. Réessayez.'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const changeStatus = async (s: Status) => {
    setError(null);
    if (!(await onStatusChange(assignment.id, s))) setError('Le statut n’a pas pu être changé. Réessayez.');
  };

  const remove = async () => {
    if (!confirm(`Retirer ${extra.name} de cet événement ?`)) return;
    if (await onRemove(assignment.id)) onClose();
    else setError('L’extra n’a pas pu être retiré. Réessayez.');
  };

  const q = detail ?? assignment.quote;

  return (
    <Modal
      title={`Mission de ${extra.name}`}
      onClose={onClose}
      footer={<>
        <button onClick={remove} className={cn(btnGhost, 'mr-auto text-danger hover:bg-danger/10')}>Retirer</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? 'Enregistré' : 'Enregistrer'}
        </button>
      </>}
    >
      <div className="space-y-5 pb-3">
        <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
          <p className="font-semibold text-gray-900 leading-snug">{q.event_type || 'Événement'}</p>
          <p className="text-sm text-gray-600">{q.client_name}</p>
          <div className="space-y-1.5 text-sm text-gray-700 pt-1">
            {q.event_date && (
              <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-gray-500 flex-shrink-0" />
                {dateFr(q.event_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            )}
            {detail?.event_location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-500 flex-shrink-0" />{detail.event_location}</p>}
            {detail?.guest_count ? <p className="flex items-center gap-2"><Users className="h-4 w-4 text-gray-500 flex-shrink-0" />{detail.guest_count} couverts</p> : null}
          </div>
          <Link href={`/evenements/${q.id}`} className="inline-flex items-center gap-1.5 min-h-10 text-sm font-medium text-primary-700 hover:underline">
            Voir l’événement<ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div>
          <p className={labelCls}>Statut</p>
          <StatusChoice value={assignment.status} onChange={changeStatus} />
        </div>

        <div>
          <label htmlFor="mission-time" className={labelCls}>Heure d’arrivée</label>
          <input id="mission-time" type="time" value={arrTime} onChange={(e) => setArrTime(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label htmlFor="mission-notes" className={labelCls}>Notes de mission</label>
          <textarea id="mission-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
            placeholder="Tenue, matériel à apporter, consignes particulières"
            className={cn(inputCls, 'h-auto py-3 resize-none')} />
        </div>

        {(extra.phone || extra.email) && (
          <div className="space-y-1 text-sm text-gray-700">
            <p className="font-medium text-gray-900">Contact</p>
            {extra.phone && <a href={`tel:${extra.phone}`} className="flex items-center gap-2 min-h-10"><Phone className="h-4 w-4 text-gray-500" />{extra.phone}</a>}
            {extra.email && <a href={`mailto:${extra.email}`} className="flex items-center gap-2 min-h-10 break-all"><Mail className="h-4 w-4 text-gray-500 flex-shrink-0" />{extra.email}</a>}
          </div>
        )}

        {error && <p role="alert" className={errorCls}>{error}</p>}
      </div>
    </Modal>
  );
}

// ── Affecter à un événement ──────────────────────────────────────────────────
function AssignModal({
  extra, userId, assignedQuoteIds, onSave, onClose,
}: {
  extra: Extra;
  userId: string;
  assignedQuoteIds: string[];
  onSave: (quoteId: string, status: Status, arrivalTime: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [quotes, setQuotes]   = useState<QuoteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [quoteId, setQuoteId] = useState('');
  const [status, setStatus]   = useState<Status>('a_solliciter');
  const [arrTime, setArrTime] = useState('');
  const [error, setError]     = useState<string | null>(null);
  // Clé stable : la liste est recréée à chaque rendu de la page, sans que son contenu change.
  const assignedKey = assignedQuoteIds.join(',');

  useEffect(() => {
    const assigned = assignedKey ? assignedKey.split(',') : [];
    createClient()
      .from('quotes')
      .select('id, event_type, event_date, client_name')
      .eq('user_id', userId)
      .order('event_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        setQuotes(((data ?? []) as QuoteOption[]).filter((q) => !assigned.includes(q.id)));
        setLoading(false);
      });
  }, [userId, assignedKey]);

  const submit = async () => {
    if (!quoteId) return;
    setSaving(true); setError(null);
    const ok = await onSave(quoteId, status, arrTime);
    setSaving(false);
    if (!ok) setError('L’extra n’a pas pu être affecté. Réessayez.');
  };

  return (
    <Modal
      title="Assigner à un événement"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Annuler</button>
        <button onClick={submit} disabled={!quoteId || saving} className={btnPrimary}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Assigner
        </button>
      </>}
    >
      <div className="space-y-4 pb-3">
        <p className="text-[15px] font-semibold text-gray-900">{extra.name}</p>
        <div>
          <label htmlFor="assign-event" className={labelCls}>Événement</label>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : quotes.length === 0 ? (
            <p className="rounded-2xl bg-gray-50 px-4 py-4 text-sm text-gray-600">Aucun événement disponible. Les événements viennent de vos devis.</p>
          ) : (
            <select id="assign-event" value={quoteId} onChange={(e) => setQuoteId(e.target.value)} className={inputCls}>
              <option value="">Choisir un événement</option>
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.event_type || 'Événement'}, {q.client_name}{q.event_date ? ` (${dateFr(q.event_date, { day: 'numeric', month: 'long' })})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <p className={labelCls}>Statut de départ</p>
          <StatusChoice value={status} onChange={setStatus} />
        </div>
        <div>
          <label htmlFor="assign-time" className={labelCls}>Heure d’arrivée</label>
          <input id="assign-time" type="time" value={arrTime} onChange={(e) => setArrTime(e.target.value)} className={inputCls} />
        </div>
        {error && <p role="alert" className={errorCls}>{error}</p>}
      </div>
    </Modal>
  );
}

// ── Fiche d'un extra ─────────────────────────────────────────────────────────
function ExtraModal({ initial, onSave, onClose, saving }: {
  initial?: Partial<Extra>;
  onSave: (d: { name: string; role: string; phone: string; email: string }) => Promise<boolean>;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName]   = useState(initial?.name  ?? '');
  const [role, setRole]   = useState(initial?.role  ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    setError(null);
    if (!(await onSave({ name, role, phone, email }))) setError('L’extra n’a pas pu être enregistré. Réessayez.');
  };

  return (
    <Modal
      title={initial?.id ? 'Modifier l’extra' : 'Nouvel extra'}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Annuler</button>
        <button onClick={submit} disabled={!name.trim() || saving} className={btnPrimary}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}{initial?.id ? 'Enregistrer' : 'Ajouter'}
        </button>
      </>}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4 pb-3">
        <div>
          <label htmlFor="extra-name" className={labelCls}>Nom complet</label>
          <input id="extra-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" className={inputCls} />
        </div>
        <div>
          <label htmlFor="extra-role" className={labelCls}>Rôle</label>
          <select id="extra-role" value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            <option value="">Aucun</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="extra-phone" className={labelCls}>Téléphone</label>
            <input id="extra-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 00 00 00 00" className={inputCls} />
          </div>
          <div>
            <label htmlFor="extra-email" className={labelCls}>Email</label>
            <input id="extra-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@exemple.fr" className={inputCls} />
          </div>
        </div>
        {error && <p role="alert" className={errorCls}>{error}</p>}
      </form>
    </Modal>
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

function AgendaView({ extras, assignments, onTagClick }: {
  extras: Extra[];
  assignments: Assignment[];
  onTagClick: (a: Assignment, e: Extra) => void;
}) {
  const COLS = 8;
  const [offset, setOffset] = useState(0); // en blocs de huit semaines

  const weeks = useMemo(() => {
    const base = addDays(mondayOf(new Date()), offset * COLS * 7);
    return Array.from({ length: COLS }, (_, i) => {
      const start = addDays(base, i * 7);
      return { start, end: addDays(start, 6) };
    });
  }, [offset]);

  const byExtra = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const a of assignments) (map[a.extra_id] ??= []).push(a);
    return map;
  }, [assignments]);

  const s = weeks[0].start;
  const e = weeks[COLS - 1].end;
  const periodLabel = `Du ${s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${e.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  return (
    <section className={cn(cardCls, 'overflow-hidden')}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-2 sm:px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={() => setOffset((v) => v - 1)} className={iconBtn} aria-label="Huit semaines plus tôt"><ChevronLeft className="h-5 w-5" /></button>
          <p className="text-[15px] font-semibold text-gray-900 min-w-0">{periodLabel}</p>
          <button onClick={() => setOffset((v) => v + 1)} className={iconBtn} aria-label="Huit semaines plus tard"><ChevronRight className="h-5 w-5" /></button>
          {offset !== 0 && <button onClick={() => setOffset(0)} className={cn(btnGhost, 'h-10 text-sm')}>Aujourd’hui</button>}
        </div>
        <div className="flex items-center gap-3 px-2">
          {STATUSES.map((x) => (
            <span key={x.value} className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap">
              <span className={cn('w-2 h-2 rounded-full', x.dot)} />{x.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 min-w-[150px] sticky left-0 bg-white z-10">Extra</th>
              {weeks.map((w, i) => (
                <th key={i} className="text-center px-1.5 py-2.5 font-medium text-gray-500 min-w-[88px]">
                  <span className="block text-xs">Semaine du</span>
                  <span className="block font-semibold text-gray-900">{w.start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {extras.map((extra) => {
              const rows = byExtra[extra.id] ?? [];
              return (
                <tr key={extra.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 sticky left-0 bg-white z-10">
                    <p className="font-semibold text-gray-900 leading-snug">{extra.name}</p>
                    {extra.role && <p className="text-xs text-gray-500">{extra.role}</p>}
                  </td>
                  {weeks.map((w, i) => {
                    const hits = rows.filter((r) => r.quote.event_date && r.quote.event_date >= isoDate(w.start) && r.quote.event_date <= isoDate(w.end));
                    return (
                      <td key={i} className="text-center px-1 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          {hits.map((h) => (
                            <button key={h.id} onClick={() => onTagClick(h, extra)}
                              title={`${h.quote.event_type}, ${h.quote.client_name}`}
                              className={cn('w-full min-h-10 px-1.5 py-1 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity', st(h.status).cls)}>
                              {dateFr(h.quote.event_date, { day: '2-digit', month: '2-digit' })}
                              <span className="block truncate max-w-[80px] mx-auto text-[11px] font-normal">{h.quote.client_name}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Ligne d'un extra ──────────────────────────────────────────────────────────
function ExtraRow({
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
  const today = isoDate(new Date());
  const upcoming = assignments
    .filter((a) => !a.quote.event_date || a.quote.event_date >= today)
    .sort((a, b) => (a.quote.event_date ?? '').localeCompare(b.quote.event_date ?? ''));
  const past = assignments
    .filter((a) => a.quote.event_date && a.quote.event_date < today)
    .sort((a, b) => (b.quote.event_date ?? '').localeCompare(a.quote.event_date ?? ''));
  const meta = [extra.role, extra.phone, extra.email].filter(Boolean).join(', ');

  return (
    <li className="py-1">
      <div className="flex items-center gap-1 pr-2">
        <button onClick={onEdit} aria-label={`Modifier ${extra.name}`} className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 text-left pl-4 sm:pl-5 py-2.5">
          <Avatar name={extra.name} />
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-gray-900 truncate">{extra.name}</span>
            <span className="block text-sm text-gray-500 truncate">{meta || 'Aucune coordonnée'}</span>
          </span>
        </button>
        <button onClick={onAssign} className={cn(btnSecondary, 'h-10 px-3 hidden sm:inline-flex')}><UserPlus className="h-4 w-4" />Assigner</button>
        <button onClick={onAssign} className={cn(iconBtn, 'sm:hidden')} aria-label={`Assigner ${extra.name} à un événement`}><UserPlus className="h-[18px] w-[18px]" /></button>
        <button onClick={onCopyLink} className={iconBtn} aria-label={`Copier le lien de la page de ${extra.name}`} title={copied ? 'Lien copié' : 'Copier le lien de sa page'}>
          {copied ? <Check className="h-[18px] w-[18px] text-sage" /> : <Link2 className="h-[18px] w-[18px]" />}
        </button>
        <button onClick={onDelete} className={iconBtnDanger} aria-label={`Supprimer ${extra.name}`} title="Supprimer"><Trash2 className="h-[18px] w-[18px]" /></button>
      </div>

      {assignments.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-4 sm:pl-[76px] pr-4 pb-2.5">
          {upcoming.map((a) => {
            const s = st(a.status);
            return (
              <button key={a.id} onClick={() => onTagClick(a)} title={s.label}
                className={cn('inline-flex items-center gap-2 max-w-full min-h-10 px-3 rounded-xl text-sm font-medium hover:opacity-80 transition-opacity', s.cls)}>
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
                <span className="font-semibold whitespace-nowrap">{dateFr(a.quote.event_date, { day: 'numeric', month: 'short' })}</span>
                <span className="truncate">{a.quote.event_type || a.quote.client_name}</span>
              </button>
            );
          })}
          {past.slice(0, 3).map((a) => (
            <button key={a.id} onClick={() => onTagClick(a)}
              className="inline-flex items-center gap-2 max-w-full min-h-10 px-3 rounded-xl text-sm text-gray-500 bg-white border border-gray-200 hover:border-gray-300 transition-colors">
              <span className="whitespace-nowrap">{dateFr(a.quote.event_date, { day: 'numeric', month: 'short' })}</span>
              <span className="truncate">{a.quote.client_name}</span>
            </button>
          ))}
          {past.length > 3 && (
            <span className="inline-flex items-center min-h-10 px-1 text-sm text-gray-500">
              et {past.length - 3} mission{past.length - 3 > 1 ? 's' : ''} passée{past.length - 3 > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ExtrasPage() {
  const { user } = useAuth();
  const [extras,      setExtras]      = useState<Extra[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
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
    const { data: extrasData, error: extrasErr } = await supabase.from('extras').select('*').eq('user_id', user.id).order('name');
    const extras = (extrasData ?? []) as Extra[];
    const extraIds = extras.map((e) => e.id);
    let assigns: Assignment[] = [];
    let assignErr = false;
    if (extraIds.length > 0) {
      const { data: aData, error: aError } = await supabase
        .from('event_extras')
        .select('id, extra_id, status, arrival_time, mission_notes, quote:quotes(id, event_type, event_date, client_name)')
        .in('extra_id', extraIds);
      assignErr = !!aError;
      assigns = ((aData ?? []) as unknown as Assignment[]).filter((a) => a.quote?.id);
    }
    if (extrasErr || assignErr) setError('Vos extras n’ont pas pu être chargés. Rechargez la page.');
    setExtras(extras);
    setAssignments(assigns);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const assignmentsByExtra = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const a of assignments) (map[a.extra_id] ??= []).push(a);
    return map;
  }, [assignments]);

  const handleSaveExtra = async (form: { name: string; role: string; phone: string; email: string }) => {
    if (!user) return false;
    setSaving(true);
    const supabase = createClient();
    const fields = { name: form.name.trim(), role: form.role || null, phone: form.phone || null, email: form.email || null };
    const res = editing
      ? await supabase.from('extras').update(fields).eq('id', editing.id).select().single()
      : await supabase.from('extras').insert({ user_id: user.id, ...fields }).select().single();
    setSaving(false);
    if (res.error || !res.data) return false;
    const saved = res.data as Extra;
    setExtras((p) => (editing ? p.map((e) => (e.id === saved.id ? saved : e)) : [...p, saved]).sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    setShowModal(false);
    setEditing(null);
    return true;
  };

  const handleDelete = async (extra: Extra) => {
    if (!confirm(`Supprimer ${extra.name} de vos extras ?`)) return;
    const { error: err } = await createClient().from('extras').delete().eq('id', extra.id);
    if (err) { setError('L’extra n’a pas pu être supprimé. Réessayez.'); return; }
    setError(null);
    setExtras((p) => p.filter((e) => e.id !== extra.id));
    setAssignments((p) => p.filter((a) => a.extra_id !== extra.id));
  };

  const handleStatusChange = async (assignId: string, status: Status) => {
    const { error: err } = await createClient().from('event_extras').update({ status }).eq('id', assignId);
    if (err) return false;
    setAssignments((p) => p.map((a) => a.id === assignId ? { ...a, status } : a));
    setOpenSheet((s) => s && s.assignment.id === assignId ? { ...s, assignment: { ...s.assignment, status } } : s);
    return true;
  };

  const handleRemoveAssignment = async (assignId: string) => {
    const { error: err } = await createClient().from('event_extras').delete().eq('id', assignId);
    if (err) return false;
    setAssignments((p) => p.filter((a) => a.id !== assignId));
    return true;
  };

  const handleSaveSheet = async (assignId: string, arrivalTime: string, notes: string) => {
    const { error: err } = await createClient().from('event_extras')
      .update({ arrival_time: arrivalTime || null, mission_notes: notes || null })
      .eq('id', assignId);
    if (err) return false;
    const patch = { arrival_time: arrivalTime || null, mission_notes: notes || null };
    setAssignments((p) => p.map((a) => a.id === assignId ? { ...a, ...patch } : a));
    setOpenSheet((s) => s && s.assignment.id === assignId ? { ...s, assignment: { ...s.assignment, ...patch } } : s);
    return true;
  };

  const handleAssign = async (quoteId: string, status: Status, arrivalTime: string) => {
    if (!assignFor) return false;
    const { data, error: err } = await createClient()
      .from('event_extras')
      .insert({ extra_id: assignFor.id, quote_id: quoteId, status, arrival_time: arrivalTime || null, mission_notes: null })
      .select('id, extra_id, status, arrival_time, mission_notes, quote:quotes(id, event_type, event_date, client_name)')
      .single();
    if (err || !data) return false;
    setAssignments((p) => [...p, data as unknown as Assignment]);
    setAssignFor(null);
    return true;
  };

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/e/${token}`).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }, () => setError('Le lien n’a pas pu être copié. Réessayez.'));
  };

  const openNew = () => { setEditing(null); setShowModal(true); };

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Extras</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? ' ' : `${extras.length} extra${extras.length > 1 ? 's' : ''} dans votre équipe`}
          </p>
        </div>
        <button onClick={openNew} className={cn(btnPrimary, 'w-full sm:w-auto')}><Plus className="h-4 w-4" />Ajouter un extra</button>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}

      {!loading && extras.length > 0 && (
        <div className="flex p-1 mb-4 rounded-xl bg-gray-200/70 w-fit" role="tablist" aria-label="Affichage">
          {([['list', 'Liste'], ['agenda', 'Agenda']] as const).map(([mode, label]) => (
            <button key={mode} role="tab" aria-selected={viewMode === mode} onClick={() => setViewMode(mode)}
              className={cn('h-10 px-4 rounded-lg text-sm font-medium transition-colors', viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2"><div className="h-4 bg-gray-100 rounded w-1/3" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : extras.length === 0 ? (
        <div className={cn(cardCls, 'flex flex-col items-center px-6 py-16 text-center')}>
          <p className="font-semibold text-gray-900 mb-1">Aucun extra pour le moment</p>
          <p className="text-sm text-gray-500 max-w-sm">Ajoutez vos serveurs, cuisiniers et barmans : vous les affectez ensuite à vos événements, et chacun reçoit le lien de sa page.</p>
        </div>
      ) : viewMode === 'agenda' ? (
        <AgendaView extras={extras} assignments={assignments} onTagClick={(a, e) => setOpenSheet({ assignment: a, extra: e })} />
      ) : (
        <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {extras.map((extra) => (
            <ExtraRow
              key={extra.id}
              extra={extra}
              assignments={assignmentsByExtra[extra.id] ?? []}
              onEdit={() => { setEditing(extra); setShowModal(true); }}
              onDelete={() => handleDelete(extra)}
              onAssign={() => setAssignFor(extra)}
              onCopyLink={() => copyLink(extra.access_token, extra.id)}
              copied={copied === extra.id}
              onTagClick={(a) => setOpenSheet({ assignment: a, extra })}
            />
          ))}
        </ul>
      )}

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
      {openSheet && (
        <MissionModal
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
