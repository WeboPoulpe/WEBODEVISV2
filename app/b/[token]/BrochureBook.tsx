'use client';

// Le livre du lien public : les pages de la brochure dans le feuilletage.

import { useEffect, useState } from 'react';
import { Flipbook } from '@/components/brochures/Flipbook';
import FormSheet from '@/components/brochures/FormSheet';
import BrochureRequestForm, { useBrochureForm } from '@/components/brochures/BrochureRequestForm';
import { BrochurePageView } from '@/components/brochures/BrochurePages';
import type { PublicBrochure } from '@/server/brochures';

export default function BrochureBook({ brochure, token }: { brochure: PublicBrochure; token: string }) {
  const en = brochure.language === 'en';
  // Saisie du formulaire gardée ici : elle survit aux pages qui tournent.
  const form = useBrochureForm();
  const formTitle = en ? 'Your request' : 'Votre demande';
  // Téléphone : en arrivant sur la dernière page, le formulaire s'ouvre en plein écran (une fois par arrivée).
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const formIndex = brochure.pages.findIndex((p) => p.kind === 'form');
  const [onForm, setOnForm] = useState(false);
  const [sheet, setSheet] = useState(false);
  useEffect(() => { setSheet(phone && onForm); }, [phone, onForm]);
  const formSlot = phone
    ? (
      <button type="button" onClick={() => setSheet(true)}
        className="w-full rounded-lg bg-[#B4502D] px-3 py-2 text-[14px] font-semibold text-white">
        {en ? 'Fill in the form' : 'Remplir le formulaire'}
      </button>
    )
    : <BrochureRequestForm token={token} language={brochure.language} form={form} />;
  return (
    <>
    <Flipbook
      onPageChange={(visible) => setOnForm(visible.includes(formIndex))}
      ariaLabel={brochure.name}
      labels={en ? { prev: 'Previous page', next: 'Next page' } : { prev: 'Page précédente', next: 'Page suivante' }}
      pages={brochure.pages.map((page, i) => (
        <BrochurePageView key={i} page={page} style={brochure.style} cover={brochure.cover} company={brochure.company}
          language={brochure.language} about={brochure.about} formSlot={formSlot} />
      ))}
    />
    <FormSheet open={sheet} onClose={() => setSheet(false)} title={formTitle} language={brochure.language}>
      <BrochureRequestForm token={token} language={brochure.language} form={form} />
    </FormSheet>
    </>
  );
}
