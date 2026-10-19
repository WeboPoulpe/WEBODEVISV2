'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { btnGhost, btnPrimary } from '@/components/ui/kit';

// Barre d'écran de la page d'impression (masquée à l'impression) ; avec ?auto la fenêtre d'impression
// s'ouvre d'elle-même, une fois les polices et le logo chargés.
export default function InvoicePrintToolbar({ invoiceId }: { invoiceId: string }) {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('auto')) return;
    const ready = document.fonts?.ready ?? Promise.resolve();
    let t: ReturnType<typeof setTimeout>;
    ready.then(() => { t = setTimeout(() => window.print(), 300); });
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print flex items-center justify-between gap-3 max-w-[210mm] mx-auto px-4 py-4">
      <Link href={`/factures/${invoiceId}`} className={btnGhost}><ArrowLeft className="h-4 w-4" />Retour à la facture</Link>
      <button onClick={() => window.print()} className={btnPrimary}><Printer className="h-4 w-4" />Imprimer ou PDF</button>
    </div>
  );
}
