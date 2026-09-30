// Les guides pratiques : fiche d'identité de chaque article. Le texte est dans components/site/guides/.

export interface GuideMeta {
  slug: string;
  /** Icône du menu (clé, voir components/site/SiteNav.tsx). */
  icon: string;
  href: string;
  /** Titre de l'article (h1). */
  title: string;
  /** Balise title. */
  metaTitle: string;
  description: string;
  /** Recherche visée. */
  keyword: string;
  /** Ligne de description dans le menu et les listes. */
  blurb: string;
  /** Temps de lecture estimé, en minutes. */
  minutes: number;
  published: string;
  /** Pages fonctionnalités liées (slugs). */
  features: string[];
}

const guide = (g: Omit<GuideMeta, 'href'>): GuideMeta => ({ ...g, href: `/guides/${g.slug}` });

export const GUIDES: GuideMeta[] = [
  guide({
    slug: 'contenu-devis-traiteur',
    icon: 'file-text',
    title: 'Ce que doit contenir un devis de traiteur',
    metaTitle: 'Devis de traiteur : ce qu’il doit contenir, rubrique par rubrique',
    description: 'Les rubriques d’un devis de traiteur clair : client et événement, prestations, prix par convive, options, conditions. Avec un exemple commenté.',
    keyword: 'que doit contenir un devis de traiteur',
    blurb: 'Les rubriques d’un devis clair, avec un exemple commenté.',
    minutes: 6,
    published: '2026-09-30',
    features: ['devis-traiteur', 'demandes-de-devis'],
  }),
  guide({
    slug: 'calculer-quantites-par-convive',
    icon: 'scale',
    title: 'Calculer les quantités par convive',
    metaTitle: 'Traiteur : calculer les quantités par convive, pas à pas',
    description: 'Une méthode pour passer de la fiche d’une prestation aux quantités à acheter : portion par convive, pertes, marge de sécurité, enfants. Avec un exemple chiffré.',
    keyword: 'quantité par personne traiteur',
    blurb: 'De la fiche de la prestation aux quantités à acheter.',
    minutes: 7,
    published: '2026-09-30',
    features: ['liste-de-courses', 'evenements'],
  }),
  guide({
    slug: 'liste-de-courses-evenement',
    icon: 'shopping-basket',
    title: 'Préparer la liste de courses d’un événement',
    metaTitle: 'Préparer la liste de courses d’un événement de traiteur',
    description: 'Du devis validé à la liste de courses : regrouper les ingrédients, déduire le stock, répartir par fournisseur, fixer les dates de commande.',
    keyword: 'liste de courses traiteur',
    blurb: 'Du devis validé aux commandes passées.',
    minutes: 6,
    published: '2026-09-30',
    features: ['liste-de-courses', 'stock-et-fournisseurs'],
  }),
  guide({
    slug: 'calculer-marge-traiteur',
    icon: 'trending-up',
    title: 'Suivre sa marge, événement par événement',
    metaTitle: 'Marge d’un traiteur : la calculer et la suivre par événement',
    description: 'Coût matière, personnel, location, déplacement : comment calculer le coût de revient d’une prestation de traiteur et suivre la marge de chaque événement.',
    keyword: 'marge traiteur, coût de revient traiteur',
    blurb: 'Coût de revient, marge prévue, marge réelle.',
    minutes: 7,
    published: '2026-09-30',
    features: ['suivi-financier', 'devis-traiteur'],
  }),
  guide({
    slug: 'checklist-evenement-traiteur',
    icon: 'list-checks',
    title: 'La checklist d’un événement, de la validation au jour J',
    metaTitle: 'Checklist traiteur : organiser un événement jusqu’au jour J',
    description: 'Ce qu’il faut avoir réglé à la validation du devis, deux semaines avant, la veille et le jour même : une checklist de traiteur à adapter à votre maison.',
    keyword: 'checklist traiteur, organisation événement traiteur',
    blurb: 'Quoi régler, et quand, avant de servir.',
    minutes: 6,
    published: '2026-09-30',
    features: ['evenements', 'extras'],
  }),
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
