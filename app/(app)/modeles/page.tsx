'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { generateQuoteHtml, type QuoteHtmlOptions } from '@/lib/generateQuoteHtml';
import { QUOTE_FONTS } from '@/lib/quoteOutput';
import TemplateThumb from '@/components/devis/TemplateThumb';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, cardCls, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

// Styles de devis : la présentation des documents envoyés aux clients. Le traiteur choisit le style et la police
// proposés à chaque nouveau devis ; chaque devis peut ensuite en changer (éditeur, panneau Style).

type StyleKey = NonNullable<QuoteHtmlOptions['template']>;

const STYLES: { key: StyleKey; label: string; desc: string }[] = [
  { key: 'classique', label: 'Classique', desc: 'Bandeaux vert sapin, touches terracotta.' },
  { key: 'mariage', label: 'Mariage', desc: 'Tons dorés et chaleureux, pour les réceptions.' },
  { key: 'business', label: 'Business', desc: 'Sobre et contrasté, pour les entreprises.' },
  { key: 'standard', label: 'Violet', desc: 'Bandeaux violets, le style des premiers devis.' },
];

/** Un devis d'exemple, pour montrer chaque style tel qu'il sortira. */
function sampleHtml(style: StyleKey, font: string, companyName: string) {
  const date = new Date(); date.setMonth(date.getMonth() + 3);
  return generateQuoteHtml({
    companyName,
    clientName: 'Camille Martin',
    eventType: 'Mariage',
    eventDate: date.toISOString().slice(0, 10),
    eventLocation: 'Domaine des Tilleuls',
    guestCount: 80,
    vatRate: 10,
    services: [
      { name: 'Cocktail, douze pièces par personne', quantity: 80, unitPrice: 18, description: '<p>Pièces salées et sucrées, servies au plateau.</p>' },
      { name: 'Dîner assis en trois plats', quantity: 80, unitPrice: 52, description: '<p>Entrée, plat, dessert, pain de campagne.</p>' },
      { name: 'Service en salle', quantity: 1, unitPrice: 960, description: '<p>Quatre maîtres d’hôtel de 18 h à 1 h.</p>' },
    ],
  }, { template: style, font });
}

export default function QuoteStylesPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [style, setStyle] = useState<StyleKey>('classique');
  const [font, setFont] = useState('Georgia');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<StyleKey | null>(null);

  const record = profile as unknown as { default_quote_style?: string | null; default_quote_font?: string | null } | null;
  useEffect(() => {
    if (!record) return;
    if (record.default_quote_style && STYLES.some((s) => s.key === record.default_quote_style)) setStyle(record.default_quote_style as StyleKey);
    if (record.default_quote_font) setFont(record.default_quote_font);
  }, [record?.default_quote_style, record?.default_quote_font]); // eslint-disable-line react-hooks/exhaustive-deps

  const company = profile?.company_name || 'Votre entreprise';
  const samples = useMemo(() => Object.fromEntries(STYLES.map((s) => [s.key, sampleHtml(s.key, font, company)])) as Record<StyleKey, string>, [font, company]);
  const dirty = (record?.default_quote_style ?? 'classique') !== style || (record?.default_quote_font ?? 'Georgia') !== font;

  const save = async () => {
    if (!user) return;
    setSaving(true); setError(null); setSaved(false);
    const res = await createClient().from('profiles').update({ default_quote_style: style, default_quote_font: font }).eq('id', user.id);
    setSaving(false);
    if (res.error) { setError('Vos choix n’ont pas pu être enregistrés. Réessayez.'); return; }
    await refreshProfile();
    setSaved(true);
  };

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Styles de devis</h1>
          <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">La présentation proposée à chaque nouveau devis. Un devis peut toujours changer de style, dans l’éditeur, panneau Style.</p>
        </div>
        <button onClick={save} disabled={!dirty || saving} className={btnPrimary}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Enregistrer mes choix
        </button>
      </div>

      {error && <p role="alert" className={cn(errorCls, 'mb-4')}>{error}</p>}
      {saved && !dirty && <p role="status" className="text-sm text-sage bg-sage-100 rounded-xl px-4 py-3 mb-4">Vos nouveaux devis partiront avec ce style et cette police.</p>}

      <div className={cn(cardCls, 'p-4 sm:p-5 mb-5 max-w-md')}>
        <label htmlFor="default-font" className={labelCls}>Police des nouveaux devis</label>
        <select id="default-font" value={font} onChange={(e) => { setFont(e.target.value); setSaved(false); }} className={inputCls}>
          {QUOTE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" role="radiogroup" aria-label="Style des nouveaux devis">
        {STYLES.map((s) => {
          const selected = style === s.key;
          return (
            <li key={s.key} className={cn(cardCls, 'p-3 flex flex-col', selected && 'border-forest ring-2 ring-forest')}>
              <TemplateThumb html={samples[s.key]} lines={[]} loading={false} label={`Voir le style ${s.label} en grand`} onClick={() => setPreview(s.key)} />
              <div className="px-1 pt-3 flex-1">
                <p className="font-semibold text-gray-900">{s.label}</p>
                <p className="text-sm text-gray-600 mt-0.5">{s.desc}</p>
              </div>
              <div className="flex items-center gap-2 pt-3">
                <button role="radio" aria-checked={selected} onClick={() => { setStyle(s.key); setSaved(false); }}
                  className={cn(selected ? btnPrimary : btnSecondary, 'h-10 flex-1 px-3')}>
                  {selected ? <><Check className="h-4 w-4" />Par défaut</> : 'Choisir'}
                </button>
                <Link href={`/devis/nouveau?style=${s.key}`} className={cn(btnSecondary, 'h-10 px-3')}>Nouveau devis</Link>
              </div>
            </li>
          );
        })}
      </ul>

      {preview && (
        <Modal title={`Style ${STYLES.find((s) => s.key === preview)?.label}`} onClose={() => setPreview(null)} wide>
          <div className="pb-3">
            <div className="max-w-[560px] mx-auto">
              <TemplateThumb html={samples[preview]} lines={[]} loading={false} label="Fermer l’aperçu" onClick={() => setPreview(null)} />
            </div>
            <p className="text-sm text-gray-500 mt-3 text-center">Devis d’exemple, avec votre nom d’entreprise et la police choisie.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
