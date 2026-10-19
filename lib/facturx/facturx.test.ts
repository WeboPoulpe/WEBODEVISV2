// PDF Factur-X : XML conforme aux règles de calcul EN 16931, PDF/A-3 avec le XML joint, rendu stable.
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { Invoice } from '@/server/invoices';
import { balanceLines, creditLines, depositLines, invoiceTotals, type InvoiceLine } from '@/lib/invoices';
import { buildFacturXml, splitAddress, typeCode } from './cii';
import { renderInvoicePdf } from './pdf';
import { srgbIccProfile } from './icc';

const fonts = {
  regular: fs.readFileSync(path.join(__dirname, 'fonts/DejaVuSans.ttf')),
  bold: fs.readFileSync(path.join(__dirname, 'fonts/DejaVuSans-Bold.ttf')),
};

const quoteLines: InvoiceLine[] = [
  { label: 'Menu mariage « Saveurs d’automne »', description: 'Entrée, plat, fromage et dessert', quantity: 50, unitPrice: 45, vatRate: 10 },
  { label: 'Champagne', quantity: 20, unitPrice: 30, vatRate: 20 },
];

export function sampleInvoice(over: Partial<Invoice> & { lines?: InvoiceLine[] } = {}): Invoice {
  const lines = over.lines ?? quoteLines;
  const t = invoiceTotals(lines);
  return {
    id: '00000000-0000-4000-8000-0000000000f1', quote_id: null, quote_number: 'D-2026-0007',
    kind: 'facture', status: 'emise', number: 'F-2026-0003', credited_invoice_id: null, credited_invoice_number: null,
    issue_date: '2026-10-19', due_date: '2026-11-18', service_date: '2026-12-12',
    seller: { name: 'Traiteur Verdier', address: '12 rue des Lilas, 10000 Troyes', email: 'contact@verdier.fr', siret: '12345678900012', vatNumber: 'FR32123456789', legalForm: 'SARL', shareCapital: '10 000 €', rcs: 'Troyes 123 456 789', iban: 'FR76 3000 6000 0112 3456 7890 189', bic: 'AGRIFRPP', isCompany: true },
    buyer: { name: 'Jean Dupont', address: '4 place de la Gare, 51100 Reims', email: 'jean@dupont.fr', isCompany: false },
    lines, total_ht: t.ht, total_vat: t.vat, total_ttc: t.ttc, vat_breakdown: t.byRate,
    notes: null, pdf_url: null, created_at: '2026-10-19T10:00:00Z', paid: 0, payments: [],
    ...over,
  };
}

const tag = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<ram:${name}[^>]*>([^<]*)</ram:${name}>`, 'g'))].map((m) => m[1]);

describe('XML Factur-X', () => {
  it('respecte les règles de calcul (BR-CO-10, BR-CO-13…)', () => {
    const xml = buildFacturXml(sampleInvoice());
    expect(tag(xml, 'LineTotalAmount')).toEqual(['2250.00', '600.00', '2850.00']);
    expect(tag(xml, 'BasisAmount')).toEqual(['600.00', '2250.00']);
    expect(tag(xml, 'CalculatedAmount')).toEqual(['120.00', '225.00']);
    expect(tag(xml, 'TaxTotalAmount')).toEqual(['345.00']);
    expect(tag(xml, 'GrandTotalAmount')).toEqual(['3195.00']);
    expect(tag(xml, 'DuePayableAmount')).toEqual(['3195.00']);
    expect(xml).toContain('<ram:ID schemeID="0002">123456789</ram:ID>');
    expect(xml).toContain('<ram:PostcodeCode>10000</ram:PostcodeCode>');
  });

  it('n’écrit jamais de prix négatif : une déduction d’acompte passe par la quantité', () => {
    const dep = invoiceTotals(depositLines(quoteLines, { percent: 30 }));
    const lines = balanceLines(quoteLines, [{ number: 'F-2026-0001', byRate: dep.byRate }]);
    const t = invoiceTotals(lines);
    const xml = buildFacturXml(sampleInvoice({ kind: 'solde', lines, total_ht: t.ht, total_vat: t.vat, total_ttc: t.ttc, vat_breakdown: t.byRate }));
    expect(tag(xml, 'ChargeAmount').every((p) => Number(p) >= 0)).toBe(true);
    expect(xml).toContain('<ram:BilledQuantity unitCode="C62">-1</ram:BilledQuantity>');
    expect(tag(xml, 'GrandTotalAmount')).toEqual([t.ttc.toFixed(2)]);
  });

  it('écrit un avoir en montants positifs avec le code 381 et la facture annulée', () => {
    const lines = creditLines(quoteLines, 'F-2026-0003');
    const t = invoiceTotals(lines);
    const xml = buildFacturXml(sampleInvoice({ kind: 'avoir', number: 'AV-2026-0001', credited_invoice_number: 'F-2026-0003', due_date: null, lines, total_ht: t.ht, total_vat: t.vat, total_ttc: t.ttc, vat_breakdown: t.byRate }));
    expect(xml).toContain('<ram:TypeCode>381</ram:TypeCode>');
    expect(tag(xml, 'GrandTotalAmount')).toEqual(['3195.00']);
    expect(xml).toContain('<ram:IssuerAssignedID>F-2026-0003</ram:IssuerAssignedID>');
  });

  it('franchise de TVA : catégorie E, motif et TVA nulle', () => {
    const lines = quoteLines.map((l) => ({ ...l, vatRate: 0 }));
    const t = invoiceTotals(lines);
    const xml = buildFacturXml(sampleInvoice({ seller: { ...sampleInvoice().seller, vatExempt: true, vatNumber: null }, lines, total_ht: t.ht, total_vat: t.vat, total_ttc: t.ttc, vat_breakdown: t.byRate }));
    expect(tag(xml, 'CategoryCode').every((c) => c === 'E')).toBe(true);
    expect(xml).toContain('VATEX-FR-FRANCHISE');
    expect(tag(xml, 'TaxTotalAmount')).toEqual(['0.00']);
  });

  it('échappe le texte et lit les adresses', () => {
    expect(buildFacturXml(sampleInvoice({ buyer: { name: 'Dupont & <Fils>' } }))).toContain('Dupont &amp; &lt;Fils&gt;');
    expect(splitAddress('4 place de la Gare\n51100 Reims')).toEqual({ line: '4 place de la Gare', postcode: '51100', city: 'Reims' });
    expect(typeCode('acompte')).toBe('386');
  });
});

describe('PDF Factur-X', () => {
  it('joint le XML et déclare PDF/A-3', async () => {
    const bytes = await renderInvoicePdf(sampleInvoice(), fonts);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.catalog.get(PDFName.of('AF'))).toBeDefined();
    expect(doc.catalog.get(PDFName.of('OutputIntents'))).toBeDefined();
    const text = Buffer.from(bytes).toString('latin1');
    expect(text).toContain('<pdfaid:part>3</pdfaid:part>');
    expect(text).toContain('factur-x.xml');
    expect(doc.getTitle()).toBe('Facture F-2026-0003');
  });

  it('produit exactement le même fichier à chaque fois', async () => {
    const a = await renderInvoicePdf(sampleInvoice(), fonts);
    const b = await renderInvoicePdf(sampleInvoice(), fonts);
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
  });

  it('pagine une longue facture', async () => {
    const lines = Array.from({ length: 60 }, (_, i) => ({ label: `Prestation ${i + 1}`, description: 'Une description assez longue pour passer sur deux lignes dans la colonne de désignation de la facture', quantity: 1, unitPrice: 10, vatRate: 10 }));
    const t = invoiceTotals(lines);
    const doc = await PDFDocument.load(await renderInvoicePdf(sampleInvoice({ lines, total_ht: t.ht, total_vat: t.vat, total_ttc: t.ttc, vat_breakdown: t.byRate }), fonts));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('un brouillon n’est pas un Factur-X', async () => {
    const doc = await PDFDocument.load(await renderInvoicePdf(sampleInvoice({ status: 'brouillon', number: null }), fonts));
    expect(doc.catalog.get(PDFName.of('AF'))).toBeUndefined();
  });

  it('génère un profil ICC cohérent', () => {
    const icc = srgbIccProfile();
    const size = new DataView(icc.buffer).getUint32(0);
    expect(size).toBe(icc.length);
    expect(Buffer.from(icc.slice(36, 40)).toString()).toBe('acsp');
  });
});
