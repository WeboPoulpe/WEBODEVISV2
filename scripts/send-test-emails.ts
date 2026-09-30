// Envoie un exemplaire de chaque email de l'app à une adresse, pour les relire dans une vraie messagerie.
// Usage : npx tsx scripts/send-test-emails.ts vous@exemple.fr
// Les données sont fictives ; rien n'est lu ni écrit en base.
import fs from 'node:fs';
import path from 'node:path';
import {
  passwordResetEmail, prospectAckEmail, prospectNotificationEmail, quoteProposalEmail, welcomeEmail,
} from '../lib/mail/templates';

function envLocal(name: string): string {
  const file = path.join(__dirname, '..', '.env.local');
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return (line ?? '').slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
}

const to = process.argv[2];
if (!to) throw new Error('Adresse du destinataire manquante');
const key = envLocal('RESEND_API_KEY');
if (!key) throw new Error('RESEND_API_KEY est vide dans .env.local');
const from = envLocal('MAIL_FROM') || 'WeboDevis <onboarding@resend.dev>';
const address = /<([^>]+)>/.exec(from)?.[1] ?? from;
const appUrl = 'https://webodevis.fr';

const prospect = {
  firstName: 'Claire', lastName: 'Martin', email: 'claire.martin@exemple.fr', phone: '06 12 34 56 78',
  eventType: 'Mariage', eventDate: '2027-06-12', guestCount: 80, guestCountChildren: 6, location: 'Domaine des Tilleuls, Troyes',
  message: 'Bonjour,\nnous cherchons un traiteur pour notre mariage. Un cocktail puis un dîner assis.',
};

const mails = [
  { from, ...welcomeEmail({ firstName: 'Maxence', appUrl }) },
  { from, ...passwordResetEmail({ link: `${appUrl}/reset-password?token=exemple` }) },
  { from, ...prospectNotificationEmail({ prospect, appUrl }) },
  { from: `Maison Exemple Traiteur <${address}>`, ...prospectAckEmail({ companyName: 'Maison Exemple Traiteur', prospect }) },
  {
    from: `Maison Exemple Traiteur <${address}>`,
    ...quoteProposalEmail({
      companyName: 'Maison Exemple Traiteur', clientName: 'Claire', eventType: 'Mariage', eventDate: '2027-06-12', guestCount: 80,
      message: 'Vous trouverez ci-dessous notre proposition pour votre mariage du 12 juin 2027.\n\nNous restons à votre disposition pour en discuter ou l’ajuster.',
      link: `${appUrl}/d/exemple`,
    }),
  },
];

(async () => {
  for (const mail of mails) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: mail.from, to, subject: `[Essai] ${mail.subject}`, html: mail.html }),
    });
    console.log(res.ok ? 'envoyé ' : `refusé (${res.status})`, '·', mail.subject, res.ok ? '' : (await res.text()).slice(0, 200));
    // Resend limite le nombre d'envois par seconde.
    await new Promise((r) => setTimeout(r, 700));
  }
})();
