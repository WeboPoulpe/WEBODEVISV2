'use client';

import { useEffect, useState } from 'react';
import { useDevis } from '@/context/DevisContext';
import { useAuth } from '@/context/AuthContext';
import { generateQuoteHtml } from '@/lib/generateQuoteHtml';
import { createClient } from '@/lib/supabase/client';
import WeboWordEditor from '../WeboWordEditor';
import { Loader2 } from 'lucide-react';

interface Props {
  onBack: () => void;
}

/**
 * Step 5 of the wizard — wraps WeboWordEditor.
 * Fetches the just-saved quote to check for existing content_html,
 * then either loads the saved version or generates fresh HTML from
 * the wizard state.
 */
export default function StepWeboWord({ onBack }: Props) {
  const { state } = useDevis();
  const { profile } = useAuth();

  const quoteId     = state.savedQuoteId;
  const companyName = profile?.company_name ?? 'Votre entreprise';

  const clientName =
    state.clientInfo.type === 'particulier'
      ? `${state.clientInfo.firstName} ${state.clientInfo.lastName}`.trim()
      : state.clientInfo.companyName;

  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const [savedFont,   setSavedFont]   = useState<string | undefined>(undefined);
  const [loading, setLoading]         = useState(true);

  const buildHtml = () =>
    generateQuoteHtml(
      {
        companyName,
        clientName: clientName || 'Client',
        clientEmail:   state.clientInfo.email,
        clientPhone:   state.clientInfo.phone,
        clientAddress: state.clientInfo.address,
        eventType:     state.eventInfo.eventType,
        eventDate:     state.eventInfo.eventDate,
        eventLocation: state.eventInfo.eventLocation,
        guestCount:    state.eventInfo.guestCount,
        services: state.services
          .filter((s) => !s.isPageBreak)
          .map((s) => ({
            name:         s.name,
            description:  s.description,
            quantity:     s.quantity,
            unitPrice:    s.unitPrice,
            hideDescOnPdf: s.hideDescOnPdf,
          })),
        vatRate:   state.options.vatRate,
        remarks:   state.options.remarks,
        hidePrice: state.options.hidePrice,
      },
      { template: state.template },
    );

  useEffect(() => {
    if (!quoteId) {
      setInitialHtml(buildHtml());
      setLoading(false);
      return;
    }

    // Fetch saved quote — use existing content_html if already set
    const supabase = createClient();
    supabase
      .from('quotes')
      .select('content_html, selected_font')
      .eq('id', quoteId)
      .single()
      .then(({ data }) => {
        setInitialHtml(data?.content_html ?? buildHtml());
        if (data?.selected_font) setSavedFont(data.selected_font);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  if (loading || !initialHtml) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="h-7 w-7 text-[#9c27b0] animate-spin" />
      </div>
    );
  }

  if (!quoteId) {
    return (
      <div className="flex items-center justify-center h-full py-24 text-red-500 text-sm">
        Erreur : identifiant du devis introuvable.
      </div>
    );
  }

  return (
    <WeboWordEditor
      quoteId={quoteId}
      initialHtml={initialHtml}
      clientName={clientName || undefined}
      onBack={onBack}
      selectedFont={savedFont}
    />
  );
}
