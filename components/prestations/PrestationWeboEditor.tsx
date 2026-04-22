'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bold, Italic, Underline, ArrowLeft, Save, Loader2, Check, Palette,
  AlignLeft, AlignCenter, AlignRight, Type, Wand2, Languages,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface Props {
  prestationId: string;
  name: string;
  unitPrice: number;
  category: string | null;
  subCategory: string | null;
  initialHtml: string;
  initialHtmlEn?: string;
  description: string;
}

const FONTS = [
  // System fonts
  { label: 'Georgia (défaut)', value: 'Georgia', google: false },
  { label: 'Times New Roman', value: 'Times New Roman', google: false },
  { label: 'Arial', value: 'Arial', google: false },
  { label: 'Helvetica', value: 'Helvetica', google: false },
  { label: 'Verdana', value: 'Verdana', google: false },
  { label: 'Courier New', value: 'Courier New', google: false },
  { label: 'Trebuchet MS', value: 'Trebuchet MS', google: false },
  { label: 'Garamond', value: 'Garamond', google: false },
  // Google Fonts — Serif
  { label: 'Playfair Display', value: 'Playfair Display', google: true },
  { label: 'Merriweather', value: 'Merriweather', google: true },
  { label: 'Lora', value: 'Lora', google: true },
  { label: 'Cormorant Garamond', value: 'Cormorant Garamond', google: true },
  { label: 'EB Garamond', value: 'EB Garamond', google: true },
  { label: 'Crimson Text', value: 'Crimson Text', google: true },
  { label: 'Libre Baskerville', value: 'Libre Baskerville', google: true },
  { label: 'Spectral', value: 'Spectral', google: true },
  // Google Fonts — Sans-serif
  { label: 'Montserrat', value: 'Montserrat', google: true },
  { label: 'Roboto', value: 'Roboto', google: true },
  { label: 'Open Sans', value: 'Open Sans', google: true },
  { label: 'Lato', value: 'Lato', google: true },
  { label: 'Poppins', value: 'Poppins', google: true },
  { label: 'Inter', value: 'Inter', google: true },
  { label: 'Raleway', value: 'Raleway', google: true },
  { label: 'Nunito', value: 'Nunito', google: true },
  { label: 'Source Sans 3', value: 'Source Sans 3', google: true },
  { label: 'Work Sans', value: 'Work Sans', google: true },
  // Display & Script
  { label: 'Dancing Script', value: 'Dancing Script', google: true },
  { label: 'Great Vibes', value: 'Great Vibes', google: true },
  { label: 'Pinyon Script', value: 'Pinyon Script', google: true },
  { label: 'Cinzel', value: 'Cinzel', google: true },
  { label: 'Abril Fatface', value: 'Abril Fatface', google: true },
  { label: 'Bebas Neue', value: 'Bebas Neue', google: true },
  { label: 'Oswald', value: 'Oswald', google: true },
];

const COLORS = [
  '#1a1a1a', '#666666', '#999999', '#ffffff',
  '#9c27b0', '#7b1fa2', '#6a1080', '#ab47bc',
  '#c8956c', '#8b5a2b', '#e2b99a', '#daa520',
  '#1565c0', '#0d47a1', '#3f51b5', '#1e88e5',
  '#2e7d32', '#1b5e20', '#388e3c', '#43a047',
  '#c62828', '#b71c1c', '#FF2400', '#e65100',
  '#f9a825', '#ffd700', '#ff6b6b', '#d4a5a5',
  '#1e293b', '#334155', '#475569', '#64748b',
];

export default function PrestationWeboEditor({
  prestationId, name, unitPrice, category, subCategory, initialHtml, initialHtmlEn, description,
}: Props) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const initDone = useRef(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [font, setFont] = useState('Georgia');
  const [fontSize, setFontSize] = useState(12);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [translating, setTranslating] = useState(false);

  // Auto-translate FR → EN (uses free MyMemory API, walks through text nodes only)
  const autoTranslateToEn = async () => {
    if (!editorRef.current) return;
    // First save current FR content
    if (language === 'fr') htmlFrRef.current = editorRef.current.innerHTML;
    const sourceHtml = htmlFrRef.current;
    if (!sourceHtml.trim()) { alert('Aucun contenu FR à traduire'); return; }

    setTranslating(true);
    try {
      // Parse HTML, find text nodes, translate each
      const tmp = document.createElement('div');
      tmp.innerHTML = sourceHtml;
      const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let node = walker.nextNode();
      while (node) { nodes.push(node as Text); node = walker.nextNode(); }

      // Translate each non-empty text node
      for (const n of nodes) {
        const txt = (n.textContent || '').trim();
        if (!txt || txt.length < 2) continue;
        try {
          const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(txt)}&langpair=fr|en`);
          const data = await res.json();
          if (data?.responseData?.translatedText) {
            n.textContent = data.responseData.translatedText;
          }
        } catch {
          // Skip on error
        }
        // Tiny delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 100));
      }

      htmlEnRef.current = tmp.innerHTML;
      // If we're currently on EN tab, update the editor
      if (language === 'en' && editorRef.current) {
        editorRef.current.innerHTML = htmlEnRef.current;
      } else {
        // Switch to EN to show the result
        switchLanguage('en');
      }
    } catch (err) {
      alert('Erreur de traduction: ' + (err as Error).message);
    }
    setTranslating(false);
  };

  // In-memory storage for both versions (avoid losing edits when switching tabs)
  const htmlFrRef = useRef(initialHtml || '');
  const htmlEnRef = useRef(initialHtmlEn || '');

  // Default templates for the gastro card
  const defaultHtmlFr = `<div class="gastro-card" style="text-align:center;margin:0 auto;max-width:600px;padding:20px;">
  <h3 class="presta-title" style="font-size:16px;font-weight:bold;color:#9c27b0;margin:0 0 8px;letter-spacing:0.3px;">${name}</h3>
  <p class="presta-desc" style="font-size:12px;color:#555;font-style:italic;line-height:1.6;margin:0;">${description || 'Saisissez la description de votre prestation ici…'}</p>
</div>`;

  const defaultHtmlEn = `<div class="gastro-card" style="text-align:center;margin:0 auto;max-width:600px;padding:20px;">
  <h3 class="presta-title" style="font-size:16px;font-weight:bold;color:#9c27b0;margin:0 0 8px;letter-spacing:0.3px;">${name}</h3>
  <p class="presta-desc" style="font-size:12px;color:#555;font-style:italic;line-height:1.6;margin:0;">Type the English description here…</p>
</div>`;

  useEffect(() => {
    if (!initDone.current && editorRef.current) {
      editorRef.current.innerHTML = initialHtml || defaultHtmlFr;
      initDone.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml]);

  // Switch between FR and EN versions
  const switchLanguage = (lang: 'fr' | 'en') => {
    if (!editorRef.current) return;
    // Save current content to the corresponding ref
    if (language === 'fr') htmlFrRef.current = editorRef.current.innerHTML;
    else htmlEnRef.current = editorRef.current.innerHTML;
    // Load the other version
    if (lang === 'fr') editorRef.current.innerHTML = htmlFrRef.current || defaultHtmlFr;
    else editorRef.current.innerHTML = htmlEnRef.current || defaultHtmlEn;
    setLanguage(lang);
  };

  // Load Google Font
  useEffect(() => {
    const f = FONTS.find((x) => x.value === font);
    if (!f?.google) return;
    const id = `gfont-${font.replace(/\s+/g, '-')}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap`;
      document.head.appendChild(link);
    }
  }, [font]);

  // Listen for save event from sidebar
  useEffect(() => {
    const onSave = () => handleSave();
    window.addEventListener('presta-webo:save', onSave);
    return () => window.removeEventListener('presta-webo:save', onSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prestationId]);

  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }, []);

  const applyColor = (color: string) => exec('foreColor', color);

  const autoStructure = useCallback(() => {
    if (!editorRef.current) return;
    const desc = editorRef.current.querySelector('.presta-desc');
    if (!desc) return;
    const raw = desc.textContent || '';
    if (!raw.trim()) return;
    const lines = raw
      .split(/\s+[-–]\s+/)
      .flatMap((s) => s.split(/\*{2,}/))
      .flatMap((s) => s.split(/\n+/))
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length <= 1) return;
    desc.innerHTML = lines
      .map((line) => {
        const priceMatch = line.match(/(\+?\d+€\/pers\.?)$/);
        if (priceMatch) {
          const before = line.slice(0, -priceMatch[0].length).trim();
          return `<p style="margin:2px 0;">${before} <strong>${priceMatch[0]}</strong></p>`;
        }
        return `<p style="margin:2px 0;">${line}</p>`;
      })
      .join('');
  }, []);

  const handleSave = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    // Update the in-memory ref for the active language
    if (language === 'fr') htmlFrRef.current = editorRef.current.innerHTML;
    else htmlEnRef.current = editorRef.current.innerHTML;

    // Auto-translate FR → EN if EN is empty AND we're saving FR with content
    if (language === 'fr' && !htmlEnRef.current.trim() && htmlFrRef.current.trim()) {
      try {
        const tmp = document.createElement('div');
        tmp.innerHTML = htmlFrRef.current;
        const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        let node = walker.nextNode();
        while (node) { nodes.push(node as Text); node = walker.nextNode(); }
        for (const n of nodes) {
          const txt = (n.textContent || '').trim();
          if (!txt || txt.length < 2) continue;
          try {
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(txt)}&langpair=fr|en`);
            const data = await res.json();
            if (data?.responseData?.translatedText) n.textContent = data.responseData.translatedText;
          } catch { /* skip */ }
          await new Promise((r) => setTimeout(r, 80));
        }
        htmlEnRef.current = tmp.innerHTML;
      } catch { /* skip translation on error */ }
    }

    const supabase = createClient();
    let { error } = await supabase.from('prestations')
      .update({ gastro_card_html: htmlFrRef.current, gastro_card_html_en: htmlEnRef.current })
      .eq('id', prestationId);
    if (error?.code === '42703' || error?.message?.includes('gastro_card_html_en')) {
      const res = await supabase.from('prestations')
        .update({ gastro_card_html: htmlFrRef.current })
        .eq('id', prestationId);
      error = res.error;
      if (!error) alert('⚠️ Version anglaise non sauvegardée — exécutez le SQL:\nALTER TABLE prestations ADD COLUMN gastro_card_html_en TEXT;');
    }
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      alert('Erreur: ' + error.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Top bar (minimal: title + language tabs + status) */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800 truncate">{name}</span>
          <span className="text-xs text-gray-400">· {unitPrice}€ HT</span>
          {category && <span className="text-xs text-[#9c27b0] bg-[#f3e5f5] px-2 py-0.5 rounded-full capitalize">{category}</span>}
          {subCategory && <span className="text-xs text-gray-500 italic">{subCategory}</span>}

          {/* Auto-translate button */}
          <button
            onClick={autoTranslateToEn}
            disabled={translating}
            title="Traduire automatiquement la version FR vers l'anglais"
            className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-[#9c27b0] border border-[#9c27b0]/30 hover:bg-[#f3e5f5] disabled:opacity-50 transition-colors"
          >
            {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
            {translating ? 'Traduction…' : 'Traduire FR→EN'}
          </button>

          {/* Language tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => switchLanguage('fr')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
                language === 'fr' ? 'bg-white shadow-sm text-[#9c27b0]' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              🇫🇷 Français
            </button>
            <button
              onClick={() => switchLanguage('en')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
                language === 'en' ? 'bg-white shadow-sm text-[#9c27b0]' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              🇬🇧 English
            </button>
          </div>

          {saved && <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><Check className="h-3 w-3" /> Enregistré</span>}
          {saving && <span className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Enregistrement…</span>}
        </div>

        {/* Formatting bar */}
        <div className="flex items-center gap-0.5 px-4 py-1.5 flex-wrap">
          <TB onClick={() => exec('bold')} title="Gras">
            <Bold className="h-3.5 w-3.5" />
          </TB>
          <TB onClick={() => exec('italic')} title="Italique">
            <Italic className="h-3.5 w-3.5" />
          </TB>
          <TB onClick={() => exec('underline')} title="Souligné">
            <Underline className="h-3.5 w-3.5" />
          </TB>
          <Sep />
          <TB onClick={() => exec('justifyLeft')} title="Gauche">
            <AlignLeft className="h-3.5 w-3.5" />
          </TB>
          <TB onClick={() => exec('justifyCenter')} title="Centrer">
            <AlignCenter className="h-3.5 w-3.5" />
          </TB>
          <TB onClick={() => exec('justifyRight')} title="Droite">
            <AlignRight className="h-3.5 w-3.5" />
          </TB>
          <Sep />

          {/* Colors */}
          <div className="flex items-center gap-0.5">
            <Palette className="h-3.5 w-3.5 text-gray-400 mr-1" />
            {COLORS.map((c) => (
              <button
                key={c}
                onMouseDown={(e) => { e.preventDefault(); applyColor(c); }}
                style={{ background: c }}
                className="w-4 h-4 rounded-sm border border-gray-300 hover:scale-110 transition-transform"
                title={c}
              />
            ))}
          </div>
          <Sep />

          {/* Font */}
          <select
            value={font}
            onChange={(e) => setFont(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            style={{ fontFamily: font }}
          >
            {FONTS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>

          {/* Size */}
          <select
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white ml-1"
          >
            {[10, 11, 12, 13, 14, 16, 18, 20].map((s) => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>

          <Sep />

          {/* Auto-structure */}
          <button
            onClick={autoStructure}
            title="Structurer automatiquement (sépare par tirets, met en gras les prix)"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-[#9c27b0]/70 hover:bg-[#f3e5f5] hover:text-[#9c27b0] transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Structurer
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <Type className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          Stylez votre carte gastronomique. Elle sera réutilisée automatiquement à chaque insertion de cette prestation dans un devis.
        </p>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto p-8 flex justify-center">
        <div className="bg-white shadow-lg rounded-lg w-full max-w-2xl">
          <style>{`
            #presta-sheet, #presta-sheet * { font-family: '${font}', Georgia, serif; }
            #presta-sheet { font-size: ${fontSize}px; }
          `}</style>
          <div
            id="presta-sheet"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            className="outline-none min-h-[400px] p-8 focus:ring-2 focus:ring-[#9c27b0]/20 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}

function TB({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />;
}
