import 'server-only';
import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { isDemoUser } from '@/lib/demo';
import {
  buildContract, contractMissing, defaultTerms, dpaeAlert, dpaeMissing, dpaeNeedsAction, dpaeSheet, EMPTY_EMPLOYER_SETTINGS,
  EMPTY_HR_DETAILS, hhmm, type ContractDoc, type ContractTerms, type DpaeSection, type Employer, type EmployerSettings,
  type ExtraHrDetails, type MissionHrStatus, type MissionInfo,
} from '@/lib/extraContract';
import { sendMail } from '@/lib/mail';
import { dpaeReminderEmail } from '@/lib/mail/extraContracts';
import { companyIdsOf, companyOf } from './companyScope';
import { addDays, parisDate } from './reminders';

// Contrats d'extra et DPAE, côté serveur : lecture des données (entreprise, extra, mission), contrat calculé,
// accès par le lien de l'extra, rappels de la tâche planifiée et export RGPD.
// Ce module n'est pas une action serveur : rien ici n'est appelable depuis le navigateur.
// Les tables (migration 0030) peuvent manquer : chaque lecture le tolère.

const TABLES = /relation "?(public\.)?(extra_contracts|extra_hr_details|employer_settings)"? does not exist/i;

/** Une des tables n'existe pas encore (migration 0030 pas appliquée). */
export function isMissingHrTable(e: unknown): boolean {
  for (let x: unknown = e, i = 0; x && i < 4; x = (x as { cause?: unknown }).cause, i++) {
    const err = x as { code?: string; message?: string };
    if (err.code === '42P01' || TABLES.test(err.message ?? '')) return true;
  }
  return false;
}

export const UNAVAILABLE = 'Les contrats et la DPAE seront disponibles après la prochaine mise à jour de la base.';

export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Rôle du compte dans l'entreprise : gerant, collaborateur, lecture. */
export async function companyRole(uid: string): Promise<{ role: string; parent: string | null }> {
  const { rows } = await db.execute<{ company_role: string | null; parent_user_id: string | null }>(sql`
    select company_role, parent_user_id from public.profiles where id = ${uid}`);
  return { role: rows[0]?.company_role ?? 'gerant', parent: rows[0]?.parent_user_id ?? null };
}

// ── Employeur ───────────────────────────────────────────────────────────────

export async function employerSettingsOf(companyId: string): Promise<EmployerSettings> {
  try {
    const { rows } = await db.execute<EmployerSettings & Record<string, unknown>>(sql`
      select naf_code, urssaf, convention, retirement_fund, provident_fund, health_service, meal_terms, trial_terms,
        signatory_name, signatory_title, signature_city, extra_clauses
      from public.employer_settings where user_id = ${companyId}::uuid`);
    return rows[0] ? { ...EMPTY_EMPLOYER_SETTINGS, ...rows[0] } : { ...EMPTY_EMPLOYER_SETTINGS };
  } catch (e) {
    if (isMissingHrTable(e)) return { ...EMPTY_EMPLOYER_SETTINGS };
    throw e;
  }
}

/** Identité de l'entreprise (profil du titulaire) et réglages d'employeur. */
export async function employerOf(companyId: string): Promise<Employer> {
  const { rows } = await db.execute<{ company_name: string | null; first_name: string | null; last_name: string | null; legal_form: string | null;
    company_address: string | null; siret: string | null; company_siret: string | null; company_phone: string | null }>(sql`
    select company_name, first_name, last_name, legal_form, company_address, siret, company_siret, company_phone
    from public.profiles where id = ${companyId}::uuid`);
  const p = rows[0];
  const settings = await employerSettingsOf(companyId);
  return {
    ...settings,
    company_name: p?.company_name?.trim() || [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '',
    legal_form: p?.legal_form ?? null,
    address: p?.company_address ?? null,
    siret: p?.siret || p?.company_siret || null,
    phone: p?.company_phone ?? null,
    signatory_name: settings.signatory_name || [p?.first_name, p?.last_name].filter(Boolean).join(' ') || null,
  };
}

// ── Extra ───────────────────────────────────────────────────────────────────

const HR_COLUMNS = sql`birth_name, usage_name, first_names, sex, birth_date::text as birth_date, birth_city, birth_department, birth_country,
  nationality, social_security_number, address, postal_code, city, iban`;

export async function hrDetailsOf(extraId: string): Promise<ExtraHrDetails> {
  try {
    const { rows } = await db.execute<ExtraHrDetails & Record<string, unknown>>(sql`
      select ${HR_COLUMNS} from public.extra_hr_details where extra_id = ${extraId}::uuid`);
    return rows[0] ? { ...EMPTY_HR_DETAILS, ...rows[0] } : { ...EMPTY_HR_DETAILS };
  } catch (e) {
    if (isMissingHrTable(e)) return { ...EMPTY_HR_DETAILS };
    throw e;
  }
}

/** Un extra de l'entreprise du compte, ou null. */
export async function companyExtra(uid: string, extraId: string): Promise<{ id: string; name: string; user_id: string } | null> {
  if (!isUuid(extraId)) return null;
  const { rows } = await db.execute<{ id: string; name: string; user_id: string }>(sql`
    select id, name, user_id from public.extras where id = ${extraId}::uuid and user_id in ${companyIdsOf(uid)}`);
  return rows[0] ?? null;
}

// ── Mission ─────────────────────────────────────────────────────────────────

export interface ContractRow {
  id: string;
  terms: Partial<ContractTerms> | null;
  status: 'brouillon' | 'envoye' | 'signe';
  snapshot: ContractDoc | null;
  content_hash: string | null;
  sent_at: string | null;
  signed_on_paper: boolean;
  signer_name: string | null;
  signature: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  dpae_done: boolean;
  dpae_date: string | null;
  dpae_ack_number: string | null;
}

const CONTRACT_COLUMNS = sql`c.id, c.terms, c.status, c.snapshot, c.content_hash,
  to_char(c.sent_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as sent_at, c.signed_on_paper, c.signer_name, c.signature,
  to_char(c.signed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as signed_at, c.signer_ip,
  c.dpae_done, c.dpae_date::text as dpae_date, c.dpae_ack_number`;

export interface MissionContext {
  assignmentId: string;
  extraId: string;
  extraEmail: string | null;
  extraToken: string | null;
  status: string;
  /** Compte titulaire de l'entreprise : propriétaire des lignes de contrat. */
  companyId: string;
  mission: MissionInfo;
  contract: ContractRow | null;
  /** false : tables absentes (migration 0030 pas appliquée). */
  available: boolean;
}

/** Une mission de l'entreprise du compte (extra et devis de l'entreprise), avec son contrat s'il existe. */
export async function missionOf(uid: string, assignmentId: string): Promise<MissionContext | null> {
  if (!isUuid(assignmentId)) return null;
  const { rows } = await db.execute<{
    id: string; extra_id: string; name: string; email: string | null; access_token: string | null; role: string | null; status: string;
    arrival_time: string | null; departure_time: string | null; mission_notes: string | null; rate: string | number | null;
    event_type: string | null; event_date: string | null; event_location: string | null; company_id: string;
  }>(sql`
    select ee.id, ee.extra_id, x.name, x.email, x.access_token, x.role, ee.status, ee.arrival_time, ee.departure_time, ee.mission_notes,
      coalesce(ee.hourly_rate, x.hourly_rate) as rate, q.event_type, q.event_date::text as event_date, q.event_location,
      ${companyOf(uid)} as company_id
    from public.event_extras ee
    join public.extras x on x.id = ee.extra_id
    join public.quotes q on q.id = ee.quote_id
    where ee.id = ${assignmentId}::uuid and x.user_id in ${companyIdsOf(uid)}
      and (q.user_id = ${uid}::uuid or q.owner_user_id in ${companyIdsOf(uid)})`);
  const r = rows[0];
  if (!r) return null;
  let contract: ContractRow | null = null;
  let available = true;
  try {
    const res = await db.execute<ContractRow & Record<string, unknown>>(sql`
      select ${CONTRACT_COLUMNS} from public.extra_contracts c where c.event_extra_id = ${r.id}::uuid`);
    contract = res.rows[0] ?? null;
  } catch (e) {
    if (!isMissingHrTable(e)) throw e;
    available = false;
  }
  const rate = r.rate == null || r.rate === '' ? null : Number(r.rate);
  return {
    assignmentId: r.id, extraId: r.extra_id, extraEmail: r.email?.trim() || null, extraToken: r.access_token, status: r.status,
    companyId: r.company_id, contract, available,
    mission: {
      extraName: r.name, role: r.role, eventType: r.event_type, eventDate: r.event_date, location: r.event_location,
      arrival: r.arrival_time, departure: r.departure_time, notes: r.mission_notes, hourlyRate: Number.isFinite(rate) ? rate : null,
    },
  };
}

/** Conditions du contrat : celles enregistrées pour ce contrat, sinon celles de la mission. */
export function termsOf(ctx: Pick<MissionContext, 'mission' | 'contract'>): ContractTerms {
  const base = defaultTerms(ctx.mission);
  const saved = ctx.contract?.terms ?? {};
  return {
    position: typeof saved.position === 'string' && saved.position.trim() ? saved.position : base.position,
    classification: typeof saved.classification === 'string' ? saved.classification || null : base.classification,
    hourly_rate: typeof saved.hourly_rate === 'number' ? saved.hourly_rate : base.hourly_rate,
    location: typeof saved.location === 'string' ? saved.location || null : base.location,
    start: saved.start !== undefined ? hhmm(saved.start) : base.start,
    end: saved.end !== undefined ? hhmm(saved.end) : base.end,
  };
}

export interface ContractBundle {
  employer: Employer;
  details: ExtraHrDetails;
  terms: ContractTerms;
  doc: ContractDoc;
  missing: string[];
  sheet: DpaeSection[];
  sheetMissing: string[];
}

/** Contrat calculé avec les données du moment (brouillon), fiche DPAE et ce qui manque. */
export async function contractBundle(ctx: MissionContext, issuedOn = parisDate(new Date())): Promise<ContractBundle> {
  const [employer, details] = await Promise.all([employerOf(ctx.companyId), hrDetailsOf(ctx.extraId)]);
  const terms = termsOf(ctx);
  const sheet = dpaeSheet(employer, details, terms, ctx.mission);
  return {
    employer, details, terms,
    doc: buildContract(employer, details, terms, ctx.mission, { issuedOn }),
    missing: contractMissing(employer, details, terms, ctx.mission),
    sheet, sheetMissing: dpaeMissing(sheet),
  };
}

/** JSON aux clés triées : la base (jsonb) ne garde pas l'ordre des clés, l'empreinte ne doit pas en dépendre. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** Empreinte du contrat figé : ce que l'extra signe. */
export const contractHash = (doc: ContractDoc) => crypto.createHash('sha256').update(canonical(doc)).digest('hex');

/** Crée la ligne de contrat d'une mission si elle n'existe pas ; renvoie son identifiant. */
export async function ensureContractRow(ctx: MissionContext): Promise<string> {
  const { rows } = await db.execute<{ id: string }>(sql`
    insert into public.extra_contracts (event_extra_id, owner_user_id) values (${ctx.assignmentId}::uuid, ${ctx.companyId}::uuid)
    on conflict (event_extra_id) do update set updated_at = extra_contracts.updated_at
    returning id`);
  return rows[0].id;
}

// ── Lien de l'extra ─────────────────────────────────────────────────────────

export interface ExtraContractView {
  id: string;
  status: 'envoye' | 'signe';
  doc: ContractDoc;
  hash: string | null;
  sentAt: string | null;
  signedAt: string | null;
  signerName: string | null;
  signature: string | null;
  signerIp: string | null;
  onPaper: boolean;
  companyId: string;
  extraName: string;
  assignmentId: string;
}

/** Contrat envoyé à l'extra qui détient ce lien, ou null. */
export async function contractForExtra(token: string, contractId: string): Promise<ExtraContractView | null> {
  if (!/^[a-f0-9]{16,64}$/i.test(token ?? '') || !isUuid(contractId)) return null;
  try {
    const { rows } = await db.execute<ContractRow & { owner_user_id: string; extra_name: string; event_extra_id: string } & Record<string, unknown>>(sql`
      select ${CONTRACT_COLUMNS}, c.owner_user_id, c.event_extra_id, x.name as extra_name
      from public.extra_contracts c
      join public.event_extras ee on ee.id = c.event_extra_id
      join public.extras x on x.id = ee.extra_id
      where c.id = ${contractId}::uuid and x.access_token = ${token} and c.status in ('envoye', 'signe') and c.snapshot is not null`);
    const c = rows[0];
    if (!c) return null;
    return {
      id: c.id, status: c.status as 'envoye' | 'signe', doc: c.snapshot!, hash: c.content_hash, sentAt: c.sent_at, signedAt: c.signed_at,
      signerName: c.signer_name, signature: c.signature, signerIp: c.signer_ip, onPaper: c.signed_on_paper,
      companyId: c.owner_user_id, extraName: c.extra_name, assignmentId: c.event_extra_id,
    };
  } catch (e) {
    if (isMissingHrTable(e)) return null;
    throw e;
  }
}

/** Contrats envoyés à l'extra, par mission (page de missions). Vide si la table manque. */
export async function contractsOfExtra(extraId: string): Promise<Record<string, { id: string; status: 'envoye' | 'signe' }>> {
  try {
    const { rows } = await db.execute<{ id: string; event_extra_id: string; status: 'envoye' | 'signe' }>(sql`
      select c.id, c.event_extra_id, c.status from public.extra_contracts c
      join public.event_extras ee on ee.id = c.event_extra_id
      where ee.extra_id = ${extraId}::uuid and c.status in ('envoye', 'signe') and c.snapshot is not null`);
    return Object.fromEntries(rows.map((r) => [r.event_extra_id, { id: r.id, status: r.status }]));
  } catch (e) {
    if (isMissingHrTable(e)) return {};
    throw e;
  }
}

// ── Rappels DPAE (tâche planifiée de 16 h) ─────────────────────────────────

export interface DpaeReminderRun { companies: number; missions: number; failed: number }

/**
 * Prévient le traiteur, une seule fois par mission, des DPAE à faire : missions confirmées dans les 8 prochains
 * jours (la DPAE n'est pas possible avant), pas encore déclarées. Un email par entreprise, sans aucune donnée
 * personnelle de l'extra (nom et mission seulement). null si les tables n'existent pas encore.
 */
export async function runDpaeReminders({ origin, now = new Date() }: { origin: string; now?: Date }): Promise<DpaeReminderRun | null> {
  const today = parisDate(now);
  const until = addDays(today, 8);
  let due: { id: string; extra_name: string; status: string; event_date: string; arrival_time: string | null; event_type: string | null;
    company_id: string; company_name: string | null; email: string | null; company_email: string | null }[];
  try {
    const { rows } = await db.execute<typeof due[number] & Record<string, unknown>>(sql`
      select ee.id, x.name as extra_name, ee.status, q.event_date::text as event_date, ee.arrival_time, q.event_type,
        cp.id as company_id, cp.company_name, cp.email, cp.company_email
      from public.event_extras ee
      join public.extras x on x.id = ee.extra_id
      join public.quotes q on q.id = ee.quote_id
      join public.profiles xp on xp.id = x.user_id
      join public.profiles cp on cp.id = coalesce(xp.parent_user_id, xp.id)
      left join public.extra_contracts c on c.event_extra_id = ee.id
      where ee.status in ('confirme', 'present') and q.event_date between ${today}::date and ${until}::date
        and coalesce(c.dpae_done, false) = false and c.dpae_reminded_at is null
        and cp.is_active and cp.deletion_requested_at is null
      order by q.event_date, ee.arrival_time`);
    due = rows;
  } catch (e) {
    if (isMissingHrTable(e)) return null;
    throw e;
  }

  const byCompany = new Map<string, typeof due>();
  for (const r of due) {
    if (isDemoUser(r.company_id)) continue;
    // Prise de poste déjà passée : plus de rappel (l'alerte reste dans l'app).
    const level = dpaeAlert({ eventDate: r.event_date, arrival: r.arrival_time, status: r.status, done: false }, now).level;
    if (!dpaeNeedsAction(level) || level === 'late') continue;
    byCompany.set(r.company_id, [...(byCompany.get(r.company_id) ?? []), r]);
  }

  const result: DpaeReminderRun = { companies: 0, missions: 0, failed: 0 };
  for (const [companyId, list] of byCompany) {
    const first = list[0];
    const to = first.company_email?.trim() || first.email;
    if (!to) continue;
    try {
      const mail = dpaeReminderEmail({
        companyName: first.company_name || 'Votre entreprise',
        missions: list.map((r) => ({ extraName: r.extra_name, eventType: r.event_type, eventDate: r.event_date, arrival: hhmm(r.arrival_time) })),
        link: `${origin}/extras`,
      });
      const { error } = await sendMail({ to, ...mail });
      if (error) { result.failed++; continue; }
      const stamp = now.toISOString();
      for (const r of list) {
        await db.execute(sql`
          insert into public.extra_contracts (event_extra_id, owner_user_id, dpae_reminded_at) values (${r.id}::uuid, ${companyId}::uuid, ${stamp})
          on conflict (event_extra_id) do update set dpae_reminded_at = coalesce(extra_contracts.dpae_reminded_at, excluded.dpae_reminded_at)`);
      }
      result.companies++;
      result.missions += list.length;
    } catch (e) {
      result.failed++;
      console.error('[dpae] rappel', companyId, e instanceof Error ? e.message : e);
    }
  }
  return result;
}

// ── Export RGPD ─────────────────────────────────────────────────────────────

/** Fiches administratives des extras, réglages d'employeur et contrats de l'entreprise (export des données). */
export async function exportHrData(uid: string): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  try {
    const { role } = await companyRole(uid);
    const settings = await db.execute(sql`select * from public.employer_settings where user_id = ${companyOf(uid)}`);
    if (settings.rows.length) out.employer_settings = settings.rows;
    // Les données personnelles des extras ne sont pas exportées pour un compte en consultation seule.
    if (role === 'lecture') return out;
    const hr = await db.execute(sql`select * from public.extra_hr_details where owner_user_id in ${companyIdsOf(uid)}`);
    if (hr.rows.length) out.extra_hr_details = hr.rows;
    const contracts = await db.execute(sql`select * from public.extra_contracts where owner_user_id in ${companyIdsOf(uid)}`);
    if (contracts.rows.length) out.extra_contracts = contracts.rows;
  } catch (e) {
    if (!isMissingHrTable(e)) throw e;
  }
  return out;
}

export function hrStatus(m: { status: string; event_date: string | null; arrival_time: string | null; contract_status: string | null; dpae_done: boolean | null }, now: Date): MissionHrStatus {
  return {
    contract: (m.contract_status as MissionHrStatus['contract']) ?? null,
    dpae: dpaeAlert({ eventDate: m.event_date, arrival: m.arrival_time, status: m.status, done: !!m.dpae_done }, now),
  };
}

