'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
export interface ServiceLine {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  category?: string;
  /** true = ligne saisie manuellement (pas depuis le catalogue) */
  isCustom?: boolean;
  /** true = séparateur de saut de page (non imprimé comme prestation) */
  isPageBreak?: boolean;
}

export type QuoteTemplate = 'standard' | 'mariage' | 'business';

export interface DevisState {
  currentStep: number;
  /** Visual template for the quote document */
  template: QuoteTemplate;
  /** true when editing an existing quote (vs creating a new one) */
  isEditing: boolean;
  /** ID of the quote being edited, null in create mode */
  editingQuoteId: string | null;
  /** Original status of the quote being edited, used to detect accepted→modified */
  editingQuoteStatus: string | null;
  /** ID of the quote after it has been saved (used to pass to step 5 WeboWord) */
  savedQuoteId: string | null;
  clientInfo: {
    type: 'particulier' | 'entreprise';
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    companyName: string;
    siret: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  };
  eventInfo: {
    eventType: string;
    eventDate: string;
    guestCount: number;
    eventLocation: string;
  };
  services: ServiceLine[];
  options: {
    remarks: string;
    conditions: string;
    vatRate: number;
    hidePrice: boolean;
    images: string[];
  };
}

// ── Actions ──────────────────────────────────────────────────────────────────
type Action =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_TEMPLATE'; payload: QuoteTemplate }
  | { type: 'UPDATE_CLIENT'; payload: Partial<DevisState['clientInfo']> }
  | { type: 'UPDATE_EVENT'; payload: Partial<DevisState['eventInfo']> }
  | { type: 'ADD_SERVICE'; payload: ServiceLine }
  | { type: 'REMOVE_SERVICE'; payload: string }
  | { type: 'UPDATE_SERVICE'; payload: { id: string; updates: Partial<ServiceLine> } }
  | { type: 'UPDATE_OPTIONS'; payload: Partial<DevisState['options']> }
  | { type: 'SET_SAVED_QUOTE_ID'; payload: string }
  | { type: 'RESET' };

// ── Default state ─────────────────────────────────────────────────────────────
const DEFAULT: DevisState = {
  currentStep: 1,
  template: 'standard',
  isEditing: false,
  editingQuoteId: null,
  editingQuoteStatus: null,
  savedQuoteId: null,
  clientInfo: {
    type: 'particulier',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    companyName: '',
    siret: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  },
  eventInfo: { eventType: '', eventDate: '', guestCount: 1, eventLocation: '' },
  services: [],
  options: { remarks: '', conditions: '', vatRate: 20, hidePrice: false, images: [] },
};

const SESSION_KEY = 'webodevis_draft';

// ── Lazy initializer: restore from sessionStorage if available ────────────────
function getInitialState(): DevisState {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return DEFAULT;
    const parsed = JSON.parse(saved) as DevisState;
    return {
      ...DEFAULT,   // fill any fields missing in old sessionStorage data
      ...parsed,
      // Always reset edit-mode flags when restoring from sessionStorage
      currentStep: 1,
      isEditing: false,
      editingQuoteId: null,
      editingQuoteStatus: null,
    };
  } catch {
    return DEFAULT;
  }
}

// ── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state: DevisState, action: Action): DevisState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_TEMPLATE':
      return { ...state, template: action.payload };
    case 'UPDATE_CLIENT':
      return { ...state, clientInfo: { ...state.clientInfo, ...action.payload } };
    case 'UPDATE_EVENT':
      return { ...state, eventInfo: { ...state.eventInfo, ...action.payload } };
    case 'ADD_SERVICE':
      return { ...state, services: [...state.services, action.payload] };
    case 'REMOVE_SERVICE':
      return { ...state, services: state.services.filter((s) => s.id !== action.payload) };
    case 'UPDATE_SERVICE':
      return {
        ...state,
        services: state.services.map((s) =>
          s.id === action.payload.id ? { ...s, ...action.payload.updates } : s,
        ),
      };
    case 'UPDATE_OPTIONS':
      return { ...state, options: { ...state.options, ...action.payload } };
    case 'SET_SAVED_QUOTE_ID':
      return { ...state, savedQuoteId: action.payload };
    case 'RESET':
      return DEFAULT;
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────
const DevisContext = createContext<{
  state: DevisState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function DevisProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  /**
   * When provided (edit mode), skips sessionStorage entirely and uses this
   * state directly. Changes are NOT persisted to sessionStorage in edit mode.
   */
  initialState?: DevisState;
}) {
  // Remember whether we started in edit mode — captured once at mount.
  const isEditModeRef = useRef(!!initialState);

  const [state, rawDispatch] = useReducer(
    reducer,
    undefined,
    (_: undefined): DevisState => initialState ?? getInitialState(),
  );

  // Persist to sessionStorage — only in create mode to avoid stale edit data
  useEffect(() => {
    if (isEditModeRef.current) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch {
      // Ignore (private mode, storage full, etc.)
    }
  }, [state]);

  // Wrap dispatch to clear sessionStorage on RESET
  const dispatch = useCallback((action: Action) => {
    if (action.type === 'RESET') {
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    }
    rawDispatch(action);
  }, []);

  return (
    <DevisContext.Provider value={{ state, dispatch }}>
      {children}
    </DevisContext.Provider>
  );
}

export function useDevis() {
  const ctx = useContext(DevisContext);
  if (!ctx) throw new Error('useDevis must be used within DevisProvider');
  return ctx;
}

// ── Selectors ────────────────────────────────────────────────────────────────
export function totalHT(services: ServiceLine[]) {
  return services.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
}
