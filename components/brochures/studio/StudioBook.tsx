'use client';

// Le lecteur d'une brochure du Studio, sur le lien public.
// - Téléphone : plein écran. La page A4 prend toute la largeur ; au-dessus et au-dessous, la couleur (ou la photo
//   floutée) du fond de la page remplit l'écran, sans marge ni cadre. On glisse du doigt ou on touche le bord droit
//   ou gauche pour tourner les pages (comme une story) ; le formulaire s'ouvre en plein écran en arrivant au bout.
// - Écran large : le livre, en double page (Flipbook), formulaire dans la page.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_H, type ResolvedStudioPage } from '@/lib/brochureStudio';
import type { PhotoFrame } from '@/lib/photoFrame';
import { Flipbook } from '../Flipbook';
import FormSheet from '../FormSheet';
import BrochureRequestForm, { useBrochureForm } from '../BrochureRequestForm';
import { StudioPageView } from './StudioPage';
import { FramedPhoto } from '../PhotoText';

const PHONE = '(max-width: 767px)';

export function usePhone(): boolean | null {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return phone;
}

/** La couleur de la barre du navigateur suit le fond de la page affichée (vrai plein écran sur téléphone). */
function useThemeColor(color: string | null) {
  useEffect(() => {
    if (!color) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const before = meta?.content ?? null;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = color;
    return () => { if (meta && before != null) meta.content = before; };
  }, [color]);
}

/** Fond clair : la barre d'avancement passe en foncé pour rester visible. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 160;
}

/** Photo qui prolonge la page au-dessus et au-dessous : celle du fond, sinon une photo qui couvre toute la page. */
function backdropOf(page: ResolvedStudioPage): { url: string; frame?: PhotoFrame; opacity: number } | null {
  if (page.bgImage) return page.bgImage;
  const full = page.els.find((e) => e.type === 'image' && e.url && !e.rot && e.x <= 0.5 && e.y <= 0.5 && e.x + e.w >= 99.5 && e.y + e.h >= PAGE_H - 0.5);
  return full?.type === 'image' && full.url ? { url: full.url, ...(full.frame ? { frame: full.frame } : {}), opacity: full.opacity } : null;
}

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"]';

function PhoneReader({ pages, language, name, formSlot, onFormPage }: {
  pages: ResolvedStudioPage[];
  language: 'fr' | 'en';
  name: string;
  formSlot: ReactNode;
  onFormPage: (on: boolean) => void;
}) {
  const en = language === 'en';
  const [at, setAt] = useState(0);
  const [drag, setDrag] = useState(0);
  const [animate, setAnimate] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number; t: number; horizontal: boolean | null } | null>(null);
  const last = pages.length - 1;
  const light = !backdropOf(pages[at] ?? pages[0]) && isLight(pages[at]?.bg ?? '#ffffff');
  const go = useCallback((to: number) => { setAnimate(true); setAt(Math.max(0, Math.min(last, to))); setDrag(0); }, [last]);

  useEffect(() => { onFormPage(!!pages[at]?.form); }, [at, pages, onFormPage]);
  useThemeColor(pages[at]?.bg ?? null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(at + 1);
      if (e.key === 'ArrowLeft') go(at - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, go]);
  // La page entière reste en place : pas de défilement ni de rebond derrière le lecteur.
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = before; };
  }, []);

  return (
    <div ref={box} role="region" aria-roledescription={en ? 'brochure' : 'brochure'} aria-label={name}
      className="fixed inset-0 overflow-hidden select-none" style={{ background: pages[at]?.bg, touchAction: 'pan-y' }}
      onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, t: Date.now(), horizontal: null }; setAnimate(false); }}
      onTouchMove={(e) => {
        const s = touch.current;
        if (!s) return;
        const t = e.touches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (s.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s.horizontal = Math.abs(dx) > Math.abs(dy);
        // Au bord (première ou dernière page), la page résiste.
        if (s.horizontal) setDrag((at === 0 && dx > 0) || (at === last && dx < 0) ? dx / 4 : dx);
      }}
      onTouchEnd={(e) => {
        const s = touch.current;
        touch.current = null;
        if (!s) return;
        const dx = e.changedTouches[0].clientX - s.x;
        const width = box.current?.clientWidth ?? 360;
        const fast = Math.abs(dx) / Math.max(1, Date.now() - s.t) > 0.5;
        if (s.horizontal && (Math.abs(dx) > width * 0.18 || (fast && Math.abs(dx) > 30))) go(at + (dx < 0 ? 1 : -1));
        else { setAnimate(true); setDrag(0); }
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
        const width = box.current?.clientWidth ?? 360;
        if (e.clientX > width * 0.7) go(at + 1);
        else if (e.clientX < width * 0.3) go(at - 1);
      }}
    >
      <div className="flex h-full w-full" style={{
        transform: `translateX(calc(${-at * 100}% + ${drag}px))`,
        transition: animate ? 'transform 380ms cubic-bezier(.2,.8,.2,1)' : 'none',
      }}>
        {pages.map((page, i) => {
          const backdrop = backdropOf(page);
          return (
          <div key={i} aria-hidden={i !== at} className="relative flex h-full w-full flex-none items-center justify-center overflow-hidden" style={{ background: page.bg }}>
            {Math.abs(i - at) <= 1 && <>
              {/* Photo de fond (ou photo pleine page) : prolongée, floutée, au-dessus et au-dessous de la page. */}
              {backdrop && (
                <div aria-hidden className="absolute inset-0" style={{ filter: 'blur(24px) brightness(.85)', transform: 'scale(1.15)', opacity: backdrop.opacity / 100 }}>
                  <FramedPhoto url={backdrop.url} frame={backdrop.frame} />
                </div>
              )}
              <div data-studio-page="" className="relative" style={{ width: 'min(100%, calc(100dvh * 210 / 297))', aspectRatio: '210 / 297', containerType: 'inline-size' }}>
                <StudioPageView page={page} language={language} formSlot={formSlot} />
              </div>
            </>}
          </div>
          );
        })}
      </div>

      {/* Avancement, comme une story : discret, dans le haut de l'écran. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex gap-1 px-3" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
        {pages.map((_, i) => (
          <span key={i} className="h-[3px] flex-1 rounded-full" style={light
            ? { background: i <= at ? 'rgba(28,38,33,.75)' : 'rgba(28,38,33,.18)' }
            : { background: i <= at ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.4)', boxShadow: '0 0 2px rgba(0,0,0,.35)' }} />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={() => go(at - 1)} disabled={at === 0} aria-label={en ? 'Previous page' : 'Page précédente'}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur disabled:opacity-0">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="rounded-full bg-black/30 px-3 py-1 text-xs tabular-nums text-white backdrop-blur" aria-live="polite">{at + 1} / {pages.length}</span>
        <button type="button" onClick={() => go(at + 1)} disabled={at === last} aria-label={en ? 'Next page' : 'Page suivante'}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur disabled:opacity-0">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export default function StudioBook({ pages, language, name, token }: { pages: ResolvedStudioPage[]; language: 'fr' | 'en'; name: string; token: string }) {
  const en = language === 'en';
  const phone = usePhone();
  // Saisie du formulaire gardée ici : elle survit aux pages qui tournent et à la fenêtre plein écran.
  const form = useBrochureForm();
  const [sheet, setSheet] = useState(false);
  const [onForm, setOnForm] = useState(false);
  const onFormPage = useCallback((on: boolean) => setOnForm(on), []);
  // Téléphone : en arrivant sur la page du formulaire, il s'ouvre en plein écran (une fois par arrivée).
  useEffect(() => { setSheet(!!phone && onForm); }, [phone, onForm]);
  const formIndex = pages.findIndex((p) => p.form);

  if (phone === null) return null;
  if (phone) {
    return (
      <>
        <PhoneReader pages={pages} language={language} name={name} onFormPage={onFormPage}
          formSlot={(
            <button type="button" onClick={() => setSheet(true)}
              className="w-full rounded-lg bg-[#B4502D] px-3 py-3 text-[15px] font-semibold text-white">
              {en ? 'Fill in the form' : 'Remplir le formulaire'}
            </button>
          )} />
        <FormSheet open={sheet} onClose={() => setSheet(false)} title={en ? 'Your request' : 'Votre demande'} language={language}>
          <BrochureRequestForm token={token} language={language} form={form} />
        </FormSheet>
      </>
    );
  }
  return (
    <Flipbook
      ariaLabel={name}
      onPageChange={(visible) => setOnForm(visible.includes(formIndex))}
      labels={en ? { prev: 'Previous page', next: 'Next page' } : { prev: 'Page précédente', next: 'Page suivante' }}
      pages={pages.map((page, i) => (
        <StudioPageView key={i} page={page} language={language} formSlot={<BrochureRequestForm token={token} language={language} form={form} />} />
      ))}
    />
  );
}
