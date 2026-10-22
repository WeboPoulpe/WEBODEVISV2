'use client';

// Retoucher une prestation pour cette brochure seulement : son texte, sa photo, son prix affiché ou non.
// Le catalogue ne change pas.

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { btnPrimary, btnSecondary, labelCls } from '@/components/ui/kit';
import type { BrochureItem, CatalogPrestation } from '@/lib/brochure';
import PhotoField from './PhotoField';

export default function ItemRetouch({ item, prestation, language, onSave, onClose }: {
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
  const [version, setVersion] = useState(0);

  const save = () => {
    // Texte inchangé par rapport au catalogue : pas de retouche, la brochure suit le catalogue.
    const own = html.trim() && html !== catalogText ? html : null;
    onSave({ prestationId: item.prestationId, ...(own ? { html: own, ...(card ? { titled: true } : {}) } : {}), ...(photoUrl ? { photoUrl } : {}), ...(hidePrice ? { hidePrice: true } : {}) });
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
      <div className="mt-4">
        <span className={labelCls}>Photo</span>
        <PhotoField label={prestation.photo_url ? 'Remplacer la photo du catalogue' : 'Ajouter une photo'} url={photoUrl ?? prestation.photo_url} onChange={setPhotoUrl} />
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={hidePrice} onChange={(e) => setHidePrice(e.target.checked)} />
        Ne pas afficher le prix de cette prestation
      </label>
    </Modal>
  );
}
