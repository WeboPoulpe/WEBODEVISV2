'use client';

// Paramètres : mentions légales imprimées sur les devis et les factures, et format des numéros.

import { useEffect, useState } from 'react';
import { Check, Hash, Loader2, Scale } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cleanPrefix, formatDocumentNumber, KIND_LABELS, numberFormat, type DocumentKind, type NumberFormat, type NumberingSettings } from '@/lib/numbering';
import { getLastDocumentNumbers } from '@/server/numbering';

const inputCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

function Field({ label, value, onChange, placeholder, hint, type = 'text', suffix }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; type?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={suffix ? `${inputCls} pr-16` : inputCls} inputMode={type === 'number' ? 'numeric' : undefined} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon: typeof Scale; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="p-2 bg-primary-50 rounded-lg"><Icon className="h-4 w-4 text-primary" /></div>
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </section>
  );
}

function SaveRow({ state, onSave, error }: { state: 'idle' | 'saving' | 'saved'; onSave: () => void; error: string | null }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-1">
      {error && <p className="text-sm text-red-600 mr-auto">{error}</p>}
      <button onClick={onSave} disabled={state === 'saving'}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-60 transition-colors">
        {state === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : state === 'saved' ? <Check className="h-4 w-4" /> : null}
        {state === 'saving' ? 'Sauvegarde…' : state === 'saved' ? 'Enregistré !' : 'Enregistrer'}
      </button>
    </div>
  );
}

interface Legal {
  legal_form: string; share_capital: string; rcs: string; vat_number: string; vat_exempt: boolean;
  company_iban: string; company_bic: string;
  payment_terms_days: string; deposit_percent: string; quote_validity_days: string;
}

const EMPTY: Legal = {
  legal_form: '', share_capital: '', rcs: '', vat_number: '', vat_exempt: false, company_iban: '', company_bic: '',
  payment_terms_days: '30', deposit_percent: '30', quote_validity_days: '30',
};

const KINDS: DocumentKind[] = ['quote', 'invoice', 'credit'];

/** Entier borné, ou la valeur par défaut si la saisie n'est pas un nombre. */
const intIn = (v: string, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v.replace(',', '.')));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

export default function DocumentSettings() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [legal, setLegal] = useState<Legal>(EMPTY);
  const [formats, setFormats] = useState<Record<DocumentKind, NumberFormat>>(() =>
    Object.fromEntries(KINDS.map((k) => [k, numberFormat(null, k)])) as Record<DocumentKind, NumberFormat>);
  const [last, setLast] = useState<Awaited<ReturnType<typeof getLastDocumentNumbers>> | null>(null);
  const [legalState, setLegalState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [numState, setNumState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [legalError, setLegalError] = useState<string | null>(null);
  const [numError, setNumError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    createClient().from('profiles')
      .select('legal_form, share_capital, rcs, vat_number, vat_exempt, company_iban, company_bic, payment_terms_days, deposit_percent, quote_validity_days, numbering')
      .eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLegal({
            legal_form: data.legal_form ?? '', share_capital: data.share_capital ?? '', rcs: data.rcs ?? '',
            vat_number: data.vat_number ?? '', vat_exempt: !!data.vat_exempt,
            company_iban: data.company_iban ?? '', company_bic: data.company_bic ?? '',
            payment_terms_days: String(data.payment_terms_days ?? 30), deposit_percent: String(data.deposit_percent ?? 30),
            quote_validity_days: String(data.quote_validity_days ?? 30),
          });
          const settings = (data.numbering ?? null) as NumberingSettings | null;
          setFormats(Object.fromEntries(KINDS.map((k) => [k, numberFormat(settings, k)])) as Record<DocumentKind, NumberFormat>);
        }
        setLoaded(true);
      });
    getLastDocumentNumbers().then(setLast).catch(() => setLast(null));
  }, [user]);

  const set = <K extends keyof Legal>(key: K, value: Legal[K]) => setLegal((l) => ({ ...l, [key]: value }));
  const setFormat = (kind: DocumentKind, patch: Partial<NumberFormat>) => setFormats((f) => ({ ...f, [kind]: { ...f[kind], ...patch } }));

  const saveLegal = async () => {
    if (!user) return;
    setLegalState('saving'); setLegalError(null);
    const t = (v: string) => v.trim() || null;
    const { error } = await createClient().from('profiles').update({
      legal_form: t(legal.legal_form), share_capital: t(legal.share_capital), rcs: t(legal.rcs),
      vat_number: legal.vat_exempt ? null : t(legal.vat_number.toUpperCase().replace(/\s+/g, '')),
      vat_exempt: legal.vat_exempt,
      company_iban: t(legal.company_iban.toUpperCase().replace(/\s+/g, ' ')), company_bic: t(legal.company_bic.toUpperCase()),
      payment_terms_days: intIn(legal.payment_terms_days, 0, 120, 30),
      deposit_percent: intIn(legal.deposit_percent, 0, 100, 30),
      quote_validity_days: intIn(legal.quote_validity_days, 1, 365, 30),
    }).eq('id', user.id);
    if (error) { setLegalState('idle'); setLegalError('Les mentions n’ont pas pu être enregistrées. Réessayez.'); return; }
    setLegalState('saved'); setTimeout(() => setLegalState('idle'), 2500);
  };

  const saveNumbering = async () => {
    if (!user) return;
    setNumState('saving'); setNumError(null);
    const numbering = Object.fromEntries(KINDS.map((k) => [k, { ...formats[k], prefix: cleanPrefix(formats[k].prefix) }]));
    const { error } = await createClient().from('profiles').update({ numbering }).eq('id', user.id);
    if (error) { setNumState('idle'); setNumError('La numérotation n’a pas pu être enregistrée. Réessayez.'); return; }
    setNumState('saved'); setTimeout(() => setNumState('idle'), 2500);
  };

  if (!loaded) return null;

  return (
    <>
      <Section icon={Scale} title="Mentions légales de vos documents" subtitle="Imprimées en bas de vos devis et de vos factures">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Forme juridique" value={legal.legal_form} onChange={(v) => set('legal_form', v)} placeholder="SAS, SARL, EI, micro-entreprise…" />
          <Field label="Capital social" value={legal.share_capital} onChange={(v) => set('share_capital', v)} placeholder="10 000 €" hint="Pour une société seulement" />
          <Field label="RCS ou RM" value={legal.rcs} onChange={(v) => set('rcs', v)} placeholder="RCS Troyes 123 456 789" />
          <div>
            <Field label="N° de TVA intracommunautaire" value={legal.vat_exempt ? '' : legal.vat_number} onChange={(v) => set('vat_number', v)} placeholder="FR12345678901" />
            <label className="flex items-start gap-2 mt-2 text-sm text-gray-700">
              <input type="checkbox" checked={legal.vat_exempt} onChange={(e) => set('vat_exempt', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--p-700))]" />
              <span>Franchise en base : « TVA non applicable, art. 293 B du CGI »</span>
            </label>
          </div>
          <Field label="IBAN" value={legal.company_iban} onChange={(v) => set('company_iban', v)} placeholder="FR76 3000 6000 0112 3456 7890 189" />
          <Field label="BIC" value={legal.company_bic} onChange={(v) => set('company_bic', v)} placeholder="AGRIFRPP" />
        </div>
        <div className="grid sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
          <Field label="Paiement des factures" type="number" value={legal.payment_terms_days} onChange={(v) => set('payment_terms_days', v)} suffix="jours" hint="Délai avant l’échéance" />
          <Field label="Acompte proposé" type="number" value={legal.deposit_percent} onChange={(v) => set('deposit_percent', v)} suffix="%" hint="À la signature du devis" />
          <Field label="Validité des devis" type="number" value={legal.quote_validity_days} onChange={(v) => set('quote_validity_days', v)} suffix="jours" hint="Après la date du devis" />
        </div>
        <SaveRow state={legalState} onSave={saveLegal} error={legalError} />
      </Section>

      <Section icon={Hash} title="Numérotation" subtitle="Les numéros se suivent sans trou et ne changent jamais une fois attribués">
        <div className="space-y-3">
          {KINDS.map((kind) => {
            const f = formats[kind];
            const lastN = last ? (f.withYear ? last[kind].year : last[kind].none) : 0;
            return (
              <div key={kind} className="grid grid-cols-[1fr_auto] sm:grid-cols-[7rem_1fr_auto_auto_minmax(9rem,auto)] items-center gap-x-3 gap-y-2 py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm font-semibold text-gray-900 col-span-2 sm:col-span-1">{KIND_LABELS[kind]}</p>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="shrink-0">Préfixe</span>
                  <input value={f.prefix} onChange={(e) => setFormat(kind, { prefix: cleanPrefix(e.target.value) })} className={`${inputCls} py-2 max-w-[8rem]`} aria-label={`Préfixe des ${KIND_LABELS[kind].toLowerCase()}`} />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={f.withYear} onChange={(e) => setFormat(kind, { withYear: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--p-700))]" />
                  Année
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <select value={f.digits} onChange={(e) => setFormat(kind, { digits: Number(e.target.value) })} className={`${inputCls} py-2 w-auto`} aria-label={`Nombre de chiffres des ${KIND_LABELS[kind].toLowerCase()}`}>
                    {[3, 4, 5, 6].map((d) => <option key={d} value={d}>{d} chiffres</option>)}
                  </select>
                </label>
                <p className="text-sm text-gray-500 col-span-2 sm:col-span-1 sm:text-right">
                  Prochain : <span className="font-mono font-semibold text-gray-900">{formatDocumentNumber(f, lastN + 1)}</span>
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400">Avec l’année, le compteur repart à 1 chaque 1er janvier. Changer le format ne modifie pas les numéros déjà donnés.</p>
        <SaveRow state={numState} onSave={saveNumbering} error={numError} />
      </Section>
    </>
  );
}
