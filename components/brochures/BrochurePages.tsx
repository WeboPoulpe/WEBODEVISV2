// Une page de brochure, dans l'un des trois styles (Éditorial, Carte, Magazine). Les tailles sont en cqw (centièmes
// de la largeur de la page, qui est un conteneur) : la même page s'affiche à l'identique sur téléphone et sur
// ordinateur. Rendu partagé par le lien public et l'aperçu de l'éditeur.

import type { ReactNode } from 'react';
import { shortText, type BrochureCover, type BrochureStyle, type ResolvedItem } from '@/lib/brochure';
import type { PublicPage } from '@/lib/brochureLayout';
import { blockFlow } from './BlockPage';
import { FlowFrame, type Flow, type PageSlice } from './flow';
import { FramedPhoto, PhotoText } from './PhotoText';
import type { PhotoFrame, PhotoPos } from '@/lib/photoFrame';

export interface BrochureCompany { name: string; logoUrl: string | null; address: string | null; phone: string | null; email: string | null; website: string | null }

const INK = '#1C2621';
const ACCENT = '#B4502D';
const MUTED = '#5b5b55';
const LINE = '#E6DFD3';

const T = {
  fr: { about: 'Qui sommes-nous', contact: 'Nous contacter', form: 'Votre demande', missing: 'Supprimée du catalogue', child: '' },
  en: { about: 'About us', contact: 'Contact us', form: 'Your request', missing: 'Removed from the catalogue', child: '' },
};

const cq = (n: number) => `${n}cqw`;
const kicker = { fontSize: cq(2.6), letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: ACCENT, fontWeight: 600 };
const body = { fontSize: cq(3.4), lineHeight: 1.5, color: MUTED };
// Texte riche des fiches : ses tailles écrites en pixels sont ramenées à la page.
const rich = 'wb-rich [&_*]:!max-w-full [&_img]:!h-auto';


function Price({ item, size = 3.4 }: { item: ResolvedItem; size?: number }) {
  if (!item.price) return null;
  return (
    <p style={{ margin: 0, fontSize: cq(size), color: ACCENT, fontWeight: 700 }}>
      {item.price}{item.childPrice && <span style={{ fontWeight: 400, color: MUTED }}> · {item.childPrice}</span>}
    </p>
  );
}

function Missing({ language }: { language: 'fr' | 'en' }) {
  return <p style={{ ...body, textDecoration: 'line-through', color: '#b91c1c' }}>{T[language].missing}</p>;
}

function CoverPhoto({ cover, style }: { cover: BrochureCover; style?: React.CSSProperties }) {
  return <FramedPhoto url={cover.photoUrl} frame={cover.photoFrame} style={style} />;
}

function Cover({ style, cover, company }: { style: BrochureStyle; cover: BrochureCover; company: BrochureCompany }) {
  const title = <h1 style={{ margin: 0, fontSize: cq(style === 'editorial' ? 9 : 8), lineHeight: 1.1, fontWeight: 600 }}>{cover.title}</h1>;
  if (style === 'editorial') {
    return (
      // Sans photo : un fond vert sapin, pas un cadre vide.
      <div style={{ position: 'absolute', inset: 0, color: '#fff', background: cover.photoUrl ? undefined : '#2F4A3A' }}>
        {cover.photoUrl && <CoverPhoto cover={cover} style={{ position: 'absolute', inset: 0 }} />}
        <div style={{ position: 'absolute', inset: 'auto 0 0 0', padding: cq(8), background: cover.photoUrl ? 'linear-gradient(transparent, rgba(28,38,33,.88))' : undefined }}>
          {cover.subtitle && <p style={{ ...kicker, color: '#f1d3c2', margin: `0 0 ${cq(2)}` }}>{cover.subtitle}</p>}
          {title}
          <p style={{ margin: `${cq(2)} 0 0`, fontSize: cq(3.4), opacity: 0.85 }}>{company.name}</p>
        </div>
      </div>
    );
  }
  if (style === 'magazine') {
    return (
      <div style={{ position: 'absolute', inset: 0, color: INK, display: 'grid', gridTemplateRows: cover.photoUrl ? '62% 1fr' : '1fr', alignItems: cover.photoUrl ? undefined : 'center' }}>
        {cover.photoUrl && <CoverPhoto cover={cover} />}
        <div style={{ padding: cq(8) }}>
          {cover.subtitle && <p style={{ ...kicker, margin: `0 0 ${cq(2)}` }}>{cover.subtitle}</p>}
          {title}
          <p style={{ ...body, marginTop: cq(2) }}>{company.name}</p>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', inset: 0, color: INK, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: cq(10) }}>
      {company.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.logoUrl} alt="" style={{ maxWidth: cq(30), maxHeight: cq(16), objectFit: 'contain', marginBottom: cq(8) }} />
      )}
      {cover.subtitle && <p style={{ ...kicker, margin: `0 0 ${cq(3)}` }}>{cover.subtitle}</p>}
      {title}
      <div style={{ width: cq(10), height: 1, background: ACCENT, margin: `${cq(5)} 0` }} />
      <p style={body}>{company.name}</p>
    </div>
  );
}

type PhotoProps = { url: string | null; frame: ResolvedItem['frame']; pos: PhotoPos; size?: number };
/** Photo d'une prestation : place et taille réglées pour la brochure, sinon celles du style. */
const photoOf = (item: ResolvedItem, pos: PhotoPos, size?: number): PhotoProps => ({
  url: item.photoUrl, frame: item.frame, pos: item.placement?.pos ?? pos, size: item.placement?.size ?? size,
});

function Items({ style, sectionTitle, items, language }: { style: BrochureStyle; sectionTitle: string | null; items: ResolvedItem[]; language: 'fr' | 'en' }) {
  const head = sectionTitle && <p data-flow-heading="" style={{ ...kicker, margin: `0 0 ${cq(4)}` }}>{sectionTitle}</p>;
  if (style === 'editorial') {
    return (
      <div style={{ textAlign: 'center', color: INK }}>
        {head}
        {items.map((item) => (item.missing ? <Missing key={item.key} language={language} /> : (
          <PhotoText key={item.key} {...photoOf(item, 'bottom')} gap={5}>
            {!item.titled && <h2 style={{ margin: `0 0 ${cq(3)}`, fontSize: cq(6.2), fontWeight: 600 }}>{item.name}</h2>}
            <div className={rich} style={{ ...body, color: INK }} dangerouslySetInnerHTML={{ __html: item.html }} />
            <div style={{ width: cq(8), height: 1, background: ACCENT, margin: `${cq(4)} auto` }} />
            <Price item={item} size={4} />
          </PhotoText>
        )))}
      </div>
    );
  }
  if (style === 'carte') {
    return (
      <div style={{ color: INK }}>
        {head}
        {items.map((item) => (
          <div key={item.key} style={{ borderTop: `1px solid ${LINE}`, padding: `${cq(3)} 0` }}>
            {item.missing ? <Missing language={language} /> : (
              <PhotoText {...photoOf(item, 'none')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: cq(3), alignItems: 'baseline' }}>
                  <h2 style={{ margin: 0, fontSize: cq(4.2), fontWeight: 600 }}>{item.name}</h2>
                  {item.price && <span style={{ fontSize: cq(3.6), color: ACCENT, fontWeight: 700, whiteSpace: 'nowrap' }}>{item.price}</span>}
                </div>
                <p style={{ ...body, margin: `${cq(1)} 0 0`, fontSize: cq(3) }}>{shortText(item.html, 140)}</p>
                {item.childPrice && <p style={{ ...body, margin: 0, fontSize: cq(2.8) }}>{item.childPrice}</p>}
              </PhotoText>
            )}
          </div>
        ))}
      </div>
    );
  }
  // Magazine : la photo d'un côté puis de l'autre, sur toute la largeur de la page.
  return (
    <div style={{ color: INK }}>
      {sectionTitle && <p data-flow-heading="" style={{ ...kicker, margin: 0, padding: `${cq(5)} ${cq(6)} ${cq(3)}` }}>{sectionTitle}</p>}
      {items.map((item, i) => (
        <div key={item.key} style={{ borderTop: i ? `1px solid ${LINE}` : undefined }}>
          {item.missing ? <div style={{ padding: cq(5) }}><Missing language={language} /></div> : (
            <PhotoText {...photoOf(item, i % 2 ? 'right' : 'left', 50)} gap={0} sideRatio={85}>
              <div style={{ padding: cq(5) }}>
                <h2 style={{ margin: 0, fontSize: cq(4.4), fontWeight: 600 }}>{item.name}</h2>
                <p style={{ ...body, fontSize: cq(3), margin: `${cq(1.5)} 0` }}>{shortText(item.html, 160)}</p>
                <Price item={item} size={3.4} />
              </div>
            </PhotoText>
          )}
        </div>
      ))}
    </div>
  );
}

function About({ html, photoUrl, photoFrame, language }: { html: string; photoUrl?: string | null; photoFrame?: PhotoFrame | null; language: 'fr' | 'en' }) {
  return (
    <div style={{ color: INK }}>
      <p data-flow-heading="" style={{ ...kicker, margin: `0 0 ${cq(4)}` }}>{T[language].about}</p>
      {photoUrl && <FramedPhoto url={photoUrl} frame={photoFrame} ratio={75} style={{ marginBottom: cq(5), borderRadius: 2 }} />}
      <div className={rich} style={{ ...body, color: INK }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function Contact({ company, language }: { company: BrochureCompany; language: 'fr' | 'en' }) {
  const rows = [company.address, company.phone, company.email, company.website].filter(Boolean) as string[];
  return (
    <div style={{ position: 'absolute', inset: 0, padding: cq(10), display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', color: INK }}>
      <p style={{ ...kicker, margin: `0 0 ${cq(5)}` }}>{T[language].contact}</p>
      {company.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.logoUrl} alt="" style={{ maxWidth: cq(34), maxHeight: cq(18), objectFit: 'contain', margin: `0 auto ${cq(5)}` }} />
      )}
      <h2 style={{ margin: `0 0 ${cq(4)}`, fontSize: cq(6), fontWeight: 600 }}>{company.name}</h2>
      {rows.map((r) => <p key={r} style={{ ...body, margin: `${cq(1)} 0` }}>{r}</p>)}
    </div>
  );
}

export interface PageProps {
  page: PublicPage;
  style: BrochureStyle;
  cover: BrochureCover;
  company: BrochureCompany;
  language: 'fr' | 'en';
  /** Texte et photo de la page « qui sommes-nous ». */
  about: { html: string; photoUrl?: string | null; photoFrame?: PhotoFrame | null };
  /** Contenu de la dernière page (le formulaire de demande). */
  formSlot?: ReactNode;
}

/** Le contenu d'une page qui continue sur la suivante s'il ne tient pas (prestations, qui sommes-nous, blocs), ou null. */
export function pageFlow({ page, style, language, about }: Pick<PageProps, 'page' | 'style' | 'language' | 'about'>): Flow | null {
  switch (page.kind) {
    case 'about': return { pad: 9, style: {}, content: <About html={about.html} photoUrl={about.photoUrl} photoFrame={about.photoFrame} language={language} /> };
    case 'items': return {
      pad: style === 'magazine' ? 0 : style === 'editorial' ? 9 : 8, style: {},
      content: <Items style={style} sectionTitle={page.sectionTitle} items={page.items} language={language} />,
    };
    case 'blocks': return blockFlow(page, style);
    default: return null;
  }
}

export function BrochurePageView(props: PageProps & { slice?: PageSlice | null }) {
  const { page, style, cover, company, language, formSlot, slice } = props;
  const flow = pageFlow(props);
  if (flow) return <FlowFrame flow={flow} slice={slice} />;
  switch (page.kind) {
    case 'cover': return <Cover style={style} cover={cover} company={company} />;
    case 'contact': return <Contact company={company} language={language} />;
    default:
      return (
        <div style={{ position: 'absolute', inset: 0, padding: cq(8), overflowY: 'auto', color: INK }}>
          <p style={{ ...kicker, margin: `0 0 ${cq(4)}` }}>{T[language].form}</p>
          {formSlot}
        </div>
      );
  }
}
