// XML Factur-X (CII D16B, profil EN 16931) d'une facture émise. Joint au PDF/A-3, il rend la facture lisible par
// les logiciels comptables et les plateformes agréées de la facturation électronique.
//
// Deux règles de la norme imposent une écriture différente de l'affichage :
//  • un prix unitaire n'est jamais négatif : une déduction (acompte déjà facturé) s'écrit quantité -1 × prix positif ;
//  • un avoir (code 381) porte des montants positifs : c'est le type de document qui dit qu'il vient en déduction.

import type { Invoice, Party } from '@/server/invoices';
import { cents, lineHT, type InvoiceLine } from '@/lib/invoices';

export const FACTURX_FILENAME = 'factur-x.xml';
export const FACTURX_PROFILE = 'EN 16931';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const amount = (n: number) => cents(n).toFixed(2);
const quantity = (n: number) => String(Math.round(n * 10000) / 10000);
const date102 = (iso: string) => iso.slice(0, 10).replace(/-/g, '');
const dateTime = (iso: string) => `<udt:DateTimeString format="102">${date102(iso)}</udt:DateTimeString>`;

/** Code du type de document : 386 acompte, 381 avoir, 380 facture. */
export function typeCode(kind: Invoice['kind']): string {
  return kind === 'acompte' ? '386' : kind === 'avoir' ? '381' : '380';
}

/** Adresse libre « 12 rue des Lilas, 10000 Troyes » → rue, code postal, ville. */
export function splitAddress(address: string | null | undefined): { line: string; postcode: string; city: string } {
  const text = (address ?? '').replace(/\s*\n\s*/g, ', ').trim();
  const m = /^(.*?)[,\s]*\b(\d{5})\s+([^,]+?)(?:,\s*France)?$/i.exec(text);
  if (m) return { line: m[1].replace(/,\s*$/, '').trim(), postcode: m[2], city: m[3].trim() };
  return { line: text, postcode: '', city: '' };
}

// fiscalId : vendeur sans n° de TVA (franchise) — la norme (BR-E-02) demande alors un identifiant fiscal : le SIREN.
function party(tag: 'SellerTradeParty' | 'BuyerTradeParty', p: Party & { vatNumber?: string | null }, fiscalId = false): string {
  const a = splitAddress(p.address);
  const siren = (p.siret ?? '').replace(/\D/g, '').slice(0, 9);
  return `<ram:${tag}>
        <ram:Name>${esc(p.name)}</ram:Name>${siren.length === 9 ? `
        <ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${siren}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>${a.postcode ? `
          <ram:PostcodeCode>${a.postcode}</ram:PostcodeCode>` : ''}${a.line ? `
          <ram:LineOne>${esc(a.line)}</ram:LineOne>` : ''}${a.city ? `
          <ram:CityName>${esc(a.city)}</ram:CityName>` : ''}
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>${p.email ? `
        <ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(p.email)}</ram:URIID></ram:URIUniversalCommunication>` : ''}${p.vatNumber ? `
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(p.vatNumber)}</ram:ID></ram:SpecifiedTaxRegistration>` : fiscalId && siren.length === 9 ? `
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${siren}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:${tag}>`;
}

/** Catégorie de TVA : S (taux normal ou réduit), E (exonéré, franchise 293 B), Z (taux zéro). */
function category(rate: number, exempt: boolean): string {
  if (exempt) return 'E';
  return rate === 0 ? 'Z' : 'S';
}

export function buildFacturXml(inv: Invoice, notes: string[] = []): string {
  if (!inv.number || !inv.issue_date) throw new Error('Seule une facture émise a un XML Factur-X.');
  const exempt = !!inv.seller.vatExempt;
  // Avoir : montants positifs (voir l'en-tête du fichier).
  const sign = inv.kind === 'avoir' ? -1 : 1;
  const lines: InvoiceLine[] = inv.lines.map((l) => ({ ...l, unitPrice: l.unitPrice * sign }));

  const items = lines.map((l, i) => {
    // Prix jamais négatif : le signe passe sur la quantité.
    const negative = l.unitPrice < 0;
    const qty = negative ? -l.quantity : l.quantity;
    const price = Math.abs(l.unitPrice);
    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(l.label)}</ram:Name>${l.description ? `
        <ram:Description>${esc(l.description)}</ram:Description>` : ''}
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>${price.toFixed(4).replace(/0{1,2}$/, '')}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">${quantity(qty)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${category(l.vatRate, exempt)}</ram:CategoryCode>
          <ram:RateApplicablePercent>${exempt ? 0 : l.vatRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amount(lineHT(l))}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join('');

  // Franchise de TVA : un seul groupe « exonéré », sur tout le HT.
  const groups = exempt ? [{ rate: 0, base: inv.total_ht, vat: 0 }] : inv.vat_breakdown;
  const taxes = groups.map((r) => `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${amount(r.vat * sign)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>${exempt ? `
        <ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>` : ''}
        <ram:BasisAmount>${amount(r.base * sign)}</ram:BasisAmount>
        <ram:CategoryCode>${category(r.rate, exempt)}</ram:CategoryCode>${exempt ? `
        <ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode>` : ''}
        <ram:RateApplicablePercent>${exempt ? 0 : r.rate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join('');

  const iban = (inv.seller.iban ?? '').replace(/\s+/g, '');
  const paymentMeans = iban && inv.kind !== 'avoir' ? `
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${esc(iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>` : '';

  const terms = inv.due_date ? `
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>${dateTime(inv.due_date)}</ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : '';

  const ht = inv.total_ht * sign;
  const vat = inv.total_vat * sign;
  const ttc = inv.total_ttc * sign;
  const reference = inv.kind === 'avoir' && inv.credited_invoice_number ? `
      <ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${esc(inv.credited_invoice_number)}</ram:IssuerAssignedID></ram:InvoiceReferencedDocument>` : '';

  const includedNotes = notes.map((n) => `
    <ram:IncludedNote><ram:Content>${esc(n)}</ram:Content></ram:IncludedNote>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(inv.number)}</ram:ID>
    <ram:TypeCode>${typeCode(inv.kind)}</ram:TypeCode>
    <ram:IssueDateTime>${dateTime(inv.issue_date)}</ram:IssueDateTime>${includedNotes}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${items}
    <ram:ApplicableHeaderTradeAgreement>${inv.quote_number ? `
      <ram:BuyerReference>${esc(inv.quote_number)}</ram:BuyerReference>` : ''}
      ${party('SellerTradeParty', inv.seller, exempt)}
      ${party('BuyerTradeParty', inv.buyer)}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>${inv.service_date ? `
      <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime>${dateTime(inv.service_date)}</ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>` : ''}
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${paymentMeans}${taxes}${terms}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amount(ht)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amount(ht)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${amount(vat)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amount(ttc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amount(ttc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>${reference}
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}
