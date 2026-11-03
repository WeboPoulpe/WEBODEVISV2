'use client';

// Retoucher une prestation pour cette brochure seulement : son texte, sa photo (choix, place, taille, cadrage), son
// prix affiché ou non. Le catalogue ne change pas. Dans l'éditeur avancé, la photo se règle sur le bloc (`photo` faux).

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { btnPrimary, btnSecondary, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import type { BrochureItem, CatalogPrestation } from '@/lib/brochure';
import { placementSize, SIZE_BOUNDS, type PhotoPos } from '@/lib/photoFrame';
import PhotoField from './PhotoField';

const POS_LABEL: [PhotoPos | null, string][] = [[null, 'Selon le style'], ['top', 'En haut'], ['bottom', 'En bas'], ['left', 'À gauche'], ['right', 'À droite'], ['none', 'Sans photo']];

export default function ItemRetouch({ item, prestation, language, onSave, onClose, photo = true }: {
  photo?: boolean;
  item: BrochureItem;
  prestation: CatalogPrestation;
  language: 'fr' | 'en';
  onSave: (item: BrochureItem) => void;
  onClose: () => void;
}) {
  const card = (language === 'en' && prestation.gastro_card_html_en) || prestation.gastro_card_html;
  const catalogText = card || prestation.description || '';
  const [html, setHtml] = useState(item.html ?? catalogText);
  const [photoUrl, setPhotoUrl] = useState<string | null>(item.photoUrl ?? null);
  const [hidePrice, setHidePrice] = useState(!!item.hidePrice);
  const [placement, setPlacement] = useState(item.placement ?? null);
  const [frame, setFrame] = useState(item.frame ?? null);
  const shownUrl = photoUrl ?? prestation.photo_url;
  const side = placement?.pos === 'left' || placement?.pos === 'right';
  const bounds = SIZE_BOUNDS[side ? 'side' : 'stack'];
  const [version, setVersion] = useState(0);

  const save = () => {
    // Texte inchangé par rapport au catalogue : pas de retouche, la brochure suit le catalogue.
    const own = html.trim() && html !== catalogText ? html : null;
    onSave({
      prestationId: item.prestationId, ...(own ? { html: own, ...(card ? { titled: true } : {}) } : {}), ...(photoUrl ? { photoUrl } : {}), ...(hidePrice ? { hidePrice: true } : {}),
      ...(placement ? { placement } : {}), ...(frame && shownUrl ? { frame } : {}),
    });
  };

  return (
    <Modal title={`Retoucher « ${prestation.name} »`} onClose={onClose} wide
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
        <button type="button" onClick={save} className={btnPrimary}>Valider</button>
      </>}>
      <p className="text-sm text-gray-500 mb-3">Ces changements ne valent que pour cette brochure : la prestation du catalogue ne change pas.</p>
      <div className="flex items-center justify-between mb-1.5">
        <span className={labelCls}>Texte</span>
        {html !== catalogText && (
          <button type="button" onClick={() => { setHtml(catalogText); setVersion((v) => v + 1); }} className="text-sm text-primary hover:text-primary-dark">
            Reprendre le texte du catalogue
          </button>
        )}
      </div>
      <RichTextEditor key={version} initialValue={html} onChange={setHtml} ariaLabel="Texte de la prestation dans cette brochure" minHeight="160px" maxHeight="40vh" />
      {photo && (
        <div className="mt-4 space-y-3">
          <span className={labelCls}>Photo</span>
          <PhotoField label={prestation.photo_url ? 'Remplacer la photo du catalogue' : 'Ajouter une photo'} url={shownUrl}
            onChange={(url) => { setPhotoUrl(url); setFrame(null); if (!url && !prestation.photo_url) setPlacement(null); }}
            frame={frame} onFrame={setFrame} ratio={side ? 100 : placement?.size ?? 66} />
          <div role="group" aria-label="Place de la photo" className="flex flex-wrap gap-1">
            {POS_LABEL.map(([pos, label]) => {
              const on = (placement?.pos ?? null) === pos;
              return (
                <button key={label} type="button" aria-pressed={on}
                  onClick={() => setPlacement(pos ? { pos, size: placementSize(pos, placement?.size) } : null)}
                  className={cn('rounded-lg border px-2.5 py-1.5 text-sm', on ? 'border-primary bg-primary-50 font-medium text-primary' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
                  {label}
                </button>
              );
            })}
          </div>
          {placement && placement.pos !== 'none' && (
            <label className="block max-w-xs">
              <span className={cn(labelCls, 'flex justify-between')}>{side ? 'Largeur de la photo' : 'Hauteur de la photo'}<span className="tabular-nums text-gray-500">{placement.size} %</span></span>
              <input type="range" min={bounds.min} max={bounds.max} step={1} value={placement.size} aria-label="Taille de la photo"
                onChange={(e) => setPlacement({ ...placement, size: Number(e.target.value) })} className="w-full accent-primary" />
            </label>
          )}
        </div>
      )}
      <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={hidePrice} onChange={(e) => setHidePrice(e.target.checked)} />
        Ne pas afficher le prix de cette prestation
      </label>
    </Modal>
  );
}
