import type { ServiceLine } from '@/context/DevisContext';
import QuoteDocument from '@/components/devis/QuoteDocument';
import QuoteDocumentMariage from '@/components/devis/QuoteDocumentMariage';
import QuoteDocumentBusiness from '@/components/devis/QuoteDocumentBusiness';
import { buildCoverPageHtml, buildPhotosPageHtml, buildLogoHeaderHtml, buildCgvHtml } from '@/components/devis/weboword/printHelpers';
import { DEFAULT_COVER_CONFIG, DEFAULT_PHOTOS_CONFIG } from '@/components/devis/weboword/weboword.types';
import type { CoverPageConfig, PhotosPageConfig } from '@/components/devis/weboword/weboword.types';
import { sanitizeHtml } from '@/lib/sanitize';
import PrintBreaks from '@/components/devis/PrintBreaks';
import { googleFontHref, outputSettings, quoteOutputCss, wrapQuoteDoc } from '@/lib/quoteOutput';

export interface QuoteRenderProfile {
  company_name?: string | null;
  company_address?: string | null;
  company_phone?: string | null;
  logo_url?: string | null;
  cgv?: string | null;
}

/**
 * Le document d'un devis, tel qu'il est imprimé et tel que le client le consulte en ligne.
 * Une seule version du rendu : la page d'impression et la page publique l'utilisent toutes les deux.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function QuoteRender({ quote, profile }: { quote: any; profile: QuoteRenderProfile | null }) {
  // ── Devis rédigé dans l'éditeur : son contenu est rendu tel quel ─────────────
  if (quote.content_html) {
    const settings = outputSettings(quote);
    const fontHref = googleFontHref(settings.font);
    const content = quote.content_html as string;

    const coverHtml = buildCoverPageHtml((quote.cover_page_config as CoverPageConfig) ?? DEFAULT_COVER_CONFIG);
    const photosHtml = buildPhotosPageHtml((quote.photos_page_config as PhotosPageConfig) ?? DEFAULT_PHOTOS_CONFIG);
    const logoHtml = buildLogoHeaderHtml(profile?.logo_url);
    const cgvHtml = buildCgvHtml(profile?.cgv);
    // Les conditions de vente ne sont ajoutées que si le document ne les contient pas déjà.
    const hasCgv = content.includes('data-webo-cgv') || (!!profile?.cgv && content.includes(profile.cgv as string));

    return (
      <>
        {fontHref && (
          // eslint-disable-next-line @next/next/no-page-custom-font
          <link rel="stylesheet" href={fontHref} />
        )}
        <style>{quoteOutputCss(settings)}</style>
        <PrintBreaks />
        <div className="quote-render quote-out">
          {coverHtml && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(coverHtml) }} />}
          {!coverHtml && logoHtml && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(logoHtml) }} />}
          <div dangerouslySetInnerHTML={{ __html: wrapQuoteDoc(sanitizeHtml(content)) }} />
          {photosHtml && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(photosHtml) }} />}
          {cgvHtml && !hasCgv && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(cgvHtml) }} />}
        </div>
      </>
    );
  }

  // ── Devis de l'ancien format : rendu par les composants de document ──────────
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
    <div className="p-6 max-w-[210mm] mx-auto print:p-0 print:max-w-none">
      {template === 'mariage' ? (
        <QuoteDocumentMariage {...docProps} />
      ) : template === 'business' ? (
        <QuoteDocumentBusiness {...docProps} />
      ) : (
        <QuoteDocument {...docProps} />
      )}
    </div>
  );
}
