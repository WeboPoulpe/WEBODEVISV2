'use client';

import { Printer } from 'lucide-react';

export default function ExtraPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors print:hidden"
    >
      <Printer className="h-4 w-4" />
      Imprimer ma fiche
    </button>
  );
}
