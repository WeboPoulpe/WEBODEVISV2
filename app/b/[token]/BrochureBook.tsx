'use client';

// Le livre du lien public : les pages de la brochure dans le feuilletage.

import { useEffect, useMemo, useState } from 'react';
import { Flipbook } from '@/components/brochures/Flipbook';
import FormSheet from '@/components/brochures/FormSheet';
import BrochureRequestForm, { useBrochureForm } from '@/components/brochures/BrochureRequestForm';
import { BrochurePageView, pageFlow } from '@/components/brochures/BrochurePages';
import { expandPages, useFlowBreaks } from '@/components/brochures/flow';
import { recordBrochureFormReached, type PublicBrochure } from '@/server/brochures';

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
  // Pages trop pleines : la suite passe sur des pages ajoutées.
  const flows = useMemo(() => brochure.pages.map((page) => pageFlow({ page, style: brochure.style, language: brochure.language, about: brochure.about })), [brochure]);
  const { breaks, measurer } = useFlowBreaks(flows);
  const pages = expandPages(brochure.pages, flows, breaks);
  const formIndex = pages.findIndex((p) => p.page.kind === 'form');
  const [onForm, setOnForm] = useState(false);
  const [sheet, setSheet] = useState(false);
  useEffect(() => { setSheet(phone && onForm); }, [phone, onForm]);
  // Arrivée au formulaire : le traiteur est prévenu (une notification par demi-heure au plus).
  useEffect(() => { if (onForm) recordBrochureFormReached(token).catch(() => {}); }, [onForm, token]);
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
      pages={pages.map(({ page, slice }, i) => (
        <BrochurePageView key={i} page={page} slice={slice} style={brochure.style} cover={brochure.cover} company={brochure.company}
          language={brochure.language} about={brochure.about} formSlot={formSlot} />
      ))}
    />
    {measurer}
    <FormSheet open={sheet} onClose={() => setSheet(false)} title={formTitle} language={brochure.language}>
      <BrochureRequestForm token={token} language={brochure.language} form={form} />
    </FormSheet>
    </>
  );
}
