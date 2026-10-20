import { notFound } from 'next/navigation';
import { LEGAL_PROFILE_COLUMNS } from '@/components/devis/weboword/printHelpers';
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

  // Logo, CGV et mentions viennent du titulaire de l'entreprise (un collaborateur n'a pas les siens).
  const { data: me } = user ? await supabase.from('profiles').select('parent_user_id').eq('id', user.id).maybeSingle() : { data: null };
  const companyId = (me as { parent_user_id?: string | null } | null)?.parent_user_id ?? user?.id;
  const { data: profile } = companyId
    ? await supabase
        .from('profiles')
        .select(`company_phone, logo_url, cgv, ${LEGAL_PROFILE_COLUMNS}`)
        .eq('id', companyId)
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
