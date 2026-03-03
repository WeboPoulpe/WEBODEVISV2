'use client';

import { useDevis, totalHT } from '@/context/DevisContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Pencil, Loader2, Printer, AlertTriangle, RefreshCw, FileEdit } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface Props {
  onBack: () => void;
}

export default function StepResume({ onBack }: Props) {
  const { state, dispatch } = useDevis();
  const { clientInfo, eventInfo, services, options } = state;
  const { user } = useAuth();

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Status selection for accepted-quote alert (only shown when editing an accepted quote)
  const [newStatus, setNewStatus] = useState<string>(state.editingQuoteStatus ?? 'draft');

  const realServices = services.filter((s) => !s.isPageBreak);
  const ht    = totalHT(realServices);
  const vatAmt = ht * (options.vatRate / 100);
  const ttc   = ht + vatAmt;

  const clientName =
    clientInfo.type === 'particulier'
      ? `${clientInfo.firstName} ${clientInfo.lastName}`.trim()
      : clientInfo.companyName;

  const goTo = (step: number) => dispatch({ type: 'SET_STEP', payload: step });

  // ── Shared quote payload ────────────────────────────────────────────────────
  const quotePayload = {
    client_name:          clientName || 'Client sans nom',
    client_first_name:    clientInfo.firstName,
    client_last_name:     clientInfo.lastName,
    client_email:         clientInfo.email,
    client_phone:         clientInfo.phone,
    client_address:       clientInfo.address,
    client_type:          clientInfo.type,
    company_name:         clientInfo.companyName,
    contact_person_name:  clientInfo.contactName,
    event_type:           eventInfo.eventType,
    event_date:           eventInfo.eventDate || null,
    event_location:       eventInfo.eventLocation || null,
    guest_count:          eventInfo.guestCount || null,
    remarks:              options.remarks,
    vat_rate:             options.vatRate,
    hide_price:           options.hidePrice,
    total_amount:         ttc,
    services:             services, // full array incl. page-break markers
    template:             state.template,
    images:               options.images,
  };

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();

    if (state.isEditing && state.editingQuoteId) {
      // ── UPDATE existing quote ──────────────────────────────────────────────
      const finalStatus =
        state.editingQuoteStatus === 'accepted'
          ? newStatus
          : (state.editingQuoteStatus ?? 'draft');

      const { error: err } = await supabase
        .from('quotes')
        .update({ ...quotePayload, status: finalStatus })
        .eq('id', state.editingQuoteId);

      setSaving(false);
      if (err) {
        setError(err.message);
      } else {
        // Go to WeboWord (step 5) with the existing quote id
        dispatch({ type: 'SET_SAVED_QUOTE_ID', payload: state.editingQuoteId });
        dispatch({ type: 'SET_STEP', payload: 5 });
      }

    } else {
      // ── INSERT new quote — retrieve the new id ─────────────────────────────
      const { data: inserted, error: err } = await supabase
        .from('quotes')
        .insert([{ ...quotePayload, user_id: user.id, owner_user_id: user.id, status: 'draft' }])
        .select('id')
        .single();

      setSaving(false);
      if (err || !inserted) {
        setError(err?.message ?? 'Erreur lors de la création du devis.');
      } else {
        // Go to WeboWord (step 5) with the new quote id
        dispatch({ type: 'SET_SAVED_QUOTE_ID', payload: inserted.id });
        dispatch({ type: 'SET_STEP', payload: 5 });
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="text-base font-semibold text-gray-900">
        {state.isEditing ? 'Récapitulatif des modifications' : 'Récapitulatif'}
      </h2>

      {/* ── Status alert — only shown when editing an accepted quote ───────── */}
      {state.isEditing && state.editingQuoteStatus === 'accepted' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 text-sm">Ce devis a été accepté</p>
              <p className="text-amber-700 text-xs mt-0.5">
                Vous allez modifier un devis déjà accepté. Quel statut souhaitez-vous appliquer après la mise à jour ?
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-8">
            {[
              { value: 'accepted', label: '✓ Conserver Accepté' },
              { value: 'sent',     label: 'Repasser en Envoyé' },
              { value: 'draft',    label: 'Repasser en Brouillon' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setNewStatus(opt.value)}
                className={[
                  'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                  newStatus === opt.value
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Recap cards ──────────────────────────────────────────────────────── */}
      <Card title="Client" onEdit={() => goTo(1)}>
        {clientName ? (
          <p className="font-medium text-gray-900">{clientName}</p>
        ) : (
          <p className="text-gray-400 italic">Non défini</p>
        )}
        {clientInfo.email && <p className="text-gray-600 text-sm">{clientInfo.email}</p>}
        {clientInfo.phone && <p className="text-gray-500 text-sm">{clientInfo.phone}</p>}
      </Card>

      <Card title="Événement" onEdit={() => goTo(1)}>
        {eventInfo.eventType ? (
          <p className="font-medium text-gray-900">{eventInfo.eventType}</p>
        ) : (
          <p className="text-gray-400 italic">Non défini</p>
        )}
        {eventInfo.eventDate && (
          <p className="text-gray-600 text-sm">{formatDate(eventInfo.eventDate)}</p>
        )}
        {eventInfo.guestCount > 0 && (
          <p className="text-gray-500 text-sm">
            {eventInfo.guestCount} invité{eventInfo.guestCount > 1 ? 's' : ''}
          </p>
        )}
        {eventInfo.eventLocation && (
          <p className="text-gray-500 text-sm">📍 {eventInfo.eventLocation}</p>
        )}
      </Card>

      <Card title="Prestations" onEdit={() => goTo(2)}>
        {realServices.length === 0 ? (
          <p className="text-gray-400 italic">Aucune prestation</p>
        ) : (
          <div className="space-y-1.5">
            {realServices.map((s) => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {s.name || '—'} × {s.quantity}
                </span>
                {!options.hidePrice && (
                  <span className="text-gray-900 font-medium">
                    {formatCurrency(s.quantity * s.unitPrice)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {!options.hidePrice && realServices.length > 0 && (
        <Card title="Montants" onEdit={() => goTo(3)}>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Sous-total HT</span>
              <span>{formatCurrency(ht)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>TVA ({options.vatRate}%)</span>
              <span>{formatCurrency(vatAmt)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
              <span>Total TTC</span>
              <span>{formatCurrency(ttc)}</span>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>

        <div className="flex items-center gap-2">
          {/* Print — same for create and edit */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors print:hidden"
            title="Imprimer / Exporter en PDF"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>

          {/* Primary CTA: different label in edit vs create */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {state.isEditing ? 'Mise à jour…' : 'Enregistrement…'}
              </>
            ) : state.isEditing ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Mettre à jour → WeboWord
              </>
            ) : (
              <>
                <FileEdit className="h-4 w-4" />
                Valider → WeboWord
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared card ───────────────────────────────────────────────────────────────
function Card({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {title}
        </span>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-xs text-[#9c27b0] hover:text-[#7b1fa2] font-medium"
        >
          <Pencil className="h-3 w-3" />
          Modifier
        </button>
      </div>
      {children}
    </div>
  );
}
