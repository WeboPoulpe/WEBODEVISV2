'use client';

import { Download } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex-shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
    >
      <Download className="h-4 w-4" />
      Enregistrer en PDF
    </button>
  );
}
