import { esc, renderEmail } from './layout';
import type { Email } from './templates';

// Emails des contrats d'extra et des rappels de DPAE. Aucune donnée personnelle de l'extra (état civil,
// n° de sécurité sociale, adresse) n'est écrite dans le corps d'un email : le nom et la mission seulement.

const dateFr = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';

/** À l'extra : son contrat en pièce jointe, et le lien pour le signer en ligne. */
export function extraContractEmail({ companyName, extraName, eventType, eventDate, link }: {
  companyName: string; extraName: string; eventType: string | null; eventDate: string | null; link: string;
}): Email {
  const first = extraName.trim().split(/\s+/)[0] ?? '';
  const what = [eventType || 'mission', eventDate ? `du ${dateFr(eventDate)}` : ''].filter(Boolean).join(' ');
  return {
    subject: `Votre contrat de travail avec ${companyName}`,
    html: renderEmail({
      brand: companyName,
      preheader: 'Votre contrat est en pièce jointe : lisez-le et signez-le en ligne.',
      title: `Bonjour ${esc(first)}`,
      paragraphs: [
        `${esc(companyName)} vous envoie votre contrat de travail pour la mission ${esc(what)}.`,
        'Le contrat est joint à cet email en PDF. Lisez-le, puis signez-le en ligne depuis le bouton ci-dessous : la version signée se télécharge ensuite sur la même page.',
      ],
      button: { label: 'Lire et signer mon contrat', url: link },
      note: 'Une question sur le contrat ? Répondez simplement à cet email.',
    }),
  };
}

export interface DpaeReminderMission { extraName: string; eventType: string | null; eventDate: string; arrival: string | null }

/** Au traiteur : DPAE à faire pour ses prochaines missions (une seule fois par mission). */
export function dpaeReminderEmail({ companyName, missions, link }: { companyName: string; missions: DpaeReminderMission[]; link: string }): Email {
  const n = missions.length;
  return {
    subject: n > 1 ? `${n} déclarations d’embauche (DPAE) à faire` : `Déclaration d’embauche (DPAE) à faire : ${missions[0]?.extraName ?? ''}`,
    html: renderEmail({
      preheader: 'La DPAE doit être faite avant la prise de poste de vos extras.',
      title: n > 1 ? `${n} DPAE à faire` : 'Une DPAE à faire',
      paragraphs: [
        `Bonjour ${esc(companyName)},`,
        `${n > 1 ? 'Ces extras confirmés commencent' : 'Cet extra confirmé commence'} dans les prochains jours et ${n > 1 ? 'leur déclaration préalable à l’embauche n’est' : 'sa déclaration préalable à l’embauche n’est'} pas encore notée comme faite. Elle doit être faite avant la prise de poste, au plus tôt 8 jours avant.`,
        'Dans WeboDevis, ouvrez la mission puis « Contrat et DPAE » : toutes les informations à recopier sur due.urssaf.fr y sont rassemblées.',
      ],
      facts: missions.slice(0, 12).map((m) => [m.extraName, [m.eventType || 'Mission', dateFr(m.eventDate), m.arrival ? `à ${m.arrival.replace(':', ' h ')}` : ''].filter(Boolean).join(', ')]),
      button: { label: 'Voir mes extras', url: link },
      note: n > 12 ? `Et ${n - 12} autre${n - 12 > 1 ? 's' : ''} mission${n - 12 > 1 ? 's' : ''}.` : 'Vous ne recevez ce rappel qu’une fois par mission.',
    }),
  };
}
