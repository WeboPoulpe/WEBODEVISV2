// PDF d'une facture : mise en page A4 sobre, et pour une facture émise, format Factur-X (PDF/A-3b avec le XML
// joint). Le PDF est entièrement reconstruit depuis l'instantané figé de la facture : le même fichier est
// produit à chaque téléchargement (dates et identifiant tirés de la facture, pas de l'heure du moment).

import crypto from 'node:crypto';
import fontkit from '@pdf-lib/fontkit';
import { AFRelationship, degrees, PDFDocument, PDFHexString, PDFName, PDFString, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Invoice } from '@/server/invoices';
import { INVOICE_KIND_LABELS, lineHT } from '@/lib/invoices';
import { frDate, invoiceMentions, sellerIdentityLine } from '@/lib/invoiceMentions';
import { buildFacturXml, FACTURX_FILENAME, FACTURX_PROFILE } from './cii';
import { srgbIccProfile } from './icc';

export interface PdfFonts { regular: Uint8Array; bold: Uint8Array }

const A4 = { w: 595.28, h: 841.89 };
const M = 42; // marges
const INK = rgb(0.11, 0.15, 0.13);
const MUTED = rgb(0.42, 0.45, 0.44);
const LINE = rgb(0.88, 0.86, 0.82);
const ACCENT = rgb(180 / 255, 80 / 255, 45 / 255);
const SOFT = rgb(0.97, 0.95, 0.92);

const euro = (n: number) =>
  `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, ' ')} €`;
const pct = (n: number) => `${n.toLocaleString('fr-FR')} %`;
const qty = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });

/** Coupe un texte en lignes qui tiennent dans la largeur donnée. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) out.push(line);
      // Mot plus long que la ligne : coupé net.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let i = rest.length - 1;
        while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > width) i--;
        out.push(rest.slice(0, i));
        rest = rest.slice(i);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}

function title(inv: Invoice): string {
  if (inv.status === 'brouillon') return `${INVOICE_KIND_LABELS[inv.kind]} (brouillon)`;
  return `${INVOICE_KIND_LABELS[inv.kind]} n° ${inv.number}`;
}

const COLS = { label: M, qty: 330, price: 400, vat: 462, total: A4.w - M };

export async function renderInvoicePdf(inv: Invoice, fonts: PdfFonts): Promise<Uint8Array> {
  const issued = inv.status !== 'brouillon' && !!inv.number && !!inv.issue_date;
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fonts.regular, { subset: true });
  const bold = await doc.embedFont(fonts.bold, { subset: true });

  const footer = [sellerIdentityLine(inv.seller), ...invoiceMentions(inv)].filter(Boolean);
  const footerLines = footer.flatMap((t) => wrap(t, regular, 7.5, A4.w - 2 * M));
  const footerTop = M + 14 + footerLines.length * 10;

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  const text = (s: string, x: number, yy: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' } = {}) => {
    const size = o.size ?? 9.5;
    const font = o.font ?? regular;
    const w = font.widthOfTextAtSize(s, size);
    page.drawText(s, { x: o.align === 'right' ? x - w : x, y: yy, size, font, color: o.color ?? INK });
  };

  const tableHeader = () => {
    page.drawRectangle({ x: M, y: y - 6, width: A4.w - 2 * M, height: 20, color: SOFT });
    text('Désignation', COLS.label + 6, y, { font: bold, size: 8.5 });
    text('Qté', COLS.qty, y, { font: bold, size: 8.5, align: 'right' });
    text('PU HT', COLS.price, y, { font: bold, size: 8.5, align: 'right' });
    text('TVA', COLS.vat, y, { font: bold, size: 8.5, align: 'right' });
    text('Total HT', COLS.total - 6, y, { font: bold, size: 8.5, align: 'right' });
    y -= 24;
  };

  const newPage = (continued: boolean) => {
    page = doc.addPage([A4.w, A4.h]);
    pages.push(page);
    y = A4.h - M;
    if (continued) {
      text(`${inv.seller.name} · ${title(inv)} (suite)`, M, y, { size: 8.5, color: MUTED });
      y -= 26;
      tableHeader();
    }
  };

  // ── En-tête ────────────────────────────────────────────────────────────────
  newPage(false);
  text(inv.seller.name, M, y - 6, { font: bold, size: 16 });
  let ly = y - 24;
  for (const l of [inv.seller.address, inv.seller.phone, inv.seller.email].filter(Boolean) as string[]) {
    for (const w of wrap(l, regular, 8.5, 250)) { text(w, M, ly, { size: 8.5, color: MUTED }); ly -= 11.5; }
  }
  text(title(inv), A4.w - M, y - 6, { font: bold, size: 14, color: issued ? ACCENT : MUTED, align: 'right' });
  let ry = y - 24;
  const meta: [string, string][] = [
    ['Date d’émission', issued ? frDate(inv.issue_date) : 'à l’émission'],
    ['Échéance', inv.kind === 'avoir' ? '' : inv.due_date ? frDate(inv.due_date) : ''],
    ['Date de la prestation', frDate(inv.service_date)],
    ['Devis', inv.quote_number ? `n° ${inv.quote_number}` : ''],
    ['Annule la facture', inv.kind === 'avoir' && inv.credited_invoice_number ? `n° ${inv.credited_invoice_number}` : ''],
  ];
  for (const [k, v] of meta) {
    if (!v) continue;
    text(`${k} : `, A4.w - M - regular.widthOfTextAtSize(v, 8.5) - 2, ry, { size: 8.5, color: MUTED, align: 'right' });
    text(v, A4.w - M, ry, { size: 8.5, align: 'right' });
    ry -= 11.5;
  }
  y = Math.min(ly, ry) - 14;

  // ── Client ─────────────────────────────────────────────────────────────────
  const buyerLines = [
    inv.buyer.address, inv.buyer.email,
    inv.buyer.siret ? `SIRET ${inv.buyer.siret}` : null, inv.buyer.vatNumber ? `N° TVA ${inv.buyer.vatNumber}` : null,
  ].filter(Boolean).flatMap((l) => wrap(l as string, regular, 8.5, 230));
  const boxH = 30 + buyerLines.length * 11.5;
  const bx = A4.w - M - 260;
  page.drawRectangle({ x: bx, y: y - boxH, width: 260, height: boxH, borderColor: LINE, borderWidth: 0.8, color: rgb(1, 1, 1) });
  text('Client', bx + 12, y - 14, { size: 7.5, color: MUTED });
  text(inv.buyer.name, bx + 12, y - 27, { font: bold, size: 10 });
  let by = y - 40;
  for (const l of buyerLines) { text(l, bx + 12, by, { size: 8.5, color: MUTED }); by -= 11.5; }
  y -= boxH + 22;

  // ── Lignes ─────────────────────────────────────────────────────────────────
  tableHeader();
  const labelWidth = COLS.qty - COLS.label - 40;
  for (const l of inv.lines) {
    const labelLines = wrap(l.label, bold, 9, labelWidth);
    const descLines = l.description ? wrap(l.description, regular, 8, labelWidth) : [];
    const h = labelLines.length * 12 + descLines.length * 10.5 + 12;
    if (y - h < footerTop + 20) newPage(true);
    let cy = y;
    labelLines.forEach((t) => { text(t, COLS.label + 6, cy, { font: bold, size: 9 }); cy -= 12; });
    descLines.forEach((t) => { text(t, COLS.label + 6, cy, { size: 8, color: MUTED }); cy -= 10.5; });
    text(qty(l.quantity), COLS.qty, y, { align: 'right' });
    text(euro(l.unitPrice), COLS.price, y, { align: 'right' });
    text(pct(l.vatRate), COLS.vat, y, { align: 'right' });
    text(euro(lineHT(l)), COLS.total - 6, y, { align: 'right' });
    y -= h;
    // Trait sous la ligne, à mi-chemin entre son texte et celui de la suivante.
    page.drawLine({ start: { x: M, y: y + 11 }, end: { x: A4.w - M, y: y + 11 }, thickness: 0.5, color: LINE });
  }

  // ── Totaux ─────────────────────────────────────────────────────────────────
  const exempt = !!inv.seller.vatExempt;
  const rows: [string, string, boolean][] = [['Total HT', euro(inv.total_ht), false]];
  if (exempt) rows.push(['TVA', 'non applicable', false]);
  else for (const r of inv.vat_breakdown) rows.push([`TVA ${pct(r.rate)} sur ${euro(r.base)}`, euro(r.vat), false]);
  rows.push([inv.kind === 'avoir' ? 'Total de l’avoir TTC' : 'Total TTC', euro(inv.total_ttc), true]);
  const totalsH = rows.length * 16 + 16;
  if (y - totalsH < footerTop + 10) newPage(false);
  y -= 6;
  const tx = A4.w - M - 240;
  for (const [k, v, strong] of rows) {
    if (strong) {
      y -= 8;
      page.drawRectangle({ x: tx, y: y - 7, width: 240, height: 21, color: INK });
      text(k, tx + 10, y, { font: bold, size: 10, color: rgb(1, 1, 1) });
      text(v, A4.w - M - 10, y, { font: bold, size: 10, color: rgb(1, 1, 1), align: 'right' });
    } else {
      text(k, tx + 10, y, { size: 9, color: MUTED });
      text(v, A4.w - M - 10, y, { size: 9, align: 'right' });
    }
    y -= strong ? 26 : 16;
  }
  if (inv.notes) {
    y -= 6;
    for (const t of wrap(inv.notes, regular, 8.5, A4.w - 2 * M)) {
      if (y < footerTop + 10) newPage(false);
      text(t, M, y, { size: 8.5, color: MUTED });
      y -= 11.5;
    }
  }

  // ── Pied de page : mentions légales et pagination, sur chaque page ─────────
  pages.forEach((p, i) => {
    page = p;
    page.drawLine({ start: { x: M, y: footerTop }, end: { x: A4.w - M, y: footerTop }, thickness: 0.5, color: LINE });
    let fy = footerTop - 12;
    for (const t of footerLines) { text(t, M, fy, { size: 7.5, color: MUTED }); fy -= 10; }
    text(`Page ${i + 1} / ${pages.length}`, A4.w - M, M - 14, { size: 7.5, color: MUTED, align: 'right' });
    if (!issued) {
      p.drawText('BROUILLON', { x: 150, y: 380, size: 80, font: bold, color: ACCENT, opacity: 0.08, rotate: degrees(35) });
    }
  });

  // ── Métadonnées et Factur-X ────────────────────────────────────────────────
  const when = new Date(inv.issue_date ? `${inv.issue_date}T12:00:00Z` : inv.created_at);
  const docTitle = issued ? `${INVOICE_KIND_LABELS[inv.kind]} ${inv.number}` : `${INVOICE_KIND_LABELS[inv.kind]} (brouillon)`;
  const subject = `${INVOICE_KIND_LABELS[inv.kind]} de ${inv.seller.name} pour ${inv.buyer.name}`;
  doc.setTitle(docTitle, { showInWindowTitleBar: true });
  doc.setAuthor(inv.seller.name);
  doc.setSubject(subject);
  doc.setCreator('WeboDevis');
  doc.setProducer('WeboDevis');
  doc.setCreationDate(when);
  doc.setModificationDate(when);
  doc.setLanguage('fr-FR');

  if (issued) {
    const xml = new TextEncoder().encode(buildFacturXml(inv, [sellerIdentityLine(inv.seller), ...invoiceMentions(inv)].filter(Boolean)));
    await doc.attach(xml, FACTURX_FILENAME, {
      mimeType: 'text/xml',
      description: 'Facture au format Factur-X (EN 16931)',
      creationDate: when,
      modificationDate: when,
      afRelationship: AFRelationship.Alternative,
    });
    addPdfA(doc, { title: docTitle, author: inv.seller.name, subject, when });
    // Identifiant du document, stable d'un téléchargement à l'autre.
    const id = crypto.createHash('md5').update(`${inv.id}:${inv.number}`).digest('hex');
    doc.context.trailerInfo.ID = doc.context.obj([PDFHexString.of(id), PDFHexString.of(id)]);
  }
  return doc.save({ useObjectStreams: false });
}

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Métadonnées XMP (PDF/A-3b + extension Factur-X) et intention de sortie sRGB. */
function addPdfA(doc: PDFDocument, m: { title: string; author: string; subject: string; when: Date }) {
  const iso = m.when.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const property = (name: string, description: string) => `
            <rdf:li rdf:parseType="Resource">
              <pdfaProperty:name>${name}</pdfaProperty:name>
              <pdfaProperty:valueType>Text</pdfaProperty:valueType>
              <pdfaProperty:category>external</pdfaProperty:category>
              <pdfaProperty:description>${description}</pdfaProperty:description>
            </rdf:li>`;
  const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(m.title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${xmlEsc(m.author)}</rdf:li></rdf:Seq></dc:creator>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(m.subject)}</rdf:li></rdf:Alt></dc:description>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>WeboDevis</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>WeboDevis</xmp:CreatorTool>
      <xmp:CreateDate>${iso}</xmp:CreateDate>
      <xmp:ModifyDate>${iso}</xmp:ModifyDate>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${FACTURX_FILENAME}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${FACTURX_PROFILE}</fx:ConformanceLevel>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>${property('DocumentFileName', 'name of the embedded XML invoice file')}${property('DocumentType', 'INVOICE')}${property('Version', 'The actual version of the Factur-X XML schema')}${property('ConformanceLevel', 'The conformance level of the embedded Factur-X data')}
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  const ctx = doc.context;
  const metadata = ctx.stream(new TextEncoder().encode(xmp), { Type: 'Metadata', Subtype: 'XML' });
  doc.catalog.set(PDFName.of('Metadata'), ctx.register(metadata));

  const icc = ctx.stream(srgbIccProfile(), { N: 3 });
  const intent = ctx.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
    DestOutputProfile: ctx.register(icc),
  });
  doc.catalog.set(PDFName.of('OutputIntents'), ctx.obj([ctx.register(intent)]));
}
