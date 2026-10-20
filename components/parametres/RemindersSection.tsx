'use client';

// Paramètres : relances automatiques par email des devis sans réponse et des factures échues.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { btnPrimary, errorCls } from '@/components/ui/kit';
import { invoiceReminderEmail, quoteReminderEmail } from '@/lib/mail/templates';
import { getReminderSettings, saveReminderSettings, type ReminderSettings } from '@/server/remindersSettings';

const DELAYS = [3, 5, 7, 10, 14, 21, 30];

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function RemindersSection() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [delay, setDelay] = useState(7);
  const [preview, setPreview] = useState<'devis' | 'facture'>('devis');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getReminderSettings()
      .then((s) => { setSettings(s); setEnabled(s.enabled); setDelay(s.delayDays); })
      .catch(() => setError('Les réglages n’ont pas pu être chargés. Rechargez la page.'));
  }, []);

  // Aperçu avec un client fictif : exactement le gabarit envoyé.
  const email = useMemo(() => {
    const companyName = settings?.companyName ?? 'Votre entreprise';
    return preview === 'devis'
      ? quoteReminderEmail({
          quote: { companyName, clientName: 'Claire Martin', quoteNumber: 'D-2026-042', eventType: 'Mariage', eventDate: inDays(60), guestCount: 120, validUntil: inDays(20) },
          link: '#',
        })
      : invoiceReminderEmail({
          invoice: { companyName, buyerName: 'Claire Martin', number: 'F-2026-017', remaining: 1840, dueDate: inDays(-3), iban: 'FR76 0000 0000 0000 0000 0000 000', bic: null, previous: 0 },
        });
  }, [preview, settings?.companyName]);

  const changed = !!settings && (enabled !== settings.enabled || delay !== settings.delayDays);

  const save = async () => {
    setBusy(true); setError(null); setDone(false);
    try {
      const res = await saveReminderSettings({ enabled, delayDays: delay });
      if (res.error) { setError(res.error); return; }
      setSettings((s) => (s ? { ...s, enabled, delayDays: delay } : s));
      setDone(true);
    } catch {
      setError('Le réglage n’a pas pu être enregistré. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const locked = settings && !settings.canEdit;

  return (
    <section aria-labelledby="reminders-title" className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="p-2 bg-primary-50 rounded-lg"><MailCheck className="h-4 w-4 text-primary" /></div>
        <div>
          <h2 id="reminders-title" className="font-semibold text-gray-900 text-sm">Relances automatiques</h2>
          <p className="text-xs text-gray-400">Un email à votre client quand un devis reste sans réponse ou qu’une facture n’est pas payée à temps</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {!settings && !error ? <Loader2 className="h-5 w-5 text-gray-400 animate-spin" /> : settings && (
          <>
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <span className="text-sm text-gray-700">
                <span className="block font-medium text-gray-900">Relancer mes clients automatiquement</span>
                Les emails partent à votre nom, et les réponses arrivent dans votre boîte. Vous recevez une notification à chaque relance envoyée.
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={enabled}
                disabled={!!locked}
                onChange={(e) => { setEnabled(e.target.checked); setDone(false); }}
                className="sr-only peer"
              />
              <span aria-hidden className="relative shrink-0 mt-0.5 w-11 h-6 rounded-full bg-gray-200 peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary-100 peer-disabled:opacity-50 transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-2">Délai entre l’envoi et la relance</span>
              <select
                value={delay}
                disabled={!!locked}
                onChange={(e) => { setDelay(Number(e.target.value)); setDone(false); }}
                className="w-full sm:w-56 h-11 px-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
              >
                {DELAYS.map((d) => <option key={d} value={d}>{d} jours</option>)}
              </select>
            </label>

            <ul className="text-sm text-gray-600 space-y-1.5 list-disc pl-5">
              <li><strong className="font-medium text-gray-800">Devis envoyés</strong> encore en attente : relance {delay} jours après l’envoi, puis une seconde {delay} jours plus tard si besoin. Rien après la date de validité du devis.</li>
              <li><strong className="font-medium text-gray-800">Factures échues</strong> pas encore réglées : rappel le lendemain de l’échéance, avec le reste à payer et votre IBAN, puis jusqu’à deux autres rappels espacés de {delay} jours.</li>
            </ul>

            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 p-1 bg-gray-50 border-b border-gray-200" role="tablist" aria-label="Aperçu des emails">
                {(['devis', 'facture'] as const).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={preview === k}
                    onClick={() => setPreview(k)}
                    className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${preview === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    {k === 'devis' ? 'Relance d’un devis' : 'Rappel d’une facture'}
                  </button>
                ))}
              </div>
              <p className="px-4 py-2.5 text-sm text-gray-700 border-b border-gray-100"><span className="text-gray-400">Objet : </span>{email.subject}</p>
              <iframe title="Aperçu de l’email" srcDoc={email.html} sandbox="" className="block w-full h-[520px] bg-[#F3EEE6]" />
            </div>

            {locked ? (
              <p className="text-sm text-gray-400">Ce réglage est celui de votre entreprise : seul son titulaire peut le changer.</p>
            ) : (
              <div className="flex items-center justify-end gap-3">
                {done && <p role="status" className="text-sm text-forest">Enregistré.</p>}
                <button onClick={save} disabled={busy || !changed} className={btnPrimary}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
                </button>
              </div>
            )}
          </>
        )}
        {error && <p role="alert" className={errorCls}>{error}</p>}
      </div>
    </section>
  );
}
