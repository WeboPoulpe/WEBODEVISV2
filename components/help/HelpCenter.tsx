'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Play, Search, X } from 'lucide-react';
import { guidesForPage, guidesForPath, HELP_CATEGORIES, HELP_GUIDES, HELP_MEDIA, searchGuides, type HelpCategoryId, type HelpGuide } from '@/lib/help';
import { btnSecondary, iconBtn, inputCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

const duration = (seconds: number) => (seconds < 60 ? `${Math.round(seconds)} s` : `${Math.floor(seconds / 60)} min ${String(Math.round(seconds % 60)).padStart(2, '0')}`);

// Centre d'aide : une page entière posée par-dessus l'app. L'écran en cours reste tel quel dessous,
// on le retrouve en fermant.
export default function HelpCenter({ open, onClose, page = null, guideId = null }: {
  open: boolean;
  onClose: () => void;
  /** Ouvre sur les guides de cette page du menu plutôt que sur ceux de la page en cours. */
  page?: string | null;
  /** Ouvre directement ce guide. */
  guideId?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<HelpCategoryId | 'ici' | 'tout'>('tout');
  const [guide, setGuide] = useState<HelpGuide | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const here = useMemo(() => (page ? guidesForPage(page) : guidesForPath(pathname)), [page, pathname]);

  // À l'ouverture : les guides de la page en cours d'abord, s'il y en a (ou le guide demandé).
  useEffect(() => {
    if (!open) return;
    setGuide(guideId ? HELP_GUIDES.find((g) => g.id === guideId) ?? null : null);
    setQuery('');
    setCategory(here.length > 0 ? 'ici' : 'tout');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, page, guideId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (guide) setGuide(null);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [open, guide, onClose]);

  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [guide, category]);

  const list = useMemo(() => {
    if (query.trim()) return searchGuides(query);
    if (category === 'ici') return here;
    if (category === 'tout') return HELP_GUIDES;
    return HELP_GUIDES.filter((g) => g.category === category);
  }, [query, category, here]);

  if (!open) return null;

  const tabs: { id: HelpCategoryId | 'ici' | 'tout'; label: string }[] = [
    ...(here.length > 0 ? [{ id: 'ici' as const, label: page && page !== pathname ? 'Pour cette page' : 'Sur cette page' }] : []),
    { id: 'tout', label: 'Tout' },
    ...HELP_CATEGORIES.filter((c) => HELP_GUIDES.some((g) => g.category === c.id)),
  ];
  const openPage = (href: string) => { onClose(); if (href !== pathname) router.push(href); };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-page" role="dialog" aria-modal="true" aria-label="Aide">
      <header className="flex-shrink-0 flex items-center gap-3 px-4 md:px-8 h-[68px]" style={{ marginTop: 'env(safe-area-inset-top)' }}>
        {guide ? (
          <button onClick={() => setGuide(null)} className={cn(btnSecondary, 'px-3')}><ArrowLeft className="h-4 w-4" />Tous les guides</button>
        ) : (
          <h1 className="font-display text-2xl font-bold text-gray-900">Aide</h1>
        )}
        <button onClick={onClose} className={cn(iconBtn, 'ml-auto bg-white border border-gray-200')} aria-label="Fermer l’aide"><X className="h-5 w-5" /></button>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
        {guide ? (
          <GuideView guide={guide} onOpenPage={openPage} onOpenGuide={setGuide} />
        ) : (
          <div className="px-4 md:px-8">
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Que cherchez-vous à faire ?" aria-label="Rechercher dans l’aide" className={cn(inputCls, 'pl-11')} />
            </div>

            {!query.trim() && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 mt-4" role="tablist" aria-label="Rubriques">
                {tabs.map((t) => (
                  <button key={t.id} role="tab" aria-selected={category === t.id} onClick={() => setCategory(t.id)}
                    className={cn('flex-shrink-0 h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                      category === t.id ? 'bg-forest text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300')}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {list.length === 0 ? (
              <div className="py-16 max-w-md">
                <p className="font-semibold text-gray-900">Aucun guide ne correspond à « {query} »</p>
                <p className="text-sm text-gray-500 mt-1">Essayez un mot plus simple : devis, client, courses, stock.</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-x-5 gap-y-7 mt-6">
                {list.map((g) => <li key={g.id}><GuideCard guide={g} onOpen={() => setGuide(g)} /></li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GuideCard({ guide, onOpen }: { guide: HelpGuide; onOpen: () => void }) {
  const media = HELP_MEDIA[guide.id];
  return (
    <button onClick={onOpen} className="group w-full text-left">
      <span className="relative block aspect-[16/10] rounded-2xl overflow-hidden bg-white border border-gray-200 group-hover:border-gray-300 transition-colors">
        {media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.poster} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover object-left-top" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">Guide écrit</span>
        )}
        {media && (
          <span className="absolute left-3 bottom-3 inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full bg-forest/90 text-white text-xs font-medium">
            <Play className="h-3 w-3 fill-current" />{duration(media.seconds)}
          </span>
        )}
      </span>
      <span className="block font-semibold text-gray-900 mt-3 group-hover:text-primary transition-colors">{guide.title}</span>
      <span className="block text-sm text-gray-500 mt-0.5">{guide.summary}</span>
    </button>
  );
}

function GuideView({ guide, onOpenPage, onOpenGuide }: { guide: HelpGuide; onOpenPage: (href: string) => void; onOpenGuide: (g: HelpGuide) => void }) {
  const media = HELP_MEDIA[guide.id];
  const related = HELP_GUIDES.filter((g) => g.category === guide.category && g.id !== guide.id).slice(0, 4);
  // Lecture automatique, comme un GIF, sauf si la personne a demandé moins d'animations.
  const autoPlay = typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <article className="px-4 md:px-8 grid lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] gap-x-10 gap-y-6 items-start">
      <div className="lg:sticky lg:top-0">
        {media ? (
          <video
            key={guide.id} src={media.video} poster={media.poster}
            autoPlay={autoPlay} muted loop playsInline controls preload="metadata"
            className="w-full aspect-[16/10] rounded-2xl bg-white border border-gray-200 object-cover object-left-top"
          />
        ) : (
          <div className="w-full aspect-[16/10] rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-sm text-gray-400">Vidéo à venir</div>
        )}
      </div>

      <div>
        <p className="text-sm text-gray-500">{HELP_CATEGORIES.find((c) => c.id === guide.category)?.label}</p>
        <h2 className="font-display text-[26px] md:text-[30px] font-bold text-gray-900 leading-tight mt-1">{guide.title}</h2>
        <p className="text-base text-gray-600 mt-2">{guide.summary}</p>

        <ol className="mt-6 space-y-4">
          {guide.steps.map((step, i) => (
            <li key={i} className="flex gap-3.5">
              <span aria-hidden className="flex-shrink-0 w-7 h-7 rounded-full bg-forest text-white text-sm font-semibold flex items-center justify-center tabular-nums">{i + 1}</span>
              <span className="pt-0.5">
                <span className="block font-semibold text-gray-900">{step.title}</span>
                {step.text && <span className="block text-[15px] text-gray-600 mt-0.5">{step.text}</span>}
              </span>
            </li>
          ))}
        </ol>

        {guide.notes && guide.notes.length > 0 && (
          <div className="mt-6 rounded-2xl bg-white border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">À savoir</p>
            <ul className="space-y-2 text-[15px] text-gray-600">
              {guide.notes.map((n, i) => <li key={i} className="flex gap-2.5"><span aria-hidden className="mt-2.5 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />{n}</li>)}
            </ul>
          </div>
        )}

        {guide.href && (
          <button onClick={() => onOpenPage(guide.href!)} className={cn(btnSecondary, 'mt-6')}>
            Ouvrir cette page<ArrowUpRight className="h-4 w-4" />
          </button>
        )}

        {related.length > 0 && (
          <nav className="mt-8 pt-6 border-t border-gray-200" aria-label="Guides voisins">
            <p className="text-sm font-medium text-gray-500 mb-2">Dans la même rubrique</p>
            <ul>
              {related.map((g) => (
                <li key={g.id}>
                  <button onClick={() => onOpenGuide(g)} className="w-full text-left py-2 text-[15px] font-medium text-gray-800 hover:text-primary transition-colors">{g.title}</button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </article>
  );
}
