'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check as CheckIcon, Loader2, MessageCircle, MessageSquare, Send, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import SearchField from '@/components/ui/SearchField';
import DateBlock from '@/components/ui/DateBlock';
import { btnGhost, btnPrimary, btnSecondary, errorCls, iconBtn, inputCls, labelCls } from '@/components/ui/kit';
import { Check } from '@/components/evenements/shared';
import { CONFIRMED_STATUSES, PENDING_STATUSES, quoteStatusLabel } from '@/lib/quoteStatus';
import { MISSION_STATUSES, missionMessage, suggestedStaff, whatsappNumber, type MissionStatus } from '@/lib/extras';
import { inviteToMissions } from '@/server/extras';

// Assigner un ou plusieurs extras à un ou plusieurs événements, en trois temps :
// 1. les événements (à venir, groupés par semaine, recherchables) ;
// 2. la mission : statut, horaires et consignes communs, horaires ajustables événement par événement ;
// 3. la vérification : tableau extras × événements, avec les conflits signalés case par case.
// Les affectations partent en un seul envoi ; on propose ensuite d'envoyer les missions.

export interface PlanExtra {
  id: string; name: string; role: string | null; phone: string | null; email: string | null;
  access_token: string | null; unavailable_dates: string[] | null;
}

/** Affectation existante (toutes celles des extras du compte), pour repérer doublons et jours déjà pris. */
export interface PlanAssignment {
  id: string; extra_id: string; status: MissionStatus;
  quote: { id: string; event_date: string | null; event_type: string; client_name: string };
}

export interface NewAssignment {
  extra_id: string; quote_id: string; status: MissionStatus;
  arrival_time: string | null; departure_time: string | null; mission_notes: string | null;
}

interface EventOption {
  id: string; client_name: string; event_type: string; event_date: string;
  event_location: string | null; guest_count: number | null; status: string;
}

type Step = 'events' | 'mission' | 'recap' | 'done';
interface Hours { arrival: string; departure: string }
interface Created { id: string; extra_id: string; quote_id: string }
interface Report { text: string; unreachable: Created[] }

// ── Statut ─────────────────────────────────────────────────────────────────────
const STATUS_DOT: Record<MissionStatus, string> = { a_solliciter: 'bg-amber-500', confirme: 'bg-sage', refuse: 'bg-danger', present: 'bg-forest' };

/** Choix du statut en onglets segmentés : visible d'un coup d'œil, confortable au doigt. */
export function StatusChoice({ value, onChange, label = 'Statut' }: { value: MissionStatus; onChange: (s: MissionStatus) => void; label?: string }) {
  return (
    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-200/70" role="radiogroup" aria-label={label}>
      {MISSION_STATUSES.map((s) => (
        <button key={s.key} type="button" role="radio" aria-checked={value === s.key} onClick={() => onChange(s.key)}
          className={cn('flex items-center justify-center gap-1.5 h-10 px-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
            value === s.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT[s.key])} />{s.label}
        </button>
      ))}
    </div>
  );
}

// ── Outils ─────────────────────────────────────────────────────────────────────
/** Date du jour au format AAAA-MM-JJ, en heure locale. */
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dayOf = (d: string | null | undefined) => (d ? d.slice(0, 10) : '');
const dateFr = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(dayOf(d) + 'T00:00:00').toLocaleDateString('fr-FR', opts);
const dateShort = (d: string) => dateFr(d, { weekday: 'short', day: 'numeric', month: 'short' });
const dateLong = (d: string) => dateFr(d, { weekday: 'long', day: 'numeric', month: 'long' });
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const eventName = (e: { client_name: string; event_type: string }) => e.client_name || e.event_type || 'Événement';
const hoursText = (h: Hours) =>
  h.arrival ? `${h.arrival}${h.departure ? ` à ${h.departure}` : ''}` : h.departure ? `fin à ${h.departure}` : 'Sans horaire';

function weekLabel(day: string, today: string) {
  const d = new Date(day + 'T00:00:00');
  const monday = new Date(d);
  monday.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
  const t = new Date(today + 'T00:00:00');
  const thisMonday = new Date(t);
  thisMonday.setDate(t.getDate() + (t.getDay() === 0 ? -6 : 1 - t.getDay()));
  const diff = Math.round((monday.getTime() - thisMonday.getTime()) / (7 * 864e5));
  if (diff === 0) return { key: isoDate(monday), label: 'Cette semaine' };
  if (diff === 1) return { key: isoDate(monday), label: 'La semaine prochaine' };
  return { key: isoDate(monday), label: `Semaine du ${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: monday.getFullYear() === t.getFullYear() ? undefined : 'numeric' })}` };
}

/** Ce qui coince pour un extra sur un événement. `dup` : déjà affecté, la case est ignorée. */
interface Conflict { dup: boolean; off: boolean; busy: string[]; twice: string[] }
const hasAlert = (c: Conflict) => c.off || c.busy.length > 0 || c.twice.length > 0;

function conflictText(c: Conflict, short = false): string | null {
  if (c.dup) return short ? 'Déjà affecté' : 'Déjà affecté à cet événement : ignoré';
  if (c.off) return short ? 'Pas disponible' : 'A indiqué ne pas être disponible ce jour';
  if (c.busy.length) return short ? 'Déjà pris ce jour' : `Déjà pris ce jour-là : ${c.busy.join(' ; ')}`;
  if (c.twice.length) return short ? 'Deux le même jour' : `Aussi coché ce jour-là : ${c.twice.join(' ; ')}`;
  return null;
}

// ── Fenêtre ────────────────────────────────────────────────────────────────────
export default function MultiAssignModal({ extras, initialSelected, assignments, onCreate, onSent, onClose }: {
  /** Tous les extras du compte. */
  extras: PlanExtra[];
  /** Extras cochés dans la liste (ou l'extra dont on a touché « Assigner »). */
  initialSelected: string[];
  assignments: PlanAssignment[];
  /** Enregistre les affectations en un seul envoi ; renvoie celles créées, ou null en cas d'échec. */
  onCreate: (rows: NewAssignment[]) => Promise<Created[] | null>;
  /** Missions envoyées : la page recharge les affectations (date d'envoi). */
  onSent: () => void;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const today = isoDate(new Date());
  const [step, setStep] = useState<Step>('events');
  const [extraIds, setExtraIds] = useState<string[]>(initialSelected);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [withPending, setWithPending] = useState(false);
  const [status, setStatus] = useState<MissionStatus>('a_solliciter');
  const [common, setCommon] = useState<Hours>({ arrival: '', departure: '' });
  const [notes, setNotes] = useState('');
  const [overrides, setOverrides] = useState<Record<string, Hours>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created[]>([]);
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);
  // Chaque étape s'ouvre en haut : la zone qui défile est le parent direct du contenu de l'étape.
  const stepRef = useRef<HTMLDivElement>(null);
  useEffect(() => { stepRef.current?.parentElement?.scrollTo({ top: 0 }); }, [step]);

  useEffect(() => {
    createClient()
      .from('quotes')
      .select('id, client_name, event_type, event_date, event_location, guest_count, status')
      .not('event_date', 'is', null)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setLoadError(true);
        setEvents(((data ?? []) as EventOption[]).filter((q) => (CONFIRMED_STATUSES as string[]).includes(q.status) || (PENDING_STATUSES as string[]).includes(q.status)));
        setLoading(false);
      });
  }, [today]);

  const extraById = useMemo(() => new Map(extras.map((e) => [e.id, e])), [extras]);
  const chosenExtras = useMemo(() => extraIds.map((id) => extraById.get(id)).filter((e): e is PlanExtra => !!e), [extraIds, extraById]);
  const isConfirmed = (e: EventOption) => (CONFIRMED_STATUSES as string[]).includes(e.status);
  const pool = useMemo(() => events.filter((e) => withPending || isConfirmed(e)), [events, withPending]);
  const chosenEvents = useMemo(() => pool.filter((e) => eventIds.includes(e.id)), [pool, eventIds]);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return pool;
    return pool.filter((e) => fold([e.client_name, e.event_type, e.event_location, dateLong(e.event_date), dateFr(e.event_date, { day: 'numeric', month: 'numeric' })].filter(Boolean).join(' ')).includes(q));
  }, [pool, query]);

  const weeks = useMemo(() => {
    const out: { key: string; label: string; items: EventOption[] }[] = [];
    for (const e of shown) {
      const w = weekLabel(dayOf(e.event_date), today);
      const last = out[out.length - 1];
      if (last && last.key === w.key) last.items.push(e);
      else out.push({ ...w, items: [e] });
    }
    return out;
  }, [shown, today]);

  // Équipe déjà en place par événement (missions refusées exclues).
  const teamCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of assignments) if (a.status !== 'refuse') map[a.quote.id] = (map[a.quote.id] ?? 0) + 1;
    return map;
  }, [assignments]);

  const hoursFor = (quoteId: string): Hours => overrides[quoteId] ?? common;
  const keyOf = (extraId: string, quoteId: string) => `${extraId}|${quoteId}`;

  /** Conflits d'un extra sur un événement, d'après ses missions existantes, ses jours « pas libre » et les autres cases cochées. */
  const conflictOf = (extra: PlanExtra, ev: EventOption): Conflict => {
    const day = dayOf(ev.event_date);
    const mine = assignments.filter((a) => a.extra_id === extra.id);
    const dup = mine.some((a) => a.quote.id === ev.id);
    const off = (extra.unavailable_dates ?? []).some((d) => dayOf(d) === day);
    const busy = mine.filter((a) => a.status !== 'refuse' && a.quote.id !== ev.id && dayOf(a.quote.event_date) === day)
      .map((a) => [a.quote.event_type, a.quote.client_name].filter(Boolean).join(', ') || 'un autre événement');
    const twice = chosenEvents.filter((o) => o.id !== ev.id && dayOf(o.event_date) === day
      && !excluded.includes(keyOf(extra.id, o.id)) && !mine.some((a) => a.quote.id === o.id)).map(eventName);
    return { dup, off, busy, twice };
  };

  // Récapitulatif : chaque case extra × événement.
  const cells = useMemo(() => chosenExtras.flatMap((x) => chosenEvents.map((ev) => {
    const c = conflictOf(x, ev);
    const key = keyOf(x.id, ev.id);
    return { key, extra: x, ev, c, on: !c.dup && !excluded.includes(key) };
  })), [chosenExtras, chosenEvents, excluded, assignments]);
  const cellOf = (extraId: string, quoteId: string) => cells.find((c) => c.key === keyOf(extraId, quoteId))!;
  const toCreate = cells.filter((c) => c.on);
  const dupCount = cells.filter((c) => c.c.dup).length;
  const offCount = cells.filter((c) => !c.c.dup && excluded.includes(c.key)).length;
  const alerts = cells.filter((c) => c.on && hasAlert(c.c));

  const toggleCell = (key: string, on: boolean) => setExcluded((list) => (on ? list.filter((k) => k !== key) : [...list, key]));
  const toggleEvent = (id: string, on: boolean) => setEventIds((list) => (on ? [...list, id] : list.filter((x) => x !== id)));

  const create = async () => {
    if (toCreate.length === 0) return;
    setSaving(true); setError(null);
    const rows: NewAssignment[] = toCreate.map(({ extra, ev }) => {
      const h = hoursFor(ev.id);
      return { extra_id: extra.id, quote_id: ev.id, status, arrival_time: h.arrival || null, departure_time: h.departure || null, mission_notes: notes.trim() || null };
    });
    const res = await onCreate(rows);
    setSaving(false);
    if (!res) { setError('Les affectations n’ont pas pu être enregistrées. Réessayez.'); return; }
    setCreated(res);
    setStep('done');
  };

  // Missions à envoyer : celles qui attendent une réponse ou sont déjà confirmées.
  const sendable = status === 'a_solliciter' || status === 'confirme' ? created.filter((c) => !sentIds.includes(c.id)) : [];

  const send = async () => {
    if (sendable.length === 0) return;
    setSending(true); setError(null);
    try {
      let emailed = 0, notified = 0;
      const unreachable: string[] = [];
      const ids = sendable.map((c) => c.id);
      // Le serveur traite au plus cent missions par appel.
      for (let i = 0; i < ids.length; i += 100) {
        const res = await inviteToMissions(ids.slice(i, i + 100));
        if (res.error) { setError(res.error); return; }
        emailed += res.emailed; notified += res.notified; unreachable.push(...res.unreachable);
      }
      const reached = ids.length - unreachable.length;
      const parts = [emailed > 0 ? `${emailed} par email` : null, notified > 0 ? `${notified} en notification` : null].filter(Boolean).join(', ');
      setReport({
        text: reached > 0
          ? `${plural(reached, 'mission envoyée', 'missions envoyées')}${parts ? ` : ${parts}` : ''}.`
          : 'Aucune mission n’a pu partir par email ni en notification.',
        unreachable: sendable.filter((c) => unreachable.includes(c.id)),
      });
      setSentIds((list) => [...list, ...ids]);
      onSent();
    } catch {
      setError('Les missions n’ont pas pu être envoyées. Vérifiez votre connexion et réessayez.');
    } finally {
      setSending(false);
    }
  };

  /** SMS ou WhatsApp depuis le téléphone du traiteur : la mission est notée comme envoyée. */
  const markSent = (id: string) => {
    createClient().from('event_extras').update({ invited_at: new Date().toISOString() }).eq('id', id).then(() => onSent());
  };

  const messageFor = (c: Created) => {
    const x = extraById.get(c.extra_id);
    const ev = events.find((e) => e.id === c.quote_id);
    const h = hoursFor(c.quote_id);
    return missionMessage({
      extraName: x?.name ?? '', companyName: profile?.company_name, eventType: ev?.event_type, eventDate: ev?.event_date,
      location: ev?.event_location, arrival: h.arrival || null, departure: h.departure || null,
      link: x?.access_token ? `${window.location.origin}/e/${x.access_token}` : '',
    });
  };

  // ── Pied de fenêtre selon l'étape ──
  const footer = step === 'events' ? (
    <>
      <button onClick={onClose} className={btnGhost}>Annuler</button>
      <button onClick={() => setStep('mission')} disabled={chosenEvents.length === 0 || chosenExtras.length === 0} className={btnPrimary}>
        Continuer{chosenEvents.length > 0 ? ` (${plural(chosenEvents.length, 'événement', 'événements')})` : ''}
      </button>
    </>
  ) : step === 'mission' ? (
    <>
      <button onClick={() => setStep('events')} className={btnGhost}><ArrowLeft className="h-4 w-4" />Retour</button>
      <button onClick={() => setStep('recap')} className={btnPrimary}>Vérifier</button>
    </>
  ) : step === 'recap' ? (
    <>
      <button onClick={() => setStep('mission')} className={btnGhost}><ArrowLeft className="h-4 w-4" />Retour</button>
      <button onClick={create} disabled={saving || toCreate.length === 0} className={btnPrimary}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {toCreate.length === 1 ? 'Créer l’affectation' : `Créer ${toCreate.length} affectations`}
      </button>
    </>
  ) : (
    <>
      <button onClick={onClose} className={sendable.length > 0 ? btnGhost : btnPrimary}>{sendable.length > 0 ? 'Plus tard' : 'Terminer'}</button>
      {sendable.length > 0 && (
        <button onClick={send} disabled={sending} className={btnPrimary}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Envoyer les missions
        </button>
      )}
    </>
  );

  const STEPS: { key: Step; label: string }[] = [
    { key: 'events', label: 'Événements' }, { key: 'mission', label: 'Horaires' }, { key: 'recap', label: 'Vérifier' },
  ];
  const stepIndex = step === 'done' ? 3 : STEPS.findIndex((s) => s.key === step);
  const toolbar = step === 'done' ? undefined : (
    <ol className="flex items-center gap-1.5 pb-2" aria-label="Étapes">
      {STEPS.map((s, i) => (
        <li key={s.key} aria-current={i === stepIndex ? 'step' : undefined}
          className={cn('flex items-center gap-1.5 text-sm', i === stepIndex ? 'text-gray-900 font-semibold' : 'text-gray-500')}>
          <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0',
            i < stepIndex ? 'bg-sage text-white' : i === stepIndex ? 'bg-forest text-white' : 'bg-gray-100 text-gray-600')}>
            {i < stepIndex ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
          </span>
          {s.label}
          {i < STEPS.length - 1 && <span aria-hidden className="w-3 sm:w-6 h-px bg-gray-200 mx-0.5" />}
        </li>
      ))}
    </ol>
  );

  return (
    <Modal title="Assigner à des événements" onClose={onClose} footer={footer} toolbar={toolbar} large>
      {step === 'events' && (
        <div ref={stepRef} className="space-y-4 pb-3">
          <ExtrasPicker extras={extras} chosen={chosenExtras} onChange={setExtraIds} />

          <SearchField value={query} onChange={setQuery} label="Rechercher un événement" placeholder="Client, type, lieu ou date"
            status={query.trim() ? (shown.length === 0 ? `Aucun événement ne correspond à « ${query.trim()} ».` : `${plural(shown.length, 'événement trouvé', 'événements trouvés')}.`) : null} />

          <label className="flex items-center gap-3 min-h-10 cursor-pointer">
            <Check checked={withPending} onChange={setWithPending} label="Inclure les devis en cours" />
            <span className="text-[15px] text-gray-900">Inclure les devis en cours qui ont une date</span>
          </label>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : loadError ? (
            <p role="alert" className={errorCls}>Les événements n’ont pas pu être chargés. Fermez la fenêtre et réessayez.</p>
          ) : pool.length === 0 ? (
            <p className="rounded-2xl bg-gray-50 px-4 py-4 text-sm text-gray-600">
              Aucun événement à venir. Les événements viennent de vos devis validés{withPending ? ' et des devis en cours datés' : ''}.
            </p>
          ) : (
            <div className="space-y-4">
              {weeks.map((w) => (
                <section key={w.key} aria-label={w.label}>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">{w.label}</h3>
                  <ul className="space-y-1.5">
                    {w.items.map((ev) => {
                      const checked = eventIds.includes(ev.id);
                      const wanted = Object.values(suggestedStaff(ev.guest_count, ev.event_type)).reduce((s, n) => s + n, 0);
                      const have = teamCount[ev.id] ?? 0;
                      const hints = chosenExtras.map((x) => ({ x, t: conflictText({ ...conflictOf(x, ev), twice: [] }, true) })).filter((n) => n.t);
                      return (
                        <li key={ev.id} data-event={ev.client_name}>
                          <label className={cn('flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-colors',
                            checked ? 'border-sage bg-sage-100/40' : 'border-gray-200 bg-white hover:border-gray-300')}>
                            <span className="pt-4"><Check checked={checked} onChange={(on) => toggleEvent(ev.id, on)} label={`${eventName(ev)}, ${dateLong(ev.event_date)}`} /></span>
                            <DateBlock iso={ev.event_date} today={dayOf(ev.event_date) === today} />
                            <span className="flex-1 min-w-0">
                              <span className="block font-semibold text-gray-900 break-words">{ev.client_name || 'Sans nom'}</span>
                              <span className="block text-sm text-gray-600 break-words">
                                <span className="capitalize">{dateFr(ev.event_date, { weekday: 'long' })}</span>
                                {ev.event_type ? `, ${ev.event_type}` : ''}{ev.guest_count ? `, ${ev.guest_count} couverts` : ''}
                              </span>
                              {ev.event_location && <span className="block text-sm text-gray-500 break-words">{ev.event_location}</span>}
                              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm">
                                <span className={cn(wanted > 0 && have >= wanted ? 'text-sage' : 'text-gray-600')}>
                                  {wanted > 0 ? `Équipe : ${have} sur ${wanted} conseillés` : `Équipe : ${plural(have, 'extra', 'extras')}`}
                                </span>
                                {!isConfirmed(ev) && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{quoteStatusLabel(ev.status)}</span>}
                              </span>
                              {hints.length > 0 && (
                                <span className="block mt-1 space-y-0.5">
                                  {hints.map(({ x, t }) => (
                                    <span key={x.id} className={cn('flex items-start gap-1.5 text-sm', t === 'Déjà affecté' ? 'text-gray-500' : 'text-primary-800')}>
                                      {t !== 'Déjà affecté' && <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />}{x.name} : {t?.toLowerCase()}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'mission' && (
        <div ref={stepRef} className="space-y-5 pb-3">
          <p className="text-sm text-gray-600">
            {plural(chosenExtras.length, 'extra', 'extras')} sur {plural(chosenEvents.length, 'événement', 'événements')}. Ces réglages valent pour toutes les affectations.
          </p>
          <div>
            <p className={labelCls}>Statut de départ</p>
            <StatusChoice value={status} onChange={setStatus} label="Statut de départ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="plan-arrival" className={labelCls}>Heure d’arrivée</label>
              <input id="plan-arrival" type="time" value={common.arrival} onChange={(e) => setCommon({ ...common, arrival: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="plan-departure" className={labelCls}>Heure de fin</label>
              <input id="plan-departure" type="time" value={common.departure} onChange={(e) => setCommon({ ...common, departure: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="plan-notes" className={labelCls}>Consignes</label>
            <textarea id="plan-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tenue noire, arrivée par l’entrée de service" className={cn(inputCls, 'h-auto py-3 resize-none')} />
          </div>

          {chosenEvents.length > 1 || Object.keys(overrides).length > 0 ? (
            <section aria-label="Horaires par événement">
              <p className={labelCls}>Horaires par événement</p>
              <p className="text-sm text-gray-500 -mt-1 mb-2">Un événement commence plus tôt ? Changez ses horaires sans toucher aux autres.</p>
              <ul className="space-y-1.5">
                {chosenEvents.map((ev) => {
                  const own = overrides[ev.id];
                  return (
                    <li key={ev.id} data-hours={ev.client_name} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex-1 min-w-[10rem]">
                          <span className="block font-medium text-gray-900 break-words">{eventName(ev)}</span>
                          <span className="block text-sm text-gray-600">
                            {dateShort(ev.event_date)}, {own ? hoursText(own) : common.arrival || common.departure ? `${hoursText(common)} (communs)` : 'horaires communs'}
                          </span>
                        </span>
                        {own ? (
                          <button onClick={() => setOverrides(({ [ev.id]: _, ...rest }) => rest)} className={cn(btnGhost, 'h-10 text-sm')}>Horaires communs</button>
                        ) : (
                          <button onClick={() => setOverrides({ ...overrides, [ev.id]: { ...common } })} className={cn(btnSecondary, 'h-10 text-sm')}
                            aria-label={`Changer les horaires pour ${eventName(ev)}`}>Changer</button>
                        )}
                      </div>
                      {own && (
                        <div className="grid grid-cols-2 gap-3 mt-2 mb-1">
                          <div>
                            <label htmlFor={`arr-${ev.id}`} className="block text-sm text-gray-600 mb-1">Arrivée</label>
                            <input id={`arr-${ev.id}`} type="time" aria-label={`Heure d’arrivée pour ${eventName(ev)}`} value={own.arrival}
                              onChange={(e) => setOverrides({ ...overrides, [ev.id]: { ...own, arrival: e.target.value } })} className={inputCls} />
                          </div>
                          <div>
                            <label htmlFor={`dep-${ev.id}`} className="block text-sm text-gray-600 mb-1">Fin</label>
                            <input id={`dep-${ev.id}`} type="time" aria-label={`Heure de fin pour ${eventName(ev)}`} value={own.departure}
                              onChange={(e) => setOverrides({ ...overrides, [ev.id]: { ...own, departure: e.target.value } })} className={inputCls} />
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      {step === 'recap' && (
        <div ref={stepRef} className="space-y-4 pb-3">
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <p className="text-[15px] font-semibold text-gray-900" data-testid="plan-total">
              {plural(chosenExtras.length, 'extra', 'extras')} × {plural(chosenEvents.length, 'événement', 'événements')} = {plural(cells.length, 'affectation', 'affectations')}
            </p>
            <p className="text-sm text-gray-600 mt-0.5" data-testid="plan-summary">
              {[
                `${toCreate.length} à créer`,
                dupCount > 0 ? `${dupCount} déjà ${dupCount > 1 ? 'faites' : 'faite'}, ${dupCount > 1 ? 'ignorées' : 'ignorée'}` : null,
                offCount > 0 ? `${offCount} ${offCount > 1 ? 'décochées' : 'décochée'}` : null,
              ].filter(Boolean).join(', ')}.
            </p>
          </div>

          {alerts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3">
              <p className="flex items-start gap-1.5 text-sm text-primary-800 min-w-0">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {alerts.length === 1 ? 'Une case est en alerte' : `${alerts.length} cases sont en alerte`} : extra pas disponible ou déjà pris ce jour-là.
              </p>
              <button onClick={() => setExcluded((list) => [...list, ...alerts.map((a) => a.key)])} className={cn(btnSecondary, 'h-10 text-sm')}>
                Décocher les alertes
              </button>
            </div>
          )}

          {/* Grand écran : tableau extras × événements. */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2.5 font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[140px]">Extra</th>
                  {chosenEvents.map((ev) => (
                    <th key={ev.id} className="px-2 py-2.5 font-medium text-gray-500 text-center min-w-[120px] max-w-[160px] align-bottom">
                      <span className="block text-gray-900 font-semibold">{dateShort(ev.event_date)}</span>
                      <span className="block truncate" title={eventName(ev)}>{eventName(ev)}</span>
                      <span className="block text-xs font-normal">{hoursText(hoursFor(ev.id))}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chosenExtras.map((x) => (
                  <tr key={x.id} className="border-b border-gray-100 last:border-0">
                    <th scope="row" className="text-left px-3 py-2 font-normal sticky left-0 bg-white z-10">
                      <span className="block font-semibold text-gray-900">{x.name}</span>
                      {x.role && <span className="block text-xs text-gray-500">{x.role}</span>}
                    </th>
                    {chosenEvents.map((ev) => {
                      const cell = cellOf(x.id, ev.id);
                      const t = conflictText(cell.c, true);
                      const alert = !cell.c.dup && hasAlert(cell.c);
                      return (
                        <td key={ev.id} data-cell={`${x.name}|${ev.client_name}`} title={conflictText(cell.c) ?? undefined}
                          className={cn('px-2 py-2 text-center align-middle', cell.c.dup ? 'bg-gray-50' : alert && cell.on ? 'bg-primary-50' : '')}>
                          {cell.c.dup ? (
                            <span className="inline-flex items-center justify-center min-h-10 text-xs text-gray-500">Déjà affecté</span>
                          ) : (
                            <label className="inline-flex flex-col items-center justify-center min-h-10 min-w-10 cursor-pointer">
                              <Check checked={cell.on} onChange={(on) => toggleCell(cell.key, on)} label={`${x.name}, ${eventName(ev)}, ${dateShort(ev.event_date)}`} />
                              {t && <span className="flex items-center gap-1 mt-1 text-xs text-primary-800"><AlertTriangle className="h-3 w-3" />{t}</span>}
                            </label>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Téléphone : une carte par événement, les extras dessous. */}
          <div className="md:hidden space-y-3">
            {chosenEvents.map((ev) => (
              <section key={ev.id} aria-label={eventName(ev)} className="rounded-2xl border border-gray-200 bg-white">
                <div className="px-3 pt-3 pb-1">
                  <p className="font-semibold text-gray-900 break-words">{eventName(ev)}</p>
                  <p className="text-sm text-gray-600">{dateShort(ev.event_date)}, {hoursText(hoursFor(ev.id))}</p>
                </div>
                <ul className="px-1 pb-1">
                  {chosenExtras.map((x) => {
                    const cell = cellOf(x.id, ev.id);
                    const t = conflictText(cell.c);
                    return (
                      <li key={x.id} data-cell={`${x.name}|${ev.client_name}`}>
                        <label className={cn('flex items-start gap-3 min-h-12 px-2 py-2 rounded-xl', cell.c.dup ? 'opacity-70' : 'cursor-pointer')}>
                          <span className="pt-0.5">
                            {cell.c.dup
                              ? <span className="flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 text-gray-500"><CheckIcon className="h-4 w-4" /></span>
                              : <Check checked={cell.on} onChange={(on) => toggleCell(cell.key, on)} label={`${x.name}, ${eventName(ev)}, ${dateShort(ev.event_date)}`} />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block font-medium text-gray-900 break-words">{x.name}</span>
                            {t && (
                              <span className={cn('flex items-start gap-1.5 text-sm', cell.c.dup ? 'text-gray-500' : 'text-primary-800')}>
                                {!cell.c.dup && <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />}{t}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {error && <p role="alert" className={errorCls}>{error}</p>}
        </div>
      )}

      {step === 'done' && (
        <div ref={stepRef} className="space-y-4 pb-3">
          <div role="status" className="rounded-2xl bg-sage-100/60 px-4 py-3">
            <p className="font-semibold text-gray-900 flex items-center gap-2"><CheckIcon className="h-5 w-5 text-sage" />
              {created.length === 1 ? 'Affectation créée.' : `${created.length} affectations créées.`}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              {sentIds.length === 0 && sendable.length > 0
                ? 'Les extras ne sont pas encore prévenus. Envoyez-leur la mission : par email, et en notification si leur page est installée.'
                : sentIds.length === 0 ? 'Vous retrouvez ces missions sur chaque extra et dans l’onglet Extras de chaque événement.' : ''}
            </p>
          </div>

          <ul className="space-y-1 text-sm text-gray-700">
            {chosenEvents.map((ev) => {
              const n = created.filter((c) => c.quote_id === ev.id);
              if (n.length === 0) return null;
              return (
                <li key={ev.id}>
                  <span className="font-medium text-gray-900">{dateShort(ev.event_date)}, {eventName(ev)}</span> : {n.map((c) => extraById.get(c.extra_id)?.name).filter(Boolean).join(', ')}
                </li>
              );
            })}
          </ul>

          {report && (
            <div data-testid="send-report" className="rounded-2xl border border-gray-200 bg-white px-4 py-3 space-y-2">
              <p className="text-[15px] font-medium text-gray-900">{report.text}</p>
              {report.unreachable.length > 0 && (
                <>
                  <p className="text-sm text-gray-700">Sans email ni appareil enregistré : envoyez-leur la mission par SMS ou WhatsApp.</p>
                  <ul className="divide-y divide-gray-100">
                    {report.unreachable.map((c) => {
                      const x = extraById.get(c.extra_id);
                      const ev = events.find((e) => e.id === c.quote_id);
                      const phone = (x?.phone ?? '').replace(/[^\d+]/g, '');
                      const wa = whatsappNumber(x?.phone);
                      return (
                        <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
                          <span className="flex-1 min-w-[10rem] text-sm">
                            <span className="block font-medium text-gray-900">{x?.name}</span>
                            <span className="block text-gray-600">{ev ? `${dateShort(ev.event_date)}, ${eventName(ev)}` : ''}</span>
                          </span>
                          {phone ? (
                            <>
                              <a href={`sms:${phone}?&body=${encodeURIComponent(messageFor(c))}`} onClick={() => markSent(c.id)} className={cn(btnSecondary, 'h-10 text-sm')}>
                                <MessageSquare className="h-4 w-4" />SMS
                              </a>
                              {wa && (
                                <a href={`https://wa.me/${wa}?text=${encodeURIComponent(messageFor(c))}`} target="_blank" rel="noopener noreferrer" onClick={() => markSent(c.id)} className={cn(btnSecondary, 'h-10 text-sm')}>
                                  <MessageCircle className="h-4 w-4" />WhatsApp
                                </a>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-gray-500">Aucun numéro : copiez le lien de sa page depuis la liste.</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}
          {error && <p role="alert" className={errorCls}>{error}</p>}
        </div>
      )}
    </Modal>
  );
}

/** Extras concernés : pastilles retirables, et un menu pour en ajouter. */
function ExtrasPicker({ extras, chosen, onChange }: { extras: PlanExtra[]; chosen: PlanExtra[]; onChange: (ids: string[]) => void }) {
  const others = extras.filter((e) => !chosen.some((c) => c.id === e.id));
  const ids = chosen.map((c) => c.id);
  return (
    <div>
      <p className={labelCls}>{chosen.length > 1 ? `Pour ${chosen.length} extras` : 'Pour'}</p>
      <div className="flex flex-wrap items-center gap-2">
        {chosen.map((e) => (
          <span key={e.id} className="inline-flex items-center gap-1 max-w-full min-h-10 pl-3 pr-0.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-900">
            <span className="truncate">{e.name}</span>
            <button type="button" onClick={() => onChange(ids.filter((x) => x !== e.id))} className={cn(iconBtn, 'w-9 h-9')} aria-label={`Retirer ${e.name}`}>
              <X className="h-4 w-4" />
            </button>
          </span>
        ))}
        {chosen.length === 0 && <span className="text-sm text-gray-600">Choisissez au moins un extra.</span>}
        {others.length > 0 && (
          <select aria-label="Ajouter un extra" value="" onChange={(e) => e.target.value && onChange([...ids, e.target.value])}
            className={cn(inputCls, 'h-10 w-auto max-w-full pr-8 text-sm')}>
            <option value="">Ajouter un extra</option>
            {others.map((e) => <option key={e.id} value={e.id}>{e.name}{e.role ? `, ${e.role}` : ''}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

