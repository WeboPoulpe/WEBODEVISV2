'use client';

import { useDevis } from '@/context/DevisContext';
import type { QuoteTemplate } from '@/context/DevisContext';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ImageUpload from '@/components/ui/ImageUpload';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const VAT_RATES = [0, 5.5, 10, 20];

const TEMPLATES: { key: QuoteTemplate; label: string; sub: string; preview: React.ReactNode }[] = [
  {
    key: 'standard',
    label: 'Gastronomique',
    sub: 'Classique violet — catégories de menu',
    preview: (
      <div className="w-full h-12 bg-[#9c27b0] rounded-lg flex items-end px-2 pb-1.5">
        <div className="space-y-1 w-full">
          <div className="h-1.5 bg-white/30 rounded-full w-3/4" />
          <div className="h-1 bg-white/20 rounded-full w-1/2" />
        </div>
      </div>
    ),
  },
  {
    key: 'mariage',
    label: 'Mariage',
    sub: 'Ivoire & or rosé — élégant et romantique',
    preview: (
      <div className="w-full h-12 bg-[#fffdf7] border border-[#c8956c]/30 rounded-lg flex items-center justify-center">
        <span className="font-serif text-[10px] text-[#c8956c] tracking-[0.2em]">❧ Mariage ❧</span>
      </div>
    ),
  },
  {
    key: 'business',
    label: 'Business',
    sub: 'Ardoise & blanc — structuré et professionnel',
    preview: (
      <div className="w-full h-12 bg-white border border-slate-200 rounded-lg overflow-hidden flex">
        <div className="w-1.5 bg-slate-900 flex-shrink-0" />
        <div className="flex-1 p-2 space-y-1">
          <div className="h-1.5 bg-slate-800 rounded-full w-2/3" />
          <div className="h-1 bg-slate-200 rounded-full w-full" />
          <div className="h-1 bg-slate-100 rounded-full w-4/5" />
        </div>
      </div>
    ),
  },
];

export default function StepOptions({ onNext, onBack }: Props) {
  const { state, dispatch } = useDevis();
  const { options, template } = state;
  const { user } = useAuth();

  const set = (field: string, value: unknown) =>
    dispatch({ type: 'UPDATE_OPTIONS', payload: { [field]: value } });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-base font-semibold text-gray-900">Options</h2>

      {/* ── Template selector ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Modèle de document</label>
        <div className="grid grid-cols-3 gap-3">
          {TEMPLATES.map(({ key, label, sub, preview }) => (
            <button
              key={key}
              type="button"
              onClick={() => dispatch({ type: 'SET_TEMPLATE', payload: key })}
              className={[
                'text-left rounded-xl border-2 p-3 transition-all',
                template === key
                  ? 'border-[#9c27b0] bg-[#f3e5f5]/30 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white',
              ].join(' ')}
            >
              <div className="mb-2">{preview}</div>
              <p className="text-xs font-semibold text-gray-900">{label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{sub}</p>
              {template === key && (
                <span className="inline-block mt-1.5 text-[9px] font-semibold text-[#9c27b0] bg-[#f3e5f5] px-1.5 py-0.5 rounded-full">
                  Sélectionné
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── TVA ────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Taux de TVA</label>
        <div className="flex flex-wrap gap-2">
          {VAT_RATES.map((rate) => (
            <button
              key={rate}
              onClick={() => set('vatRate', rate)}
              className={[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                options.vatRate === rate
                  ? 'bg-[#9c27b0] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              ].join(' ')}
            >
              {rate === 0 ? 'Exonéré' : `${rate}%`}
            </button>
          ))}
        </div>
      </section>

      {/* ── Hide prices ────────────────────────────────────────────────────── */}
      <section>
        <label className="flex items-center gap-3 cursor-pointer group">
          <div
            onClick={() => set('hidePrice', !options.hidePrice)}
            className={[
              'relative w-10 h-6 rounded-full transition-colors',
              options.hidePrice ? 'bg-[#9c27b0]' : 'bg-gray-200',
            ].join(' ')}
          >
            <div
              className={[
                'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                options.hidePrice ? 'translate-x-5' : 'translate-x-1',
              ].join(' ')}
            />
          </div>
          <span className="text-sm font-medium text-gray-700">Masquer les prix dans le devis</span>
        </label>
        <p className="text-xs text-gray-400 mt-1 ml-[52px]">
          Le client verra les prestations sans les montants
        </p>
      </section>

      {/* ── Photos ─────────────────────────────────────────────────────────── */}
      {user && (
        <section className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Photos du menu</label>
          <p className="text-xs text-gray-400">Illustrez vos prestations — affichées avant la signature du devis</p>
          <ImageUpload
            images={options.images}
            onChange={(urls) => set('images', urls)}
            userId={user.id}
          />
        </section>
      )}

      {/* ── Remarques ──────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Remarques / Conditions</label>
        <textarea
          rows={5}
          value={options.remarks}
          onChange={(e) => set('remarks', e.target.value)}
          placeholder="Conditions de paiement, modalités d'annulation…"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors resize-none"
        />
      </section>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] transition-colors"
        >
          Voir le récapitulatif
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
