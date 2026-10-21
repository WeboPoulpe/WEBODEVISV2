import { NextResponse, type NextRequest } from 'next/server';
import { documentsCsv, fecEntries, fecFileName, fecText, isBalanced, isIsoDate, paymentsCsv, sirenOf } from '@/lib/accountingExport';
import { accountingExportData } from '@/server/accountingExport';
import { getSessionUser } from '@/server/session';

// Export comptable : GET /api/factures/export?format=csv|fec&from=AAAA-MM-JJ&to=AAAA-MM-JJ&type=factures|paiements
// CSV : factures et avoirs (type=factures) ou paiements (type=paiements). FEC : tout dans un seul fichier.
// Seuls les documents de l'entreprise de l'utilisateur connecté sont lus (server/accountingExport.ts).
// En-têtes de réponse : X-Export-Count (nombre de lignes ou d'écritures), X-Siren-Manquant (FEC sans SIREN).

export const runtime = 'nodejs';

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function GET(request: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const format = q.get('format');
  const type = q.get('type') ?? 'factures';
  const from = q.get('from');
  const to = q.get('to');
  if (format !== 'csv' && format !== 'fec') return bad('Format inconnu.');
  if (type !== 'factures' && type !== 'paiements') return bad('Contenu inconnu.');
  if (!isIsoDate(from) || !isIsoDate(to)) return bad('Indiquez les dates de début et de fin.');
  if (from > to) return bad('La date de début est après la date de fin.');

  const data = await accountingExportData(from, to);
  const headers: Record<string, string> = { 'Cache-Control': 'private, no-store' };
  let body: string;
  let name: string;
  let count: number;

  if (format === 'fec') {
    const entries = fecEntries(data.documents, data.payments, data.accounts);
    if (!entries.every(isBalanced)) return NextResponse.json({ error: 'Une écriture n’est pas équilibrée : export interrompu.' }, { status: 500 });
    const siren = sirenOf(data.siret);
    body = fecText(entries);
    name = fecFileName(siren, to);
    count = entries.length;
    headers['Content-Type'] = 'text/plain; charset=utf-8';
    if (!siren) headers['X-Siren-Manquant'] = '1';
  } else if (type === 'paiements') {
    body = paymentsCsv(data.payments);
    name = `paiements_${from}_${to}.csv`;
    count = data.payments.length;
    headers['Content-Type'] = 'text/csv; charset=utf-8';
  } else {
    body = documentsCsv(data.documents);
    name = `factures-avoirs_${from}_${to}.csv`;
    count = data.documents.length;
    headers['Content-Type'] = 'text/csv; charset=utf-8';
  }

  headers['Content-Disposition'] = `attachment; filename="${name}"`;
  headers['X-Export-Count'] = String(count);
  return new NextResponse(body, { headers });
}
