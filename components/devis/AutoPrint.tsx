'use client';

import { useEffect } from 'react';
import { printLight } from '@/lib/printImages';

/** Ouvre la fenêtre d'impression une fois la page affichée, photos allégées (PDF léger). */
export default function AutoPrint() {
  useEffect(() => {
    // Petit délai : polices et images se mettent en place avant la fenêtre d'impression.
    const t = setTimeout(() => { printLight(); }, 300);
    return () => clearTimeout(t);
  }, []);

  return null;
}
