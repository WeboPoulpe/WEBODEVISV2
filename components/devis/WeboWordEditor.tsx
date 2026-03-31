'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bold, Italic, Underline, List, ListOrdered,
  Save, Printer, Loader2, Check, Palette, ArrowLeft,
  LayoutTemplate, Bell, Eye, EyeOff, Download, Wand2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  quoteId: string;
  initialHtml: string;
  /** Shown in toolbar breadcrumb only */
  clientName?: string;
  /** Called (wizard mode) when user clicks ← back */
  onBack?: () => void;
  /** Pre-selected font (from saved quote) */
  selectedFont?: string;
  /** Pre-selected font size in px (from saved quote) */
  selectedFontSize?: number;
}

// ── Gastronomic menu width options ────────────────────────────────────────────
const MENU_WIDTHS = [
  { label: 'Étroit',  value: '280px' },
  { label: 'Normal',  value: '400px' },
  { label: 'Large',   value: '560px' },
  { label: 'Plein',   value: '100%'  },
];

// ── Available fonts ────────────────────────────────────────────────────────────
const FONTS = [
  { label: 'Georgia (défaut)', value: 'Georgia', google: false },
  { label: 'Playfair Display', value: 'Playfair Display', google: true },
  { label: 'Montserrat', value: 'Montserrat', google: true },
  { label: 'Roboto', value: 'Roboto', google: true },
  { label: 'Open Sans', value: 'Open Sans', google: true },
];

// ── Colour presets for the text-colour picker ─────────────────────────────────
const COLORS = [
  '#1a1a1a', '#9c27b0', '#7b1fa2', '#1565c0', '#2e7d32',
  '#c62828', '#FF2400', '#e65100', '#f9a825', '#ffffff',
];

// ── Small toolbar button ───────────────────────────────────────────────────────
function TB({
  onClick, title, active, children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={cn(
        'p-1.5 rounded-lg transition-colors text-sm',
        active
          ? 'bg-[#9c27b0] text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      {children}
    </button>
  );
}

// ── Separator ─────────────────────────────────────────────────────────────────
function Sep() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5 flex-shrink-0" />;
}

// ── Toast notification ────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200 print:hidden">
      <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
      {message}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18];
const LINE_HEIGHTS = [
  { label: '1.0', value: '1' },
  { label: '1.2', value: '1.2' },
  { label: '1.4', value: '1.4' },
  { label: '1.6', value: '1.6' },
  { label: '1.8', value: '1.8' },
  { label: '2.0', value: '2' },
];

export default function WeboWordEditor({ quoteId, initialHtml, clientName, onBack, selectedFont: initFont, selectedFontSize: initSize }: Props) {
  const router = useRouter();
  const editorRef  = useRef<HTMLDivElement>(null);
  const colorInput = useRef<HTMLInputElement>(null);
  const initDone   = useRef(false);

  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);
  const [showDesc,  setShowDesc]  = useState(true);
  const [font,      setFont]      = useState(initFont ?? 'Georgia');
  const [fontSize,  setFontSize]  = useState(initSize ?? 12);
  const [lineHeight, setLineHeight] = useState('1.4');
  const [structureModal, setStructureModal] = useState<{
    open: boolean;
    items: { index: number; name: string; preview: string; selected: boolean }[];
    titleColor: string;
    titleBold: boolean;
    titleItalic: boolean;
    descItalic: boolean;
  }>({ open: false, items: [], titleColor: '#9c27b0', titleBold: true, titleItalic: false, descItalic: true });
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [menuWidth, setMenuWidth] = useState('400px');

  // ── Load Google Font when font changes ────────────────────────────────────
  useEffect(() => {
    const f = FONTS.find((x) => x.value === font);
    if (!f?.google) return;
    const id = `gfont-${font.replace(/\s+/g, '-')}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id   = id;
      link.rel  = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap`;
      document.head.appendChild(link);
    }
  }, [font]);

  // ── Close font menu on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!showFontMenu) return;
    const handler = () => setShowFontMenu(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFontMenu]);

  // Inject initial HTML once + detect existing gastro-menu width
  useEffect(() => {
    if (!initDone.current && editorRef.current) {
      editorRef.current.innerHTML = initialHtml;
      initDone.current = true;
      const menu = editorRef.current.querySelector('.gastro-menu') as HTMLElement | null;
      if (menu?.style.maxWidth) setMenuWidth(menu.style.maxWidth);
    }
  }, [initialHtml]);

  // Apply fontSize + lineHeight directly to DOM so contentEditable sees it immediately
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.style.fontSize = `${fontSize}px`;
      editorRef.current.style.lineHeight = lineHeight;
    }
  }, [fontSize, lineHeight]);

  // Apply menuWidth to .gastro-menu div (bake before save/print)
  const applyMenuWidth = (width: string) => {
    setMenuWidth(width);
    const menu = editorRef.current?.querySelector('.gastro-menu') as HTMLElement | null;
    if (menu) menu.style.maxWidth = width;
  };

  // ── Auto-structure descriptions ──────────────────────────────────────────────
  const openStructureModal = useCallback(() => {
    if (!editorRef.current) return;
    const descs = editorRef.current.querySelectorAll('.svc-desc');
    const items: { index: number; name: string; preview: string; selected: boolean }[] = [];
    descs.forEach((el, i) => {
      const raw = el.textContent || '';
      if (!raw.trim()) return;
      // Find the prestation name (previous sibling or parent's h3/strong)
      const parent = el.closest('div[style]') || el.parentElement;
      const nameEl = parent?.querySelector('h3, strong');
      const name = nameEl?.textContent || `Description ${i + 1}`;
      const alreadyStructured = el.querySelectorAll('p, li').length > 2;
      items.push({
        index: i,
        name,
        preview: raw.substring(0, 120) + (raw.length > 120 ? '…' : ''),
        selected: !alreadyStructured, // pre-check unstructured ones
      });
    });
    if (items.length === 0) {
      setToast('Aucune description trouvée à structurer');
      return;
    }
    setStructureModal({ open: true, items, titleColor: '#9c27b0', titleBold: true, titleItalic: false, descItalic: true });
  }, []);

  const applyStructure = useCallback(() => {
    if (!editorRef.current) return;
    const descs = editorRef.current.querySelectorAll('.svc-desc');
    const { titleColor, titleBold, titleItalic, descItalic } = structureModal;
    const selectedIndices = new Set(structureModal.items.filter((it) => it.selected).map((it) => it.index));
    let changed = 0;
    descs.forEach((el, i) => {
      if (!selectedIndices.has(i)) return;
      const raw = el.textContent || '';
      if (!raw.trim()) return;

      // Also style the title (h3) of this prestation
      const parent = el.closest('div[style]') || el.parentElement;
      const titleEl = parent?.querySelector('h3') as HTMLElement | null;
      if (titleEl) {
        if (titleColor) titleEl.style.color = titleColor;
        titleEl.style.fontWeight = titleBold ? 'bold' : 'normal';
        titleEl.style.fontStyle = titleItalic ? 'italic' : 'normal';
      }

      const lines = raw
        .split(/\s+[-–]\s+/)
        .flatMap((s) => s.split(/\*{2,}/))
        .flatMap((s) => s.split(/\n+/))
        .map((s) => s.trim())
        .filter(Boolean);
      if (lines.length <= 1) {
        // Even if only 1 line, apply italic style
        if (descItalic) (el as HTMLElement).style.fontStyle = 'italic';
        changed++;
        return;
      }
      const italic = descItalic ? 'font-style:italic;' : '';
      const html = lines
        .map((line) => {
          const priceMatch = line.match(/(\+?\d+€\/pers\.?)$/);
          if (priceMatch) {
            const before = line.slice(0, -priceMatch[0].length).trim();
            return `<p style="margin:2px 0;${italic}">${before} <strong>${priceMatch[0]}</strong></p>`;
          }
          return `<p style="margin:2px 0;${italic}">${line}</p>`;
        })
        .join('');
      el.innerHTML = html;
      changed++;
    });
    setStructureModal({ open: false, items: [], titleColor: '#9c27b0', titleBold: true, titleItalic: false, descItalic: true });
    setToast(`${changed} description${changed > 1 ? 's' : ''} structurée${changed > 1 ? 's' : ''}`);
  }, [structureModal]);

  // ── Toolbar commands ─────────────────────────────────────────────────────────
  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value ?? undefined);
  }, []);

  const applyColor = (color: string) => exec('foreColor', color);
  const applyBg    = (color: string) => exec('hiliteColor', color);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const html = editorRef.current?.innerHTML ?? '';
    setSaving(true); setError(null);
    const supabase = createClient();
    // Try saving with font size; if column doesn't exist yet, retry without it
    let { error: err } = await supabase
      .from('quotes')
      .update({ content_html: html, selected_font: font, selected_font_size: fontSize })
      .eq('id', quoteId);
    if (err?.message?.includes('selected_font_size') || err?.code === '42703') {
      const res = await supabase
        .from('quotes')
        .update({ content_html: html, selected_font: font })
        .eq('id', quoteId);
      err = res.error;
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    setToast('Devis enregistré avec succès');
  };

  // ── Build print HTML (shared by print + PDF) ──────────────────────────────────
  const buildPrintHtml = () => {
    const content = editorRef.current?.innerHTML ?? '';
    const fontEntry = FONTS.find((x) => x.value === font);
    const fontImport = fontEntry?.google
      ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap">`
      : '';
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Devis</title>
  ${fontImport}
  <style>
    @page { size: A4; margin: 0; }
    html, body { color-scheme: light; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { margin: 0; padding: 0; font-family: '${font}', Georgia, serif; font-size: ${fontSize}px; line-height: ${lineHeight}; background: #fff; }
    body * { min-height: 0 !important; }
    .screen-sep { visibility: hidden !important; height: 0 !important; padding: 0 !important; margin: 0 !important; border: none !important; font-size: 0 !important; line-height: 0 !important; page-break-after: always !important; break-after: page !important; }
    .gastro-page { page-break-before: always !important; break-before: page !important; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    p, li { orphans: 2; widows: 2; }
    ${!showDesc ? '.svc-desc { display: none !important; }' : ''}
  </style>
</head>
<body>
  <div style="padding:20mm;">${content}</div>
  <script>
    var els = document.querySelectorAll('[style]');
    var sep = false;
    for (var i = 0; i < els.length; i++) {
      if (els[i].style.minHeight) els[i].style.minHeight = '0';
      if (els[i].classList.contains('screen-sep')) { els[i].style.display = 'none'; sep = true; }
      if (sep && els[i].style.marginTop && parseFloat(els[i].style.marginTop) < 0) els[i].style.marginTop = '24px';
    }
  </script>
</body>
</html>`;
  };

  // ── Print (WYSIWYG) ───────────────────────────────────────────────────────────
  const handlePrint = () => {
    const html = buildPrintHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) { URL.revokeObjectURL(url); return; }
    win.onload = () => { setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 600); };
  };

  // ── Save PDF — uses browser print (reliable, no html2canvas issues) ─────────
  const handleSavePdf = () => {
    const content = editorRef.current?.innerHTML ?? '';
    if (!content) return;

    // Build a clean filename
    const safeName = (clientName ?? 'client').replace(/[^a-zA-ZÀ-ÿ0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 40);
    const dateStr  = new Date().toISOString().slice(0, 10);
    const filename = `Devis-${safeName}-${dateStr}`;

    // Font import
    const fontEntry = FONTS.find((x) => x.value === font);
    const fontImport = fontEntry?.google
      ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap">`
      : '';

    // Build a self-contained HTML document optimized for PDF printing
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  ${fontImport}
  <style>
    @page { size: A4; margin: 8mm 12mm; }
    html, body { margin: 0; padding: 0; background: #fff; color-scheme: light; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: '${font}', Georgia, serif; font-size: ${fontSize}px; line-height: ${lineHeight}; color: #1a1a1a; }

    /* Page wrapper — compact padding */
    .pdf-wrap { padding: 6mm 10mm; }

    /* Kill min-height from old saved HTML (was 257mm, forces blank space) */
    .pdf-wrap * { min-height: 0 !important; }

    /* Hide separator text but force page break */
    .screen-sep { visibility: hidden !important; height: 0 !important; padding: 0 !important; margin: 0 !important; border: none !important; font-size: 0 !important; line-height: 0 !important; page-break-after: always !important; break-after: page !important; }

    /* Gastro page also forces new page (for new HTML without .screen-sep) */
    .gastro-page { page-break-before: always !important; break-before: page !important; }

    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    p, li { orphans: 2; widows: 2; }

    ${!showDesc ? '.svc-desc { display: none !important; }' : ''}
  </style>
</head>
<body>
  <div class="pdf-wrap">${content}</div>
  <script>
    window.onload = function() {
      var els = document.querySelectorAll('[style]');
      var screenSepSeen = false;
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        // Kill min-height (old HTML: min-height:257mm)
        if (el.style.minHeight) el.style.minHeight = '0';
        // Track when we pass the screen separator
        if (el.classList.contains('screen-sep')) {
          el.style.display = 'none';
          screenSepSeen = true;
        }
        // After the separator, fix negative top margins (gastro header overlap)
        if (screenSepSeen && el.style.marginTop && parseFloat(el.style.marginTop) < 0) {
          el.style.marginTop = '24px';
        }
      }
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) { URL.revokeObjectURL(url); return; }
    win.onafterprint = () => { URL.revokeObjectURL(url); };
  };

  return (
    <div className="flex flex-col h-full bg-slate-100">

      {/* CSS: font override + font size + description toggle + gastro menu width */}
      <style>{`
        #weboword-sheet, #weboword-sheet * { font-family: '${font}', Georgia, serif !important; }
        #weboword-sheet { font-size: ${fontSize}px !important; line-height: ${lineHeight} !important; }
        ${!showDesc ? '.svc-desc { display: none !important; }' : ''}
        .gastro-menu { max-width: ${menuWidth} !important; margin: 0 auto !important; }
      `}</style>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* ── Structure modal ─────────────────────────────────────────────────── */}
      {structureModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setStructureModal({ open: false, items: [] })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-[#9c27b0]" />
                <h2 className="text-sm font-semibold text-gray-900">Structurer les descriptions</h2>
              </div>
              <button onClick={() => setStructureModal({ open: false, items: [] })} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
            <p className="px-5 pt-3 text-xs text-gray-500">Choisissez les descriptions à reformater et le style à appliquer :</p>

            {/* Style options */}
            <div className="mx-5 mt-3 p-3 bg-gray-50 rounded-xl space-y-2.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Style des titres</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Couleur :</span>
                  <div className="flex gap-1">
                    {['#9c27b0', '#c8956c', '#1e293b', '#1a1a1a', '#c62828', '#1565c0', '#2e7d32'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setStructureModal({ ...structureModal, titleColor: c })}
                        style={{ background: c }}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${structureModal.titleColor === c ? 'border-gray-900 scale-110' : 'border-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={structureModal.titleBold} onChange={(e) => setStructureModal({ ...structureModal, titleBold: e.target.checked })} className="h-3 w-3 rounded accent-[#9c27b0]" />
                  <span className="text-xs text-gray-600 font-bold">Gras</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={structureModal.titleItalic} onChange={(e) => setStructureModal({ ...structureModal, titleItalic: e.target.checked })} className="h-3 w-3 rounded accent-[#9c27b0]" />
                  <span className="text-xs text-gray-600 italic">Italique</span>
                </label>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Style des descriptions</p>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={structureModal.descItalic} onChange={(e) => setStructureModal({ ...structureModal, descItalic: e.target.checked })} className="h-3 w-3 rounded accent-[#9c27b0]" />
                  <span className="text-xs text-gray-600 italic">Descriptions en italique</span>
                </label>
              </div>
              {/* Live preview */}
              <div className="border-t border-gray-200 pt-2">
                <p className="text-[10px] text-gray-400 mb-1">Aperçu :</p>
                <div className="bg-white rounded-lg p-2 border border-gray-200 text-center">
                  <p style={{ color: structureModal.titleColor, fontWeight: structureModal.titleBold ? 'bold' : 'normal', fontStyle: structureModal.titleItalic ? 'italic' : 'normal', fontSize: '13px' }}>
                    Nom de la prestation
                  </p>
                  <p style={{ fontStyle: structureModal.descItalic ? 'italic' : 'normal', fontSize: '11px', color: '#777' }}>
                    Description gastronomique du plat
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {structureModal.items.map((item, idx) => (
                <label key={item.index} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${item.selected ? 'border-[#9c27b0]/30 bg-[#faf5ff]' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(e) => {
                      const updated = [...structureModal.items];
                      updated[idx] = { ...updated[idx], selected: e.target.checked };
                      setStructureModal({ ...structureModal, items: updated });
                    }}
                    className="mt-0.5 h-4 w-4 rounded accent-[#9c27b0] flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 italic">{item.preview}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => {
                  const allSelected = structureModal.items.every((it) => it.selected);
                  setStructureModal({ ...structureModal, items: structureModal.items.map((it) => ({ ...it, selected: !allSelected })) });
                }}
                className="text-xs text-[#9c27b0] hover:underline font-medium"
              >
                {structureModal.items.every((it) => it.selected) ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              <div className="flex gap-2">
                <button onClick={() => setStructureModal({ open: false, items: [] })} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button
                  onClick={applyStructure}
                  disabled={!structureModal.items.some((it) => it.selected)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Structurer ({structureModal.items.filter((it) => it.selected).length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm print:hidden">

        {/* Top bar: breadcrumb + save/print */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            {onBack ? (
              <button
                onClick={onBack}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => router.push('/devis')}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Retour à la liste"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <LayoutTemplate className="h-4 w-4 text-[#9c27b0]" />
              <span className="text-sm font-semibold text-gray-800">WeboWord</span>
              {clientName && (
                <span className="text-sm text-gray-400">— {clientName}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {error && (
              <span className="text-xs text-red-600 max-w-[200px] truncate">{error}</span>
            )}

            {/* Modifier les informations → back to wizard */}
            <Link
              href={`/devis/${quoteId}/modifier?mode=wizard`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Modifier les informations du devis (client, prestations, options)"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Modifier les infos</span>
            </Link>

            {/* Bell icon → notifications */}
            <Link
              href="/notifications"
              className="p-1.5 text-gray-400 hover:text-[#9c27b0] hover:bg-purple-50 rounded-lg transition-colors"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
            </Link>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Ouvrir le PDF dans une fenêtre d'impression"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Imprimer</span>
            </button>
            <button
              onClick={handleSavePdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#9c27b0] border border-[#9c27b0]/40 rounded-lg hover:bg-purple-50 transition-colors"
              title="Télécharger directement en PDF"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Enregistrer PDF</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
          </div>
        </div>

        {/* Formatting bar */}
        <div className="flex items-center gap-0.5 px-4 py-1.5 flex-wrap">
          <TB onClick={() => exec('bold')}           title="Gras (Ctrl+B)">
            <Bold className="h-3.5 w-3.5" />
          </TB>
          <TB onClick={() => exec('italic')}         title="Italique (Ctrl+I)">
            <Italic className="h-3.5 w-3.5" />
          </TB>
          <TB onClick={() => exec('underline')}      title="Souligné (Ctrl+U)">
            <Underline className="h-3.5 w-3.5" />
          </TB>

          <Sep />

          <TB onClick={() => exec('insertUnorderedList')} title="Liste à puces">
            <List className="h-3.5 w-3.5" />
          </TB>
          <TB onClick={() => exec('insertOrderedList')}   title="Liste numérotée">
            <ListOrdered className="h-3.5 w-3.5" />
          </TB>

          <Sep />

          {/* Heading buttons */}
          {(['H1', 'H2', 'H3'] as const).map((tag) => (
            <TB
              key={tag}
              onClick={() => exec('formatBlock', tag)}
              title={`Titre ${tag}`}
            >
              <span className="font-bold text-xs leading-none">{tag}</span>
            </TB>
          ))}
          <TB onClick={() => exec('formatBlock', 'P')} title="Paragraphe normal">
            <span className="text-xs leading-none">¶</span>
          </TB>

          <Sep />

          {/* Alignment */}
          <TB onClick={() => exec('justifyLeft')}   title="Aligner à gauche">
            <span className="text-xs font-mono">≡←</span>
          </TB>
          <TB onClick={() => exec('justifyCenter')} title="Centrer">
            <span className="text-xs font-mono">≡</span>
          </TB>
          <TB onClick={() => exec('justifyRight')}  title="Aligner à droite">
            <span className="text-xs font-mono">≡→</span>
          </TB>

          <Sep />

          {/* Text colour */}
          <div className="relative flex items-center">
            <button
              title="Couleur du texte"
              className="flex items-center gap-1 p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              onMouseDown={(e) => { e.preventDefault(); colorInput.current?.click(); }}
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="text-[10px]">A</span>
            </button>
            {/* Colour presets */}
            <div className="flex items-center gap-0.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  title={c}
                  onMouseDown={(e) => { e.preventDefault(); applyColor(c); }}
                  style={{ background: c }}
                  className="w-4 h-4 rounded-sm border border-gray-300 hover:scale-110 transition-transform flex-shrink-0"
                />
              ))}
            </div>
            {/* Native colour input (hidden) */}
            <input
              ref={colorInput}
              type="color"
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              onChange={(e) => applyColor(e.target.value)}
            />
          </div>

          <Sep />

          {/* Highlight colour */}
          <div className="flex items-center gap-0.5">
            {['#fff9c4', '#e8f5e9', '#fce4ec', '#e3f2fd', 'transparent'].map((c) => (
              <button
                key={c}
                title={c === 'transparent' ? 'Effacer surlignage' : `Surligner ${c}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyBg(c === 'transparent' ? 'transparent' : c);
                }}
                style={{ background: c === 'transparent' ? '#fff' : c }}
                className="w-4 h-4 rounded-sm border border-gray-300 hover:scale-110 transition-transform flex-shrink-0 relative"
              >
                {c === 'transparent' && (
                  <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-[9px] font-bold">×</span>
                )}
              </button>
            ))}
          </div>

          <Sep />

          {/* Description toggle */}
          <button
            onMouseDown={(e) => { e.preventDefault(); setShowDesc((v) => !v); }}
            title={showDesc ? 'Masquer les descriptions' : 'Afficher les descriptions'}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors border',
              showDesc
                ? 'border-gray-200 text-gray-600 hover:bg-gray-100'
                : 'border-[#9c27b0] text-[#9c27b0] bg-purple-50',
            )}
          >
            {showDesc
              ? <><Eye className="h-3.5 w-3.5" /><span className="hidden sm:inline">Descriptions</span></>
              : <><EyeOff className="h-3.5 w-3.5" /><span className="hidden sm:inline">Descriptions masquées</span></>}
          </button>

          {/* Auto-structure descriptions */}
          <button
            onMouseDown={(e) => { e.preventDefault(); openStructureModal(); }}
            title="Structurer automatiquement les descriptions (séparer par tirets, mettre en forme)"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-[#9c27b0]/70 hover:bg-[#f3e5f5] hover:text-[#9c27b0] transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Structurer</span>
          </button>

          <Sep />

          {/* Font selector */}
          <div className="relative">
            <button
              onMouseDown={(e) => { e.preventDefault(); setShowFontMenu((v) => !v); }}
              title="Changer la police"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
              style={{ fontFamily: font }}
            >
              <span className="max-w-[90px] truncate">{font}</span>
              <span className="text-gray-400">▾</span>
            </button>
            {showFontMenu && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[170px] py-1">
                {FONTS.map((f) => (
                  <button
                    key={f.value}
                    onMouseDown={(e) => { e.preventDefault(); setFont(f.value); setShowFontMenu(false); }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-[#9c27b0]/5 transition-colors',
                      font === f.value && 'text-[#9c27b0] font-semibold',
                    )}
                    style={{ fontFamily: f.value }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Sep />

          {/* Font size selector */}
          <div className="flex items-center gap-0.5" title="Taille de police">
            <span className="text-[10px] text-gray-400 mr-0.5 hidden sm:inline">Taille :</span>
            <select
              value={fontSize}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="px-1.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#9c27b0]/30 cursor-pointer"
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
          </div>

          {/* Line height selector */}
          <div className="flex items-center gap-0.5" title="Interligne">
            <span className="text-[10px] text-gray-400 mr-0.5 hidden sm:inline">Interligne :</span>
            <select
              value={lineHeight}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setLineHeight(e.target.value)}
              className="px-1.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#9c27b0]/30 cursor-pointer"
            >
              {LINE_HEIGHTS.map((lh) => (
                <option key={lh.value} value={lh.value}>{lh.label}</option>
              ))}
            </select>
          </div>

          <Sep />

          {/* Gastro menu width */}
          <div className="flex items-center gap-1" title="Largeur de la carte gastronomique">
            <span className="text-[10px] text-gray-400 mr-0.5 hidden sm:inline">Carte :</span>
            {MENU_WIDTHS.map((w) => (
              <button
                key={w.value}
                onMouseDown={(e) => { e.preventDefault(); applyMenuWidth(w.value); }}
                title={`Largeur carte gastronomique : ${w.label}`}
                className={cn(
                  'px-2 py-1 text-xs rounded-lg transition-colors border',
                  menuWidth === w.value
                    ? 'bg-[#9c27b0] text-white border-[#9c27b0]'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-100',
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── A4 workspace ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-8 px-4 print:p-0 print:overflow-visible">
        <div
          style={{ width: '210mm', minHeight: '297mm' }}
          className="mx-auto bg-white shadow-xl rounded-lg print:shadow-none print:rounded-none print:w-full print:min-h-0"
        >
          <style>{`
            #weboword-sheet,
            #weboword-sheet p,
            #weboword-sheet li,
            #weboword-sheet div,
            #weboword-sheet span,
            #weboword-sheet td,
            #weboword-sheet th {
              line-height: ${lineHeight} !important;
            }
            @media print {
              .no-print { display: none !important; }
              #weboword-sheet {
                padding: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                min-height: 0 !important;
                width: 100% !important;
              }
              .screen-sep {
                border: none !important;
                background: transparent !important;
                color: transparent !important;
                height: 0 !important;
                overflow: hidden !important;
                font-size: 0 !important;
                line-height: 0 !important;
              }
            }
          `}</style>

          <div
            id="weboword-sheet"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            style={{ padding: '20mm', fontSize: `${fontSize}px`, lineHeight: lineHeight }}
            className="outline-none min-h-[297mm] prose prose-sm max-w-none focus:ring-2 focus:ring-[#9c27b0]/20 rounded-lg"
            data-placeholder="Cliquez ici pour commencer à modifier votre devis…"
          />
        </div>

        {/* Bottom padding for visual comfort */}
        <div className="h-12 print:hidden" />
      </div>

    </div>
  );
}
