import type { FeaturePreview } from './features';

// Les pages « Pour qui » : le même produit, raconté depuis un métier précis.
// Rien n'y est annoncé qui ne figure déjà dans les pages fonctionnalités.

export interface AudienceSection {
  title: string;
  body: string;
  /** Page fonctionnalité vers laquelle la section renvoie (slug) et texte du lien. */
  feature: string;
  linkLabel: string;
}

export interface Audience {
  slug: string;
  /** Icône du menu (clé, voir components/site/SiteNav.tsx). */
  icon: string;
  /** Description du menu, sur deux lignes. */
  menuText: string;
  href: string;
  label: string;
  blurb: string;
  metaTitle: string;
  description: string;
  keyword: string;
  h1: string;
  lead: string;
  preview: FeaturePreview;
  sections: AudienceSection[];
  /** Guides conseillés (slugs). */
  guides: string[];
  /** Date ISO de la dernière mise à jour du texte (reprise dans le sitemap). */
  updated?: string;
}

const audience = (a: Omit<Audience, 'href'>): Audience => ({ ...a, href: `/pour/${a.slug}` });

export const AUDIENCES: Audience[] = [
  audience({
    slug: 'traiteur-mariage',
    menuText: 'Des demandes reçues des mois à l’avance, plusieurs versions du devis, puis une journée où rien ne doit manquer.',
    icon: 'heart',
    label: 'Traiteur de mariage',
    blurb: 'De la demande, un an avant, au jour J.',
    metaTitle: 'Logiciel pour traiteur de mariage : du devis au jour J | WeboDevis',
    description: 'Le logiciel du traiteur de mariage : demandes reçues par formulaire, devis avec options et prix enfant, liste de courses calculée par convive, matériel, location et extras.',
    keyword: 'logiciel traiteur mariage',
    h1: 'Le logiciel du traiteur de mariage',
    lead: 'Un mariage, c’est une demande reçue des mois à l’avance, plusieurs versions du devis, une dégustation, puis une journée où rien ne doit manquer. WeboDevis suit l’affaire d’un bout à l’autre.',
    preview: 'devis',
    sections: [
      {
        title: 'Des demandes reçues longtemps à l’avance',
        body: 'Les futurs mariés décrivent leur réception dans votre formulaire : date, lieu, nombre de personnes. La demande arrive dans WeboDevis et suit ensuite son chemin, avec des statuts qui prévoient le rendez-vous et la dégustation, à venir puis faits.',
        feature: 'demandes-de-devis',
        linkLabel: 'Voir les demandes de devis',
      },
      {
        title: 'Un devis à la hauteur de la réception',
        body: 'Le style « Mariage », une page de garde, des pages de photos : le document donne envie avant même d’être lu. Les options, comme un bar ou une animation, restent hors du total. Les enfants sont comptés à part, avec leur prix.',
        feature: 'devis-traiteur',
        linkLabel: 'Voir les devis',
      },
      {
        title: 'Cent vingt couverts, et la liste de courses qui suit',
        body: 'Le nombre de convives d’un mariage bouge jusqu’aux dernières semaines. Quand il change, vous modifiez le nombre de couverts et vous recalculez : les quantités par personne de vos prestations font le reste.',
        feature: 'liste-de-courses',
        linkLabel: 'Voir la liste de courses',
      },
      {
        title: 'Le jour J : matériel, location, équipe',
        body: 'La fiche de l’événement réunit la checklist, le matériel à emporter et la location, calculée par convive et regroupée par fournisseur. Chaque extra retrouve son heure d’arrivée, le lieu et vos consignes sur son lien de mission.',
        feature: 'evenements',
        linkLabel: 'Voir les événements',
      },
      {
        title: 'Une saison lisible',
        body: 'Sur le calendrier, les samedis confirmés s’affichent en plein et ceux qui sont encore en discussion en contour. Vous savez tout de suite quelles dates restent à vendre.',
        feature: 'calendrier',
        linkLabel: 'Voir le calendrier',
      },
    ],
    guides: ['contenu-devis-traiteur', 'checklist-evenement-traiteur', 'calculer-quantites-par-convive'],
  }),

  audience({
    slug: 'traiteur-entreprise',
    menuText: 'Plusieurs interlocuteurs par client, des événements qui se répètent, des réponses attendues dans la journée.',
    icon: 'briefcase',
    label: 'Traiteur d’entreprise et séminaires',
    blurb: 'Plusieurs interlocuteurs, des délais courts.',
    metaTitle: 'Logiciel pour traiteur d’entreprise et séminaires | WeboDevis',
    description: 'Le logiciel du traiteur d’entreprise : fiches à plusieurs contacts, devis dupliqués et modèles, calendrier de charge, courses cumulées sur la semaine.',
    keyword: 'logiciel traiteur entreprise séminaire',
    h1: 'Le logiciel du traiteur d’entreprise et de séminaires',
    lead: 'Des interlocuteurs multiples, des clients qui reviennent, des réponses attendues dans la journée. WeboDevis garde la mémoire de chaque entreprise et vous évite de repartir de zéro.',
    preview: 'clients',
    sections: [
      {
        title: 'Une entreprise, plusieurs interlocuteurs',
        body: 'L’assistante qui réserve, le responsable qui valide, le service qui règle : la fiche d’une entreprise réunit tous ses contacts, avec leur rôle. À chaque devis, vous choisissez à qui il s’adresse.',
        feature: 'clients',
        linkLabel: 'Voir le fichier clients',
      },
      {
        title: 'Répondre vite, sans repartir de zéro',
        body: 'Un plateau-repas ou un cocktail de séminaire ressemble souvent au précédent. Vous dupliquez un devis, ou vous partez d’un modèle, et vous ajustez la date et le nombre de couverts. Le style « Business » donne un document sobre, en français ou en anglais.',
        feature: 'devis-traiteur',
        linkLabel: 'Voir les devis',
      },
      {
        title: 'Plusieurs événements la même semaine',
        body: 'Le calendrier fait ressortir les journées trop chargées. Pour les achats et la location, vous choisissez une période : les besoins de tous les événements confirmés se cumulent par fournisseur.',
        feature: 'calendrier',
        linkLabel: 'Voir le calendrier',
      },
      {
        title: 'Savoir ce que laisse chaque prestation',
        body: 'Des prix serrés demandent de connaître ses coûts. La fiche « Marge et coûts » d’un devis met en regard le chiffre d’affaires hors taxes, le coût de chaque prestation et la marge brute.',
        feature: 'suivi-financier',
        linkLabel: 'Voir le suivi financier',
      },
    ],
    guides: ['calculer-marge-traiteur', 'liste-de-courses-evenement', 'contenu-devis-traiteur'],
  }),

  audience({
    slug: 'traiteur-independant',
    menuText: 'Commercial, chef et acheteur à la fois : l’information passe d’une étape à la suivante, sans ressaisie.',
    icon: 'chef-hat',
    label: 'Traiteur indépendant',
    blurb: 'Seul aux commandes, sans ressaisie.',
    metaTitle: 'Logiciel pour traiteur indépendant : devis et courses | WeboDevis',
    description: 'Le logiciel du traiteur indépendant : une information saisie une fois, de la demande au devis puis à la liste de courses, sur téléphone comme sur ordinateur.',
    keyword: 'logiciel traiteur indépendant',
    h1: 'Le logiciel du traiteur indépendant',
    lead: 'Quand vous êtes à la fois le commercial, le chef et l’acheteur, chaque ressaisie est du temps pris sur la cuisine. WeboDevis fait passer l’information d’une étape à la suivante.',
    preview: 'mobile',
    sections: [
      {
        title: 'Une information saisie une fois',
        body: 'La demande reçue par votre formulaire devient un devis déjà rempli. Le devis validé devient un événement. Les prestations du devis donnent la liste de courses. Vous ne recopiez ni un nom, ni une date, ni un nombre de couverts.',
        feature: 'demandes-de-devis',
        linkLabel: 'Voir les demandes de devis',
      },
      {
        title: 'Le bureau dans la poche',
        body: 'L’application s’ajoute à l’écran d’accueil de votre téléphone. Vous créez un devis entre deux rendez-vous, et vous cochez la liste de courses au marché.',
        feature: 'application-mobile',
        linkLabel: 'Voir l’application mobile',
      },
      {
        title: 'Des renforts pour les gros événements',
        body: 'Vous gardez le fichier de vos extras, vous les affectez à un événement avec une heure d’arrivée et des consignes, et chacun retrouve ses missions sur un lien personnel.',
        feature: 'extras',
        linkLabel: 'Voir les extras',
      },
      {
        title: 'Garder un œil sur la marge',
        body: 'Un agenda plein ne suffit pas. Pour chaque devis, vous voyez ce qu’il rapporte une fois retirés le coût des prestations et les frais de l’événement.',
        feature: 'suivi-financier',
        linkLabel: 'Voir le suivi financier',
      },
    ],
    guides: ['calculer-marge-traiteur', 'calculer-quantites-par-convive', 'checklist-evenement-traiteur'],
  }),

  audience({
    slug: 'chef-a-domicile',
    menuText: 'Seul en cuisine chez vos clients, souvent en micro-entreprise : des devis signés, des factures en règle, les allergènes notés.',
    icon: 'cooking-pot',
    label: 'Chef à domicile',
    blurb: 'Devis signés et factures en règle, sans bureau.',
    metaTitle: 'Logiciel pour chef à domicile : devis, factures, allergènes | WeboDevis',
    description: 'Le logiciel du chef à domicile : devis signés en ligne, factures d’acompte et de solde avec la mention de franchise de TVA, allergènes du menu et liste de courses, depuis le téléphone.',
    keyword: 'logiciel chef à domicile',
    h1: 'Le logiciel du chef à domicile',
    lead: 'Vous cuisinez chez vos clients, vous faites les courses, et vous gérez seul tout le reste. WeboDevis réunit les devis, les factures et le menu au même endroit, sur le téléphone comme sur l’ordinateur.',
    preview: 'signature',
    sections: [
      {
        title: 'Un devis signé avant de faire les courses',
        body: 'Votre client reçoit le devis par un lien, l’accepte et le signe au doigt sur son téléphone. Le devis passe au statut « Validé », vous êtes prévenu, et la date s’inscrit sur votre calendrier. Vous savez aussi s’il a ouvert le devis, et combien de fois.',
        feature: 'signature-devis-en-ligne',
        linkLabel: 'Voir la signature en ligne',
      },
      {
        title: 'Des factures en règle, même sans TVA',
        body: 'Beaucoup de chefs à domicile exercent en micro-entreprise, en franchise de TVA. Vous la cochez une fois dans vos paramètres : vos factures sont établies sans TVA et portent la mention « TVA non applicable, art. 293 B du CGI ». L’acompte, puis le solde, partent du devis, avec des numéros qui se suivent.',
        feature: 'facturation',
        linkLabel: 'Voir les factures',
      },
      {
        title: 'Le menu et ses allergènes',
        body: 'Chez un particulier, la question des allergies vient vite. Les allergènes de vos recettes se retrouvent sur une fiche par événement, plat par plat, que vous remettez avec le menu.',
        feature: 'allergenes',
        linkLabel: 'Voir les allergènes',
      },
      {
        title: 'Les courses, sans recompter',
        body: 'La liste de courses se calcule depuis le devis : la quantité par personne de chaque ingrédient, multipliée par le nombre de couverts. Vous la cochez sur le téléphone, au marché ou chez le primeur.',
        feature: 'liste-de-courses',
        linkLabel: 'Voir la liste de courses',
      },
    ],
    guides: ['facture-electronique-traiteur', 'allergenes-traiteur', 'calculer-quantites-par-convive'],
    updated: '2026-10-20',
  }),

  audience({
    slug: 'traiteur-cocktail-buffet',
    menuText: 'Des centaines de pièces, des invités qui se servent seuls : des quantités justes et des allergènes affichés.',
    icon: 'martini',
    label: 'Traiteur cocktail et buffet',
    blurb: 'Des pièces par convive, des allergènes affichés.',
    metaTitle: 'Logiciel pour traiteur cocktail et buffet | WeboDevis',
    description: 'Le logiciel du traiteur de cocktails et de buffets : devis à la pièce ou au couvert, quantités calculées sur le nombre de convives, fiche allergènes à afficher près du buffet, location du matériel.',
    keyword: 'logiciel traiteur cocktail buffet',
    h1: 'Le logiciel du traiteur de cocktails et de buffets',
    lead: 'Un cocktail, ce sont des centaines de pièces, une dizaine de recettes et des invités qui se servent seuls. WeboDevis calcule les quantités sur le nombre de convives et met les allergènes du buffet sur une fiche.',
    preview: 'allergenes',
    sections: [
      {
        title: 'Un devis à la pièce ou au couvert',
        body: 'Chaque ligne du devis a sa quantité et son prix unitaire : des pièces cocktail à l’unité, un buffet au couvert, un plateau à la pièce. Les options, comme un bar ou une animation, restent hors du total. Un cocktail réussi se duplique ou s’enregistre comme modèle pour le client suivant.',
        feature: 'devis-traiteur',
        linkLabel: 'Voir les devis',
      },
      {
        title: 'Les quantités, à partir du nombre de convives',
        body: 'Dans votre catalogue, chaque pièce porte ses ingrédients et leur quantité par personne : pour une pièce servie deux fois par invité, la quantité par personne compte les deux. La liste de courses multiplie ces quantités par le nombre de couverts et les regroupe par fournisseur. Si le nombre d’invités change, vous recalculez.',
        feature: 'liste-de-courses',
        linkLabel: 'Voir la liste de courses',
      },
      {
        title: 'Les allergènes, affichés près du buffet',
        body: 'Au buffet, personne ne décrit chaque plat à chaque invité. La fiche allergènes de l’événement met les pièces du menu en lignes et les 14 allergènes en colonnes : vous l’affichez près du buffet, ou vous la remettez au client.',
        feature: 'allergenes',
        linkLabel: 'Voir les allergènes',
      },
      {
        title: 'Verres, plateaux, nappage',
        body: 'La location se calcule par convive à partir de vos modèles, puis se regroupe par fournisseur. Le matériel à emporter et la checklist se préparent sur la même fiche d’événement.',
        feature: 'evenements',
        linkLabel: 'Voir les événements',
      },
    ],
    guides: ['calculer-quantites-par-convive', 'allergenes-traiteur', 'liste-de-courses-evenement'],
    updated: '2026-10-20',
  }),
];

export const audienceBySlug = (slug: string) => AUDIENCES.find((a) => a.slug === slug);
