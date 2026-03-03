'use client';

import { useEffect } from 'react';

/** Triggers window.print() once the page has mounted. */
export default function AutoPrint() {
  useEffect(() => {
    // Small delay to let fonts / images render before the print dialog
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);

  return null;
}
