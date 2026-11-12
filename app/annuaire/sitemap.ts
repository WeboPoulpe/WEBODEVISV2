import type { MetadataRoute } from 'next';
import { directoryUrl, DIRECTORY_URL } from '@/lib/annuaire/config';
import { departmentByCode } from '@/lib/annuaire/departments';
import { departmentsWithListings, listPublicSlugs } from '@/server/directoryPublic';

// Plan de l'annuaire, servi à choisirmontraiteur.fr/sitemap.xml (réécrit vers /annuaire/sitemap.xml). Adresses absolues
// sur l'adresse canonique. Lu à chaque demande : rien n'est lu en base pendant la construction.

export const dynamic = 'force-dynamic';

const STATIC: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/traiteurs', priority: 0.9 },
  { path: '/referencer-mon-entreprise', priority: 0.5 },
  { path: '/mentions-legales', priority: 0.2 },
  { path: '/confidentialite', priority: 0.2 },
  { path: '/conditions', priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const abs = (path: string) => (path === '/' ? `${DIRECTORY_URL}/` : directoryUrl(path));
  let departments: { code: string }[] = [];
  let listings: { slug: string; updatedAt: string }[] = [];
  try {
    [departments, listings] = await Promise.all([departmentsWithListings(), listPublicSlugs()]);
  } catch (e) {
    // Base injoignable : le plan garde au moins les pages fixes.
    console.error('[annuaire] sitemap', e);
  }
  return [
    ...STATIC.map((s) => ({ url: abs(s.path), priority: s.priority })),
    ...departments
      .map((d) => departmentByCode(d.code))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map((d) => ({ url: abs(`/traiteurs/${d.slug}`), priority: 0.8 })),
    ...listings.map((l) => ({ url: abs(`/traiteur/${l.slug}`), priority: 0.7, ...(l.updatedAt ? { lastModified: l.updatedAt } : {}) })),
  ];
}
