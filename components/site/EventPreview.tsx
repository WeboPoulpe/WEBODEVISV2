import { Check, MapPin } from 'lucide-react';
import DateBlock from '@/components/ui/DateBlock';
import { cn } from '@/lib/utils';
import { Pill, Preview, previewCard } from './preview-kit';

// La fiche d'un événement : ses onglets, la liste de courses calculée (quantité par convive × convives),
// la checklist et les extras. Données inventées.
// Les rôles sont ceux de la fiche d'un extra dans l'app (cuisinier, serveur, barman…).

const GUESTS = 120;

// Quantité par convive, dans l'unité d'achat ; le total est calculé ici comme il l'est dans l'app.
const COURSES = [
  { name: 'Filet de bœuf', per: 180, unit: 'g' },
  { name: 'Pommes grenaille', per: 200, unit: 'g' },
  { name: 'Asperges vertes', per: 80, unit: 'g' },
  { name: 'Fraises gariguette', per: 100, unit: 'g' },
  { name: 'Crème liquide', per: 5, unit: 'cl' },
];

const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/** 180 g × 120 = 21,6 kg ; 5 cl × 120 = 6 L. */
function total(per: number, unit: string) {
  const sum = per * GUESTS;
  return unit === 'g' ? `${fr(sum / 1000)} kg` : `${fr(sum / 100)} L`;
}

const TASKS = [
  { label: 'Commander la vaisselle', done: true },
  { label: 'Valider le plan de table', done: true },
  { label: 'Confirmer les extras', done: false },
];

// Trois colonnes alignées d'une ligne à l'autre : l'ingrédient, la quantité par convive, le total.
const courseRow = 'grid grid-cols-[minmax(0,1fr)_5rem_4.75rem] sm:grid-cols-[minmax(0,1fr)_7rem_7rem] items-baseline gap-x-2';

const EXTRAS = [
  { initials: 'JM', name: 'Julie Moreau', role: 'Serveuse' },
  { initials: 'KH', name: 'Karim Haddad', role: 'Cuisinier' },
];

export default function EventPreview({ className }: { className?: string }) {
  return (
    <Preview
      label="Exemple de fiche d’événement pour le mariage de Camille et Antoine : onglets Checklist, Matériel, Courses et Extras. La liste de courses multiplie la quantité par convive par 120 convives, par exemple 180 grammes de filet de bœuf par convive, soit 21,6 kilos."
      className={cn('grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-3', className)}
    >
      {/* Fiche et liste de courses */}
      <div className={cn(previewCard, 'p-4 sm:p-6 shadow-card')}>
        <div className="flex items-center gap-4">
          <DateBlock iso="2027-06-12" />
          <div className="flex-1 min-w-0">
            <p className="font-display text-xl sm:text-2xl font-bold text-gray-900 leading-tight truncate">Camille &amp; Antoine</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Pill>Mariage</Pill>
              <Pill tone="sage">{GUESTS} couverts</Pill>
              <Pill tone="sage">Acompte reçu</Pill>
            </div>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-3">
          <MapPin className="h-4 w-4 flex-shrink-0" />Domaine des Tilleuls
        </p>

        <div className="flex p-1 mt-5 rounded-xl bg-gray-200/70 text-sm font-medium">
          {['Checklist', 'Matériel', 'Courses', 'Extras'].map((tab) => (
            <span key={tab} className={cn('flex-1 flex items-center justify-center h-9 px-1 rounded-lg', tab === 'Courses' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600')}>{tab}</span>
          ))}
        </div>

        <div className="mt-5 text-sm">
          <div className={cn(courseRow, 'pb-2 text-gray-500')}>
            <p>Ingrédient</p>
            <p className="text-right">Par convive</p>
            <p className="text-right">À acheter</p>
          </div>
          {COURSES.map((c) => (
            <div key={c.name} className={cn(courseRow, 'py-3 border-t border-gray-100')}>
              <p className="font-medium text-gray-900 truncate">{c.name}</p>
              <p className="text-right text-gray-600 tabular-nums whitespace-nowrap">{c.per} {c.unit}</p>
              <p className="text-right font-display font-bold text-gray-900 tabular-nums whitespace-nowrap">{total(c.per, c.unit)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 content-start">
        {/* Checklist : la carte sombre, comme la première carte du tableau de bord */}
        <div className="rounded-2xl bg-forest text-white p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/70">Checklist</span>
            <span className="font-semibold tabular-nums">8 sur 12</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/15 mt-3 overflow-hidden">
            <div className="h-full w-2/3 rounded-full bg-primary-400" />
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {TASKS.map((t) => (
              <li key={t.label} className={cn('flex items-center gap-2.5', t.done ? 'text-white/50 line-through' : 'text-white')}>
                {t.done
                  ? <span className="w-5 h-5 rounded-full bg-primary-400 flex items-center justify-center flex-shrink-0"><Check className="h-3 w-3 text-forest" strokeWidth={3} /></span>
                  : <span className="w-5 h-5 rounded-full border border-white/40 flex-shrink-0" />}
                {t.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Extras */}
        <div className={cn(previewCard, 'p-5')}>
          <p className="text-base font-semibold text-gray-900">Extras</p>
          <ul className="mt-3 space-y-3">
            {EXTRAS.map((e) => (
              <li key={e.name} className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold">{e.initials}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 truncate">{e.name}</span>
                  <span className="block text-xs text-gray-500 truncate">{e.role}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 pt-3.5 border-t border-gray-100 text-sm text-sage">2 confirmés sur 2</p>
        </div>
      </div>
    </Preview>
  );
}
