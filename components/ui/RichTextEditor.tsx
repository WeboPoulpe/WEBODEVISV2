'use client';

/**
 * Lightweight rich-text editor — zero external dependencies.
 *
 * Uses browser-native `contentEditable` + `document.execCommand` to provide:
 *   • Bold   (Ctrl/⌘ + B — also handled natively by the browser)
 *   • Italic (Ctrl/⌘ + I — idem)
 *   • Unordered list
 *
 * The HTML string is emitted via `onChange` on every keystroke so the parent
 * can treat it as a controlled value.  The component is intentionally
 * uncontrolled internally (no re-render loop) — it initialises from
 * `initialValue` on mount and never overwrites user input thereafter.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Bold, Italic, List } from 'lucide-react';

interface Props {
  /** Initial HTML string shown when the editor mounts */
  initialValue?: string;
  /** Called with the current innerHTML on every change */
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function RichTextEditor({
  initialValue = '',
  onChange,
  placeholder = 'Description…',
  minHeight = '120px',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Set<string>>(new Set());

  // ── Initialise DOM once on mount ─────────────────────────────────────────
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = initialValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Track which formatting commands are currently active ─────────────────
  const refreshActive = useCallback(() => {
    try {
      const next = new Set<string>();
      if (document.queryCommandState('bold'))                next.add('bold');
      if (document.queryCommandState('italic'))              next.add('italic');
      if (document.queryCommandState('insertUnorderedList')) next.add('list');
      setActive(next);
    } catch { /* ignore in SSR / non-browser envs */ }
  }, []);

  // ── Execute a formatting command without stealing focus ──────────────────
  const exec = useCallback((cmd: string) => {
    // execCommand works on the focused editable — keep focus on the div
    document.execCommand(cmd, false);
    ref.current?.focus();
    refreshActive();
    onChange(ref.current?.innerHTML ?? '');
  }, [onChange, refreshActive]);

  const handleInput = useCallback(() => {
    refreshActive();
    onChange(ref.current?.innerHTML ?? '');
  }, [onChange, refreshActive]);

  // ── Toolbar button helper ─────────────────────────────────────────────────
  const ToolBtn = ({
    cmd, icon: Icon, title, listKey,
  }: {
    cmd: string; icon: React.ElementType; title: string; listKey?: string;
  }) => (
    <button
      type="button"
      title={title}
      // onMouseDown + preventDefault prevents the editor from losing focus
      onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
      className={[
        'p-1.5 rounded transition-colors',
        active.has(listKey ?? cmd)
          ? 'bg-[#9c27b0] text-white'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div className="border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-[#9c27b0]/30 focus-within:border-[#9c27b0] transition-colors overflow-hidden">

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <ToolBtn cmd="bold"   icon={Bold}   title="Gras (Ctrl+B)" />
        <ToolBtn cmd="italic" icon={Italic} title="Italique (Ctrl+I)" />
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <ToolBtn cmd="insertUnorderedList" listKey="list" icon={List} title="Liste à puces" />
      </div>

      {/* ── Editable area ─────────────────────────────────────────────── */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onFocus={refreshActive}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className={[
          'px-3 py-2.5 text-sm text-gray-900 focus:outline-none',
          'overflow-y-auto max-h-52',
          'description-html',
          // Show placeholder when empty via CSS attr()
          '[&:empty]:before:content-[attr(data-placeholder)]',
          '[&:empty]:before:text-gray-400',
          '[&:empty]:before:pointer-events-none',
        ].join(' ')}
      />
    </div>
  );
}
