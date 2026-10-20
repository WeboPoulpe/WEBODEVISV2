import type { Faq } from './schema';

// Les pages fonctionnalités : une page par intention de recherche.
// Chaque phrase décrit ce que l'interface permet réellement dans la version 0.1 (vérifié dans le code
// de l'app). Quand une chose n'existe pas, la question fréquente le dit.

export type FeatureGroupId = 'avant' | 'pendant' | 'quotidien';
export type FeaturePreview = 'demandes' | 'devis' | 'clients' | 'evenement' | 'courses' | 'extras' | 'stock' | 'calendrier' | 'finance' | 'mobile'
  | 'signature' | 'factures' | 'facturx' | 'allergenes';

export interface FeatureSection {
  title: string;
  body: string[];
  points?: string[];
}

export interface Feature {
  slug: string;
  /** Icône du menu (clé, voir components/site/SiteNav.tsx). */
  icon: string;
  href: string;
  /** Nom dans le menu et les listes. */
  label: string;
  /** Ligne de description dans le menu et les listes. */
  blurb: string;
  group: FeatureGroupId;
  metaTitle: string;
  description: string;
  /** Recherche visée. */
  keyword: string;
  h1: string;
  lead: string;
  /** Aperçu du produit montré en ouverture. */
  preview: FeaturePreview;
  /** Trois phrases courtes, affichées en grand. */
  highlights: string[];
  sections: FeatureSection[];
  faqs: Faq[];
  /** Pages voisines (slugs). */
  related: string[];
  /** Guide lié (slug). */
  guide?: string;
  /** Date ISO de la dernière mise à jour du texte (reprise dans le sitemap). */
  updated?: string;
}

const feature = (f: Omit<Feature, 'href'>): Feature => ({ ...f, href: `/fonctionnalites/${f.slug}` });

export const FEATURES: Feature[] = [
  feature({
    slug: 'demandes-de-devis',
    icon: 'inbox',
    label: 'Demandes de devis',
    blurb: 'Un formulaire à votre nom, les demandes dans l’app.',
    group: 'avant',
    metaTitle: 'Formulaire de demande de devis pour traiteur | WeboDevis',
    description: 'Un formulaire de demande de devis à partager ou à intégrer à votre site de traiteur. La demande arrive dans WeboDevis et vous êtes prévenu par email.',
    keyword: 'formulaire demande de devis traiteur',
    h1: 'Le formulaire de demande de devis de votre site de traiteur',
    lead: 'Vos futurs clients décrivent leur événement dans un formulaire à votre nom. La demande arrive dans WeboDevis, vous êtes prévenu par email, et il ne reste qu’à en faire un devis.',
    preview: 'demandes',
    highlights: [
      'Un lien de formulaire à votre nom, à partager ou à intégrer à votre site.',
      'Un email pour vous, un accusé de réception pour votre client.',
      'Une demande devient un devis déjà rempli.',
    ],
    sections: [
      {
        title: 'Un formulaire prêt à partager',
        body: [
          'Depuis l’écran des demandes, vous créez votre lien de formulaire. Vous le placez derrière le bouton « Demander un devis » de votre site, dans la signature de vos emails ou sur vos réseaux sociaux. Une version à intégrer directement dans une page de votre site existe aussi.',
          'Si vous indiquez l’adresse de votre brochure, elle est proposée au téléchargement une fois la demande envoyée. Vous pouvez régénérer le lien à tout moment : l’ancien cesse alors de fonctionner.',
        ],
        points: [
          'Coordonnées : prénom, nom, email, téléphone, adresse',
          'Événement : type, date prévue, nombre de personnes, lieu',
          'Un message libre pour les précisions',
        ],
      },
      {
        title: 'Toutes les demandes au même endroit',
        body: [
          'Chaque demande arrive avec le statut « Nouveau ». Elle apparaît sur le tableau de bord, dans le bloc des nouvelles demandes, et un compteur s’affiche dans le menu.',
          'Vous filtrez les demandes par type d’événement, par année et par statut. Celles dont l’événement approche ressortent dans la liste.',
        ],
      },
      {
        title: 'Deux emails qui partent tout seuls',
        body: [
          'Vous recevez un email avec le message, les coordonnées et l’événement décrit. Y répondre écrit directement à la personne.',
          'De son côté, elle reçoit un accusé de réception à votre nom, avec le rappel de sa demande. Sa réponse vous parvient.',
        ],
      },
      {
        title: 'De la demande au devis',
        body: [
          '« Créer un devis » reprend le client, le type d’événement, la date et le nombre de convives. La fiche client est créée ou mise à jour au passage.',
          'La demande et le devis restent liés : changer le statut de l’un change celui de l’autre. Vous pouvez aussi enregistrer le demandeur comme client sans créer de devis.',
        ],
      },
    ],
    faqs: [
      { q: 'Faut-il savoir coder pour mettre le formulaire sur mon site ?', a: 'Non pour le partager : vous copiez un lien et vous le placez derrière un bouton de votre site. L’intégrer directement dans une page demande d’y insérer un cadre (iframe), ce que fait en quelques minutes la personne qui gère votre site.' },
      { q: 'La personne qui fait la demande doit-elle créer un compte ?', a: 'Non. Elle remplit le formulaire et l’envoie, sans compte ni mot de passe.' },
      { q: 'Comment suis-je prévenu d’une nouvelle demande ?', a: 'Vous recevez un email à chaque demande. Elle apparaît aussi sur le tableau de bord, et un compteur s’affiche à côté des prospects dans le menu.' },
      { q: 'Que devient la demande une fois le devis créé ?', a: 'Elle reste liée au devis. Leurs statuts se synchronisent : quand le devis passe à « Devis envoyé » ou « Validé », la demande suit.' },
    ],
    related: ['devis-traiteur', 'clients', 'calendrier'],
    guide: 'contenu-devis-traiteur',
  }),

  feature({
    slug: 'devis-traiteur',
    icon: 'file-text',
    label: 'Devis',
    blurb: 'Création guidée, éditeur, modèles, envoi par lien.',
    group: 'avant',
    metaTitle: 'Logiciel de devis pour traiteur : création, modèles, envoi | WeboDevis',
    description: 'Créez un devis de traiteur en trois étapes, mettez-le en page dans l’éditeur, envoyez-le par email avec un lien. Options, prix enfant, modèles, dossiers et statuts.',
    keyword: 'logiciel devis traiteur',
    h1: 'Le devis de traiteur, de la création à l’envoi',
    lead: 'Trois étapes pour créer le devis, un éditeur pour le mettre en page, un lien pour l’envoyer. Et un statut qui suit l’affaire, de la première demande au paiement.',
    preview: 'devis',
    highlights: [
      'Trois étapes pour créer un devis : l’événement, le client, le style.',
      'Votre client reçoit un lien, pas une pièce jointe.',
      'Douze statuts, de « Nouveau » à « Payé ».',
    ],
    sections: [
      {
        title: 'Un devis créé en trois étapes',
        body: [
          'Vous indiquez l’événement (type, date, nombre de couverts, lieu), puis le client, existant ou nouveau, puis le style du document. Le devis s’ouvre ensuite dans l’éditeur, prêt à recevoir vos prestations.',
        ],
        points: [
          'Trois styles de document : Standard, Mariage, Business',
          'Un devis en français ou en anglais',
          'Un client choisi dans votre fichier, ou créé sur place',
        ],
      },
      {
        title: 'Un document que vous mettez en page vous-même',
        body: [
          'Le devis se présente comme une page A4 que vous modifiez directement. Vous ajoutez vos prestations depuis votre catalogue ou en ligne libre, vous les réordonnez en les faisant glisser.',
          'Chaque ligne peut être normale, incluse ou en option. Une ligne incluse s’affiche sans peser sur le total. Les options restent hors total et le document indique le montant avec et sans elles.',
        ],
        points: [
          'Adultes et enfants comptés séparément, avec un prix enfant défini sur la prestation',
          'Un taux de TVA par défaut, modifiable ligne par ligne, et la possibilité de masquer les prix',
          'Page de garde, pages de photos, polices et couleurs',
          'Votre logo en tête, vos conditions générales en fin de document',
        ],
      },
      {
        title: 'Modèles, duplication, dossiers',
        body: [
          'Un devis réussi se duplique en un clic, ou s’enregistre comme modèle : vous repartez ensuite de ce modèle, avec ses prestations et sa mise en page, pour un nouveau client.',
          'Les dossiers et sous-dossiers rangent vos devis par saison, par lieu ou par type de client. Vous pouvez aussi reprendre un devis fait ailleurs : il entre dans la liste avec son fichier d’origine joint.',
        ],
      },
      {
        title: 'Envoyer, puis suivre',
        body: [
          'Vous envoyez le devis depuis l’application, avec votre message. Le client reçoit un email et un bouton « Consulter le devis » : il l’ouvre en ligne sans créer de compte, l’imprime ou l’enregistre en PDF. S’il répond à l’email, sa réponse arrive chez vous.',
          'Le statut passe à « Devis envoyé ». Votre client peut aussi accepter le devis et le signer en ligne, depuis ce même lien. Vous suivez ensuite vos devis en liste ou en colonnes, une par statut, et vous gardez vos notes de relance sur chacun.',
        ],
      },
    ],
    faqs: [
      { q: 'Mon client peut-il accepter le devis en ligne ?', a: 'Oui. Depuis le lien reçu, il accepte le devis et le signe au doigt ou à la souris ; le devis passe alors au statut « Validé » et vous êtes prévenu. S’il préfère le papier, le document se termine toujours par un cadre « Bon pour accord » à dater et à signer.' },
      { q: 'Comment présenter les options et ce que j’offre ?', a: 'Chaque ligne du devis a un statut. Une ligne « Option » reste hors du total et le document affiche à part le montant des options. Une ligne « Inclus » apparaît dans le devis avec la mention « Inclus », sans être comptée.' },
      { q: 'Puis-je faire un devis en anglais ?', a: 'Oui. À la création, vous choisissez la langue du devis, français ou anglais : les intitulés du document sont traduits.' },
      { q: 'Puis-je garder mes anciens devis ?', a: 'Oui. L’import crée une fiche avec le client, la date, le nombre de couverts et le montant, et y joint votre fichier (PDF, document ou image). Le fichier est conservé tel quel, il n’est pas converti en devis modifiable.' },
    ],
    related: ['demandes-de-devis', 'signature-devis-en-ligne', 'evenements', 'facturation'],
    guide: 'contenu-devis-traiteur',
    updated: '2026-10-20',
  }),

  feature({
    slug: 'signature-devis-en-ligne',
    icon: 'signature',
    label: 'Signature en ligne',
    blurb: 'Le client accepte et signe le devis depuis son lien.',
    group: 'avant',
    metaTitle: 'Signature de devis en ligne pour traiteur | WeboDevis',
    description: 'Votre client ouvre le devis depuis le lien reçu par email, l’accepte et le signe au doigt ou à la souris. Horodatage, empreinte du devis, passage au statut « Validé » et email de confirmation.',
    keyword: 'signature devis en ligne traiteur',
    h1: 'Faire signer le devis en ligne',
    lead: 'Votre client ouvre le devis depuis le lien reçu, l’accepte et le signe au doigt ou à la souris. Le devis passe au statut « Validé » et vous êtes prévenu.',
    preview: 'signature',
    highlights: [
      'Une signature au doigt sur le téléphone, ou à la souris.',
      'Le devis passe en « Validé » sans que vous y touchiez.',
      'Vous savez si le devis a été ouvert, et combien de fois.',
    ],
    sections: [
      {
        title: 'Accepter depuis le lien reçu',
        body: [
          'Le devis envoyé depuis WeboDevis arrive avec un bouton « Consulter le devis ». Votre client l’ouvre sans créer de compte. Sous le document, un bloc lui propose de l’accepter.',
          'Il indique ses prénom et nom, et sa fonction s’il signe pour une entreprise. Il coche la case qui accepte le devis et les conditions de vente, puis signe dans le cadre prévu : au doigt sur un téléphone, à la souris sur un ordinateur.',
        ],
      },
      {
        title: 'Ce qui est enregistré',
        body: [
          'L’acceptation garde le nom du signataire, sa signature, la date et l’heure données par le serveur, l’adresse IP et le navigateur utilisés. Elle garde aussi une empreinte du devis accepté : ses lignes, sa TVA, sa date et son nombre de couverts au moment de la signature.',
          'C’est une signature électronique simple, qui conserve la trace de l’accord de votre client. Un devis déjà accepté ne peut pas l’être une seconde fois.',
        ],
      },
      {
        title: 'Après la signature',
        body: [
          'Le devis passe au statut « Validé ». S’il est daté, il apparaît dans vos événements et en plein sur le calendrier. Vous recevez un email et une notification dans l’application.',
          'Votre client reçoit de son côté un email de confirmation à votre nom, avec le lien vers le devis signé. S’il y répond, sa réponse vous parvient.',
        ],
      },
      {
        title: 'Validité et consultations',
        body: [
          'À l’envoi, chaque devis reçoit une date de validité, d’après la durée que vous choisissez dans vos paramètres. Passé cette date, il ne peut plus être accepté en ligne : votre client est invité à vous en demander un à jour.',
          'Dans la liste des devis, vous voyez si le devis a été consulté, combien de fois, et quand il l’a été pour la première fois. Vos propres ouvertures ne sont pas comptées.',
        ],
      },
    ],
    faqs: [
      { q: 'Mon client doit-il créer un compte pour signer ?', a: 'Non. Le lien reçu par email suffit : il ouvre le devis, l’accepte et le signe sans compte ni mot de passe.' },
      { q: 'Que se passe-t-il quand le devis a expiré ?', a: 'Le bloc d’acceptation n’est plus proposé. Votre client voit que le devis a expiré et qu’il doit vous en demander un à jour.' },
      { q: 'La signature en ligne remplace-t-elle le « Bon pour accord » imprimé ?', a: 'Les deux restent possibles. Le document garde son cadre « Bon pour accord » pour le client qui préfère imprimer et signer ; vous passez alors vous-même le devis au statut « Validé ».' },
      { q: 'Suis-je prévenu quand mon client signe ?', a: 'Oui, par un email et par une notification dans l’application. Le devis est déjà passé au statut « Validé ».' },
    ],
    related: ['devis-traiteur', 'facturation', 'evenements'],
    guide: 'contenu-devis-traiteur',
    updated: '2026-10-20',
  }),

  feature({
    slug: 'clients',
    icon: 'users',
    label: 'Clients',
    blurb: 'Particuliers et entreprises, avec leur historique.',
    group: 'avant',
    metaTitle: 'Fichier clients du traiteur : particuliers, entreprises | WeboDevis',
    description: 'Le fichier clients du traiteur : particuliers et entreprises, contacts multiples, notes commerciales et historique des devis de chaque client.',
    keyword: 'fichier clients traiteur',
    h1: 'Le fichier clients du traiteur',
    lead: 'Particuliers et entreprises au même endroit, avec leurs contacts, vos notes et l’historique de leurs devis.',
    preview: 'clients',
    highlights: [
      'Particuliers et entreprises, chacun sa fiche.',
      'Plusieurs contacts pour une même entreprise.',
      'L’historique des devis de chaque client.',
    ],
    sections: [
      {
        title: 'Une fiche par client',
        body: [
          'Un particulier a son nom, son email, son téléphone et ses adresses : l’adresse principale et celle de la prestation. Une entreprise a en plus son numéro SIRET et autant de contacts que nécessaire, chacun avec son rôle, dont un contact principal.',
          'Au moment de faire un devis pour une entreprise, vous choisissez le contact à qui il s’adresse.',
        ],
      },
      {
        title: 'Des fiches qui se créent sans ressaisie',
        body: [
          'Vous pouvez ajouter un client à la main. Le plus souvent, la fiche se crée d’elle-même : quand vous créez un devis avec une adresse email, quand vous reprenez un ancien devis, ou quand vous transformez une demande en devis.',
        ],
      },
      {
        title: 'Notes et historique',
        body: [
          'Chaque fiche garde vos notes commerciales et l’historique du client : le chiffre d’affaires confirmé des six derniers mois et la liste de ses devis.',
          'La liste se filtre entre particuliers, entreprises et habitués, c’est-à-dire les clients qui comptent au moins trois devis. La recherche porte sur le nom et l’email.',
        ],
      },
    ],
    faqs: [
      { q: 'Puis-je importer mon fichier clients ?', a: 'Oui. Vous collez les lignes copiées depuis Excel ou Google Sheets, ou vous choisissez un fichier CSV : prénom, nom, entreprise, email, téléphone, adresse. L’email est obligatoire, et un client déjà présent n’est pas créé deux fois.' },
      { q: 'Comment un devis est-il rattaché à un client ?', a: 'Par l’adresse email. L’historique d’un client liste les devis qui portent son adresse email.' },
      { q: 'Qu’est-ce qu’un client « habitué » ?', a: 'Un client qui compte au moins trois devis. Un filtre les réunit, et leur nom porte une étiquette dans la liste.' },
    ],
    related: ['devis-traiteur', 'demandes-de-devis', 'calendrier'],
  }),

  feature({
    slug: 'evenements',
    icon: 'calendar-range',
    label: 'Événements',
    blurb: 'Checklist, matériel et location de chaque prestation.',
    group: 'pendant',
    metaTitle: 'Événements du traiteur : checklist, matériel, location | WeboDevis',
    description: 'Un devis validé devient un événement : checklist, matériel à préparer, location calculée par convive et regroupée par fournisseur, liste de courses et extras.',
    keyword: 'logiciel gestion événement traiteur',
    h1: 'Préparer chaque événement : checklist, matériel, location',
    lead: 'Un devis validé et daté devient un événement. Vous y préparez tout ce qui n’est pas dans l’assiette, et vous y retrouvez la liste de courses et les extras.',
    preview: 'evenement',
    highlights: [
      'Un devis validé devient un événement, sans ressaisie.',
      'Quatre onglets : checklist, matériel, courses, extras.',
      'La location calculée par convive, regroupée par fournisseur.',
    ],
    sections: [
      {
        title: 'Du devis à l’événement',
        body: [
          'Dès qu’un devis daté passe au statut « Validé », « Acompte reçu » ou « Payé », il apparaît dans vos événements, à venir puis passés. Il n’y a rien à recréer.',
          'La fiche reprend le client, la date, le lieu, le nombre de couverts et le montant. Vous y corrigez la date, le lieu ou le nombre de couverts quand le client les modifie.',
        ],
      },
      {
        title: 'Une checklist par événement',
        body: [
          'Vous ajoutez vos tâches, vous les ordonnez, vous les cochez. Une barre indique l’avancement : huit tâches faites sur douze, par exemple.',
        ],
      },
      {
        title: 'Le matériel à préparer',
        body: [
          'Vous listez le matériel à emporter, avec sa quantité, et vous cochez ce qui est prêt. Les lignes du devis qui relèvent du matériel, de la vaisselle ou du personnel s’y ajoutent d’elles-mêmes, pour ne rien oublier de ce qui a été vendu.',
        ],
      },
      {
        title: 'La location, calculée par convive',
        body: [
          'Dans vos modèles de location, chaque article a une quantité par convive, un fournisseur et un prix. Pour un événement, la location se génère à partir de ces modèles : la quantité par convive, multipliée par le nombre de couverts et arrondie à l’unité supérieure.',
          'Vous complétez à la main, vous cochez ce qui est commandé, et vous imprimez la liste, regroupée par fournisseur avec ses sous-totaux. Sur une période, la location de tous vos événements confirmés se cumule en un bon par fournisseur.',
        ],
      },
    ],
    faqs: [
      { q: 'Dois-je créer l’événement à la main ?', a: 'Non. Un devis qui a une date et dont le statut passe à « Validé », « Acompte reçu » ou « Payé » apparaît de lui-même dans les événements.' },
      { q: 'La checklist est-elle déjà remplie ?', a: 'Non. Elle part vide et vous y ajoutez vos tâches, événement par événement. Le guide « La checklist d’un événement » propose une trame à adapter.' },
      { q: 'Puis-je regrouper la location de plusieurs événements ?', a: 'Oui. Vous choisissez une période, et WeboDevis cumule la location des événements confirmés par fournisseur, avec le détail par date, à imprimer.' },
    ],
    related: ['liste-de-courses', 'extras', 'allergenes', 'calendrier'],
    guide: 'checklist-evenement-traiteur',
    updated: '2026-10-20',
  }),

  feature({
    slug: 'liste-de-courses',
    icon: 'shopping-basket',
    label: 'Liste de courses',
    blurb: 'Les quantités calculées par convive.',
    group: 'pendant',
    metaTitle: 'Liste de courses de traiteur calculée par convive | WeboDevis',
    description: 'La liste de courses d’un événement, calculée depuis le devis : quantité par personne multipliée par le nombre de couverts, regroupée par fournisseur.',
    keyword: 'liste de courses traiteur',
    h1: 'La liste de courses du traiteur, calculée par convive',
    lead: 'Chaque prestation connaît ses ingrédients et leur quantité par personne. WeboDevis les multiplie par le nombre de couverts du devis et vous rend une liste par fournisseur, à cocher depuis le téléphone.',
    preview: 'courses',
    highlights: [
      'Quantité par personne, multipliée par le nombre de couverts.',
      'Une liste regroupée par fournisseur.',
      'Un mode courses, à cocher sur le téléphone.',
    ],
    sections: [
      {
        title: 'Le calcul, écrit une fois',
        body: [
          'Dans votre catalogue, chaque prestation porte ses ingrédients, avec une quantité par personne. Pour un événement, « Calculer depuis le devis » reprend les prestations du devis et multiplie ces quantités par le nombre de couverts.',
          'Un ingrédient présent dans plusieurs prestations n’apparaît qu’une fois, quantités additionnées. Le calcul vous signale les prestations qui n’ont pas encore d’ingrédients et les lignes du devis absentes du catalogue.',
        ],
      },
      {
        title: 'Vous gardez la main',
        body: [
          'Vous ajoutez un ingrédient, vous corrigez une quantité, vous changez le fournisseur d’une ligne, vous laissez une note. Si le nombre de couverts change, vous recalculez : vos ajouts, vos cases cochées et vos changements de fournisseur sont conservés.',
        ],
      },
      {
        title: 'Par fournisseur au bureau, par rayon au marché',
        body: [
          'La liste se lit et s’imprime par fournisseur. Le mode courses la présente autrement, pour le téléphone : de grandes lignes à toucher, rangées par catégorie d’ingrédient, avec un compteur et une barre d’avancement qui restent en haut de l’écran.',
        ],
      },
      {
        title: 'Des courses aux commandes',
        body: [
          'Depuis la liste, vous créez les commandes : une par fournisseur, en brouillon, que vous retrouvez avec vos autres commandes. Et quand plusieurs événements tombent la même semaine, les courses globales cumulent leurs listes par ingrédient et par fournisseur.',
        ],
      },
    ],
    faqs: [
      { q: 'Le calcul distingue-t-il les adultes et les enfants ?', a: 'Non. La quantité par personne est multipliée par le nombre total de couverts du devis, adultes et enfants confondus. Si les enfants ont un menu à part, vous ajustez les lignes à la main.' },
      { q: 'Le stock est-il déduit de la liste ?', a: 'Non. La liste donne le besoin de l’événement ; c’est à vous de retirer ce que vous avez déjà en réserve. Le stock est mis à jour quand vous marquez une commande fournisseur comme reçue.' },
      { q: 'Les quantités sont-elles arrondies au conditionnement ?', a: 'Non. Les quantités sont calculées au plus juste, à deux décimales. L’arrondi au colis ou à la caisse se fait au moment de commander.' },
      { q: 'Le mode courses fonctionne-t-il sans réseau ?', a: 'Non. Chaque case cochée est enregistrée en ligne : il faut une connexion.' },
    ],
    related: ['evenements', 'stock-et-fournisseurs', 'application-mobile'],
    guide: 'calculer-quantites-par-convive',
  }),

  feature({
    slug: 'allergenes',
    icon: 'shield-alert',
    label: 'Allergènes',
    blurb: 'Les 14 allergènes, de l’ingrédient à la fiche du buffet.',
    group: 'pendant',
    metaTitle: 'Allergènes pour traiteur : recettes et fiche par événement | WeboDevis',
    description: 'Les 14 allergènes réglementaires notés sur vos ingrédients, repris sur vos prestations à partir de la recette, et une fiche allergènes imprimable pour chaque événement.',
    keyword: 'fiche allergènes traiteur',
    h1: 'Les allergènes, de l’ingrédient à la fiche du buffet',
    lead: 'Vous notez les allergènes de vos ingrédients une fois. Vos prestations les reprennent depuis leur recette, et chaque événement a sa fiche : les plats du menu face aux 14 allergènes, à remettre au client ou à afficher près du buffet.',
    preview: 'allergenes',
    highlights: [
      'Les 14 allergènes de la réglementation européenne.',
      'Notés sur l’ingrédient, repris par la recette.',
      'Une fiche par événement : les plats en lignes, les allergènes en colonnes.',
    ],
    sections: [
      {
        title: 'Sur les ingrédients',
        body: [
          'Chaque ingrédient porte ses allergènes, choisis parmi les 14 de l’annexe II du règlement européen n° 1169/2011.',
          'Tant que vous ne les avez pas cochés, WeboDevis en suggère d’après le nom de l’ingrédient : « Beurre doux » fait penser au lait, « Farine de blé » au gluten. Ce ne sont que des suggestions, signalées comme telles. C’est vous qui confirmez.',
        ],
        points: [
          'Gluten, crustacés, œufs, poissons, arachides, soja, lait',
          'Fruits à coque, céleri, moutarde, sésame, sulfites, lupin, mollusques',
        ],
      },
      {
        title: 'Sur les prestations',
        body: [
          'Une prestation réunit les allergènes de tous les ingrédients de sa recette. Vous en ajoutez à la main pour ce que la recette ne dit pas : une sauce achetée toute prête, une garniture, un risque de traces.',
          'Pour chaque allergène, vous voyez d’où il vient : de quel ingrédient, ou ajouté à la main. Une fois la liste relue, vous la marquez comme vérifiée.',
        ],
      },
      {
        title: 'La fiche allergènes de l’événement',
        body: [
          'Depuis la fiche d’un événement, « Fiche allergènes » met les plats du devis en lignes et les 14 allergènes en colonnes. Un point marque chaque allergène présent. L’en-tête reprend votre nom, le type d’événement, sa date, le client et le nombre de couverts.',
          'La fiche s’imprime, pour être remise au client avec le menu ou affichée près du buffet.',
        ],
        points: [
          'Un avertissement tant que des plats n’ont pas d’allergènes vérifiés',
          'Les lignes du devis absentes du catalogue signalées à l’écran, pas oubliées en silence',
          'La date d’établissement en bas de la fiche',
        ],
      },
    ],
    faqs: [
      { q: 'Les suggestions d’allergènes sont-elles fiables ?', a: 'Ce sont des indices tirés du nom de l’ingrédient, pas une analyse. Elles ne remplacent ni la fiche technique de vos produits ni votre relecture : c’est pour cela qu’une prestation se marque comme vérifiée à part.' },
      { q: 'Comment un plat du devis est-il relié à sa recette ?', a: 'Par son nom : la ligne du devis est rapprochée de la prestation du catalogue qui porte le même nom. Une ligne saisie à la main, sans prestation au catalogue, n’est pas reprise sur la fiche ; elle est listée à l’écran pour que vous la complétiez.' },
      { q: 'La fiche distingue-t-elle les traces ?', a: 'Non. Un point signale que le plat contient l’allergène ou peut en contenir des traces. Ajoutez à la main, sur la prestation, les allergènes qui ne sont présents qu’à l’état de traces.' },
      { q: 'WeboDevis garantit-il l’exactitude de la fiche ?', a: 'Non. WeboDevis met en forme ce que vous saisissez. L’exactitude dépend de vos recettes et des produits achetés : relisez les allergènes à chaque changement de recette ou de fournisseur.' },
    ],
    related: ['evenements', 'liste-de-courses', 'devis-traiteur'],
    guide: 'allergenes-traiteur',
    updated: '2026-10-20',
  }),

  feature({
    slug: 'extras',
    icon: 'user-check',
    label: 'Extras',
    blurb: 'Votre personnel et son lien de mission.',
    group: 'pendant',
    metaTitle: 'Gestion des extras pour traiteur : missions et agenda | WeboDevis',
    description: 'Le fichier de vos extras, leur affectation à chaque événement, un agenda de l’équipe sur huit semaines et un lien personnel où chaque extra retrouve ses missions à venir.',
    keyword: 'gestion des extras traiteur',
    h1: 'Vos extras et leurs missions',
    lead: 'Le fichier de vos extras, leur affectation à chaque événement, un agenda sur huit semaines, et pour chacun un lien où il retrouve ses prochaines missions.',
    preview: 'extras',
    highlights: [
      'Un lien par extra : ses missions à venir, sans compte.',
      'À solliciter, confirmé, présent : où en est chacun.',
      'L’agenda de l’équipe sur huit semaines.',
    ],
    sections: [
      {
        title: 'Le fichier de vos extras',
        body: [
          'Chaque extra a sa fiche : nom, téléphone, email et rôle, du cuisinier au barman. Depuis la liste, vous voyez ses missions à venir et vous l’affectez à un événement.',
        ],
      },
      {
        title: 'Affecter un extra à un événement',
        body: [
          'Depuis l’événement, vous choisissez l’extra, son heure d’arrivée et vos consignes. Vous pouvez désigner celui qui est chargé des courses.',
          'Chaque affectation a un statut que vous tenez à jour : à solliciter, confirmé, présent. L’événement affiche le nombre d’extras confirmés sur le nombre prévu.',
        ],
      },
      {
        title: 'Le lien de mission',
        body: [
          'Chaque extra a un lien personnel. Il l’ouvre sans compte et y trouve ses missions à venir : le type d’événement, la date, son heure d’arrivée, le lieu, le nombre d’invités et vos consignes.',
          'Vous copiez ce lien et vous le lui transmettez par le moyen que vous utilisez déjà. Pour le jour J, les fiches de mission s’impriment, une page par extra.',
        ],
      },
      {
        title: 'Toute l’équipe sur un agenda',
        body: [
          'La vue agenda met vos extras en lignes et les huit prochaines semaines en colonnes. Vous voyez qui est déjà pris, et quand.',
        ],
      },
    ],
    faqs: [
      { q: 'L’extra peut-il confirmer sa présence depuis son lien ?', a: 'Non. Sa page est en lecture seule. C’est vous qui passez son affectation à « Confirmé » quand il vous a répondu.' },
      { q: 'Le lien est-il envoyé automatiquement à l’extra ?', a: 'Non. Vous copiez le lien depuis WeboDevis et vous le lui envoyez vous-même, par SMS, par messagerie ou par email.' },
      { q: 'WeboDevis calcule-t-il le coût des extras ?', a: 'Non. La fiche d’un extra ne porte pas de tarif. Le coût du personnel se saisit dans le suivi financier du devis, en frais additionnels.' },
    ],
    related: ['evenements', 'calendrier', 'suivi-financier'],
    guide: 'checklist-evenement-traiteur',
  }),

  feature({
    slug: 'stock-et-fournisseurs',
    icon: 'boxes',
    label: 'Stock et fournisseurs',
    blurb: 'Réserve, fournisseurs et commandes.',
    group: 'pendant',
    metaTitle: 'Gestion de stock et commandes fournisseurs pour traiteur | WeboDevis',
    description: 'Le stock du traiteur par ingrédient, avec seuil d’alerte et historique des mouvements, le fichier des fournisseurs et les commandes : une commande reçue met le stock à jour.',
    keyword: 'gestion de stock traiteur',
    h1: 'Le stock, les fournisseurs et les commandes du traiteur',
    lead: 'Ce que vous avez en réserve, à qui vous achetez, et ce que vous avez commandé. Une commande reçue remet le stock à jour.',
    preview: 'stock',
    highlights: [
      'Un seuil d’alerte par ingrédient.',
      'Une commande par fournisseur, créée depuis la liste de courses.',
      'Commande reçue : le stock se met à jour.',
    ],
    sections: [
      {
        title: 'Le stock, ingrédient par ingrédient',
        body: [
          'Pour chaque ingrédient, vous voyez la quantité en réserve et vous enregistrez les entrées et les sorties, avec leur raison. L’historique garde les derniers mouvements.',
          'Un seuil d’alerte par ingrédient fait ressortir ce qui est bas et ce qui est épuisé, avec un compteur dans le menu. L’écran indique aussi la valeur du stock, à partir du prix unitaire de chaque ingrédient.',
        ],
      },
      {
        title: 'Vos ingrédients et vos fournisseurs',
        body: [
          'Le catalogue d’ingrédients range vos produits par catégorie, avec leur unité, leur prix unitaire, une photo et un fournisseur préféré. Vous pouvez l’importer depuis un fichier CSV.',
          'Chaque fournisseur a sa fiche : nom, téléphone, email, adresse et notes.',
        ],
      },
      {
        title: 'Les commandes fournisseurs',
        body: [
          'Une commande se crée à la main, ou depuis la liste de courses d’un événement : WeboDevis en prépare alors une par fournisseur. Elle passe de brouillon à envoyée, puis à reçue, et son bon de commande numéroté s’imprime.',
          'Quand vous la marquez comme reçue, les quantités commandées s’ajoutent au stock.',
        ],
      },
    ],
    faqs: [
      { q: 'La commande est-elle envoyée au fournisseur par WeboDevis ?', a: 'Non. Vous imprimez le bon de commande et vous le transmettez à votre fournisseur. « Marquer envoyée » note simplement que c’est fait, avec la date.' },
      { q: 'Le stock baisse-t-il tout seul après un événement ?', a: 'Non. Les sorties de stock se saisissent à la main. Seule la réception d’une commande modifie le stock automatiquement.' },
      { q: 'Puis-je importer ma liste d’ingrédients ?', a: 'Oui, depuis un fichier CSV qui indique la catégorie, le nom et l’unité de chaque ingrédient.' },
    ],
    related: ['liste-de-courses', 'evenements', 'suivi-financier'],
    guide: 'liste-de-courses-evenement',
  }),

  feature({
    slug: 'calendrier',
    icon: 'calendar-days',
    label: 'Calendrier',
    blurb: 'Devis en cours et événements, mois par mois.',
    group: 'quotidien',
    metaTitle: 'Calendrier d’événements pour traiteur | WeboDevis',
    description: 'Le calendrier mensuel du traiteur : événements confirmés et devis en cours sur la même grille, nombre de couverts du mois, alerte sur les journées trop chargées.',
    keyword: 'calendrier événements traiteur',
    h1: 'Le calendrier des événements du traiteur',
    lead: 'Une grille mensuelle où figurent vos événements confirmés et vos devis encore en cours. Vous voyez les dates prises, celles qui se jouent, et les journées trop chargées.',
    preview: 'calendrier',
    highlights: [
      'Événements confirmés et devis en cours, sur la même grille.',
      'Le nombre de couverts du mois, en un chiffre.',
      'Une alerte quand une journée dépasse 300 couverts.',
    ],
    sections: [
      {
        title: 'Le mois en un écran',
        body: [
          'Chaque devis daté figure sur la grille, sauf ceux qui ont été refusés. Un événement confirmé s’affiche en plein, un devis en cours en contour : vous distinguez ce qui est acquis de ce qui reste à conclure.',
          'Un filtre ne garde que les confirmés. Au-dessus de la grille, un résumé donne le nombre d’événements confirmés, de devis en cours et de couverts du mois.',
        ],
      },
      {
        title: 'Le détail d’une journée',
        body: [
          'Un clic sur un jour liste ses événements, avec leur statut, leur type, le nombre de couverts, le lieu et le montant. De là, vous ouvrez la fiche de l’événement ou le devis.',
        ],
      },
      {
        title: 'Repérer les journées trop chargées',
        body: [
          'Quand le total d’une journée dépasse 300 couverts, il passe en rouge. C’est le moment de vérifier l’équipe et le matériel avant d’accepter une affaire de plus.',
        ],
      },
    ],
    faqs: [
      { q: 'Puis-je synchroniser le calendrier avec mon agenda ?', a: 'Pas dans la version 0.1. Le calendrier se consulte dans WeboDevis ; il ne s’exporte pas vers un autre agenda.' },
      { q: 'Les devis refusés apparaissent-ils ?', a: 'Non. La grille montre les événements confirmés et les devis en cours, pas ceux qui ont été refusés.' },
      { q: 'Y a-t-il une vue à la semaine ?', a: 'Le calendrier est mensuel. Pour l’équipe, la page des extras propose un agenda sur huit semaines.' },
    ],
    related: ['evenements', 'devis-traiteur', 'extras'],
  }),

  feature({
    slug: 'suivi-financier',
    icon: 'trending-up',
    label: 'Suivi financier',
    blurb: 'Coûts, marge et chiffre d’affaires.',
    group: 'quotidien',
    metaTitle: 'Marge et coûts d’un devis de traiteur : suivi financier | WeboDevis',
    description: 'Pour chaque devis de traiteur : chiffre d’affaires, charges et marge brute, avec le détail par prestation. Et un tableau de bord du mois, du trimestre et de l’année.',
    keyword: 'calcul marge traiteur',
    h1: 'Suivre la marge de chaque devis de traiteur',
    lead: 'Pour chaque devis, le chiffre d’affaires, les charges et la marge brute côte à côte. Et un tableau de bord pour voir où en est l’activité.',
    preview: 'finance',
    highlights: [
      'Chiffre d’affaires, charges, marge brute : trois chiffres par devis.',
      'Un coût de revient par prestation, saisi une fois.',
      'Le tableau de bord du mois, du trimestre, de l’année.',
    ],
    sections: [
      {
        title: 'Marge et coûts, devis par devis',
        body: [
          'Depuis un devis ou un événement, la fiche « Marge et coûts » affiche le chiffre d’affaires hors taxes, les charges et la marge brute, en euros et en pourcentage. Un tableau détaille chaque prestation : ce qu’elle rapporte, ce qu’elle coûte, ce qu’elle laisse.',
        ],
      },
      {
        title: 'Un coût de revient saisi une fois',
        body: [
          'Vous indiquez le coût de revient d’une prestation. Il est enregistré dans votre catalogue et resservira dans tous les devis qui contiennent cette prestation.',
          'Ce qui est propre à l’événement s’ajoute en frais additionnels : le personnel, le transport, la location. La synthèse part du chiffre d’affaires hors taxes, retire les coûts des prestations et ces frais, et donne la marge brute estimée.',
        ],
      },
      {
        title: 'Le tableau de bord',
        body: [
          'À l’ouverture de l’application : le chiffre d’affaires du mois, du trimestre ou de l’année, les couverts à venir, les devis en cours et le taux de conversion. En dessous, les prochains événements, le chiffre d’affaires sur six mois et la répartition des devis par étape.',
        ],
      },
    ],
    faqs: [
      { q: 'Le coût de revient est-il calculé à partir des ingrédients ?', a: 'Non. Vous saisissez le coût de revient de chaque prestation. Il est ensuite réutilisé dans tous vos devis.' },
      { q: 'WeboDevis suit-il les acomptes et les paiements ?', a: 'Oui, par les factures. Vous facturez l’acompte puis le solde depuis le devis, et vous enregistrez chaque paiement reçu. Quand l’acompte est réglé, le devis passe à « Acompte reçu » ; quand le solde l’est, à « Payé ».' },
      { q: 'Le coût des extras et de la location est-il repris automatiquement ?', a: 'Non. Vous les ajoutez en frais additionnels sur la fiche « Marge et coûts » du devis.' },
    ],
    related: ['devis-traiteur', 'facturation', 'extras', 'stock-et-fournisseurs'],
    guide: 'calculer-marge-traiteur',
    updated: '2026-10-20',
  }),

  feature({
    slug: 'facturation',
    icon: 'receipt',
    label: 'Factures',
    blurb: 'Acompte, solde, avoir et paiements, depuis le devis.',
    group: 'quotidien',
    metaTitle: 'Logiciel de facturation pour traiteur : acompte, solde, avoir | WeboDevis',
    description: 'Facturez depuis le devis : facture d’acompte, facture de solde qui déduit les acomptes, facture complète, avoir. Numérotation continue, TVA ventilée par taux, paiements et export CSV pour le comptable.',
    keyword: 'logiciel facturation traiteur',
    h1: 'Les factures du traiteur, à partir du devis',
    lead: 'Le devis accepté donne ses factures : l’acompte, puis le solde qui déduit ce qui a déjà été facturé. Les numéros se suivent sans trou, les paiements s’enregistrent, et votre comptable reçoit un fichier.',
    preview: 'factures',
    highlights: [
      'Acompte, solde, facture complète ou avoir : tout part du devis.',
      'Une numérotation continue, propre à votre entreprise.',
      'Une facture émise ne se modifie plus : on l’annule par un avoir.',
    ],
    sections: [
      {
        title: 'Facturer depuis le devis',
        body: [
          'Depuis un devis, « Facturer » propose trois types de facture. L’acompte se calcule en pourcentage du devis, ou à partir d’un montant. Le solde reprend les lignes du devis et déduit chaque acompte déjà facturé, avec son numéro. La facture complète couvre tout le devis en une fois.',
          'Les lignes en option, offertes ou retirées du devis ne sont pas facturées. Une prestation avec un prix enfant donne une ligne pour les adultes et une pour les enfants.',
        ],
        points: [
          'Acompte : un pourcentage proposé par défaut, réglable dans vos paramètres',
          'Solde : les acomptes déjà facturés déduits, taux de TVA par taux de TVA',
          'Avoir : les lignes de la facture annulée, reprises en négatif',
        ],
      },
      {
        title: 'Un brouillon, puis une facture émise',
        body: [
          'Une facture commence en brouillon : vous relisez les lignes, le client, la date de la prestation, une note. À l’émission, elle reçoit son numéro et sa date d’échéance, calculée d’après le délai de paiement de vos paramètres.',
          'Une facture émise ne se modifie plus et ne se supprime pas. Pour la corriger, vous établissez un avoir : il reprend ses lignes en négatif et, une fois émis, la facture d’origine passe au statut « Annulée par avoir ».',
        ],
      },
      {
        title: 'Des numéros qui se suivent',
        body: [
          'Factures et avoirs ont chacun leur suite de numéros, propre à votre entreprise et sans trou : le numéro n’est attribué qu’à l’émission, jamais à un brouillon. Comme pour vos devis, vous réglez le préfixe des numéros dans vos paramètres.',
        ],
      },
      {
        title: 'TVA par ligne et mentions légales',
        body: [
          'Chaque ligne du devis peut avoir son taux de TVA : 5,5 %, 10 %, 20 %. La facture reprend ces taux et ventile la TVA par taux sous les totaux. Le taux qui convient à chaque prestation se valide avec votre comptable.',
          'Le pied de facture reprend vos mentions : forme juridique, capital, RCS, SIRET, numéro de TVA ou mention de franchise « TVA non applicable, art. 293 B du CGI », échéance, IBAN. Pour un client professionnel, les pénalités de retard et l’indemnité forfaitaire de recouvrement s’y ajoutent.',
        ],
      },
      {
        title: 'Paiements et export comptable',
        body: [
          'Vous enregistrez chaque paiement reçu : date, montant, moyen de paiement (virement, chèque, espèces, carte) et une note. La facture passe à « Payée en partie », puis à « Payée ». Le devis suit : « Acompte reçu » quand l’acompte est réglé, « Payé » quand le solde l’est.',
          'La liste des factures s’exporte en CSV, à transmettre à votre comptable ou à ouvrir dans un tableur : numéro, type, dates, client, montants HT, TVA et TTC, montant payé, statut. Chaque facture émise se télécharge en PDF au format Factur-X.',
        ],
      },
    ],
    faqs: [
      { q: 'Puis-je modifier une facture déjà émise ?', a: 'Non. Une facture émise est figée. Pour la corriger, vous établissez un avoir qui l’annule, puis une nouvelle facture. Tant qu’elle est en brouillon, en revanche, tout se modifie et elle peut être supprimée.' },
      { q: 'Comment le solde tient-il compte des acomptes ?', a: 'La facture de solde reprend toutes les lignes du devis, puis déduit chaque facture d’acompte déjà émise, avec son numéro, taux de TVA par taux de TVA.' },
      { q: 'Je suis en franchise de TVA : comment sont faites mes factures ?', a: 'Vous cochez la franchise en base dans vos paramètres. Vos factures sont alors établies sans TVA et portent la mention « TVA non applicable, art. 293 B du CGI ».' },
      { q: 'WeboDevis remplace-t-il mon logiciel de comptabilité ?', a: 'Non. WeboDevis établit vos factures et suit leurs paiements. L’export CSV et les PDF Factur-X se transmettent à votre comptable ou à votre logiciel comptable.' },
    ],
    related: ['facture-electronique', 'devis-traiteur', 'suivi-financier'],
    guide: 'facture-electronique-traiteur',
    updated: '2026-10-20',
  }),

  feature({
    slug: 'facture-electronique',
    icon: 'file-check',
    label: 'Facture électronique',
    blurb: 'Le PDF Factur-X aujourd’hui, la plateforme agréée ensuite.',
    group: 'quotidien',
    metaTitle: 'Facture électronique pour traiteur : Factur-X et réforme | WeboDevis',
    description: 'WeboDevis produit vos factures au format Factur-X : un PDF/A-3 qui contient les données de la facture en XML, au profil EN 16931. Ce qui est prêt pour la réforme de la facturation électronique, et ce qui est prévu.',
    keyword: 'facture électronique traiteur',
    h1: 'La facture électronique, au format Factur-X',
    lead: 'Chaque facture émise dans WeboDevis se télécharge au format Factur-X : un PDF que votre client lit comme d’habitude, avec à l’intérieur les données de la facture dans un fichier structuré. Le raccordement à une plateforme agréée est prévu pour la suite.',
    preview: 'facturx',
    highlights: [
      'Un PDF pour votre client, un fichier XML pour les logiciels.',
      'Le format Factur-X, au profil EN 16931.',
      'Le raccordement à une plateforme agréée : prévu, pas encore disponible.',
    ],
    sections: [
      {
        title: 'Ce qu’est une facture Factur-X',
        body: [
          'Factur-X est un format de facture hybride. Le fichier est un PDF ordinaire, que votre client ouvre et imprime comme n’importe quelle facture. À l’intérieur, un fichier XML reprend les mêmes informations sous une forme qu’un logiciel sait lire sans ressaisie : vendeur, client, lignes, taux de TVA, totaux, échéance.',
          'C’est l’un des formats retenus par l’administration pour la facturation électronique entre entreprises, avec UBL et CII.',
        ],
      },
      {
        title: 'Ce que produit WeboDevis',
        body: [
          'Une facture émise se télécharge en PDF/A-3, la version du PDF prévue pour l’archivage et qui accepte un fichier joint. Le fichier factur-x.xml y est joint, au profil EN 16931, la norme européenne de la facture électronique.',
          'Le PDF est reconstruit à partir de la facture telle qu’elle a été émise : le même fichier est produit à chaque téléchargement. Un brouillon se télécharge en simple aperçu, marqué « Brouillon ».',
        ],
        points: [
          'PDF/A-3, avec le fichier XML joint',
          'Profil EN 16931',
          'Factures, acomptes, soldes et avoirs',
          'Les mêmes mentions et la même TVA ventilée dans le PDF et dans le XML',
        ],
      },
      {
        title: 'La réforme, en bref',
        body: [
          'La France généralise la facture électronique entre entreprises assujetties à la TVA. Selon le calendrier annoncé par l’administration, les PME et les micro-entreprises devront émettre leurs factures à leurs clients professionnels sous forme électronique à partir de septembre 2027.',
          'Ces factures ne s’envoient plus alors par simple email : elles passent par une plateforme agréée par l’administration. Les ventes aux particuliers, elles, ne donnent pas lieu à une facture électronique, mais la réforme prévoit d’en transmettre les données à l’administration.',
        ],
      },
      {
        title: 'Ce qui est prêt, ce qui est prévu',
        body: [
          'Prêt : vos factures, acomptes, soldes et avoirs au format Factur-X, avec une numérotation continue et les mentions de votre entreprise.',
          'Prévu : le raccordement de WeboDevis à une plateforme agréée, pour lui transmettre vos factures. Il n’est pas encore disponible ; nous l’annoncerons sur la page des nouveautés. D’ici là, vous transmettez vos factures comme aujourd’hui, en PDF.',
        ],
      },
    ],
    faqs: [
      { q: 'Mes factures WeboDevis sont-elles déjà des factures électroniques au sens de la réforme ?', a: 'Leur format, oui : Factur-X est l’un des formats retenus. Mais au sens de la réforme, une facture électronique passe aussi par une plateforme agréée, et ce raccordement n’est pas encore disponible dans WeboDevis.' },
      { q: 'Mes clients particuliers sont-ils concernés ?', a: 'Pas par la facture électronique elle-même, qui concerne les échanges entre entreprises. Pour les ventes aux particuliers, la réforme prévoit une transmission de données à l’administration. Votre comptable vous dira ce qui s’applique à votre situation.' },
      { q: 'Mon comptable peut-il lire ces factures ?', a: 'Oui. Le PDF se lit comme une facture ordinaire, et un logiciel qui accepte le format Factur-X en lit directement les données. La liste des factures s’exporte aussi en CSV.' },
      { q: 'Où trouver les informations officielles ?', a: 'Sur impots.gouv.fr, dans la rubrique consacrée à la facturation électronique, et sur economie.gouv.fr. Le calendrier et la liste des plateformes agréées y sont publiés.' },
    ],
    related: ['facturation', 'suivi-financier', 'clients'],
    guide: 'facture-electronique-traiteur',
    updated: '2026-10-20',
  }),

  feature({
    slug: 'application-mobile',
    icon: 'smartphone',
    label: 'Application mobile',
    blurb: 'Sur téléphone, tablette et ordinateur.',
    group: 'quotidien',
    metaTitle: 'Application mobile pour traiteur | WeboDevis',
    description: 'WeboDevis s’ajoute à l’écran d’accueil du téléphone et s’ouvre en plein écran. La même application sur téléphone, tablette et ordinateur.',
    keyword: 'application traiteur mobile',
    h1: 'WeboDevis sur téléphone, tablette et ordinateur',
    lead: 'La même application partout. Sur téléphone, elle s’ajoute à l’écran d’accueil et s’ouvre en plein écran, avec une barre d’onglets faite pour le pouce.',
    preview: 'mobile',
    highlights: [
      'S’ajoute à l’écran d’accueil, s’ouvre en plein écran.',
      'Un bouton « + » pour créer un devis, toujours au centre.',
      'La liste de courses à cocher, au marché.',
    ],
    sections: [
      {
        title: 'Sur l’écran d’accueil',
        body: [
          'Depuis le menu de votre navigateur, vous ajoutez WeboDevis à l’écran d’accueil. L’application s’ouvre ensuite comme les autres, en plein écran, sans barre d’adresse.',
        ],
      },
      {
        title: 'Une navigation faite pour le téléphone',
        body: [
          'En bas de l’écran, une barre donne accès à l’accueil, aux devis et aux événements. Au centre, le bouton « + » crée un devis. « Plus » ouvre tout le reste : clients, calendrier, commandes, stock, extras.',
        ],
      },
      {
        title: 'Sur tablette et sur ordinateur',
        body: [
          'Sur tablette, le menu devient une colonne d’icônes. Sur ordinateur, il se déploie en barre latérale, la recherche retrouve un devis, un client ou un événement, et les devis s’affichent aussi en colonnes, une par statut.',
        ],
      },
      {
        title: 'Ce qu’il faut savoir',
        body: [
          'WeboDevis a besoin d’une connexion internet. Sans réseau, l’application l’indique et vous propose de réessayer.',
        ],
      },
    ],
    faqs: [
      { q: 'WeboDevis est-il disponible sur l’App Store ou Google Play ?', a: 'Non. C’est une application web : vous l’ouvrez dans votre navigateur et vous l’ajoutez à l’écran d’accueil, sans passer par un magasin d’applications.' },
      { q: 'L’application fonctionne-t-elle hors connexion ?', a: 'Non. Elle a besoin du réseau pour charger et enregistrer vos données.' },
      { q: 'Reçoit-on des notifications sur le téléphone ?', a: 'Les notifications s’affichent dans l’application, sous la cloche. La version 0.1 n’envoie pas de notifications sur l’écran verrouillé du téléphone.' },
    ],
    related: ['liste-de-courses', 'devis-traiteur', 'evenements'],
  }),
];

/** Les étapes du métier, dans l'ordre du menu. */
export const FEATURE_GROUPS: { id: FeatureGroupId; title: string; slugs: string[] }[] = [
  { id: 'avant', title: 'Avant l’événement', slugs: ['demandes-de-devis', 'devis-traiteur', 'signature-devis-en-ligne', 'clients'] },
  { id: 'pendant', title: 'Pendant la préparation', slugs: ['evenements', 'liste-de-courses', 'allergenes', 'extras', 'stock-et-fournisseurs'] },
  { id: 'quotidien', title: 'Au quotidien', slugs: ['calendrier', 'suivi-financier', 'facturation', 'facture-electronique', 'application-mobile'] },
];

export const featureBySlug = (slug: string) => FEATURES.find((f) => f.slug === slug);

/** Ce que fait le logiciel, en une ligne par fonction : repris dans les données structurées. */
export const FEATURE_LIST: string[] = FEATURES.map((f) => `${f.label} : ${f.blurb}`);
