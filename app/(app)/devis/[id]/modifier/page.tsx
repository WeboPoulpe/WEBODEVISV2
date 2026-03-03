import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ServiceLine } from '@/context/DevisContext';
import QuoteInlineEditor from '@/components/devis/QuoteInlineEditor';
import WeboWordEditor from '@/components/devis/WeboWordEditor';

/**
 * Server Component — fetches the quote (V1 or V2), migrates services if needed,
 * then delegates to either:
 *  • WeboWordEditor — if the quote already has a content_html (user's saved Word version)
 *  • QuoteInlineEditor — standard structured edit
 */
export default async function ModifierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Support both V2 (user_id) and V1 (owner_user_id) — security: must match current user
  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .or(`user_id.eq.${user.id},owner_user_id.eq.${user.id}`)
    .single();

  if (!quote) notFound();

  // ── If the user already saved a WeboWord version, show it directly ───────────
  if (quote.content_html) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', user.id)
      .single();

    const clientName =
      quote.client_first_name && quote.client_last_name
        ? `${quote.client_first_name} ${quote.client_last_name}`.trim()
        : (quote.client_name as string | null) ?? '';

    return (
      <WeboWordEditor
        quoteId={quote.id}
        initialHtml={quote.content_html as string}
        clientName={clientName || undefined}
      />
    );
  }

  // ── Standard edit (no WeboWord yet) ─────────────────────────────────────────

  // Services: load from JSONB or migrate from quote_services on-the-fly
  let services: ServiceLine[] = [];

  if (Array.isArray(quote.services) && quote.services.length > 0) {
    services = quote.services as unknown as ServiceLine[];
  } else {
    const { data: qServices } = await supabase
      .from('quote_services')
      .select('id, custom_name, custom_description, quantity, unit_price, sort_order, service:services(name, description, category_id)')
      .eq('quote_id', id)
      .order('sort_order');

    if (qServices && qServices.length > 0) {
      services = qServices.map((qs) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const svc = (qs.service as any) ?? {};
        return {
          id:          qs.id,
          name:        qs.custom_name        ?? svc.name        ?? '',
          description: qs.custom_description ?? svc.description ?? '',
          quantity:    qs.quantity ?? 1,
          unitPrice:   qs.unit_price ?? 0,
          category:    svc.category_id ?? '',
          isCustom:    false,
        };
      });
    }
  }

  // Handle V1 split client_name → first/last
  let firstName = quote.client_first_name ?? '';
  let lastName  = quote.client_last_name  ?? '';
  if (!firstName && !lastName && quote.client_name) {
    const parts = (quote.client_name as string).trim().split(/\s+/);
    firstName = parts[0] ?? '';
    lastName  = parts.slice(1).join(' ') ?? '';
  }

  return (
    <QuoteInlineEditor
      quoteId={quote.id}
      initialStatus={(quote.status as string) ?? 'draft'}
      initialTemplate={(quote.template as string) ?? 'standard'}
      initialClient={{
        type:        (quote.client_type as 'particulier' | 'entreprise') ?? 'particulier',
        firstName,
        lastName,
        email:       quote.client_email        ?? '',
        phone:       quote.client_phone        ?? '',
        address:     quote.client_address      ?? '',
        companyName: quote.company_name        ?? '',
        contactName: quote.contact_person_name ?? '',
      }}
      initialEvent={{
        eventType:     quote.event_type     ?? '',
        eventDate:     quote.event_date     ?? '',
        eventLocation: quote.event_location ?? '',
        guestCount:    quote.guest_count    ?? 1,
      }}
      initialServices={services}
      initialOptions={{
        vatRate:   quote.vat_rate   ?? 20,
        hidePrice: quote.hide_price ?? false,
        remarks:   quote.remarks    ?? '',
        images:    Array.isArray(quote.images) ? (quote.images as string[]) : [],
      }}
    />
  );
}
