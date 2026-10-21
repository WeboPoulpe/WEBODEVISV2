// PDF d'un contrat d'extra : A4 sobre, articles numérotés, signatures en bas. Le contenu vient de buildContract
// (lib/extraContract.ts), le même que celui affiché à l'extra et figé à l'envoi. Une fois signé en ligne, la
// signature tracée et la trace de la signature (nom, date, adresse IP, empreinte) sont imprimées sous le contrat.

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ContractDoc } from './extraContract';

export interface PdfFonts { regular: Uint8Array; bold: Uint8Array }

export interface ContractSignature {
  /** Signé en ligne : nom saisi, signature tracée (PNG en data URL), horodatage, IP. */
  signerName?: string | null;
  image?: string | null;
  signedAt?: string | null;
  ip?: string | null;
  /** Noté signé sur papier par le traiteur. */
  onPaper?: boolean;
}

const A4 = { w: 595.28, h: 841.89 };
const M = 50;
const INK = rgb(0.11, 0.15, 0.13);
const MUTED = rgb(0.42, 0.45, 0.44);
const LINE = rgb(0.88, 0.86, 0.82);
const ACCENT = rgb(180 / 255, 80 / 255, 45 / 255);

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) out.push(line);
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

const parisDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');

export async function renderContractPdf(doc: ContractDoc, fonts: PdfFonts, opts: { draft?: boolean; hash?: string | null; sentAt?: string | null; signature?: ContractSignature | null } = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${doc.title} : ${doc.employee.name}`);
  pdf.setAuthor(doc.employer.name);
  pdf.setCreator('WeboDevis');
  const regular = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  const width = A4.w - 2 * M;

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    pages.push(page);
    y = A4.h - M;
    if (opts.draft) {
      page.drawText('Brouillon', { x: A4.w - M - bold.widthOfTextAtSize('Brouillon', 9), y: A4.h - 30, size: 9, font: bold, color: ACCENT });
    }
  };
  const need = (h: number) => { if (y - h < M + 24) newPage(); };
  const line = (s: string, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; center?: boolean } = {}) => {
    const size = o.size ?? 9.5;
    const font = o.font ?? regular;
    const x = o.center ? (A4.w - font.widthOfTextAtSize(s, size)) / 2 : (o.x ?? M);
    page.drawText(s, { x, y, size, font, color: o.color ?? INK });
  };
  const paragraph = (text: string, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const size = o.size ?? 9.5;
    const lh = size * 1.38;
    for (const l of wrap(text, o.font ?? regular, size, width - (o.indent ?? 0))) {
      need(lh);
      line(l, { size, font: o.font, color: o.color, x: M + (o.indent ?? 0) });
      y -= lh;
    }
    y -= o.gap ?? 4;
  };

  newPage();
  // ── Titre ──
  for (const l of wrap(doc.title, bold, 15, width)) { line(l, { size: 15, font: bold, center: true }); y -= 20; }
  line(doc.subtitle, { size: 10, color: MUTED, center: true });
  y -= 26;

  // ── Parties ──
  paragraph('Entre les soussignés :', { font: bold, size: 10, gap: 2 });
  paragraph(doc.employer.name, { font: bold, indent: 12, gap: 0 });
  for (const l of doc.employer.lines) paragraph(l, { indent: 12, color: MUTED, gap: 0 });
  paragraph('ci-après « l’employeur »,', { indent: 12, gap: 10 });
  paragraph('Et :', { font: bold, size: 10, gap: 2 });
  paragraph(doc.employee.name, { font: bold, indent: 12, gap: 0 });
  for (const l of doc.employee.lines) paragraph(l, { indent: 12, color: MUTED, gap: 0 });
  paragraph('ci-après « le salarié »,', { indent: 12, gap: 10 });
  paragraph('Il a été convenu ce qui suit.', { gap: 12 });

  // ── Articles ──
  doc.articles.forEach((a, i) => {
    need(40);
    paragraph(`Article ${i + 1}. ${a.title}`, { font: bold, size: 10.5, gap: 3 });
    a.paragraphs.forEach((p) => paragraph(p, { gap: 5 }));
    y -= 6;
  });

  // ── Signatures ──
  need(170);
  paragraph(doc.madeAt, { gap: 14 });
  const col = width / 2 - 10;
  const top = y;
  line('Pour l’employeur', { font: bold, size: 10 });
  y -= 14;
  for (const l of wrap(doc.employerSigner, regular, 9.5, col)) { line(l); y -= 13; }
  if (opts.sentAt) { line(`Contrat établi et envoyé le ${parisDateTime(opts.sentAt)}`, { size: 8, color: MUTED }); y -= 12; }

  const rx = M + width / 2 + 10;
  let ry = top;
  page.drawText('Le salarié', { x: rx, y: ry, size: 10, font: bold, color: INK });
  ry -= 14;
  const sig = opts.signature;
  if (sig?.image && /^data:image\/png;base64,/.test(sig.image)) {
    const png = await pdf.embedPng(Buffer.from(sig.image.split(',')[1], 'base64'));
    const scale = Math.min(col / png.width, 70 / png.height, 1);
    const h = png.height * scale;
    page.drawImage(png, { x: rx, y: ry - h, width: png.width * scale, height: h });
    ry -= h + 6;
    if (sig.signerName) { page.drawText(sig.signerName, { x: rx, y: ry, size: 9.5, font: regular, color: INK }); ry -= 13; }
  } else if (sig?.onPaper) {
    page.drawText('Signé sur papier.', { x: rx, y: ry, size: 9.5, font: regular, color: INK });
    ry -= 13;
  } else {
    page.drawText('Mention « Lu et approuvé » et signature', { x: rx, y: ry, size: 8, font: regular, color: MUTED });
    page.drawRectangle({ x: rx, y: ry - 70, width: col, height: 62, borderColor: LINE, borderWidth: 0.8 });
    ry -= 76;
  }
  y = Math.min(y, ry) - 14;

  if (sig?.image && sig.signedAt) {
    const proof = `Signature électronique simple : ${sig.signerName ?? ''} a accepté et signé ce contrat en ligne le ${parisDateTime(sig.signedAt)} (heure de Paris)`
      + `${sig.ip ? `, depuis l’adresse IP ${sig.ip}` : ''}.${opts.hash ? ` Empreinte du contrat signé (SHA-256) : ${opts.hash}.` : ''}`;
    need(40);
    paragraph(proof, { size: 7.5, color: MUTED });
  }

  // ── Pied de page ──
  pages.forEach((p, i) => {
    const t = `${doc.title}, ${doc.employee.name}. Page ${i + 1} sur ${pages.length}`;
    p.drawLine({ start: { x: M, y: M - 6 }, end: { x: A4.w - M, y: M - 6 }, thickness: 0.5, color: LINE });
    p.drawText(t, { x: M, y: M - 20, size: 7.5, font: regular, color: MUTED });
  });
  return pdf.save();
}
