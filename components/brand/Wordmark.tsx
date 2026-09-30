import { cn } from '@/lib/utils';

// Le nom de la marque, en toutes lettres : police système d'Apple quand elle existe, Inter ailleurs.
export default function Wordmark({ className, short = false }: { className?: string; short?: boolean }) {
  return (
    <span
      className={cn('font-semibold tracking-[-0.04em] leading-none select-none', className)}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", var(--font-brand), sans-serif' }}
    >
      {short ? 'W' : 'WeboDevis'}
    </span>
  );
}
