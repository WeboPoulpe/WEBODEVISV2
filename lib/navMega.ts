import {
  FilePlus2, Library, UploadCloud, Send, UserPlus, Search, Link2, Inbox, CalendarPlus, CalendarRange, History,
  Printer, Plus, ShoppingBasket, Boxes, AlertTriangle, Percent, Carrot, CalendarDays, Truck, ListChecks, Wrench,
  PackageOpen, LayoutTemplate, FolderTree, Bell, Building2, Users, ClipboardList, Settings, FileText,
} from 'lucide-react';

// Mégamenu de la barre latérale : une entrée par page du menu (même `href` que dans components/layout/nav.ts).
// Chaque action mène à une page qui existe ; `?action=…` est lu par la page cible (lib/useUrlAction.ts)
// pour ouvrir la bonne fenêtre. Une action vers une page d'une option non activée disparaît d'elle-même.

export type NavPreviewKey = 'devis' | 'clients' | 'prospects' | 'calendrier' | 'evenements' | 'commandes' | 'stock' | 'extras';

export interface NavMegaAction {
  label: string;
  /** Une courte précision sous le libellé. */
  hint?: string;
  href: string;
  icon: React.ElementType;
}

export interface NavMegaEntry {
  /** Ce que l'on fait sur cette page, en une ou deux phrases. */
  summary: string;
  actions: NavMegaAction[];
  /** Aperçu vivant (server/navPreview.ts), chargé à l'ouverture du panneau. */
  preview?: NavPreviewKey;
  /** Raccourci clavier utile depuis cette page. */
  shortcut?: { keys: string[]; label: string };
}

const SEARCH_SHORTCUT = { keys: ['Ctrl', 'K'], label: 'Rechercher un devis, un client, une page' };

export const NAV_MEGA: Record<string, NavMegaEntry> = {
  '/': {
    summary: 'Ce qu’il faut faire aujourd’hui et cette semaine, trié par échéance, avec le chiffre d’affaires du mois et les prochains événements.',
    actions: [
      { label: 'Nouveau devis', hint: 'Événement, client, puis le document', href: '/devis/nouveau', icon: FilePlus2 },
      { label: 'Imprimer le à faire', hint: 'Une page A4 à cocher', href: '/tableau-de-bord/imprimer?auto', icon: Printer },
      { label: 'Notifications', hint: 'Tout ce qui s’est passé récemment', href: '/notifications', icon: Bell },
    ],
    preview: 'calendrier',
    shortcut: SEARCH_SHORTCUT,
  },
  '/devis': {
    summary: 'Tous vos devis, du premier contact au paiement. Suivez-les en liste ou en pipeline, rangez-les en dossiers et relancez ceux qui attendent.',
    actions: [
      { label: 'Nouveau devis', hint: 'Événement, client, puis le document', href: '/devis/nouveau', icon: FilePlus2 },
      { label: 'Partir d’un modèle', hint: 'Un devis déjà prêt, adapté aux couverts', href: '/devis?action=modeles', icon: Library },
      { label: 'Importer un devis', hint: 'Fait dans un autre logiciel', href: '/devis?action=importer', icon: UploadCloud },
      { label: 'Devis envoyés', hint: 'En attente de la réponse du client', href: '/devis?action=envoyes', icon: Send },
    ],
    preview: 'devis',
    shortcut: SEARCH_SHORTCUT,
  },
  '/clients': {
    summary: 'Les fiches de vos clients, particuliers et entreprises, avec leurs devis. Un client se retrouve à la création de chaque devis.',
    actions: [
      { label: 'Nouveau client', hint: 'Entreprise trouvée par nom ou SIRET', href: '/clients/nouveau', icon: UserPlus },
      { label: 'Importer des clients', hint: 'Un fichier CSV ou un copier-coller depuis Excel', href: '/clients?action=importer', icon: UploadCloud },
      { label: 'Rechercher un client', hint: 'Par nom ou adresse email', href: '/clients?action=rechercher', icon: Search },
    ],
    preview: 'clients',
  },
  '/prospects': {
    summary: 'Les demandes reçues par le formulaire de votre site. Une demande se transforme en devis en un clic, sans rien retaper.',
    actions: [
      { label: 'Demandes nouvelles', hint: 'Pas encore traitées', href: '/prospects?action=nouvelles', icon: Inbox },
      { label: 'Mon formulaire', hint: 'Le lien et le code à mettre sur votre site', href: '/prospects?action=formulaire', icon: Link2 },
    ],
    preview: 'prospects',
  },
  '/calendrier': {
    summary: 'Le mois en un coup d’œil : événements confirmés et devis en cours, jour par jour. Un jour libre se transforme en devis.',
    actions: [
      { label: 'Nouveau devis', hint: 'La date se choisit à la première étape', href: '/devis/nouveau', icon: CalendarPlus },
      { label: 'Liste des événements', hint: 'À venir et passés', href: '/evenements', icon: CalendarRange },
    ],
    preview: 'calendrier',
  },
  '/evenements': {
    summary: 'Vos devis confirmés, à préparer : checklist, matériel, courses, location et équipe d’extras, événement par événement.',
    actions: [
      { label: 'Imprimer le à faire', hint: 'Préparations et échéances sur une page', href: '/tableau-de-bord/imprimer?auto', icon: Printer },
      { label: 'Courses de la période', hint: 'Toutes les listes additionnées', href: '/courses-globales', icon: ShoppingBasket },
      { label: 'Location de la période', hint: 'Un bon par loueur', href: '/location-globale', icon: PackageOpen },
      { label: 'Événements passés', hint: 'Les plus récents d’abord', href: '/evenements?action=passes', icon: History },
    ],
    preview: 'evenements',
  },
  '/commandes': {
    summary: 'Les bons de commande à vos fournisseurs : préparés, envoyés, puis reçus. À la réception, les quantités entrent dans le stock.',
    actions: [
      { label: 'Nouvelle commande', hint: 'Choisir le fournisseur et les ingrédients', href: '/commandes?action=nouveau', icon: Plus },
      { label: 'Stock bas', hint: 'Les ingrédients sous le seuil', href: '/stock?action=alertes', icon: AlertTriangle },
      { label: 'Fournisseurs', href: '/fournisseurs', icon: Truck },
    ],
    preview: 'commandes',
  },
  '/stock': {
    summary: 'Ce qu’il vous reste de chaque ingrédient. Entrées et sorties s’enregistrent en deux gestes ; une alerte prévient sous le seuil.',
    actions: [
      { label: 'Articles sous le seuil', hint: 'À commander', href: '/stock?action=alertes', icon: AlertTriangle },
      { label: 'Nouvelle commande', hint: 'Bon de commande fournisseur', href: '/commandes?action=nouveau', icon: ShoppingBasket },
      { label: 'Ingrédients', hint: 'Seuils et prix d’achat', href: '/ingredients', icon: Carrot },
    ],
    preview: 'stock',
  },
  '/prestations': {
    summary: 'Votre carte : plats, formules et services, avec prix et composition. Ce sont les lignes que vous ajoutez à vos devis.',
    actions: [
      { label: 'Nouvelle prestation', hint: 'Avec photo et aperçu fidèle', href: '/prestations/nouvelle', icon: Plus },
      { label: 'Réviser les prix', hint: 'Une hausse en pourcentage, arrondie', href: '/prestations?action=reviser', icon: Percent },
      { label: 'Importer un CSV', hint: 'Votre carte depuis un tableur', href: '/prestations?action=importer', icon: UploadCloud },
      { label: 'Mes catégories', hint: 'Pour ranger la carte', href: '/parametres/categories', icon: FolderTree },
    ],
  },
  '/ingredients': {
    summary: 'Les produits qui entrent dans vos prestations, avec leur unité, leur prix et leur fournisseur. Ils font les listes de courses.',
    actions: [
      { label: 'Nouvel ingrédient', href: '/ingredients?action=nouveau', icon: Plus },
      { label: 'Importer un CSV', hint: 'Catégorie, nom, unité', href: '/ingredients?action=importer', icon: UploadCloud },
      { label: 'Stock', hint: 'Quantités et alertes', href: '/stock', icon: Boxes },
    ],
  },
  '/extras': {
    summary: 'Votre équipe en extra : serveurs, cuisiniers, plongeurs. Affectez-les aux événements, chacun reçoit le lien de sa mission.',
    actions: [
      { label: 'Nouvel extra', hint: 'Nom, rôle, téléphone', href: '/extras?action=nouveau', icon: UserPlus },
      { label: 'Agenda des extras', hint: 'Qui travaille quand', href: '/extras?action=agenda', icon: CalendarDays },
      { label: 'Événements à venir', hint: 'Assigner l’équipe dans l’onglet Extras', href: '/evenements', icon: CalendarRange },
    ],
    preview: 'extras',
  },
  '/fournisseurs': {
    summary: 'Vos grossistes et vos loueurs, avec leurs coordonnées. Ils sont repris dans les ingrédients, les courses, la location et les commandes.',
    actions: [
      { label: 'Nouveau fournisseur', href: '/fournisseurs?action=nouveau', icon: Plus },
      { label: 'Nouvelle commande', hint: 'Bon de commande fournisseur', href: '/commandes?action=nouveau', icon: ShoppingBasket },
    ],
  },
  '/materiel': {
    summary: 'Le matériel que vous possédez : chafing dish, caisses isothermes, bacs gastro. Il se coche ensuite pour chaque événement.',
    actions: [
      { label: 'Depuis la liste de base', hint: 'Cochez ce que vous avez', href: '/materiel?action=liste-de-base', icon: ListChecks },
      { label: 'Modèles de matériel', hint: 'Cocktail, dîner assis…', href: '/materiel?action=modeles', icon: LayoutTemplate },
      { label: 'Modèles de location', hint: 'La vaisselle louée selon les couverts', href: '/location-templates', icon: Wrench },
    ],
  },
  '/location-globale': {
    summary: 'Additionnez le matériel à louer pour vos événements confirmés sur une période, et sortez un bon par loueur.',
    actions: [
      { label: 'Modèles de location', hint: 'Ce qui se loue selon les couverts', href: '/location-templates', icon: Wrench },
      { label: 'Fournisseurs', hint: 'Vos loueurs', href: '/fournisseurs', icon: Truck },
    ],
  },
  '/courses-globales': {
    summary: 'Additionnez les listes de courses de vos événements confirmés sur une période, fournisseur par fournisseur, prêtes à imprimer.',
    actions: [
      { label: 'Événements à venir', hint: 'La liste de courses de chacun', href: '/evenements', icon: CalendarRange },
      { label: 'Ingrédients', hint: 'Unités et fournisseurs', href: '/ingredients', icon: Carrot },
      { label: 'Commandes', hint: 'Commander chez le fournisseur', href: '/commandes', icon: ClipboardList },
    ],
  },
  '/parametres': {
    summary: 'L’identité de votre entreprise, votre logo et vos conditions générales de vente : tout ce qui apparaît sur vos devis.',
    actions: [
      { label: 'Styles de devis', hint: 'La présentation par défaut', href: '/modeles', icon: LayoutTemplate },
      { label: 'Mes catégories', hint: 'Le rangement de la carte', href: '/parametres/categories', icon: FolderTree },
      { label: 'Notifications', href: '/notifications', icon: Bell },
    ],
  },
  '/parametres/categories': {
    summary: 'Les catégories qui rangent votre catalogue de prestations. Celles fournies avec l’app restent ; vous ajoutez les vôtres.',
    actions: [
      { label: 'Nouvelle catégorie', href: '/parametres/categories?action=nouveau', icon: Plus },
      { label: 'Prestations', hint: 'Votre carte', href: '/prestations', icon: FileText },
    ],
  },
  '/modeles': {
    summary: 'La présentation proposée à chaque nouveau devis. Un devis peut toujours changer de style dans l’éditeur.',
    actions: [
      { label: 'Nouveau devis', href: '/devis/nouveau', icon: FilePlus2 },
      { label: 'Logo et CGV', hint: 'Dans Mon entreprise', href: '/parametres', icon: Building2 },
    ],
  },
  '/location-templates': {
    summary: 'Un modèle par type de réception : assiettes, verres, nappes. Dans un événement, la location se calcule d’après le nombre de couverts.',
    actions: [
      { label: 'Nouveau modèle', href: '/location-templates?action=nouveau', icon: Plus },
      { label: 'Location de la période', hint: 'Un bon par loueur', href: '/location-globale', icon: PackageOpen },
    ],
  },
  '/admin': {
    summary: 'L’administration de WeboDevis : comptes des traiteurs, options, demandes reçues et réglages du site.',
    actions: [
      { label: 'Comptes', hint: 'Options et accès', href: '/admin/comptes', icon: Users },
      { label: 'Demandes', hint: 'Contacts reçus par le site', href: '/admin/demandes', icon: Inbox },
      { label: 'Réglages', href: '/admin/reglages', icon: Settings },
    ],
  },
};

/** Page d'une adresse d'action, sans paramètres : « /devis?action=x » → « /devis ». */
export const actionPath = (href: string) => href.split(/[?#]/)[0];
