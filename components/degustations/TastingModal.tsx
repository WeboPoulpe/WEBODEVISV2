'use client';

// Fenêtre d'un rendez-vous de dégustation : création (depuis l'agenda ou la fiche d'un devis) et modification.
// Le client peut être prévenu par email : confirmation, rappels automatiques, changement d'horaire, annulation.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useFeedback } from '@/components/ui/Feedback';
import { btnGhost, btnPrimary, btnSecondary, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { durationLabel, TASTING_DURATIONS, type Tasting } from '@/lib/tastings';
import { saveTasting, setTastingStatus } from '@/server/tastings';

export interface TastingDraft {
  quote_id?: string | null;
  client_name?: string;
  client_email?: string | null;
  client_phone?: string | null;
  tasting_date?: string;
  start_time?: string;
  guest_count?: number | null;
}

export default function TastingModal({ tasting, draft, canEdit = true, onClose, onSaved }: {
  /** Rendez-vous existant à modifier. */
  tasting?: Tasting | null;
  /** Valeurs de départ d'un nouveau rendez-vous. */
  draft?: TastingDraft;
  canEdit?: boolean;
  onClose: () => void;
  onSaved: (t: Tasting) => void;
}) {
  const { notify, confirm } = useFeedback();
  const editing = !!tasting;
  const [form, setForm] = useState({
    client_name: tasting?.client_name ?? draft?.client_name ?? '',
    client_email: tasting?.client_email ?? draft?.client_email ?? '',
    client_phone: tasting?.client_phone ?? draft?.client_phone ?? '',
    tasting_date: tasting?.tasting_date ?? draft?.tasting_date ?? '',
    start_time: tasting?.start_time ?? draft?.start_time ?? '14:00',
    duration_minutes: tasting?.duration_minutes ?? 60,
    location: tasting?.location ?? '',
    guest_count: tasting?.guest_count ?? draft?.guest_count ?? null as number | null,
    notes: tasting?.notes ?? '',
    notify_client: tasting?.notify_client ?? true,
  });
  // Création : confirmation envoyée tout de suite (cochée par défaut). Modification : email si l'horaire ou le lieu change.
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const locked = !canEdit || tasting?.status === 'annule';
  const hasEmail = !!form.client_email.trim();

  const done = (t: Tasting | undefined, mailed: boolean | undefined, message: string) => {
    if (!t) return;
    notify(mailed === false ? `${message} L’email au client n’a pas pu partir.` : mailed ? `${message} Le client a été prévenu par email.` : message,
      { tone: mailed === false ? 'error' : 'success' });
    onSaved(t);
    onClose();
  };

  const submit = async () => {
    setSaving(true); setError(null);
    const res = await saveTasting({
      ...form, id: tasting?.id ?? null, quote_id: tasting?.quote_id ?? draft?.quote_id ?? null, send_email: sendEmail,
    }).catch(() => ({ error: 'Le rendez-vous n’a pas pu être enregistré. Réessayez.' } as const));
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    done('tasting' in res ? res.tasting : undefined, 'mailed' in res ? res.mailed : undefined, editing ? 'Rendez-vous modifié.' : 'Dégustation planifiée.');
  };

  const changeStatus = async (status: 'fait' | 'annule' | 'prevu') => {
    if (!tasting) return;
    if (status === 'annule') {
      const warn = tasting.notify_client && tasting.client_email ? 'Le client sera prévenu par email.' : undefined;
      if (!(await confirm({ title: 'Annuler ce rendez-vous ?', message: warn, confirmLabel: 'Annuler le rendez-vous', danger: true }))) return;
    }
    setSaving(true); setError(null);
    const res = await setTastingStatus({ id: tasting.id, status }).catch(() => ({ error: 'Le rendez-vous n’a pas pu être modifié. Réessayez.' } as const));
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    done('tasting' in res ? res.tasting : undefined, 'mailed' in res ? res.mailed : undefined,
      status === 'annule' ? 'Rendez-vous annulé.' : status === 'fait' ? 'Dégustation marquée comme faite.' : 'Rendez-vous de nouveau prévu.');
  };

  const footer = locked ? (
    <button onClick={onClose} className={btnSecondary}>Fermer</button>
  ) : (
    <>
      <button onClick={onClose} className={btnGhost}>Fermer</button>
      <button onClick={submit} disabled={saving || !form.client_name.trim() || !form.tasting_date} className={btnPrimary}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Enregistrer' : 'Planifier'}
      </button>
    </>
  );

  return (
    <Modal title={editing ? 'Rendez-vous de dégustation' : 'Planifier une dégustation'} onClose={onClose} footer={footer}>
      <fieldset disabled={locked || saving} className="space-y-4 pb-2">
        {tasting?.status === 'annule' && <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">Ce rendez-vous est annulé.</p>}
        {!canEdit && <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">Votre accès est en consultation seule.</p>}
        <div>
          <label htmlFor="tasting-client" className={labelCls}>Client</label>
          <input id="tasting-client" value={form.client_name} onChange={(e) => set('client_name', e.target.value)} className={inputCls} placeholder="Nom du client" autoComplete="off" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="tasting-email" className={labelCls}>Email</label>
            <input id="tasting-email" type="email" inputMode="email" value={form.client_email} onChange={(e) => set('client_email', e.target.value)} className={inputCls} placeholder="client@exemple.fr" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="tasting-phone" className={labelCls}>Téléphone</label>
            <input id="tasting-phone" type="tel" inputMode="tel" value={form.client_phone} onChange={(e) => set('client_phone', e.target.value)} className={inputCls} autoComplete="off" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tasting-date" className={labelCls}>Date</label>
            <input id="tasting-date" type="date" value={form.tasting_date} onChange={(e) => set('tasting_date', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="tasting-time" className={labelCls}>Heure</label>
            <input id="tasting-time" type="time" step={300} value={form.start_time} onChange={(e) => set('start_time', e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tasting-duration" className={labelCls}>Durée</label>
            <select id="tasting-duration" value={form.duration_minutes} onChange={(e) => set('duration_minutes', Number(e.target.value))} className={inputCls}>
              {Array.from(new Set([...TASTING_DURATIONS, form.duration_minutes])).sort((a, b) => a - b).map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="tasting-guests" className={labelCls}>Personnes</label>
            <input id="tasting-guests" type="number" inputMode="numeric" min={1} max={1000} value={form.guest_count ?? ''}
              onChange={(e) => set('guest_count', e.target.value === '' ? null : Number(e.target.value))} className={inputCls} placeholder="2" />
          </div>
        </div>
        <div>
          <label htmlFor="tasting-location" className={labelCls}>Lieu</label>
          <input id="tasting-location" value={form.location} onChange={(e) => set('location', e.target.value)} className={inputCls} placeholder="Au laboratoire, 12 rue…" />
        </div>
        <div>
          <label htmlFor="tasting-notes" className={labelCls}>Notes (non envoyées au client)</label>
          <textarea id="tasting-notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-base text-gray-900 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100 resize-none" placeholder="Plats à faire goûter, allergies…" />
        </div>

        <div className="rounded-2xl bg-gray-50 p-3 space-y-1">
          <label className="flex items-start gap-3 min-h-[40px] py-1 cursor-pointer">
            <input type="checkbox" checked={form.notify_client} onChange={(e) => set('notify_client', e.target.checked)} className="mt-0.5 h-5 w-5 accent-primary flex-shrink-0" />
            <span className="text-sm text-gray-700">
              <span className="block font-medium text-gray-900">Prévenir le client par email</span>
              Rappel automatique trois jours avant et la veille{editing ? ', email en cas d’annulation' : ''}.
            </span>
          </label>
          {form.notify_client && (
            <label className="flex items-start gap-3 min-h-[40px] py-1 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="mt-0.5 h-5 w-5 accent-primary flex-shrink-0" />
              <span className="text-sm text-gray-700">
                {editing ? 'Envoyer un email au client si la date, l’heure ou le lieu change' : 'Envoyer la confirmation maintenant, avec le rendez-vous à ajouter à son agenda'}
              </span>
            </label>
          )}
          {form.notify_client && !hasEmail && <p className="text-xs text-gray-500 pl-8">Ajoutez l’email du client pour qu’il reçoive ces messages.</p>}
        </div>

        {error && <p role="alert" className={errorCls}>{error}</p>}
      </fieldset>

      {editing && canEdit && (
        <div className="flex flex-wrap gap-2 pt-2 pb-3 border-t border-gray-100 mt-2">
          {tasting.status === 'prevu' && (
            <>
              <button onClick={() => changeStatus('fait')} disabled={saving} className={btnSecondary}>Marquer comme faite</button>
              <button onClick={() => changeStatus('annule')} disabled={saving} className={`${btnGhost} text-danger hover:text-danger`}>Annuler le rendez-vous</button>
            </>
          )}
          {tasting.status === 'fait' && <button onClick={() => changeStatus('prevu')} disabled={saving} className={btnSecondary}>Remettre à « prévue »</button>}
        </div>
      )}
    </Modal>
  );
}
