import { cn } from '@/lib/utils';
import { JulienHead } from './Julien';

// Le camion de Julien, le mercredi : il entre par la gauche quand on arrive sur la section (site.css).
export default function Van({ className }: { className?: string }) {
  return (
    <div className={cn('story-van', className)} aria-hidden>
      <svg viewBox="0 0 330 176" className="julien block w-full h-auto overflow-visible">
        <ellipse cx="165" cy="168" rx="150" ry="6" fill="rgb(0 0 0 / 0.12)" />
        <g className="story-van-body">
          <rect x="10" y="30" width="226" height="116" rx="14" fill="#fff" />
          <path d="M232 62 H276 Q298 62 306 88 L314 112 V146 H232Z" fill="#fff" />
          <rect x="10" y="112" width="304" height="12" fill="rgb(var(--p-700))" />
          <clipPath id="story-van-window"><rect x="244" y="72" width="50" height="36" rx="7" /></clipPath>
          <rect x="244" y="72" width="50" height="36" rx="7" fill="#cfe0d6" />
          <g clipPath="url(#story-van-window)">
            <rect x="252" y="100" width="34" height="20" rx="8" fill="#fff" />
            <JulienHead x={269} y={90} scale={0.44} />
          </g>
          <text x="123" y="84" textAnchor="middle" fontFamily="var(--font-display), Georgia, serif" fontSize="22" fontWeight="600" fill="rgb(var(--forest))">Julien Traiteur</text>
        </g>
        <circle cx="74" cy="148" r="21" fill="rgb(var(--n-900))" />
        <circle cx="74" cy="148" r="8" fill="rgb(var(--n-400))" />
        <circle cx="262" cy="148" r="21" fill="rgb(var(--n-900))" />
        <circle cx="262" cy="148" r="8" fill="rgb(var(--n-400))" />
      </svg>
    </div>
  );
}
