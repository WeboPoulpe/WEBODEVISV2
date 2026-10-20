'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { btnGhost, btnPrimary } from '@/components/ui/kit';

// Barre d'écran des documents imprimables de l'événement (feuille de route, fiches de production).
// Masquée à l'impression.
export default function RunSheetToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="no-print flex items-center justify-between gap-3 max-w-[210mm] mx-auto px-4 py-4">
      <Link href={backHref} className={btnGhost}><ArrowLeft className="h-4 w-4" />Retour</Link>
      <button onClick={() => window.print()} className={btnPrimary}><Printer className="h-4 w-4" />Imprimer ou PDF</button>
    </div>
  );
}
