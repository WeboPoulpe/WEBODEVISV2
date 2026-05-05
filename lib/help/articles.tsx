import {
  Rocket, FileText, Users, CalendarRange, Boxes, Package, Settings,
  type LucideIcon,
} from 'lucide-react';

export type HelpCategoryId =
  | 'demarrer'
  | 'devis'
  | 'clients'
  | 'evenements'
  | 'stock'
  | 'catalogue'
  | 'compte';

export interface HelpCategory {
  id: HelpCategoryId;
  label: string;
  icon: LucideIcon;
  /** Tailwind gradient classes from-X to-Y */
  gradient: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'demarrer',   label: 'Démarrer',            icon: Rocket,        gradient: 'from-fuchsia-500 to-purple-600' },
  { id: 'devis',      label: 'Devis',               icon: FileText,      gradient: 'from-violet-500 to-indigo-600' },
  { id: 'clients',    label: 'Clients & Prospects', icon: Users,         gradient: 'from-blue-500 to-cyan-600' },
  { id: 'evenements', label: 'Événements',          icon: CalendarRange, gradient: 'from-emerald-500 to-teal-600' },
  { id: 'stock',      label: 'Stock & Ingrédients', icon: Boxes,         gradient: 'from-amber-500 to-orange-600' },
  { id: 'catalogue',  label: 'Catalogue',           icon: Package,       gradient: 'from-rose-500 to-pink-600' },
  { id: 'compte',     label: 'Compte & Paramètres', icon: Settings,      gradient: 'from-slate-500 to-gray-600' },
];

export interface HelpArticle {
  id: string;
  category: HelpCategoryId;
  title: string;
  description: string;
  keywords: string[];
  body: React.ReactNode;
}

// ── Reusable text helpers ───────────────────────────────────────────────────
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-gray-700 leading-relaxed">{children}</p>
);
const Step = ({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) => (
  <div className="flex gap-3">
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#9c27b0] text-white text-xs font-bold flex items-center justify-center">{n}</div>
    <div className="flex-1 pt-0.5">
      <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
      {children && <div className="text-sm text-gray-600 leading-relaxed space-y-1">{children}</div>}
    </div>
  </div>
);
const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
    <span className="text-amber-600 font-bold flex-shrink-0">💡</span>
    <p className="text-xs text-amber-900 leading-relaxed">{children}</p>
  </div>
);
const Code = ({ children }: { children: React.ReactNode }) => (
  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-[12px] font-mono">{children}</span>
);

// ── Articles ────────────────────────────────────────────────────────────────
export const HELP_ARTICLES: HelpArticle[] = [
  // ── DÉMARRER ──────────────────────────────────────────────────────────────
  {
    id: 'tour-app',
    category: 'demarrer',
    title: 'Visite guidée de WeboDevis',
    description: 'Comprendre l\'organisation de l\'app en 2 minutes',
    keywords: ['début', 'sidebar', 'navigation', 'menu', 'tour'],
    body: (
      <div className="space-y-3">
        <P>WeboDevis est organisé en 5 sections dans la sidebar :</P>
        <ul className="text-sm text-gray-700 space-y-2 pl-5 list-disc">
          <li><strong>Commerce</strong> — tableau de bord, devis, clients, prospects.</li>
          <li><strong>Production</strong> — calendrier, événements en cours, commandes fournisseurs.</li>
          <li><strong>Stock</strong> — niveaux d'ingrédients en temps réel + alertes.</li>
          <li><strong>Catalogue</strong> (déroulant) — prestations, ingrédients, extras, location, fournisseurs.</li>
          <li><strong>Paramètres</strong> (déroulant) — catégories, profil entreprise, modèles de devis.</li>
        </ul>
        <Tip>Le bouton <strong>?</strong> en bas à droite ouvre cette aide à tout moment, et reste visible quand tu navigues.</Tip>
      </div>
    ),
  },
  {
    id: 'premier-devis',
    category: 'demarrer',
    title: 'Créer mon premier devis en 3 minutes',
    description: 'Le parcours complet : client → prestations → envoi',
    keywords: ['premier', 'commencer', 'starter', 'tutoriel'],
    body: (
      <div className="space-y-4">
        <Step n={1} title="Crée le client (ou choisis-en un existant)">
          Onglet <strong>Clients → + Nouveau</strong>. Tu peux laisser des champs vides, seul le nom est obligatoire.
        </Step>
        <Step n={2} title="Crée le devis">
          Onglet <strong>Devis → + Nouveau</strong>. Sélectionne le client, le type d'événement, la date et le nombre de couverts.
        </Step>
        <Step n={3} title="Ajoute des prestations">
          Bouton <strong>+ Prestation</strong>. Tu peux choisir dans ton catalogue ou créer une ligne libre. Les sous-totaux et la TVA se calculent automatiquement.
        </Step>
        <Step n={4} title="Envoie au client">
          Clique sur <strong>Envoyer</strong> en haut à droite. Tu obtiens un PDF + un lien sécurisé pour le client.
        </Step>
        <Tip>Tu peux toujours dupliquer un devis existant pour gagner du temps : icône <Code>⋯</Code> sur la carte du devis → <strong>Dupliquer</strong>.</Tip>
      </div>
    ),
  },

  // ── DEVIS ─────────────────────────────────────────────────────────────────
  {
    id: 'creer-devis',
    category: 'devis',
    title: 'Créer un devis',
    description: 'Toutes les étapes de la création',
    keywords: ['nouveau devis', 'créer', 'ajouter'],
    body: (
      <div className="space-y-3">
        <P>Onglet <strong>Devis → + Nouveau</strong>. L'éditeur s'ouvre avec 5 panneaux dans la sidebar de gauche :</P>
        <ul className="text-sm text-gray-700 space-y-1 pl-5 list-disc">
          <li><strong>Client</strong> — qui reçoit le devis (sélection ou création rapide).</li>
          <li><strong>Prestations</strong> — ce qui est facturé.</li>
          <li><strong>Événement</strong> — date, lieu, nombre de couverts.</li>
          <li><strong>Style</strong> — police, couleurs, mise en forme.</li>
          <li><strong>Images</strong> — visuels ajoutés au PDF.</li>
        </ul>
        <P>Le devis est <strong>sauvegardé automatiquement</strong> à chaque modification.</P>
      </div>
    ),
  },
  {
    id: 'dupliquer-devis',
    category: 'devis',
    title: 'Dupliquer un devis',
    description: 'Repartir d\'un devis existant',
    keywords: ['copier', 'duplication', 'cloner'],
    body: (
      <div className="space-y-3">
        <P>Sur la liste des devis, clique sur l'icône <Code>⋯</Code> en haut à droite de la carte → <strong>Dupliquer</strong>.</P>
        <P>Tu peux choisir si tu veux copier le devis tel quel ou le sauvegarder comme <strong>modèle</strong> pour le réutiliser plusieurs fois.</P>
      </div>
    ),
  },
  {
    id: 'modeles-devis',
    category: 'devis',
    title: 'Utiliser des modèles de devis',
    description: 'Gagner du temps avec des structures pré-faites',
    keywords: ['template', 'modèle', 'gabarit'],
    body: (
      <div className="space-y-3">
        <P>Les modèles sont des squelettes de devis (prestations, mise en page, remarques) que tu peux instancier en un clic.</P>
        <Step n={1} title="Créer un modèle">Sauvegarde n'importe quel devis comme modèle via <Code>⋯ → Sauvegarder comme modèle</Code>.</Step>
        <Step n={2} title="L'utiliser">Sur la page Devis, clique sur <strong>Mes modèles</strong> → choisis-en un. Un nouveau devis pré-rempli est créé.</Step>
      </div>
    ),
  },
  {
    id: 'pipeline-statuts',
    category: 'devis',
    title: 'Statuts et pipeline',
    description: 'Brouillon, En attente, Envoyé, Accepté, Refusé',
    keywords: ['kanban', 'statut', 'workflow'],
    body: (
      <div className="space-y-3">
        <P>Chaque devis a un statut. Vue <strong>Pipeline</strong> (en haut de la liste) pour voir les colonnes Kanban et faire glisser les devis.</P>
        <ul className="text-sm text-gray-700 space-y-1 pl-5">
          <li><strong>Brouillon</strong> — pas encore envoyé.</li>
          <li><strong>En attente</strong> — relance à prévoir.</li>
          <li><strong>Envoyé</strong> — en attente de réponse client.</li>
          <li><strong>Accepté</strong> — devient un événement et apparaît dans le calendrier.</li>
          <li><strong>Refusé</strong> — distinction client / traiteur, masqué du calendrier.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'envoyer-devis',
    category: 'devis',
    title: 'Envoyer un devis au client',
    description: 'Lien sécurisé + PDF',
    keywords: ['envoi', 'mail', 'partager', 'lien'],
    body: (
      <div className="space-y-3">
        <P>Bouton <strong>Envoyer</strong> en haut à droite de l'éditeur. Deux options :</P>
        <ul className="text-sm text-gray-700 space-y-1 pl-5 list-disc">
          <li><strong>Lien sécurisé</strong> — le client clique, voit le devis dans son navigateur, peut accepter / refuser / poser une question.</li>
          <li><strong>PDF</strong> — téléchargeable, à joindre à un email manuel.</li>
        </ul>
      </div>
    ),
  },

  // ── CLIENTS & PROSPECTS ───────────────────────────────────────────────────
  {
    id: 'creer-client',
    category: 'clients',
    title: 'Créer un client',
    description: 'Fiche client minimale ou complète',
    keywords: ['contact', 'fiche', 'ajouter client'],
    body: (
      <div className="space-y-3">
        <P>Onglet <strong>Clients → + Nouveau</strong>. Seul le nom est obligatoire — tu peux compléter au fur et à mesure.</P>
        <P>Si tu crées un devis pour un nouveau client, tu peux aussi le créer <strong>à la volée</strong> directement depuis l'éditeur de devis.</P>
      </div>
    ),
  },
  {
    id: 'prospects',
    category: 'clients',
    title: 'Gérer les prospects entrants',
    description: 'Demandes de devis automatiques via formulaire',
    keywords: ['lead', 'demande', 'formulaire', 'inbound'],
    body: (
      <div className="space-y-3">
        <P>Les prospects sont des personnes qui ont rempli ton formulaire public. Tu peux le partager via un lien ou l'embarquer sur ton site.</P>
        <P>Statuts disponibles : <strong>Nouveau</strong>, <strong>RDV dégustation à venir</strong>, <strong>Brochure envoyée</strong>, <strong>Devis envoyé</strong>, <strong>Refus client</strong>, <strong>Refus traiteur</strong>.</P>
        <Tip>Le badge dans la sidebar compte les prospects "Nouveau" non traités. Une fois passés à un autre statut, le badge baisse.</Tip>
      </div>
    ),
  },

  // ── ÉVÉNEMENTS ────────────────────────────────────────────────────────────
  {
    id: 'evenement-fiche',
    category: 'evenements',
    title: 'Gérer un événement',
    description: 'Tout ce qu\'on peut faire après acceptation d\'un devis',
    keywords: ['fiche', 'préparation', 'event'],
    body: (
      <div className="space-y-3">
        <P>Quand un devis passe en <strong>Accepté</strong>, il devient un événement. Sa fiche contient :</P>
        <ul className="text-sm text-gray-700 space-y-1 pl-5 list-disc">
          <li><strong>Récap client + lieu + couverts</strong>.</li>
          <li><strong>Liste de courses</strong> (ingrédients calculés depuis les recettes).</li>
          <li><strong>Sheet financier</strong> — coûts réels post-événement vs prévisionnel.</li>
          <li><strong>Lien vers le devis</strong> original.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'calendrier',
    category: 'evenements',
    title: 'Lire le calendrier',
    description: 'Couleurs, capacité, filtres',
    keywords: ['agenda', 'planning', 'mois'],
    body: (
      <div className="space-y-3">
        <ul className="text-sm text-gray-700 space-y-1 pl-5 list-disc">
          <li><strong>Violet plein</strong> — événement accepté (confirmé).</li>
          <li><strong>Contour violet</strong> — brouillon / en attente / envoyé.</li>
          <li><strong>Rouge</strong> — capacité dépassée (300+ couverts cumulés sur la journée).</li>
        </ul>
        <P>Toggle <strong>Validés uniquement</strong> en haut à droite pour masquer les non-confirmés.</P>
        <Tip>Les devis refusés n'apparaissent pas dans le calendrier (volontairement).</Tip>
      </div>
    ),
  },

  // ── STOCK & INGRÉDIENTS ───────────────────────────────────────────────────
  {
    id: 'gerer-stock',
    category: 'stock',
    title: 'Gérer le stock d\'ingrédients',
    description: 'Mouvements, alertes, niveau actuel',
    keywords: ['inventaire', 'mouvements', 'reapprovisionner'],
    body: (
      <div className="space-y-3">
        <P>Onglet <strong>Stock</strong> : tu vois pour chaque ingrédient le niveau actuel, le seuil d'alerte, et un bouton <strong>+ Mouvement</strong>.</P>
        <P>Types de mouvement : <strong>Entrée</strong> (livraison), <strong>Sortie</strong> (consommation), <strong>Ajustement</strong> (inventaire physique).</P>
        <Tip>Définis un <strong>seuil d'alerte</strong> sur chaque ingrédient : un badge rouge apparaîtra dans la sidebar dès que le stock passe en-dessous.</Tip>
      </div>
    ),
  },
  {
    id: 'alertes-stock',
    category: 'stock',
    title: 'Alertes stock bas',
    description: 'Notifications automatiques',
    keywords: ['notification', 'badge', 'seuil', 'alerte'],
    body: (
      <div className="space-y-3">
        <P>Dès qu'un mouvement de sortie fait passer le stock <strong>≤ seuil d'alerte</strong>, une notification est créée automatiquement.</P>
        <P>Le badge rouge dans la sidebar (sur "Stock") affiche le nombre d'ingrédients en alerte.</P>
        <P>Page <strong>Notifications</strong> pour voir l'historique complet.</P>
      </div>
    ),
  },

  // ── CATALOGUE ─────────────────────────────────────────────────────────────
  {
    id: 'creer-prestation',
    category: 'catalogue',
    title: 'Créer une prestation',
    description: 'Avec catégorie, prix, ingrédients liés',
    keywords: ['service', 'plat', 'menu', 'item'],
    body: (
      <div className="space-y-3">
        <Step n={1} title="Va dans Catalogue → Prestations">Bouton <strong>+ Nouveau</strong> en haut à droite.</Step>
        <Step n={2} title="Renseigne le nom et le prix">Le nom apparaîtra dans tes devis. Le prix est unitaire HT.</Step>
        <Step n={3} title="(optionnel) Catégorie">Sélectionne ou crée une catégorie pour organiser ton catalogue. Les <strong>catégories globales</strong> (icône 🌐) sont fournies par WeboDevis et utilisables par tous.</Step>
        <Step n={4} title="(optionnel) Ingrédients">Lie des ingrédients avec leurs quantités → la prestation génère automatiquement la liste de courses des événements.</Step>
      </div>
    ),
  },
  {
    id: 'categories-perso',
    category: 'catalogue',
    title: 'Créer mes propres catégories',
    description: 'Organiser le catalogue à ma façon',
    keywords: ['rangement', 'sous-catégorie', 'organiser'],
    body: (
      <div className="space-y-3">
        <P>Page <strong>Paramètres → Catégories</strong>. Tu vois deux types :</P>
        <ul className="text-sm text-gray-700 space-y-1 pl-5 list-disc">
          <li>Tes catégories perso (modifiables, badges colorés).</li>
          <li>Les catégories globales (lecture seule, badge "Globale").</li>
        </ul>
        <P>Bouton <strong>+ Catégorie</strong> en haut à droite. Une fois créée, déplie-la pour ajouter des sous-catégories.</P>
      </div>
    ),
  },
  {
    id: 'fournisseurs',
    category: 'catalogue',
    title: 'Lier un fournisseur à un ingrédient',
    description: 'Pour générer automatiquement les commandes',
    keywords: ['supplier', 'achat', 'commande'],
    body: (
      <div className="space-y-3">
        <P>Sur la fiche d'un ingrédient, sélectionne un <strong>fournisseur préféré</strong>.</P>
        <P>Lors de la préparation d'un événement, l'app peut générer une <strong>commande groupée par fournisseur</strong> à partir de tes prestations.</P>
      </div>
    ),
  },

  // ── COMPTE & PARAMÈTRES ───────────────────────────────────────────────────
  {
    id: 'profil-entreprise',
    category: 'compte',
    title: 'Compléter mon profil entreprise',
    description: 'Logo, SIRET, coordonnées, CGV',
    keywords: ['identité', 'siret', 'logo', 'cgv'],
    body: (
      <div className="space-y-3">
        <P>Page <strong>Paramètres → Profil entreprise</strong>. Ces infos apparaissent sur tous tes devis :</P>
        <ul className="text-sm text-gray-700 space-y-1 pl-5 list-disc">
          <li>Nom commercial, SIRET, adresse, téléphone.</li>
          <li>Logo (PNG/JPG, idéalement carré).</li>
          <li>CGV (édition riche, multilingue FR/EN).</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'cgv',
    category: 'compte',
    title: 'Personnaliser mes CGV',
    description: 'Conditions générales de vente sur tes devis',
    keywords: ['conditions', 'légal', 'mentions'],
    body: (
      <div className="space-y-3">
        <P>Page <strong>Paramètres → Profil entreprise → CGV</strong>. Éditeur riche : titres, gras, listes, traduction auto FR ↔ EN.</P>
        <P>Tes CGV s'impriment automatiquement à la fin de chaque devis envoyé.</P>
      </div>
    ),
  },
  {
    id: 'mot-de-passe',
    category: 'compte',
    title: 'Changer mon mot de passe',
    description: 'Sécurité du compte',
    keywords: ['password', 'sécurité', 'oubli'],
    body: (
      <div className="space-y-3">
        <P>Sur la page de connexion, clique sur <strong>Mot de passe oublié</strong>. Tu reçois un email avec un lien pour définir un nouveau mot de passe.</P>
      </div>
    ),
  },
];
