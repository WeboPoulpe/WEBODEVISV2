// Tableau de bord : forme des données renvoyées par server/dashboard.ts, et calculs de dates partagés.

/** Échéance d'une tâche : en retard, aujourd'hui, dans les 7 jours, ou plus tard (dans les deux semaines). */
export type Bucket = 'retard' | 'aujourdhui' | 'semaine' | 'bientot';

export const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'retard', label: 'En retard' },
  { key: 'aujourdhui', label: 'Aujourd’hui' },
  { key: 'semaine', label: 'Cette semaine' },
  { key: 'bientot', label: 'Dans les deux semaines' },
];

export type TodoKind = 'prospect' | 'devis' | 'relance' | 'preparation' | 'location' | 'acompte' | 'stock' | 'commande' | 'notification';

export interface TodoLink { label: string; href: string }

export interface TodoItem {
  /** Clé stable, par exemple « relance:<id du devis> ». */
  key: string;
  kind: TodoKind;
  /** Ce qu'il faut faire, en une phrase. */
  title: string;
  /** Précisions : événement, montant, depuis quand. */
  detail: string | null;
  /** Échéance (AAAA-MM-JJ), qui fixe l'ordre. */
  due: string | null;
  /** Échéance lisible : « Il y a 3 jours », « Demain », « Samedi 4 octobre ». */
  when: string;
  bucket: Bucket;
  href: string;
  action: string;
  /** Pour un événement à préparer : un lien par chose qui manque, vers le bon onglet. */
  links?: TodoLink[];
}

export interface UpcomingEvent {
  id: string;
  client: string;
  eventType: string | null;
  date: string;
  guests: number;
  total: number | null;
  status: string;
  /** Ce qui manque encore (vide : prêt). null quand la préparation n'est pas suivie (option Événements désactivée). */
  missing: string[] | null;
}

export interface DashboardData {
  today: string;
  modules: string[];
  todo: TodoItem[];
  upcoming: UpcomingEvent[];
  summary: {
    caMonth: number;
    caMonthEvents: number;
    caYear: number;
    caYearEvents: number;
    months: { key: string; label: string; amount: number }[];
    pendingCount: number;
    pendingAmount: number;
    pipeline: { status: string; count: number; amount: number }[];
    conversion: { confirmed: number; total: number };
    upcomingGuests: number;
    upcomingEvents: number;
    requestsMonth: number | null;
    quotesMonth: number;
  };
}

// ── Dates (jours calendaires, sans fuseau) ────────────────────────────────────
const DAY = 86_400_000;
const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/** Jour J + n, au format AAAA-MM-JJ. */
export const addDays = (iso: string, n: number) => new Date(toUtc(iso) + n * DAY).toISOString().slice(0, 10);

/** Nombre de jours de `from` à `to` (positif si `to` est après). */
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY);

export function bucketOf(due: string | null, today: string): Bucket {
  if (!due) return 'semaine';
  const d = daysBetween(today, due);
  if (d < 0) return 'retard';
  if (d === 0) return 'aujourdhui';
  if (d <= 7) return 'semaine';
  return 'bientot';
}

/** « samedi 4 octobre » (avec l'année si ce n'est pas l'année en cours). */
export function longDate(iso: string, today: string): string {
  const d = new Date(toUtc(iso));
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    ...(iso.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
  });
}

/** « aujourd'hui », « demain », « dans 3 jours », « il y a 2 jours », sinon la date. */
export function relativeDay(iso: string, today: string): string {
  const d = daysBetween(today, iso);
  if (d === 0) return 'aujourd’hui';
  if (d === 1) return 'demain';
  if (d === -1) return 'hier';
  if (d > 1 && d <= 6) return `dans ${d} jours`;
  if (d < -1 && d >= -30) return `il y a ${-d} jours`;
  return longDate(iso, today);
}

/** Aujourd'hui en France, si le navigateur n'a pas donné sa date. */
export const parisToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
