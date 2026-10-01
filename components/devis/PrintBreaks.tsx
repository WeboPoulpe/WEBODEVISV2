'use client';

import { useEffect } from 'react';
import { LONG_DISH_PX, markLongDishes } from '@/lib/quoteOutput';

/**
 * Sauts de page de la carte : marque les plats longs (voir markLongDishes) une fois les polices chargées, puis
 * à chaque impression. Même règle que la fenêtre d'impression de l'éditeur, donc même nombre de pages.
 */
export default function PrintBreaks() {
  useEffect(() => {
    let alive = true;
    const run = () => { if (alive) markLongDishes(document, LONG_DISH_PX); };
    run();
    document.fonts?.ready.then(run);
    window.addEventListener('load', run); // images
    window.addEventListener('beforeprint', run);
    return () => { alive = false; window.removeEventListener('load', run); window.removeEventListener('beforeprint', run); };
  }, []);
  return null;
}
