'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { X, Search, ChevronLeft, BookOpen, Maximize2, Minus } from 'lucide-react';
import { HELP_ARTICLES, HELP_CATEGORIES, type HelpArticle, type HelpCategoryId } from '@/lib/help/articles';
import { cn } from '@/lib/utils';

interface HelpWidgetProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'webodevis_help_state';
const MIN_W = 380;
const MIN_H = 360;
const DEFAULT_W = 720;
const DEFAULT_H = 560;
const HEADER_H = 44;

interface Persisted {
  x: number;
  y: number;
  w: number;
  h: number;
  minimized: boolean;
}

function loadState(): Persisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch { return null; }
}

function saveState(s: Persisted) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export default function HelpWidget({ open, onClose }: HelpWidgetProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const [minimized, setMinimized] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Restore on first open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = loadState();
    if (saved) {
      setPos({ x: saved.x, y: saved.y });
      setSize({ w: saved.w, h: saved.h });
      setMinimized(saved.minimized);
    } else {
      // Default position: bottom-right with margin
      setPos({
        x: Math.max(20, window.innerWidth - DEFAULT_W - 24),
        y: Math.max(20, window.innerHeight - DEFAULT_H - 80),
      });
    }
    setHydrated(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    saveState({ ...pos, ...size, minimized });
  }, [pos, size, minimized, hydrated]);

  // Drag logic
  const dragging = useRef<{ ox: number; oy: number } | null>(null);
  const resizing = useRef<{ ox: number; oy: number; sw: number; sh: number } | null>(null);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y };
    e.preventDefault();
  };

  const onResizeMouseDown = (e: React.MouseEvent) => {
    resizing.current = { ox: e.clientX, oy: e.clientY, sw: size.w, sh: size.h };
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        const nx = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dragging.current.ox));
        const ny = Math.max(0, Math.min(window.innerHeight - HEADER_H, e.clientY - dragging.current.oy));
        setPos({ x: nx, y: ny });
      } else if (resizing.current) {
        const nw = Math.max(MIN_W, resizing.current.sw + (e.clientX - resizing.current.ox));
        const nh = Math.max(MIN_H, resizing.current.sh + (e.clientY - resizing.current.oy));
        setSize({
          w: Math.min(nw, window.innerWidth - pos.x - 8),
          h: Math.min(nh, window.innerHeight - pos.y - 8),
        });
      }
    };
    const onUp = () => { dragging.current = null; resizing.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [pos.x, pos.y]);

  // ── Search & navigation ──────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<HelpCategoryId | null>(null);
  const [openArticle, setOpenArticle] = useState<HelpArticle | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = HELP_ARTICLES;
    if (activeCat && !q) list = list.filter((a) => a.category === activeCat);
    if (q) {
      list = list.filter((a) => {
        const hay = (a.title + ' ' + a.description + ' ' + a.keywords.join(' ')).toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [query, activeCat]);

  // Reset deep navigation if widget closes
  useEffect(() => { if (!open) { setOpenArticle(null); } }, [open]);

  if (!open || !hydrated) return null;

  const effectiveH = minimized ? HEADER_H : size.h;

  return (
    <div
      className="fixed z-[60] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
      style={{
        left: pos.x, top: pos.y, width: size.w, height: effectiveH,
        boxShadow: '0 20px 60px -10px rgba(0,0,0,0.25), 0 8px 30px -5px rgba(0,0,0,0.15)',
      }}
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={onHeaderMouseDown}
        className="flex items-center gap-2 px-3 h-[44px] bg-gradient-to-r from-[#9c27b0] to-[#6a1b9a] text-white cursor-grab active:cursor-grabbing flex-shrink-0 select-none"
      >
        <BookOpen className="h-4 w-4" />
        <span className="text-sm font-semibold flex-1">Centre d&apos;aide</span>
        <button
          onClick={() => setMinimized((m) => !m)}
          className="p-1.5 hover:bg-white/15 rounded-md transition-colors"
          title={minimized ? 'Agrandir' : 'Réduire'}
        >
          {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/15 rounded-md transition-colors"
          title="Fermer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!minimized && (
        <>
          {openArticle ? (
            // ── ARTICLE VIEW ────────────────────────────────────────────────
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setOpenArticle(null)}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-[#9c27b0] transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />Retour
                </button>
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold ml-2">
                  {HELP_CATEGORIES.find((c) => c.id === openArticle.category)?.label}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <h2 className="text-lg font-bold text-gray-900 mb-1">{openArticle.title}</h2>
                <p className="text-xs text-gray-500 mb-4">{openArticle.description}</p>
                <div className="space-y-3">{openArticle.body}</div>
              </div>
            </div>
          ) : (
            // ── LIST VIEW ───────────────────────────────────────────────────
            <>
              {/* Search */}
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setActiveCat(null); }}
                    placeholder="Rechercher (créer un devis, stock, prospect...)"
                    className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                  />
                </div>
              </div>

              <div className="flex flex-1 min-h-0">
                {/* Categories sidebar */}
                <div className="w-44 flex-shrink-0 border-r border-gray-100 overflow-y-auto py-2">
                  <button
                    onClick={() => { setActiveCat(null); setQuery(''); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-medium transition-colors',
                      !activeCat && !query
                        ? 'bg-[#f3e5f5] text-[#9c27b0]'
                        : 'text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    Tous les articles ({HELP_ARTICLES.length})
                  </button>
                  {HELP_CATEGORIES.map((c) => {
                    const Icon = c.icon;
                    const count = HELP_ARTICLES.filter((a) => a.category === c.id).length;
                    const active = activeCat === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => { setActiveCat(c.id); setQuery(''); }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
                          active ? 'bg-[#f3e5f5] text-[#9c27b0] font-semibold' : 'text-gray-600 hover:bg-gray-50',
                        )}
                      >
                        <span className={cn('w-6 h-6 rounded-md bg-gradient-to-br flex items-center justify-center', c.gradient)}>
                          <Icon className="h-3 w-3 text-white" />
                        </span>
                        <span className="flex-1 truncate text-left">{c.label}</span>
                        <span className="text-[9px] text-gray-400 font-mono">{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Articles list */}
                <div className="flex-1 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6">
                      <Search className="h-8 w-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">Aucun article ne correspond.</p>
                      <p className="text-xs text-gray-400 mt-1">Essaie un autre mot-clé.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {filtered.map((a) => {
                        const cat = HELP_CATEGORIES.find((c) => c.id === a.category)!;
                        const Icon = cat.icon;
                        return (
                          <button
                            key={a.id}
                            onClick={() => setOpenArticle(a)}
                            className="w-full text-left p-4 hover:bg-gray-50 transition-colors group"
                          >
                            <div className="flex items-start gap-3">
                              <span className={cn('w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform', cat.gradient)}>
                                <Icon className="h-4 w-4 text-white" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 group-hover:text-[#9c27b0] transition-colors">{a.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
                                <span className="inline-block mt-1.5 text-[9px] uppercase tracking-wider font-bold text-gray-400">
                                  {cat.label}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Resize handle (bottom-right) */}
          <div
            onMouseDown={onResizeMouseDown}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10"
            style={{
              background: 'linear-gradient(135deg, transparent 50%, rgba(156,39,176,0.4) 50%)',
            }}
          />
        </>
      )}
    </div>
  );
}
