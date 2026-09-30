'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { iconBtn } from './kit';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Boutons d'action, affichés en pied de fenêtre et toujours visibles. */
  footer?: React.ReactNode;
  /** Fenêtre plus large sur grand écran, pour un contenu en grille. */
  wide?: boolean;
}

// Fenêtre de dialogue : feuille qui monte du bas sur téléphone, fenêtre centrée sur grand écran.
// Le contenu défile à l'intérieur ; le pied reste accessible, au-dessus de la barre d'onglets.
export default function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'} max-h-[92dvh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-float animate-sheet-up sm:animate-none`}>
        <div className="flex items-center justify-between gap-3 pl-5 pr-3 pt-4 pb-2 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className={iconBtn} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">{children}</div>
        {footer && (
          <div className="flex-shrink-0 flex items-center justify-end gap-2 px-5 pt-3 border-t border-gray-200" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
