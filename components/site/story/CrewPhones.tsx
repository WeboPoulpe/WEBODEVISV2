import { CREW } from '@/lib/site/story';
import { cn } from '@/lib/utils';

// Vendredi : ce que chaque extra lit sur son téléphone, la veille du mariage.
export default function CrewPhones({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-end justify-center gap-4 sm:gap-5', className)}>
      {CREW.map((c, i) => (
        <li key={c.name} className={cn('w-[210px] rounded-[28px] border-[5px] border-forest bg-white px-4 py-4 text-left text-sm leading-relaxed text-gray-800', i === 1 && 'md:mb-8')}>
          <p className="font-display text-xl font-semibold text-gray-900">{c.name}</p>
          <p className="mb-2.5 text-gray-500">{c.role}</p>
          <p>{c.when}</p>
          <p>{c.where}</p>
          <p>{c.outfit}</p>
          <p className="mt-3 rounded-[10px] bg-sage-100 py-1.5 text-center font-semibold text-sage">Mission acceptée</p>
        </li>
      ))}
    </ul>
  );
}
