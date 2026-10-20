import { NextResponse, type NextRequest } from 'next/server';
import { accountsDueForPurge, purgeAccountNow } from '@/server/accountPurge';
import { purgeOldLoginAttempts } from '@/lib/loginThrottle';
import { logAudit } from '@/lib/audit';

// Purge des comptes dont la suppression a été demandée il y a plus de 30 jours. Lancé chaque nuit par Vercel
// (vercel.json), qui envoie « Authorization: Bearer CRON_SECRET ». Un compte en échec n'empêche pas les autres.

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const ids = await accountsDueForPurge();
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await purgeAccountNow(id);
      await logAudit({ actor: null, target: id, action: 'compte_purge', details: { automatique: true } });
    } catch (e) {
      console.error('[purge]', id, e);
      failed.push(id);
    }
  }
  // Au passage : les échecs de connexion de plus d'un jour.
  await purgeOldLoginAttempts().catch((e) => console.error('[purge] tentatives', e));
  return NextResponse.json({ purged: ids.length - failed.length, failed });
}
