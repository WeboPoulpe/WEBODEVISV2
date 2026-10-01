'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Trash2, Link2, Loader2, Check, ChevronLeft, ChevronRight,
  UserPlus, CalendarDays, MapPin, Users, ArrowRight, Phone, Mail, Share2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUrlAction } from '@/lib/useUrlAction';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, iconBtn, iconBtnDanger, inputCls, labelCls, pill } from '@/components/ui/kit';
import { Check as CheckBox, ErrorBanner } from '@/components/evenements/shared';
import MultiAssignModal, { StatusChoice, type NewAssignment } from '@/components/extras/MultiAssignModal';
import { EXTRA_ROLES, MISSION_STATUSES, roleFamily, type MissionStatus } from '@/lib/extras';
import { notifyMissionChanged } from '@/server/extras';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Extra {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  access_token: string;
  /** Jours où l'extra a indiqué ne pas être disponible (depuis sa page de missions). */
  unavailable_dates: string[] | null;
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
  departure_time: string | null;
  mission_notes: string | null;
  invited_at: string | null;
  responded_at: string | null;
  quote: QuoteOption;
}

type Status = MissionStatus;

const ASSIGN_SELECT = 'id, extra_id, status, arrival_time, departure_time, mission_notes, invited_at, responded_at, quote:quotes(id, event_type, event_date, client_name)';

// Statuts communs à toute l'app (lib/extras.ts), avec une pastille pour le planning.
const DOTS: Record<Status, string> = { a_solliciter: 'bg-amber-500', confirme: 'bg-sage', refuse: 'bg-danger', present: 'bg-white' };
const STATUSES: { value: Status; label: string; cls: string; dot: string }[] =
  MISSION_STATUSES.map((m) => ({ value: m.key, label: m.label, cls: m.tone, dot: DOTS[m.key] }));

function st(s: Status) { return STATUSES.find((x) => x.value === s) ?? STATUSES[0]; }
/** Pastille sur fond clair (légende, choix du statut) : « Présent » prend le vert sapin. */
const legendDot = (s: { value: Status; dot: string }) => (s.value === 'present' ? 'bg-forest' : s.dot);

function dateFr(d: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return 'Sans date';
  return new Date(d + 'T00:00').toLocaleDateString('fr-FR', opts ?? { weekday: 'short', day: '2-digit', month: 'short' });
}

const dateTimeFr = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');

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

// ── Fiche d'une mission ──────────────────────────────────────────────────────
interface SheetProps {
  assignment: Assignment;
  extra: Extra;
  onClose: () => void;
  onStatusChange: (id: string, s: Status) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onSave: (id: string, arrivalTime: string, departureTime: string, notes: string) => Promise<boolean>;
}

function MissionModal({ assignment, extra, onClose, onStatusChange, onRemove, onSave }: SheetProps) {
  const [detail, setDetail]   = useState<QuoteDetail | null>(null);
  const [arrTime, setArrTime] = useState(assignment.arrival_time ?? '');
  const [depTime, setDepTime] = useState(assignment.departure_time ?? '');
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
    const ok = await onSave(assignment.id, arrTime, depTime, notes);
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
          <p className="text-sm text-gray-500 mt-2">
            {assignment.responded_at && (assignment.status === 'confirme' || assignment.status === 'refuse')
              ? `${assignment.status === 'confirme' ? 'A accepté' : 'A décliné'} lui-même depuis sa page, le ${dateTimeFr(assignment.responded_at)}.`
              : assignment.invited_at ? `Mission envoyée le ${dateTimeFr(assignment.invited_at)}.` : 'Mission pas encore envoyée : envoyez-la depuis l’onglet Extras de l’événement.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="mission-time" className={labelCls}>Heure d’arrivée</label>
            <input id="mission-time" type="time" value={arrTime} onChange={(e) => setArrTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="mission-end" className={labelCls}>Heure de fin</label>
            <input id="mission-end" type="time" value={depTime} onChange={(e) => setDepTime(e.target.value)} className={inputCls} />
          </div>
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

// ── Fiche d'un extra ─────────────────────────────────────────────────────────
const OTHER_ROLE = '__autre__';
function ExtraModal({ initial, onSave, onClose, saving }: {
  initial?: Partial<Extra>;
  onSave: (d: { name: string; role: string; phone: string; email: string }) => Promise<boolean>;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName]   = useState(initial?.name  ?? '');
  // Rôle de la liste, ou « Autre » avec saisie libre (garde les rôles déjà enregistrés hors liste).
  const initialRole = initial?.role ?? '';
  const listed = !initialRole || (EXTRA_ROLES as readonly string[]).includes(initialRole);
  const [roleChoice, setRoleChoice] = useState(listed ? initialRole : OTHER_ROLE);
  const [otherRole, setOtherRole]   = useState(listed ? '' : initialRole);
  const role = roleChoice === OTHER_ROLE ? otherRole.trim() : roleChoice;
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
          <select id="extra-role" value={roleChoice} onChange={(e) => setRoleChoice(e.target.value)} className={inputCls}>
            <option value="">Aucun</option>
            {EXTRA_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value={OTHER_ROLE}>Autre</option>
          </select>
          {roleChoice === OTHER_ROLE && (
            <input aria-label="Autre rôle" value={otherRole} onChange={(e) => setOtherRole(e.target.value)} placeholder="Sommelier, hôtesse d’accueil" className={cn(inputCls, 'mt-2')} />
          )}
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
        {initial?.access_token && initial.name && <MissionPageLink name={initial.name} token={initial.access_token} />}
        {error && <p role="alert" className={errorCls}>{error}</p>}
      </form>
    </Modal>
  );
}

/** Lien de la page de missions de l'extra : à copier ou à partager (SMS, WhatsApp…) depuis le téléphone. */
function MissionPageLink({ name, token }: { name: string; token: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [canShare, setCanShare] = useState(false);
  useEffect(() => { setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function'); }, []);
  const url = () => `${window.location.origin}/e/${token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('error');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Vos missions', text: `Bonjour ${name.split(/\s+/)[0]}, voici votre page de missions : vous y voyez vos missions et y répondez.`, url: url() });
    } catch { /* partage annulé */ }
  };

  return (
    <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
      <p className="font-medium text-gray-900">Sa page de missions</p>
      <p className="text-sm text-gray-600">Il y voit ses missions, accepte ou décline, et indique ses jours d’indisponibilité. Sur son téléphone, il peut l’installer comme une app pour recevoir les nouvelles missions en notification.</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={copy} className={cn(btnSecondary, 'h-10')}>
          {state === 'copied' ? <Check className="h-4 w-4 text-sage" /> : <Link2 className="h-4 w-4" />}{state === 'copied' ? 'Lien copié' : 'Copier le lien'}
        </button>
        {canShare && <button type="button" onClick={share} className={cn(btnSecondary, 'h-10')}><Share2 className="h-4 w-4" />Partager</button>}
      </div>
      {state === 'error' && <p role="alert" className="text-sm text-danger">Le lien n’a pas pu être copié. Réessayez.</p>}
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2">
          {STATUSES.map((x) => (
            <span key={x.value} className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap">
              <span className={cn('w-2 h-2 rounded-full', legendDot(x))} />{x.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap">
            <span className="w-3 h-2 rounded-sm border border-dashed border-gray-400" />Jour pas libre
          </span>
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
                    const from = isoDate(w.start), to = isoDate(w.end);
                    const hits = rows.filter((r) => r.quote.event_date && r.quote.event_date >= from && r.quote.event_date <= to);
                    const off = (extra.unavailable_dates ?? []).map((d) => d.slice(0, 10)).filter((d) => d >= from && d <= to).sort();
                    return (
                      <td key={i} className="text-center px-1 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          {off.map((d) => (
                            <span key={d} title="L’extra a indiqué ne pas être disponible ce jour"
                              className="block w-full px-1.5 py-1 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500">
                              {dateFr(d, { day: '2-digit', month: '2-digit' })}
                              <span className="block text-[11px]">pas libre</span>
                            </span>
                          ))}
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
  extra, assignments, checked, onCheck, onEdit, onDelete, onAssign, onCopyLink, copied, onTagClick,
}: {
  extra: Extra;
  checked: boolean;
  onCheck: (on: boolean) => void;
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
  const daysOff = (extra.unavailable_dates ?? []).map((d) => d.slice(0, 10)).filter((d) => d >= today).sort();

  return (
    <li data-extra={extra.name} className={cn('py-1', checked && 'bg-sage-100/30')}>
      <div className="flex items-center gap-1 pr-2">
        <label className="flex items-center justify-center w-10 h-10 ml-1.5 sm:ml-3 flex-shrink-0 cursor-pointer">
          <CheckBox checked={checked} onChange={onCheck} label={`Sélectionner ${extra.name}`} />
        </label>
        <button onClick={onEdit} aria-label={`Modifier ${extra.name}`} className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 text-left pl-1 sm:pl-2 py-2.5">
          <span className="hidden sm:flex"><Avatar name={extra.name} /></span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-gray-900 truncate">{extra.name}</span>
            <span className="block text-sm text-gray-500 truncate">{meta || 'Aucune coordonnée'}</span>
          </span>
        </button>
        <button onClick={onAssign} className={cn(btnSecondary, 'h-10 px-3 hidden sm:inline-flex')}><UserPlus className="h-4 w-4" />Assigner</button>
        <button onClick={onAssign} className={cn(iconBtn, 'sm:hidden')} aria-label={`Assigner ${extra.name} à des événements`}><UserPlus className="h-[18px] w-[18px]" /></button>
        <button onClick={onCopyLink} className={iconBtn} aria-label={`Copier le lien de la page de missions de ${extra.name}`} title={copied ? 'Lien copié' : 'Copier le lien de sa page de missions'}>
          {copied ? <Check className="h-[18px] w-[18px] text-sage" /> : <Link2 className="h-[18px] w-[18px]" />}
        </button>
        <button onClick={onDelete} className={iconBtnDanger} aria-label={`Supprimer ${extra.name}`} title="Supprimer"><Trash2 className="h-[18px] w-[18px]" /></button>
      </div>

      {assignments.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-[56px] sm:pl-[128px] pr-4 pb-2.5">
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
      {daysOff.length > 0 && (
        <p className="pl-[56px] sm:pl-[128px] pr-4 pb-2.5 text-sm text-gray-600">
          Pas disponible le {daysOff.slice(0, 6).map((d) => dateFr(d, { day: 'numeric', month: 'short' })).join(', ')}
          {daysOff.length > 6 ? ` et ${daysOff.length - 6} autre${daysOff.length - 6 > 1 ? 's' : ''} jour${daysOff.length - 6 > 1 ? 's' : ''}` : ''}
        </p>
      )}
    </li>
  );
}

// ── Filtre par rôle ──────────────────────────────────────────────────────────
type Family = 'all' | 'service' | 'cuisine' | 'plonge' | 'transport' | 'autre';
const FAMILY_FILTERS: { key: Family; label: string }[] = [
  { key: 'all', label: 'Tous' }, { key: 'service', label: 'Service' }, { key: 'cuisine', label: 'Cuisine' },
  { key: 'plonge', label: 'Plonge' }, { key: 'transport', label: 'Transport' }, { key: 'autre', label: 'Autres' },
];
const familyOf = (e: Extra): Family => roleFamily(e.role) ?? 'autre';

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
  // Extras cochés dans la liste, filtre par rôle, et extras pour qui la fenêtre « Assigner » est ouverte.
  const [selected,    setSelected]    = useState<string[]>([]);
  const [family,      setFamily]      = useState<Family>('all');
  const [assignFor,   setAssignFor]   = useState<string[] | null>(null);
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
        .select(ASSIGN_SELECT)
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

  const handleSaveSheet = async (assignId: string, arrivalTime: string, departureTime: string, notes: string) => {
    const patch = { arrival_time: arrivalTime || null, departure_time: departureTime || null, mission_notes: notes || null };
    const { error: err } = await createClient().from('event_extras').update(patch).eq('id', assignId);
    if (err) return false;
    // Mission déjà envoyée dont l'horaire ou les consignes changent : l'extra est prévenu sur ses appareils.
    const before = assignments.find((a) => a.id === assignId);
    if (before?.invited_at && (before.arrival_time !== patch.arrival_time || before.departure_time !== patch.departure_time || before.mission_notes !== patch.mission_notes)) {
      notifyMissionChanged(assignId).catch(() => undefined);
    }
    setAssignments((p) => p.map((a) => a.id === assignId ? { ...a, ...patch } : a));
    setOpenSheet((s) => s && s.assignment.id === assignId ? { ...s, assignment: { ...s.assignment, ...patch } } : s);
    return true;
  };

  /** Toutes les affectations de la fenêtre « Assigner » en un seul envoi. */
  const handleAssign = async (rows: NewAssignment[]) => {
    const { data, error: err } = await createClient().from('event_extras').insert(rows).select(ASSIGN_SELECT);
    if (err || !data) return null;
    const created = (data as unknown as Assignment[]).filter((a) => a.quote?.id);
    setAssignments((p) => [...p, ...created]);
    setSelected([]);
    return created.map((a) => ({ id: a.id, extra_id: a.extra_id, quote_id: a.quote.id }));
  };

  // Filtre par rôle (familles de lib/extras.ts) ; « Tout cocher » porte sur les extras affichés.
  const families = useMemo(() => {
    const count: Record<Family, number> = { all: extras.length, service: 0, cuisine: 0, plonge: 0, transport: 0, autre: 0 };
    for (const e of extras) count[familyOf(e)]++;
    return FAMILY_FILTERS.filter((f) => f.key === 'all' || count[f.key] > 0).map((f) => ({ ...f, count: count[f.key] }));
  }, [extras]);
  const visible = family === 'all' ? extras : extras.filter((e) => familyOf(e) === family);
  const allChecked = visible.length > 0 && visible.every((e) => selected.includes(e.id));
  const checkAll = (on: boolean) => setSelected((list) => on
    ? [...list, ...visible.map((e) => e.id).filter((id) => !list.includes(id))]
    : list.filter((id) => !visible.some((e) => e.id === id)));

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/e/${token}`).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }, () => setError('Le lien n’a pas pu être copié. Réessayez.'));
  };

  const openNew = () => { setEditing(null); setShowModal(true); };
  // Actions rapides du menu (lib/navMega.ts).
  useUrlAction({ nouveau: openNew, agenda: () => setViewMode('agenda') });

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
        <>
          <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2 mb-2 bg-page">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2.5 h-10 pl-3 pr-4 rounded-xl bg-white border border-gray-200 cursor-pointer text-sm font-medium text-gray-900">
                <CheckBox checked={allChecked} onChange={checkAll} label={allChecked ? 'Tout décocher' : 'Tout cocher'} />
                {allChecked ? 'Tout décocher' : 'Tout cocher'}
              </label>
              {families.length > 2 && (
                <div role="group" aria-label="Filtrer par rôle" className="flex flex-wrap gap-1.5">
                  {families.map((f) => (
                    <button key={f.key} type="button" aria-pressed={family === f.key} onClick={() => setFamily(f.key)}
                      className={cn('h-10 px-3 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap',
                        family === f.key ? 'bg-forest border-forest text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300')}>
                      {f.label} <span className={family === f.key ? 'text-white/80' : 'text-gray-500'}>{f.count}</span>
                    </button>
                  ))}
                </div>
              )}
              {selected.length > 0 && (
                <div className="flex items-center gap-3 w-full sm:w-auto sm:ml-auto">
                  <p className="text-sm text-gray-700 flex-1 sm:flex-none whitespace-nowrap">{selected.length} sélectionné{selected.length > 1 ? 's' : ''}</p>
                  <button onClick={() => setAssignFor(selected)} className={cn(btnPrimary, 'h-10')}>
                    <UserPlus className="h-4 w-4" />{selected.length > 1 ? `Assigner ${selected.length} extras` : 'Assigner'}
                  </button>
                </div>
              )}
            </div>
          </div>
          <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {visible.map((extra) => (
            <ExtraRow
              key={extra.id}
              extra={extra}
              assignments={assignmentsByExtra[extra.id] ?? []}
              checked={selected.includes(extra.id)}
              onCheck={(on) => setSelected((list) => (on ? [...list, extra.id] : list.filter((id) => id !== extra.id)))}
              onEdit={() => { setEditing(extra); setShowModal(true); }}
              onDelete={() => handleDelete(extra)}
              onAssign={() => setAssignFor([extra.id])}
              onCopyLink={() => copyLink(extra.access_token, extra.id)}
              copied={copied === extra.id}
              onTagClick={(a) => setOpenSheet({ assignment: a, extra })}
            />
          ))}
          </ul>
        </>
      )}

      {showModal && (
        <ExtraModal
          initial={editing ?? undefined}
          onSave={handleSaveExtra}
          onClose={() => { setShowModal(false); setEditing(null); }}
          saving={saving}
        />
      )}
      {assignFor && (
        <MultiAssignModal
          extras={extras}
          initialSelected={assignFor}
          assignments={assignments}
          onCreate={handleAssign}
          onSent={load}
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
