'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, Link2, Loader2, MessageCircle, MessageSquare, Pencil, Plus, Printer, Send, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { generateStaffHtml, type StaffMission } from '@/lib/generateStaffHtml';
import { MISSION_STATUSES, missionMessage, roleFamily, suggestedStaff, whatsappNumber, type MissionStatus } from '@/lib/extras';
import { inviteToMissions, notifyMissionChanged } from '@/server/extras';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, iconBtn, iconBtnDanger, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { Check, EmptyState, ErrorBanner, useActionError, type EventQuote } from './shared';

interface Extra {
  id: string; name: string; phone: string | null; email: string | null; role: string | null;
  access_token: string | null; unavailable_dates: string[] | null;
}

interface Assignment {
  id: string;
  extra_id: string;
  status: MissionStatus;
  arrival_time: string | null;
  departure_time: string | null;
  mission_notes: string | null;
  assign_courses: boolean;
  invited_at: string | null;
  responded_at: string | null;
  extra: Extra | null;
}

const EXTRA_COLS = 'id, name, phone, email, role, access_token, unavailable_dates';
const SELECT = `*, extra:extras(${EXTRA_COLS})`;

/** Fenêtre « Affecter des extras » : plusieurs extras d'un coup, horaires et consignes communs. */
interface TeamForm { selected: string[]; arrival: string; departure: string; notes: string }
/** Fenêtre « Modifier la mission » d'un extra. */
interface EditForm { id: string; arrival: string; departure: string; notes: string; courses: boolean }

/** Couleur du statut choisi, sur le segment blanc (lisible sur la piste grise). */
const ACTIVE_TEXT: Record<MissionStatus, string> = { a_solliciter: 'text-amber-800', confirme: 'text-sage', refuse: 'text-danger', present: 'text-forest' };

const FAMILIES = [
  { key: 'service', label: 'Service' },
  { key: 'cuisine', label: 'Cuisine' },
  { key: 'plonge', label: 'Plonge' },
] as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export default function ExtrasTab({ quote }: { quote: EventQuote }) {
  const { user, profile } = useAuth();
  const { error, setError, check } = useActionError();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamForm | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // Extras déjà pris ce jour-là sur un autre événement : extra → événements concernés.
  const [busy, setBusy] = useState<Record<string, string[]>>({});
  const [sendFor, setSendFor] = useState<Assignment | null>(null);
  const [sending, setSending] = useState<'one' | 'team' | null>(null);
  const [notice, setNotice] = useState<{ text: string; unreachable: Assignment[] } | null>(null);

  const day = quote.event_date?.slice(0, 10) ?? null;

  const loadAssignments = useCallback(async () => {
    const res = await createClient().from('event_extras').select(SELECT).eq('quote_id', quote.id).order('created_at');
    check(res, 'L’équipe n’a pas pu être chargée. Rechargez la page.');
    if (!res.error) setAssignments((res.data ?? []) as Assignment[]);
    setLoading(false);
  }, [quote.id, check]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  // Les extras répondent depuis leur page : au retour sur l'onglet, l'équipe se met à jour.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadAssignments(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadAssignments]);

  useEffect(() => {
    if (!user) return;
    createClient().from('extras').select(EXTRA_COLS).eq('user_id', user.id).order('name')
      .then(({ data }) => setExtras((data ?? []) as Extra[]));
  }, [user]);

  // Qui travaille déjà ailleurs ce jour-là (hors missions refusées).
  useEffect(() => {
    if (!day) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: others } = await supabase.from('quotes').select('id, client_name, event_type').eq('event_date', day).neq('id', quote.id);
      const list = (others ?? []) as { id: string; client_name: string | null; event_type: string | null }[];
      if (list.length === 0) { if (!cancelled) setBusy({}); return; }
      const { data: taken } = await supabase.from('event_extras').select('extra_id, quote_id').in('quote_id', list.map((q) => q.id)).neq('status', 'refuse');
      const map: Record<string, string[]> = {};
      for (const t of (taken ?? []) as { extra_id: string; quote_id: string }[]) {
        const q = list.find((x) => x.id === t.quote_id);
        (map[t.extra_id] ??= []).push([q?.event_type, q?.client_name].filter(Boolean).join(', ') || 'un autre événement');
      }
      if (!cancelled) setBusy(map);
    })();
    return () => { cancelled = true; };
  }, [day, quote.id]);

  const unavailable = (e: Extra | null) => !!(day && e?.unavailable_dates?.some((d) => d.slice(0, 10) === day));

  const patch = async (id: string, values: Partial<Assignment>, message: string) => {
    const previous = assignments;
    setAssignments((list) => list.map((a) => (a.id === id ? { ...a, ...values } : a)));
    const res = await createClient().from('event_extras').update(values).eq('id', id);
    if (!check(res, message)) setAssignments(previous);
  };

  const remove = async (a: Assignment) => {
    if (!confirm(`Retirer ${a.extra?.name ?? 'cet extra'} de l’événement ?`)) return;
    const previous = assignments;
    setAssignments((list) => list.filter((x) => x.id !== a.id));
    const res = await createClient().from('event_extras').delete().eq('id', a.id);
    if (!check(res, 'L’extra n’a pas pu être retiré. Réessayez.')) setAssignments(previous);
  };

  const saveTeam = async () => {
    if (!team || team.selected.length === 0) return;
    setSaving(true);
    const rows = team.selected.map((extraId) => ({
      quote_id: quote.id, extra_id: extraId, status: 'a_solliciter',
      arrival_time: team.arrival || null, departure_time: team.departure || null, mission_notes: team.notes.trim() || null,
    }));
    const res = await createClient().from('event_extras').insert(rows).select(SELECT);
    setSaving(false);
    if (!check(res, 'L’équipe n’a pas pu être enregistrée. Réessayez.')) return;
    setAssignments((list) => [...list, ...((res.data ?? []) as Assignment[])]);
    setTeam(null);
  };

  const saveEdit = async () => {
    if (!edit) return;
    const before = assignments.find((a) => a.id === edit.id);
    setSaving(true);
    const values = { arrival_time: edit.arrival || null, departure_time: edit.departure || null, mission_notes: edit.notes.trim() || null, assign_courses: edit.courses };
    const res = await createClient().from('event_extras').update(values).eq('id', edit.id).select(SELECT).single();
    setSaving(false);
    if (!check(res, 'La mission n’a pas pu être enregistrée. Réessayez.')) return;
    const saved = res.data as Assignment;
    setAssignments((list) => list.map((a) => (a.id === saved.id ? saved : a)));
    setEdit(null);
    // Mission déjà envoyée dont l'horaire ou les consignes changent : l'extra est prévenu.
    const changed = before && (before.arrival_time !== values.arrival_time || before.departure_time !== values.departure_time || before.mission_notes !== values.mission_notes);
    if (before?.invited_at && changed) {
      notifyMissionChanged(saved.id).catch(() => undefined);
      setNotice({ text: `${before.extra?.name ?? 'L’extra'} est prévenu du changement sur ses appareils.`, unreachable: [] });
    }
  };

  const missionLink = (a: Assignment) => (a.extra?.access_token ? `${window.location.origin}/e/${a.extra.access_token}` : '');

  const messageFor = (a: Assignment) => missionMessage({
    extraName: a.extra?.name ?? '', companyName: profile?.company_name, eventType: quote.event_type, eventDate: quote.event_date,
    location: quote.event_location, arrival: a.arrival_time, departure: a.departure_time, link: missionLink(a),
  });

  const smsHref = (a: Assignment) => {
    const phone = (a.extra?.phone ?? '').replace(/[^\d+]/g, '');
    return phone ? `sms:${phone}?&body=${encodeURIComponent(messageFor(a))}` : null;
  };
  const whatsappHref = (a: Assignment) => {
    const number = whatsappNumber(a.extra?.phone);
    return number ? `https://wa.me/${number}?text=${encodeURIComponent(messageFor(a))}` : null;
  };

  /** Envoi par SMS ou WhatsApp depuis le téléphone du traiteur : la mission est notée comme envoyée. */
  const markSent = async (a: Assignment) => {
    if (a.invited_at) return;
    const invited_at = new Date().toISOString();
    setAssignments((list) => list.map((x) => (x.id === a.id ? { ...x, invited_at } : x)));
    await createClient().from('event_extras').update({ invited_at }).eq('id', a.id);
  };

  const invite = async (list: Assignment[], mode: 'one' | 'team') => {
    if (list.length === 0) return;
    setSending(mode);
    setNotice(null);
    try {
      const res = await inviteToMissions(list.map((a) => a.id));
      if (res.error) { setError(res.error); return; }
      const reached = list.length - res.unreachable.length;
      const parts = [
        res.emailed > 0 ? `${res.emailed} par email` : null,
        res.notified > 0 ? `${res.notified} en notification` : null,
      ].filter(Boolean).join(', ');
      const text = reached > 0
        ? `Mission envoyée à ${plural(reached, 'extra', 'extras')}${parts ? ` : ${parts}` : ''}.`
        : 'La mission n’a pu partir ni par email ni en notification.';
      const unreachable = list.filter((a) => res.unreachable.includes(a.id));
      setNotice({ text, unreachable });
      setSendFor(null);
      await loadAssignments();
    } catch {
      setError('La mission n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.');
    } finally {
      setSending(null);
    }
  };

  const copyLink = async (a: Assignment) => {
    const link = missionLink(a);
    if (!link || !a.extra) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(a.extra.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Le lien n’a pas pu être copié. Copiez-le depuis la page Extras.');
    }
  };

  const print = () => {
    const missions: StaffMission[] = assignments.filter((a) => a.extra && a.status !== 'refuse').map((a) => ({
      extraName: a.extra!.name,
      role: a.extra!.role,
      phone: a.extra!.phone,
      email: a.extra!.email,
      eventType: quote.event_type,
      clientName: quote.client_name,
      eventDate: quote.event_date,
      eventLocation: quote.event_location,
      arrivalTime: a.arrival_time,
      departureTime: a.departure_time,
      missionNotes: a.mission_notes,
    }));
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Fiches mission</title><style>@page{size:A4;margin:0}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{margin:0;font-family:Georgia,serif;background:#fff}#wrapper{padding:20mm}</style></head><body><div id="wrapper">${generateStaffHtml(missions)}</div></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const win = window.open(url, '_blank');
    if (!win) { URL.revokeObjectURL(url); setError('Le navigateur a bloqué l’ouverture du document. Autorisez les fenêtres pour ce site.'); return; }
    win.onload = () => { setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 500); };
  };

  const assigned = new Set(assignments.map((a) => a.extra_id));
  const available = extras.filter((e) => !assigned.has(e.id));
  const active = assignments.filter((a) => a.status !== 'refuse');
  const confirmed = assignments.filter((a) => a.status === 'confirme' || a.status === 'present').length;
  const toSend = assignments.filter((a) => a.status === 'a_solliciter' && !a.invited_at && a.extra);

  // Effectif conseillé comparé à l'équipe (les extras indisponibles et les rôles inconnus ne comptent pas).
  const staffing = useMemo(() => {
    const wanted = suggestedStaff(quote.guest_count, quote.event_type);
    const have = { service: 0, cuisine: 0, plonge: 0 };
    for (const a of active) {
      const f = roleFamily(a.extra?.role);
      if (f && f in have) have[f as keyof typeof have]++;
    }
    return FAMILIES.map((f) => ({ ...f, have: have[f.key], wanted: wanted[f.key] })).filter((f) => f.wanted > 0 || f.have > 0);
  }, [active, quote.guest_count, quote.event_type]);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onClose={() => setError(null)} />

      {staffing.length > 0 && (
        <section aria-label="Effectif conseillé">
          <p className="text-sm text-gray-600 mb-2">Effectif conseillé{quote.guest_count ? ` pour ${quote.guest_count} couverts` : ''}</p>
          <ul className="grid grid-cols-3 gap-2">
            {staffing.map((f) => {
              const ok = f.have >= f.wanted;
              return (
                <li key={f.key} data-family={f.key} className={cn('rounded-2xl px-3 py-2.5 border', ok ? 'bg-sage-100/60 border-sage-100' : 'bg-white border-gray-200')}>
                  <p className="text-sm font-medium text-gray-700">{f.label}</p>
                  <p className="text-gray-900">
                    <span className="text-xl font-bold tabular-nums">{f.have}</span>
                    <span className="text-sm text-gray-600"> sur {f.wanted}</span>
                  </p>
                  <p className={cn('text-xs', ok ? 'text-sage' : 'text-gray-500')}>{ok ? 'Complet' : `Il manque ${f.wanted - f.have}`}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          {assignments.length === 0 ? 'Personne n’est encore affecté.' : `${confirmed} confirmé${confirmed > 1 ? 's' : ''} sur ${assignments.length}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {assignments.length > 0 && <button onClick={print} className={btnSecondary}><Printer className="h-4 w-4" />Fiches mission</button>}
          <button onClick={() => setTeam({ selected: [], arrival: '', departure: '', notes: '' })} disabled={available.length === 0} className={assignments.length === 0 ? btnPrimary : btnSecondary}>
            <Plus className="h-4 w-4" />Affecter des extras
          </button>
        </div>
      </div>

      {toSend.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-sm text-gray-700 min-w-0">
            {toSend.length === 1 ? 'Une mission n’a pas encore été envoyée.' : `${toSend.length} missions n’ont pas encore été envoyées.`}
          </p>
          <button onClick={() => invite(toSend, 'team')} disabled={sending !== null} className={cn(btnPrimary, 'w-full sm:w-auto')}>
            {sending === 'team' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Envoyer à toute l’équipe
          </button>
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-2xl bg-sage-100/60 px-4 py-3 text-sm text-gray-800 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p>{notice.text}</p>
            <button onClick={() => setNotice(null)} className="text-sm font-medium text-gray-600 hover:text-gray-900 min-h-10 -my-2 flex-shrink-0">Fermer</button>
          </div>
          {notice.unreachable.length > 0 && (
            <div>
              <p>Sans email ni appareil enregistré : envoyez-leur la mission par SMS ou WhatsApp.</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {notice.unreachable.map((a) => (
                  <button key={a.id} onClick={() => setSendFor(a)} className={cn(btnSecondary, 'h-10')}><MessageSquare className="h-4 w-4" />{a.extra?.name}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-24 rounded-2xl bg-gray-50 animate-pulse" />)}</div>
      ) : assignments.length === 0 ? (
        <EmptyState
          title="Aucun extra sur cet événement"
          hint={extras.length === 0 ? 'Ajoutez d’abord vos extras dans la page Extras, puis affectez-les ici.' : 'Choisissez vos serveurs, cuisiniers et plongeurs, envoyez-leur la mission, puis suivez qui a répondu.'}
        />
      ) : (
        <ul className="space-y-2.5">
          {assignments.map((a) => {
            const elsewhere = busy[a.extra_id];
            return (
              <li key={a.id} data-assignment={a.extra?.name ?? ''} className="p-3 sm:p-4 rounded-2xl bg-gray-50">
                <div className="flex items-start gap-3">
                  <span className="w-11 h-11 rounded-full bg-white border border-gray-200 text-gray-900 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                    {(a.extra?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 break-words">{a.extra?.name ?? 'Extra supprimé'}</p>
                    <p className="text-sm text-gray-600 break-words">
                      {a.extra?.role || (a.extra?.phone ? '' : 'Rôle non précisé')}{a.extra?.role && a.extra?.phone ? ', ' : ''}
                      {a.extra?.phone && <span className="whitespace-nowrap">{a.extra.phone}</span>}
                    </p>
                  </div>
                  {a.extra?.access_token && (
                    <button onClick={() => copyLink(a)} className={iconBtn} aria-label="Copier le lien de sa fiche mission" title="Copier le lien de sa fiche mission">
                      {copied === a.extra.id ? <span className="text-xs font-semibold text-sage">Copié</span> : <Link2 className="h-4 w-4" />}
                    </button>
                  )}
                  <button onClick={() => setEdit({ id: a.id, arrival: a.arrival_time ?? '', departure: a.departure_time ?? '', notes: a.mission_notes ?? '', courses: a.assign_courses })} className={iconBtn} aria-label="Modifier la mission"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(a)} className={iconBtnDanger} aria-label="Retirer de l’événement"><Trash2 className="h-4 w-4" /></button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2 text-sm">
                  {a.responded_at && (a.status === 'confirme' || a.status === 'refuse') && (
                    <span className="text-gray-600">{a.status === 'confirme' ? 'A accepté' : 'A décliné'} lui-même le {when(a.responded_at)}</span>
                  )}
                  <span className="text-gray-500">{a.invited_at ? `Mission envoyée le ${when(a.invited_at)}` : 'Mission pas encore envoyée'}</span>
                </div>

                {(elsewhere || unavailable(a.extra)) && a.status !== 'refuse' && (
                  <p className="flex items-start gap-1.5 mt-2 text-sm text-primary-800">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {unavailable(a.extra) ? 'A indiqué ne pas être disponible ce jour.' : `Déjà pris ce jour-là : ${elsewhere!.join(' ; ')}.`}
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 mt-3 rounded-xl bg-gray-200/70" role="radiogroup" aria-label={`Statut de ${a.extra?.name ?? 'l’extra'}`}>
                  {MISSION_STATUSES.map((st) => (
                    <button key={st.key} role="radio" aria-checked={a.status === st.key} onClick={() => patch(a.id, { status: st.key }, 'Le statut n’a pas pu être enregistré. Réessayez.')}
                      className={cn('h-10 rounded-lg text-sm font-medium transition-colors', a.status === st.key ? cn('bg-white shadow-sm font-semibold', ACTIVE_TEXT[st.key]) : 'text-gray-600 hover:text-gray-900')}>
                      {st.label}
                    </button>
                  ))}
                </div>

                {(a.arrival_time || a.departure_time || a.mission_notes || a.assign_courses) && (
                  <div className="mt-3 space-y-1 text-sm text-gray-700">
                    {(a.arrival_time || a.departure_time) && (
                      <p className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-gray-500" />
                        {a.arrival_time ? `Arrivée à ${a.arrival_time}` : ''}{a.arrival_time && a.departure_time ? ', ' : ''}{a.departure_time ? `fin vers ${a.departure_time}` : ''}
                      </p>
                    )}
                    {a.assign_courses && <p>Chargé des courses</p>}
                    {a.mission_notes && <p className="whitespace-pre-line text-gray-600">{a.mission_notes}</p>}
                  </div>
                )}

                {a.extra && a.status !== 'refuse' && (
                  <button onClick={() => setSendFor(a)} className={cn(btnSecondary, 'h-10 mt-3 w-full sm:w-auto')}>
                    <Send className="h-4 w-4" />{a.invited_at ? 'Renvoyer la mission' : 'Envoyer la mission'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-gray-500">
        Votre carnet d’extras se gère dans <Link href="/extras" className="font-medium text-primary hover:underline">la page Extras</Link>.
      </p>

      {team && (
        <Modal
          title="Affecter des extras"
          onClose={() => setTeam(null)}
          footer={<>
            <button onClick={() => setTeam(null)} className={btnGhost}>Annuler</button>
            <button onClick={saveTeam} disabled={saving || team.selected.length === 0} className={btnPrimary}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {team.selected.length > 1 ? `Affecter ${team.selected.length} extras` : 'Affecter'}
            </button>
          </>}
        >
          <div className="space-y-4 pb-3">
            <fieldset>
              <legend className={labelCls}>Qui travaille sur cet événement ?</legend>
              <ul className="space-y-1.5">
                {available.map((e) => {
                  const checked = team.selected.includes(e.id);
                  const toggle = (on: boolean) => setTeam({ ...team, selected: on ? [...team.selected, e.id] : team.selected.filter((x) => x !== e.id) });
                  const elsewhere = busy[e.id];
                  const off = unavailable(e);
                  return (
                    <li key={e.id}>
                      <label className={cn('flex items-start gap-3 min-h-12 px-3 py-2.5 rounded-xl cursor-pointer border transition-colors', checked ? 'border-sage bg-sage-100/40' : 'border-gray-200 hover:border-gray-300')}>
                        <span className="pt-0.5"><Check checked={checked} onChange={toggle} label={e.name} /></span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-medium text-gray-900">{e.name}</span>
                          {e.role && <span className="block text-sm text-gray-600">{e.role}</span>}
                          {off && <span className="flex items-start gap-1.5 text-sm text-primary-800 mt-0.5"><AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />A indiqué ne pas être disponible ce jour</span>}
                          {elsewhere && <span className="flex items-start gap-1.5 text-sm text-primary-800 mt-0.5"><AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />Déjà pris ce jour-là : {elsewhere.join(' ; ')}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="team-arrival" className={labelCls}>Heure d’arrivée</label>
                <input id="team-arrival" type="time" value={team.arrival} onChange={(e) => setTeam({ ...team, arrival: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="team-departure" className={labelCls}>Heure de fin</label>
                <input id="team-departure" type="time" value={team.departure} onChange={(e) => setTeam({ ...team, departure: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor="team-notes" className={labelCls}>Consignes pour toute l’équipe</label>
              <textarea id="team-notes" rows={3} value={team.notes} onChange={(e) => setTeam({ ...team, notes: e.target.value })} placeholder="Tenue noire, arrivée par l’entrée de service" className={cn(inputCls, 'h-auto py-3 resize-none')} />
            </div>
            <p className="text-sm text-gray-500">Vous pourrez ensuite ajuster la mission de chacun.</p>
          </div>
        </Modal>
      )}

      {edit && (
        <Modal
          title="Modifier la mission"
          onClose={() => setEdit(null)}
          footer={<>
            <button onClick={() => setEdit(null)} className={btnGhost}>Annuler</button>
            <button onClick={saveEdit} disabled={saving} className={btnPrimary}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
            </button>
          </>}
        >
          <div className="space-y-4 pb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="extra-arrival" className={labelCls}>Heure d’arrivée</label>
                <input id="extra-arrival" type="time" value={edit.arrival} onChange={(e) => setEdit({ ...edit, arrival: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="extra-departure" className={labelCls}>Heure de fin</label>
                <input id="extra-departure" type="time" value={edit.departure} onChange={(e) => setEdit({ ...edit, departure: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor="extra-notes" className={labelCls}>Consignes</label>
              <textarea id="extra-notes" rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="Tenue noire, arrivée par l’entrée de service" className={cn(inputCls, 'h-auto py-3 resize-none')} />
            </div>
            <label className="flex items-center gap-3 cursor-pointer min-h-10">
              <Check checked={edit.courses} onChange={(courses) => setEdit({ ...edit, courses })} label="Chargé des courses" />
              <span className="text-[15px] text-gray-900">Chargé des courses</span>
            </label>
            {assignments.find((a) => a.id === edit.id)?.invited_at && (
              <p className="text-sm text-gray-500">La mission a déjà été envoyée : si l’horaire ou les consignes changent, l’extra est prévenu sur ses appareils.</p>
            )}
          </div>
        </Modal>
      )}

      {sendFor && sendFor.extra && (
        <Modal title={`Envoyer la mission à ${sendFor.extra.name}`} onClose={() => setSendFor(null)}>
          <div className="space-y-2.5 pb-3">
            <SendOption
              icon={<Send className="h-5 w-5" />}
              title="Email et notification"
              hint={sendFor.extra.email ? `À ${sendFor.extra.email}, et sur son téléphone si sa page est installée.` : 'Pas d’email : seulement sur son téléphone, si sa page est installée.'}
              onClick={() => invite([sendFor], 'one')}
              loading={sending === 'one'}
            />
            <SendOption
              icon={<MessageSquare className="h-5 w-5" />}
              title="SMS"
              hint={sendFor.extra.phone ? 'Ouvre vos messages avec le texte prêt à envoyer.' : 'Aucun numéro de téléphone pour cet extra.'}
              href={smsHref(sendFor)}
              onClick={() => markSent(sendFor)}
            />
            <SendOption
              icon={<MessageCircle className="h-5 w-5" />}
              title="WhatsApp"
              hint={sendFor.extra.phone ? 'Ouvre WhatsApp avec le texte prêt à envoyer.' : 'Aucun numéro de téléphone pour cet extra.'}
              href={whatsappHref(sendFor)}
              external
              onClick={() => markSent(sendFor)}
            />
            <p className="text-sm text-gray-500 pt-1">Le message contient le lien de sa page de missions, où il accepte ou décline.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Une façon d'envoyer la mission : grande cible, titre et explication. Lien si `href`, sinon bouton. */
function SendOption({ icon, title, hint, href, external, onClick, loading }: {
  icon: React.ReactNode; title: string; hint: string; href?: string | null; external?: boolean; onClick: () => void; loading?: boolean;
}) {
  const cls = 'flex items-center gap-3 w-full min-h-14 px-4 py-3 rounded-2xl border border-gray-200 bg-white text-left hover:border-gray-300 transition-colors';
  const body = (
    <>
      <span className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center flex-shrink-0">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-gray-900">{title}</span>
        <span className="block text-sm text-gray-600 [overflow-wrap:anywhere]">{hint}</span>
      </span>
    </>
  );
  if (href === undefined) return <button onClick={onClick} disabled={loading} className={cls}>{body}</button>;
  if (href === null) return <div aria-disabled className={cn(cls, 'opacity-50 cursor-not-allowed')}>{body}</div>;
  return <a href={href} onClick={onClick} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{body}</a>;
}
