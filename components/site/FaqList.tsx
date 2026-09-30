import { Plus } from 'lucide-react';
import type { Faq } from '@/lib/site/schema';
import { fr } from '@/lib/site/typo';

/** Questions fréquentes : des <details> natifs, lisibles sans script et par les moteurs de recherche. */
export default function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="site-faq border-b border-gray-300/70">
      {faqs.map((f) => (
        <details key={f.q} className="group border-t border-gray-300/70">
          <summary className="flex items-start justify-between gap-5 py-5 md:py-6 rounded-lg">
            <h3 className="font-display text-[19px] md:text-[22px] font-semibold leading-snug tracking-[-0.01em] text-gray-900">{fr(f.q)}</h3>
            <span className="site-faq-mark flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-700 flex items-center justify-center" aria-hidden>
              <Plus className="h-4 w-4" />
            </span>
          </summary>
          <p className="site-body text-gray-700 pb-6 pr-10 max-w-[68ch]">{fr(f.a)}</p>
        </details>
      ))}
    </div>
  );
}
