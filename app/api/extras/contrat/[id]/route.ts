import { NextResponse, type NextRequest } from 'next/server';
import { renderContractPdf } from '@/lib/extraContractPdf';
import { loadPdfFonts } from '@/lib/pdfFonts';
import { getSessionUser } from '@/server/session';
import { companyRole, contractBundle, missionOf } from '@/server/extraHrCore';

// PDF du contrat d'une mission (identifiant de l'affectation), pour le traiteur : le contrat envoyé (figé, avec la
// signature s'il est signé), sinon un brouillon calculé avec les données du moment.
// Réservé aux comptes de l'entreprise qui ne sont pas en consultation seule (le contrat contient l'état civil de l'extra).
// ?telecharger=1 : téléchargement plutôt qu'affichage dans le navigateur.

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
  if ((await companyRole(user.id)).role === 'lecture') return NextResponse.json({ error: 'Accès en consultation seule' }, { status: 403 });
  const { id } = await params;
  const ctx = await missionOf(user.id, id);
  if (!ctx) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });

  const c = ctx.contract;
  const frozen = c && c.status !== 'brouillon' && c.snapshot;
  const doc = frozen ? c.snapshot! : (await contractBundle(ctx)).doc;
  const bytes = await renderContractPdf(doc, await loadPdfFonts(), {
    draft: !frozen,
    hash: frozen ? c.content_hash : null,
    sentAt: frozen ? c.sent_at : null,
    signature: c?.status === 'signe' ? { signerName: c.signer_name, image: c.signature, signedAt: c.signed_at, ip: c.signer_ip, onPaper: c.signed_on_paper } : null,
  });
  const name = `contrat-${ctx.mission.eventDate ?? 'extra'}.pdf`.replace(/[^A-Za-z0-9._-]/g, '_');
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${request.nextUrl.searchParams.has('telecharger') ? 'attachment' : 'inline'}; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
