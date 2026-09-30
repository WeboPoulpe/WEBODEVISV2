'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Link2, Loader2, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { generateStaffHtml, type StaffMission } from '@/lib/generateStaffHtml';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, iconBtn, iconBtnDanger, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { Check, EmptyState, ErrorBanner, useActionError, type EventQuote } from './shared';

type Status = 'a_solliciter' | 'confirme' | 'present';

interface Extra { id: string; name: string; phone: string | null; email: string | null; role: string | null; access_token: string | null }

interface Assignment {
  id: string;
  extra_id: string;
  status: Status;
  arrival_time: string | null;
  mission_notes: string | null;
  assign_courses: boolean;
  extra: Extra | null;
}

const STATUSES: { key: Status; label: string }[] = [
  { key: 'a_solliciter', label: 'À solliciter' },
  { key: 'confirme', label: 'Confirmé' },
  { key: 'present', label: 'Présent' },
];
const SELECT = '*, extra:extras(id, name, phone, email, role, access_token)';
const emptyForm = { id: null as string | null, extraId: '', arrival: '', notes: '', courses: false };

export default function ExtrasTab({ quote }: { quote: EventQuote }) {
  const { user } = useAuth();
  const { error, setError, check } = useActionError();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    createClient().from('event_extras').select(SELECT).eq('quote_id', quote.id).order('created_at').then((res) => {
      check(res, 'L’équipe n’a pas pu être chargée. Rechargez la page.');
      setAssignments((res.data ?? []) as Assignment[]);
      setLoading(false);
    });
  }, [quote.id, check]);

  useEffect(() => {
    if (!user) return;
    createClient().from('extras').select('id, name, phone, email, role, access_token').eq('user_id', user.id).order('name')
      .then(({ data }) => setExtras((data ?? []) as Extra[]));
  }, [user]);

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

  const save = async () => {
    if (!form || (!form.id && !form.extraId)) return;
    setSaving(true);
    const values = { arrival_time: form.arrival || null, mission_notes: form.notes.trim() || null, assign_courses: form.courses };
    const supabase = createClient();
    const res = form.id
      ? await supabase.from('event_extras').update(values).eq('id', form.id).select(SELECT).single()
      : await supabase.from('event_extras').insert({ ...values, quote_id: quote.id, extra_id: form.extraId, status: 'a_solliciter' }).select(SELECT).single();
    setSaving(false);
    if (!check(res, 'L’affectation n’a pas pu être enregistrée. Réessayez.')) return;
    const saved = res.data as Assignment;
    setAssignments((list) => (form.id ? list.map((a) => (a.id === saved.id ? saved : a)) : [...list, saved]));
    setForm(null);
  };

  const copyLink = async (extra: Extra) => {
    if (!extra.access_token) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/e/${extra.access_token}`);
      setCopied(extra.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Le lien n’a pas pu être copié. Copiez-le depuis la page Extras.');
    }
  };

  const print = () => {
    const missions: StaffMission[] = assignments.filter((a) => a.extra).map((a) => ({
      extraName: a.extra!.name,
      role: a.extra!.role,
      phone: a.extra!.phone,
      email: a.extra!.email,
      eventType: quote.event_type,
      clientName: quote.client_name,
      eventDate: quote.event_date,
      eventLocation: quote.event_location,
      arrivalTime: a.arrival_time,
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
  const confirmed = assignments.filter((a) => a.status !== 'a_solliciter').length;

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onClose={() => setError(null)} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          {assignments.length === 0 ? 'Personne n’est encore affecté.' : `${confirmed} confirmé${confirmed > 1 ? 's' : ''} sur ${assignments.length}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {assignments.length > 0 && <button onClick={print} className={btnSecondary}><Printer className="h-4 w-4" />Fiches mission</button>}
          <button onClick={() => setForm({ ...emptyForm })} disabled={available.length === 0} className={btnPrimary}><Plus className="h-4 w-4" />Affecter un extra</button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-24 rounded-2xl bg-gray-50 animate-pulse" />)}</div>
      ) : assignments.length === 0 ? (
        <EmptyState
          title="Aucun extra sur cet événement"
          hint={extras.length === 0 ? 'Ajoutez d’abord vos extras dans le catalogue, puis affectez-les ici.' : 'Affectez vos serveurs, cuisiniers et chauffeurs, puis suivez qui a confirmé.'}
        />
      ) : (
        <ul className="space-y-2.5">
          {assignments.map((a) => (
            <li key={a.id} className="p-3 sm:p-4 rounded-2xl bg-gray-50">
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-full bg-white border border-gray-200 text-gray-900 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  {(a.extra?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{a.extra?.name ?? 'Extra supprimé'}</p>
                  <p className="text-sm text-gray-600 truncate">{[a.extra?.role, a.extra?.phone].filter(Boolean).join(', ') || 'Rôle non précisé'}</p>
                </div>
                {a.extra?.access_token && (
                  <button onClick={() => copyLink(a.extra!)} className={iconBtn} aria-label="Copier le lien de sa fiche mission" title="Copier le lien de sa fiche mission">
                    {copied === a.extra.id ? <span className="text-xs font-semibold text-sage">Copié</span> : <Link2 className="h-4 w-4" />}
                  </button>
                )}
                <button onClick={() => setForm({ id: a.id, extraId: a.extra_id, arrival: a.arrival_time ?? '', notes: a.mission_notes ?? '', courses: a.assign_courses })} className={iconBtn} aria-label="Modifier la mission"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(a)} className={iconBtnDanger} aria-label="Retirer de l’événement"><Trash2 className="h-4 w-4" /></button>
              </div>

              <div className="flex p-1 mt-3 rounded-xl bg-gray-200/70" role="tablist" aria-label={`Statut de ${a.extra?.name ?? 'l’extra'}`}>
                {STATUSES.map((s) => (
                  <button key={s.key} role="tab" aria-selected={a.status === s.key} onClick={() => patch(a.id, { status: s.key }, 'Le statut n’a pas pu être enregistré. Réessayez.')}
                    className={cn('flex-1 h-9 rounded-lg text-sm font-medium transition-colors', a.status === s.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
                    {s.label}
                  </button>
                ))}
              </div>

              {(a.arrival_time || a.mission_notes || a.assign_courses) && (
                <div className="mt-3 space-y-1 text-sm text-gray-700">
                  {a.arrival_time && <p className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-gray-500" />Arrivée à {a.arrival_time}</p>}
                  {a.assign_courses && <p>Chargé des courses</p>}
                  {a.mission_notes && <p className="whitespace-pre-line text-gray-600">{a.mission_notes}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-gray-500">
        Votre carnet d’extras se gère dans <Link href="/extras" className="font-medium text-primary hover:underline">la page Extras</Link>.
      </p>

      {form && (
        <Modal
          title={form.id ? 'Modifier la mission' : 'Affecter un extra'}
          onClose={() => setForm(null)}
          footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>Annuler</button>
            <button onClick={save} disabled={saving || (!form.id && !form.extraId)} className={btnPrimary}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
            </button>
          </>}
        >
          <div className="space-y-4">
            {!form.id && (
              <div>
                <label htmlFor="extra-who" className={labelCls}>Extra</label>
                <select id="extra-who" value={form.extraId} onChange={(e) => setForm({ ...form, extraId: e.target.value })} className={inputCls}>
                  <option value="">Choisir</option>
                  {available.map((e) => <option key={e.id} value={e.id}>{e.name}{e.role ? ` (${e.role})` : ''}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="extra-arrival" className={labelCls}>Heure d’arrivée</label>
              <input id="extra-arrival" type="time" value={form.arrival} onChange={(e) => setForm({ ...form, arrival: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="extra-notes" className={labelCls}>Consignes</label>
              <textarea id="extra-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Tenue noire, arrivée par l’entrée de service" className={cn(inputCls, 'h-auto py-3 resize-none')} />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <Check checked={form.courses} onChange={(courses) => setForm({ ...form, courses })} label="Chargé des courses" />
              <span className="text-[15px] text-gray-900">Chargé des courses</span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
