'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { hiddenRoutes } from '@/lib/modules';
import { actionPath, NAV_MEGA, type NavPreviewKey } from '@/lib/navMega';
import { guidesForPage, openHelp } from '@/lib/help';
import { NAV_ACTION_EVENT, type NavActionDetail } from '@/lib/useUrlAction';
import { getNavPreview, type NavPreview, type NavPreviewTone } from '@/server/navPreview';
import type { NavItem } from './nav';

// Mégamenu de la barre latérale : au survol d'une entrée (ou flèche droite, ou appui long sur écran tactile),
// un panneau s'ouvre à droite de la barre : ce que fait la page, des actions rapides, l'aide de la page et,
// pour certaines pages, un aperçu vivant. Le contenu vient de lib/navMega.ts.

const OPEN_DELAY = 150;
const CLOSE_DELAY = 250;
/** Le pointeur file vers le panneau en passant sur une autre entrée : on attend avant de changer. */
const AIM_DELAY = 280;
const LONG_PRESS = 450;
const PANEL_WIDTH = 600;
const PREVIEW_TTL = 45_000;

type Point = { x: number; y: number };

// Aperçus gardés quelques dizaines de secondes, pour tout le monde dans l'onglet.
const previewCache = new Map<NavPreviewKey, { at: number; data: NavPreview | null }>();

function inTriangle(p: Point, a: Point, b: Point, c: Point) {
  const side = (p1: Point, p2: Point, p3: Point) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = side(p, a, b), d2 = side(p, b, c), d3 = side(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

const focusables = (root: HTMLElement | null) =>
  Array.from(root?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);

interface OpenState {
  item: NavItem;
  anchor: HTMLElement;
  /** Ouvert au clavier : le focus passe dans le panneau. */
  focus: boolean;
}

/** État du mégamenu et propriétés à poser sur chaque entrée de la barre latérale. */
export function useSidebarMega() {
  const [state, setState] = useState<OpenState | null>(null);
  const stateRef = useRef<OpenState | null>(null);
  stateRef.current = state;
  const panelRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressStart = useRef<Point | null>(null);
  const longPressed = useRef(false);
  const moves = useRef<Point[]>([]);
  const pathname = usePathname();

  const clearTimers = () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current); };
  const close = useCallback((restoreFocus = false) => {
    clearTimeout(openTimer.current); clearTimeout(closeTimer.current);
    const current = stateRef.current;
    setState(null);
    if (restoreFocus) current?.anchor.focus();
  }, []);
  const show = useCallback((item: NavItem, anchor: HTMLElement, focus = false) => {
    clearTimers();
    if (!NAV_MEGA[item.href]) return;
    setState({ item, anchor, focus });
  }, []);
  const cancelClose = useCallback(() => { clearTimeout(closeTimer.current); clearTimeout(openTimer.current); }, []);
  const scheduleClose = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setState(null), CLOSE_DELAY);
  }, []);

  // Le pointeur file-t-il vers le panneau ? (triangle entre sa position d'avant et le bord gauche du panneau)
  const aimingAtPanel = (to: Point) => {
    const rect = panelRef.current?.getBoundingClientRect();
    const from = moves.current[0];
    if (!rect || !from || to.x <= from.x) return false;
    return inTriangle(to, from, { x: rect.left, y: rect.top - 20 }, { x: rect.left, y: rect.bottom + 20 });
  };

  // Les dernières positions du pointeur, pour connaître sa direction.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      moves.current.push({ x: e.clientX, y: e.clientY });
      if (moves.current.length > 4) moves.current.shift();
    };
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    if (!state) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || stateRef.current?.anchor.contains(t)) return;
      close();
    };
    const onResize = () => close();
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', onResize);
    };
  }, [state, close]);

  // Changement de page : le panneau se referme.
  useEffect(() => { close(); }, [pathname, close]);
  useEffect(() => () => { clearTimers(); clearTimeout(pressTimer.current); }, []);

  /** Propriétés d'une entrée de menu (lien). */
  const itemProps = (item: NavItem) => {
    const has = !!NAV_MEGA[item.href];
    const isOpen = state?.item.href === item.href;
    return {
      'aria-label': item.label,
      'aria-haspopup': has ? ('dialog' as const) : undefined,
      'aria-expanded': has ? isOpen : undefined,
      'aria-controls': has && isOpen ? 'sb-mega' : undefined,
      'aria-keyshortcuts': has ? 'ArrowRight' : undefined,
      'data-mega': has ? item.href : undefined,
      style: { WebkitTouchCallout: 'none' } as React.CSSProperties,
      onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType !== 'mouse' || !has) return;
        const anchor = e.currentTarget;
        clearTimeout(closeTimer.current);
        clearTimeout(openTimer.current);
        const current = stateRef.current;
        if (current?.item.href === item.href) return;
        // Panneau déjà ouvert : on change tout de suite, sauf si le pointeur traverse vers le panneau.
        const delay = !current ? OPEN_DELAY : aimingAtPanel({ x: e.clientX, y: e.clientY }) ? AIM_DELAY : 0;
        openTimer.current = setTimeout(() => show(item, anchor), delay);
      },
      onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType !== 'mouse') return;
        clearTimeout(openTimer.current);
        if (stateRef.current) scheduleClose();
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        if (!has) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); show(item, e.currentTarget, true); }
        else if (e.key === 'Escape' && stateRef.current) { e.preventDefault(); close(true); }
      },
      // Écran tactile : un appui long ouvre le panneau, un appui simple garde la navigation.
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' || !has) return;
        longPressed.current = false;
        pressStart.current = { x: e.clientX, y: e.clientY };
        const anchor = e.currentTarget;
        clearTimeout(pressTimer.current);
        pressTimer.current = setTimeout(() => { longPressed.current = true; show(item, anchor); }, LONG_PRESS);
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' || !pressStart.current) return;
        if (Math.hypot(e.clientX - pressStart.current.x, e.clientY - pressStart.current.y) > 10) clearTimeout(pressTimer.current);
      },
      onPointerUp: () => { clearTimeout(pressTimer.current); pressStart.current = null; },
      onPointerCancel: () => { clearTimeout(pressTimer.current); pressStart.current = null; },
      onContextMenu: (e: React.MouseEvent) => { if (longPressed.current) e.preventDefault(); },
      onClick: (e: React.MouseEvent) => {
        if (longPressed.current) { e.preventDefault(); longPressed.current = false; return; }
        if (stateRef.current) close();
      },
    };
  };

  const panel = state ? (
    <MegaPanel
      key={state.item.href}
      state={state}
      panelRef={panelRef}
      onEnter={cancelClose}
      onLeave={scheduleClose}
      onClose={close}
    />
  ) : null;

  return { itemProps, panel, close, openHref: state?.item.href ?? null };
}

function MegaPanel({ state, panelRef, onEnter, onLeave, onClose }: {
  state: OpenState;
  panelRef: React.RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
  onClose: (restoreFocus?: boolean) => void;
}) {
  const { item, anchor } = state;
  const entry = NAV_MEGA[item.href];
  const { profile } = useAuth();
  const pathname = usePathname();
  const [pos, setPos] = useState<{ left: number; top: number; width: number; height: number; caret: number; anchorRight: number; anchorTop: number; anchorBottom: number } | null>(null);
  const hidden = useMemo(() => hiddenRoutes(profile?.modules), [profile?.modules]);
  const actions = entry.actions.filter((a) => !hidden.includes(actionPath(a.href)));
  const guides = useMemo(() => guidesForPage(item.href), [item.href]);
  const preview = usePreview(entry.preview);

  // Position : à droite de la barre, aligné sur l'entrée, sans sortir de l'écran.
  const place = useCallback(() => {
    const el = panelRef.current;
    const bar = anchor.closest('aside')?.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    if (!el || !bar) return;
    const left = bar.right + 10;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - left - 16);
    const h = el.offsetHeight;
    const top = Math.max(8, Math.min(a.top - 14, window.innerHeight - h - 8));
    const caret = Math.max(16, Math.min(a.top + a.height / 2 - top, h - 16));
    setPos((p) => (p && p.left === left && p.top === top && p.width === width && p.height === h && p.caret === caret ? p : {
      left, top, width, height: h, caret, anchorRight: a.right, anchorTop: a.top, anchorBottom: a.bottom,
    }));
  }, [anchor, panelRef]);

  useLayoutEffect(() => {
    place();
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [place, panelRef]);

  // Ouvert au clavier : le focus va sur la première action, une fois le panneau placé (donc visible).
  const focused = useRef(false);
  useEffect(() => {
    if (!state.focus || !pos || focused.current) return;
    focused.current = true;
    focusables(panelRef.current)[1]?.focus();
  }, [state.focus, pos, panelRef]);

  // La barre défile : le panneau ne suit pas l'entrée, il se ferme.
  useEffect(() => {
    const nav = anchor.closest('nav');
    const onScroll = () => onClose();
    nav?.addEventListener('scroll', onScroll, { passive: true });
    return () => nav?.removeEventListener('scroll', onScroll);
  }, [anchor, onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = focusables(panelRef.current);
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape' || e.key === 'ArrowLeft') { e.preventDefault(); onClose(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === 'Tab' && ((e.shiftKey && i <= 0) || (!e.shiftKey && i === list.length - 1))) {
      // On sort du panneau : retour dans la barre, à l'entrée suivante (ou sur l'entrée elle-même).
      e.preventDefault();
      const nav = focusables(anchor.closest('nav') as HTMLElement | null);
      const next = e.shiftKey ? anchor : nav[nav.indexOf(anchor) + 1] ?? anchor;
      onClose();
      next.focus();
    }
  };

  // Action vers la page déjà ouverte : elle reçoit l'action sans recharger l'adresse.
  const onAction = (e: React.MouseEvent, href: string) => {
    const path = actionPath(href);
    const action = new URLSearchParams(href.split('?')[1] ?? '').get('action');
    if (action && path === pathname) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent<NavActionDetail>(NAV_ACTION_EVENT, { detail: { path, action } }));
    }
    onClose();
  };

  const help = () => {
    onClose();
    openHelp(guides.length > 0 ? { page: item.href } : {});
  };

  const twoCols = !!entry.preview && preview.state !== 'none';

  return createPortal(
    <>
      {/* Pont invisible entre l'entrée et le panneau : le pointeur traverse sans que rien ne se ferme. */}
      {pos && (
        <div
          aria-hidden
          data-mega-bridge
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          className="fixed z-40"
          style={{
            left: pos.anchorRight, width: Math.max(0, pos.left - pos.anchorRight),
            top: Math.min(pos.anchorTop, pos.top), height: Math.max(pos.anchorBottom, pos.top + pos.height) - Math.min(pos.anchorTop, pos.top),
          }}
        />
      )}
      <div
        ref={panelRef}
        id="sb-mega"
        role="dialog"
        aria-label={`${item.label} : raccourcis`}
        data-sidebar-mega={item.href}
        onPointerEnter={onEnter}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') onLeave(); }}
        onKeyDown={onKeyDown}
        className={cn(
          'fixed z-40 rounded-2xl bg-white border border-gray-200 shadow-float',
          'animate-sb-mega-in',
          !pos && 'invisible',
        )}
        style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.width ?? PANEL_WIDTH }}
      >
        {/* Repère pointant vers l'entrée. */}
        {pos && (
          <span aria-hidden className="absolute -left-[7px] w-3 h-3 rotate-45 bg-white border-l border-b border-gray-200" style={{ top: pos.caret - 6 }} />
        )}

        {/* Le défilement est à l'intérieur, pour que le repère ne soit pas rogné. */}
        <div className="max-h-[calc(100dvh-18px)] overflow-y-auto rounded-2xl">
        <div className="flex items-start gap-4 px-5 pt-4 pb-3">
          <div className="flex-1 min-w-0">
            <p className="font-display text-xl font-bold text-gray-900 leading-tight">{item.label}</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{entry.summary}</p>
          </div>
          <Link
            href={item.href}
            onClick={() => onClose()}
            className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 -mr-1 rounded-xl text-sm font-medium text-primary hover:bg-primary-50 transition-colors"
          >
            Ouvrir<ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className={cn('px-3 pb-3', twoCols && 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3')}>
          {actions.length > 0 && (
            <ul aria-label="Actions rapides" className={cn(!twoCols && 'grid grid-cols-2 gap-x-1')}>
              {actions.map((a) => (
                <li key={a.href + a.label}>
                  <Link
                    href={a.href}
                    onClick={(e) => onAction(e, a.href)}
                    className="group flex items-start gap-3 px-2.5 py-2 rounded-xl hover:bg-gray-50 focus-visible:bg-gray-50 transition-colors"
                  >
                    <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary-50 text-primary flex items-center justify-center">
                      <a.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="block text-[15px] font-medium text-gray-900 leading-snug group-hover:text-primary transition-colors">{a.label}</span>
                      {a.hint && <span className="block text-[13px] text-gray-500 leading-snug mt-0.5">{a.hint}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {twoCols && <PreviewBlock preview={preview} onNavigate={() => onClose()} />}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
          <button onClick={help} className="inline-flex items-center gap-2 -ml-1 h-9 px-1 rounded-lg text-sm font-medium text-gray-800 hover:text-primary transition-colors">
            <CircleHelp className="h-4 w-4 text-gray-500" strokeWidth={1.8} />
            {guides.length > 0 ? 'Aide sur cette page' : 'Ouvrir l’aide'}
            {guides.length > 0 && <span className="text-gray-500 font-normal">{guides.length} guide{guides.length > 1 ? 's' : ''}</span>}
          </button>
          {entry.shortcut && (
            <p className="ml-auto flex items-center gap-2 text-[13px] text-gray-500">
              {entry.shortcut.label}
              <span className="flex items-center gap-1">
                {entry.shortcut.keys.map((k) => (
                  <kbd key={k} className="min-w-6 h-6 px-1.5 inline-flex items-center justify-center rounded-md bg-white border border-gray-200 text-[12px] font-sans font-medium text-gray-700">{k}</kbd>
                ))}
              </span>
            </p>
          )}
        </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

type PreviewState =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'ready'; data: NavPreview };

/** Aperçu vivant : chargé à l'ouverture, gardé PREVIEW_TTL ; en cas d'échec, le bloc disparaît. */
function usePreview(key: NavPreviewKey | undefined): PreviewState {
  const cached = key ? previewCache.get(key) : undefined;
  const fresh = cached && Date.now() - cached.at < PREVIEW_TTL;
  const [result, setResult] = useState<PreviewState>(() =>
    !key ? { state: 'none' } : fresh ? (cached!.data ? { state: 'ready', data: cached!.data } : { state: 'none' }) : { state: 'loading' });

  useEffect(() => {
    if (!key || fresh) return;
    let alive = true;
    getNavPreview(key, new Date().toLocaleDateString('sv-SE'))
      .then((data) => {
        previewCache.set(key, { at: Date.now(), data });
        if (alive) setResult(data ? { state: 'ready', data } : { state: 'none' });
      })
      .catch(() => { if (alive) setResult({ state: 'none' }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return result;
}

const toneCls: Record<NavPreviewTone, string> = {
  ok: 'bg-sage-100 text-sage',
  warn: 'bg-primary-50 text-primary-800',
  muted: 'bg-gray-100 text-gray-600',
};

function PreviewBlock({ preview, onNavigate }: { preview: PreviewState; onNavigate: () => void }) {
  if (preview.state === 'none') return null;
  if (preview.state === 'loading') {
    return (
      <div aria-busy="true" aria-label="Chargement de l’aperçu" className="self-start rounded-xl bg-page/70 p-3.5 animate-pulse">
        <div className="h-3.5 w-28 rounded bg-gray-200" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="space-y-1.5"><div className="h-3.5 w-3/4 rounded bg-gray-200" /><div className="h-3 w-1/2 rounded bg-gray-200/70" /></div>)}
        </div>
      </div>
    );
  }
  const { data } = preview;
  return (
    <section aria-label={data.title} data-mega-preview className="self-start rounded-xl bg-page/70 p-3.5 min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">{data.title}</p>
      </div>
      {data.items.length === 0 ? (
        <p className="text-sm text-gray-500 mt-2">{data.empty}</p>
      ) : (
        <ul className="mt-1.5 -mx-1.5">
          {data.items.map((it) => (
            <li key={it.id}>
              <Link href={it.href} onClick={onNavigate} className="block px-1.5 py-1.5 rounded-lg hover:bg-white transition-colors">
                <span className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900">{it.label}</span>
                  {it.tag && <span className={cn('flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap', toneCls[it.tag.tone])}>{it.tag.text}</span>}
                </span>
                {it.detail && <span className="block truncate text-[13px] text-gray-500 mt-0.5">{it.detail}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data.stats.length > 0 && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 pt-2.5 border-t border-gray-200/80 text-sm text-gray-600">
          {data.stats.map((s) => {
            const body = <><span className={cn('font-display font-bold tabular-nums', s.tone === 'warn' ? 'text-primary' : 'text-gray-900')}>{s.value}</span> {s.label}</>;
            return s.href
              ? <Link key={s.label} href={s.href} onClick={onNavigate} className="hover:text-gray-900 transition-colors">{body}</Link>
              : <span key={s.label}>{body}</span>;
          })}
        </p>
      )}
    </section>
  );
}
