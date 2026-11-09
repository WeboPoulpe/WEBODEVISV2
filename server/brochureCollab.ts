'use server';

// Travailler à plusieurs sur une brochure du Studio : versions (automatiques ou nommées, et retour à l'une d'elles),
// commentaires entre collègues, validation par un collègue avant l'envoi, et modèles de pages de l'entreprise.

import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { brochure_comments, brochure_versions, brochures, profiles, studio_templates } from '@/db/schema';
import { parseStudio, sanitizeStudio, type StudioDoc, type StudioPage } from '@/lib/brochureStudio';
import { pushToUser } from '@/lib/push';
import { companyIdsOf } from './companyScope';
import { requireUser, requireWriter } from './session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = 'Brochure introuvable.';
/** Versions automatiques gardées par brochure (les nommées restent toutes). */

async function own(userId: string, id: string) {
  if (!UUID.test(id ?? '')) return null;
  const [b] = await db.select().from(brochures).where(and(eq(brochures.id, id), sql`${brochures.owner_user_id} in ${companyIdsOf(userId)}`)).limit(1);
  return b ?? null;
}

const nameOf = (p: { first_name: string | null; last_name: string | null; email: string | null } | undefined) =>
  (p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Un collègue' : 'Un collègue');

async function names(ids: string[]): Promise<Map<string, string>> {
  const valid = [...new Set(ids.filter(Boolean))];
  if (!valid.length) return new Map();
  const rows = await db.select({ id: profiles.id, first_name: profiles.first_name, last_name: profiles.last_name, email: profiles.email })
    .from(profiles).where(inArray(profiles.id, valid));
  return new Map(rows.map((r) => [r.id, nameOf(r)]));
}

/** Les membres de l'entreprise (titulaire et collaborateurs), sauf `except`. */
async function colleagues(userId: string, except: string): Promise<string[]> {
  const rows = await db.select({ id: profiles.id }).from(profiles).where(and(sql`${profiles.id} in ${companyIdsOf(userId)}`, ne(profiles.id, except)));
  return rows.map((r) => r.id);
}

const push = (users: string[], brochureId: string, title: string, body: string) =>
  Promise.all(users.map((u) => pushToUser(u, { title, body, url: `/brochures/${brochureId}`, tag: `brochure-collab-${brochureId}` }).catch(() => 0)));

// ── Versions ────────────────────────────────────────────────────────────────

export interface VersionSummary { id: string; label: string | null; auto: boolean; createdAt: string; author: string; pages: number; cover: StudioPage | null }

export async function listVersions(brochureId: string): Promise<VersionSummary[] | null> {
  const user = await requireUser();
  const b = await own(user.id, brochureId);
  if (!b) return null;
  const rows = await db.select().from(brochure_versions).where(eq(brochure_versions.brochure_id, b.id)).orderBy(desc(brochure_versions.created_at)).limit(100);
  const who = await names(rows.map((r) => r.created_by ?? ''));
  return rows.map((r) => {
    const doc = parseStudio(r.studio);
    return { id: r.id, label: r.label, auto: r.auto, createdAt: r.created_at, author: who.get(r.created_by ?? '') ?? '—', pages: doc?.pages.length ?? 0, cover: doc?.pages[0] ?? null };
  });
}

/** Enregistre les pages actuelles comme une version nommée (« Avant le salon », « Version validée »…). */
export async function saveVersion(brochureId: string, label: string): Promise<{ error: string | null }> {
  const user = await requireWriter();
  const b = await own(user.id, brochureId);
  if (!b) return { error: NOT_FOUND };
  const doc = parseStudio(b.studio);
  if (!doc) return { error: 'Cette brochure n’a pas encore de pages du Studio.' };
  const name = String(label ?? '').trim().slice(0, 80);
  if (!name) return { error: 'Donnez un nom à la version.' };
  await db.insert(brochure_versions).values({ brochure_id: b.id, studio: doc, label: name, auto: false, created_by: user.id });
  return { error: null };
}

/** Revient à une version : les pages actuelles sont d'abord gardées (« Avant de revenir à… »). */
export async function restoreVersion(versionId: string): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (!UUID.test(versionId ?? '')) return { error: 'Version introuvable.' };
  const [v] = await db.select().from(brochure_versions).where(eq(brochure_versions.id, versionId)).limit(1);
  const b = v ? await own(user.id, v.brochure_id) : null;
  if (!v || !b) return { error: 'Version introuvable.' };
  const doc = parseStudio(v.studio);
  if (!doc) return { error: 'Cette version est illisible.' };
  const current = parseStudio(b.studio);
  const when = new Date(v.created_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (current) await db.insert(brochure_versions).values({ brochure_id: b.id, studio: current, label: `Avant de revenir à ${v.label ?? `la version du ${when}`}`, auto: false, created_by: user.id });
  await db.update(brochures).set({ studio: sanitizeStudio(doc), editor_mode: 'studio', updated_at: new Date().toISOString() }).where(eq(brochures.id, b.id));
  return { error: null };
}

// ── Commentaires ────────────────────────────────────────────────────────────

export interface CommentView { id: string; pageId: string | null; author: string; mine: boolean; body: string; resolved: boolean; createdAt: string }

export async function listComments(brochureId: string): Promise<CommentView[] | null> {
  const user = await requireUser();
  const b = await own(user.id, brochureId);
  if (!b) return null;
  const rows = await db.select().from(brochure_comments).where(eq(brochure_comments.brochure_id, b.id)).orderBy(asc(brochure_comments.created_at));
  const who = await names(rows.map((r) => r.author_id));
  return rows.map((r) => ({ id: r.id, pageId: r.page_id, author: who.get(r.author_id) ?? 'Un collègue', mine: r.author_id === user.id, body: r.body, resolved: r.resolved, createdAt: r.created_at }));
}

export async function addComment(brochureId: string, input: { pageId?: string | null; body: string }): Promise<{ error: string | null }> {
  const user = await requireUser();
  const b = await own(user.id, brochureId);
  if (!b) return { error: NOT_FOUND };
  const body = String(input.body ?? '').trim().slice(0, 2000);
  if (!body) return { error: 'Écrivez votre commentaire.' };
  const pageId = typeof input.pageId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(input.pageId) ? input.pageId : null;
  await db.insert(brochure_comments).values({ brochure_id: b.id, page_id: pageId, author_id: user.id, body });
  const who = (await names([user.id])).get(user.id) ?? 'Un collègue';
  await push(await colleagues(user.id, user.id), b.id, `Commentaire sur « ${b.name} »`, `${who} : ${body.slice(0, 120)}`);
  return { error: null };
}

export async function setCommentResolved(id: string, resolved: boolean): Promise<{ error: string | null }> {
  const user = await requireUser();
  if (!UUID.test(id ?? '')) return { error: 'Commentaire introuvable.' };
  const [c] = await db.select().from(brochure_comments).where(eq(brochure_comments.id, id)).limit(1);
  if (!c || !(await own(user.id, c.brochure_id))) return { error: 'Commentaire introuvable.' };
  await db.update(brochure_comments).set({ resolved: !!resolved }).where(eq(brochure_comments.id, c.id));
  return { error: null };
}

export async function deleteComment(id: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  if (!UUID.test(id ?? '')) return { error: 'Commentaire introuvable.' };
  const [c] = await db.select().from(brochure_comments).where(eq(brochure_comments.id, id)).limit(1);
  if (!c || !(await own(user.id, c.brochure_id))) return { error: 'Commentaire introuvable.' };
  if (c.author_id !== user.id) return { error: 'Seul son auteur peut supprimer un commentaire.' };
  await db.delete(brochure_comments).where(eq(brochure_comments.id, c.id));
  return { error: null };
}

// ── Validation avant envoi ──────────────────────────────────────────────────

export interface ReviewView { status: 'none' | 'pending' | 'approved' | 'changes'; note: string | null; requestedBy: string | null; by: string | null; at: string | null; canDecide: boolean }

export async function getReview(brochureId: string): Promise<ReviewView | null> {
  const user = await requireUser();
  const b = await own(user.id, brochureId);
  if (!b) return null;
  const who = await names([b.review_requested_by ?? '', b.review_by ?? '']);
  const alone = (await colleagues(user.id, user.id)).length === 0;
  return {
    status: (['pending', 'approved', 'changes'].includes(b.review_status) ? b.review_status : 'none') as ReviewView['status'],
    note: b.review_note, requestedBy: who.get(b.review_requested_by ?? '') ?? null, by: who.get(b.review_by ?? '') ?? null, at: b.review_at,
    // On ne valide pas sa propre demande, sauf seul dans l'entreprise.
    canDecide: b.review_status === 'pending' && (b.review_requested_by !== user.id || alone),
  };
}

export async function requestReview(brochureId: string, note?: string): Promise<{ error: string | null }> {
  const user = await requireWriter();
  const b = await own(user.id, brochureId);
  if (!b) return { error: NOT_FOUND };
  await db.update(brochures).set({
    review_status: 'pending', review_note: String(note ?? '').trim().slice(0, 1000) || null, review_requested_by: user.id, review_by: null, review_at: new Date().toISOString(),
  }).where(eq(brochures.id, b.id));
  const who = (await names([user.id])).get(user.id) ?? 'Un collègue';
  await push(await colleagues(user.id, user.id), b.id, 'Brochure à valider', `${who} demande votre validation de « ${b.name} » avant l’envoi.`);
  return { error: null };
}

export async function decideReview(brochureId: string, decision: 'approved' | 'changes', note?: string): Promise<{ error: string | null }> {
  const user = await requireWriter();
  const b = await own(user.id, brochureId);
  if (!b) return { error: NOT_FOUND };
  if (b.review_status !== 'pending') return { error: 'Aucune validation n’est demandée pour cette brochure.' };
  const alone = (await colleagues(user.id, user.id)).length === 0;
  if (b.review_requested_by === user.id && !alone) return { error: 'Un collègue doit valider : vous avez fait la demande.' };
  if (decision !== 'approved' && decision !== 'changes') return { error: 'Décision inconnue.' };
  const text = String(note ?? '').trim().slice(0, 1000) || null;
  if (decision === 'changes' && !text) return { error: 'Dites ce qui est à changer.' };
  await db.update(brochures).set({ review_status: decision, review_note: text, review_by: user.id, review_at: new Date().toISOString() }).where(eq(brochures.id, b.id));
  const who = (await names([user.id])).get(user.id) ?? 'Un collègue';
  if (b.review_requested_by && b.review_requested_by !== user.id) {
    await push([b.review_requested_by], b.id, decision === 'approved' ? 'Brochure validée' : 'Changements demandés',
      decision === 'approved' ? `${who} a validé « ${b.name} » : vous pouvez l’envoyer.` : `${who} : ${text}`);
  }
  return { error: null };
}

// ── Modèles de pages de l'entreprise ─────────────────────────────────────────

export interface TemplateView { id: string; name: string; page: StudioPage; author: string; createdAt: string }

export async function listStudioTemplates(): Promise<TemplateView[]> {
  const user = await requireUser();
  const rows = await db.select().from(studio_templates).where(sql`${studio_templates.owner_user_id} in ${companyIdsOf(user.id)}`)
    .orderBy(desc(studio_templates.created_at)).limit(200);
  const who = await names(rows.map((r) => r.created_by ?? ''));
  return rows.flatMap((r) => {
    const page = parseStudio({ pages: [r.page] })?.pages.find((p) => !p.form);
    return page ? [{ id: r.id, name: r.name, page, author: who.get(r.created_by ?? '') ?? '—', createdAt: r.created_at }] : [];
  });
}

export async function saveStudioTemplate(name: string, page: unknown): Promise<{ error: string | null }> {
  const user = await requireWriter();
  const label = String(name ?? '').trim().slice(0, 80);
  if (!label) return { error: 'Donnez un nom au modèle.' };
  const doc: StudioDoc | null = parseStudio({ pages: [page] });
  const clean = doc ? sanitizeStudio(doc).pages.find((p) => !p.form) : null;
  if (!clean) return { error: 'Page illisible.' };
  const [me] = await db.select({ parent: profiles.parent_user_id }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(studio_templates).where(sql`${studio_templates.owner_user_id} in ${companyIdsOf(user.id)}`);
  if (n >= 200) return { error: 'L’entreprise a déjà 200 modèles : supprimez-en avant d’en ajouter.' };
  await db.insert(studio_templates).values({ owner_user_id: me?.parent ?? user.id, name: label, page: clean, created_by: user.id });
  return { error: null };
}

export async function deleteStudioTemplate(id: string): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (!UUID.test(id ?? '')) return { error: 'Modèle introuvable.' };
  const done = await db.delete(studio_templates).where(and(eq(studio_templates.id, id), sql`${studio_templates.owner_user_id} in ${companyIdsOf(user.id)}`)).returning({ id: studio_templates.id });
  return done.length ? { error: null } : { error: 'Modèle introuvable.' };
}
