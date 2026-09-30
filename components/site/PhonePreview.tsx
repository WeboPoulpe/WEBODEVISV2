import { CalendarRange, Check, FileText, Home, LayoutGrid, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Preview } from './preview-kit';

// L'app sur téléphone : la liste de courses à cocher, et la barre d'onglets avec son bouton central.
// Données inventées.

const LINES = [
  { name: 'Filet de bœuf', qty: '21,6 kg', done: true },
  { name: 'Pommes grenaille', qty: '24 kg', done: true },
  { name: 'Asperges vertes', qty: '9,6 kg', done: false },
  { name: 'Fraises gariguette', qty: '12 kg', done: false },
  { name: 'Crème liquide', qty: '6 L', done: false },
];

export default function PhonePreview({ className }: { className?: string }) {
  return (
    <Preview
      label="Aperçu de WeboDevis sur téléphone : la liste de courses du mariage, avec deux ingrédients déjà cochés sur cinq, et la barre d’onglets en bas de l’écran."
      className={cn('relative w-[288px] max-w-full rounded-[44px] bg-gray-900 p-[9px] shadow-float', className)}
    >
      <div className="relative h-[580px] rounded-[36px] bg-page overflow-hidden">
        {/* Encoche */}
        <div className="absolute left-1/2 top-2.5 -translate-x-1/2 w-[84px] h-[22px] rounded-full bg-gray-900" />

        <div className="px-4 pt-12">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-[24px] font-bold text-gray-900 leading-tight tracking-[-0.015em]">Courses</p>
              <p className="text-[13px] text-gray-600 truncate">Mariage Camille &amp; Antoine</p>
            </div>
            <p className="font-display text-xl font-bold text-gray-900 tabular-nums whitespace-nowrap">2<span className="text-gray-400"> / 5</span></p>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 mt-3 overflow-hidden">
            <div className="h-full w-2/5 rounded-full bg-sage" />
          </div>

          <div className="space-y-2 mt-4">
            {LINES.map((l) => (
              <div key={l.name} className={cn('flex items-center gap-3 p-3 rounded-2xl border border-gray-200', l.done ? 'bg-gray-50' : 'bg-white')}>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-[15px] font-semibold leading-snug truncate', l.done ? 'line-through text-gray-400' : 'text-gray-900')}>{l.name}</p>
                  <p className={cn('text-[13px] tabular-nums', l.done ? 'text-gray-400' : 'text-gray-700')}>{l.qty}</p>
                </div>
                {l.done
                  ? <span className="w-7 h-7 rounded-full bg-sage text-white flex items-center justify-center flex-shrink-0"><Check className="h-4 w-4" strokeWidth={3} /></span>
                  : <span className="w-7 h-7 rounded-full border-2 border-gray-300 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Barre d'onglets */}
        <div className="absolute inset-x-2.5 bottom-2.5 h-[60px] rounded-3xl bg-forest shadow-float flex items-stretch px-1">
          {[{ icon: Home, label: 'Accueil' }, { icon: FileText, label: 'Devis' }].map((t) => (
            <div key={t.label} className="flex-1 flex flex-col items-center justify-center gap-1">
              <t.icon className="h-[18px] w-[18px] text-white/55" strokeWidth={1.8} />
              <span className="text-[10px] leading-none text-white/55 font-medium">{t.label}</span>
            </div>
          ))}
          <div className="flex-1 flex items-center justify-center">
            <span className="w-12 h-12 -mt-5 rounded-full bg-primary text-white flex items-center justify-center ring-4 ring-page">
              <Plus className="h-5 w-5" strokeWidth={2.4} />
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-1">
            <span className="flex items-center justify-center w-10 h-6 rounded-full bg-forest-soft">
              <CalendarRange className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />
            </span>
            <span className="text-[10px] leading-none text-white font-semibold">Événements</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-1">
            <LayoutGrid className="h-[18px] w-[18px] text-white/55" strokeWidth={1.8} />
            <span className="text-[10px] leading-none text-white/55 font-medium">Plus</span>
          </div>
        </div>
      </div>
    </Preview>
  );
}
