import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { renderInvoicePdf } from '@/lib/facturx/pdf';
import { getSessionUser } from '@/server/session';
import { getInvoice } from '@/server/invoices';

// PDF d'une facture : Factur-X (PDF/A-3 avec le XML joint) une fois émise, simple aperçu marqué « Brouillon » avant.
// Reconstruit à chaque demande depuis l'instantané figé de la facture : le fichier est toujours le même.
// ?telecharger=1 : téléchargement plutôt qu'affichage dans le navigateur.

export const runtime = 'nodejs';

const FONTS_DIR = path.join(process.cwd(), 'lib/facturx/fonts');
let fonts: Promise<{ regular: Uint8Array; bold: Uint8Array }> | null = null;
const loadFonts = () => (fonts ??= Promise.all([
  fs.readFile(path.join(FONTS_DIR, 'DejaVuSans.ttf')),
  fs.readFile(path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf')),
]).then(([regular, bold]) => ({ regular, bold })));

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
  const invoice = await getInvoice(id);
  if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });

  const bytes = await renderInvoicePdf(invoice, await loadFonts());
  const name = `${invoice.number ?? 'brouillon-facture'}.pdf`.replace(/[^A-Za-z0-9._-]/g, '_');
  const download = request.nextUrl.searchParams.has('telecharger');
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
