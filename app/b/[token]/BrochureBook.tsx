'use client';

// Le livre du lien public : les pages de la brochure dans le feuilletage.

import { Flipbook } from '@/components/brochures/Flipbook';
import BrochureRequestForm, { useBrochureForm } from '@/components/brochures/BrochureRequestForm';
import { BrochurePageView } from '@/components/brochures/BrochurePages';
import type { PublicBrochure } from '@/server/brochures';

export default function BrochureBook({ brochure, token }: { brochure: PublicBrochure; token: string }) {
  const en = brochure.language === 'en';
  // Saisie du formulaire gardée ici : elle survit aux pages qui tournent.
  const form = useBrochureForm();
  const formSlot = <BrochureRequestForm token={token} language={brochure.language} form={form} />;
  return (
    <Flipbook
      ariaLabel={brochure.name}
      labels={en ? { prev: 'Previous page', next: 'Next page' } : { prev: 'Page précédente', next: 'Page suivante' }}
      pages={brochure.pages.map((page, i) => (
        <BrochurePageView key={i} page={page} style={brochure.style} cover={brochure.cover} company={brochure.company}
          language={brochure.language} about={brochure.about} formSlot={formSlot} />
      ))}
    />
  );
}
