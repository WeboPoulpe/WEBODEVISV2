// Contrat d'extra (CDD d'usage) et déclaration préalable à l'embauche (DPAE) : contenu du contrat, fiche DPAE,
// informations manquantes et alertes. Fonctions pures, partagées entre le serveur (PDF, emails, tâche planifiée)
// et l'interface. Rien de chiffré n'est inventé : ce qui varie d'un traiteur à l'autre (convention collective,
// caisses, repas, période d'essai) vient de ses réglages d'employeur. Modèle à faire valider par un professionnel.

/** Mention affichée près du contrat dans l'app. */
export const CONTRACT_DISCLAIMER = 'Modèle à faire valider par votre expert-comptable ou juriste.';

/** Convention collective proposée par défaut, modifiable dans les réglages d'employeur. */
export const DEFAULT_CONVENTION = 'Hôtels, cafés, restaurants (HCR), IDCC 1979';

/** Formulaire DPAE en ligne de l'URSSAF. */
export const DPAE_URL = 'https://www.due.urssaf.fr/';

/** La DPAE se fait au plus tôt 8 jours avant l'embauche… */
export const DPAE_EARLIEST_DAYS = 8;
/** … et l'alerte devient urgente 48 heures avant la prise de poste. */
export const DPAE_URGENT_HOURS = 48;

// ── Données ─────────────────────────────────────────────────────────────────

/** Réglages d'employeur de l'entreprise (table employer_settings). */
export interface EmployerSettings {
  naf_code: string | null;
  urssaf: string | null;
  convention: string | null;
  retirement_fund: string | null;
  provident_fund: string | null;
  health_service: string | null;
  meal_terms: string | null;
  trial_terms: string | null;
  signatory_name: string | null;
  signatory_title: string | null;
  signature_city: string | null;
  extra_clauses: string | null;
}

export const EMPTY_EMPLOYER_SETTINGS: EmployerSettings = {
  naf_code: null, urssaf: null, convention: null, retirement_fund: null, provident_fund: null, health_service: null,
  meal_terms: null, trial_terms: null, signatory_name: null, signatory_title: null, signature_city: null, extra_clauses: null,
};

/** L'employeur : identité de l'entreprise (profil du titulaire) et réglages d'employeur. */
export interface Employer extends EmployerSettings {
  company_name: string;
  legal_form: string | null;
  address: string | null;
  siret: string | null;
  phone: string | null;
}

/** Fiche administrative d'un extra (table extra_hr_details). */
export interface ExtraHrDetails {
  birth_name: string | null;
  usage_name: string | null;
  first_names: string | null;
  sex: 'F' | 'M' | null;
  birth_date: string | null;
  birth_city: string | null;
  birth_department: string | null;
  birth_country: string | null;
  nationality: string | null;
  social_security_number: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  iban: string | null;
}

export const EMPTY_HR_DETAILS: ExtraHrDetails = {
  birth_name: null, usage_name: null, first_names: null, sex: null, birth_date: null, birth_city: null, birth_department: null,
  birth_country: null, nationality: null, social_security_number: null, address: null, postal_code: null, city: null, iban: null,
};

/** La mission : l'affectation de l'extra à un événement. */
export interface MissionInfo {
  extraName: string;
  role: string | null;
  eventType: string | null;
  eventDate: string | null;
  location: string | null;
  arrival: string | null;
  departure: string | null;
  notes: string | null;
  /** Taux de la mission, sinon taux habituel de l'extra. */
  hourlyRate: number | null;
}

/** Ce que le traiteur ajuste pour ce contrat (table extra_contracts, colonne terms). */
export interface ContractTerms {
  position: string;
  classification: string | null;
  hourly_rate: number | null;
  location: string | null;
  start: string | null;
  end: string | null;
}

/** Conditions proposées pour une mission, avant tout ajustement. */
export function defaultTerms(m: MissionInfo): ContractTerms {
  return {
    position: m.role?.trim() || 'Extra',
    classification: null,
    hourly_rate: m.hourlyRate ?? null,
    location: m.location?.trim() || null,
    start: hhmm(m.arrival),
    end: hhmm(m.departure),
  };
}

// ── Mise en forme ───────────────────────────────────────────────────────────

/** « 18:30:00 » ou « 18h30 » → « 18:30 », sinon null. */
export function hhmm(v: string | null | undefined): string | null {
  const m = /^(\d{1,2})\s*[:hH]\s*(\d{2})?/.exec((v ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2] ?? '0');
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const hourFr = (t: string) => `${Number(t.slice(0, 2))} h${t.slice(3, 5) === '00' ? '' : ` ${t.slice(3, 5)}`}`;

/** 2026-06-12 → 12/06/2026 (format des formulaires). */
export const dateSlash = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

/** 2026-06-12 → samedi 12 juin 2026. */
export const dateLong = (iso: string | null | undefined) =>
  (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');

const dayFr = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(/^1 /, '1er ');

export const euro = (n: number) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ')} €`;

const hoursFr = (h: number) => {
  const whole = Math.floor(h), min = Math.round((h - whole) * 60);
  return min ? `${whole} h ${String(min).padStart(2, '0')}` : `${whole} h`;
};

export function addDaysIso(date: string, n: number): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Durée prévue en heures ; une fin avant le début passe au lendemain (soirée qui finit après minuit). */
export function plannedHours(start: string | null | undefined, end: string | null | undefined): number | null {
  const a = hhmm(start), b = hhmm(end);
  if (!a || !b) return null;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let d = toMin(b) - toMin(a);
  if (d <= 0) d += 24 * 60;
  return Math.round((d / 60) * 100) / 100;
}

const endsNextDay = (start: string | null, end: string | null) => {
  const a = hhmm(start), b = hhmm(end);
  return !!a && !!b && b <= a;
};

/** Nom complet de l'extra pour les documents : prénoms et nom de naissance, sinon le nom du carnet. */
export function employeeName(d: Partial<ExtraHrDetails>, fallback: string): string {
  const name = [d.first_names?.trim(), d.birth_name?.trim()].filter(Boolean).join(' ');
  return name || fallback.trim();
}

// ── N° de sécurité sociale ─────────────────────────────────────────────────

export const normalizeNir = (v: string | null | undefined) => (v ?? '').toUpperCase().replace(/[\s.-]/g, '');

/** N° de sécurité sociale (NIR) à 15 caractères, clé de contrôle comprise (Corse : 2A et 2B). */
export function isValidNir(v: string | null | undefined): boolean {
  const n = normalizeNir(v);
  if (!/^[12378]\d{4}(\d{2}|2A|2B)\d{6}\d{2}$/.test(n)) return false;
  const body = n.slice(0, 13).replace('2A', '19').replace('2B', '18');
  const key = BigInt(97) - (BigInt(body) % BigInt(97));
  return key === BigInt(n.slice(13));
}

/** 1 85 05 78 006 084 36 */
export function formatNir(v: string | null | undefined): string {
  const n = normalizeNir(v);
  if (n.length !== 15) return n;
  return [n.slice(0, 1), n.slice(1, 3), n.slice(3, 5), n.slice(5, 7), n.slice(7, 10), n.slice(10, 13), n.slice(13)].join(' ');
}

/** N° masqué, pour un affichage discret : « 1 85 •• •• ••• ••• 36 ». */
export function maskNir(v: string | null | undefined): string {
  const n = normalizeNir(v);
  if (n.length !== 15) return n ? '•••' : '';
  return `${n.slice(0, 1)} ${n.slice(1, 3)} •• •• ••• ••• ${n.slice(13)}`;
}

export const normalizeIban = (v: string | null | undefined) => (v ?? '').toUpperCase().replace(/[\s.-]/g, '');

/** IBAN : format et clé de contrôle (modulo 97). */
export function isValidIban(v: string | null | undefined): boolean {
  const n = normalizeIban(v);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(n)) return false;
  const digits = (n.slice(4) + n.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const ch of digits) rest = (rest * 10 + Number(ch)) % 97;
  return rest === 1;
}

// ── Contrat ─────────────────────────────────────────────────────────────────

export interface ContractArticle { title: string; paragraphs: string[] }

/** Contenu d'un contrat : ce qui est affiché, imprimé en PDF, figé à l'envoi et signé. */
export interface ContractDoc {
  version: 1;
  title: string;
  subtitle: string;
  employer: { name: string; lines: string[] };
  employee: { name: string; lines: string[] };
  articles: ContractArticle[];
  /** « Fait à Troyes, le 12 juin 2026 ». */
  madeAt: string;
  employerSigner: string;
  eventDate: string | null;
}

/**
 * Ce qui manque pour établir le contrat (envoi bloqué tant que la liste n'est pas vide).
 * Les mentions obligatoires d'un CDD sont reprises (article L. 1242-12 du Code du travail).
 */
export function contractMissing(e: Employer, d: Partial<ExtraHrDetails>, t: ContractTerms, m: Pick<MissionInfo, 'eventDate'>): string[] {
  const out: string[] = [];
  if (!e.company_name.trim()) out.push('Raison sociale de l’entreprise (Paramètres)');
  if (!e.siret?.trim()) out.push('SIRET de l’entreprise (Paramètres)');
  if (!e.address?.trim()) out.push('Adresse de l’entreprise (Paramètres)');
  if (!e.retirement_fund?.trim()) out.push('Caisse de retraite complémentaire (Paramètres, Employeur)');
  if (!d.birth_name?.trim()) out.push('Nom de naissance de l’extra');
  if (!d.first_names?.trim()) out.push('Prénom de l’extra');
  if (!d.birth_date) out.push('Date de naissance de l’extra');
  if (!d.birth_city?.trim()) out.push('Commune de naissance de l’extra');
  if (!d.nationality?.trim()) out.push('Nationalité de l’extra');
  if (!d.address?.trim() || !d.city?.trim()) out.push('Adresse de l’extra');
  if (!m.eventDate) out.push('Date de l’événement');
  if (!t.position.trim()) out.push('Poste occupé');
  if (!hhmm(t.start) || !hhmm(t.end)) out.push('Heures de début et de fin');
  if (t.hourly_rate == null || !(t.hourly_rate > 0)) out.push('Taux horaire brut');
  return out;
}

export function buildContract(e: Employer, d: Partial<ExtraHrDetails>, t: ContractTerms, m: MissionInfo, { issuedOn }: { issuedOn: string }): ContractDoc {
  const company = e.company_name.trim() || 'L’employeur';
  const name = employeeName(d, m.extraName);
  const start = hhmm(t.start), end = hhmm(t.end);
  const hours = plannedHours(start, end);
  const rate = t.hourly_rate != null && t.hourly_rate > 0 ? t.hourly_rate : null;
  const convention = e.convention?.trim() || DEFAULT_CONVENTION;
  const day = m.eventDate ? dateLong(m.eventDate) : 'date à préciser';
  const salarie = d.sex === 'F' ? 'la salariée' : 'le salarié';
  const Salarie = salarie[0].toUpperCase() + salarie.slice(1);
  const ne = d.sex === 'F' ? 'Née' : 'Né';

  const employerLines = [
    e.legal_form?.trim() ? `${e.legal_form.trim()}` : '',
    e.address?.trim() ? `Siège : ${e.address.trim()}` : '',
    e.siret?.trim() ? `SIRET ${e.siret.trim()}` : '',
    e.naf_code?.trim() ? `Code APE/NAF ${e.naf_code.trim()}` : '',
    e.urssaf?.trim() ? `Cotisations versées à l’URSSAF ${e.urssaf.trim()}` : '',
    `Représentée par ${[e.signatory_name?.trim(), e.signatory_title?.trim()].filter(Boolean).join(', ') || 'son représentant légal'}`,
  ].filter(Boolean);

  const birthPlace = [d.birth_city?.trim(), d.birth_department?.trim() ? `(${d.birth_department.trim()})` : '', d.birth_country?.trim() && !/^france$/i.test(d.birth_country.trim()) ? d.birth_country.trim() : '']
    .filter(Boolean).join(' ');
  const employeeLines = [
    d.usage_name?.trim() ? `Nom d’usage : ${d.usage_name.trim()}` : '',
    d.birth_date ? `${ne} le ${dayFr(d.birth_date)}${birthPlace ? ` à ${birthPlace}` : ''}` : '',
    d.nationality?.trim() ? `Nationalité : ${d.nationality.trim()}` : '',
    [d.address?.trim(), [d.postal_code?.trim(), d.city?.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', '),
  ].filter(Boolean);

  const mission = [m.eventType?.trim() || 'Événement', m.eventDate ? `du ${dayFr(m.eventDate)}` : ''].filter(Boolean).join(' ');
  const articles: ContractArticle[] = [
    {
      title: 'Engagement et motif du recours',
      paragraphs: [
        `${company} engage ${name} par contrat à durée déterminée d’usage (extra), conclu en application des articles L. 1242-2, 3° et D. 1242-1 du Code du travail : l’entreprise relève d’un secteur d’activité où il est d’usage constant de ne pas recourir au contrat à durée indéterminée pour cet emploi, par nature temporaire.`,
        `Le présent contrat est conclu pour la mission suivante : ${mission}.`,
      ],
    },
    {
      title: 'Poste',
      paragraphs: [
        `${Salarie} est engagé${d.sex === 'F' ? 'e' : ''} en qualité de ${t.position.trim() || 'extra'}${t.classification?.trim() ? ` (classification : ${t.classification.trim()})` : ''}. ${d.sex === 'F' ? 'Elle' : d.sex === 'M' ? 'Il' : 'Il ou elle'} exécute les tâches relevant de cet emploi selon les directives de l’employeur ou de son représentant sur place.`,
      ],
    },
    {
      title: 'Date, horaires et durée',
      paragraphs: [
        `Le contrat est conclu pour la journée du ${day}${start && end && endsNextDay(start, end) ? ', jusqu’au lendemain' : ''}.`,
        start && end
          ? `Horaires prévus : de ${hourFr(start)} à ${hourFr(end)}${hours ? `, soit ${hoursFr(hours)} de travail prévues` : ''}. Le contrat prend fin à l’issue de la mission ; les heures réellement effectuées sont relevées et rémunérées.`
          : 'Les horaires de la mission sont communiqués par l’employeur. Le contrat prend fin à l’issue de la mission.',
      ],
    },
    {
      title: 'Lieu de travail',
      paragraphs: [t.location?.trim() ? `La mission se déroule à l’adresse suivante : ${t.location.trim()}.` : 'Le lieu de la mission est communiqué par l’employeur.'],
    },
    {
      title: 'Période d’essai',
      paragraphs: [e.trial_terms?.trim() || 'Le présent contrat ne comporte pas de période d’essai.'],
    },
    {
      title: 'Rémunération',
      paragraphs: [
        rate
          ? `${Salarie} perçoit un salaire horaire brut de ${euro(rate)}${hours ? `, soit ${euro(Math.round(rate * hours * 100) / 100)} brut pour les ${hoursFr(hours)} prévues` : ''}. Les heures réellement effectuées sont payées sur la base de ce taux, avec les majorations prévues par la loi et la convention collective le cas échéant.`
          : `Le salaire horaire brut est fixé par l’employeur conformément à la convention collective.`,
        'S’y ajoute une indemnité compensatrice de congés payés égale à 10 % de la rémunération brute totale (article L. 1242-16 du Code du travail), versée à la fin du contrat.',
        'L’indemnité de fin de contrat n’est pas due au titre d’un contrat à durée déterminée d’usage (article L. 1243-10 du Code du travail), sauf disposition conventionnelle contraire.',
        ...(e.meal_terms?.trim() ? [e.meal_terms.trim()] : []),
        'La rémunération est versée avec un bulletin de paie.',
      ],
    },
    {
      title: 'Convention collective',
      paragraphs: [`Le contrat est régi par la convention collective nationale applicable à l’entreprise : ${convention}. Elle est tenue à la disposition de ${salarie}.`],
    },
    {
      title: 'Retraite complémentaire et prévoyance',
      paragraphs: [
        e.retirement_fund?.trim() ? `Caisse de retraite complémentaire : ${e.retirement_fund.trim()}.` : 'Caisse de retraite complémentaire : à préciser.',
        ...(e.provident_fund?.trim() ? [`Organisme de prévoyance : ${e.provident_fund.trim()}.`] : []),
      ],
    },
    {
      title: 'Déclaration préalable à l’embauche et santé au travail',
      paragraphs: [
        `La déclaration préalable à l’embauche est effectuée auprès de l’URSSAF${e.urssaf?.trim() ? ` ${e.urssaf.trim()}` : ''}. ${Salarie} peut exercer son droit d’accès et de rectification aux informations de cette déclaration auprès de cet organisme.`,
        ...(e.health_service?.trim() ? [`Service de prévention et de santé au travail : ${e.health_service.trim()}.`] : []),
      ],
    },
    {
      title: 'Obligations',
      paragraphs: [
        `${Salarie} s’engage à respecter les règles d’hygiène et de sécurité alimentaire, la tenue demandée et les consignes données sur place, et à garder une totale discrétion sur les informations concernant les clients de l’entreprise.`,
        ...(m.notes?.trim() ? [`Consignes de la mission : ${m.notes.trim()}`] : []),
      ],
    },
    ...(e.extra_clauses?.trim() ? [{ title: 'Clauses particulières', paragraphs: e.extra_clauses.trim().split(/\n{2,}/) }] : []),
  ];

  return {
    version: 1,
    title: 'Contrat de travail à durée déterminée d’usage',
    subtitle: `Extra, ${t.position.trim() || 'mission'}${m.eventDate ? `, ${dayFr(m.eventDate)}` : ''}`,
    employer: { name: company, lines: employerLines },
    employee: { name, lines: employeeLines },
    articles,
    madeAt: `Fait${e.signature_city?.trim() ? ` à ${e.signature_city.trim()}` : ''}, le ${dayFr(issuedOn)}.`,
    employerSigner: [e.signatory_name?.trim(), e.signatory_title?.trim()].filter(Boolean).join(', ') || company,
    eventDate: m.eventDate,
  };
}

/** Le contrat en texte brut (aperçu, recherche dans les tests). */
export function contractText(doc: ContractDoc): string {
  return [
    doc.title, doc.subtitle,
    'Entre', doc.employer.name, ...doc.employer.lines,
    'Et', doc.employee.name, ...doc.employee.lines,
    ...doc.articles.flatMap((a, i) => [`Article ${i + 1}. ${a.title}`, ...a.paragraphs]),
    doc.madeAt,
  ].join('\n');
}

// ── DPAE ────────────────────────────────────────────────────────────────────

export interface DpaeField { label: string; value: string | null; hint?: string }
export interface DpaeSection { title: string; fields: DpaeField[] }

/** Les informations de la DPAE, dans l'ordre des rubriques du formulaire en ligne (employeur, salarié, contrat). */
export function dpaeSheet(e: Employer, d: Partial<ExtraHrDetails>, t: ContractTerms, m: MissionInfo): DpaeSection[] {
  const v = (s: string | null | undefined) => s?.trim() || null;
  const end = m.eventDate && endsNextDay(t.start, t.end) ? addDaysIso(m.eventDate, 1) : m.eventDate;
  return [
    {
      title: 'Employeur',
      fields: [
        { label: 'SIRET', value: v(e.siret)?.replace(/\s/g, '') ?? null },
        { label: 'Raison sociale', value: v(e.company_name) },
        { label: 'Adresse', value: v(e.address) },
        { label: 'Code APE/NAF', value: v(e.naf_code) },
        { label: 'URSSAF', value: v(e.urssaf) },
        { label: 'Téléphone', value: v(e.phone) },
      ],
    },
    {
      title: 'Salarié',
      fields: [
        { label: 'Nom de naissance', value: v(d.birth_name)?.toUpperCase() ?? null },
        { label: 'Nom d’usage', value: v(d.usage_name)?.toUpperCase() ?? null, hint: 'Seulement s’il est différent' },
        { label: 'Prénom', value: v(d.first_names) },
        { label: 'Sexe', value: d.sex === 'F' ? 'Féminin' : d.sex === 'M' ? 'Masculin' : null },
        { label: 'N° de sécurité sociale', value: normalizeNir(d.social_security_number) || null, hint: 'Laissez vide s’il n’est pas encore connu' },
        { label: 'Date de naissance', value: d.birth_date ? dateSlash(d.birth_date) : null },
        { label: 'Commune de naissance', value: v(d.birth_city) },
        { label: 'Département de naissance', value: v(d.birth_department), hint: '99 pour une naissance à l’étranger' },
        { label: 'Pays de naissance', value: v(d.birth_country) },
        { label: 'Nationalité', value: v(d.nationality) },
      ],
    },
    {
      title: 'Embauche',
      fields: [
        { label: 'Date d’embauche', value: m.eventDate ? dateSlash(m.eventDate) : null },
        { label: 'Heure d’embauche', value: hhmm(t.start) },
        { label: 'Nature du contrat', value: 'CDD (contrat d’usage, extra)' },
        { label: 'Date de fin du contrat', value: end ? dateSlash(end) : null },
        { label: 'Période d’essai', value: e.trial_terms?.trim() ? e.trial_terms.trim() : 'Aucune' },
        { label: 'Service de santé au travail', value: v(e.health_service) },
      ],
    },
  ];
}

/** Ce qui manque pour remplir la DPAE (le n° de sécurité sociale peut manquer : le formulaire l'accepte). */
export function dpaeMissing(sections: DpaeSection[]): string[] {
  const optional = new Set(['Nom d’usage', 'N° de sécurité sociale', 'URSSAF', 'Téléphone', 'Pays de naissance', 'Département de naissance', 'Code APE/NAF']);
  return sections.flatMap((s) => s.fields.filter((f) => !f.value && !optional.has(f.label)).map((f) => f.label));
}

export type DpaeLevel = 'done' | 'none' | 'early' | 'open' | 'urgent' | 'late';

export interface DpaeAlert {
  level: DpaeLevel;
  /** Libellé court pour une pastille ou une liste. */
  label: string;
  /** Premier jour où la DPAE peut être faite. */
  opensOn: string | null;
}

/** Date et heure de Paris (AAAA-MM-JJTHH:MM) d'un instant. */
export function parisLocal(now: Date): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Une mission qui donne lieu à embauche : l'extra a confirmé (ou est venu). */
export const isHired = (status: string | null | undefined) => status === 'confirme' || status === 'present';

/**
 * Où en est la DPAE d'une mission. Elle se fait au plus tôt 8 jours avant l'embauche et au plus tard avant la
 * prise de poste. Sans heure d'arrivée, la prise de poste est comptée à minuit (alerte au plus tôt).
 */
export function dpaeAlert(a: { eventDate: string | null; arrival: string | null; status: string | null; done: boolean }, now: Date): DpaeAlert {
  if (a.done) return { level: 'done', label: 'DPAE faite', opensOn: null };
  if (!a.eventDate || !isHired(a.status)) return { level: 'none', label: '', opensOn: null };
  const date = a.eventDate.slice(0, 10);
  const opensOn = addDaysIso(date, -DPAE_EARLIEST_DAYS);
  const local = parisLocal(now);
  const hours = (Date.parse(`${date}T${hhmm(a.arrival) ?? '00:00'}:00Z`) - Date.parse(`${local}:00Z`)) / 3_600_000;
  if (hours < 0) return { level: 'late', label: 'DPAE non faite', opensOn };
  if (hours <= DPAE_URGENT_HOURS) return { level: 'urgent', label: 'DPAE à faire d’urgence', opensOn };
  if (local.slice(0, 10) >= opensOn) return { level: 'open', label: 'DPAE à faire', opensOn };
  return { level: 'early', label: `DPAE à partir du ${dayFr(opensOn).replace(/ \d{4}$/, '')}`, opensOn };
}

/** Le niveau demande l'attention du traiteur (liste des extras, rappel par email). */
export const dpaeNeedsAction = (l: DpaeLevel) => l === 'open' || l === 'urgent' || l === 'late';

/** Statut du contrat et alerte DPAE d'une mission, sans aucune donnée personnelle (listes, onglet d'un événement). */
export interface MissionHrStatus {
  contract: 'brouillon' | 'envoye' | 'signe' | null;
  dpae: DpaeAlert;
}
