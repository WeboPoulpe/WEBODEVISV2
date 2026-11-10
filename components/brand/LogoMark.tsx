import { useId } from 'react';
import { cn } from '@/lib/utils';
import { LOGO_CREAM, LOGO_FOREST, LOGO_PARTS as P, LOGO_STROKE, LOGO_TERRACOTTA, LOGO_VIEWBOX_ATTR } from '@/lib/brand/logo';

// Le symbole W. `tone="dark"` (défaut) : posé sur le vert sapin, ruban crème.
// `tone="light"` : posé sur le crème ou le blanc, ruban vert sapin. La hauteur suit la taille de police (1em).
export default function LogoMark({ className, title, tone = 'dark' }: { className?: string; title?: string; tone?: 'dark' | 'light' }) {
  const id = useId().replace(/:/g, '');
  const ribbon = tone === 'dark' ? LOGO_CREAM : LOGO_FOREST;
  const shadow = (key: string, s: typeof P.creamShadow) => (
    <linearGradient id={`${id}${key}`} gradientUnits="userSpaceOnUse" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}>
      <stop offset="0" stopColor="#000" stopOpacity="0" />
      <stop offset="1" stopColor="#000" stopOpacity={s.opacity} />
    </linearGradient>
  );
  return (
    <svg
      viewBox={LOGO_VIEWBOX_ATTR}
      className={cn('h-[1em] w-auto shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <clipPath id={`${id}cc`}><rect {...P.creamClip} /></clipPath>
        <clipPath id={`${id}ct`}><polygon points={P.terraClip} /></clipPath>
        {shadow('cf', P.creamShadow)}
        {shadow('tf', P.terraShadow)}
      </defs>
      <g fill="none" strokeWidth={LOGO_STROKE} strokeLinecap="round">
        <g clipPath={`url(#${id}cc)`}>
          <path d={P.creamFold} stroke={ribbon} />
          <path d={P.creamFold} stroke={`url(#${id}cf)`} />
          <path d={P.creamFront} stroke={ribbon} />
        </g>
        <g clipPath={`url(#${id}ct)`}>
          <path d={P.terraBack} stroke={LOGO_TERRACOTTA.back} />
          <path d={P.terraBack} stroke={`url(#${id}tf)`} />
          <path d={P.terraFront} stroke={LOGO_TERRACOTTA.front} />
        </g>
      </g>
    </svg>
  );
}
