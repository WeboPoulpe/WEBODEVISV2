'use client';

// Fiche administrative d'un extra : ce qu'il faut pour son contrat et sa DPAE (état civil, n° de sécurité sociale,
// adresse, IBAN facultatif). Données sensibles : chargées et enregistrées par des actions serveur réservées à
// l'entreprise, jamais par /api/db ; un compte en consultation seule ne les voit pas.

import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { btnPrimary, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { EMPTY_HR_DETAILS, formatNir, isValidIban, isValidNir, normalizeNir, type ExtraHrDetails } from '@/lib/extraContract';
import { getExtraHrDetails, saveExtraHrDetails } from '@/server/extraHr';

type Form = Record<keyof ExtraHrDetails, string>;

const toForm = (d: ExtraHrDetails): Form =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k, k === 'social_security_number' ? formatNir(v as string | null) : (v ?? '')])) as Form;

export default function ExtraHrForm({ extraId, onSaved }: { extraId: string; onSaved?: () => void }) {
  const [form, setForm] = useState<Form | null>(null);
  const [initial, setInitial] = useState<Form | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [locked, setLocked] = useState<string | null>(null);
  const [showNir, setShowNir] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getExtraHrDetails(extraId)
      .then((res) => {
        if (!alive) return;
        if (res.error !== null) { setLocked(res.error); return; }
        const f = toForm(res.details ?? EMPTY_HR_DETAILS);
        setForm(f); setInitial(f); setCanEdit(res.canEdit);
        if (!res.available) setLocked('La fiche administrative sera disponible après la prochaine mise à jour de la base.');
      })
      .catch(() => alive && setError('La fiche n’a pas pu être chargée. Rechargez la page.'));
    return () => { alive = false; };
  }, [extraId]);

  if (locked && !form) return <p className="text-sm text-gray-500">{locked}</p>;
  if (!form) return error ? <p role="alert" className={errorCls}>{error}</p> : <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setForm({ ...form, [k]: e.target.value }); setDone(false); };
  const nirBad = !!normalizeNir(form.social_security_number) && !isValidNir(form.social_security_number);
  const ibanBad = !!form.iban.trim() && !isValidIban(form.iban);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  const disabled = !canEdit || !!locked;

  const save = async () => {
    setBusy(true); setError(null); setDone(false);
    try {
      const res = await saveExtraHrDetails(extraId, { ...form, sex: form.sex === 'F' || form.sex === 'M' ? form.sex : null, birth_date: form.birth_date || null });
      if (res.error) { setError(res.error); return; }
      setInitial(form); setDone(true);
      onSaved?.();
    } catch {
      setError('La fiche n’a pas pu être enregistrée. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof Form, label: string, o: { placeholder?: string; hint?: string; type?: string; autoComplete?: string; className?: string } = {}) => (
    <div className={o.className}>
      <label htmlFor={`hr-${extraId}-${k}`} className={labelCls}>{label}</label>
      <input id={`hr-${extraId}-${k}`} type={o.type ?? 'text'} value={form[k]} onChange={set(k)} disabled={disabled}
        placeholder={o.placeholder} autoComplete={o.autoComplete ?? 'off'} className={inputCls} />
      {o.hint && <p className="text-sm text-gray-500 mt-1.5">{o.hint}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-gray-600">
        <ShieldCheck className="h-4 w-4 text-sage flex-shrink-0 mt-0.5" />
        Pour son contrat et sa déclaration d’embauche. Ces informations restent dans votre entreprise : elles ne figurent dans aucun email.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('birth_name', 'Nom de naissance', { placeholder: 'DUPONT', autoComplete: 'off' })}
        {field('first_names', 'Prénom', { placeholder: 'Jean' })}
        {field('usage_name', 'Nom d’usage (facultatif)', { placeholder: 'Nom d’épouse, par exemple' })}
        <div>
          <p className={labelCls}>Sexe</p>
          <div role="radiogroup" aria-label="Sexe" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-200/70">
            {([['F', 'Femme'], ['M', 'Homme']] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={form.sex === v} disabled={disabled}
                onClick={() => { setForm({ ...form, sex: form.sex === v ? '' : v }); setDone(false); }}
                className={cn('h-10 rounded-lg text-sm font-medium transition-colors', form.sex === v ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-600 hover:text-gray-900')}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {field('birth_date', 'Date de naissance', { type: 'date' })}
        {field('birth_city', 'Commune de naissance', { placeholder: 'Troyes' })}
        {field('birth_department', 'Département de naissance', { placeholder: '10', hint: '99 pour une naissance à l’étranger.' })}
        {field('birth_country', 'Pays de naissance', { placeholder: 'France' })}
        {field('nationality', 'Nationalité', { placeholder: 'Française' })}
        <div>
          <label htmlFor={`hr-${extraId}-nir`} className={labelCls}>N° de sécurité sociale</label>
          <div className="relative">
            <input id={`hr-${extraId}-nir`} type={showNir ? 'text' : 'password'} inputMode="numeric" value={form.social_security_number}
              onChange={set('social_security_number')} onBlur={() => !nirBad && setForm({ ...form, social_security_number: formatNir(form.social_security_number) })}
              disabled={disabled} autoComplete="off" placeholder="1 85 05 78 006 084 36" aria-invalid={nirBad} className={cn(inputCls, 'pr-12')} />
            <button type="button" onClick={() => setShowNir((v) => !v)} aria-label={showNir ? 'Masquer le numéro' : 'Afficher le numéro'}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
              {showNir ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className={cn('text-sm mt-1.5', nirBad ? 'text-danger' : 'text-gray-500')}>{nirBad ? '15 chiffres, clé comprise : vérifiez le numéro.' : 'Sur sa carte Vitale. Facultatif pour la DPAE s’il n’est pas encore connu.'}</p>
        </div>
        {field('address', 'Adresse', { placeholder: '12 rue des Lilas', className: 'sm:col-span-2' })}
        {field('postal_code', 'Code postal', { placeholder: '10000' })}
        {field('city', 'Ville', { placeholder: 'Troyes' })}
        <div className="sm:col-span-2">
          <label htmlFor={`hr-${extraId}-iban`} className={labelCls}>IBAN (facultatif)</label>
          <input id={`hr-${extraId}-iban`} value={form.iban} onChange={set('iban')} disabled={disabled} autoComplete="off"
            placeholder="FR76 …" aria-invalid={ibanBad} className={inputCls} />
          <p className={cn('text-sm mt-1.5', ibanBad ? 'text-danger' : 'text-gray-500')}>{ibanBad ? 'Cet IBAN n’est pas valide.' : 'Pour le virement de son salaire.'}</p>
        </div>
      </div>
      {error && <p role="alert" className={errorCls}>{error}</p>}
      {locked ? <p className="text-sm text-gray-500">{locked}</p> : canEdit && (
        <div className="flex items-center justify-end gap-3">
          {done && <p role="status" className="inline-flex items-center gap-1.5 text-sm text-forest"><Check className="h-4 w-4" />Enregistré</p>}
          <button type="button" onClick={save} disabled={busy || !changed || nirBad || ibanBad} className={btnPrimary}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer la fiche
          </button>
        </div>
      )}
    </div>
  );
}
