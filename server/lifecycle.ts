import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { DEMO_USER_ID } from '@/lib/demo';
import { sendMail } from '@/lib/mail';
import { lifecycleEmail, type LifecycleKind } from '@/lib/mail/templates';
import { signTicket } from './tickets';

// Emails de conseils aux titulaires de compte : premiers pas (J+1, J+3, J+7) et relance après 21 jours sans
// connexion. Chacun ne part qu'une fois par compte (table lifecycle_emails) et seulement s'il est utile
// (« premier devis » n'est pas envoyé à qui en a déjà fait). Désinscription en un clic (profiles.tips_opt_out).
// Lancé chaque jour par la tâche planifiée existante ; aucun export d'action serveur ici.

const DAY = 86400_000;
const YEAR = 365 * DAY;

interface Candidate {
  id: string;
  email: string;
  first_name: string | null;
  age_days: number;
  idle_days: number | null;
  prestations: number;
  quotes: number;
  sent: number;
}

/** Quel email (au plus un par jour et par compte) envoyer à ce compte aujourd'hui. */
export function nextLifecycleEmail(c: Candidate, already: ReadonlySet<string>): LifecycleKind | null {
  const pick = (k: LifecycleKind) => (already.has(k) ? null : k);
  if (c.age_days >= 1 && c.age_days < 7 && c.prestations === 0) return pick('catalogue');
  if (c.age_days >= 3 && c.age_days < 10 && c.quotes === 0) return pick('premier_devis');
  if (c.age_days >= 7 && c.age_days < 14 && c.quotes > 0 && c.sent === 0) return pick('envoi_en_ligne');
  if (c.age_days >= 21 && c.idle_days !== null && c.idle_days >= 21) return pick('inactif');
  return null;
}

export async function runLifecycleEmails({ origin }: { origin: string }): Promise<{ sent: number }> {
  const { rows } = await db.execute(sql`
    select p.id, p.email, p.first_name,
      floor(extract(epoch from (now() - p.created_at)) / 86400)::int as age_days,
      case when p.last_seen_at is null then null else floor(extract(epoch from (now() - p.last_seen_at)) / 86400)::int end as idle_days,
      (select count(*)::int from public.prestations x where x.user_id in (select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = p.id)) as prestations,
      (select count(*)::int from public.quotes q where q.owner_user_id in (select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = p.id)) as quotes,
      (select count(*)::int from public.quotes q where q.sent_at is not null and q.owner_user_id in (select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = p.id)) as sent,
      coalesce((select array_agg(l.kind) from public.lifecycle_emails l where l.user_id = p.id), '{}') as already
    from public.profiles p
    where p.parent_user_id is null and p.role = 'user' and p.is_active and not p.tips_opt_out
      and p.deletion_requested_at is null and p.id <> ${DEMO_USER_ID}::uuid
      and p.created_at > now() - interval '120 days'`);

  let sent = 0;
  for (const r of rows as unknown as (Candidate & { already: string[] })[]) {
    const kind = nextLifecycleEmail(r, new Set(r.already));
    if (!kind) continue;
    // Réservé avant l'envoi : deux exécutions simultanées n'envoient pas deux fois.
    const reserved = await db.execute(sql`insert into public.lifecycle_emails (user_id, kind) values (${r.id}::uuid, ${kind}) on conflict do nothing returning kind`);
    if (reserved.rows.length === 0) continue;
    const unsubscribe = `${origin}/api/conseils/desabonner?t=${encodeURIComponent(signTicket({ k: 'tips', u: r.id }, YEAR))}`;
    const res = await sendMail({ to: r.email, ...lifecycleEmail({ kind, firstName: r.first_name, appUrl: origin, unsubscribe }) });
    if (res.error) {
      await db.execute(sql`delete from public.lifecycle_emails where user_id = ${r.id}::uuid and kind = ${kind}`);
      continue;
    }
    sent++;
  }
  return { sent };
}
