'use client';

// Onglet « Site web » : la vitrine Webomax (réalisations, étapes, packs, options, logiciel sur mesure). Chaque
// bouton ouvre le questionnaire de rappel avec le projet déjà choisi, modifiable dedans.

import { useState } from 'react';
import { ArrowUpRight, Check, Inbox, MessagesSquare, PenTool, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUrlAction } from '@/lib/useUrlAction';
import { SOFTWARE, type SitePack } from '@/lib/siteWeb';
import type { SiteWebPage } from '@/server/siteWeb';
import Questionnaire from './Questionnaire';

const STEPS = [
  { icon: MessagesSquare, title: 'Un échange', text: 'Webomax vous rappelle : votre activité, vos clients, ce que le site doit faire.' },
  { icon: PenTool, title: 'La maquette', text: 'Vous voyez votre site avant sa mise en ligne, et vous le faites ajuster.' },
  { icon: Rocket, title: 'La mise en ligne', text: 'Le site est publié à votre adresse, et ses demandes arrivent dans WeboDevis.' },
];

const host = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

const kicker = 'text-xs font-semibold uppercase tracking-[0.14em] text-sage';
const h2 = 'font-display text-[22px] md:text-[26px] font-bold text-gray-900 leading-tight';

export default function SiteWebView({ page }: { page: SiteWebPage }) {
  const { catalog } = page;
  const [open, setOpen] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(page.pendingSince);
  // « Être rappelé » depuis le mégamenu.
  useUrlAction({ rappel: () => setOpen('') });

  return (
    <div className="px-4 md:px-6 pb-12 max-w-6xl">
      <header className="mb-5">
        <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Votre site web</h1>
        <p className="text-[15px] text-gray-600 mt-0.5">Conçu par Webomax, relié à vos devis</p>
      </header>

      {/* Bandeau : l'argument, et la seule entrée générale vers le questionnaire. */}
      <section className="relative overflow-hidden rounded-3xl bg-forest text-white px-5 py-7 md:px-9 md:py-9">
        <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/[0.04]" />
        <div aria-hidden className="absolute right-24 -bottom-24 h-48 w-48 rounded-full bg-primary/20" />
        <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              <Inbox className="h-3.5 w-3.5" /> Prospects
            </p>
            <h2 className="mt-3 font-display text-[24px] md:text-[30px] font-bold leading-tight">Les demandes de votre site arrivent ici</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-white/75">
              Le formulaire de devis de votre site envoie chaque demande d’un visiteur directement dans vos Prospects.
              Elle se transforme en devis en un clic, sans rien retaper.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <button type="button" onClick={() => setOpen('')}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark">
              Être rappelé par Webomax
            </button>
            {sentAt && <p role="status" className="text-sm text-white/70">Votre demande du {dateFr(sentAt)} est bien reçue.</p>}
          </div>
        </div>
      </section>

      {catalog.works.length > 0 && (
        <section className="mt-10" aria-labelledby="sw-works">
          <p className={kicker}>Réalisations</p>
          <h2 id="sw-works" className={cn(h2, 'mt-1')}>Des sites de traiteurs, faits par Webomax</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {catalog.works.map((w) => (
              <a key={w.key} href={w.url} target="_blank" rel="noopener noreferrer"
                className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-lg">
                <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                  {w.image && (
                    <picture>
                      {w.mobileImage && <source media="(max-width: 640px)" srcSet={w.mobileImage} />}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.image} alt={`Le site ${w.name}`} loading="lazy"
                        className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]" />
                    </picture>
                  )}
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{w.name}</p>
                    <p className="flex items-center gap-1 text-sm text-primary">{host(w.url)}<ArrowUpRight className="h-3.5 w-3.5" /></p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {w.tags.map((t, i) => (
                      <span key={t} className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', i % 2 ? 'bg-sage-100 text-sage' : 'bg-primary-50 text-primary-700')}>{t}</span>
                    ))}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10" aria-labelledby="sw-steps">
        <p className={kicker}>Comment ça se passe</p>
        <h2 id="sw-steps" className={cn(h2, 'mt-1')}>Trois étapes, et votre site est en ligne</h2>
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary"><s.icon className="h-5 w-5" /></span>
                <span className="font-display text-sm font-bold text-gray-400">0{i + 1}</span>
              </div>
              <p className="mt-3 font-semibold text-gray-900">{s.title}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-gray-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="sw-packs">
        <p className={kicker}>Les sites</p>
        <h2 id="sw-packs" className={cn(h2, 'mt-1')}>Choisissez votre formule</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-3 lg:items-stretch">
          {catalog.packs.map((p) => <PackCard key={p.key} pack={p} onChoose={() => setOpen(p.key)} />)}
        </div>
      </section>

      {catalog.options.length > 0 && (
        <section className="mt-10" aria-labelledby="sw-options">
          <p className={kicker}>Options</p>
          <h2 id="sw-options" className={cn(h2, 'mt-1')}>À ajouter à votre site</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {catalog.options.map((o) => (
              <li key={o.key} className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="font-semibold text-gray-900">{o.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{o.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 grid gap-6 rounded-3xl border border-gray-200 bg-white p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-8" aria-labelledby="sw-soft">
        <div>
          <p className={kicker}>Logiciels sur mesure</p>
          <h2 id="sw-soft" className={cn(h2, 'mt-1')}>{catalog.software.title}</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600">{catalog.software.text}</p>
          {catalog.software.examples.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {catalog.software.examples.map((e) => <li key={e} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{e}</li>)}
            </ul>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <p className="font-display text-xl font-bold text-gray-900">{catalog.software.price}</p>
          <button type="button" onClick={() => setOpen(SOFTWARE)}
            className="inline-flex h-11 items-center rounded-xl border border-gray-300 bg-white px-5 font-semibold text-gray-900 transition-colors hover:border-primary hover:text-primary">
            Décrire mon besoin
          </button>
        </div>
      </section>

      {open !== null && (
        <Questionnaire page={page} project={open} onClose={() => setOpen(null)} onSent={() => setSentAt(new Date().toISOString())} />
      )}
    </div>
  );
}

function PackCard({ pack, onChoose }: { pack: SitePack; onChoose: () => void }) {
  const dark = pack.featured;
  return (
    <article className={cn('relative flex flex-col rounded-3xl p-6',
      dark ? 'bg-forest text-white shadow-xl lg:-my-2 lg:py-8 order-first lg:order-none' : 'border border-gray-200 bg-white')}>
      {dark && <span className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Le plus demandé</span>}
      <h3 className={cn('font-display text-xl font-bold', dark ? 'text-white' : 'text-gray-900')}>{pack.name}</h3>
      <p className={cn('mt-2 font-display text-[32px] font-bold leading-none', dark ? 'text-white' : 'text-primary')}>{pack.price}</p>
      {pack.pitch && <p className={cn('mt-3 text-[15px] leading-relaxed', dark ? 'text-white/75' : 'text-gray-600')}>{pack.pitch}</p>}
      <ul className="mt-4 flex-1 space-y-2">
        {pack.features.map((f) => (
          <li key={f} className={cn('flex gap-2.5 text-[15px]', dark ? 'text-white/90' : 'text-gray-700')}>
            <Check className={cn('mt-0.5 h-4 w-4 flex-shrink-0', dark ? 'text-[#9fc3a6]' : 'text-sage')} />{f}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onChoose}
        className={cn('mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 font-semibold transition-colors',
          dark ? 'bg-primary text-white hover:bg-primary-dark' : 'border border-gray-300 text-gray-900 hover:border-primary hover:text-primary')}>
        {pack.price === 'Sur devis' ? 'Parler de mon projet' : `Choisir ${pack.name}`}
      </button>
    </article>
  );
}
