import { DIRECTORY_URL } from '@/lib/annuaire/config';

// robots.txt de l'annuaire, servi à choisirmontraiteur.fr/robots.txt (réécrit ici par le middleware). Next n'accepte
// un fichier robots.ts qu'à la racine de app/ (celui de WeboDevis) : celui-ci est donc une route. Tout est permis.

export function GET() {
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${DIRECTORY_URL}/sitemap.xml`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
