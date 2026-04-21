import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PrestationWeboEditor from '@/components/prestations/PrestationWeboEditor';

export const dynamic = 'force-dynamic';

export default async function PrestationEditWebo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: prestation } = await supabase
    .from('prestations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!prestation) notFound();

  return (
    <PrestationWeboEditor
      prestationId={prestation.id}
      name={prestation.name}
      unitPrice={prestation.unit_price}
      category={prestation.category}
      subCategory={prestation.sub_category}
      initialHtml={prestation.gastro_card_html ?? ''}
      description={prestation.description ?? ''}
    />
  );
}
