'use client';

// Le livre du lien public : les pages de la brochure dans le feuilletage.

import type { ReactNode } from 'react';
import { Flipbook } from '@/components/brochures/Flipbook';
import { BrochurePageView } from '@/components/brochures/BrochurePages';
import type { PublicBrochure } from '@/server/brochures';

export default function BrochureBook({ brochure, formSlot }: { brochure: PublicBrochure; formSlot?: ReactNode }) {
  const en = brochure.language === 'en';
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
