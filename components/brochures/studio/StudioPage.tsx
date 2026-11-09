'use client';

// Une page du Studio : la feuille A4 et ses éléments posés librement. Toutes les mesures sont en cqw (centièmes de
// la largeur de la page, qui est un conteneur) : la page s'affiche à l'identique dans l'éditeur, dans les vignettes et
// sur le lien public, quelle que soit la taille de l'écran. Rendu partagé par l'éditeur et le lecteur.

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { shortText } from '@/lib/brochure';
import { frameImgStyle } from '@/lib/photoFrame';
import type { PhotoFilter, ResolvedStudioElement, ResolvedStudioPage, ResolvedStudioPrestation, StudioText } from '@/lib/brochureStudio';
import { FramedPhoto } from '../PhotoText';
import { ICONS } from './icons';

const cq = (n: number) => `${n}cqw`;

/** Styles des textes riches du Studio (paragraphes, listes), injectés une fois par page. */
export const STUDIO_CSS = `
.wb-studio-text p, .wb-studio-text div, .wb-studio-rich p { margin: 0; }
.wb-studio-text ul, .wb-studio-text ol, .wb-studio-rich ul, .wb-studio-rich ol { margin: 0; padding-left: 1.3em; }
.wb-studio-text ul, .wb-studio-rich ul { list-style: disc; }
.wb-studio-text ol, .wb-studio-rich ol { list-style: decimal; }
.wb-studio-text h1, .wb-studio-text h2, .wb-studio-text h3, .wb-studio-rich h1, .wb-studio-rich h2, .wb-studio-rich h3 { margin: 0 0 .3em; font-size: 1.3em; font-weight: 600; font-family: inherit; }
.wb-studio-rich p + p { margin-top: .4em; }
.wb-studio-rich img { max-width: 100%; height: auto; }
.wb-studio-rich * { max-width: 100%; }
.wb-studio-text a, .wb-studio-rich a { color: inherit; text-decoration: underline; text-underline-offset: .15em; }
@keyframes wb-studio-in { from { opacity: 0; transform: translateY(2.5cqw); } to { opacity: 1; transform: none; } }
.wb-studio-in { animation: wb-studio-in 700ms cubic-bezier(.2,.8,.2,1) both; }
@media (prefers-reduced-motion: reduce) { .wb-studio-in { animation: none; } }
`;

const FILTERS: Record<PhotoFilter, string | undefined> = {
  none: undefined, bw: 'grayscale(1) contrast(1.05)', sepia: 'sepia(.65) contrast(.95)', warm: 'saturate(1.15) sepia(.18) brightness(1.03)',
  cool: 'saturate(.9) hue-rotate(-12deg) brightness(1.03)', fade: 'contrast(.85) brightness(1.08) saturate(.8)',
};

/** Place de l'élément sur la page : position, taille, rotation, opacité. Un texte prend la hauteur de son contenu. */
export function elementBox(el: ResolvedStudioElement): CSSProperties {
  return {
    position: 'absolute', left: cq(el.x), top: cq(el.y), width: cq(el.w),
    ...(el.type === 'text' ? { minHeight: cq(1) } : { height: cq(el.h) }),
    transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
    opacity: el.opacity < 100 ? el.opacity / 100 : undefined,
    filter: el.shadow ? 'drop-shadow(0 0.8cqw 1.6cqw rgba(0,0,0,.28))' : undefined,
  };
}

/** Allure d'un texte (police, taille, couleur…) : la même dans la page et pendant la saisie. */
export function textStyle(el: StudioText): CSSProperties {
  return {
    fontFamily: `'${el.font}', Georgia, serif`, fontSize: cq(el.size), color: el.color, textAlign: el.align, lineHeight: el.lineHeight,
    letterSpacing: el.letterSpacing ? `${el.letterSpacing}em` : undefined, textTransform: el.uppercase ? 'uppercase' : undefined,
    background: el.bg ?? undefined, padding: el.padding ? cq(el.padding) : undefined, borderRadius: el.radius ? cq(el.radius) : undefined,
    overflowWrap: 'break-word', width: '100%', boxSizing: 'border-box',
  };
}

/**
 * Le texte rapetisse jusqu'à tenir dans le cadre (55 % de sa taille au plus) : mesuré dans le navigateur, en
 * proportion de la page, donc identique sur téléphone et ordinateur.
 */
function useFit(el: ResolvedStudioPrestation) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  const sig = JSON.stringify([el.fit, el.size, el.w, el.h, el.text, el.show, el.photo, el.photoSize, el.padding, el.font, el.item.html, el.item.name, el.item.price]);
  useLayoutEffect(() => {
    const n = ref.current;
    if (!n) return;
    const fits = () => n.scrollHeight <= n.clientHeight + 1;
    const run = () => {
      // La taille finale est remise à la main : React ne la réécrit que si elle change.
      n.style.fontSize = cq(el.size);
      if (!el.fit || fits()) { setK(1); return; }
      let lo = 0.55;
      let hi = 1;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        n.style.fontSize = cq(el.size * mid);
        if (fits()) lo = mid; else hi = mid;
      }
      const k2 = Math.round(lo * 1000) / 1000;
      n.style.fontSize = cq(el.size * k2);
      setK(k2);
    };
    run();
    // Les polices chargées plus tard changent les mesures.
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) run(); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return { ref, k };
}

function Prestation({ el, language }: { el: ResolvedStudioPrestation; language: 'fr' | 'en' }) {
  const { item } = el;
  const { ref, k } = useFit(el);
  const photo = el.photo !== 'none' && item.photoUrl ? el.photo : 'none';
  const text = (
    <div style={{ minWidth: 0, padding: photo === 'none' ? 0 : photo === 'top' ? `${cq(el.size * 0.6)} 0 0` : photo === 'left' ? `0 0 0 ${cq(el.size)}` : `0 ${cq(el.size)} 0 0`, textAlign: el.align }}>
      {item.missing ? (
        <p style={{ margin: 0, textDecoration: 'line-through', color: '#b91c1c' }}>{language === 'en' ? 'Removed from the catalogue' : 'Supprimée du catalogue'}</p>
      ) : (
        <>
          {el.show.name && !(el.show.text && el.text === 'full' && item.titled) && (
            <p style={{ margin: `0 0 ${cq(el.size * 0.3)}`, fontSize: '1.45em', fontWeight: 600, lineHeight: 1.15 }}>{item.name}</p>
          )}
          {el.show.text && (el.text === 'full'
            ? <div className="wb-studio-rich" style={{ lineHeight: 1.45 }} dangerouslySetInnerHTML={{ __html: item.html }} />
            : <p style={{ margin: 0, lineHeight: 1.45, opacity: 0.85 }}>{shortText(item.html, 150)}</p>)}
          {el.show.price && item.price && (
            <p style={{ margin: `${cq(el.size * 0.4)} 0 0`, color: el.accent, fontWeight: 700 }}>
              {item.price}{item.childPrice && <span style={{ fontWeight: 400, opacity: 0.8 }}> · {item.childPrice}</span>}
            </p>
          )}
        </>
      )}
    </div>
  );
  const pic = <FramedPhoto url={item.photoUrl} frame={el.frame} style={{ borderRadius: el.radius ? cq(el.radius * 0.6) : undefined }} />;
  return (
    <div ref={ref} data-studio-overflow="" style={{
      width: '100%', height: '100%', overflow: 'hidden', fontFamily: `'${el.font}', Georgia, serif`, fontSize: cq(el.size * k), color: el.color,
      background: el.bg ?? undefined, padding: el.padding ? cq(el.padding) : undefined, borderRadius: el.radius ? cq(el.radius) : undefined,
      display: 'grid', boxSizing: 'border-box',
      ...(photo === 'top' ? { gridTemplateRows: `${el.photoSize}% minmax(0, 1fr)` }
        : photo === 'left' ? { gridTemplateColumns: `${el.photoSize}% minmax(0, 1fr)`, alignItems: 'start' }
          : photo === 'right' ? { gridTemplateColumns: `minmax(0, 1fr) ${el.photoSize}%`, alignItems: 'start' } : {}),
    }}>
      {photo === 'top' || photo === 'left' ? <>{photo === 'left' ? <div style={{ height: '100%' }}>{pic}</div> : pic}{text}</> : null}
      {photo === 'right' && <>{text}<div style={{ height: '100%' }}>{pic}</div></>}
      {photo === 'none' && text}
    </div>
  );
}

/** Aperçu du formulaire dans l'éditeur (le vrai formulaire n'existe que sur le lien public). */
function FormPreview({ color, accent, language }: { color: string; accent: string; language: 'fr' | 'en' }) {
  const en = language === 'en';
  const field = (label: string, tall = false) => (
    <div key={label} style={{ marginBottom: cq(2) }}>
      <p style={{ margin: `0 0 ${cq(0.6)}`, fontSize: cq(2), letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.7 }}>{label}</p>
      <div style={{ height: cq(tall ? 12 : 5.5), border: '1px solid rgba(0,0,0,.15)', borderRadius: cq(0.8), background: 'rgba(255,255,255,.8)' }} />
    </div>
  );
  return (
    <div style={{ color, fontFamily: 'Georgia, serif' }}>
      {(en ? ['First name', 'Last name', 'Email', 'Phone', 'Type of event', 'Date', 'Guests'] : ['Prénom', 'Nom', 'Email', 'Téléphone', 'Type d’événement', 'Date', 'Invités']).map((l) => field(l))}
      {field(en ? 'Your message' : 'Votre message', true)}
      <div style={{ background: accent, color: '#fff', textAlign: 'center', borderRadius: cq(0.8), padding: `${cq(1.8)} 0`, fontSize: cq(3), fontWeight: 600 }}>
        {en ? 'Send my request' : 'Envoyer ma demande'}
      </div>
    </div>
  );
}

/** Le contenu d'un élément, sans sa place (l'éditeur pose ses propres poignées autour). */
export function ElementContent({ el, editor, language, formSlot }: {
  el: ResolvedStudioElement;
  editor?: boolean;
  language: 'fr' | 'en';
  formSlot?: ReactNode;
}) {
  switch (el.type) {
    case 'text':
      return <div className="wb-studio-text" data-studio-text={el.id} style={textStyle(el)} dangerouslySetInnerHTML={{ __html: el.html }} />;
    case 'image': {
      const box: CSSProperties = {
        width: '100%', height: '100%', overflow: 'hidden', boxSizing: 'border-box',
        borderRadius: el.mask === 'circle' ? '50%' : el.mask === 'arch' ? '999px 999px 0 0' : el.radius ? cq(el.radius) : undefined,
        border: el.borderWidth && el.borderColor ? `${cq(el.borderWidth)} solid ${el.borderColor}` : undefined,
      };
      if (!el.url) {
        return editor ? (
          <div style={{ ...box, border: '1px dashed rgba(28,38,33,.35)', background: 'rgba(28,38,33,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: cq(2.6), color: 'rgba(28,38,33,.5)', fontFamily: 'system-ui, sans-serif' }}>Photo</span>
          </div>
        ) : null;
      }
      return (
        <div style={box}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={el.url} alt="" draggable={false} style={{ display: 'block', width: '100%', height: '100%', ...frameImgStyle(el.frame), filter: FILTERS[el.filter] }} />
        </div>
      );
    }
    case 'shape': {
      if (el.shape === 'line') {
        const t = Math.max(el.strokeWidth, 0.15) * (el.dash === 'double' ? 3 : 1);
        return (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', borderTop: `${cq(t)} ${el.dash} ${el.stroke ?? el.fill ?? '#1c2621'}` }} />
          </div>
        );
      }
      return (
        <div style={{
          width: '100%', height: '100%', boxSizing: 'border-box', background: el.fill ?? undefined,
          border: el.strokeWidth && el.stroke ? `${cq(el.strokeWidth * (el.dash === 'double' ? 3 : 1))} ${el.dash} ${el.stroke}` : undefined,
          borderRadius: el.shape === 'ellipse' ? '50%' : el.shape === 'arch' ? '999px 999px 0 0' : el.radius ? cq(el.radius) : undefined,
        }} />
      );
    }
    case 'icon': {
      const Icon = ICONS[el.name];
      return Icon ? <Icon aria-hidden width="100%" height="100%" color={el.color} strokeWidth={el.strokeWidth} absoluteStrokeWidth={false} style={{ display: 'block' }} /> : null;
    }
    case 'prestation':
      return <Prestation el={el} language={language} />;
    case 'form':
      return (
        <div style={{
          width: '100%', height: '100%', boxSizing: 'border-box', overflowY: editor ? 'hidden' : 'auto', padding: cq(4),
          background: el.bg ?? undefined, borderRadius: el.radius ? cq(el.radius) : undefined, color: el.color,
        }}>
          {editor || !formSlot ? <FormPreview color={el.color} accent={el.accent} language={language} /> : formSlot}
        </div>
      );
  }
}

/** Le fond de la page : sa couleur et, s'il y en a une, sa photo. */
export function PageBackground({ page }: { page: Pick<ResolvedStudioPage, 'bg' | 'bgImage'> }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: page.bg }} />
      {page.bgImage && (
        <div style={{ position: 'absolute', inset: 0, opacity: page.bgImage.opacity / 100 }}>
          <FramedPhoto url={page.bgImage.url} frame={page.bgImage.frame} />
        </div>
      )}
    </>
  );
}

/** Une page entière, telle que le lecteur la voit. Le parent doit être un conteneur (container-type: inline-size). */
export function StudioPageView({ page, language, formSlot, editor, animate }: {
  page: ResolvedStudioPage; language: 'fr' | 'en'; formSlot?: ReactNode; editor?: boolean;
  /** Les éléments apparaissent en douceur, l'un après l'autre (page qui s'affiche sur le lien). */
  animate?: boolean;
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <style>{STUDIO_CSS}</style>
      <PageBackground page={page} />
      {page.els.map((el, i) => (
        <div key={el.id} style={elementBox(el)}>
          {animate ? (
            <div className="wb-studio-in" style={{ width: '100%', height: el.type === 'text' ? undefined : '100%', animationDelay: `${Math.min(i, 12) * 70}ms` }}>
              <ElementContent el={el} language={language} formSlot={formSlot} editor={editor} />
            </div>
          ) : <ElementContent el={el} language={language} formSlot={formSlot} editor={editor} />}
        </div>
      ))}
    </div>
  );
}
