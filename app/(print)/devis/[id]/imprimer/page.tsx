import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ServiceLine } from '@/context/DevisContext';
import QuoteDocument from '@/components/devis/QuoteDocument';
import QuoteDocumentMariage from '@/components/devis/QuoteDocumentMariage';
import QuoteDocumentBusiness from '@/components/devis/QuoteDocumentBusiness';
import AutoPrint from '@/components/devis/AutoPrint';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ImprimerPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch quote
  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single();

  if (!quote) notFound();

  // Fetch company profile
  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('company_name, company_address, company_phone, logo_url, cgv')
        .eq('id', user.id)
        .single()
    : { data: null };

  const clientName =
    quote.client_type === 'entreprise'
      ? (quote.company_name ?? quote.client_name ?? '')
      : `${quote.client_first_name ?? ''} ${quote.client_last_name ?? ''}`.trim() ||
        (quote.client_name ?? '');

  const services: ServiceLine[] = Array.isArray(quote.services) ? quote.services : [];
  const images: string[] = Array.isArray(quote.images) ? quote.images : [];

  const docProps = {
    companyName: profile?.company_name ?? 'Votre entreprise',
    companyAddress: profile?.company_address,
    companyPhone: profile?.company_phone,
    clientName,
    eventType: quote.event_type ?? '',
    eventDate: quote.event_date ?? null,
    guestCount: quote.guest_count ?? 0,
    services,
    options: {
      vatRate: quote.vat_rate ?? 20,
      hidePrice: quote.hide_price ?? false,
      remarks: quote.remarks ?? '',
    },
    quoteDate: quote.created_at,
    logoUrl: profile?.logo_url,
    cgv: profile?.cgv,
    images,
  };

  const template = quote.template ?? 'standard';

  return (
    <>
      {/* Trigger print dialog once mounted */}
      <AutoPrint />

      {/* Full-page document wrapper */}
      <div className="p-6 max-w-[210mm] mx-auto print:p-0 print:max-w-none">
        {template === 'mariage' ? (
          <QuoteDocumentMariage {...docProps} />
        ) : template === 'business' ? (
          <QuoteDocumentBusiness {...docProps} />
        ) : (
          <QuoteDocument {...docProps} />
        )}
      </div>
    </>
  );
}
