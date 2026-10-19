export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { CheckCircle2, Clock } from 'lucide-react';
import { adminSupabase } from '@/lib/supabase/admin';
import QuoteRender from '@/components/devis/QuoteRender';
import { acceptanceState, recordQuoteView } from '@/server/acceptance';
import PrintButton from './PrintButton';
import AcceptQuote from './AcceptQuote';

export const metadata = { title: 'Votre devis', robots: { index: false, follow: false } };

const frDateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' });

// Le devis tel que le client le consulte, à partir du lien reçu par email. Aucun compte n'est nécessaire :
// le jeton du lien est la seule clé, et il ne donne accès qu'à ce devis. Le client peut l'accepter et le signer ici.
export default async function DevisPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,}$/.test(token)) notFound();

  const { data: quote } = await adminSupabase.from('quotes').select('*').eq('share_token', token).maybeSingle();
  if (!quote) notFound();

  const [{ data: profile }, state] = await Promise.all([
    adminSupabase.from('profiles').select('company_name, company_address, company_phone, logo_url, cgv').eq('id', quote.owner_user_id ?? quote.user_id).maybeSingle(),
    acceptanceState(token),
    // Une consultation qui ne s'enregistre pas ne doit pas empêcher d'afficher le devis.
    recordQuoteView(token).catch(() => {}),
  ]);
  const companyName = profile?.company_name || 'Votre traiteur';

  return (
    <div className="min-h-[100dvh] bg-page print:bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 h-16 bg-page/90 backdrop-blur border-b border-gray-200 print:hidden">
        <p className="font-display text-lg font-semibold text-gray-900 truncate">{profile?.company_name || 'Votre devis'}</p>
        <PrintButton />
      </header>
      <main className="px-0 sm:px-6 py-0 sm:py-6 print:p-0">
        {state?.acceptance && (
          <div className="mx-4 sm:mx-auto sm:max-w-[210mm] my-4 sm:mt-0 sm:mb-6 flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 print:hidden" role="status">
            <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm">
              <span className="font-semibold">Devis accepté le {frDateTime(state.acceptance.acceptedAt)}</span> par {state.acceptance.signerName}
              {state.acceptance.signerRole ? ` (${state.acceptance.signerRole})` : ''}. Merci, {companyName} a bien reçu votre accord.
            </p>
          </div>
        )}
        {state?.canAccept && <AcceptQuote token={token} companyName={companyName} validUntil={state.validUntil} isCompany={state.isCompany} />}
        {state?.expired && (
          <div className="mx-4 sm:mx-auto sm:max-w-[210mm] my-4 sm:mt-0 sm:mb-6 flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 print:hidden" role="status">
            <Clock className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm">Ce devis n’est plus valable depuis le {new Date(`${state.validUntil}T12:00:00`).toLocaleDateString('fr-FR')}. Contactez {companyName} pour recevoir une proposition à jour.</p>
          </div>
        )}
        {/* Le document garde sa largeur A4 ; sur téléphone il défile horizontalement plutôt que de se déformer. */}
        <div className="overflow-x-auto">
          <div className="mx-auto bg-white sm:rounded-2xl sm:border sm:border-gray-200 print:border-0 print:rounded-none" style={{ width: '210mm', maxWidth: 'none' }}>
            <QuoteRender quote={quote} profile={profile} acceptance={state?.acceptance ?? null} />
          </div>
        </div>
      </main>
    </div>
  );
}
