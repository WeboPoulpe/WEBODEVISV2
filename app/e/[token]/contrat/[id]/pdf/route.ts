import { NextResponse, type NextRequest } from 'next/server';
import { renderContractPdf } from '@/lib/extraContractPdf';
import { loadPdfFonts } from '@/lib/pdfFonts';
import { contractForExtra } from '@/server/extraHrCore';

// PDF du contrat envoyé à l'extra (signé s'il l'a signé), depuis son lien personnel : le jeton est la seule clé.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const c = await contractForExtra(token, id);
  if (!c) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 });
  const bytes = await renderContractPdf(c.doc, await loadPdfFonts(), {
    hash: c.hash, sentAt: c.sentAt,
    signature: c.status === 'signe' ? { signerName: c.signerName, image: c.signature, signedAt: c.signedAt, ip: c.signerIp, onPaper: c.onPaper } : null,
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${request.nextUrl.searchParams.has('telecharger') ? 'attachment' : 'inline'}; filename="contrat${c.status === 'signe' ? '-signe' : ''}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
