'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { btnGhost, btnPrimary } from '@/components/ui/kit';

// Barre d'écran de la fiche allergènes (masquée à l'impression).
export default function AllergenSheetToolbar({ quoteId }: { quoteId: string }) {
  return (
    <div className="no-print flex items-center justify-between gap-3 max-w-[297mm] mx-auto px-4 py-4">
      <Link href={`/evenements/${quoteId}`} className={btnGhost}><ArrowLeft className="h-4 w-4" />Retour</Link>
      <button onClick={() => window.print()} className={btnPrimary}><Printer className="h-4 w-4" />Imprimer ou PDF</button>
    </div>
  );
}
