'use client';

import { useMemo } from 'react';
import { Eye, X, ChefHat } from 'lucide-react';
import { useState } from 'react';
import { useDevis } from '@/context/DevisContext';
import { useAuth } from '@/context/AuthContext';
import { generateQuoteHtml } from '@/lib/generateQuoteHtml';

// ── Build HTML from context ────────────────────────────────────────────────────
function useQuoteHtml() {
  const { state } = useDevis();
  const { profile } = useAuth();
  const { clientInfo, eventInfo, services, options, template } = state;

  const clientName =
    clientInfo.type === 'particulier'
      ? `${clientInfo.firstName} ${clientInfo.lastName}`.trim()
      : clientInfo.companyName;

  return useMemo(
    () =>
      generateQuoteHtml(
        {
          companyName: profile?.company_name ?? 'Votre entreprise',
          clientName: clientName || 'Client',
          clientEmail: clientInfo.email,
          clientPhone: clientInfo.phone,
          clientAddress: clientInfo.address,
          eventType: eventInfo.eventType,
          eventDate: eventInfo.eventDate,
          eventLocation: eventInfo.eventLocation,
          guestCount: eventInfo.guestCount,
          services: services
            .filter((s) => !s.isPageBreak)
            .map((s) => ({
              name: s.name,
              description: s.description,
              quantity: s.quantity,
              unitPrice: s.unitPrice,
              hideDescOnPdf: s.hideDescOnPdf,
            })),
          vatRate: options.vatRate,
          remarks: options.remarks,
          hidePrice: options.hidePrice,
        },
        { template: template as 'standard' | 'mariage' | 'business' },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, profile?.company_name],
  );
}

// ── Desktop panel ─────────────────────────────────────────────────────────────
export function LivePreview() {
  const html = useQuoteHtml();

  return (
    <div className="h-full flex flex-col bg-gray-50/50">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <Eye className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-700 flex-1">Aperçu temps réel · WeboWord</span>
      </div>

      {/* Document — scaled via zoom */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        <div
          style={{ width: '794px', zoom: 0.55, transformOrigin: 'top left' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

// ── Mobile FAB ────────────────────────────────────────────────────────────────
export function LivePreviewFAB() {
  const [open, setOpen] = useState(false);
  const html = useQuoteHtml();

  return (
    <div className="lg:hidden print:hidden">
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-4 py-3 bg-[#9c27b0] text-white rounded-full shadow-xl hover:bg-[#7b1fa2] transition-colors"
      >
        <Eye className="h-5 w-5" />
        <span className="text-sm font-medium">Aperçu</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-[#9c27b0]" />
                <span className="font-semibold text-gray-900 text-sm">Aperçu du devis</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
              <div
                style={{ width: '794px', zoom: 0.42, transformOrigin: 'top left' }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
