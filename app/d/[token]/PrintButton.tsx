'use client';

import { Download } from 'lucide-react';
import { printLight } from '@/lib/printImages';

export default function PrintButton() {
  return (
    <button
      // Photos allégées avant l'impression : le PDF enregistré par le client reste léger.
      onClick={() => { printLight(); }}
      className="flex-shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
    >
      <Download className="h-4 w-4" />
      Enregistrer en PDF
    </button>
  );
}
