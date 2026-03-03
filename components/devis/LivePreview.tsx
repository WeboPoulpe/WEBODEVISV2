'use client';

import { useState } from 'react';
import { Eye, X, ChefHat, Pencil, Check } from 'lucide-react';
import { useDevis } from '@/context/DevisContext';
import { useAuth } from '@/context/AuthContext';
import QuoteDocument from './QuoteDocument';
import QuoteDocumentMariage from './QuoteDocumentMariage';
import QuoteDocumentBusiness from './QuoteDocumentBusiness';

// ── Build QuoteDocument props from context ─────────────────────────────────
function useDocumentProps() {
  const { state } = useDevis();
  const { profile } = useAuth();
  const { clientInfo, eventInfo, services, options } = state;

  const clientName =
    clientInfo.type === 'particulier'
      ? `${clientInfo.firstName} ${clientInfo.lastName}`.trim()
      : clientInfo.companyName;

  return {
    companyName: profile?.company_name ?? 'Votre entreprise',
    companyAddress: profile?.company_address,
    companyPhone: profile?.company_phone,
    clientName,
    eventType: eventInfo.eventType,
    eventDate: eventInfo.eventDate || null,
    guestCount: eventInfo.guestCount,
    services,
    options: { vatRate: options.vatRate, hidePrice: options.hidePrice, remarks: options.remarks },
    images: options.images,
  };
}

// ── Pick the right QuoteDocument component ────────────────────────────────────
function TemplateDocument({
  template, ...props
}: ReturnType<typeof useDocumentProps> & {
  template: string;
  editMode?: boolean;
  onEditServiceName?: (id: string, v: string) => void;
  onEditEventType?: (v: string) => void;
  onEditRemarks?: (v: string) => void;
}) {
  if (template === 'mariage') return <QuoteDocumentMariage {...props} />;
  if (template === 'business') return <QuoteDocumentBusiness {...props} />;
  return <QuoteDocument {...props} />;
}

// ── Desktop panel ─────────────────────────────────────────────────────────────
export function LivePreview() {
  const { state, dispatch } = useDevis();
  const docProps = useDocumentProps();
  const [editMode, setEditMode] = useState(false);

  return (
    <div className="h-full flex flex-col bg-gray-50/50">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <Eye className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-700 flex-1">Aperçu · Carte de Menu</span>

        {/* Edit mode toggle */}
        <button
          onClick={() => setEditMode((v) => !v)}
          title={editMode ? 'Quitter l\'édition directe' : 'Édition directe — cliquez sur le texte pour modifier'}
          className={[
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors print:hidden',
            editMode
              ? 'bg-[#9c27b0] text-white hover:bg-[#7b1fa2]'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ].join(' ')}
        >
          {editMode ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
          {editMode ? 'Terminé' : 'Éditer'}
        </button>
      </div>

      {/* Edit mode hint */}
      {editMode && (
        <div className="px-4 py-1.5 bg-[#f3e5f5]/60 border-b border-[#9c27b0]/10 flex-shrink-0 print:hidden">
          <p className="text-[10px] text-[#9c27b0]/80 italic text-center">
            Cliquez sur un texte du document pour le modifier directement
          </p>
        </div>
      )}

      {/* Document */}
      <div className="flex-1 overflow-y-auto p-4">
        <TemplateDocument
          {...docProps}
          template={state.template}
          editMode={editMode}
          onEditServiceName={(id, v) =>
            dispatch({ type: 'UPDATE_SERVICE', payload: { id, updates: { name: v } } })
          }
          onEditEventType={(v) =>
            dispatch({ type: 'UPDATE_EVENT', payload: { eventType: v } })
          }
          onEditRemarks={(v) =>
            dispatch({ type: 'UPDATE_OPTIONS', payload: { remarks: v } })
          }
        />
      </div>
    </div>
  );
}

// ── Mobile FAB ────────────────────────────────────────────────────────────────
export function LivePreviewFAB() {
  const [open, setOpen] = useState(false);
  const { state } = useDevis();
  const docProps = useDocumentProps();

  return (
    <div className="lg:hidden print:hidden">
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-[#9c27b0] text-white rounded-full shadow-xl hover:bg-[#7b1fa2] transition-colors"
      >
        <Eye className="h-5 w-5" />
        <span className="text-sm font-medium">Menu</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-[#9c27b0]" />
                <span className="font-semibold text-gray-900 text-sm">Carte de Menu</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <TemplateDocument {...docProps} template={state.template} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
