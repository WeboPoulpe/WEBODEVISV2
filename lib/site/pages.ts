import { AUDIENCES } from './audiences';
import { DEMO_HREF, LOGIN_HREF, REGISTER_HREF, RELEASE } from './config';
import { FEATURES, FEATURE_GROUPS } from './features';
import { GUIDES } from './guides';

// L'arborescence du site, en un seul endroit : le menu, le pied de page, le sitemap et les liens
// internes en partent tous.

export interface SiteLink {
  href: string;
  label: string;
  blurb?: string;
  /** Icône du menu (clé). */
  icon?: string;
  /** Précision affichée dans le menu (temps de lecture d'un guide). */
  meta?: string;
}
export interface SiteLinkGroup { title?: string; links: SiteLink[] }
export interface SiteMenuEntry {
  id: string;
  label: string;
  /** Préfixe d'adresse des pages de cette entrée : sert à ouvrir le bon groupe du menu sur téléphone. */
  prefix: string;
  /** Présentation du panneau sur ordinateur : colonnes par groupe, grands blocs, ou liste. */
  layout: 'columns' | 'blocks' | 'list';
  columns: SiteLinkGroup[];
  /** Lien « tout voir », en pied de panneau. */
  all?: SiteLink;
  /** Second lien du pied de panneau (la date de sortie). */
  note?: SiteLink;
}

export const HOME: SiteLink = { href: '/', label: 'Accueil' };
export const FEATURES_INDEX: SiteLink = { href: '/fonctionnalites', label: 'Fonctionnalités' };
export const GUIDES_INDEX: SiteLink = { href: '/guides', label: 'Guides' };
export const RELEASES: SiteLink = { href: '/nouveautes', label: 'Nouveautés' };
export const CONTACT: SiteLink = { href: '/contact', label: 'Contact' };
/** Demande de devis pour le logiciel : le formulaire de contact, avec l'objet présélectionné. */
export const QUOTE_REQUEST: SiteLink = { href: '/contact?objet=devis', label: 'Demander un devis' };
export const LEGAL: SiteLink[] = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/confidentialite', label: 'Confidentialité' },
];

export const DEMO: SiteLink = { href: DEMO_HREF, label: 'Essayer la démo' };
export const LOGIN: SiteLink = { href: LOGIN_HREF, label: 'Se connecter' };
/** Affiché seulement quand les inscriptions sont ouvertes (réglage de l'espace d'administration, lu par SiteShell). */
export const SIGNUP: SiteLink = { href: REGISTER_HREF, label: 'Créer un compte' };

const featureLink = (slug: string): SiteLink => {
  const f = FEATURES.find((x) => x.slug === slug);
  if (!f) throw new Error(`Fonctionnalité inconnue : ${slug}`);
  return { href: f.href, label: f.label, blurb: f.blurb, icon: f.icon };
};

/** Les fonctionnalités, regroupées par étape du métier. */
export const FEATURE_COLUMNS: SiteLinkGroup[] = FEATURE_GROUPS.map((g) => ({
  title: g.title,
  links: g.slugs.map(featureLink),
}));

export const AUDIENCE_LINKS: SiteLink[] = AUDIENCES.map((a) => ({ href: a.href, label: a.label, blurb: a.blurb, icon: a.icon }));
export const GUIDE_LINKS: SiteLink[] = GUIDES.map((g) => ({ href: g.href, label: g.title, blurb: g.blurb, icon: g.icon, meta: `${g.minutes} min de lecture` }));

/** La date de sortie, telle qu'elle s'affiche en pied de menu. */
export const RELEASE_NOTE: SiteLink = { href: RELEASES.href, label: `Version ${RELEASE.version} le ${RELEASE.dateLabel}` };
/** Le guide mis en avant dans le menu. */
export const FEATURED_GUIDE = GUIDES[0];

/** Le mégamenu. */
export const MENU: SiteMenuEntry[] = [
  {
    id: 'fonctionnalites',
    label: 'Fonctionnalités',
    prefix: '/fonctionnalites',
    layout: 'columns',
    columns: FEATURE_COLUMNS,
    all: { href: FEATURES_INDEX.href, label: 'Toutes les fonctionnalités' },
    note: RELEASE_NOTE,
  },
  {
    id: 'pour-qui',
    label: 'Pour qui',
    prefix: '/pour',
    layout: 'blocks',
    // Dans le menu, chaque activité a une description de deux lignes.
    columns: [{ links: AUDIENCES.map((a) => ({ href: a.href, label: a.label, blurb: a.menuText, icon: a.icon })) }],
  },
  {
    id: 'guides',
    label: 'Guides',
    prefix: '/guides',
    layout: 'list',
    columns: [{ links: GUIDE_LINKS }],
    all: { href: GUIDES_INDEX.href, label: 'Tous les guides' },
  },
];
export const MENU_LINKS: SiteLink[] = [RELEASES, CONTACT];

/** Le pied de page : toute l'arborescence. */
export const FOOTER: SiteLinkGroup[] = [
  { title: 'Fonctionnalités', links: [...FEATURES.map((f) => ({ href: f.href, label: f.label })), { href: FEATURES_INDEX.href, label: 'Vue d’ensemble' }] },
  { title: 'Pour qui', links: AUDIENCES.map((a) => ({ href: a.href, label: a.label })) },
  { title: 'Guides', links: [...GUIDES.map((g) => ({ href: g.href, label: g.title })), { href: GUIDES_INDEX.href, label: 'Tous les guides' }] },
  { title: 'WeboDevis', links: [HOME, RELEASES, CONTACT, LOGIN, ...LEGAL] },
];

export interface SitemapEntry { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }

/** Toutes les pages publiques à référencer (la démo et la connexion n'en font pas partie). */
export const SITEMAP: SitemapEntry[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: FEATURES_INDEX.href, priority: 0.9, changeFrequency: 'monthly' },
  ...FEATURES.map((f) => ({ path: f.href, priority: 0.8, changeFrequency: 'monthly' as const })),
  ...AUDIENCES.map((a) => ({ path: a.href, priority: 0.7, changeFrequency: 'monthly' as const })),
  { path: GUIDES_INDEX.href, priority: 0.7, changeFrequency: 'weekly' },
  ...GUIDES.map((g) => ({ path: g.href, priority: 0.7, changeFrequency: 'monthly' as const })),
  { path: RELEASES.href, priority: 0.5, changeFrequency: 'weekly' },
  { path: CONTACT.href, priority: 0.5, changeFrequency: 'yearly' },
  ...LEGAL.map((l) => ({ path: l.href, priority: 0.2, changeFrequency: 'yearly' as const })),
];
