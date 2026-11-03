'use client';

// Une photo de brochure : aperçu, « Choisir » (galerie des photos déjà envoyées et du catalogue, ou envoi depuis
// l'appareil), retrait, et, si `onFrame` est donné, son cadrage (point gardé visible, zoom, photo entière).

import { useState } from 'react';
import { Crop, ImagePlus, X } from 'lucide-react';
import { frameImgStyle, type PhotoFrame } from '@/lib/photoFrame';
import { PhotoFramer, PhotoPicker } from './PhotoPicker';

export default function PhotoField({ label, url, onChange, frame, onFrame, ratio }: {
  label: string;
  url: string | null | undefined;
  onChange: (url: string | null) => void;
  frame?: PhotoFrame | null;
  onFrame?: (frame: PhotoFrame | null) => void;
  /** Forme de l'aperçu de cadrage (hauteur / largeur, %), celle de la photo dans la page. */
  ratio?: number;
}) {
  const [picking, setPicking] = useState(false);
  const [framing, setFraming] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[#E6DFD3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url && <img src={url} alt="" className="h-full w-full" style={frameImgStyle(frame)} />}
        </div>
        <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark">
          <ImagePlus className="h-4 w-4" /> {url ? 'Changer' : label}
        </button>
        {url && onFrame && (
          <button type="button" onClick={() => setFraming((v) => !v)} aria-expanded={framing} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark">
            <Crop className="h-4 w-4" /> Cadrer
          </button>
        )}
        {url && (
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <X className="h-4 w-4" /> Retirer
          </button>
        )}
      </div>
      {framing && url && onFrame && <PhotoFramer url={url} frame={frame} onChange={onFrame} ratio={ratio} />}
      {picking && <PhotoPicker current={url} onClose={() => setPicking(false)} onPick={(u) => { onChange(u); setPicking(false); }} />}
    </div>
  );
}
