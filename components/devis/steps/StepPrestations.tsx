'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDevis, totalHT, ServiceLine } from '@/context/DevisContext';
import { ArrowLeft, ArrowRight, Plus, Trash2, Search, X, AlignLeft, PencilLine, Scissors } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface Prestation {
  id: string;
  name: string;
  unit_price: number;
  category: string | null;
  description: string | null;
}

interface Props {
  onNext: () => void;
  onBack: () => void;
}

// ── Catalog search combobox ───────────────────────────────────────────────────
function PrestationSearch({
  value,
  onNameChange,
  onSelect,
}: {
  value: string;
  onNameChange: (v: string) => void;
  onSelect: (p: Prestation) => void;
}) {
  const [results, setResults] = useState<Prestation[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('prestations')
        .select('id, name, unit_price, category, description')
        .ilike('name', `%${q}%`)
        .limit(8);
      if (data && data.length > 0) { setResults(data); setOpen(true); }
      else { setResults([]); setOpen(false); }
    }, 300);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onNameChange(val);
    search(val);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <input
          className="w-full text-sm border border-gray-200 rounded-lg pl-7 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors bg-white placeholder:text-gray-400"
          placeholder="Rechercher dans le catalogue…"
          value={value}
          onChange={handleChange}
          onFocus={() => value && results.length > 0 && setOpen(true)}
        />
        {value && (
          <button
            type="button"
            onMouseDown={() => { onNameChange(''); setResults([]); setOpen(false); }}
            className="absolute right-2 text-gray-300 hover:text-gray-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {results.map((p) => (
            <li
              key={p.id}
              onMouseDown={() => { onSelect(p); setResults([]); setOpen(false); }}
              className="px-3 py-2.5 cursor-pointer hover:bg-[#9c27b0]/5 border-b border-gray-50 last:border-0"
            >
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm text-gray-900 font-medium">{p.name}</p>
                <span className="text-xs text-gray-600 font-medium flex-shrink-0">{formatCurrency(p.unit_price)}</span>
              </div>
              {p.description && (
                <p className="text-xs text-gray-400 italic mt-0.5 line-clamp-1">{p.description}</p>
              )}
              {p.category && (
                <span className="inline-block text-[10px] text-[#9c27b0] bg-[#f3e5f5] px-1.5 py-0.5 rounded mt-1">{p.category}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Service row (handles normal lines, custom lines, and page-break markers) ──
function ServiceRow({
  service,
  onUpdate,
  onRemove,
}: {
  service: ServiceLine;
  onUpdate: (field: string, value: string | number) => void;
  onRemove: () => void;
}) {
  // Hooks must be called unconditionally (before any early return)
  const [showDesc, setShowDesc] = useState(service.isCustom || !!service.description);

  const handleSelect = (p: Prestation) => {
    onUpdate('name', p.name);
    onUpdate('unitPrice', p.unit_price);
    onUpdate('category', p.category ?? '');
    onUpdate('description', p.description ?? '');
    if (p.description) setShowDesc(true);
  };

  const inputCls = 'text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors bg-white';

  // ── Page-break separator row ──────────────────────────────────────────────
  if (service.isPageBreak) {
    return (
      <>
        {/* Desktop */}
        <div className="hidden sm:flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-0">
          <div className="flex-1 border-t border-dashed border-[#9c27b0]/25" />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Scissors className="h-3 w-3 text-[#9c27b0]/40" />
            <span className="text-[9px] font-semibold text-[#9c27b0]/50 uppercase tracking-[0.18em]">
              Saut de page
            </span>
          </div>
          <div className="flex-1 border-t border-dashed border-[#9c27b0]/25" />
          <button
            onClick={onRemove}
            title="Supprimer le saut de page"
            className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Mobile */}
        <div className="sm:hidden flex items-center gap-2 py-3">
          <div className="flex-1 border-t border-dashed border-[#9c27b0]/30" />
          <div className="flex items-center gap-1 px-2">
            <Scissors className="h-3 w-3 text-[#9c27b0]/40" />
            <span className="text-[9px] font-semibold text-[#9c27b0]/50 uppercase tracking-wider">Saut de page</span>
          </div>
          <div className="flex-1 border-t border-dashed border-[#9c27b0]/30" />
          <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500 rounded-lg transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Desktop ── */}
      <div className="hidden sm:block border-b border-gray-100 last:border-0">
        <div className="grid grid-cols-[1fr_68px_92px_80px_56px] gap-2 px-3 py-2 items-center">

          {/* Name field: combobox for catalog lines, plain input for custom */}
          {service.isCustom ? (
            <div className="relative">
              <input
                className={`${inputCls} w-full px-2.5 py-1.5 border-dashed border-[#9c27b0]/40 focus:border-[#9c27b0]`}
                placeholder="Titre de la prestation…"
                value={service.name}
                onChange={(e) => onUpdate('name', e.target.value)}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-[#9c27b0]/50 uppercase tracking-wider pointer-events-none">
                Perso
              </span>
            </div>
          ) : (
            <PrestationSearch
              value={service.name}
              onNameChange={(v) => onUpdate('name', v)}
              onSelect={handleSelect}
            />
          )}

          <input
            type="number" min={1}
            className={`${inputCls} px-2 py-1.5 text-center w-full`}
            value={service.quantity}
            onChange={(e) => onUpdate('quantity', parseFloat(e.target.value) || 1)}
          />
          <input
            type="number" min={0} step={0.01}
            className={`${inputCls} px-2 py-1.5 text-right w-full`}
            value={service.unitPrice}
            onChange={(e) => onUpdate('unitPrice', parseFloat(e.target.value) || 0)}
          />
          <span className="text-sm font-semibold text-gray-900 text-right tabular-nums">
            {formatCurrency(service.quantity * service.unitPrice)}
          </span>
          <div className="flex gap-0.5 justify-end">
            {!service.isCustom && (
              <button
                title={showDesc ? 'Masquer la description' : 'Ajouter une description gastronomique'}
                onClick={() => setShowDesc((v) => !v)}
                className={`p-1 rounded-lg transition-colors ${showDesc ? 'text-[#9c27b0] bg-[#f3e5f5]' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Description row — always visible for custom, toggle for catalog */}
        {showDesc && (
          <div className="px-3 pb-2 -mt-1">
            <textarea
              rows={1}
              value={service.description ?? ''}
              onChange={(e) => onUpdate('description', e.target.value)}
              placeholder={service.isCustom
                ? 'Description longue de la prestation (visible sur le devis)…'
                : 'Description gastronomique (ex: Saumon d\'Écosse mariné à l\'aneth…)'}
              className="w-full text-xs text-gray-600 italic border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] bg-gray-50 placeholder:not-italic placeholder:text-gray-400 transition-colors"
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }}
            />
          </div>
        )}
      </div>

      {/* ── Mobile card ── */}
      <div className={`sm:hidden border rounded-xl p-3 space-y-2 bg-white shadow-sm ${service.isCustom ? 'border-dashed border-[#9c27b0]/30' : 'border-gray-200'}`}>
        {service.isCustom ? (
          <div className="relative">
            <input
              className="w-full text-sm border border-dashed border-[#9c27b0]/40 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] bg-white"
              placeholder="Titre de la prestation…"
              value={service.name}
              onChange={(e) => onUpdate('name', e.target.value)}
            />
          </div>
        ) : (
          <PrestationSearch
            value={service.name}
            onNameChange={(v) => onUpdate('name', v)}
            onSelect={handleSelect}
          />
        )}
        <textarea
          rows={2}
          value={service.description ?? ''}
          onChange={(e) => onUpdate('description', e.target.value)}
          placeholder={service.isCustom ? 'Description longue…' : 'Description gastronomique (optionnel)…'}
          className="w-full text-xs text-gray-600 italic border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] bg-gray-50 placeholder:not-italic placeholder:text-gray-400 transition-colors"
        />
        <div className="flex items-end gap-2">
          {[
            { key: 'quantity', label: 'Qté', type: 'number', val: service.quantity, center: true },
            { key: 'unitPrice', label: 'PU HT', type: 'number', val: service.unitPrice, center: false },
          ].map(({ key, label, type, val, center }) => (
            <div key={key} className="flex-1 space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
              <input
                type={type} min={key === 'quantity' ? 1 : 0} step={key === 'unitPrice' ? 0.01 : 1}
                className={`${inputCls} px-2 py-2 ${center ? 'text-center' : 'text-right'} w-full`}
                value={val}
                onChange={(e) => onUpdate(key, parseFloat(e.target.value) || (key === 'quantity' ? 1 : 0))}
              />
            </div>
          ))}
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total</label>
            <p className="text-sm font-bold text-gray-900 py-2 text-right tabular-nums">
              {formatCurrency(service.quantity * service.unitPrice)}
            </p>
          </div>
          <button onClick={onRemove} className="p-2 mb-0.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StepPrestations({ onNext, onBack }: Props) {
  const { state, dispatch } = useDevis();
  const { services, options } = state;

  const addService = () =>
    dispatch({
      type: 'ADD_SERVICE',
      payload: { id: crypto.randomUUID(), name: '', description: '', quantity: 1, unitPrice: 0 },
    });

  const addCustomLine = () =>
    dispatch({
      type: 'ADD_SERVICE',
      payload: { id: crypto.randomUUID(), name: '', description: '', quantity: 1, unitPrice: 0, isCustom: true },
    });

  /** Inserts a page-break marker after the last item */
  const addPageBreak = () =>
    dispatch({
      type: 'ADD_SERVICE',
      payload: { id: crypto.randomUUID(), name: '', quantity: 0, unitPrice: 0, isPageBreak: true },
    });

  const removeService = (id: string) => dispatch({ type: 'REMOVE_SERVICE', payload: id });

  const updateService = (id: string, field: string, value: string | number) =>
    dispatch({ type: 'UPDATE_SERVICE', payload: { id, updates: { [field]: value } } });

  // Exclude page-break markers from financial calculations
  const realServices = services.filter((s) => !s.isPageBreak);
  const ht = totalHT(realServices);
  const vatAmt = ht * (options.vatRate / 100);
  const ttc = ht + vatAmt;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Prestations</h2>

        {/* Action toolbar */}
        <div className="flex items-center gap-2">
          {/* Page-break button — only useful when there are already items */}
          {services.length > 0 && (
            <button
              onClick={addPageBreak}
              title="Insérer un saut de page entre deux prestations"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#9c27b0]/70 border border-dashed border-[#9c27b0]/30 rounded-lg hover:bg-[#f3e5f5]/50 hover:border-[#9c27b0]/60 hover:text-[#9c27b0] transition-colors"
            >
              <Scissors className="h-4 w-4" />
              <span className="hidden sm:inline">Saut de page</span>
            </button>
          )}

          {/* Custom free-text line */}
          <button
            onClick={addCustomLine}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
            title="Ajouter une ligne avec titre et description libre"
          >
            <PencilLine className="h-4 w-4" />
            <span className="hidden sm:inline">Ligne personnalisée</span>
          </button>

          {/* Catalog search */}
          <button
            onClick={addService}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#9c27b0] border border-[#9c27b0]/40 rounded-lg hover:bg-[#9c27b0]/5 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Desktop table */}
      {services.length > 0 && (
        <div className="hidden sm:block border border-gray-200 rounded-xl overflow-visible">
          <div className="grid grid-cols-[1fr_68px_92px_80px_56px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide rounded-t-xl">
            <span>Désignation</span>
            <span className="text-center">Qté</span>
            <span className="text-right">PU HT</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          {services.map((s) => (
            <ServiceRow
              key={s.id} service={s}
              onUpdate={(field, value) => updateService(s.id, field, value)}
              onRemove={() => removeService(s.id)}
            />
          ))}
        </div>
      )}

      {/* Mobile cards */}
      {services.length > 0 && (
        <div className="sm:hidden space-y-2">
          {services.map((s) => (
            <ServiceRow
              key={s.id} service={s}
              onUpdate={(field, value) => updateService(s.id, field, value)}
              onRemove={() => removeService(s.id)}
            />
          ))}
        </div>
      )}

      {services.length === 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-10 text-center">
          <p className="text-sm text-gray-400 mb-3">Aucune prestation — commencez par en ajouter</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={addService} className="text-xs px-3 py-1.5 bg-[#9c27b0] text-white rounded-lg hover:bg-[#7b1fa2] transition-colors">
              Depuis le catalogue
            </button>
            <button onClick={addCustomLine} className="text-xs px-3 py-1.5 border border-dashed border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
              Ligne personnalisée
            </button>
          </div>
        </div>
      )}

      {realServices.length > 0 && (
        <div className="ml-auto w-fit min-w-[200px] space-y-1.5 bg-gray-50 rounded-xl p-4 border border-gray-100">
          <Row label="Sous-total HT" value={formatCurrency(ht)} />
          <Row label={`TVA (${options.vatRate}%)`} value={formatCurrency(vatAmt)} />
          <div className="border-t border-gray-200 pt-1.5">
            <Row label="Total TTC" value={formatCurrency(ttc)} bold />
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <ArrowLeft className="h-4 w-4" />Retour
        </button>
        <button onClick={onNext} className="flex items-center gap-2 px-6 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] transition-colors">
          Suivant<ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
