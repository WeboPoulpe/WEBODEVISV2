import type { ServiceLine } from '@/context/DevisContext';
import QuoteDocument from '@/components/devis/QuoteDocument';
import QuoteDocumentMariage from '@/components/devis/QuoteDocumentMariage';
import QuoteDocumentBusiness from '@/components/devis/QuoteDocumentBusiness';
import { buildCoverPageHtml, buildPhotosPageHtml, buildLogoHeaderHtml, buildCgvHtml, buildLegalFooterHtml, type LegalProfile } from '@/components/devis/weboword/printHelpers';
import { DEFAULT_COVER_CONFIG, DEFAULT_PHOTOS_CONFIG } from '@/components/devis/weboword/weboword.types';
import type { CoverPageConfig, PhotosPageConfig } from '@/components/devis/weboword/weboword.types';
import { sanitizeHtml } from '@/lib/sanitize';
import { withQuoteNumber } from '@/lib/quoteNumberHtml';
import PrintBreaks from '@/components/devis/PrintBreaks';
import { documentHasCgv } from '@/lib/cgvDetect';
import { appResetCss, documentFonts, googleFontsHref, outputSettings, quoteOutputCss, wrapQuoteDoc } from '@/lib/quoteOutput';
import { documentForFormula, parseFormulas, quoteLines } from '@/lib/quoteFormulas';
import { generateQuoteHtml, type QuoteHtmlOptions } from '@/lib/generateQuoteHtml';

/** Accord signé en ligne par le client, imprimé à la fin du document. */
export interface QuoteRenderAcceptance {
  signerName: string;
  signerRole: string | null;
  signature: string;
  acceptedAt: string;
  /** Formule signée (devis à plusieurs formules). */
  formulaName?: string | null;
}

function AcceptanceBlock({ acceptance }: { acceptance: QuoteRenderAcceptance }) {
  const when = new Date(acceptance.acceptedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' });
  return (
    <div className="webo-ui mx-[20mm] my-6 p-4 border border-gray-300 rounded-lg break-inside-avoid" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <p className="text-[12px] font-semibold text-gray-900">Bon pour accord, signé en ligne</p>
      <p className="text-[11px] text-gray-600 mt-1">
        Accepté le {when} par {acceptance.signerName}{acceptance.signerRole ? `, ${acceptance.signerRole}` : ''}
        {acceptance.formulaName ? `, formule « ${acceptance.formulaName} »` : ''}.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={acceptance.signature} alt={`Signature de ${acceptance.signerName}`} className="mt-2 h-20 w-auto" />
    </div>
  );
}

export interface QuoteRenderProfile extends LegalProfile {
  company_name?: string | null;
  company_address?: string | null;
  company_phone?: string | null;
  logo_url?: string | null;
  cgv?: string | null;
}

/** Document généré depuis les données du devis (comme « Régénérer le document » dans l'éditeur). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generatedDocument(q: any, profile: QuoteRenderProfile | null): string {
  const name = (q.client_first_name && q.client_last_name) ? `${q.client_first_name} ${q.client_last_name}`.trim() : (q.client_name ?? '');
  return generateQuoteHtml({
    companyName: profile?.company_name ?? 'Votre entreprise', clientName: name || 'Client',
    clientEmail: q.client_email ?? null, clientPhone: q.client_phone ?? null, clientAddress: q.client_address ?? null,
    eventType: q.event_type ?? null, eventDate: q.event_date ?? null, eventLocation: q.event_location ?? null,
    guestCount: q.guest_count ?? null, guestCountAdults: q.guest_count_adults ?? null, guestCountChildren: q.guest_count_children ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    services: (Array.isArray(q.services) ? q.services : []).filter((s: any) => !s?.isPageBreak),
    formulas: parseFormulas(q.formulas), vatRate: Number(q.vat_rate ?? 20), remarks: q.remarks ?? null, hidePrice: !!q.hide_price,
    cgv: profile?.cgv ?? null, language: q.language === 'en' ? 'en' : 'fr',
  }, { template: (q.template ?? 'standard') as QuoteHtmlOptions['template'], font: q.selected_font ?? undefined });
}

/**
 * Le document d'un devis, tel qu'il est imprimé et tel que le client le consulte en ligne.
 * Une seule version du rendu : la page d'impression et la page publique l'utilisent toutes les deux.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function QuoteRender({ quote: source, profile, acceptance = null }: { quote: any; profile: QuoteRenderProfile | null; acceptance?: QuoteRenderAcceptance | null }) {
  // Devis à formules sans document mis en forme (document effacé puis jamais réenregistré) : l'ancien rendu ne
  // présenterait qu'une formule ; le document généré les présente toutes, comme le client doit les comparer.
  const quote = !source.content_html && parseFormulas(source.formulas).length > 0
    ? { ...source, content_html: generatedDocument(source, profile) }
    : source;
  // ── Devis rédigé dans l'éditeur : son contenu est rendu tel quel ─────────────
  if (quote.content_html) {
    const settings = outputSettings(quote);
    // Le numéro attribué par la base est posé sous la date de l'en-tête. Devis à formules : une fois la formule
    // retenue, le document ne présente plus qu'elle.
    const content = documentForFormula(
      withQuoteNumber(quote.content_html as string, quote.quote_number, quote.language === 'en' ? 'en' : 'fr'),
      parseFormulas(quote.formulas), quote.chosen_formula_id,
    );

    const coverHtml = buildCoverPageHtml((quote.cover_page_config as CoverPageConfig) ?? DEFAULT_COVER_CONFIG);
    const photosHtml = buildPhotosPageHtml((quote.photos_page_config as PhotosPageConfig) ?? DEFAULT_PHOTOS_CONFIG);
    const logoHtml = buildLogoHeaderHtml(profile?.logo_url);
    const cgvHtml = buildCgvHtml(profile?.cgv);
    const legalHtml = buildLegalFooterHtml(profile);
    // Les conditions de vente ne sont ajoutées que si le document ne les contient pas déjà (bloc ajouté, texte
    // collé ou titre « Conditions Générales de Vente » tapé à la main).
    const hasCgv = documentHasCgv(content, profile?.cgv);
    // Police du devis et polices choisies pour des paragraphes.
    const fontHref = googleFontsHref(documentFonts(settings.font, content));

    return (
      <>
        {fontHref && (
          // eslint-disable-next-line @next/next/no-page-custom-font
          <link rel="stylesheet" href={fontHref} />
        )}
        {/* Styles de l'application annulés dans le document (sauf le cadre d'accord en ligne, .webo-ui) : la page
            s'imprime exactement comme la fenêtre d'impression de l'éditeur. */}
        <style>{`${appResetCss('.quote-render > :where(:not(.webo-ui))')}\n${quoteOutputCss(settings)}`}</style>
        <PrintBreaks />
        <div className="quote-render quote-out">
          {coverHtml && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(coverHtml) }} />}
          {!coverHtml && logoHtml && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(logoHtml) }} />}
          <div dangerouslySetInnerHTML={{ __html: wrapQuoteDoc(sanitizeHtml(content)) }} />
          {legalHtml && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(legalHtml) }} />}
          {photosHtml && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(photosHtml) }} />}
          {cgvHtml && !hasCgv && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(cgvHtml) }} />}
          {acceptance && <AcceptanceBlock acceptance={acceptance} />}
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

  const services: ServiceLine[] = quoteLines<ServiceLine>(quote);
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
      {buildLegalFooterHtml(profile) && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(buildLegalFooterHtml(profile)) }} />}
      {acceptance && <AcceptanceBlock acceptance={acceptance} />}
    </div>
  );
}
