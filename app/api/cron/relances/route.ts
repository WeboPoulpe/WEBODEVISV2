import { NextResponse, type NextRequest } from 'next/server';
import { appOrigin } from '@/lib/mail';
import { runReminders } from '@/server/reminders';

// Relances automatiques des devis sans réponse et des factures échues (voir server/reminders.ts).
// Chaque jour, elles sont lancées par la tâche /api/cron/rappels-extras (l'offre Vercel limite le nombre de tâches) ;
// cette adresse permet de les lancer à part, avec le même « Authorization: Bearer CRON_SECRET ».
// Relancer deux fois le même jour n'envoie rien de plus : l'espacement entre deux relances est vérifié.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  return NextResponse.json(await runReminders({ origin: await appOrigin() }));
}
