import LogoMark from '@/components/brand/LogoMark';
import { cn } from '@/lib/utils';

// La marque : le symbole W puis le nom, en Outfit comme sur le logo.
// `short` : le symbole seul, pour la barre latérale repliée.
// `tone` : "dark" sur le vert sapin (défaut), "light" sur le crème ou le blanc.
export default function Wordmark({ className, short = false, tone = 'dark' }: { className?: string; short?: boolean; tone?: 'dark' | 'light' }) {
  if (short) {
    return (
      <span className={cn('inline-flex justify-center leading-none select-none', className)}>
        <LogoMark title="WeboDevis" tone={tone} className="h-[0.95em]" />
      </span>
    );
  }
  return (
    <span
      className={cn('inline-flex items-center gap-[0.36em] font-medium tracking-[-0.02em] leading-none select-none', className)}
      style={{ fontFamily: 'var(--font-brand), sans-serif' }}
    >
      <LogoMark tone={tone} className="h-[0.92em]" />
      WeboDevis
    </span>
  );
}
