'use client';

import Link from 'next/link';
import { Pencil, ArrowLeft } from 'lucide-react';
import type { DevisState } from '@/context/DevisContext';
import { DevisProvider } from '@/context/DevisContext';
import DevisStepper from './DevisStepper';
import { LivePreview, LivePreviewFAB } from './LivePreview';

interface Props {
  initialState: DevisState;
}

/**
 * Edit-mode counterpart of DevisCreateView.
 * Passes the pre-loaded quote data as `initialState` to DevisProvider so the
 * stepper and live-preview are populated immediately without any flash.
 */
export default function DevisEditView({ initialState }: Props) {
  return (
    <DevisProvider initialState={initialState}>
      <div className="flex h-full">

        {/* ── Left column : stepper ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-y-auto print:hidden flex flex-col">

          {/* Edit-mode banner */}
          <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
            <Pencil className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700">
              Mode édition — les modifications écraseront le devis existant
            </span>
            <Link
              href="/devis"
              className="ml-auto flex items-center gap-1 text-xs text-amber-600 hover:text-amber-900 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Annuler
            </Link>
          </div>

          <div className="flex-1">
            <DevisStepper />
          </div>
        </div>

        {/* ── Right column : live preview (desktop only, full-width on print) */}
        <div className="hidden lg:flex print:!flex flex-col w-[380px] print:!w-full flex-shrink-0 border-l border-gray-200 print:border-0 bg-white sticky top-0 h-screen print:h-auto overflow-hidden print:overflow-visible">
          <LivePreview />
        </div>

        {/* Mobile FAB */}
        <LivePreviewFAB />
      </div>
    </DevisProvider>
  );
}
