// Après une modification de devis validée dans Webo : son document mis en forme (WeboWord) est remis à jour dans le
// navigateur, comme le fait l'éditeur en formulaire (tableau, totaux, blocs client et événement, plats ajoutés ou
// retirés de la carte). Navigateur seulement (DOMParser).

import { createClient } from '@/lib/supabase/client';
import { parseFormulas } from '@/lib/quoteFormulas';
import { syncWeboDocument } from '@/lib/weboFinancials';
import type { QuoteHtmlData, QuoteHtmlOptions } from '@/lib/generateQuoteHtml';

export interface ResyncInfo { quoteId: string; added: string[]; removed: string[]; /** La langue a changé : plats de la carte et mentions refaits. */ relang?: boolean }

export async function resyncQuoteDocument(info: ResyncInfo): Promise<boolean> {
  const sb = createClient();
  const { data: q } = await sb.from('quotes').select('*').eq('id', info.quoteId).maybeSingle();
  if (!q?.content_html) return false;
  const services = (Array.isArray(q.services) ? q.services : []) as QuoteHtmlData['services'];
  const lines = services.filter((l) => !(l as { isPageBreak?: boolean }).isPageBreak);
  const added = new Set(info.added);
  const synced = syncWeboDocument(q.content_html as string, {
    all: {
      companyName: '',
      clientName: q.client_name as string, clientEmail: q.client_email ?? null, clientPhone: q.client_phone ?? null, clientAddress: q.client_address ?? null,
      clientType: q.client_type === 'entreprise' ? 'entreprise' : 'particulier', clientCompanyName: q.company_name ?? null, clientSiret: q.client_siret ?? null,
      contactName: q.contact_person_name ?? null,
      eventType: q.event_type ?? null, eventDate: q.event_date ?? null, eventLocation: q.event_location ?? null,
      guestCount: q.guest_count ?? null, guestCountAdults: q.guest_count_adults ?? null, guestCountChildren: q.guest_count_children ?? null,
      services: lines, formulas: parseFormulas(q.formulas), chosenFormulaId: q.chosen_formula_id ?? null,
      vatRate: Number(q.vat_rate ?? 20), hidePrice: !!q.hide_price, remarks: q.remarks ?? null,
      language: q.language === 'en' ? 'en' : 'fr',
    },
    added: lines.filter((l) => l.id && added.has(l.id)),
    removedLines: info.removed.map((name) => ({ name })),
    financials: true,
    parties: true,
    relang: !!info.relang,
  }, { template: (q.template ?? 'classique') as QuoteHtmlOptions['template'], font: (q.selected_font as string | null) ?? undefined });
  if (!synced) return false;
  const { error } = await sb.from('quotes').update({ content_html: synced }).eq('id', info.quoteId);
  return !error;
}
