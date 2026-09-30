export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { adminSupabase } from '@/lib/supabase/admin';
import QuoteRender from '@/components/devis/QuoteRender';
import PrintButton from './PrintButton';

export const metadata = { title: 'Votre devis', robots: { index: false, follow: false } };

// Le devis tel que le client le consulte, à partir du lien reçu par email. Aucun compte n'est nécessaire :
// le jeton du lien est la seule clé, et il ne donne accès qu'à ce devis.
export default async function DevisPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,}$/.test(token)) notFound();

  const { data: quote } = await adminSupabase.from('quotes').select('*').eq('share_token', token).maybeSingle();
  if (!quote) notFound();

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('company_name, company_address, company_phone, logo_url, cgv')
    .eq('id', quote.owner_user_id ?? quote.user_id)
    .maybeSingle();

  return (
    <div className="min-h-[100dvh] bg-page print:bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 h-16 bg-page/90 backdrop-blur border-b border-gray-200">
        <p className="font-display text-lg font-semibold text-gray-900 truncate">{profile?.company_name || 'Votre devis'}</p>
        <PrintButton />
      </header>
      <main className="px-0 sm:px-6 py-0 sm:py-6 print:p-0">
        {/* Le document garde sa largeur A4 ; sur téléphone il défile horizontalement plutôt que de se déformer. */}
        <div className="overflow-x-auto">
          <div className="mx-auto bg-white sm:rounded-2xl sm:border sm:border-gray-200 print:border-0 print:rounded-none" style={{ width: '210mm', maxWidth: 'none' }}>
            <QuoteRender quote={quote} profile={profile} />
          </div>
        </div>
      </main>
    </div>
  );
}
