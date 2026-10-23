'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import Modal from './Modal';
import { btnPrimary, btnSecondary } from './kit';
import { cn } from '@/lib/utils';
import { addToast, toastDuration, toastRole, type FeedbackTone, type Toast } from '@/lib/feedback';

// Fenêtres de confirmation et bandeaux de message de l'app, à la place des fenêtres du navigateur.
// Le fournisseur est placé une fois dans la coque (AppShell, AdminShell) ; les pages appellent useFeedback().

export interface ConfirmOptions {
  /** Question courte : « Supprimer ce devis ? » */
  title: string;
  /** Précision sous la question (les retours à la ligne sont respectés). */
  message?: string;
  /** Texte du bouton de confirmation (« Confirmer » par défaut, « Supprimer » pour une action dangereuse). */
  confirmLabel?: string;
  /** Action irréversible : bouton rouge, et le focus va sur « Annuler ». */
  danger?: boolean;
  /** Texte du bouton qui refuse (« Annuler » par défaut), quand refuser est un autre choix (« En gratuit cette fois »). */
  cancelLabel?: string;
}

export interface NotifyOptions {
  tone?: FeedbackTone;
}

interface FeedbackApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  notify: (message: string, options?: NotifyOptions) => void;
}

// Hors d'un fournisseur (cas imprévu), on retombe sur les fenêtres du navigateur pour ne rien bloquer.
const fallback: FeedbackApi = {
  confirm: async ({ title, message }) => (typeof window === 'undefined' ? false : window.confirm(message ? `${title}\n\n${message}` : title)),
  notify: (message) => { if (typeof window !== 'undefined') window.alert(message); },
};

const FeedbackContext = createContext<FeedbackApi>(fallback);

export function useFeedback(): FeedbackApi {
  return useContext(FeedbackContext);
}

interface PendingConfirm extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

const TONE_STYLE: Record<FeedbackTone, { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: 'text-gray-500' },
  success: { icon: CheckCircle2, cls: 'text-forest' },
  error: { icon: AlertCircle, cls: 'text-danger' },
};

interface ProviderProps {
  children: React.ReactNode;
  /** Les bandeaux se placent au-dessus de la barre d'onglets du téléphone (faux dans l'administration, qui n'en a pas). */
  aboveTabBar?: boolean;
}

export function FeedbackProvider({ children, aboveTabBar = true }: ProviderProps) {
  // Les demandes de confirmation passent une par une, dans l'ordre.
  const [queue, setQueue] = useState<PendingConfirm[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const notify = useCallback((message: string, options?: NotifyOptions) => {
    const tone = options?.tone ?? 'info';
    const id = nextId.current++;
    setToasts((list) => addToast(list, { id, message, tone }));
    timers.current.set(id, setTimeout(() => dismiss(id), toastDuration(tone)));
  }, [dismiss]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setQueue((q) => [...q, { ...options, id: nextId.current++, resolve }]);
  }), []);

  useEffect(() => {
    const all = timers.current;
    return () => { all.forEach(clearTimeout); all.clear(); };
  }, []);

  const api = useMemo(() => ({ confirm, notify }), [confirm, notify]);
  const current = queue[0];

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      {current && <ConfirmDialog key={current.id} request={current} onDone={(ok) => { current.resolve(ok); setQueue((q) => q.slice(1)); }} />}
      {mounted && toasts.length > 0 && createPortal(
        <div className="fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
          style={{ bottom: aboveTabBar ? 'calc(var(--tabbar-h) + 12px)' : 'max(16px, env(safe-area-inset-bottom))' }}>
          {toasts.map((t) => {
            const { icon: Icon, cls } = TONE_STYLE[t.tone];
            return (
              <div key={t.id} role={toastRole(t.tone)}
                className="pointer-events-auto w-full max-w-md flex items-start gap-3 pl-4 pr-2 py-2.5 rounded-2xl bg-white border border-gray-200 shadow-float animate-sheet-up">
                <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${cls}`} aria-hidden />
                <p className="flex-1 min-w-0 py-0.5 text-[15px] text-gray-900 whitespace-pre-line">{t.message}</p>
                <button onClick={() => dismiss(t.id)} aria-label="Fermer le message"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900 flex-shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </FeedbackContext.Provider>
  );
}

function ConfirmDialog({ request, onDone }: { request: PendingConfirm; onDone: (ok: boolean) => void }) {
  const { title, message, confirmLabel, danger, cancelLabel } = request;
  // Le focus revient où il était une fois la fenêtre fermée.
  const previous = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement);
  const done = useRef(false);
  const finish = useCallback((ok: boolean) => {
    if (done.current) return; // double clic : une seule réponse
    done.current = true;
    onDone(ok);
    const el = previous.current;
    if (el instanceof HTMLElement) setTimeout(() => el.focus(), 0);
  }, [onDone]);
  const cancel = useCallback(() => finish(false), [finish]);

  return (
    <Modal title={title} onClose={cancel}
      footer={
        <>
          <button type="button" onClick={cancel} autoFocus={!!danger} className={btnSecondary}>{cancelLabel ?? 'Annuler'}</button>
          <button type="button" onClick={() => finish(true)} autoFocus={!danger}
            className={cn(btnPrimary, danger && 'bg-danger hover:bg-danger/90')}>
            {confirmLabel ?? (danger ? 'Supprimer' : 'Confirmer')}
          </button>
        </>
      }>
      {message ? <p className="text-[15px] text-gray-600 whitespace-pre-line">{message}</p> : null}
    </Modal>
  );
}
