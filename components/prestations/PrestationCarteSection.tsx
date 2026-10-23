'use client';

import { useState } from 'react';
import { Languages, Loader2, Plus } from 'lucide-react';
import CarteBlockEditor from '@/components/prestations/CarteBlockEditor';
import { btnGhost, btnSecondary } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import type { QuoteHtmlOptions } from '@/lib/generateQuoteHtml';
import { cardFromDescription } from '@/lib/prestationCard';
import { fallbackMessage, runSummary, translateFiches, type TranslationMode } from '@/lib/weboTranslateClient';
import { useWallet } from '@/components/webo/WalletContext';
import WeboCoin from '@/components/webo/WeboCoin';
import { cn } from '@/lib/utils';

// Texte de la prestation dans la carte du menu, édité sur place (un seul endroit, une seule zone par langue) :
//  • Français : la description sous le nom, ou la fiche mise en page quand la prestation en a une (elle remplace
//    alors le nom et la description dans la carte, comme dans le générateur des devis) ;
//  • Anglais : la fiche anglaise (gastro_card_html_en), lue par les devis en anglais. Sans elle, ils reprennent
//    le texte français.

type Template = NonNullable<QuoteHtmlOptions['template']>;

export default function PrestationCarteSection({
  name, isOption, template, font,
  description, onDescription, cardFr, onCardFr, cardEn, onCardEn,
}: {
  name: string;
  isOption: boolean;
  template: Template;
  font: string;
  description: string;
  onDescription: (html: string) => void;
  /** Fiche française, ou null : la carte montre alors le nom et la description. */
  cardFr: string | null;
  onCardFr: (html: string | null) => void;
  /** Fiche anglaise, ou null : les devis en anglais reprennent le texte français. */
  cardEn: string | null;
  onCardEn: (html: string | null) => void;
}) {
  const { confirm, notify } = useFeedback();
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  // Remplacer le texte d'une zone (traduction, retour à la description) la recrée : elle part du nouveau texte.
  const [version, setVersion] = useState(0);
  const [translating, setTranslating] = useState(false);
  const { wallet, refresh } = useWallet();
  // Mode de l'entreprise (Paramètres) ; l'autre reste proposé à côté, pour cette fois.
  const mode: TranslationMode = wallet?.mode ?? 'webo';
  const other: TranslationMode = mode === 'webo' ? 'free' : 'webo';

  /** Le bloc français, tel qu'il figure dans la carte, comme point de départ de la version anglaise. */
  const frenchCard = () => cardFr ?? cardFromDescription({ name, description }, { template, font });

  const createEnglish = (html: string) => { onCardEn(html); setVersion((v) => v + 1); };

  const translate = async (how: TranslationMode) => {
    if (cardEn !== null && !(await confirm({
      title: 'Remplacer la version anglaise ?',
      message: 'Elle sera remplacée par une traduction automatique du texte français.',
      confirmLabel: 'Remplacer',
      danger: true,
    }))) return;
    setTranslating(true);
    try {
      const run = await translateFiches([{ key: 'card', name, html: frenchCard(), keepName: true }], how);
      createEnglish(run.byKey.get('card')!.html);
      if (run.webo) await refresh();
      if (how === 'webo' && run.fallbackWhy) notify(`${fallbackMessage(run.fallbackWhy)} : ${runSummary(run)}.`);
    } catch {
      notify('La traduction n’a pas pu être faite. Vérifiez votre connexion et réessayez.', { tone: 'error' });
    } finally {
      setTranslating(false);
    }
  };

  const dropFrenchCard = async () => {
    if (!(await confirm({
      title: 'Revenir au nom et à la description ?',
      message: 'La mise en page libre ne figurera plus dans la carte : le nom et la description la remplaceront. Rien n’est perdu avant d’enregistrer.',
      confirmLabel: 'Revenir',
    }))) return;
    onCardFr(null);
    setVersion((v) => v + 1);
  };

  const dropEnglish = async () => {
    if (!(await confirm({
      title: 'Supprimer la version anglaise ?',
      message: 'Les devis en anglais reprendront le texte français.',
      confirmLabel: 'Supprimer',
      danger: true,
    }))) return;
    onCardEn(null);
  };

  const common = { name, isOption, template, font };

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Langue du texte" className="inline-grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-200/70">
        {([['fr', 'Français'], ['en', 'Anglais']] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={lang === key} onClick={() => setLang(key)}
            className={cn('h-10 px-4 rounded-lg text-[15px] font-medium transition-colors', lang === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
            {label}
          </button>
        ))}
      </div>

      {lang === 'fr' ? (
        <>
          {cardFr !== null && (
            <div className="rounded-xl bg-primary-50 border border-primary-100 px-4 py-3 text-[15px] text-gray-800">
              Cette prestation a une <strong>mise en page libre</strong> : elle remplace le nom et la description dans la carte,
              et le nom n’y change pas quand vous le modifiez plus haut.{' '}
              <button type="button" onClick={dropFrenchCard} className="font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800">
                Revenir au nom et à la description
              </button>
            </div>
          )}
          <CarteBlockEditor
            key={`fr-${cardFr !== null ? 'card' : 'desc'}-${version}`}
            {...common}
            lang="fr"
            kind={cardFr !== null ? 'card' : 'description'}
            value={cardFr ?? description}
            onChange={cardFr !== null ? onCardFr : onDescription}
            label={cardFr !== null ? 'Texte de la carte, en français' : 'Description'}
            placeholder="Détails, inclusions…"
          />
        </>
      ) : cardEn === null ? (
        <div className="rounded-xl bg-gray-50 p-4 space-y-3">
          <p className="text-[15px] text-gray-700">Pas de version anglaise : les devis en anglais reprennent le texte français.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => createEnglish(frenchCard())} disabled={translating} className={btnSecondary}>
              <Plus className="h-4 w-4" />Écrire la version anglaise
            </button>
            <TranslateButtons verb="Traduire" mode={mode} other={other} busy={translating} onTranslate={translate} />
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            Le texte de la carte des devis en anglais, nom compris : le titre sert aussi de nom dans le tableau du devis.
          </p>
          <CarteBlockEditor
            key={`en-${version}`}
            {...common}
            lang="en"
            kind="card"
            value={cardEn}
            onChange={onCardEn}
            label="Texte de la carte, en anglais"
            placeholder="English description…"
          />
          <div className="flex flex-wrap gap-2">
            <TranslateButtons verb="Retraduire" mode={mode} other={other} busy={translating} onTranslate={translate} />
            <button type="button" onClick={dropEnglish} disabled={translating} className={cn(btnGhost, 'text-danger hover:bg-danger/5')}>
              Supprimer la version anglaise
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** « Traduire avec Webo · 1 W » (ou en gratuit, selon le mode de l'entreprise), et l'autre façon pour cette fois. */
function TranslateButtons({ verb, mode, other, busy, onTranslate }: {
  verb: 'Traduire' | 'Retraduire'; mode: TranslationMode; other: TranslationMode; busy: boolean; onTranslate: (how: TranslationMode) => void;
}) {
  const label = (how: TranslationMode) => (how === 'webo' ? `${verb} avec Webo · 1 W` : `${verb} (gratuit)`);
  return (
    <>
      <button type="button" onClick={() => onTranslate(mode)} disabled={busy} className={btnGhost}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'webo' ? <WeboCoin size={16} /> : <Languages className="h-4 w-4" />}
        {busy ? 'Traduction…' : label(mode)}
      </button>
      {!busy && (
        <button type="button" onClick={() => onTranslate(other)} className="px-2 text-sm text-gray-500 underline underline-offset-2 hover:text-gray-800">
          {label(other)}
        </button>
      )}
    </>
  );
}
