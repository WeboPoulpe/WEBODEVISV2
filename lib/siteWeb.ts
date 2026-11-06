// ═══════════════════════════════════════════════════════════════════════════
// Onglet « Site web » : les sites et logiciels Webomax, et la demande de rappel
// ═══════════════════════════════════════════════════════════════════════════
// Voir docs/superpowers/specs/2026-10-23-onglet-site-web-webomax-design.md. Le catalogue (packs, options,
// réalisations, bloc logiciel) est gardé dans app_settings et se modifie dans l'admin ; DEFAULT_CATALOG est sa
// valeur initiale. Le questionnaire est relu ici, au serveur comme au navigateur. Module sans accès à la base.

export interface SitePack { key: string; name: string; price: string; pitch: string; features: string[]; featured: boolean }
export interface SiteOption { key: string; name: string; text: string }
export interface SiteWork { key: string; name: string; url: string; image: string; mobileImage: string; tags: string[] }
export interface SiteCatalog {
  packs: SitePack[];
  options: SiteOption[];
  works: SiteWork[];
  software: { title: string; text: string; examples: string[]; price: string };
}

export const DEFAULT_CATALOG: SiteCatalog = {
  packs: [
    {
      key: 'essentiel', name: 'Essentiel', price: '1 500 €', featured: false,
      pitch: 'Une page soignée pour être trouvé et recevoir des demandes.',
      features: ['Une page : présentation, photos, coordonnées', 'Le formulaire de devis relié à WeboDevis', 'Fiche Google et référencement local', 'Adresse .fr et hébergement'],
    },
    {
      key: 'vitrine', name: 'Vitrine', price: '2 500 €', featured: true,
      pitch: 'Le site complet d’un traiteur, qui montre votre cuisine et remplit votre agenda.',
      features: ['Jusqu’à 6 pages : prestations, menus, galerie, avis…', 'Le formulaire de devis relié à WeboDevis', 'Brochures et menus en téléchargement', 'Référencement local soigné', 'Adresse .fr et hébergement'],
    },
    {
      key: 'sur-mesure', name: 'Sur mesure', price: 'Sur devis', featured: false,
      pitch: 'Pour un projet qui sort du cadre.',
      features: ['Pages et design entièrement sur mesure', 'Plusieurs langues', 'Réservation, paiement ou espace client', 'Accompagnement continu'],
    },
  ],
  options: [
    { key: 'maintenance', name: 'Maintenance', text: 'Mises à jour, sauvegardes et petites retouches, chaque mois.' },
    { key: 'photos', name: 'Photos', text: 'Des photos de vos plats et de vos buffets, prises pour le site.' },
    { key: 'redaction', name: 'Rédaction', text: 'Des textes écrits pour vos clients et pensés pour Google.' },
    { key: 'traduction', name: 'Traduction anglaise', text: 'Le site en anglais, pour vos clients étrangers.' },
  ],
  works: [
    { key: 'convivialwedding', name: 'Convivial Wedding', url: 'https://www.convivialwedding.com', image: '/site-web/convivialwedding.webp', mobileImage: '/site-web/convivialwedding-mobile.webp', tags: ['Mariages', 'Galerie'] },
    { key: 'lepicure', name: 'L’Épicure', url: 'https://www.lepicure-rg.fr', image: '/site-web/lepicure.webp', mobileImage: '/site-web/lepicure-mobile.webp', tags: ['Restaurant', 'Menus'] },
  ],
  software: {
    title: 'Un logiciel fait pour vous',
    text: 'Un outil fait pour votre façon de travailler : l’outil qui manque à WeboDevis.',
    examples: ['Un planning de production', 'La prise de commandes', 'Une application pour vos clients'],
    price: 'Sur devis',
  },
};

// ── Lecture ──────────────────────────────────────────────────────────────────

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v: unknown, max: number, each: number) => (Array.isArray(v) ? v.map((x) => str(x, each)).filter(Boolean).slice(0, max) : []);
const keyOf = (v: unknown, fallback: string) => str(v, 40).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || fallback;
/** Adresse d'image : https, ou un fichier du site (/…). */
const image = (v: unknown) => { const s = str(v, 500); return /^https:\/\//.test(s) || /^\/[\w./-]+$/.test(s) ? s : ''; };

/** Catalogue lu en base ou envoyé par l'admin, nettoyé ; la valeur initiale s'il est illisible ou vide. */
export function parseCatalog(raw: unknown): SiteCatalog {
  if (!raw || typeof raw !== 'object') return DEFAULT_CATALOG;
  const r = raw as Record<string, unknown>;
  const packs = (Array.isArray(r.packs) ? r.packs : []).slice(0, 4).flatMap((p, i): SitePack[] => {
    if (!p || typeof p !== 'object') return [];
    const x = p as Record<string, unknown>;
    const name = str(x.name, 60);
    return name ? [{ key: keyOf(x.key ?? name, `pack-${i + 1}`), name, price: str(x.price, 40), pitch: str(x.pitch, 200), features: list(x.features, 10, 160), featured: x.featured === true }] : [];
  });
  const options = (Array.isArray(r.options) ? r.options : []).slice(0, 12).flatMap((o, i): SiteOption[] => {
    if (!o || typeof o !== 'object') return [];
    const x = o as Record<string, unknown>;
    const name = str(x.name, 60);
    return name ? [{ key: keyOf(x.key ?? name, `option-${i + 1}`), name, text: str(x.text, 200) }] : [];
  });
  const works = (Array.isArray(r.works) ? r.works : []).slice(0, 12).flatMap((w, i): SiteWork[] => {
    if (!w || typeof w !== 'object') return [];
    const x = w as Record<string, unknown>;
    const name = str(x.name, 80);
    const url = str(x.url, 300);
    return name && /^https?:\/\//.test(url) ? [{ key: keyOf(x.key ?? name, `site-${i + 1}`), name, url, image: image(x.image), mobileImage: image(x.mobileImage), tags: list(x.tags, 4, 30) }] : [];
  });
  const s = (r.software && typeof r.software === 'object' ? r.software : {}) as Record<string, unknown>;
  const software = {
    title: str(s.title, 80) || DEFAULT_CATALOG.software.title,
    text: str(s.text, 400) || DEFAULT_CATALOG.software.text,
    examples: Array.isArray(s.examples) ? list(s.examples, 6, 80) : DEFAULT_CATALOG.software.examples,
    price: str(s.price, 40) || DEFAULT_CATALOG.software.price,
  };
  if (!packs.length) return { ...DEFAULT_CATALOG, software };
  return { packs, options, works, software };
}

// ── Questionnaire ────────────────────────────────────────────────────────────

/** Ce qui a ouvert le questionnaire, modifiable dedans : un pack, le logiciel, ou rien de précis. */
export type SiteProject = string;
export const SOFTWARE = 'logiciel';
export const STAGES = [
  { key: 'aucun', label: 'Pas encore de site' },
  { key: 'refaire', label: 'Un site à refaire' },
  { key: 'page', label: 'Une simple page' },
] as const;
export const NEEDS = [
  { key: 'vitrine', label: 'Présenter mon entreprise' },
  { key: 'galerie', label: 'Une galerie de photos' },
  { key: 'menus', label: 'Mes cartes et menus' },
  { key: 'formulaire', label: 'Le formulaire de devis relié à WeboDevis' },
  { key: 'langues', label: 'Plusieurs langues' },
] as const;
export const CALL_TIMES = [
  { key: 'matin', label: 'Le matin' },
  { key: 'apres-midi', label: 'L’après-midi' },
  { key: 'soir', label: 'En fin de journée' },
  { key: 'peu-importe', label: 'Peu importe' },
] as const;

export interface SiteAnswers {
  project: SiteProject;
  stage: string | null;
  currentUrl: string;
  needs: string[];
  otherNeed: string;
  options: string[];
  softwareNeed: string;
  likeWork: string | null;
  style: string;
  name: string;
  phone: string;
  email: string;
  callTime: string;
  message: string;
  /** Qui a envoyé la demande, dans l'entreprise (rempli par le serveur). */
  sentBy?: string;
}

export const emptyAnswers = (project: SiteProject = '', contact: { name?: string; phone?: string; email?: string } = {}): SiteAnswers => ({
  project, stage: null, currentUrl: '', needs: ['formulaire'], otherNeed: '', options: [], softwareNeed: '', likeWork: null, style: '',
  name: contact.name ?? '', phone: contact.phone ?? '', email: contact.email ?? '', callTime: 'peu-importe', message: '',
});

const oneOf = <T extends { key: string }>(v: unknown, items: readonly T[]) => (items.some((i) => i.key === v) ? (v as string) : null);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Réponses relues et bornées ; `error` dit ce qui manque pour envoyer. */
export function readAnswers(raw: unknown, catalog: SiteCatalog): { answers: SiteAnswers; error: string | null } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const projects = [...catalog.packs.map((p) => p.key), SOFTWARE];
  const project = projects.includes(String(r.project)) ? String(r.project) : '';
  const software = project === SOFTWARE;
  const answers: SiteAnswers = {
    project,
    stage: software ? null : oneOf(r.stage, STAGES),
    currentUrl: software || r.stage !== 'refaire' ? '' : str(r.currentUrl, 300),
    needs: software || !Array.isArray(r.needs) ? [] : r.needs.filter((n) => NEEDS.some((x) => x.key === n)).map(String),
    otherNeed: software ? '' : str(r.otherNeed, 500),
    options: software || !Array.isArray(r.options) ? [] : r.options.filter((o) => catalog.options.some((x) => x.key === o)).map(String),
    softwareNeed: software ? str(r.softwareNeed, 3000) : '',
    likeWork: software ? null : (catalog.works.some((w) => w.key === r.likeWork) ? String(r.likeWork) : null),
    style: software ? '' : str(r.style, 1000),
    name: str(r.name, 120),
    phone: str(r.phone, 40),
    email: str(r.email, 200).toLowerCase(),
    callTime: oneOf(r.callTime, CALL_TIMES) ?? 'peu-importe',
    message: str(r.message, 2000),
  };
  const error = !project ? 'Choisissez votre projet.'
    : software && answers.softwareNeed.length < 10 ? 'Décrivez votre besoin en quelques mots.'
      : !answers.name ? 'Indiquez votre nom.'
        : answers.phone.replace(/\D/g, '').length < 10 ? 'Indiquez un numéro de téléphone pour être rappelé.'
          : !EMAIL.test(answers.email) ? 'L’adresse email n’est pas valide.'
            : null;
  return { answers, error };
}

const label = <T extends { key: string; label: string }>(items: readonly T[], key: string | null) => items.find((i) => i.key === key)?.label ?? '';

/** Ce que l'on retient d'un projet : nom du pack (avec son prix) ou logiciel. */
export function projectLabel(project: string, catalog: SiteCatalog): string {
  if (project === SOFTWARE) return 'Logiciel sur mesure';
  const p = catalog.packs.find((x) => x.key === project);
  return p ? `Site ${p.name}${p.price ? ` (${p.price})` : ''}` : 'Projet à préciser';
}

/** Les réponses rangées par étape, lisibles (admin, e-mails, champ « message » de la demande). */
export function answerSections(a: SiteAnswers, catalog: SiteCatalog): { title: string; rows: [string, string][] }[] {
  const software = a.project === SOFTWARE;
  const rows = (pairs: [string, string][]) => pairs.filter(([, v]) => v);
  const sections = [
    { title: 'Le projet', rows: rows([['Projet', projectLabel(a.project, catalog)], ['Où en est-il', label(STAGES, a.stage)], ['Site actuel', a.currentUrl]]) },
    software
      ? { title: 'Le besoin', rows: rows([['Besoin', a.softwareNeed]]) }
      : {
        title: 'Ce que le site doit faire',
        rows: rows([
          ['Le site doit', a.needs.map((n) => label(NEEDS, n)).join(', ')],
          ['Autre', a.otherNeed],
          ['Options', a.options.map((o) => catalog.options.find((x) => x.key === o)?.name ?? o).join(', ')],
        ]),
      },
    ...(software ? [] : [{ title: 'Le style', rows: rows([['Plutôt comme', catalog.works.find((w) => w.key === a.likeWork)?.name ?? (a.likeWork === null ? 'Je ne sais pas encore' : '')], ['Couleurs, remarques', a.style]]) }]),
    { title: 'Être rappelé', rows: rows([['Nom', a.name], ['Téléphone', a.phone], ['Email', a.email], ['Moment idéal', label(CALL_TIMES, a.callTime)], ['Message', a.message], ['Envoyé par', a.sentBy ?? '']]) },
  ];
  return sections.filter((s) => s.rows.length);
}

/** Résumé en texte, pour le champ « message » de la demande. */
export function answersText(a: SiteAnswers, catalog: SiteCatalog): string {
  return answerSections(a, catalog).map((s) => `${s.title}\n${s.rows.map(([k, v]) => `${k} : ${v}`).join('\n')}`).join('\n\n');
}
