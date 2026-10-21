'use server';

import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import {
  dpaeAlert, EMPTY_EMPLOYER_SETTINGS, hhmm, isValidIban, isValidNir, normalizeIban, normalizeNir,
  type ContractDoc, type ContractTerms, type DpaeAlert, type DpaeSection, type EmployerSettings, type ExtraHrDetails, type MissionHrStatus, type MissionInfo,
} from '@/lib/extraContract';
import { renderContractPdf } from '@/lib/extraContractPdf';
import { appOrigin, sendMail } from '@/lib/mail';
import { extraContractEmail } from '@/lib/mail/extraContracts';
import { loadPdfFonts } from '@/lib/pdfFonts';
import { companyIdsOf, companyOf } from './companyScope';
import {
  companyExtra, companyRole, contractBundle, contractHash, employerSettingsOf, ensureContractRow, hrDetailsOf, hrStatus, isMissingHrTable,
  isUuid, missionOf, UNAVAILABLE,
} from './extraHrCore';
import { parisDate } from './reminders';
import { requireUser, requireWriter } from './session';

// Contrats d'extra et DPAE : réglages d'employeur, fiche administrative d'un extra, contrat d'une mission (envoi,
// signature sur papier, nouveau contrat) et suivi de la DPAE. Réservé aux comptes de l'entreprise ; les données
// personnelles des extras ne sont ni lues ni modifiées par un compte en consultation seule.

const READ_ONLY = 'Votre accès est en consultation seule : les fiches administratives des extras ne vous sont pas accessibles.';
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '') || null;
const cleanText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || null;
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));

/** Le compte peut-il voir et modifier les données personnelles des extras ? */
async function hrAccess(uid: string): Promise<boolean> {
  return (await companyRole(uid)).role !== 'lecture';
}

// ── Réglages d'employeur ─────────────────────────────────────────────────────

export interface EmployerSettingsState {
  settings: EmployerSettings;
  /** Ce qui vient du profil (Paramètres, Identité) et se reporte sur les contrats. */
  identity: { company_name: string | null; siret: string | null; address: string | null; legal_form: string | null };
  /** Seul le titulaire (ou un gérant) change les réglages de l'entreprise. */
  canEdit: boolean;
  available: boolean;
}

export async function getEmployerSettings(): Promise<EmployerSettingsState> {
  const user = await requireUser();
  const { role, parent } = await companyRole(user.id);
  const { rows } = await db.execute<{ company_name: string | null; siret: string | null; company_siret: string | null; company_address: string | null; legal_form: string | null }>(sql`
    select company_name, siret, company_siret, company_address, legal_form from public.profiles where id = ${companyOf(user.id)}`);
  const p = rows[0];
  let available = true;
  let settings = { ...EMPTY_EMPLOYER_SETTINGS };
  try {
    await db.execute(sql`select 1 from public.employer_settings limit 1`);
    settings = await employerSettingsOf(parent ?? user.id);
  } catch (e) {
    if (!isMissingHrTable(e)) throw e;
    available = false;
  }
  return {
    settings,
    identity: { company_name: p?.company_name ?? null, siret: p?.siret || p?.company_siret || null, address: p?.company_address ?? null, legal_form: p?.legal_form ?? null },
    canEdit: available && !isDemoUser(user.id) && (!parent || role === 'gerant'),
    available,
  };
}

export async function saveEmployerSettings(input: Partial<EmployerSettings>): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const { role, parent } = await companyRole(user.id);
  if (parent && role !== 'gerant') return { error: 'Seul le titulaire du compte peut changer les réglages d’employeur.' };
  const s: EmployerSettings = {
    naf_code: clean(input.naf_code, 10)?.toUpperCase() ?? null,
    urssaf: clean(input.urssaf, 120),
    convention: clean(input.convention, 200),
    retirement_fund: cleanText(input.retirement_fund, 300),
    provident_fund: cleanText(input.provident_fund, 300),
    health_service: cleanText(input.health_service, 300),
    meal_terms: cleanText(input.meal_terms, 1000),
    trial_terms: cleanText(input.trial_terms, 500),
    signatory_name: clean(input.signatory_name, 120),
    signatory_title: clean(input.signatory_title, 120),
    signature_city: clean(input.signature_city, 120),
    extra_clauses: cleanText(input.extra_clauses, 4000),
  };
  if (s.naf_code && !/^\d{2}\.?\d{2}[A-Z]$/.test(s.naf_code)) return { error: 'Le code APE/NAF s’écrit comme 5621Z (quatre chiffres et une lettre).' };
  try {
    await db.execute(sql`
      insert into public.employer_settings (user_id, naf_code, urssaf, convention, retirement_fund, provident_fund, health_service, meal_terms,
        trial_terms, signatory_name, signatory_title, signature_city, extra_clauses, updated_at)
      values (${parent ?? user.id}::uuid, ${s.naf_code}, ${s.urssaf}, ${s.convention}, ${s.retirement_fund}, ${s.provident_fund}, ${s.health_service},
        ${s.meal_terms}, ${s.trial_terms}, ${s.signatory_name}, ${s.signatory_title}, ${s.signature_city}, ${s.extra_clauses}, now())
      on conflict (user_id) do update set naf_code = excluded.naf_code, urssaf = excluded.urssaf, convention = excluded.convention,
        retirement_fund = excluded.retirement_fund, provident_fund = excluded.provident_fund, health_service = excluded.health_service,
        meal_terms = excluded.meal_terms, trial_terms = excluded.trial_terms, signatory_name = excluded.signatory_name,
        signatory_title = excluded.signatory_title, signature_city = excluded.signature_city, extra_clauses = excluded.extra_clauses, updated_at = now()`);
    return { error: null };
  } catch (e) {
    if (isMissingHrTable(e)) return { error: UNAVAILABLE };
    console.error('[employeur] réglages', e instanceof Error ? e.message : e);
    return { error: 'Les réglages n’ont pas pu être enregistrés. Réessayez.' };
  }
}

// ── Fiche administrative d'un extra ─────────────────────────────────────────

export type HrDetailsResult =
  | { error: string; details?: undefined; canEdit?: undefined; available?: undefined }
  | { error: null; details: ExtraHrDetails; canEdit: boolean; available: boolean };

export async function getExtraHrDetails(extraId: string): Promise<HrDetailsResult> {
  const user = await requireUser();
  if (!(await hrAccess(user.id))) return { error: READ_ONLY };
  if (!(await companyExtra(user.id, extraId))) return { error: 'Extra introuvable.' };
  try {
    await db.execute(sql`select 1 from public.extra_hr_details limit 1`);
  } catch (e) {
    if (isMissingHrTable(e)) return { error: null, details: await hrDetailsOf(extraId), canEdit: false, available: false };
    throw e;
  }
  return { error: null, details: await hrDetailsOf(extraId), canEdit: !isDemoUser(user.id), available: true };
}

export async function saveExtraHrDetails(extraId: string, input: Partial<ExtraHrDetails>): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const extra = await companyExtra(user.id, extraId);
  if (!extra) return { error: 'Extra introuvable.' };

  const nir = normalizeNir(input.social_security_number);
  if (nir && !isValidNir(nir)) return { error: 'Le n° de sécurité sociale n’est pas valide : 15 chiffres, clé comprise.' };
  const iban = normalizeIban(input.iban);
  if (iban && !isValidIban(iban)) return { error: 'L’IBAN n’est pas valide. Vérifiez-le sur le RIB de l’extra.' };
  const birth = input.birth_date || null;
  if (birth && (!isDate(birth) || birth < '1900-01-01' || birth > parisDate(new Date()))) return { error: 'La date de naissance n’est pas valide.' };
  const sex = input.sex === 'F' || input.sex === 'M' ? input.sex : null;
  const v = {
    birth_name: clean(input.birth_name, 120), usage_name: clean(input.usage_name, 120), first_names: clean(input.first_names, 160),
    birth_city: clean(input.birth_city, 120), birth_department: clean(input.birth_department, 40)?.toUpperCase() ?? null,
    birth_country: clean(input.birth_country, 80), nationality: clean(input.nationality, 80),
    address: clean(input.address, 300), postal_code: clean(input.postal_code, 12), city: clean(input.city, 120),
  };
  try {
    await db.execute(sql`
      insert into public.extra_hr_details (extra_id, owner_user_id, birth_name, usage_name, first_names, sex, birth_date, birth_city, birth_department,
        birth_country, nationality, social_security_number, address, postal_code, city, iban, updated_at)
      values (${extra.id}::uuid, ${companyOf(user.id)}, ${v.birth_name}, ${v.usage_name}, ${v.first_names}, ${sex}, ${birth}::date, ${v.birth_city},
        ${v.birth_department}, ${v.birth_country}, ${v.nationality}, ${nir || null}, ${v.address}, ${v.postal_code}, ${v.city}, ${iban || null}, now())
      on conflict (extra_id) do update set birth_name = excluded.birth_name, usage_name = excluded.usage_name, first_names = excluded.first_names,
        sex = excluded.sex, birth_date = excluded.birth_date, birth_city = excluded.birth_city, birth_department = excluded.birth_department,
        birth_country = excluded.birth_country, nationality = excluded.nationality, social_security_number = excluded.social_security_number,
        address = excluded.address, postal_code = excluded.postal_code, city = excluded.city, iban = excluded.iban, updated_at = now()`);
    return { error: null };
  } catch (e) {
    if (isMissingHrTable(e)) return { error: UNAVAILABLE };
    console.error('[extras] fiche administrative', e instanceof Error ? e.message : e);
    return { error: 'La fiche n’a pas pu être enregistrée. Réessayez.' };
  }
}

// ── Contrat et DPAE d'une mission ───────────────────────────────────────────

export interface MissionHr {
  error: null;
  available: boolean;
  canEdit: boolean;
  extra: { id: string; name: string; email: string | null };
  mission: MissionInfo;
  terms: ContractTerms;
  /** Contrat affiché : celui envoyé (figé) s'il l'a été, sinon le brouillon calculé avec les données du moment. */
  doc: ContractDoc;
  missing: string[];
  contract: {
    id: string | null; status: 'brouillon' | 'envoye' | 'signe'; sentAt: string | null; signedAt: string | null;
    signerName: string | null; onPaper: boolean; link: string | null;
  };
  dpae: { done: boolean; date: string | null; ack: string | null; alert: DpaeAlert };
  sheet: DpaeSection[];
  sheetMissing: string[];
}

export async function getMissionHr(assignmentId: string): Promise<MissionHr | { error: string }> {
  const user = await requireUser();
  if (!(await hrAccess(user.id))) return { error: READ_ONLY };
  const ctx = await missionOf(user.id, assignmentId);
  if (!ctx) return { error: 'Mission introuvable.' };
  const b = await contractBundle(ctx);
  const c = ctx.contract;
  const status = c?.status ?? 'brouillon';
  const link = c && status !== 'brouillon' && ctx.extraToken ? `${await appOrigin()}/e/${ctx.extraToken}/contrat/${c.id}` : null;
  return {
    error: null,
    available: ctx.available,
    canEdit: ctx.available && !isDemoUser(user.id) && (await companyRole(user.id)).role !== 'lecture',
    extra: { id: ctx.extraId, name: ctx.mission.extraName, email: ctx.extraEmail },
    mission: ctx.mission,
    terms: b.terms,
    doc: c?.snapshot && status !== 'brouillon' ? c.snapshot : b.doc,
    missing: b.missing,
    contract: {
      id: c?.id ?? null, status, sentAt: c?.sent_at ?? null, signedAt: c?.signed_at ?? null, signerName: c?.signer_name ?? null,
      onPaper: !!c?.signed_on_paper, link,
    },
    dpae: {
      done: !!c?.dpae_done, date: c?.dpae_date ?? null, ack: c?.dpae_ack_number ?? null,
      alert: dpaeAlert({ eventDate: ctx.mission.eventDate, arrival: b.terms.start ?? ctx.mission.arrival, status: ctx.status, done: !!c?.dpae_done }, new Date()),
    },
    sheet: b.sheet,
    sheetMissing: b.sheetMissing,
  };
}

type Ctx = NonNullable<Awaited<ReturnType<typeof missionOf>>>;

/** Mission modifiable par le compte, tables présentes. */
async function writableMission(assignmentId: string): Promise<{ error: string; ctx?: undefined; uid?: undefined } | { error: null; ctx: Ctx; uid: string }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const ctx = await missionOf(user.id, assignmentId);
  if (!ctx) return { error: 'Mission introuvable.' };
  if (!ctx.available) return { error: UNAVAILABLE };
  return { error: null, ctx, uid: user.id };
}

/** Conditions du contrat ajustées pour cette mission (poste, classification, taux, lieu, horaires). */
export async function saveContractTerms(assignmentId: string, input: Partial<ContractTerms>): Promise<{ error: string | null }> {
  const w = await writableMission(assignmentId);
  if (w.error !== null) return { error: w.error };
  if (w.ctx.contract && w.ctx.contract.status !== 'brouillon') return { error: 'Le contrat a déjà été envoyé : préparez un nouveau contrat pour le modifier.' };
  const position = clean(input.position, 120);
  if (!position) return { error: 'Indiquez le poste occupé.' };
  const rate = input.hourly_rate == null || (input.hourly_rate as unknown) === '' ? null : Number(input.hourly_rate);
  if (rate != null && (!Number.isFinite(rate) || rate <= 0 || rate > 1000)) return { error: 'Le taux horaire n’est pas valide.' };
  const terms: ContractTerms = {
    position, classification: clean(input.classification, 120), hourly_rate: rate == null ? null : Math.round(rate * 100) / 100,
    location: clean(input.location, 300), start: hhmm(input.start), end: hhmm(input.end),
  };
  const id = await ensureContractRow(w.ctx);
  await db.execute(sql`update public.extra_contracts set terms = ${JSON.stringify(terms)}::jsonb, updated_at = now() where id = ${id}::uuid`);
  return { error: null };
}

export interface SendContractResult { error: string | null; emailed?: boolean; link?: string }

/** Fige le contrat et l'envoie à l'extra : PDF en pièce jointe et lien pour le signer en ligne. */
export async function sendContract(assignmentId: string): Promise<SendContractResult> {
  const w = await writableMission(assignmentId);
  if (w.error !== null) return { error: w.error };
  const { ctx } = w;
  if (ctx.contract?.status === 'signe') return { error: 'Ce contrat est déjà signé.' };
  if (!ctx.extraToken) return { error: 'Cet extra n’a pas de page de missions : modifiez sa fiche puis réessayez.' };
  const b = await contractBundle(ctx);
  if (b.missing.length) return { error: `Il manque : ${b.missing.join(', ')}.` };

  const id = await ensureContractRow(ctx);
  const hash = contractHash(b.doc);
  const { rows } = await db.execute<{ sent_at: string }>(sql`
    update public.extra_contracts set status = 'envoye', terms = ${JSON.stringify(b.terms)}::jsonb, snapshot = ${JSON.stringify(b.doc)}::jsonb,
      content_hash = ${hash}, sent_at = now(), signed_on_paper = false, signer_name = null, signature = null, signed_at = null,
      signer_ip = null, signer_user_agent = null, updated_at = now()
    where id = ${id}::uuid and status <> 'signe'
    returning to_char(sent_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as sent_at`);
  if (!rows[0]) return { error: 'Ce contrat est déjà signé.' };
  const link = `${await appOrigin()}/e/${ctx.extraToken}/contrat/${id}`;

  let emailed = false;
  if (ctx.extraEmail) {
    const { rows: p } = await db.execute<{ company_email: string | null; email: string | null }>(sql`
      select company_email, email from public.profiles where id = ${ctx.companyId}::uuid`);
    const pdf = await renderContractPdf(b.doc, await loadPdfFonts(), { hash, sentAt: rows[0].sent_at });
    const mail = extraContractEmail({ companyName: b.employer.company_name || 'Votre employeur', extraName: ctx.mission.extraName, eventType: ctx.mission.eventType, eventDate: ctx.mission.eventDate, link });
    const res = await sendMail({
      to: ctx.extraEmail, fromName: b.employer.company_name || undefined, replyTo: p[0]?.company_email || p[0]?.email || null, ...mail,
      attachments: [{ filename: contractFileName(ctx.mission.extraName, ctx.mission.eventDate), content: Buffer.from(pdf).toString('base64') }],
    });
    emailed = !res.error;
  }
  return { error: null, emailed, link };
}

const contractFileName = (name: string, date: string | null) =>
  `contrat-${name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}${date ? `-${date.slice(0, 10)}` : ''}.pdf`;

/** Le contrat a été signé sur papier : noté signé (et figé s'il ne l'était pas). */
export async function markContractSigned(assignmentId: string): Promise<{ error: string | null }> {
  const w = await writableMission(assignmentId);
  if (w.error !== null) return { error: w.error };
  const { ctx } = w;
  if (ctx.contract?.status === 'signe') return { error: null };
  const b = await contractBundle(ctx);
  const id = await ensureContractRow(ctx);
  const frozen = ctx.contract?.snapshot && ctx.contract.status === 'envoye';
  const doc = frozen ? ctx.contract!.snapshot! : b.doc;
  await db.execute(sql`
    update public.extra_contracts set status = 'signe', signed_on_paper = true, signed_at = now(),
      snapshot = ${JSON.stringify(doc)}::jsonb, content_hash = ${contractHash(doc)},
      ${frozen ? sql`` : sql`terms = ${JSON.stringify(b.terms)}::jsonb,`} updated_at = now()
    where id = ${id}::uuid`);
  return { error: null };
}

/** Repart d'un contrat en brouillon : l'envoi et la signature précédents sont effacés, l'ancien lien ne marche plus. */
export async function resetContract(assignmentId: string): Promise<{ error: string | null }> {
  const w = await writableMission(assignmentId);
  if (w.error !== null) return { error: w.error };
  if (!w.ctx.contract) return { error: null };
  await db.execute(sql`
    update public.extra_contracts set status = 'brouillon', snapshot = null, content_hash = null, sent_at = null, signed_on_paper = false,
      signer_name = null, signature = null, signed_at = null, signer_ip = null, signer_user_agent = null, updated_at = now()
    where id = ${w.ctx.contract.id}::uuid`);
  return { error: null };
}

/** DPAE faite (ou pas), avec le n° d'accusé de réception de l'URSSAF et sa date. */
export async function saveDpae(assignmentId: string, input: { done: boolean; date?: string | null; ack?: string | null }): Promise<{ error: string | null }> {
  const w = await writableMission(assignmentId);
  if (w.error !== null) return { error: w.error };
  const done = input.done === true;
  const date = done ? (input.date || parisDate(new Date())) : null;
  if (date && (!isDate(date) || date > parisDate(new Date()))) return { error: 'La date de la DPAE n’est pas valide.' };
  const ack = done ? clean(input.ack, 60) : null;
  const id = await ensureContractRow(w.ctx);
  await db.execute(sql`
    update public.extra_contracts set dpae_done = ${done}, dpae_date = ${date}::date, dpae_ack_number = ${ack}, updated_at = now()
    where id = ${id}::uuid`);
  return { error: null };
}

/**
 * Statut du contrat et alerte DPAE de plusieurs missions de l'entreprise (liste des extras, onglet d'un événement).
 * Aucune donnée personnelle : accessible aussi en consultation seule.
 */
export async function getHrStatuses(assignmentIds: string[]): Promise<Record<string, MissionHrStatus>> {
  const user = await requireUser();
  const ids = (Array.isArray(assignmentIds) ? assignmentIds : []).filter(isUuid).slice(0, 500);
  if (!ids.length) return {};
  const idList = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  const query = (withContracts: boolean) => db.execute<{ id: string; status: string; event_date: string | null; arrival_time: string | null; contract_status: string | null; dpae_done: boolean | null }>(sql`
    select ee.id, ee.status, q.event_date::text as event_date, coalesce(${withContracts ? sql`nullif(c.terms->>'start', '')` : sql`null`}, ee.arrival_time) as arrival_time,
      ${withContracts ? sql`c.status as contract_status, c.dpae_done` : sql`null as contract_status, null as dpae_done`}
    from public.event_extras ee
    join public.extras x on x.id = ee.extra_id
    join public.quotes q on q.id = ee.quote_id
    ${withContracts ? sql`left join public.extra_contracts c on c.event_extra_id = ee.id` : sql``}
    where ee.id in (${idList}) and x.user_id in ${companyIdsOf(user.id)}`);
  let rows;
  try {
    rows = (await query(true)).rows;
  } catch (e) {
    if (!isMissingHrTable(e)) throw e;
    rows = (await query(false)).rows;
  }
  const now = new Date();
  return Object.fromEntries(rows.map((r) => [r.id, hrStatus(r, now)]));
}
