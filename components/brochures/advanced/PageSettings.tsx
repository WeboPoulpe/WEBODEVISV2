'use client';

// Réglages de la page sélectionnée (aucun bloc choisi) : fond et police d'une page à blocs. Les autres pages
// (couverture, contact, formulaire) suivent le thème de la brochure.

import type { LayoutPage } from '@/lib/brochureLayout';
import { FontSelect, Swatches } from './BlockSettings';

export default function PageSettings({ page, onChange }: { page: LayoutPage; onChange: (patch: Partial<Pick<LayoutPage, 'background' | 'font'>>) => void }) {
  if (page.kind !== 'blocks') {
    return <p className="text-sm text-gray-500">Cette page suit le thème de la brochure (réglages à gauche).</p>;
  }
  return (
    <div className="space-y-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Page</h3>
      <Swatches label="Fond de la page" value={page.background} none="Thème" onChange={(background) => onChange({ background })} />
      <FontSelect label="Police de la page" value={page.font} none="Celle du thème" onChange={(font) => onChange({ font })} />
      <p className="text-sm text-gray-500">Cliquez sur un bloc de la page pour le régler.</p>
    </div>
  );
}
