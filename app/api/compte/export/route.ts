import { NextResponse } from 'next/server';
import { executeQuery } from '@/server/compat/execute';
import { RULES } from '@/server/compat/rules';
import { getSessionUser } from '@/server/session';
import { listInvoices } from '@/server/invoices';
import { exportHrData } from '@/server/extraHrCore';

// Export des données du compte (droit à la portabilité, art. 20 du RGPD) : un fichier JSON avec tout ce que
// le compte peut lire, table par table. Les règles d'accès de /api/db s'appliquent : rien d'un autre compte.
// Les lignes communes à tous les comptes (ingrédients et catégories sans propriétaire) ne sont pas reprises.

export const runtime = 'nodejs';

const SHARED = new Set(['ingredients', 'prestation_categories', 'prestation_subcategories']);

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  const tables: Record<string, unknown[]> = {};
  for (const table of Object.keys(RULES).sort()) {
    const res = await executeQuery({ table, op: 'select', select: '*', filters: [], order: [] }, { uid: user.id });
    if (res.error) continue; // table absente de cette base : rien à exporter
    let rows = (res.data ?? []) as Record<string, unknown>[];
    if (SHARED.has(table)) rows = rows.filter((r) => r.user_id === user.id);
    if (rows.length) tables[table] = rows;
  }
  const invoices = await listInvoices().catch(() => []);
  if (invoices.length) tables.factures = invoices;
  // Fiches administratives des extras, contrats et réglages d'employeur : hors de /api/db, exportés à part.
  Object.assign(tables, await exportHrData(user.id).catch(() => ({})));

  const body = JSON.stringify({
    format: 'WeboDevis, export des données du compte',
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    tables,
  }, null, 2);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="webodevis-mes-donnees-${day}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
