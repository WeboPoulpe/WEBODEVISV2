'use client';

// Paramètres : abonnement agenda. Une adresse secrète à coller dans Google Agenda, Apple Calendrier ou Outlook,
// qui affiche les événements confirmés et les devis envoyés en attente (« option »).

import { useEffect, useState } from 'react';
import { CalendarDays, Check, Copy, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, errorCls } from '@/components/ui/kit';
import { getCalendarFeedUrl, renewCalendarFeedUrl } from '@/server/remindersSettings';

const APPS: { name: string; steps: string }[] = [
  { name: 'Google Agenda', steps: 'Sur ordinateur, ouvrez Google Agenda. À gauche, à côté de « Autres agendas », touchez +, puis « À partir de l’URL ». Collez l’adresse et validez. L’agenda apparaît aussi sur le téléphone.' },
  { name: 'Apple Calendrier (iPhone, Mac)', steps: 'Sur iPhone : Réglages, Calendrier, Comptes, Ajouter un compte, Autre, « Ajouter un calendrier avec abonnement ». Sur Mac : Calendrier, menu Fichier, « Nouvel abonnement à un calendrier ». Collez l’adresse.' },
  { name: 'Outlook', steps: 'Dans Outlook sur le web, ouvrez le Calendrier, « Ajouter un calendrier », puis « S’abonner à partir du web ». Collez l’adresse et donnez-lui un nom.' },
];

export default function CalendarFeedSection({ locked }: { locked: string | null }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCalendarFeedUrl().then((r) => setUrl(r.url)).catch(() => { setUrl(null); setError('L’adresse n’a pas pu être chargée. Rechargez la page.'); });
  }, []);

  const renew = async () => {
    setBusy(true); setError(null); setCopied(false);
    try {
      const res = await renewCalendarFeedUrl();
      if (res.error) { setError(res.error); return; }
      setUrl(res.url ?? null);
      setConfirming(false);
    } catch {
      setError('L’adresse n’a pas pu être créée. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('La copie n’a pas marché : sélectionnez l’adresse et copiez-la à la main.');
    }
  };

  return (
    <section aria-labelledby="agenda-title" className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="p-2 bg-primary-50 rounded-lg"><CalendarDays className="h-4 w-4 text-primary" /></div>
        <div>
          <h2 id="agenda-title" className="font-semibold text-gray-900 text-sm">Abonnement agenda</h2>
          <p className="text-xs text-gray-400">Vos événements dans Google Agenda, Apple Calendrier ou Outlook, mis à jour tout seuls</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {url === undefined ? <Loader2 className="h-5 w-5 text-gray-400 animate-spin" /> : !url ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <p className="text-sm text-gray-600 max-w-[52ch]">
              Vos événements confirmés s’affichent dans votre agenda habituel, avec le lieu, l’heure d’arrivée et le nombre de couverts. Les devis envoyés en attente apparaissent en « option ».
            </p>
            {locked
              ? <p className="text-sm text-gray-400">{locked}</p>
              : <button onClick={renew} disabled={busy} className={`${btnPrimary} shrink-0`}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}Créer mon adresse d’agenda
                </button>}
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="agenda-url" className="block text-sm font-medium text-gray-700 mb-2">Votre adresse d’agenda</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="agenda-url"
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-mono"
                />
                <button onClick={copy} className={`${btnSecondary} shrink-0`}>
                  {copied ? <Check className="h-4 w-4 text-forest" /> : <Copy className="h-4 w-4" />}{copied ? 'Copiée' : 'Copier'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Gardez cette adresse pour vous : toute personne qui la connaît voit vos événements.</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">L’ajouter à votre agenda</p>
              {APPS.map((a) => (
                <details key={a.name} className="group rounded-xl border border-gray-200 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-gray-800 list-none flex items-center justify-between">
                    {a.name}<span aria-hidden className="text-gray-400 group-open:rotate-90 transition-transform">›</span>
                  </summary>
                  <p className="text-sm text-gray-600 mt-2">{a.steps}</p>
                </details>
              ))}
              <p className="text-xs text-gray-400">Les agendas relisent l’adresse d’eux-mêmes, en général toutes les quelques heures (jusqu’à un jour pour Google Agenda).</p>
            </div>

            {!locked && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between pt-5 border-t border-gray-100">
                <p className="text-sm text-gray-600 max-w-[52ch]">Adresse transmise par erreur ? Changez-la : l’ancienne cesse aussitôt de marcher.</p>
                <button onClick={() => setConfirming(true)} className={`${btnGhost} border border-gray-200 shrink-0`}>Changer d’adresse</button>
              </div>
            )}
          </>
        )}
        {error && <p role="alert" className={errorCls}>{error}</p>}
      </div>

      {confirming && (
        <Modal
          title="Changer d’adresse"
          onClose={() => setConfirming(false)}
          footer={<>
            <button onClick={() => setConfirming(false)} className={btnGhost}>Annuler</button>
            <button onClick={renew} disabled={busy} className={btnPrimary}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Changer d’adresse
            </button>
          </>}
        >
          <p className="text-sm text-gray-700">
            Les agendas abonnés à l’adresse actuelle ne recevront plus vos événements. Il faudra ajouter la nouvelle adresse dans votre agenda.
          </p>
        </Modal>
      )}
    </section>
  );
}
