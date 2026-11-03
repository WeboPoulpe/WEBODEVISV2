// Réglages d'affichage d'une photo de brochure : son cadrage (point gardé visible, zoom, photo entière) et, pour une
// prestation, sa place et sa taille. Le fichier n'est jamais modifié : seul l'affichage change. Module sans accès à
// la base, partagé par le serveur (nettoyage) et l'affichage.

import type { CSSProperties } from 'react';

export type PhotoFit = 'cover' | 'contain';
export interface PhotoFrame { x: number; y: number; zoom: number; fit: PhotoFit }
export type PhotoPos = 'top' | 'bottom' | 'left' | 'right' | 'none';
/** Taille : largeur en % de la page (gauche, droite), hauteur en % de la largeur (haut, bas). */
export interface PhotoPlacement { pos: PhotoPos; size: number }

export const DEFAULT_FRAME: PhotoFrame = { x: 50, y: 50, zoom: 100, fit: 'cover' };
export const PHOTO_POS: PhotoPos[] = ['top', 'bottom', 'left', 'right', 'none'];
export const SIZE_BOUNDS: Record<'side' | 'stack', { min: number; max: number; base: number }> = {
  side: { min: 25, max: 60, base: 40 },
  stack: { min: 30, max: 100, base: 66 },
};

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return v == null || v === '' || !Number.isFinite(n) ? fallback : Math.min(max, Math.max(min, Math.round(n)));
};

/** Cadrage lu en base ou envoyé par l'éditeur, ramené dans ses bornes ; null s'il n'y en a pas. */
export function parsePhotoFrame(raw: unknown): PhotoFrame | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    x: clamp(r.x, 0, 100, 50), y: clamp(r.y, 0, 100, 50), zoom: clamp(r.zoom, 100, 300, 100),
    fit: r.fit === 'contain' ? 'contain' : 'cover',
  };
}

/** Taille valable pour une place (celle donnée, bornée, ou celle par défaut). */
export function placementSize(pos: PhotoPos, size: unknown): number {
  if (pos === 'none') return 0;
  const b = SIZE_BOUNDS[pos === 'left' || pos === 'right' ? 'side' : 'stack'];
  return clamp(size, b.min, b.max, b.base);
}

export function parsePlacement(raw: unknown): PhotoPlacement | null {
  if (!raw || typeof raw !== 'object') return null;
  const pos = (raw as Record<string, unknown>).pos;
  if (!PHOTO_POS.includes(pos as PhotoPos)) return null;
  return { pos: pos as PhotoPos, size: placementSize(pos as PhotoPos, (raw as Record<string, unknown>).size) };
}

/** Style de l'image : point gardé visible et zoom autour de lui ; « photo entière » sans recadrage ni zoom. */
export function frameImgStyle(f: PhotoFrame | null | undefined): CSSProperties {
  if (!f || f.fit === 'contain') return { objectFit: f?.fit ?? 'cover', objectPosition: '50% 50%' };
  const at = `${f.x}% ${f.y}%`;
  return { objectFit: 'cover', objectPosition: at, ...(f.zoom > 100 ? { transform: `scale(${f.zoom / 100})`, transformOrigin: at } : {}) };
}
