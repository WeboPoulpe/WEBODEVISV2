'use client';

// Paramètres : réglages d'employeur repris sur les contrats d'extra et la fiche DPAE (code APE, URSSAF,
// convention collective, caisses, santé au travail, signataire, clauses propres au traiteur).

import { useEffect, useState } from 'react';
import { Briefcase, Info, Loader2 } from 'lucide-react';
import { btnPrimary, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { CONTRACT_DISCLAIMER, DEFAULT_CONVENTION, EMPTY_EMPLOYER_SETTINGS, type EmployerSettings } from '@/lib/extraContract';
import { getEmployerSettings, saveEmployerSettings, type EmployerSettingsState } from '@/server/extraHr';

type Form = Record<keyof EmployerSettings, string>;
const toForm = (s: EmployerSettings): Form =>
  Object.fromEntries(Object.keys(EMPTY_EMPLOYER_SETTINGS).map((k) => [k, s[k as keyof EmployerSettings] ?? ''])) as Form;

export default function EmployerSection() {
  const [state, setState] = useState<EmployerSettingsState | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEmployerSettings()
      .then((s) => {
        setState(s);
        const f = toForm(s.settings);
        if (!f.convention) f.convention = DEFAULT_CONVENTION;
        setForm(f); setSaved(toForm(s.settings));
      })
      .catch(() => setError('Les réglages n’ont pas pu être chargés. Rechargez la page.'));
  }, []);

  const save = async () => {
    if (!form) return;
    setBusy(true); setError(null); setDone(false);
    try {
      const res = await saveEmployerSettings(form);
      if (res.error) { setError(res.error); return; }
      setSaved(form); setDone(true);
    } catch {
      setError('Les réglages n’ont pas pu être enregistrés. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const locked = !!state && !state.canEdit;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm((f) => (f ? { ...f, [k]: e.target.value } : f)); setDone(false); };
  const input = (k: keyof Form, label: string, placeholder: string, hint?: string) => form && (
    <div>
      <label htmlFor={`emp-${k}`} className={labelCls}>{label}</label>
      <input id={`emp-${k}`} value={form[k]} onChange={set(k)} disabled={locked} placeholder={placeholder} className={inputCls} />
      {hint && <p className="text-sm text-gray-500 mt-1.5">{hint}</p>}
    </div>
  );
  const area = (k: keyof Form, label: string, placeholder: string, hint?: string) => form && (
    <div className="sm:col-span-2">
      <label htmlFor={`emp-${k}`} className={labelCls}>{label}</label>
      <textarea id={`emp-${k}`} value={form[k]} onChange={set(k)} disabled={locked} placeholder={placeholder} rows={3}
        className={cn(inputCls, 'h-auto py-3 resize-y')} />
      {hint && <p className="text-sm text-gray-500 mt-1.5">{hint}</p>}
    </div>
  );
  const id = state?.identity;
  const changed = !!form && !!saved && JSON.stringify({ ...form, convention: form.convention === DEFAULT_CONVENTION && !saved.convention ? '' : form.convention }) !== JSON.stringify(saved);

  return (
    <section aria-labelledby="employer-title" className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="p-2 bg-primary-50 rounded-lg"><Briefcase className="h-4 w-4 text-primary" /></div>
        <div>
          <h2 id="employer-title" className="font-semibold text-gray-900 text-sm">Employeur : contrats d’extra et DPAE</h2>
          <p className="text-xs text-gray-400">Repris sur le contrat de chaque extra et sur sa fiche de déclaration d’embauche</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {!form && !error ? <Loader2 className="h-5 w-5 text-gray-400 animate-spin" /> : form && (
          <>
            {!state?.available && (
              <p className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900">Ces réglages seront disponibles après la prochaine mise à jour de la base.</p>
            )}
            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <p className="font-medium text-gray-900">{id?.company_name || 'Raison sociale à renseigner'}{id?.legal_form ? `, ${id.legal_form}` : ''}</p>
              <p>{id?.siret ? `SIRET ${id.siret}` : 'SIRET à renseigner'}{id?.address ? `, ${id.address}` : ', adresse à renseigner'}</p>
              <p className="text-gray-500 mt-1">Raison sociale, SIRET et adresse viennent de votre identité, plus haut sur cette page.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {input('naf_code', 'Code APE/NAF', '5621Z', 'Sur votre avis de situation INSEE.')}
              {input('urssaf', 'URSSAF de rattachement', 'URSSAF Champagne-Ardenne')}
              <div className="sm:col-span-2">
                {input('convention', 'Convention collective', DEFAULT_CONVENTION, 'Celle indiquée sur vos bulletins de paie. Les traiteurs ne relèvent pas tous des HCR.')}
              </div>
              {input('retirement_fund', 'Caisse de retraite complémentaire', 'Nom et adresse de la caisse', 'Mention obligatoire du contrat.')}
              {input('provident_fund', 'Organisme de prévoyance', 'Nom et adresse, le cas échéant')}
              {input('health_service', 'Service de santé au travail', 'Nom du service de prévention et de santé au travail')}
              {input('signature_city', 'Ville de signature', 'Troyes', '« Fait à … » en bas du contrat.')}
              {input('signatory_name', 'Signataire pour l’employeur', 'Prénom Nom')}
              {input('signatory_title', 'Qualité du signataire', 'Gérant')}
              {area('meal_terms', 'Repas', 'Par exemple : le repas est pris sur place et fourni par l’employeur (avantage en nature).', 'Laissez vide si rien n’est prévu. Indiquez ce que prévoit votre convention.')}
              {area('trial_terms', 'Période d’essai', 'Vide : « Le présent contrat ne comporte pas de période d’essai. »')}
              {area('extra_clauses', 'Clauses particulières', 'Tenue, matériel, confidentialité… (une ligne vide sépare deux paragraphes)')}
            </div>

            <p className="flex items-start gap-2 text-sm text-gray-500">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />{CONTRACT_DISCLAIMER}
            </p>

            {locked ? (
              <p className="text-sm text-gray-400">Ces réglages sont ceux de votre entreprise : seul son titulaire peut les changer.</p>
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
