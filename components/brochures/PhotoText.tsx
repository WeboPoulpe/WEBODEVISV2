// Photo de brochure et sa place à côté d'un texte, partagées par les trois styles et les pages à blocs. Sans photo,
// rien ne s'affiche (pas de cadre vide) : le texte prend la place. Dans un éditeur, `hint` laisse un repère en
// pointillés pour en ajouter une. Tailles en cqw, comme le reste de la page.

import type { CSSProperties, ReactNode } from 'react';
import { frameImgStyle, placementSize, type PhotoFrame, type PhotoPos } from '@/lib/photoFrame';

/**
 * Photo cadrée. `ratio` (hauteur / largeur, en %) ou `height` (en cqw) fixent sa hauteur ; sinon elle remplit son
 * parent. `data-flow-block` : insécable pour la suite de page.
 */
export function FramedPhoto({ url, frame, ratio, height, hint, style }: {
  url: string | null | undefined;
  frame?: PhotoFrame | null;
  ratio?: number;
  height?: string;
  hint?: boolean;
  style?: CSSProperties;
}) {
  const box: CSSProperties = {
    position: 'relative', overflow: 'hidden', width: '100%',
    ...(ratio ? { aspectRatio: `100 / ${ratio}` } : height ? { height } : { height: '100%' }),
    ...style,
  };
  if (!url) {
    if (!hint) return null;
    return (
      <div data-flow-block="" data-photo-hint="" style={{ ...box, border: '1px dashed rgba(28,38,33,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '2.6cqw', color: 'rgba(28,38,33,.45)' }}>Ajouter une photo</span>
      </div>
    );
  }
  return (
    <div data-flow-block="" data-photo="" style={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" style={{ display: 'block', width: '100%', height: '100%', ...frameImgStyle(frame) }} />
    </div>
  );
}

/** Une photo et un texte : photo en haut, en bas, à gauche, à droite, ou aucune (le texte seul). */
export function PhotoText({ url, frame, pos, size, gap = 3, sideRatio = 100, hint, children }: {
  url: string | null | undefined;
  frame?: PhotoFrame | null;
  pos: PhotoPos;
  size?: number;
  gap?: number;
  /** Hauteur d'une photo de côté, en % de sa largeur. */
  sideRatio?: number;
  hint?: boolean;
  children: ReactNode;
}) {
  const hasPhoto = pos !== 'none' && (!!url || hint);
  if (!hasPhoto) return <>{children}</>;
  const s = placementSize(pos, size);
  const photo = <FramedPhoto url={url} frame={frame} ratio={pos === 'left' || pos === 'right' ? sideRatio : s} hint={hint} />;
  if (pos === 'top' || pos === 'bottom') {
    return (
      <div>
        {pos === 'top' && <div style={{ marginBottom: `${gap}cqw` }}>{photo}</div>}
        {children}
        {pos === 'bottom' && <div style={{ marginTop: `${gap}cqw` }}>{photo}</div>}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: pos === 'left' ? `${s}% minmax(0, 1fr)` : `minmax(0, 1fr) ${s}%`, gap: `${gap}cqw`, alignItems: 'start' }}>
      {pos === 'left' && photo}
      <div style={{ minWidth: 0 }}>{children}</div>
      {pos === 'right' && photo}
    </div>
  );
}
