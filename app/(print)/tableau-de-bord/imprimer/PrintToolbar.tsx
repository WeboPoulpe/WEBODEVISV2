'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';

// Barre d'écran (masquée à l'impression) ; la fenêtre d'impression s'ouvre d'elle-même avec ?auto.
export default function PrintToolbar() {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('auto')) return;
    const ready = document.fonts?.ready ?? Promise.resolve();
    ready.then(() => setTimeout(() => window.print(), 300));
  }, []);
  return (
    <div className="print-toolbar" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px', borderRadius: 12, color: '#1C2621', fontWeight: 500 }}>
        <ArrowLeft size={16} />Tableau de bord
      </Link>
      <button onClick={() => window.print()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 18px', borderRadius: 12, background: '#B4502D', color: '#fff', fontWeight: 600 }}>
        <Printer size={16} />Imprimer ou PDF
      </button>
    </div>
  );
}
