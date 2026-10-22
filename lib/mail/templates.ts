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
const longDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Au titulaire : sa demande de suppression est enregistrée. */
export function accountDeletionEmail({ firstName, purgeOn, contactUrl }: { firstName: string | null; purgeOn: string; contactUrl: string }): Email {
  return {
    subject: 'Suppression de votre compte WeboDevis',
    html: renderEmail({
      preheader: `Vos données seront effacées le ${longDate(purgeOn)}.`,
      title: firstName ? `Au revoir ${esc(firstName)}` : 'Votre demande est enregistrée',
      paragraphs: [
        `Votre compte est désactivé. Toutes vos données (devis, clients, factures, fichiers) seront définitivement effacées le <strong>${longDate(purgeOn)}</strong>.`,
        'Vous avez changé d’avis ? Écrivez-nous avant cette date et nous réactiverons votre compte tel quel.',
        'Pensez à conserver vos factures : la loi vous demande de les garder dix ans.',
      ],
      button: { label: 'Nous écrire', url: contactUrl },
    }),
  };
}

/** À l'équipe : un titulaire a demandé la suppression de son compte. */
export function accountDeletionAdminEmail({ email, purgeOn, appUrl }: { email: string; purgeOn: string; appUrl: string }): Email {
  return {
    subject: `Suppression de compte demandée : ${email}`,
    html: renderEmail({
      preheader: `${email} a demandé la suppression de son compte.`,
      title: 'Suppression de compte demandée',
      paragraphs: [`${esc(email)} a demandé la suppression de son compte. Il est désactivé ; la purge automatique aura lieu le ${longDate(purgeOn)}.`],
      button: { label: 'Voir les comptes', url: `${appUrl}/admin/comptes` },
    }),
  };
}

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

/** Après un changement de mot de passe depuis les Paramètres : prévient la personne, au cas où ce ne serait pas elle. */
export function passwordChangedEmail({ loginUrl }: { loginUrl: string }): Email {
  return {
    subject: 'Votre mot de passe WeboDevis a été changé',
    html: renderEmail({
      preheader: 'Le mot de passe de votre compte vient d’être modifié.',
      title: 'Mot de passe changé',
      paragraphs: ['Le mot de passe de votre compte WeboDevis vient d’être changé depuis les Paramètres. Utilisez-le désormais pour vous connecter.'],
      button: { label: 'Ouvrir WeboDevis', url: loginUrl },
      note: 'Si vous n’êtes pas à l’origine de ce changement, choisissez tout de suite un nouveau mot de passe avec « Mot de passe oublié » sur la page de connexion, puis écrivez-nous.',
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
export function prospectNotificationEmail({ prospect, appUrl, brochureName }: { prospect: ProspectDetails; appUrl: string; /** Demande envoyée depuis une brochure. */ brochureName?: string | null }): Email {
  const name = `${prospect.firstName} ${prospect.lastName}`.trim();
  return {
    subject: `Nouvelle demande de devis : ${name}`,
    html: renderEmail({
      preheader: `${name} vient de vous envoyer une demande${prospect.eventType ? ` pour un ${prospect.eventType.toLowerCase()}` : ''}.`,
      title: 'Nouvelle demande de devis',
      paragraphs: [
        brochureName
          ? `<strong style="color:#1B1A17;">${esc(name)}</strong> vous écrit depuis votre brochure « ${esc(brochureName)} ».`
          : `<strong style="color:#1B1A17;">${esc(name)}</strong> vient de remplir votre formulaire.`,
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
export function quoteProposalEmail({ companyName, quoteNumber, clientName, eventType, eventDate, guestCount, message, link }: {
  companyName: string;
  quoteNumber?: string | null;
  clientName: string;
  eventType: string | null;
  eventDate: string | null;
  guestCount: number | null;
  message: string;
  link: string;
}): Email {
  return {
    subject: `Votre devis ${companyName}${quoteNumber ? ` n° ${quoteNumber}` : ''}${eventType ? `, ${eventType.toLowerCase()}` : ''}`,
    html: renderEmail({
      brand: companyName,
      preheader: `${companyName} vous envoie sa proposition.`,
      title: clientName ? `Bonjour ${clientName}` : 'Bonjour',
      paragraphs: [multiline(message)],
      facts: [
        ['Devis n°', quoteNumber ?? ''],
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

// ── Devis accepté en ligne ────────────────────────────────────────────────────
export interface AcceptanceDetails {
  companyName: string;
  quoteNumber: string | null;
  signerName: string;
  eventType: string | null;
  eventDate: string | null;
  totalTTC: number | null;
  acceptedAt: string;
  /** Formule choisie par le client (devis à plusieurs formules). */
  formulaName?: string | null;
}

const euroFr = (n: number | null) => (n == null ? '' : `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const acceptanceFacts = (a: AcceptanceDetails): [string, string][] => [
  ['Devis n°', a.quoteNumber ?? ''],
  ['Signé par', a.signerName],
  ['Le', new Date(a.acceptedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' })],
  ['Événement', a.eventType ?? ''],
  ['Date', dateFr(a.eventDate)],
  ...(a.formulaName ? [['Formule retenue', a.formulaName] as [string, string]] : []),
  ['Montant TTC', euroFr(a.totalTTC)],
];

/** Au traiteur : son client vient d'accepter le devis en ligne. */
export function quoteAcceptedOwnerEmail({ acceptance, link }: { acceptance: AcceptanceDetails; link: string }): Email {
  return {
    subject: `Devis accepté${acceptance.quoteNumber ? ` n° ${acceptance.quoteNumber}` : ''} par ${acceptance.signerName}`,
    html: renderEmail({
      preheader: `${acceptance.signerName} a signé le devis en ligne.`,
      title: 'Votre devis est accepté',
      paragraphs: [`${esc(acceptance.signerName)} a accepté et signé le devis en ligne. Il est passé au statut « Validé ».`],
      facts: acceptanceFacts(acceptance),
      button: { label: 'Voir le devis', url: link },
      note: 'Pensez à préparer la facture d’acompte depuis la fiche du devis.',
    }),
  };
}

/** Au client : confirmation de son acceptation. */
export function quoteAcceptedClientEmail({ acceptance, link }: { acceptance: AcceptanceDetails; link: string }): Email {
  return {
    subject: `Votre accord pour le devis ${acceptance.companyName}`,
    html: renderEmail({
      brand: acceptance.companyName,
      preheader: 'Votre acceptation est bien enregistrée.',
      title: 'Merci, votre accord est enregistré',
      paragraphs: [`${esc(acceptance.companyName)} a bien reçu votre acceptation du devis. Vous pouvez le consulter à tout moment avec le lien ci-dessous.`],
      facts: acceptanceFacts(acceptance),
      button: { label: 'Revoir le devis', url: link },
      footer: `Envoyé par ${acceptance.companyName} avec WeboDevis.`,
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

// ── Extras ────────────────────────────────────────────────────────────────────
export interface MissionDetails {
  extraName: string;
  companyName: string;
  eventType: string | null;
  eventDate: string | null;
  location: string | null;
  arrival: string | null;
  departure: string | null;
  notes: string | null;
}

const missionFacts = (m: MissionDetails): [string, string][] => [
  ['Événement', esc(m.eventType || 'Événement')],
  ...(m.eventDate ? [['Date', esc(new Date(m.eventDate.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))] as [string, string]] : []),
  ...(m.arrival ? [['Horaires', esc(m.departure ? `${m.arrival} à ${m.departure}` : `Arrivée à ${m.arrival}`)] as [string, string]] : []),
  ...(m.location ? [['Lieu', esc(m.location)] as [string, string]] : []),
  ...(m.notes ? [['Consignes', esc(m.notes).replace(/\n/g, '<br>')] as [string, string]] : []),
];

/** À l'extra : une mission proposée, avec le lien pour répondre. */
export function missionInviteEmail({ mission, link }: { mission: MissionDetails; link: string }): Email {
  const first = mission.extraName.trim().split(/\s+/)[0] ?? '';
  return {
    subject: `Mission proposée par ${mission.companyName}`,
    html: renderEmail({
      brand: mission.companyName,
      preheader: 'Dites si vous êtes disponible, en un clic.',
      title: `Bonjour ${esc(first)}`,
      paragraphs: [`${esc(mission.companyName)} vous propose une mission. Dites si vous êtes disponible depuis votre page de missions.`],
      facts: missionFacts(mission),
      button: { label: 'Voir et répondre', url: link },
      note: 'Installez cette page sur votre téléphone pour recevoir vos prochaines missions en notification.',
    }),
  };
}

/** À l'extra, la veille : rappel de la mission confirmée. */
export function missionReminderEmail({ mission, link }: { mission: MissionDetails; link: string }): Email {
  const first = mission.extraName.trim().split(/\s+/)[0] ?? '';
  return {
    subject: `Rappel : mission demain avec ${mission.companyName}`,
    html: renderEmail({
      brand: mission.companyName,
      preheader: mission.arrival ? `Arrivée à ${mission.arrival}.` : 'Votre mission de demain.',
      title: `À demain, ${esc(first)}`,
      paragraphs: ['Voici le rappel de votre mission de demain.'],
      facts: missionFacts(mission),
      button: { label: 'Voir ma mission', url: link },
    }),
  };
}

// ── Relances automatiques ─────────────────────────────────────────────────────
// Envoyées au client au nom du traiteur (nom d'expéditeur = entreprise, réponses vers le traiteur).

export interface QuoteReminderDetails {
  companyName: string;
  clientName: string | null;
  quoteNumber: string | null;
  eventType: string | null;
  eventDate: string | null;
  guestCount: number | null;
  /** Date limite d'acceptation du devis. */
  validUntil: string | null;
}

/** Au client : un devis envoyé reste sans réponse. */
export function quoteReminderEmail({ quote, link }: { quote: QuoteReminderDetails; link: string }): Email {
  const what = quote.eventType ? `votre ${quote.eventType.toLowerCase()}` : 'votre événement';
  return {
    subject: `Votre devis ${quote.companyName}${quote.quoteNumber ? ` n° ${quote.quoteNumber}` : ''} vous attend`,
    html: renderEmail({
      brand: quote.companyName,
      preheader: `${quote.companyName} revient vers vous au sujet de son devis.`,
      title: quote.clientName ? `Bonjour ${quote.clientName}` : 'Bonjour',
      paragraphs: [
        `Nous vous avons adressé notre proposition pour ${esc(what)}. Avez-vous pu la consulter ?`,
        'Si elle vous convient, vous pouvez l’accepter en ligne depuis le lien ci-dessous. Une question, un changement à prévoir ? Répondez simplement à cet email.',
      ],
      facts: [
        ['Devis n°', quote.quoteNumber ?? ''],
        ['Événement', quote.eventType ?? ''],
        ['Date', dateFr(quote.eventDate)],
        ['Couverts', quote.guestCount ? String(quote.guestCount) : ''],
        ['Valable jusqu’au', quote.validUntil ? longDate(quote.validUntil) : ''],
      ],
      button: { label: 'Consulter le devis', url: link },
      note: 'Vous avez déjà répondu ou ne souhaitez pas donner suite ? Ne tenez pas compte de ce message.',
      footer: `Envoyé par ${quote.companyName} avec WeboDevis.`,
    }),
  };
}

export interface InvoiceReminderDetails {
  companyName: string;
  buyerName: string | null;
  number: string;
  /** Montant restant dû, en euros. */
  remaining: number;
  dueDate: string;
  iban: string | null;
  bic: string | null;
  /** Nombre de relances déjà envoyées pour cette facture (0 pour la première). */
  previous: number;
}

/** Au client : une facture est échue et reste à régler (en tout ou partie). */
export function invoiceReminderEmail({ invoice }: { invoice: InvoiceReminderDetails }): Email {
  const amount = euroFr(invoice.remaining);
  return {
    subject: `${invoice.previous ? 'Nouveau rappel' : 'Rappel'} : facture ${invoice.number} de ${invoice.companyName}`,
    html: renderEmail({
      brand: invoice.companyName,
      preheader: `Facture ${invoice.number} : ${amount} restent à régler.`,
      title: invoice.buyerName ? `Bonjour ${invoice.buyerName}` : 'Bonjour',
      paragraphs: [
        `Sauf erreur de notre part, la facture <strong>${esc(invoice.number)}</strong>, arrivée à échéance le ${esc(longDate(invoice.dueDate))}, n’est pas encore entièrement réglée. Il reste <strong>${esc(amount)}</strong> à payer.`,
        invoice.iban
          ? 'Vous pouvez régler par virement avec les coordonnées ci-dessous, en indiquant le numéro de la facture.'
          : 'Merci de nous indiquer quand le règlement sera fait.',
        'Si le paiement vient d’être fait, ne tenez pas compte de ce message. Une question ? Répondez simplement à cet email.',
      ],
      facts: [
        ['Facture n°', invoice.number],
        ['Échéance', longDate(invoice.dueDate)],
        ['Reste à payer', amount],
        ['Bénéficiaire', invoice.iban ? invoice.companyName : ''],
        ['IBAN', invoice.iban ?? ''],
        ['BIC', invoice.bic ?? ''],
      ],
      footer: `Envoyé par ${invoice.companyName} avec WeboDevis.`,
    }),
  };
}

// ── Support, depuis le centre d'aide de l'application ─────────────────────────
export interface SupportRequestDetails {
  /** « Question », « Problème » ou « Suggestion ». */
  topic: string;
  name: string;
  email: string;
  company?: string | null;
  /** Le message tel qu'écrit, sans les informations techniques. */
  message: string;
  page?: string | null;
  browser?: string | null;
  accountId: string;
}

/** À l'équipe WeboDevis : un client écrit au support depuis l'application. */
export function supportNotificationEmail({ request, appUrl }: { request: SupportRequestDetails; appUrl: string }): Email {
  return {
    subject: `Support (${request.topic}) : ${request.company || request.name}`,
    html: renderEmail({
      preheader: `${request.name}${request.company ? `, ${request.company}` : ''} écrit au support depuis l’application.`,
      title: `${request.topic} d’un client`,
      paragraphs: [`« ${multiline(request.message)} »`],
      facts: [
        ['Nom', request.name],
        ['Entreprise', request.company ?? ''],
        ['Email', request.email],
        ['Page', request.page ?? ''],
        ['Navigateur', request.browser ?? ''],
        ['Compte', request.accountId],
      ],
      button: { label: 'Ouvrir dans l’administration', url: `${appUrl}/admin/demandes` },
      note: 'Répondre à cet email écrit directement au client.',
    }),
  };
}

/** Au client : son message au support est bien arrivé. */
export function supportAckEmail({ request }: { request: SupportRequestDetails }): Email {
  return {
    subject: 'Nous avons bien reçu votre message',
    html: renderEmail({
      preheader: 'Votre message au support WeboDevis est bien arrivé.',
      title: `Merci ${request.name.split(/\s+/)[0]}`,
      paragraphs: [
        'Votre message au support est bien arrivé. Nous vous répondons par email, le plus vite possible.',
        'Pour mémoire, voici ce que vous nous avez écrit :',
        `« ${multiline(request.message)} »`,
      ],
      note: 'Pour ajouter une précision ou une capture d’écran, répondez simplement à cet email.',
    }),
  };
}

// ── Bon de commande envoyé au fournisseur ─────────────────────────────────────
// Envoyé au nom du traiteur (nom d'expéditeur = entreprise, réponses vers le traiteur).

export interface SupplierOrderDetails {
  companyName: string;
  /** Référence courte de la commande, reprise sur le bon imprimé. */
  reference: string;
  message: string;
  /** Date de livraison souhaitée (AAAA-MM-JJ), facultative. */
  deliveryDate: string | null;
  items: { name: string; quantity: number; unit: string | null }[];
  /** Coordonnées du traiteur, pour que le fournisseur puisse le joindre. */
  contact: { name: string | null; phone: string | null; email: string | null; address: string | null };
}

// Repère remplacé par le tableau des articles : le gabarit commun n'accepte que des paragraphes.
const ORDER_TABLE = '<!--articles-de-la-commande-->';

function orderItemsTable(items: SupplierOrderDetails['items']): string {
  const cell = 'padding:10px 12px;font-size:14px;border-top:1px solid #E6DFD3;';
  const head = 'padding:10px 12px;font-size:12px;font-weight:600;color:#57534C;text-align:left;';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;background:#F7F3EC;border-radius:14px;border-collapse:separate;">
        <tr><td style="${head}">Ingrédient</td><td style="${head}text-align:right;">Quantité</td><td style="${head}">Unité</td></tr>
        ${items.map((i) => `<tr>
          <td style="${cell}font-weight:600;color:#1B1A17;">${esc(i.name)}</td>
          <td style="${cell}text-align:right;font-weight:600;color:#1B1A17;white-space:nowrap;">${esc(i.quantity.toLocaleString('fr-FR'))}</td>
          <td style="${cell}color:#57534C;">${esc(i.unit ?? '')}</td>
        </tr>`).join('')}
      </table>`;
}

/** Au fournisseur : la commande du traiteur, article par article. */
export function supplierOrderEmail({ order }: { order: SupplierOrderDetails }): Email {
  const delivery = order.deliveryDate ? dateFr(order.deliveryDate) : '';
  const html = renderEmail({
    brand: order.companyName,
    preheader: `${order.companyName} vous adresse une commande de ${order.items.length} article${order.items.length > 1 ? 's' : ''}.`,
    title: `Commande n° ${order.reference}`,
    paragraphs: [
      ...(order.message.trim() ? [multiline(order.message.trim())] : []),
      ORDER_TABLE,
      ...(delivery ? [`Livraison souhaitée le <strong>${esc(delivery)}</strong>.`] : []),
    ],
    facts: [
      ['Commandé par', order.companyName],
      ['Contact', order.contact.name ?? ''],
      ['Téléphone', order.contact.phone ?? ''],
      ['Email', order.contact.email ?? ''],
      ['Adresse', order.contact.address ?? ''],
    ],
    note: 'Pour confirmer la commande ou signaler un article manquant, répondez simplement à cet email.',
    footer: `Envoyé par ${order.companyName} avec WeboDevis.`,
  });
  return {
    subject: `Commande ${order.companyName} n° ${order.reference}${delivery ? `, livraison le ${delivery}` : ''}`,
    html: html.replace(new RegExp(`<p[^>]*>${ORDER_TABLE}</p>`), orderItemsTable(order.items)),
  };
}

// ── Équipe ────────────────────────────────────────────────────────────────────
/** Invitation d'un collaborateur à rejoindre une entreprise. */
export function teamInviteEmail({ companyName, inviterName, roleLabel, link, days }: { companyName: string; inviterName: string; roleLabel: string; link: string; days: number }): Email {
  return {
    subject: `${inviterName} vous invite sur WeboDevis`,
    html: renderEmail({
      preheader: `Rejoignez ${companyName} sur WeboDevis.`,
      title: `Rejoindre ${esc(companyName)}`,
      paragraphs: [
        `${esc(inviterName)} vous invite à rejoindre ${esc(companyName)} sur WeboDevis, comme ${esc(roleLabel)}. Vous travaillerez sur les mêmes devis, événements et catalogue.`,
        `Choisissez votre mot de passe depuis le lien ci-dessous. Il est valable ${days} jours.`,
      ],
      button: { label: 'Créer mon accès', url: link },
      note: 'Vous ne vous attendiez pas à cette invitation ? Ignorez simplement cet email.',
    }),
  };
}

// ── Conseils (premiers pas, inactivité) ───────────────────────────────────────
export type LifecycleKind = 'catalogue' | 'premier_devis' | 'envoi_en_ligne' | 'inactif';

const LIFECYCLE: Record<LifecycleKind, { subject: string; title: string; paragraphs: string[]; button: string; path: string }> = {
  catalogue: {
    subject: 'Commencez par votre carte',
    title: 'Votre carte, en quelques minutes',
    paragraphs: [
      'Tout part de vos prestations : vos menus, cocktails et buffets, avec leur prix. Une fois saisies, un devis se compose en quelques clics.',
      'Vous avez déjà une carte dans un tableur ? Importez-la d’un coup depuis la page Prestations.',
    ],
    button: 'Ajouter mes prestations', path: '/prestations',
  },
  premier_devis: {
    subject: 'Votre premier devis avec WeboDevis',
    title: 'Faites votre premier devis',
    paragraphs: [
      'Choisissez le client, la date et le nombre de couverts, puis vos prestations : le total, la TVA et le document se font tout seuls.',
      'Vous pouvez aussi partir d’un modèle et l’adapter.',
    ],
    button: 'Créer un devis', path: '/devis/nouveau',
  },
  envoi_en_ligne: {
    subject: 'Envoyez vos devis, faites-les signer en ligne',
    title: 'Un devis accepté sans imprimer',
    paragraphs: [
      'Envoyez votre devis par email depuis WeboDevis : votre client l’ouvre sur son téléphone, l’accepte et le signe du doigt. Vous êtes prévenu tout de suite.',
      'Ensuite, la facture d’acompte se prépare en un clic depuis le devis.',
    ],
    button: 'Voir mes devis', path: '/devis',
  },
  inactif: {
    subject: 'Ce qui a changé sur WeboDevis',
    title: 'Des nouveautés vous attendent',
    paragraphs: [
      'Factures et acomptes, signature des devis en ligne, fiche allergènes, fiche de production : WeboDevis s’est beaucoup enrichi ces dernières semaines.',
      'Vos devis et votre carte sont toujours là, prêts à servir.',
    ],
    button: 'Ouvrir WeboDevis', path: '/',
  },
};

export function lifecycleEmail({ kind, firstName, appUrl, unsubscribe }: { kind: LifecycleKind; firstName: string | null; appUrl: string; unsubscribe: string }): Email {
  const c = LIFECYCLE[kind];
  return {
    subject: c.subject,
    html: renderEmail({
      preheader: c.paragraphs[0],
      title: firstName ? `${esc(firstName)}, ${c.title.charAt(0).toLowerCase()}${c.title.slice(1)}` : c.title,
      paragraphs: c.paragraphs,
      button: { label: c.button, url: `${appUrl}${c.path}` },
      note: `Vous ne souhaitez plus recevoir ces conseils ? <a href="${esc(unsubscribe)}" style="color:inherit;">Se désinscrire</a>.`,
    }),
  };
}

// ── Journal d'erreurs ─────────────────────────────────────────────────────────
/** À l'équipe : une erreur nouvelle (ou revenue après résolution) dans l'application. */
export function errorAlertEmail({ message, source, path, reappeared, appUrl }: { message: string; source: 'navigateur' | 'serveur'; path: string | null; reappeared: boolean; appUrl: string }): Email {
  const short = message.length > 90 ? `${message.slice(0, 90)}…` : message;
  return {
    subject: `${reappeared ? 'Erreur revenue' : 'Nouvelle erreur'} : ${short}`,
    html: renderEmail({
      preheader: short,
      title: reappeared ? 'Une erreur résolue est revenue' : 'Nouvelle erreur dans l’application',
      paragraphs: [`<code style="font-size:13px;word-break:break-word;">${esc(message.slice(0, 500))}</code>`],
      facts: [['Côté', source === 'navigateur' ? 'Navigateur' : 'Serveur'], ['Page', path ?? '']],
      button: { label: 'Voir le journal', url: `${appUrl}/admin/erreurs` },
      note: 'Vous ne recevrez pas d’autre email pour cette erreur avant une heure, même si elle se répète.',
    }),
  };
}

// ── Dégustations ──────────────────────────────────────────────────────────────
// Envoyés au client au nom du traiteur (nom d'expéditeur = entreprise, réponses vers le traiteur).

export interface TastingDetails {
  companyName: string;
  clientName: string;
  /** AAAA-MM-JJ. */
  date: string;
  /** HH:MM. */
  start: string;
  /** HH:MM. */
  end: string;
  location: string | null;
  guestCount: number | null;
  /** Téléphone du traiteur, pour prévenir d'un empêchement. */
  phone: string | null;
}

export type TastingMailKind = 'confirmation' | 'rappel_veille' | 'rappel_avance' | 'changement' | 'annulation';

const hourFr = (t: string) => t.replace(':', ' h ');

const tastingFacts = (t: TastingDetails): [string, string][] => [
  ['Date', dateFr(t.date)],
  ['Horaire', `${hourFr(t.start)} – ${hourFr(t.end)}`],
  ['Lieu', t.location ?? ''],
  ['Personnes', t.guestCount ? String(t.guestCount) : ''],
];

/** Au client : rendez-vous de dégustation confirmé, rappelé, déplacé ou annulé. */
export function tastingEmail({ kind, tasting }: { kind: TastingMailKind; tasting: TastingDetails }): Email {
  const when = `${dateFr(tasting.date)} à ${hourFr(tasting.start)}`;
  const contact = tasting.phone
    ? `Un empêchement ? Répondez à cet email ou appelez-nous au ${esc(tasting.phone)}.`
    : 'Un empêchement ? Répondez simplement à cet email.';
  const agenda = 'Le rendez-vous est joint à cet email : ouvrez la pièce jointe pour l’ajouter à votre agenda.';
  const copy: Record<TastingMailKind, { subject: string; preheader: string; title: string; paragraphs: string[] }> = {
    confirmation: {
      subject: `Votre dégustation avec ${tasting.companyName} : ${when}`,
      preheader: `Rendez-vous le ${when}.`,
      title: `Bonjour ${tasting.clientName}`,
      paragraphs: [`Nous avons le plaisir de vous confirmer votre rendez-vous de dégustation le <strong>${esc(when)}</strong>.`, agenda, contact],
    },
    rappel_veille: {
      subject: `Rappel : votre dégustation demain à ${hourFr(tasting.start)}`,
      preheader: `Nous vous attendons demain à ${hourFr(tasting.start)}.`,
      title: `À demain, ${tasting.clientName}`,
      paragraphs: [`Petit rappel : votre dégustation avec ${esc(tasting.companyName)} a lieu demain, le <strong>${esc(when)}</strong>.`, contact],
    },
    rappel_avance: {
      subject: `Votre dégustation approche : ${when}`,
      preheader: `Rendez-vous le ${when}.`,
      title: `Bonjour ${tasting.clientName}`,
      paragraphs: [`Votre dégustation avec ${esc(tasting.companyName)} approche : rendez-vous le <strong>${esc(when)}</strong>.`, contact],
    },
    changement: {
      subject: `Votre dégustation est déplacée : ${when}`,
      preheader: `Nouvel horaire : ${when}.`,
      title: `Bonjour ${tasting.clientName}`,
      paragraphs: [`Le rendez-vous de votre dégustation a changé. Voici les nouvelles informations : <strong>${esc(when)}</strong>.`, agenda, contact],
    },
    annulation: {
      subject: `Dégustation du ${dateFr(tasting.date)} annulée`,
      preheader: `Le rendez-vous du ${when} est annulé.`,
      title: `Bonjour ${tasting.clientName}`,
      paragraphs: [`Votre rendez-vous de dégustation du <strong>${esc(when)}</strong> est annulé.`, 'Pour convenir d’une autre date, répondez simplement à cet email.'],
    },
  };
  const c = copy[kind];
  return {
    subject: c.subject,
    html: renderEmail({
      brand: tasting.companyName,
      preheader: c.preheader,
      title: c.title,
      paragraphs: c.paragraphs,
      facts: kind === 'annulation' ? undefined : tastingFacts(tasting),
      footer: `Envoyé par ${tasting.companyName} avec WeboDevis.`,
    }),
  };
}
