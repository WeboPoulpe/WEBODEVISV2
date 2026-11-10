// Statistiques du site de présentation, sans cookie : chaque visite est comptée côté serveur, sans adresse IP
// gardée. Un visiteur est reconnu le temps d'une journée par une empreinte (jour + IP + navigateur + secret),
// impossible à relier d'un jour à l'autre ni à un autre site : la mesure reste anonyme, comme l'exige la CNIL
// pour se passer de consentement. Les lignes sont effacées après 13 mois.

export type SiteEvent = 'view' | 'demo' | 'contact' | 'signup';
export type Source = 'direct' | 'recherche' | 'reseaux' | 'site';
export type Device = 'mobile' | 'tablette' | 'ordinateur';

export const SITE_EVENTS: SiteEvent[] = ['view', 'demo', 'contact', 'signup'];
export const RETENTION_MONTHS = 13;

const SEARCH = /(^|\.)(google|bing|duckduckgo|ecosia|qwant|yahoo|yandex|startpage|brave|lilo)\./i;
const SOCIAL = /(^|\.)(facebook|fb|instagram|linkedin|lnkd|twitter|x|t|tiktok|pinterest|youtube|whatsapp|messenger|threads)\.(com|co|in|me|net)$/i;
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pagespeed|preview|monitor|curl|wget|python|axios|node-fetch|go-http/i;

/** D'où vient le visiteur, d'après le site précédent (sans le chemin, jamais gardé). */
export function sourceOf(referrer: string | null | undefined, ownHost: string): { source: Source; host: string | null } {
  if (!referrer) return { source: 'direct', host: null };
  let host: string;
  try { host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, ''); } catch { return { source: 'direct', host: null }; }
  const own = ownHost.toLowerCase().replace(/^www\./, '').split(':')[0];
  if (!host || host === own) return { source: 'direct', host: null };
  if (SEARCH.test(host)) return { source: 'recherche', host };
  if (SOCIAL.test(host)) return { source: 'reseaux', host };
  return { source: 'site', host };
}

export function deviceOf(userAgent: string): Device {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(userAgent)) return 'tablette';
  if (/mobi|iphone|android/i.test(userAgent)) return 'mobile';
  return 'ordinateur';
}

export const isBot = (userAgent: string) => !userAgent || BOT.test(userAgent);

/** Le chemin d'une page, sans paramètres ni ancre, borné. */
export function cleanPath(path: string): string | null {
  if (typeof path !== 'string' || !path.startsWith('/')) return null;
  const p = path.split(/[?#]/)[0].slice(0, 200);
  return /^\/[\w\-./%]*$/.test(p) ? p : null;
}

export const SOURCE_LABEL: Record<Source, string> = {
  direct: 'Accès direct', recherche: 'Moteurs de recherche', reseaux: 'Réseaux sociaux', site: 'Autres sites',
};
export const DEVICE_LABEL: Record<Device, string> = { mobile: 'Téléphone', tablette: 'Tablette', ordinateur: 'Ordinateur' };
