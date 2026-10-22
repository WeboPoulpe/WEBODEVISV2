'use client';

// Le formulaire de la brochure en plein écran (téléphone) : confortable à remplir, avec un retour au livre.

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function FormSheet({ open, onClose, title, language, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  language: 'fr' | 'en';
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      className="fixed inset-0 z-50 overflow-y-auto bg-[#FBF7F0] text-[#1C2621]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      <div className="mx-auto max-w-md px-5 pb-10 pt-4">
        <button type="button" onClick={onClose}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-sm text-[#5b5b55]">
          <ArrowLeft className="h-4 w-4" /> {language === 'en' ? 'Back to the brochure' : 'Revenir au livre'}
        </button>
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4502D]">{title}</p>
        {children}
      </div>
    </div>
  );
}
