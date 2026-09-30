import { OG_IMAGE, RELEASE, SITE_NAME, SITE_URL, absoluteUrl } from './config';

// Données structurées (JSON-LD). Aucune note, aucun avis, aucun prix : il n'y en a pas à déclarer.

export interface Crumb { name: string; path: string }
export interface Faq { q: string; a: string }

const ORG_ID = `${SITE_URL}/#organisation`;
const SITE_ID = `${SITE_URL}/#site`;
const APP_ID = `${SITE_URL}/#logiciel`;

export const organizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/icons/512`,
});

export const websiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': SITE_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  inLanguage: 'fr-FR',
  publisher: { '@id': ORG_ID },
});

export const softwareSchema = ({ path, description, features }: { path: string; description: string; features: string[] }) => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  ...(path === '/' ? { '@id': APP_ID } : {}),
  name: SITE_NAME,
  url: absoluteUrl(path),
  description,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'fr-FR',
  softwareVersion: RELEASE.version,
  datePublished: RELEASE.date,
  featureList: features,
  publisher: { '@id': ORG_ID },
});

export const breadcrumbSchema = (crumbs: Crumb[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: absoluteUrl(c.path),
  })),
});

export const faqSchema = (faqs: Faq[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});

export const articleSchema = ({ path, title, description, published }: { path: string; title: string; description: string; published: string }) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: title,
  description,
  inLanguage: 'fr-FR',
  datePublished: published,
  dateModified: published,
  mainEntityOfPage: absoluteUrl(path),
  author: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
  publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
  image: SITE_URL + OG_IMAGE,
});
