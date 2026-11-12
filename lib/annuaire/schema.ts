import type { PublicListing } from '@/server/directoryPublic';
import { DIRECTORY_NAME, DIRECTORY_URL, directoryUrl } from './config';
import { departmentByCode } from './departments';

// Données structurées (JSON-LD) de l'annuaire, sur l'adresse canonique. Aucune note ni aucun avis : il n'y en a pas
// encore (lot 2), et une note inventée serait trompeuse.

export interface DirectoryCrumb { name: string; path: string }

const abs = (path: string) => (path === '/' ? `${DIRECTORY_URL}/` : directoryUrl(path));

/** Retire les chevrons des textes saisis par le traiteur : rien ne doit pouvoir fermer la balise <script>. */
function clean<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/[<>]/g, '') as T;
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, clean(v)])) as T;
  }
  return value;
}

export function listingJsonLd(l: PublicListing): object {
  const description = (l.tagline || l.description).trim().slice(0, 300);
  const images = [...new Set([l.coverUrl, ...l.photos.map((p) => p.url)].filter((u): u is string => !!u))].slice(0, 6);
  return clean({
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
    '@id': `${directoryUrl(`/traiteur/${l.slug}`)}#traiteur`,
    name: l.name,
    url: directoryUrl(`/traiteur/${l.slug}`),
    description,
    image: images.length ? images : undefined,
    logo: l.logoUrl ?? undefined,
    address: { '@type': 'PostalAddress', addressLocality: l.city, postalCode: l.postalCode, addressCountry: 'FR' },
    areaServed: l.departments.map((code) => departmentByCode(code)?.name).filter(Boolean).map((name) => ({ '@type': 'AdministrativeArea', name })),
    sameAs: l.websiteUrl ?? undefined,
    isPartOf: { '@type': 'WebSite', name: DIRECTORY_NAME, url: `${DIRECTORY_URL}/` },
  });
}

export function directoryBreadcrumb(crumbs: DirectoryCrumb[]): object {
  return clean({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.path) })),
  });
}

export function directoryWebsiteJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DIRECTORY_NAME,
    url: `${DIRECTORY_URL}/`,
    inLanguage: 'fr-FR',
  };
}
