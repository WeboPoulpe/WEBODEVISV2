'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bold, Italic, Underline, List, ListOrdered,
  Save, Printer, Loader2, Check, Palette, ArrowLeft,
  LayoutTemplate, Bell, Eye, EyeOff, Download,
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
  '#c62828', '#e65100', '#f9a825', '#ffffff',
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

  // Apply fontSize directly to DOM so contentEditable sees it immediately
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.style.fontSize = `${fontSize}px`;
    }
  }, [fontSize]);

  // Apply menuWidth to .gastro-menu div (bake before save/print)
  const applyMenuWidth = (width: string) => {
    setMenuWidth(width);
    const menu = editorRef.current?.querySelector('.gastro-menu') as HTMLElement | null;
    if (menu) menu.style.maxWidth = width;
  };

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
    const { error: err } = await createClient()
      .from('quotes')
      .update({ content_html: html, selected_font: font, selected_font_size: fontSize })
      .eq('id', quoteId);
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
    body { margin: 0; padding: 0; font-family: '${font}', Georgia, serif; font-size: ${fontSize}px; background: #fff; }
    .screen-sep {
      page-break-after: always !important;
      break-after: page !important;
      border: none !important;
      background: transparent !important;
      color: transparent !important;
      margin: 0 !important;
      padding: 0 !important;
      height: 0 !important;
      overflow: hidden !important;
      font-size: 0 !important;
      line-height: 0 !important;
    }
    ${!showDesc ? '.svc-desc { display: none !important; }' : ''}
  </style>
</head>
<body>
  <div style="padding:20mm;">${content}</div>
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

  // ── Save PDF (direct download via html2pdf.js) ───────────────────────────────
  const handleSavePdf = async () => {
    const content = editorRef.current?.innerHTML ?? '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2pdf = (await import('html2pdf.js' as any)).default;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = content;
    wrapper.style.fontFamily = `'${font}', Georgia, serif`;
    wrapper.style.fontSize   = `${fontSize}px`;
    wrapper.style.padding    = '20mm';
    wrapper.style.background = '#fff';
    wrapper.style.colorScheme = 'light';
    html2pdf()
      .set({
        margin: 0,
        filename: `devis-${quoteId}.pdf`,
        image:    { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF:    { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all'], before: '.screen-sep' },
      })
      .from(wrapper)
      .save();
  };

  return (
    <div className="flex flex-col h-full bg-slate-100">

      {/* CSS: font override + font size + description toggle + gastro menu width */}
      <style>{`
        #weboword-sheet, #weboword-sheet * { font-family: '${font}', Georgia, serif !important; }
        #weboword-sheet { font-size: ${fontSize}px !important; }
        ${!showDesc ? '.svc-desc { display: none !important; }' : ''}
        .gastro-menu { max-width: ${menuWidth} !important; margin: 0 auto !important; }
      `}</style>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

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
            style={{ padding: '20mm' }}
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
