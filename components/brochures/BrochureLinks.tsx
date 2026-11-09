'use client';

// Les liens d'une brochure : le lien principal et des liens par source (Instagram, salon, site…) ou par client
// (brochure personnalisée). Pour chacun : ses chiffres (ouvertures, demandes), copier, expiration, code d'accès,
// activer / désactiver. Et les notifications au traiteur (ouverture, arrivée au formulaire).

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Bell, Copy, Loader2, Lock, Plus, QrCode, Trash2, User, Globe } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, iconBtn, iconBtnDanger, inputCls } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import {
  createBrochureLink, deleteBrochureLink, listBrochureLinks, setBrochureAccess, updateBrochureLink, type LinkSummary,
} from '@/server/brochureLinks';

const SOURCES = ['Instagram', 'Facebook', 'Site web', 'Salon du mariage', 'Flyer', 'Google'];
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : null);
const isoDay = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export default function BrochureLinks({ brochureId, notify: initialNotify, onClose, onQr }: {
  brochureId: string;
  notify: boolean;
  onClose: () => void;
  /** Montrer le QR code d'un lien (adresse complète). */
  onQr?: (url: string, label: string) => void;
}) {
  const { notify, confirm } = useFeedback();
  const [links, setLinks] = useState<LinkSummary[] | null>(null);
  const [notifyOn, setNotifyOn] = useState(initialNotify);
  const [adding, setAdding] = useState<'source' | 'client' | null>(null);
  const [form, setForm] = useState({ label: '', greeting: '', expiresAt: '', code: '' });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ expiresAt: '', code: '', greeting: '' });

  const load = useCallback(() => { listBrochureLinks(brochureId).then((l) => setLinks(l ?? [])).catch(() => setLinks([])); }, [brochureId]);
  useEffect(load, [load]);

  const url = (token: string) => `${window.location.origin}/b/${token}`;
  const copy = async (token: string) => {
    try { await navigator.clipboard.writeText(url(token)); notify('Lien copié.', { tone: 'success' }); } catch { notify(url(token)); }
  };
  const done = (res: { error: string | null }, ok?: string) => {
    if (res.error) { notify(res.error, { tone: 'error' }); return false; }
    if (ok) notify(ok, { tone: 'success' });
    load();
    return true;
  };

  const create = async () => {
    if (!adding) return;
    setBusy(true);
    const res = await createBrochureLink(brochureId, { kind: adding, label: form.label, greeting: form.greeting || null, expiresAt: form.expiresAt || null, code: form.code || null })
      .catch(() => ({ error: 'Le lien n’a pas pu être créé.' }));
    setBusy(false);
    if (done(res, 'Lien créé.') && 'token' in res && res.token) { await copy(res.token); setAdding(null); setForm({ label: '', greeting: '', expiresAt: '', code: '' }); }
  };
  const saveEdit = async (l: LinkSummary) => {
    setBusy(true);
    const patch = { expiresAt: edit.expiresAt || null, ...(edit.code ? { code: edit.code } : {}) };
    const res = l.id
      ? await updateBrochureLink(l.id, { ...patch, ...(l.kind === 'client' ? { greeting: edit.greeting } : {}) }).catch(() => ({ error: 'Non enregistré.' }))
      : await setBrochureAccess(brochureId, patch).catch(() => ({ error: 'Non enregistré.' }));
    setBusy(false);
    if (done(res, 'Lien mis à jour.')) setEditing(null);
  };
  const removeCode = async (l: LinkSummary) => {
    const res = l.id ? await updateBrochureLink(l.id, { code: null }) : await setBrochureAccess(brochureId, { code: null });
    done(res, 'Code retiré.');
  };

  const field = (label: string, input: ReactNode) => <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>{input}</label>;

  return (
    <Modal title="Liens de la brochure" onClose={onClose} wide
      footer={<button type="button" onClick={onClose} className={btnSecondary}>Fermer</button>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-gray-50 p-3">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={notifyOn}
              onChange={async (e) => { setNotifyOn(e.target.checked); done(await setBrochureAccess(brochureId, { notify: e.target.checked })); }} />
            <span><Bell className="mr-1 inline h-4 w-4 text-gray-400" />Me prévenir quand quelqu’un ouvre la brochure ou arrive au formulaire
              <span className="block text-xs text-gray-500">Une notification au plus par demi-heure et par lien. Activez-les sur cet appareil dans <Link href="/parametres" className="text-primary underline">Paramètres</Link>.</span></span>
          </label>
        </div>

        {links === null ? (
          <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {links.map((l) => {
              const expired = l.expiresAt && new Date(l.expiresAt) <= new Date();
              const key = l.id ?? 'main';
              return (
                <li key={key} className={cn('p-3', !l.isActive && 'opacity-60')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                      {l.kind === 'client' ? <User className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">{l.kind === 'client' ? `Client : ${l.label}` : l.label}</span>
                      <span className="block text-xs text-gray-500">
                        {l.views} ouverture{l.views > 1 ? 's' : ''}{l.viewedAt ? `, la dernière le ${day(l.viewedAt)}` : ''} · {l.requests} demande{l.requests > 1 ? 's' : ''}
                        {l.expiresAt && <span className={expired ? ' text-red-700' : ''}> · {expired ? 'expiré le' : 'expire le'} {day(l.expiresAt)}</span>}
                        {l.hasCode && <span> · <Lock className="inline h-3 w-3" /> code</span>}
                        {l.greeting && <span> · « {l.greeting} »</span>}
                      </span>
                    </span>
                    <button type="button" className={iconBtn} title="Copier le lien" aria-label={`Copier le lien ${l.label}`} onClick={() => copy(l.token)}><Copy className="h-4 w-4" /></button>
                    {onQr && <button type="button" className={iconBtn} title="QR code" aria-label={`QR code du lien ${l.label}`} onClick={() => onQr(url(l.token), l.label)}><QrCode className="h-4 w-4" /></button>}
                    <button type="button" className="text-xs font-medium text-primary" onClick={() => { setEditing(editing === key ? null : key); setEdit({ expiresAt: isoDay(l.expiresAt), code: '', greeting: l.greeting ?? '' }); }}>Régler</button>
                    {l.id && (
                      <>
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={l.isActive} onChange={async (e) => done(await updateBrochureLink(l.id!, { isActive: e.target.checked }))} /> Actif
                        </label>
                        <button type="button" className={iconBtnDanger} aria-label={`Supprimer le lien ${l.label}`}
                          onClick={async () => { if (await confirm({ title: `Supprimer le lien « ${l.label} » ?`, message: 'Il cessera de marcher pour ceux qui l’ont reçu.', danger: true })) done(await deleteBrochureLink(l.id!), 'Lien supprimé.'); }}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                  {editing === key && (
                    <div className="mt-3 grid gap-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-3">
                      {field('Expire le (vide : jamais)', <input type="date" value={edit.expiresAt} onChange={(e) => setEdit({ ...edit, expiresAt: e.target.value })} className={inputCls} />)}
                      {field(l.hasCode ? 'Nouveau code (vide : inchangé)' : 'Code d’accès (vide : aucun)', <input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} maxLength={40} placeholder="4 caractères ou plus" className={inputCls} />)}
                      {l.kind === 'client' && field('Message d’accueil', <input value={edit.greeting} onChange={(e) => setEdit({ ...edit, greeting: e.target.value })} maxLength={140} className={inputCls} />)}
                      <div className="flex flex-wrap items-end gap-2 sm:col-span-3">
                        <button type="button" disabled={busy} onClick={() => saveEdit(l)} className={btnPrimary}>Enregistrer</button>
                        {l.hasCode && <button type="button" onClick={() => removeCode(l)} className={btnSecondary}>Retirer le code</button>}
                        <span className="text-xs text-gray-500">Le code n’est jamais affiché : transmettez-le avec le lien.</span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {adding ? (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-primary-50/40 p-3">
            <p className="text-sm font-semibold text-gray-900">{adding === 'client' ? 'Lien personnalisé pour un client' : 'Lien pour une source'}</p>
            {adding === 'source' && (
              <div className="flex flex-wrap gap-1">
                {SOURCES.map((s) => <button key={s} type="button" onClick={() => setForm({ ...form, label: s })} className={cn('rounded-full border px-2.5 py-1 text-xs', form.label === s ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-700')}>{s}</button>)}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {field(adding === 'client' ? 'Nom du client' : 'Nom du lien', <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value, ...(adding === 'client' && !form.greeting ? {} : {}) })} maxLength={80} placeholder={adding === 'client' ? 'Julie & Thomas' : 'Instagram'} className={inputCls} />)}
              {adding === 'client' && field('Message d’accueil', <input value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} maxLength={140} placeholder="Pour le mariage de Julie & Thomas" className={inputCls} />)}
              {field('Expire le (facultatif)', <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={inputCls} />)}
              {field('Code d’accès (facultatif)', <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={40} className={inputCls} />)}
            </div>
            {adding === 'client' && <p className="text-xs text-gray-500">Écrivez {'{{client}}'} dans un texte du Studio : il devient le nom du client sur ce lien.</p>}
            <div className="flex gap-2">
              <button type="button" disabled={busy || !form.label.trim()} onClick={create} className={btnPrimary}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer et copier le lien</button>
              <button type="button" onClick={() => setAdding(null)} className={btnSecondary}>Annuler</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAdding('source')} className={btnSecondary}><Globe className="h-4 w-4" /> Lien pour une source</button>
            <button type="button" onClick={() => setAdding('client')} className={btnSecondary}><User className="h-4 w-4" /> Lien personnalisé pour un client</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
