'use client';

// Le livre : les pages tournent comme celles d'un vrai livre. Double page sur un écran large (couverture seule à
// droite, puis les pages deux par deux), une page à la fois sur téléphone. Flèches du clavier, glisser du doigt,
// boutons. Sans animation si le système demande moins de mouvement. Aucune dépendance : CSS 3D.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TURN_MS = 650;
const RATIO = 297 / 210;

type Turn = { dir: 1 | -1; to: number } | null;

function useBookSize(double: boolean, reserved: number) {
  const [size, setSize] = useState({ w: 320, double: false });
  useEffect(() => {
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isDouble = double && vw >= 900;
      const byWidth = isDouble ? (vw - 120) / 2 : vw - 32;
      const byHeight = (vh - reserved) / RATIO;
      setSize({ w: Math.max(200, Math.floor(Math.min(byWidth, byHeight, isDouble ? 560 : 520))), double: isDouble });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [double, reserved]);
  return size;
}

export function Flipbook({ pages, ariaLabel, labels = { prev: 'Page précédente', next: 'Page suivante' }, reserved = 120, allowDouble = true, onPageChange }: {
  pages: ReactNode[];
  ariaLabel: string;
  /** Pages visibles (index) après chaque tour, et au premier affichage. */
  onPageChange?: (visible: number[]) => void;
  labels?: { prev: string; next: string };
  /** Hauteur à laisser libre autour du livre (en-tête, boutons), en pixels. */
  reserved?: number;
  allowDouble?: boolean;
}) {
  const { w, double } = useBookSize(allowDouble, reserved);
  const h = Math.round(w * RATIO);
  // Position : en double page, l'index de la page de droite (0 : couverture seule) ; sinon la page affichée.
  const [at, setAt] = useState(0);
  const [turn, setTurn] = useState<Turn>(null);
  const reduced = useRef(false);
  useEffect(() => { reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }, []);

  const step = double ? 2 : 1;
  const last = pages.length - 1;
  // En double page, la position est toujours paire (0, 2, 4…) : la page de droite.
  const clampAt = useCallback((i: number) => {
    const max = double ? last + (last % 2 === 0 ? 0 : 1) : last;
    const v = Math.max(0, Math.min(max, i));
    return double ? v - (v % 2) : v;
  }, [double, last]);
  useEffect(() => { setAt((a) => clampAt(a)); }, [clampAt]);
  const onChange = useRef(onPageChange);
  onChange.current = onPageChange;
  useEffect(() => {
    onChange.current?.(double ? [at - 1, at].filter((i) => i >= 0 && i <= last) : [at]);
  }, [at, double, last]);

  const go = useCallback((dir: 1 | -1) => {
    if (turn) return;
    const to = clampAt(at + dir * step);
    if (to === at) return;
    if (reduced.current) { setAt(to); return; }
    setTurn({ dir, to });
    window.setTimeout(() => { setAt(to); setTurn(null); }, TURN_MS);
  }, [at, step, clampAt, turn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const startX = useRef<number | null>(null);
  const page = (i: number) => (i >= 0 && i <= last ? pages[i] : null);
  const sheet = (content: ReactNode, side: 'left' | 'right' | 'single') => (
    <div className="wb-sheet absolute inset-0 overflow-hidden bg-[#FBF7F0]" style={{
      boxShadow: side === 'left' ? 'inset -14px 0 18px -16px rgba(0,0,0,.45)' : side === 'right' ? 'inset 14px 0 18px -16px rgba(0,0,0,.45)' : undefined,
      containerType: 'inline-size',
    }}>{content}</div>
  );

  // Pages posées sous la page qui tourne : celles de la destination, visibles à mesure que la page tourne.
  const leftIndex = (pos: number) => pos - 1;
  const base = turn && double
    ? (turn.dir === 1 ? { left: leftIndex(at), right: turn.to } : { left: leftIndex(turn.to), right: at })
    : turn && !double
      ? (turn.dir === 1 ? { single: turn.to } : { single: at })
      : double ? { left: leftIndex(at), right: at } : { single: at };

  const counter = double
    ? (at === 0 ? `1 / ${pages.length}` : `${at}–${Math.min(at + 1, pages.length)} / ${pages.length}`)
    : `${at + 1} / ${pages.length}`;

  return (
    <div className="flex flex-col items-center gap-4 select-none" role="region" aria-roledescription="livre" aria-label={ariaLabel}>
      <style>{`
        .wb-sheet { font-family: Georgia, "Times New Roman", serif; }
        .wb-sheet h1, .wb-sheet h2, .wb-sheet h3 { font-family: inherit; letter-spacing: normal; }
        @keyframes wb-turn-next { from { transform: rotateY(0deg); } to { transform: rotateY(-180deg); } }
        @keyframes wb-turn-prev { from { transform: rotateY(0deg); } to { transform: rotateY(180deg); } }
        @keyframes wb-lift { from { transform: rotateY(0deg); opacity: 1; } to { transform: rotateY(-100deg); opacity: .2; } }
        @keyframes wb-drop { from { transform: rotateY(-100deg); opacity: .2; } to { transform: rotateY(0deg); opacity: 1; } }
      `}</style>
      <div
        className="relative"
        style={{ width: double ? w * 2 : w, height: h, perspective: 2200 }}
        onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (startX.current == null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        {double ? (
          <>
            <div className="absolute top-0 left-0 shadow-xl" style={{ width: w, height: h, visibility: page('left' in base ? base.left! : -1) ? 'visible' : 'hidden' }}>
              {sheet(page('left' in base ? base.left! : -1), 'left')}
            </div>
            <div className="absolute top-0 shadow-xl" style={{ left: w, width: w, height: h, visibility: page('right' in base ? base.right! : -1) ? 'visible' : 'hidden' }}>
              {sheet(page('right' in base ? base.right! : -1), 'right')}
            </div>
            {turn && (
              <div className="absolute top-0" style={{
                left: turn.dir === 1 ? w : 0, width: w, height: h, transformStyle: 'preserve-3d',
                transformOrigin: turn.dir === 1 ? 'left center' : 'right center',
                animation: `${turn.dir === 1 ? 'wb-turn-next' : 'wb-turn-prev'} ${TURN_MS}ms ease-in-out forwards`,
              }}>
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
                  {sheet(page(turn.dir === 1 ? at : leftIndex(at)), turn.dir === 1 ? 'right' : 'left')}
                </div>
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  {sheet(page(turn.dir === 1 ? leftIndex(turn.to) : turn.to), turn.dir === 1 ? 'left' : 'right')}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="absolute inset-0 shadow-xl">{sheet(page('single' in base ? base.single! : at), 'single')}</div>
            {turn && (
              <div className="absolute inset-0 shadow-2xl" style={{
                transformOrigin: 'left center',
                animation: `${turn.dir === 1 ? 'wb-lift' : 'wb-drop'} ${TURN_MS}ms ease-in-out forwards`,
              }}>
                {sheet(page(turn.dir === 1 ? at : turn.to), 'single')}
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm text-[#5b5b55]">
        <button type="button" onClick={() => go(-1)} disabled={at === 0} aria-label={labels.prev}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 disabled:opacity-30">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="tabular-nums" aria-live="polite">{counter}</span>
        <button type="button" onClick={() => go(1)} disabled={clampAt(at + step) === at} aria-label={labels.next}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 disabled:opacity-30">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
