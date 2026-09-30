import { cn } from '@/lib/utils';

const MONTHS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

/** Bloc date façon éphéméride : jour en grand, mois et année dessous. */
export default function DateBlock({ iso, today = false, className }: { iso: string; today?: boolean; className?: string }) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00');
  return (
    <div className={cn('flex-shrink-0 w-14 h-14 rounded-xl border flex flex-col items-center justify-center',
      today ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-900', className)}>
      <span className="font-display text-xl font-bold leading-none tabular-nums">{String(d.getDate()).padStart(2, '0')}</span>
      <span className={cn('text-[10px] font-medium uppercase tracking-wide mt-1 leading-none', today ? 'text-white/80' : 'text-gray-500')}>
        {MONTHS[d.getMonth()]} {String(d.getFullYear()).slice(2)}
      </span>
    </div>
  );
}
