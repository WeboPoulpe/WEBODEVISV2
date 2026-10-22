import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { appOrigin, sendMail } from '@/lib/mail';
import { prospectAckEmail, prospectNotificationEmail, type ProspectDetails } from '@/lib/mail/templates';

// Emails d'une nouvelle demande de prospect (formulaire du site, fin de brochure) : alerte au traiteur, accusé de
// réception à la personne, au nom du traiteur. Un envoi raté ne perd pas la demande.

export async function notifyProspect({ ownerId, prospect, brochureName = null, language = 'fr' }: { ownerId: string; prospect: ProspectDetails; brochureName?: string | null; /** Langue de l'accusé de réception. */ language?: 'fr' | 'en' }): Promise<void> {
  const [owner] = await db
    .select({ email: profiles.email, company_name: profiles.company_name, company_email: profiles.company_email })
    .from(profiles).where(eq(profiles.id, ownerId)).limit(1);
  if (!owner) return;
  const catererEmail = owner.company_email || owner.email;
  const companyName = owner.company_name || 'Votre traiteur';
  await Promise.all([
    sendMail({ to: catererEmail, replyTo: prospect.email, ...prospectNotificationEmail({ prospect, appUrl: await appOrigin(), brochureName }) }),
    sendMail({ to: prospect.email, fromName: companyName, replyTo: catererEmail, ...prospectAckEmail({ companyName, prospect, language }) }),
  ]);
}
