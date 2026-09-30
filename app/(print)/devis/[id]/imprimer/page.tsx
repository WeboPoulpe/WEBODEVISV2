import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AutoPrint from '@/components/devis/AutoPrint';
import QuoteRender from '@/components/devis/QuoteRender';

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

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('company_name, company_address, company_phone, logo_url, cgv')
        .eq('id', user.id)
        .single()
    : { data: null };

  return (
    <>
      {/* Trigger print dialog once mounted */}
      <AutoPrint />
      <style>{'body { margin: 0; padding: 0; }'}</style>
      <QuoteRender quote={quote} profile={profile} />
    </>
  );
}
