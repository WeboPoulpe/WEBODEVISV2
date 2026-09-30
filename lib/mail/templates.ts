import { esc, renderEmail } from './layout';

// Un email = un objet et un corps. Les textes saisis par les utilisateurs sont toujours échappés.

export interface Email {
  subject: string;
  html: string;
}

const dateFr = (iso: string | null | undefined) =>
  iso ? new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

/** Texte libre : échappé, retours à la ligne conservés. */
const multiline = (text: string) => esc(text).replace(/\r?\n/g, '<br>');

// ── Compte ────────────────────────────────────────────────────────────────────
export function welcomeEmail({ firstName, appUrl }: { firstName: string | null; appUrl: string }): Email {
  return {
    subject: 'Bienvenue sur WeboDevis',
    html: renderEmail({
      preheader: 'Votre compte est prêt. Créez votre premier devis.',
      title: firstName ? `Bienvenue ${firstName}` : 'Bienvenue',
      paragraphs: [
        'Votre compte WeboDevis est créé. Vous pouvez dès maintenant préparer vos devis, suivre vos demandes et organiser vos événements.',
        'Pour bien démarrer : renseignez votre entreprise et votre logo, ajoutez quelques prestations, puis créez votre premier devis.',
      ],
      button: { label: 'Ouvrir WeboDevis', url: appUrl },
    }),
  };
}

export function passwordResetEmail({ link }: { link: string }): Email {
  return {
    subject: 'Réinitialisation de votre mot de passe WeboDevis',
    html: renderEmail({
      preheader: 'Choisissez un nouveau mot de passe. Le lien est valable une heure.',
      title: 'Nouveau mot de passe',
      paragraphs: ['Vous avez demandé à changer de mot de passe. Le bouton ci-dessous ouvre la page où en choisir un nouveau.'],
      button: { label: 'Choisir un nouveau mot de passe', url: link },
      note: 'Ce lien est valable une heure et ne peut servir qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.',
    }),
  };
}

// ── Demandes reçues par le formulaire ─────────────────────────────────────────
export interface ProspectDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  eventType?: string | null;
  eventDate?: string | null;
  guestCount?: number | null;
  guestCountChildren?: number | null;
  location?: string | null;
  message?: string | null;
}

const prospectFacts = (p: ProspectDetails): [string, string][] => [
  ['Événement', p.eventType ?? ''],
  ['Date', dateFr(p.eventDate)],
  ['Couverts', p.guestCount ? `${p.guestCount}${p.guestCountChildren ? `, dont ${p.guestCountChildren} enfants` : ''}` : ''],
  ['Lieu', p.location ?? ''],
];

/** Au traiteur : une nouvelle demande vient d'arriver. */
export function prospectNotificationEmail({ prospect, appUrl }: { prospect: ProspectDetails; appUrl: string }): Email {
  const name = `${prospect.firstName} ${prospect.lastName}`.trim();
  return {
    subject: `Nouvelle demande de devis : ${name}`,
    html: renderEmail({
      preheader: `${name} vient de vous envoyer une demande${prospect.eventType ? ` pour un ${prospect.eventType.toLowerCase()}` : ''}.`,
      title: 'Nouvelle demande de devis',
      paragraphs: [
        `<strong style="color:#1B1A17;">${esc(name)}</strong> vient de remplir votre formulaire.`,
        ...(prospect.message ? [`« ${multiline(prospect.message)} »`] : []),
      ],
      facts: [['Email', prospect.email], ['Téléphone', prospect.phone ?? ''], ...prospectFacts(prospect)],
      button: { label: 'Voir la demande', url: `${appUrl}/prospects` },
      note: 'Répondre à cet email écrit directement à la personne.',
    }),
  };
}

/** À la personne qui a rempli le formulaire : accusé de réception, au nom du traiteur. */
export function prospectAckEmail({ companyName, prospect }: { companyName: string; prospect: ProspectDetails }): Email {
  return {
    subject: `${companyName} a bien reçu votre demande`,
    html: renderEmail({
      brand: companyName,
      preheader: 'Votre demande est bien arrivée. Nous revenons vers vous rapidement.',
      title: `Merci ${prospect.firstName}`,
      paragraphs: [
        'Votre demande de devis est bien arrivée. Nous l’étudions et revenons vers vous rapidement.',
        'Voici ce que vous nous avez transmis :',
      ],
      facts: prospectFacts(prospect),
      note: 'Pour compléter ou corriger votre demande, répondez simplement à cet email.',
      footer: `Envoyé par ${companyName} avec WeboDevis.`,
    }),
  };
}

// ── Devis envoyé au client ────────────────────────────────────────────────────
export function quoteProposalEmail({ companyName, clientName, eventType, eventDate, guestCount, message, link }: {
  companyName: string;
  clientName: string;
  eventType: string | null;
  eventDate: string | null;
  guestCount: number | null;
  message: string;
  link: string;
}): Email {
  return {
    subject: `Votre devis ${companyName}${eventType ? `, ${eventType.toLowerCase()}` : ''}`,
    html: renderEmail({
      brand: companyName,
      preheader: `${companyName} vous envoie sa proposition.`,
      title: clientName ? `Bonjour ${clientName}` : 'Bonjour',
      paragraphs: [multiline(message)],
      facts: [
        ['Événement', eventType ?? ''],
        ['Date', dateFr(eventDate)],
        ['Couverts', guestCount ? String(guestCount) : ''],
      ],
      button: { label: 'Consulter le devis', url: link },
      note: 'Le devis s’ouvre dans votre navigateur ; vous pouvez l’enregistrer en PDF ou l’imprimer. Pour toute question, répondez à cet email.',
      footer: `Envoyé par ${companyName} avec WeboDevis.`,
    }),
  };
}

// ── Demandes envoyées depuis le site de présentation ──────────────────────────
export interface SiteRequestDetails {
  kind: 'devis' | 'message';
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  teamSize?: string | null;
  message: string;
}

/** À l'équipe WeboDevis : une demande vient d'arriver par le site. */
export function siteRequestNotificationEmail({ request, appUrl }: { request: SiteRequestDetails; appUrl: string }): Email {
  const what = request.kind === 'devis' ? 'Demande de devis' : 'Message';
  return {
    subject: `${what} depuis le site : ${request.name}`,
    html: renderEmail({
      preheader: `${request.name}${request.company ? `, ${request.company}` : ''} vous écrit depuis webodevis.fr.`,
      title: request.kind === 'devis' ? 'Nouvelle demande de devis' : 'Nouveau message',
      paragraphs: [`« ${multiline(request.message)} »`],
      facts: [
        ['Nom', request.name],
        ['Entreprise', request.company ?? ''],
        ['Email', request.email],
        ['Téléphone', request.phone ?? ''],
        ['Équipe', request.teamSize ?? ''],
      ],
      button: { label: 'Ouvrir dans l’administration', url: `${appUrl}/admin/demandes` },
      note: 'Répondre à cet email écrit directement à la personne.',
    }),
  };
}

/** À la personne qui a écrit : accusé de réception. */
export function siteRequestAckEmail({ request }: { request: SiteRequestDetails }): Email {
  return {
    subject: request.kind === 'devis' ? 'Votre demande de devis WeboDevis' : 'Nous avons bien reçu votre message',
    html: renderEmail({
      preheader: 'Votre message est bien arrivé. Nous vous répondons rapidement.',
      title: `Merci ${request.name.split(/\s+/)[0]}`,
      paragraphs: [
        request.kind === 'devis'
          ? 'Votre demande de devis est bien arrivée. Nous l’étudions et revenons vers vous par email.'
          : 'Votre message est bien arrivé. Nous vous répondons par email.',
        'Pour mémoire, voici ce que vous nous avez écrit :',
        `« ${multiline(request.message)} »`,
      ],
      note: 'Pour compléter votre demande, répondez simplement à cet email.',
    }),
  };
}

// ── Compte créé par un administrateur ─────────────────────────────────────────
export function accountInviteEmail({ firstName, link }: { firstName: string | null; link: string }): Email {
  return {
    subject: 'Votre compte WeboDevis est prêt',
    html: renderEmail({
      preheader: 'Choisissez votre mot de passe pour ouvrir votre compte.',
      title: firstName ? `Bienvenue ${firstName}` : 'Bienvenue',
      paragraphs: ['Un compte WeboDevis vient d’être créé pour vous. Il ne reste qu’à choisir votre mot de passe.'],
      button: { label: 'Choisir mon mot de passe', url: link },
      note: 'Ce lien est valable sept jours et ne peut servir qu’une fois. Passé ce délai, utilisez « Mot de passe oublié » sur la page de connexion.',
    }),
  };
}

// ── Démonstration ─────────────────────────────────────────────────────────────
/** À l'équipe WeboDevis : quelqu'un vient d'ouvrir la démonstration en laissant ses coordonnées. */
export function demoLeadNotificationEmail({ name, email, phone, company, appUrl }: { name: string; email: string; phone: string; company: string | null; appUrl: string }): Email {
  return {
    subject: `Essai de la démo : ${name}`,
    html: renderEmail({
      preheader: `${name}${company ? `, ${company}` : ''} vient d’ouvrir la démonstration.`,
      title: 'Nouvel essai de la démonstration',
      paragraphs: [`<strong style="color:#1B1A17;">${esc(name)}</strong> vient d’ouvrir la démonstration depuis le site.`],
      facts: [['Entreprise', company ?? ''], ['Email', email], ['Téléphone', phone]],
      button: { label: 'Ouvrir dans l’administration', url: `${appUrl}/admin/demandes` },
      note: 'Répondre à cet email écrit directement à la personne.',
    }),
  };
}

/** À la personne : le lien pour rouvrir la démonstration, et la suite possible. */
export function demoAccessEmail({ firstName, link, contactUrl }: { firstName: string; link: string; contactUrl: string }): Email {
  return {
    subject: 'Votre accès à la démonstration WeboDevis',
    html: renderEmail({
      preheader: 'Un lien pour rouvrir la démonstration quand vous voulez, pendant sept jours.',
      title: `Bonjour ${firstName}`,
      paragraphs: [
        'La démonstration de WeboDevis vous est ouverte. Vous y entrez dans le compte d’un traiteur fictif, Maison Verdier : devis, demandes, événements, courses, équipe.',
        'Ce lien vous y ramène sans rien ressaisir, pendant sept jours.',
      ],
      button: { label: 'Rouvrir la démonstration', url: link },
      note: `Pour en parler ou recevoir une proposition pour votre activité, répondez à cet email ou <a href="${esc(contactUrl)}" style="color:#B4502D;">demandez un devis</a>.`,
    }),
  };
}
