import type { Faq } from './schema';

// Les pages fonctionnalités : une page par intention de recherche.
// Chaque phrase décrit ce que l'interface permet réellement dans la version 0.1 (vérifié dans le code
// de l'app). Quand une chose n'existe pas, la question fréquente le dit.

export type FeatureGroupId = 'avant' | 'pendant' | 'quotidien';
export type FeaturePreview = 'demandes' | 'devis' | 'clients' | 'evenement' | 'courses' | 'extras' | 'stock' | 'calendrier' | 'finance' | 'mobile'
  | 'signature' | 'factures' | 'facturx' | 'allergenes' | 'brochure' | 'webo' | 'equipe';

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
          'Vous filtrez les demandes par type d’événement, par année et par statut. Celles dont l’événement approche ressortent dans la liste. Les demandes faites depuis une brochure y arrivent aussi, avec la brochure et le lien d’où elles viennent.',
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
    blurb: 'Formules au choix, éditeur, envoi par email ou WhatsApp.',
    group: 'avant',
    metaTitle: 'Logiciel de devis traiteur : formules, envoi | WeboDevis',
    description: 'Créez vos devis de traiteur en trois étapes, avec plusieurs formules au choix, et envoyez-les par email ou WhatsApp. Modèles, options, relances et historique.',
    keyword: 'logiciel devis traiteur',
    h1: 'Le devis de traiteur, de la création à l’envoi',
    lead: 'Trois étapes pour créer le devis, un éditeur pour le mettre en page, un lien pour l’envoyer. Et un statut qui suit l’affaire, de la première demande au paiement.',
    preview: 'devis',
    highlights: [
      'Trois étapes pour créer un devis : l’événement, le client, le style.',
      'Plusieurs formules dans un devis : le client choisit la sienne en signant.',
      'Votre client reçoit un lien, par email ou par WhatsApp.',
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
          'Page de garde, pages de photos, polices et couleurs, interligne et taille réglés paragraphe par paragraphe',
          'Votre logo en tête, vos conditions générales en fin de document, vos mentions légales en pied de page',
        ],
      },
      {
        title: 'Des pages exactes, comme sur le papier',
        body: [
          'L’éditeur montre le devis en pages A4, avec les mêmes coupures que le PDF : ce que vous voyez à l’écran est ce que votre client imprimera. Le texte de la carte se reprend directement dans le rendu du devis, et un plat peut se couper entre deux pages.',
        ],
      },
      {
        title: 'Plusieurs formules au choix',
        body: [
          'Un même devis peut proposer plusieurs formules, par exemple « Tradition » et « Prestige ». Chaque ligne appartient à une formule ou à toutes. La carte se range par formule, et une formule se duplique pour en faire une variante.',
          'Depuis son lien, votre client compare les formules, leur total et leur prix par convive, choisit la sienne et signe. S’il vous a répondu par téléphone, vous enregistrez son choix vous-même. Les factures, la marge, les courses et les allergènes ne comptent ensuite que la formule retenue.',
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
          'Vous envoyez le devis depuis l’application, avec votre message, en mettant jusqu’à cinq personnes en copie. Le client reçoit un email et un bouton « Consulter le devis » : il l’ouvre en ligne sans créer de compte, l’imprime ou l’enregistre en PDF. S’il répond à l’email, sa réponse arrive chez vous.',
          'Vous pouvez aussi l’envoyer par WhatsApp : la conversation s’ouvre avec votre message et le lien, sur le numéro du client s’il est connu. Le statut passe à « Devis envoyé », et votre client peut accepter le devis et le signer en ligne, depuis ce même lien.',
        ],
      },
      {
        title: 'Relances et historique',
        body: [
          'Si vous les activez dans vos paramètres, les relances partent toutes seules : deux au plus pour un devis resté sans réponse, espacées du délai que vous choisissez.',
          'L’onglet « Historique » de chaque devis retrace sa vie : création, changements de statut et qui les a faits, envois par email ou WhatsApp, consultations du client, signature, relances, factures et paiements. Vous suivez vos devis en liste ou en colonnes, une par statut.',
        ],
      },
    ],
    faqs: [
      { q: 'Mon client peut-il accepter le devis en ligne ?', a: 'Oui. Depuis le lien reçu, il accepte le devis et le signe au doigt ou à la souris ; le devis passe alors au statut « Validé » et vous êtes prévenu. S’il préfère le papier, le document se termine toujours par un cadre « Bon pour accord » à dater et à signer.' },
      { q: 'Comment présenter les options et ce que j’offre ?', a: 'Chaque ligne du devis a un statut. Une ligne « Option » reste hors du total et le document affiche à part le montant des options. Une ligne « Inclus » apparaît dans le devis avec la mention « Inclus », sans être comptée.' },
      { q: 'Puis-je faire un devis en anglais ?', a: 'Oui. À la création, vous choisissez la langue du devis, français ou anglais : les intitulés du document sont traduits. Vos prestations se traduisent aussi, en une fois : la traduction est enregistrée sur la prestation et resservira dans vos prochains devis en anglais. Vous choisissez la traduction gratuite, ou celle de Webo, l’assistant de WeboDevis.' },
      { q: 'Puis-je proposer deux menus dans le même devis ?', a: 'Oui, avec les formules. Votre client voit chaque formule et son total, choisit la sienne au moment de signer, et le devis ne compte plus que celle-là. Une fois une facture établie, la formule ne se change plus.' },
      { q: 'Puis-je garder mes anciens devis ?', a: 'Oui. L’import crée une fiche avec le client, la date, le nombre de couverts et le montant, et y joint votre fichier (PDF, document ou image). Le fichier est conservé tel quel, il n’est pas converti en devis modifiable.' },
    ],
    related: ['demandes-de-devis', 'signature-devis-en-ligne', 'brochures-traiteur', 'assistant-webo', 'facturation'],
    guide: 'contenu-devis-traiteur',
    updated: '2026-11-10',
  }),

  feature({
    slug: 'signature-devis-en-ligne',
    icon: 'signature',
    label: 'Signature en ligne',
    blurb: 'Le client accepte et signe le devis depuis son lien.',
    group: 'avant',
    metaTitle: 'Signature de devis en ligne pour traiteur | WeboDevis',
    description: 'Votre client ouvre le devis reçu par email, l’accepte et le signe au doigt ou à la souris. La signature est horodatée, le devis passe en « Validé ».',
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
          'Quand le devis propose plusieurs formules, votre client les compare, total et prix par convive, puis choisit la sienne avant de signer.',
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
    metaTitle: 'Fichier clients du traiteur | WeboDevis',
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
    metaTitle: 'Logiciel de gestion d’événement traiteur | WeboDevis',
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
      { q: 'Le stock est-il déduit de la liste ?', a: 'Sur demande. Depuis la liste de courses de l’événement, « Retirer du stock » sort une fois chaque ingrédient suivi en stock, et « Annuler la sortie » le remet si besoin. Le stock remonte quand vous marquez une commande fournisseur comme reçue.' },
      { q: 'Puis-je exprimer les quantités en grammes, en litres ou en pièces ?', a: 'Oui. Vous choisissez l’unité de la quantité par personne en reliant l’ingrédient à la prestation (g, kg, ml, cl, l…). La liste convertit ensuite dans l’unité d’achat de l’ingrédient.' },
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
    metaTitle: 'Fiche allergènes traiteur par événement | WeboDevis',
    description: 'Les 14 allergènes notés sur vos ingrédients, repris par vos recettes, et une fiche allergènes imprimable pour chaque événement, à afficher près du buffet.',
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
    blurb: 'Missions, contrat signé en ligne, DPAE, heures et paie.',
    group: 'pendant',
    metaTitle: 'Gestion des extras traiteur : contrat et DPAE | WeboDevis',
    description: 'Vos extras reçoivent leurs missions par email et répondent depuis leur lien. Contrat signé en ligne, DPAE préparée, heures faites et récapitulatif de paie.',
    keyword: 'gestion des extras traiteur',
    h1: 'Vos extras : missions, contrats et heures',
    lead: 'Le fichier de vos extras, leurs missions envoyées en un geste, la réponse depuis leur lien, le contrat signé en ligne, la DPAE préparée, puis les heures faites et le récapitulatif du mois pour la paie.',
    preview: 'extras',
    highlights: [
      'L’extra accepte ou refuse sa mission depuis son lien, sans compte.',
      'Le contrat d’extra, signé en ligne avant l’événement.',
      'Les heures du mois, prêtes pour la paie.',
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
          'Chaque affectation a un statut : à solliciter, confirmé, présent. L’événement affiche le nombre d’extras confirmés sur le nombre prévu. Vous pouvez affecter plusieurs extras à plusieurs événements en une fois.',
        ],
      },
      {
        title: 'Le lien de mission',
        body: [
          'Chaque extra a un lien personnel. Il l’ouvre sans compte et y trouve ses missions à venir : le type d’événement, la date, son heure d’arrivée, le lieu et l’itinéraire, le nombre d’invités et vos consignes.',
          'Vous lui envoyez ses missions par email depuis WeboDevis. Depuis son lien, il les accepte ou les refuse, et vous indique les dates où il n’est pas disponible. Pour le jour J, les fiches de mission s’impriment, une page par extra.',
        ],
      },
      {
        title: 'Le contrat d’extra et la DPAE',
        body: [
          'Pour chaque mission, WeboDevis prépare le contrat de l’extra, que vous relisez et modifiez. Il part par email avec un lien de signature : l’extra le signe en ligne, au doigt ou à la souris, et la signature est horodatée. S’il a signé sur papier, vous le notez.',
          'La fiche DPAE de la mission reprend les informations dans l’ordre du formulaire de l’Urssaf, avec un bouton pour copier chacune. Vous déclarez sur le site de l’Urssaf, vous cochez « DPAE faite » et vous notez le numéro de l’accusé de réception. Des alertes vous préviennent quand l’échéance approche.',
        ],
      },
      {
        title: 'Heures faites et paie',
        body: [
          'Chaque extra a son taux horaire habituel. Après l’événement, vous notez les heures faites : l’onglet Extras de l’événement donne le total des heures et le coût du personnel, repris dans la marge du devis.',
          'La page « Heures et paie » récapitule le mois, extra par extra, avec le détail par événement, et s’exporte en CSV pour votre comptable ou votre gestionnaire de paie.',
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
      { q: 'L’extra peut-il confirmer sa présence depuis son lien ?', a: 'Oui. Il accepte ou refuse la mission depuis sa page, sans compte. Il peut aussi revenir sur un refus, et indiquer les dates où il n’est pas disponible.' },
      { q: 'WeboDevis fait-il la DPAE à ma place ?', a: 'Non. WeboDevis prépare les informations dans l’ordre du formulaire et vous rappelle l’échéance, mais c’est vous qui déclarez sur le site de l’Urssaf. Vous notez ensuite le numéro de l’accusé de réception sur la mission.' },
      { q: 'Le modèle de contrat est-il prêt à l’emploi ?', a: 'C’est une base à adapter à votre situation. Faites-la valider par votre expert-comptable ou votre juriste avant de l’utiliser.' },
      { q: 'WeboDevis calcule-t-il le coût des extras ?', a: 'Oui. Les heures faites multipliées par le taux horaire de chaque extra donnent le coût du personnel de l’événement, repris dans la marge du devis.' },
    ],
    related: ['evenements', 'equipe', 'calendrier', 'suivi-financier'],
    guide: 'checklist-evenement-traiteur',
    updated: '2026-11-10',
  }),

  feature({
    slug: 'stock-et-fournisseurs',
    icon: 'boxes',
    label: 'Stock et fournisseurs',
    blurb: 'Réserve, fournisseurs et commandes.',
    group: 'pendant',
    metaTitle: 'Gestion de stock et commandes du traiteur | WeboDevis',
    description: 'Le stock du traiteur par ingrédient, avec seuil d’alerte, vos fournisseurs et les commandes envoyées par email. Une commande reçue remet le stock à jour.',
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
          '« Envoyer au fournisseur » lui adresse le bon par email, avec votre message, une date de livraison si vous le souhaitez et une copie pour vous. Ses réponses vous arrivent directement. Quand vous marquez la commande comme reçue, les quantités commandées s’ajoutent au stock.',
        ],
      },
      {
        title: 'La sortie de stock d’un événement',
        body: [
          'Depuis la liste de courses d’un événement, « Retirer du stock » sort les ingrédients suivis en stock, une seule fois par événement. Une erreur ? « Annuler la sortie » les remet.',
        ],
      },
    ],
    faqs: [
      { q: 'La commande est-elle envoyée au fournisseur par WeboDevis ?', a: 'Oui, si vous le souhaitez : « Envoyer au fournisseur » lui adresse le bon de commande par email et passe la commande à « Envoyée ». Vous pouvez aussi l’imprimer et la transmettre vous-même.' },
      { q: 'Le stock baisse-t-il tout seul après un événement ?', a: 'Pas sans vous : « Retirer du stock », depuis la liste de courses de l’événement, sort les ingrédients en une fois. Les autres sorties se saisissent à la main.' },
      { q: 'Puis-je importer ma liste d’ingrédients ?', a: 'Oui, depuis un fichier CSV qui indique la catégorie, le nom et l’unité de chaque ingrédient.' },
    ],
    related: ['liste-de-courses', 'evenements', 'suivi-financier'],
    guide: 'liste-de-courses-evenement',
    updated: '2026-11-10',
  }),

  feature({
    slug: 'calendrier',
    icon: 'calendar-days',
    label: 'Calendrier',
    blurb: 'Devis en cours et événements, mois par mois.',
    group: 'quotidien',
    metaTitle: 'Calendrier d’événements pour traiteur | WeboDevis',
    description: 'Le calendrier du traiteur : événements, devis en cours et dégustations sur une grille, alerte sur les journées chargées, abonnement Google Agenda ou Outlook.',
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
      {
        title: 'Les dégustations',
        body: [
          'Vous planifiez une dégustation depuis le devis, déjà rempli, ou depuis l’agenda, où elle a sa propre couleur. Votre client reçoit une confirmation avec l’invitation à ajouter à son agenda, puis un email s’il y a un changement d’horaire ou une annulation.',
          'Un rappel lui est envoyé trois jours avant, et un autre la veille. Vous pouvez couper les rappels d’une dégustation, puis la marquer faite ou l’annuler.',
        ],
      },
      {
        title: 'Dans votre agenda habituel',
        body: [
          'Depuis vos paramètres, vous créez une adresse d’abonnement : Google Agenda, Apple Calendrier ou Outlook y affichent vos événements confirmés et vos dégustations, sur les douze prochains mois, mis à jour d’eux-mêmes.',
        ],
      },
    ],
    faqs: [
      { q: 'Puis-je synchroniser le calendrier avec mon agenda ?', a: 'Oui, dans un sens : vous abonnez Google Agenda, Apple Calendrier ou Outlook à l’adresse que vous donne WeboDevis, et vos événements y apparaissent. Ce que vous ajoutez dans ces agendas ne revient pas dans WeboDevis.' },
      { q: 'Mon client est-il prévenu de la dégustation ?', a: 'Oui. Il reçoit une confirmation avec l’invitation pour son agenda, puis un rappel trois jours avant et la veille, sauf si vous coupez les rappels.' },
      { q: 'Les devis refusés apparaissent-ils ?', a: 'Non. La grille montre les événements confirmés et les devis en cours, pas ceux qui ont été refusés.' },
      { q: 'Y a-t-il une vue à la semaine ?', a: 'Le calendrier est mensuel. Pour l’équipe, la page des extras propose un agenda sur huit semaines.' },
    ],
    related: ['evenements', 'devis-traiteur', 'extras'],
    updated: '2026-11-10',
  }),

  feature({
    slug: 'suivi-financier',
    icon: 'trending-up',
    label: 'Suivi financier',
    blurb: 'Coûts, marge et chiffre d’affaires.',
    group: 'quotidien',
    metaTitle: 'Calcul de marge traiteur, devis par devis | WeboDevis',
    description: 'Chiffre d’affaires, coûts et marge brute de chaque devis, avec le coût matière tiré de la recette et le coût des extras. Et un tableau de bord de l’activité.',
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
          'Le coût matière d’une prestation se calcule à partir de sa recette : les ingrédients, leur quantité et leur prix, avec le détail ligne par ligne. « Utiliser ce coût » l’enregistre dans votre catalogue, avec le coefficient et le taux de marge. Vous pouvez aussi saisir le coût vous-même.',
          'Le coût du personnel vient des heures faites par vos extras, multipliées par leur taux horaire. Le transport, la location et le reste s’ajoutent en frais additionnels. La synthèse donne la marge brute, poste par poste.',
        ],
      },
      {
        title: 'Le tableau de bord',
        body: [
          'À l’ouverture de l’application : le chiffre d’affaires du mois, du trimestre ou de l’année, la marge estimée, le panier moyen, les couverts à venir, les devis en cours et le taux de conversion. En dessous, les prochains événements, le chiffre d’affaires sur six mois et la répartition des devis par étape.',
        ],
      },
    ],
    faqs: [
      { q: 'Le coût de revient est-il calculé à partir des ingrédients ?', a: 'Oui, si la prestation a sa recette : WeboDevis additionne le prix de ses ingrédients selon leur quantité. Un ingrédient sans prix, ou dans une unité qui ne se convertit pas, est signalé et laissé hors du total.' },
      { q: 'WeboDevis suit-il les acomptes et les paiements ?', a: 'Oui, par les factures. Vous facturez l’acompte puis le solde depuis le devis, et vous enregistrez chaque paiement reçu. Quand l’acompte est réglé, le devis passe à « Acompte reçu » ; quand le solde l’est, à « Payé ».' },
      { q: 'Le coût des extras et de la location est-il repris automatiquement ?', a: 'Celui des extras, oui : leurs heures faites multipliées par leur taux horaire. La location et le transport s’ajoutent en frais additionnels sur la fiche « Marge et coûts » du devis.' },
    ],
    related: ['devis-traiteur', 'facturation', 'extras', 'stock-et-fournisseurs'],
    guide: 'calculer-marge-traiteur',
    updated: '2026-11-10',
  }),

  feature({
    slug: 'facturation',
    icon: 'receipt',
    label: 'Factures',
    blurb: 'Acompte, solde, avoir et paiements, depuis le devis.',
    group: 'quotidien',
    metaTitle: 'Logiciel de facturation traiteur : acompte, solde | WeboDevis',
    description: 'Facturez depuis le devis : acompte, solde qui déduit les acomptes, avoir. Numérotation continue, TVA par taux, paiements, relances et export CSV ou FEC.',
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
          'Si vous les activez, les relances des factures échues partent toutes seules, trois au plus, avec le reste à payer et votre IBAN. Chaque facture émise se télécharge en PDF au format Factur-X.',
        ],
      },
      {
        title: 'L’export pour le comptable',
        body: [
          '« Export comptable » prépare un fichier sur le mois, le trimestre, l’année ou les dates de votre choix. En CSV, à ouvrir dans un tableur : les factures et avoirs avec le HT, la TVA par taux, le TTC, le payé et le reste dû, ou bien les paiements reçus.',
          'Au format FEC, le fichier des écritures comptables, avec le journal des ventes et celui de la banque. Vos numéros de comptes et vos codes de journaux se règlent dans les paramètres, et un bouton remet les comptes standards.',
        ],
      },
    ],
    faqs: [
      { q: 'Puis-je modifier une facture déjà émise ?', a: 'Non. Une facture émise est figée. Pour la corriger, vous établissez un avoir qui l’annule, puis une nouvelle facture. Tant qu’elle est en brouillon, en revanche, tout se modifie et elle peut être supprimée.' },
      { q: 'Comment le solde tient-il compte des acomptes ?', a: 'La facture de solde reprend toutes les lignes du devis, puis déduit chaque facture d’acompte déjà émise, avec son numéro, taux de TVA par taux de TVA.' },
      { q: 'Je suis en franchise de TVA : comment sont faites mes factures ?', a: 'Vous cochez la franchise en base dans vos paramètres. Vos factures sont alors établies sans TVA et portent la mention « TVA non applicable, art. 293 B du CGI ».' },
      { q: 'WeboDevis remplace-t-il mon logiciel de comptabilité ?', a: 'Non. WeboDevis établit vos factures et suit leurs paiements. L’export CSV ou FEC et les PDF Factur-X se transmettent à votre comptable ou s’importent dans votre logiciel comptable.' },
    ],
    related: ['facture-electronique', 'devis-traiteur', 'suivi-financier'],
    guide: 'facture-electronique-traiteur',
    updated: '2026-11-10',
  }),

  feature({
    slug: 'facture-electronique',
    icon: 'file-check',
    label: 'Facture électronique',
    blurb: 'Le PDF Factur-X aujourd’hui, la plateforme agréée ensuite.',
    group: 'quotidien',
    metaTitle: 'Facture électronique pour traiteur, Factur-X | WeboDevis',
    description: 'Vos factures au format Factur-X : un PDF/A-3 avec les données en XML, profil EN 16931. Ce qui est prêt pour la réforme, et ce qui est prévu.',
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
        title: 'Ma journée, même sans réseau',
        body: [
          'La page « Ma journée » rassemble les événements confirmés du jour et du lendemain : contacts, lieu et itinéraire, nombre de couverts, déroulé, équipe, production et allergènes. Elle reste lisible sans réseau, dans une salle de réception mal couverte ou une cuisine en sous-sol.',
          'Hors connexion, elle montre la dernière version enregistrée sur l’appareil, avec son heure. Il faut l’avoir ouverte une fois avec du réseau sur ce téléphone. Le reste de l’application a besoin d’une connexion.',
        ],
      },
    ],
    faqs: [
      { q: 'WeboDevis est-il disponible sur l’App Store ou Google Play ?', a: 'Non. C’est une application web : vous l’ouvrez dans votre navigateur et vous l’ajoutez à l’écran d’accueil, sans passer par un magasin d’applications.' },
      { q: 'L’application fonctionne-t-elle hors connexion ?', a: 'En partie. « Ma journée », la page des événements du jour et du lendemain, se consulte sans réseau, en lecture. Le reste de l’application a besoin d’une connexion pour charger et enregistrer vos données.' },
      { q: 'Reçoit-on des notifications sur le téléphone ?', a: 'Les notifications s’affichent dans l’application, sous la cloche. La version 0.1 n’envoie pas de notifications sur l’écran verrouillé du téléphone.' },
    ],
    related: ['liste-de-courses', 'devis-traiteur', 'evenements'],
    updated: '2026-11-10',
  }),

  feature({
    slug: 'brochures-traiteur',
    icon: 'book-open',
    label: 'Brochures',
    blurb: 'Votre carte en brochure feuilletable, qui ramène des demandes.',
    group: 'avant',
    metaTitle: 'Brochure traiteur en ligne, feuilletable | WeboDevis',
    description: 'La brochure de votre maison, faite depuis le catalogue : un lien feuilletable sur téléphone, un formulaire de demande en fin, PDF, QR code et Instagram.',
    keyword: 'brochure traiteur',
    h1: 'La brochure du traiteur, feuilletable et reliée à vos devis',
    lead: 'Votre carte devient une brochure qui se feuillette en ligne, sur le téléphone comme sur l’ordinateur. Vos prestations viennent du catalogue, à jour de leurs prix et de leurs photos, et la dernière page est un formulaire de demande qui arrive dans vos prospects.',
    preview: 'brochure',
    highlights: [
      'Une brochure faite à partir de votre catalogue, toujours à jour.',
      'Un formulaire de demande en dernière page.',
      'Un lien par client ou par source, et vous savez qui l’a ouvert.',
    ],
    sections: [
      {
        title: 'À partir de votre catalogue',
        body: [
          'Vous choisissez les prestations à présenter : elles arrivent avec leur description, leur photo et leur prix, et restent liées au catalogue. Un prix qui change dans le catalogue change aussi dans la brochure. Vous pouvez retoucher le texte ou la photo d’une prestation pour la brochure seulement, et masquer un prix ou tous.',
          'Les prix s’affichent hors taxes ou toutes taxes comprises, par personne, avec le prix enfant s’il y en a un. Une page « Qui sommes-nous » et une page contact complètent la brochure.',
        ],
      },
      {
        title: 'Trois façons de la mettre en page',
        body: [
          'L’éditeur simple compose les pages tout seul, dans l’un des trois styles : Éditorial, Carte ou Magazine. L’éditeur avancé vous laisse assembler des pages de blocs : prestations, titres, textes, images, colonnes.',
          'Le Studio compose chaque page A4 librement : textes, photos, formes, pictogrammes, vidéo, QR code. Il propose des modèles de pages et trois brochures prêtes à adapter (mariage, entreprise, cocktail), cinq thèmes de couleurs, l’annulation et des versions enregistrées pour revenir en arrière.',
        ],
        points: [
          'Photos cadrées sur le point qui compte, sans toucher au fichier d’origine',
          'Des modèles de pages partagés par toute votre entreprise',
          'Les commentaires et la validation d’une brochure entre collègues',
        ],
      },
      {
        title: 'Un lien qui se feuillette',
        body: [
          'Votre client ouvre la brochure sans compte. Sur ordinateur, elle se lit comme un livre, en double page. Sur téléphone, une page à la fois, en glissant du doigt.',
          'Vous l’envoyez par email depuis WeboDevis, notamment à un prospect, dont la demande passe alors à « Brochure envoyée ». Vous pouvez créer un lien par client, avec un message d’accueil à son nom, ou un lien par source : votre site, Instagram, un salon du mariage. Chaque lien compte ses ouvertures et ses demandes.',
        ],
        points: [
          'Une date d’expiration et un code d’accès, si vous le souhaitez',
          'Dans le Studio, la lecture page par page : vues et temps passé',
          'Un aperçu soigné quand le lien est partagé dans une messagerie',
        ],
      },
      {
        title: 'De la brochure au devis',
        body: [
          'La dernière page est un formulaire de demande : coordonnées, type d’événement, date, nombre d’invités, lieu, message. La demande arrive dans vos prospects, avec la brochure et le lien d’où elle vient. Vous recevez un email, et votre client un accusé de réception.',
          'Dans le Studio, votre client peut aussi cocher les prestations qui lui plaisent avec « Je veux ce menu » et voir une estimation, calculée sur le nombre d’invités. Quand vous transformez sa demande en devis, ses prestations deviennent les lignes du devis.',
        ],
      },
      {
        title: 'Partout où vous communiquez',
        body: [
          'Le Studio exporte la brochure en PDF au format A4, à imprimer ou à joindre. Il en tire aussi des images pour Instagram : publication, story ou carré. Chaque lien a son QR code, à télécharger pour vos cartes de visite et vos salons, et la brochure s’intègre dans une page de votre site.',
          'Une version anglaise se fait en un clic, avec la même mise en page, pour vos clients étrangers.',
        ],
      },
    ],
    faqs: [
      { q: 'Mon client doit-il télécharger un fichier ?', a: 'Non. Il ouvre un lien et feuillette la brochure dans son navigateur, sur téléphone ou sur ordinateur. Si vous préférez un fichier, le Studio l’exporte en PDF.' },
      { q: 'Les prix de la brochure suivent-ils ceux de mon catalogue ?', a: 'Oui. Les prestations restent liées au catalogue : un prix ou une photo changés y sont repris. Vous pouvez aussi masquer les prix, prestation par prestation ou pour toute la brochure.' },
      { q: 'Mon client peut-il signer ou payer depuis la brochure ?', a: 'Non. La brochure sert à présenter votre carte et à recevoir une demande. La signature se fait ensuite sur le devis, depuis son propre lien.' },
      { q: 'Toutes les fonctions sont-elles dans les trois éditeurs ?', a: 'Non. Le PDF, les images pour Instagram, « Je veux ce menu », les versions, les commentaires et les statistiques de lecture page par page sont propres au Studio.' },
    ],
    related: ['demandes-de-devis', 'devis-traiteur', 'assistant-webo'],
    updated: '2026-11-10',
  }),

  feature({
    slug: 'assistant-webo',
    icon: 'sparkles',
    label: 'Webo, l’assistant',
    blurb: 'Demandez, Webo prépare, vous validez.',
    group: 'quotidien',
    metaTitle: 'Webo, l’assistant IA du traiteur | WeboDevis',
    description: 'Webo prépare vos devis, relances, événements et factures à partir d’une phrase, d’une dictée ou d’une photo. Rien n’est enregistré sans votre validation.',
    keyword: 'assistant IA traiteur',
    h1: 'Webo, l’assistant qui prépare le travail',
    lead: 'Vous écrivez, vous dictez ou vous envoyez une photo. Webo prépare le devis, la relance, la checklist ou la facture, et vous la présente. Rien ne part et rien ne s’enregistre tant que vous n’avez pas validé.',
    preview: 'webo',
    highlights: [
      '« Fais un devis pour le mariage de Camille, 120 couverts, formule Prestige. »',
      'Chaque action vous est proposée : vous validez, vous modifiez ou vous annulez.',
      'Une photo d’un menu ou d’un ancien devis, et Webo en tire les lignes.',
    ],
    sections: [
      {
        title: 'Dans toute l’application',
        body: [
          'Une bulle, présente sur chaque page, ouvre Webo dans un panneau, en plein écran sur téléphone. Webo sait où vous êtes : « ce devis », « cet événement » ou « cette brochure » suffisent. La page Webo garde l’historique de vos conversations, rangé par date, avec une recherche.',
          'Vous écrivez votre demande, vous la dictez, ou vous joignez une photo : un menu, un ancien devis. Vous pouvez aussi coller le mail ou le SMS d’un client.',
        ],
      },
      {
        title: 'Ce que Webo sait faire',
        body: [
          'Webo travaille sur tout le logiciel, avec vos données : votre catalogue, vos prix, vos clients, vos devis passés.',
        ],
        points: [
          'Devis : créer, modifier, changer l’apparence, envoyer, relancer ceux qui attendent une réponse',
          'Événements : checklist, matériel, déroulé, extras à affecter, liste de courses',
          'Clients et prospects : fiches, notes, réponse à une demande, envoi d’une brochure',
          'Stock et commandes fournisseurs, factures et paiements, brochures',
          '« Ma journée » : l’urgent d’abord, puis ce qui manque aux prochains événements',
          'L’aide : comment faire, d’après les guides du centre d’aide',
        ],
      },
      {
        title: 'Rien sans votre accord',
        body: [
          'Webo ne fait que proposer. Chaque action prend la forme d’une carte, avec trois boutons : Valider, Modifier, Annuler. Seule la validation écrit dans vos données ou envoie un email, et Webo revérifie au même moment que rien n’a changé entre-temps.',
          'Webo n’invente ni prix, ni client, ni prestation. S’il lui manque une information, il vous pose la question. Une facture qu’il prépare reste en brouillon tant que vous ne demandez pas de l’émettre.',
        ],
      },
      {
        title: 'Il retient vos habitudes',
        body: [
          'Quand vous validez une proposition, Webo peut retenir une habitude : « l’acompte est toujours à 40 % », par exemple. Vous voyez ce qu’il retient, et vous l’effacez, dans vos paramètres. Il retrouve aussi vos devis passés : « fais comme pour le mariage Roussel ».',
        ],
      },
      {
        title: 'Les WeboCoins',
        body: [
          'Webo fonctionne avec des WeboCoins, la monnaie de l’application. Chaque mois, votre entreprise reçoit des pièces, et chaque réponse en consomme selon le travail demandé. Votre solde et le détail de vos dépenses se consultent dans vos paramètres.',
          'Pour traduire vos prestations en anglais, vous choisissez entre la traduction de Webo et une traduction gratuite.',
        ],
      },
    ],
    faqs: [
      { q: 'Webo peut-il envoyer un devis sans que je le voie ?', a: 'Non. Webo prépare l’envoi et vous le présente. L’email ne part que quand vous avez cliqué sur « Valider ».' },
      { q: 'Webo connaît-il mes prix ?', a: 'Oui : il les prend dans votre catalogue. Une prestation qui n’y figure pas arrive dans le devis sans prix, pour que vous le fixiez.' },
      { q: 'Puis-je lui parler au lieu d’écrire ?', a: 'Oui, si votre navigateur prend en charge la reconnaissance vocale : un bouton micro apparaît alors à côté du champ de message.' },
      { q: 'Webo est-il disponible dans la démonstration ?', a: 'Non. La démonstration montre le logiciel sans Webo.' },
    ],
    related: ['devis-traiteur', 'evenements', 'brochures-traiteur'],
    updated: '2026-11-10',
  }),

  feature({
    slug: 'equipe',
    icon: 'users-round',
    label: 'Équipe',
    blurb: 'Vos collaborateurs, chacun avec son rôle.',
    group: 'quotidien',
    metaTitle: 'Logiciel traiteur multi-utilisateurs | WeboDevis',
    description: 'Invitez vos collaborateurs en gérant, collaborateur ou consultation. Toute l’entreprise partage devis, clients, catalogue, stock, extras et commandes.',
    keyword: 'logiciel traiteur multi-utilisateurs',
    h1: 'Toute l’équipe sur le même logiciel',
    lead: 'Vous invitez vos collaborateurs par email, chacun avec son rôle. Les devis, les clients, le catalogue, le stock et les extras sont partagés : chacun voit ce qui le concerne, à jour.',
    preview: 'equipe',
    highlights: [
      'Une invitation par email, un rôle par personne.',
      'Un catalogue, un stock, un fichier clients pour toute l’entreprise.',
      'Les documents aux couleurs de votre maison, quel que soit l’auteur.',
    ],
    sections: [
      {
        title: 'Inviter un collaborateur',
        body: [
          'Depuis les paramètres, vous invitez une personne par son email. Elle reçoit un lien, valable sept jours, crée son accès et rejoint votre entreprise. Si quelqu’un s’en va, vous retirez son accès : ce qu’il a créé reste dans l’entreprise.',
        ],
      },
      {
        title: 'Trois rôles',
        body: [
          'Le titulaire du compte a tous les droits. Pour les autres, vous choisissez le rôle.',
        ],
        points: [
          'Gérant : tout, y compris inviter et retirer des personnes',
          'Collaborateur : devis, événements, catalogue et factures, sans les réglages de l’entreprise ni l’équipe',
          'Consultation : voit tout, ne modifie rien',
        ],
      },
      {
        title: 'Ce qui est partagé',
        body: [
          'Toute l’entreprise travaille sur les mêmes données : devis, clients, fournisseurs, catalogue, ingrédients et recettes, stock, commandes, extras, matériel et modèles. Les devis et les factures portent le logo, les conditions générales et les mentions légales de l’entreprise, quel que soit celui qui les a faits.',
          'L’historique de chaque devis dit qui a fait quoi : création, changements de statut, envois.',
        ],
      },
    ],
    faqs: [
      { q: 'Combien de personnes puis-je inviter ?', a: 'Le nombre de places dépend de votre abonnement. Demandez-nous une proposition en indiquant la taille de votre équipe.' },
      { q: 'Un collaborateur voit-il les réglages de l’entreprise ?', a: 'Non. Les réglages et l’équipe sont réservés au titulaire et aux gérants.' },
      { q: 'Mes extras ont-ils besoin d’un accès ?', a: 'Non. Les extras ne sont pas des membres de l’équipe : ils reçoivent leurs missions sur un lien personnel, sans compte.' },
    ],
    related: ['extras', 'devis-traiteur', 'assistant-webo'],
    updated: '2026-11-10',
  }),
];

/** Les étapes du métier, dans l'ordre du menu. */
export const FEATURE_GROUPS: { id: FeatureGroupId; title: string; slugs: string[] }[] = [
  { id: 'avant', title: 'Avant l’événement', slugs: ['brochures-traiteur', 'demandes-de-devis', 'devis-traiteur', 'signature-devis-en-ligne', 'clients'] },
  { id: 'pendant', title: 'Pendant la préparation', slugs: ['evenements', 'liste-de-courses', 'allergenes', 'extras', 'stock-et-fournisseurs'] },
  { id: 'quotidien', title: 'Au quotidien', slugs: ['assistant-webo', 'calendrier', 'suivi-financier', 'facturation', 'facture-electronique', 'equipe', 'application-mobile'] },
];

export const featureBySlug = (slug: string) => FEATURES.find((f) => f.slug === slug);

/** Ce que fait le logiciel, en une ligne par fonction : repris dans les données structurées. */
export const FEATURE_LIST: string[] = FEATURES.map((f) => `${f.label} : ${f.blurb}`);
