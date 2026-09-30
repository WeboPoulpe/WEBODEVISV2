'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes, Briefcase, CalendarDays, CalendarRange, ChefHat, ChevronDown, FileText, Heart, Inbox, ListChecks, Menu,
  Scale, ShoppingBasket, Smartphone, TrendingUp, UserCheck, Users, X, type LucideIcon,
} from 'lucide-react';
import Wordmark from '@/components/brand/Wordmark';
import type { SiteLink, SiteMenuEntry } from '@/lib/site/pages';
import { cn } from '@/lib/utils';

// L'en-tête du site et son mégamenu : le seul composant client du site avec le formulaire de contact.
// Tous les liens sont rendus par le serveur (présents dans le HTML) ; le script ouvre, ferme et suit le défilement.
//
// Ordinateur : un panneau large par entrée (liens à gauche, encart vert à droite), ouvert au survol ou au clic,
// fléché au clavier. Téléphone : un menu plein écran, trois groupes repliables, deux actions fixes en bas.

const ICONS: Record<string, LucideIcon> = {
  inbox: Inbox,
  'file-text': FileText,
  users: Users,
  'calendar-range': CalendarRange,
  'shopping-basket': ShoppingBasket,
  'user-check': UserCheck,
  boxes: Boxes,
  'calendar-days': CalendarDays,
  'trending-up': TrendingUp,
  smartphone: Smartphone,
  heart: Heart,
  briefcase: Briefcase,
  'chef-hat': ChefHat,
  scale: Scale,
  'list-checks': ListChecks,
};

/** Délais d'intention : on n'ouvre pas au simple passage de la souris, on ne ferme pas au premier écart. */
const OPEN_DELAY = 120;
const CLOSE_DELAY = 200;

const nbsp = (text: string) => text.replace(/ ([?!:;])/g, ' $1');

interface SiteNavProps {
  entries: SiteMenuEntry[];
  /** Liens directs, sans panneau (Nouveautés, Contact). */
  links: SiteLink[];
  demo: SiteLink;
  login: SiteLink;
  /** Présent seulement quand les inscriptions sont ouvertes. */
  signup?: SiteLink;
  /** Encart de droite de chaque panneau (rendu par le serveur), par identifiant d'entrée. */
  asides: Record<string, React.ReactNode>;
}

/** Un lien du menu : pastille d'icône, titre, ligne de description. */
function MenuItem({ link, current, block = false }: { link: SiteLink; current: boolean; block?: boolean }) {
  const Icon = ICONS[link.icon ?? ''] ?? FileText;
  return (
    <Link
      href={link.href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'group flex items-start gap-3.5 min-h-[56px] py-2.5 rounded-2xl transition-colors',
        block ? 'lg:flex-col lg:gap-4 lg:h-full lg:p-5 lg:bg-gray-50 lg:hover:bg-gray-100' : 'lg:-mx-2.5 lg:px-2.5 lg:hover:bg-gray-50',
      )}
    >
      <span className={cn('flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 text-white lg:text-forest', block ? 'lg:bg-white lg:border lg:border-gray-200' : 'lg:bg-page')}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className={cn('block text-base font-semibold leading-snug text-white lg:text-gray-900', block ? 'lg:font-display lg:text-[19px] lg:tracking-[-0.01em]' : 'lg:text-[15px]')}>{link.label}</span>
        {link.blurb && <span className={cn('block mt-0.5 text-sm leading-snug text-white/55 lg:text-gray-600', block && 'lg:mt-1.5 lg:text-[15px] lg:leading-relaxed')}>{nbsp(link.blurb)}</span>}
        {link.meta && <span className="block mt-1 text-[13px] text-white/45 lg:text-gray-500">{link.meta}</span>}
      </span>
    </Link>
  );
}

export default function SiteNav({ entries, links, demo, login, signup, asides }: SiteNavProps) {
  const pathname = usePathname();
  const sectionOf = useCallback(
    (path: string) => entries.find((e) => path === e.prefix || path.startsWith(`${e.prefix}/`))?.id ?? null,
    [entries],
  );

  // Ordinateur : l'entrée dont le panneau est ouvert. `fresh` : il vient de s'ouvrir (et non de changer de contenu).
  const [panel, setPanel] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  // Téléphone : menu plein écran, et le groupe déplié (celui de la page en cours au départ).
  const [mobileOpen, setMobileOpen] = useState(false);
  const [section, setSection] = useState<string | null>(() => sectionOf(pathname));
  // Défilement : l'en-tête se détache du haut de page, puis l'ouverture de la page sort de l'écran.
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelRef = useRef<string | null>(null);
  const openedBy = useRef<'hover' | 'click'>('click');
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusInPanel = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);
  const openPanel = useCallback((id: string, by: 'hover' | 'click') => {
    // Passer d'une entrée à l'autre change le contenu sans rejouer l'apparition.
    setFresh(panelRef.current === null);
    panelRef.current = id;
    openedBy.current = by;
    setPanel(id);
  }, []);
  const closePanel = useCallback(() => {
    panelRef.current = null;
    setPanel(null);
  }, []);

  // Changer de page referme tout, et déplie le groupe de la nouvelle page.
  useEffect(() => {
    clearTimers();
    closePanel();
    setMobileOpen(false);
    setSection(sectionOf(pathname));
  }, [pathname, clearTimers, closePanel, sectionOf]);

  // Échap et clic en dehors : on ferme, et le focus revient au bouton qui avait ouvert.
  useEffect(() => {
    if (!panel && !mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (mobileOpen) { setMobileOpen(false); burgerRef.current?.focus(); }
      if (panel) { triggerRefs.current[panel]?.focus(); clearTimers(); closePanel(); }
    };
    const onPointer = (e: MouseEvent) => {
      if (panel && rootRef.current && !rootRef.current.contains(e.target as Node)) { clearTimers(); closePanel(); }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onPointer); };
  }, [panel, mobileOpen, clearTimers, closePanel]);

  // Flèche bas sur une entrée : le focus entre dans son panneau une fois celui-ci affiché.
  useEffect(() => {
    if (!panel || focusInPanel.current !== panel) return;
    focusInPanel.current = null;
    document.getElementById(`menu-${panel}`)?.querySelector<HTMLElement>('a[href]')?.focus();
  }, [panel]);

  // Menu plein écran : la page derrière ne défile plus.
  useEffect(() => {
    if (!mobileOpen) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = previous; };
  }, [mobileOpen]);

  // Si la fenêtre s'élargit menu ouvert, on revient à l'en-tête d'ordinateur (et inversement).
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const onChange = () => { if (wide.matches) setMobileOpen(false); else closePanel(); };
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, [closePanel]);

  // L'en-tête reste en haut : il se détache dès qu'on défile…
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // … et « Essayer la démo » n'y apparaît qu'une fois l'ouverture de la page sortie de l'écran, et seulement
  // tant qu'aucun autre bouton « Essayer la démo » de la page n'est visible : jamais deux à l'écran.
  useEffect(() => {
    const hero = document.querySelector('#contenu section');
    if (!hero) { setPastHero(false); return; }
    const root = rootRef.current;
    const buttons = [...document.querySelectorAll('[data-demo-cta]')].filter((el) => !root?.contains(el));
    const onScreen = new Set<Element>();
    let heroOnScreen = true;
    const observer = new IntersectionObserver((records) => {
      for (const record of records) {
        if (record.target === hero) heroOnScreen = record.isIntersecting;
        else if (record.isIntersecting) onScreen.add(record.target);
        else onScreen.delete(record.target);
      }
      setPastHero(!heroOnScreen && onScreen.size === 0);
    }, { rootMargin: '-88px 0px 0px 0px' });
    observer.observe(hero);
    buttons.forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => clearTimers, [clearTimers]);

  // Survol (souris seulement, grand écran) : ouverture et fermeture avec un court délai.
  const canHover = () => window.matchMedia('(hover: hover) and (min-width: 1024px)').matches;
  const hoverEntry = (id: string) => {
    if (!canHover()) return;
    clearTimers();
    if (panelRef.current === id) return;
    openTimer.current = setTimeout(() => openPanel(id, 'hover'), OPEN_DELAY);
  };
  const leaveRoot = () => {
    if (!canHover()) return;
    clearTimers();
    if (panelRef.current) closeTimer.current = setTimeout(closePanel, CLOSE_DELAY);
  };
  const clickEntry = (id: string) => {
    clearTimers();
    if (panelRef.current === id && openedBy.current === 'click') closePanel();
    else openPanel(id, 'click');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const root = rootRef.current;
    if (!root) return;
    const target = e.target as HTMLElement;

    // Menu plein écran : la tabulation tourne à l'intérieur de l'en-tête.
    if (mobileOpen && e.key === 'Tab') {
      const items = [...root.querySelectorAll<HTMLElement>('a[href], button')].filter((el) => el.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }

    // Ordinateur : flèches gauche et droite entre les entrées, flèche bas pour entrer dans le panneau.
    if (!target.matches('[data-top]')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const tops = [...root.querySelectorAll<HTMLElement>('[data-top]')].filter((el) => el.offsetParent !== null);
      const next = tops[(tops.indexOf(target) + (e.key === 'ArrowRight' ? 1 : -1) + tops.length) % tops.length];
      e.preventDefault();
      next.focus();
      if (panelRef.current) {
        const id = next.dataset.entry;
        clearTimers();
        if (id) openPanel(id, 'click'); else closePanel();
      }
    } else if (e.key === 'ArrowDown' && target.dataset.entry) {
      e.preventDefault();
      const id = target.dataset.entry;
      if (panelRef.current === id) document.getElementById(`menu-${id}`)?.querySelector<HTMLElement>('a[href]')?.focus();
      else { focusInPanel.current = id; clearTimers(); openPanel(id, 'click'); }
    }
  };

  // Quitter l'en-tête au clavier referme le panneau.
  const onBlur = (e: React.FocusEvent) => {
    if (panelRef.current && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) { clearTimers(); closePanel(); }
  };

  const isCurrent = (href: string) => pathname === href;
  const topLink = 'items-center h-10 px-3.5 rounded-xl text-[15px] font-medium whitespace-nowrap transition-colors';
  const mobileTitle = 'font-display text-[26px] font-bold leading-none tracking-[-0.02em] text-white';

  return (
    <>
      {/* Ordinateur : la page derrière s'assombrit légèrement pendant qu'un panneau est ouvert. */}
      <div aria-hidden className={cn('hidden fixed inset-0 z-40 bg-gray-900/30', panel && 'lg:block')} />

      <div
        ref={rootRef}
        onMouseLeave={leaveRoot}
        onMouseEnter={() => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className={cn(
          'site-dark site-header sticky top-2 sm:top-2.5 z-50 mx-2 sm:mx-2.5 mt-2 sm:mt-2.5 bg-forest',
          scrolled && !mobileOpen ? 'rounded-[22px] shadow-float' : 'rounded-t-[28px]',
        )}
      >
        <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
          <header className="relative flex items-center gap-3 h-[64px] lg:h-[72px]">
            <Link href="/" aria-label="WeboDevis, accueil" className="relative z-20 rounded-lg">
              <Wordmark className="text-[25px] lg:text-[27px] text-white" />
            </Link>

            <nav
              id="menu-site"
              aria-label="Navigation du site"
              className={cn(
                mobileOpen ? 'fixed inset-0 z-10 flex flex-col bg-forest pt-[76px]' : 'hidden',
                'lg:static lg:z-auto lg:flex lg:flex-row lg:items-center lg:bg-transparent lg:p-0 lg:ml-auto',
              )}
            >
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-8 pb-6 lg:flex-none lg:overflow-visible lg:p-0">
                <ul className="lg:flex lg:items-center lg:gap-0.5">
                  {entries.map((entry) => {
                    const open = panel === entry.id;
                    const unfolded = section === entry.id;
                    const items = entry.columns.flatMap((c) => c.links);
                    return (
                      <li key={entry.id} className="border-b border-white/10 lg:border-0">
                        {/* Ordinateur : l'entrée ouvre son panneau */}
                        <button
                          ref={(el) => { triggerRefs.current[entry.id] = el; }}
                          type="button"
                          data-top
                          data-entry={entry.id}
                          aria-expanded={open}
                          aria-controls={`menu-${entry.id}`}
                          onClick={() => clickEntry(entry.id)}
                          onMouseEnter={() => hoverEntry(entry.id)}
                          className={cn('hidden lg:flex gap-1.5', topLink, open ? 'bg-white/10 text-white' : 'text-white/75 hover:text-white hover:bg-white/[0.06]')}
                        >
                          {entry.label}
                          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
                        </button>
                        {/* Téléphone : l'entrée déplie son groupe, un seul à la fois */}
                        <button
                          type="button"
                          aria-expanded={unfolded}
                          aria-controls={`menu-${entry.id}`}
                          onClick={() => setSection(unfolded ? null : entry.id)}
                          className={cn('lg:hidden w-full flex items-center justify-between gap-4 min-h-[68px] py-3 text-left', mobileTitle)}
                        >
                          {entry.label}
                          <ChevronDown className={cn('h-6 w-6 text-white/50 transition-transform', unfolded && 'rotate-180')} aria-hidden />
                        </button>

                        <div
                          id={`menu-${entry.id}`}
                          className={cn(
                            unfolded ? 'block' : 'hidden',
                            'site-light pb-5 lg:absolute lg:inset-x-0 lg:top-full lg:mt-2 lg:rounded-[28px] lg:bg-white lg:border lg:border-gray-200 lg:shadow-float lg:p-2.5 lg:max-h-[calc(100dvh-112px)] lg:overflow-y-auto',
                            open ? cn('lg:block', fresh && 'site-menu-in') : 'lg:hidden',
                          )}
                        >
                          <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-2.5">
                            {/* Les liens */}
                            <div className="flex flex-col lg:p-5 lg:pb-4">
                              {entry.layout === 'columns' && (
                                <div className="grid gap-x-8 gap-y-4 lg:grid-cols-3">
                                  {entry.columns.map((col) => (
                                    <div key={col.title}>
                                      <p className="mb-1 lg:mb-2 text-sm font-medium text-white/50 lg:text-gray-500">{col.title}</p>
                                      <ul>{col.links.map((l) => <li key={l.href}><MenuItem link={l} current={isCurrent(l.href)} /></li>)}</ul>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {entry.layout === 'blocks' && (
                                <ul className="grid lg:grid-cols-3 lg:gap-2.5 lg:h-full">
                                  {items.map((l) => <li key={l.href}><MenuItem link={l} current={isCurrent(l.href)} block /></li>)}
                                </ul>
                              )}
                              {entry.layout === 'list' && (
                                <ul className="grid gap-x-8 lg:grid-cols-2">
                                  {items.map((l) => <li key={l.href}><MenuItem link={l} current={isCurrent(l.href)} /></li>)}
                                </ul>
                              )}

                              {(entry.all || entry.note) && (
                                <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 mt-3 lg:mt-auto lg:pt-1 lg:border-t lg:border-gray-100">
                                  {entry.all && (
                                    <Link href={entry.all.href} className="inline-flex items-center min-h-[48px] lg:min-h-0 lg:mt-4 rounded text-[15px] font-semibold text-primary-300 lg:text-primary underline-offset-4 hover:underline">
                                      {entry.all.label}
                                    </Link>
                                  )}
                                  {entry.note && (
                                    <Link href={entry.note.href} className="hidden lg:inline-flex items-center gap-2 mt-4 rounded text-sm text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
                                      {entry.note.label}
                                    </Link>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* L'encart vert : un aperçu, une phrase, une action */}
                            <div className="site-dark hidden lg:block rounded-[20px] bg-forest text-white overflow-hidden">{asides[entry.id]}</div>
                          </div>
                        </div>
                      </li>
                    );
                  })}

                  {links.map((l) => (
                    <li key={l.href} className="border-b border-white/10 lg:border-0">
                      <Link
                        href={l.href}
                        data-top
                        aria-current={isCurrent(l.href) ? 'page' : undefined}
                        onMouseEnter={leaveRoot}
                        className={cn('flex items-center min-h-[68px] lg:min-h-0', mobileTitle,
                          'lg:h-10 lg:px-3.5 lg:rounded-xl lg:font-sans lg:text-[15px] lg:font-medium lg:leading-normal lg:tracking-normal lg:whitespace-nowrap lg:text-white/75 lg:hover:text-white lg:hover:bg-white/[0.06] transition-colors')}
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Téléphone : les deux actions, fixes en bas du menu */}
              <div className="lg:hidden flex gap-2.5 px-5 sm:px-8 pt-4 border-t border-white/10 bg-forest" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                <Link href={demo.href} className="flex-[1.4] flex items-center justify-center h-14 rounded-2xl bg-primary text-white text-base font-semibold">{demo.label}</Link>
                <Link href={login.href} className="flex-1 flex items-center justify-center h-14 rounded-2xl bg-white/10 text-white text-base font-semibold">{login.label}</Link>
              </div>
            </nav>

            <div className="relative z-20 ml-auto lg:ml-2 flex items-center gap-1.5">
              <Link href={login.href} className={cn('items-center h-11 px-3.5 lg:px-4 rounded-xl text-[15px] font-semibold text-white/85 hover:text-white hover:bg-white/[0.06] whitespace-nowrap transition-colors', mobileOpen ? 'hidden lg:flex' : 'flex')}>
                {login.label}
              </Link>
              {signup && (
                <Link href={signup.href} className="hidden lg:flex items-center h-11 px-4 rounded-xl text-[15px] font-semibold text-white/85 hover:text-white hover:bg-white/[0.06] whitespace-nowrap transition-colors">
                  {signup.label}
                </Link>
              )}
              {/* Visible seulement quand l'ouverture de la page, qui porte le même bouton, est sortie de l'écran,
                  et jamais pendant qu'un panneau est ouvert (celui des fonctionnalités a le sien). */}
              <Link
                href={demo.href}

                className={cn('site-header-demo items-center h-11 rounded-xl bg-primary text-white text-[15px] font-semibold hover:bg-primary-dark whitespace-nowrap',
                  pastHero && !panel && !mobileOpen ? 'hidden md:flex px-5' : 'hidden')}
              >
                {demo.label}
              </Link>
              <button
                ref={burgerRef}
                type="button"
                aria-expanded={mobileOpen}
                aria-controls="menu-site"
                aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                onClick={() => setMobileOpen((v) => !v)}
                className="lg:hidden flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 text-white"
              >
                {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
              </button>
            </div>
          </header>
        </div>
      </div>
    </>
  );
}
