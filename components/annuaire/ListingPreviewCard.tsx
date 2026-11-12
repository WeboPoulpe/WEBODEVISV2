import { ImageIcon } from 'lucide-react';
import { cardCls, pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { departmentByCode } from '@/lib/annuaire/departments';
import type { ListingFields } from '@/lib/annuaire/listing';

// Aperçu de la carte telle qu'elle apparaît dans les résultats de l'annuaire, avec ce que le traiteur est en train de saisir.

export default function ListingPreviewCard({ fields, coverUrl }: { fields: ListingFields; coverUrl: string | null }) {
  const place = [fields.city, ...fields.departments.slice(0, 2).map((c) => departmentByCode(c)?.name)].filter(Boolean).join(', ');
  return (
    <div className={cn(cardCls, 'overflow-hidden')}>
      <div className="relative aspect-[3/2] bg-[#E6DFD3]">
        {coverUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          : <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-500 text-sm"><ImageIcon className="h-6 w-6" aria-hidden /> Pas encore de photo</div>}
      </div>
      <div className="space-y-2 p-4">
        <p className="text-lg font-semibold leading-snug text-gray-900 break-words">{fields.displayName || 'Nom de votre entreprise'}</p>
        <p className="text-sm text-gray-500">{place || 'Ville et départements'}</p>
        {fields.tagline && <p className="text-sm text-gray-700 break-words">{fields.tagline}</p>}
        {fields.eventTypes.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Événements">
            {fields.eventTypes.map((t) => <li key={t} className={cn(pill, 'bg-sage-100 text-forest')}>{t}</li>)}
          </ul>
        )}
        {fields.priceFrom !== null && (
          <p className="text-sm font-medium text-gray-900">À partir de {fields.priceFrom.toLocaleString('fr-FR')} € par personne</p>
        )}
      </div>
    </div>
  );
}
