import { Check, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Preview } from './preview-kit';

// Le devis tel que le client le lit : une feuille, la typographie des documents de l'app (Playfair),
// et à côté le suivi du statut. Traiteur, clients et montants sont inventés.

const LINES = [
  { section: 'Cocktail', label: 'Pièces salées, 12 par convive', price: '2 160,00 €' },
  { section: 'Dîner', label: 'Entrée, plat et dessert', price: '7 440,00 €' },
  { section: 'Service', label: 'Maîtres d’hôtel et cuisiniers', price: '1 800,00 €' },
];

const STEPS = [
  { label: 'Devis à faire', state: 'done' },
  { label: 'Devis envoyé', state: 'done' },
  { label: 'Validé', state: 'current' },
  { label: 'Acompte reçu', state: 'todo' },
  { label: 'Payé', state: 'todo' },
] as const;

export default function QuotePreview({ className }: { className?: string }) {
  return (
    <Preview
      label="Exemple de devis pour le mariage de Camille et Antoine, 120 convives : cocktail, dîner et service, total de 12 540 euros TTC. Le devis a été envoyé par email et son statut est passé à Validé."
      className={cn('relative sm:pr-[232px]', className)}
    >
      {/* La feuille */}
      <div className="site-paper rounded-xl border border-gray-200 px-5 py-7 sm:px-10 sm:py-10">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-menu text-lg text-gray-900">Maison Verdier</p>
          <p className="text-xs text-gray-500">Devis du 3 mai 2027</p>
        </div>
        <div className="h-px bg-gray-200 mt-4" />

        <p className="font-menu text-[26px] sm:text-[30px] lg:text-[27px] leading-[1.15] text-gray-900 mt-7 [text-wrap:balance]">Mariage de Camille et Antoine</p>
        <p className="text-sm text-gray-600 mt-2">Samedi 12 juin 2027, Domaine des Tilleuls<br />120 convives</p>

        <div className="mt-8 space-y-5">
          {LINES.map((l) => (
            <div key={l.section}>
              <p className="font-menu italic text-base text-primary">{l.section}</p>
              <p className="flex items-baseline text-[15px] text-gray-800 mt-1">
                <span className="min-w-0">{l.label}</span>
                <span className="site-leader" />
                <span className="tabular-nums whitespace-nowrap">{l.price}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-5 border-t border-gray-200 ml-auto max-w-[280px] space-y-1.5 text-sm">
          <p className="flex justify-between gap-4 text-gray-600"><span>Total HT</span><span className="tabular-nums">11 400,00 €</span></p>
          <p className="flex justify-between gap-4 text-gray-600"><span>TVA 10 %</span><span className="tabular-nums">1 140,00 €</span></p>
          <p className="flex justify-between gap-4 items-baseline pt-2 text-gray-900">
            <span className="font-semibold">Total TTC</span>
            <span className="font-menu text-2xl tabular-nums">12 540,00 €</span>
          </p>
        </div>
      </div>

      {/* Suivi : l'envoi et les statuts, dans l'ordre où ils se succèdent */}
      <div className="relative mt-3 sm:mt-0 sm:absolute sm:right-0 sm:bottom-10 sm:w-[264px] rounded-2xl bg-white border border-gray-200 shadow-float p-4">
        <div className="flex items-start gap-3 pb-3.5 border-b border-gray-100">
          <span className="w-9 h-9 rounded-xl bg-primary-100 text-primary flex items-center justify-center flex-shrink-0">
            <Send className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-snug">Envoyé par email</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">camille.roussel@exemple.fr</p>
          </div>
        </div>
        <ol className="mt-3.5 space-y-2.5">
          {STEPS.map((s) => (
            <li key={s.label} className="flex items-center gap-3 text-sm">
              <span className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                s.state === 'done' && 'bg-sage text-white',
                s.state === 'current' && 'bg-primary text-white ring-4 ring-primary-100',
                s.state === 'todo' && 'border border-gray-300')}>
                {s.state !== 'todo' && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className={cn(s.state === 'current' ? 'font-semibold text-gray-900' : s.state === 'done' ? 'text-gray-600' : 'text-gray-400')}>{s.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </Preview>
  );
}
