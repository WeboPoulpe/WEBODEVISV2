import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site/config';
import { SITEMAP } from '@/lib/site/pages';

// Plan du site pour les moteurs de recherche : les pages publiques listées dans lib/site/pages.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP.map((entry) => ({
    url: absoluteUrl(entry.path),
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
