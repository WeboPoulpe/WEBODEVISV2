import { REQUESTS } from '@/lib/site/story';
import { cn } from '@/lib/utils';

// Lundi, 7 h 30 : le téléphone de Julien, encore verrouillé, et les six demandes du week-end.
// Les notifications sont toutes dans la page ; elles tombent l'une après l'autre en CSS (site.css).
export default function LockScreen({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-[36px] bg-[#0e1411] p-3 pt-6 ring-1 ring-white/10 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)]', className)}>
      <p aria-hidden className="text-center font-display text-[52px] leading-none text-white tabular-nums">7:30</p>
      <p aria-hidden className="mt-1 mb-4 text-center text-[13px] text-white/60">lundi 9 juin</p>
      <ul aria-label="Les six demandes reçues pendant le week-end" className="space-y-1.5">
        {REQUESTS.map((r, i) => (
          <li key={r.text} className="story-notif rounded-[14px] bg-white/[0.12] px-3 py-2" style={{ animationDelay: `${0.5 + i * 0.55}s` }}>
            <span className="block text-xs font-semibold text-primary-300">Nouvelle demande · {r.source}</span>
            <span className="block text-[13px] leading-snug text-white">{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
