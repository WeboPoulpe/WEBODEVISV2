import Image from 'next/image';
import { container } from '@/components/site/ui';

// Le témoignage d'un traiteur qui utilise WeboDevis pendant la bêta.
// Citation proposée à Francis : à lui faire valider mot pour mot avant la mise en ligne.
export const TESTIMONIAL = {
  quote: 'Mes devis partent le jour même, mes clients les signent en ligne, et la liste de courses est prête sans que j’y touche. Je ne reviendrais pas en arrière.',
  name: 'Francis D.',
  role: 'Gérant de Convivial Event, traiteur',
  site: { label: 'convivialwedding.com', href: 'https://www.convivialwedding.com' },
  photo: { src: '/site-web/francis-convivial-event.webp', width: 960, height: 1470, alt: 'Francis, gérant de Convivial Event, découpe la charcuterie d’un buffet servi en plein air.' },
};

export default function Testimonial({ className }: { className?: string }) {
  const t = TESTIMONIAL;
  return (
    <section aria-labelledby="titre-temoignage" className={className}>
      <div className={container}>
        <figure className="site-reveal grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-12 lg:gap-x-20 gap-y-8 md:items-center">
          <div className="relative">
            <div aria-hidden className="absolute -inset-2 sm:-inset-3 rounded-[34px] bg-primary/15 rotate-[-2.5deg]" />
            <Image
              src={t.photo.src}
              width={t.photo.width}
              height={t.photo.height}
              alt={t.photo.alt}
              sizes="(min-width: 768px) 40vw, 92vw"
              className="relative w-full aspect-[4/5] object-cover object-[60%_30%] rounded-[28px] shadow-[0_30px_60px_-30px_rgb(var(--n-900)/0.45)]"
            />
            <span className="absolute left-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-1.5 text-sm font-semibold text-forest shadow-sm">
              <span aria-hidden className="h-2 w-2 rounded-full bg-sage" />
              Traiteur bêta-testeur
            </span>
          </div>
          <div>
            <h2 id="titre-temoignage" className="text-base font-semibold text-primary">Ils l’utilisent déjà</h2>
            <svg aria-hidden viewBox="0 0 64 48" className="mt-5 h-10 w-auto text-primary">
              <path fill="currentColor" d="M0 48V30C0 13 8 3 25 0l3 7C18 10 14 16 14 24h12v24H0Zm36 0V30C36 13 44 3 61 0l3 7c-10 3-14 9-14 17h12v24H36Z" />
            </svg>
            <blockquote className="mt-5">
              <p className="font-display text-[clamp(1.55rem,1.1rem+1.6vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-gray-900 text-balance">
                {t.quote}
              </p>
            </blockquote>
            <figcaption className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-lg font-semibold text-gray-900">{t.name}</span>
              <span className="text-base text-gray-600">{t.role}</span>
              <a href={t.site.href} target="_blank" rel="noopener" className="text-base font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
                {t.site.label}
              </a>
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  );
}
