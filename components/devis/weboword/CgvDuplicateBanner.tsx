// Bandeau de l'éditeur quand les conditions générales figurent deux fois dans le devis : tapées dans le texte,
// et dans le bloc ajouté automatiquement (data-webo-cgv).

export function CgvDuplicateBanner({ onRemove }: { onRemove: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
      <span className="flex-1 min-w-0">Vos conditions générales apparaissent deux fois.</span>
      <button type="button" onClick={onRemove} className="font-semibold underline underline-offset-2 hover:text-amber-950">
        Retirer le bloc ajouté
      </button>
    </div>
  );
}
