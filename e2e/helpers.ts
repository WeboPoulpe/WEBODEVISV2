import fs from 'node:fs';
import path from 'node:path';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { Client } from 'pg';
import { DEMO_USER_ID } from '../lib/demo';

// La base de .env.local est la production : les tests n'y touchent jamais un compte réel.
// - Les tests qui écrivent travaillent sur un compte d'essai créé pour eux (createAccount / withAccount),
//   supprimé à la fin ; chaque suppression est filtrée par l'identifiant de ce compte.
// - La session commune (auth.setup.ts) ouvre le compte de démonstration, un traiteur fictif dont les
//   écritures sont annulées par le serveur ; elle ne sert qu'aux tests qui lisent.

// La session commune est toujours disponible (compte de démonstration, voir auth.setup.ts).
export const hasTestAccount = true;

export { DEMO_USER_ID };

/** Domaine réservé aux essais : aucun email n'y part, et global-teardown.ts nettoie les comptes restés. */
export const TEST_EMAIL_DOMAIN = 'test.webodevis.local';
const TEST_EMAIL_PATTERN = /^e2e-[^@]+@test\.webodevis\.local$/;

/** Lit une variable de .env.local sans la placer dans l'environnement du serveur Next. */
export function envLocal(name: string): string {
  const file = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return '';
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return (line ?? '').slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
}

export async function sql<T>(query: string, params: unknown[] = []): Promise<T[]> {
  const db = new Client({ connectionString: envLocal('DATABASE_URL').replace('sslmode=require', 'sslmode=verify-full') });
  await db.connect();
  try {
    return (await db.query(query, params)).rows as T[];
  } finally {
    await db.end();
  }
}

/** Adresse d'un compte d'essai : e2e-<quoi>-<horodatage>@test.webodevis.local */
export const testEmail = (kind: string) => `e2e-${kind}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${TEST_EMAIL_DOMAIN}`;

export type TestAccount = { id: string; email: string };

/** Crée un compte d'essai (users + profiles), prêt à l'emploi. */
export async function createAccount(kind: string, profile: { firstName?: string; companyName?: string | null; role?: 'user' | 'admin' } = {}): Promise<TestAccount> {
  const email = testEmail(kind);
  const [user] = await sql<{ id: string }>(`insert into public.users (email, password_hash) values ($1, 'x') returning id`, [email]);
  await sql(
    `insert into public.profiles (id, email, first_name, company_name, role, is_active, has_completed_onboarding) values ($1, $2, $3, $4, $5, true, true)`,
    [user.id, email, profile.firstName ?? 'Essai', profile.companyName ?? null, profile.role ?? 'user'],
  );
  return { id: user.id, email };
}

/**
 * Supprime un compte d'essai et tout ce qui lui appartient. Refuse tout compte dont l'adresse n'est pas
 * une adresse d'essai : aucune ligne d'un compte réel ne peut partir d'ici.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const [user] = await sql<{ email: string }>(`select email from public.users where id = $1`, [userId]);
  if (!user) return;
  if (!TEST_EMAIL_PATTERN.test(user.email)) throw new Error(`Refus : ${userId} n'est pas un compte d'essai`);
  const mine = `(select id from public.quotes where owner_user_id = $1 or user_id = $1)`;
  for (const query of [
    `delete from public.event_ingredients where quote_id in ${mine}`,
    `delete from public.event_extras where quote_id in ${mine}`,
    `delete from public.quotes where owner_user_id = $1 or user_id = $1`,
    `delete from public.quote_folders where owner_user_id = $1`,
    `delete from public.prospect_requests where owner_user_id = $1 or user_token in (select token from public.user_prospect_tokens where user_id = $1)`,
    `delete from public.user_prospect_tokens where user_id = $1`,
    `delete from public.customer_contacts where owner_user_id = $1`,
    `delete from public.customers where owner_user_id = $1 or user_id = $1`,
    `delete from public.prestations where user_id = $1`,
    `delete from public.ingredients where user_id = $1 or owner_user_id = $1`,
    `delete from public.extras where user_id = $1`,
    `delete from public.suppliers where user_id = $1 or owner_user_id = $1`,
    `delete from public.devis_templates where user_id = $1`,
    `delete from public.quote_templates where user_id = $1 or owner_user_id = $1`,
    `delete from public.service_materials where user_id = $1`,
    `delete from public.notifications where user_id = $1`,
    `delete from public.users where id = $1 and email like 'e2e-%@${TEST_EMAIL_DOMAIN}'`,
  ]) await sql(query, [userId]);
}

/** Supprime le compte d'essai portant cette adresse (créé par l'app, par exemple via /register). */
export async function deleteAccountByEmail(email: string): Promise<void> {
  if (!TEST_EMAIL_PATTERN.test(email)) throw new Error(`Refus : ${email} n'est pas une adresse d'essai`);
  const [user] = await sql<{ id: string }>(`select id from public.users where email = $1`, [email]);
  if (user) await deleteAccount(user.id);
}

/** Cookie de session NextAuth signé avec le secret local, pour ce compte. */
export async function sessionCookie(account: TestAccount) {
  const token = await encode({ token: { sub: account.id, email: account.email }, secret: envLocal('NEXTAUTH_SECRET') });
  return {
    name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/',
    httpOnly: true, sameSite: 'Lax' as const, expires: Math.floor(Date.now() / 1000) + 3600,
  };
}

/** Navigateur connecté à ce compte (sans reprendre la session commune). */
export async function openSession(browser: Browser, account: TestAccount, viewport: { width: number; height: number } | null = { width: 1440, height: 900 }): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: viewport ?? undefined, storageState: { cookies: [], origins: [] } });
  await context.addCookies([await sessionCookie(account)]);
  return context;
}

/** Un compte d'essai, un navigateur connecté ; tout est supprimé à la fin, même en cas d'échec. */
export async function withAccount(
  browser: Browser,
  kind: string,
  run: (page: Page, userId: string) => Promise<void>,
  options: { firstName?: string; companyName?: string | null; role?: 'user' | 'admin'; viewport?: { width: number; height: number } | null } = {},
) {
  const account = await createAccount(kind, options);
  let context: BrowserContext | undefined;
  try {
    context = await openSession(browser, account, options.viewport === undefined ? { width: 1440, height: 900 } : options.viewport);
    await run(await context.newPage(), account.id);
  } finally {
    // Le contexte peut déjà être fermé (test arrivé au bout de son temps) : la suppression du compte passe quand même.
    await context?.close().catch(() => undefined);
    await deleteAccount(account.id);
  }
}

/** Devis d'un compte d'essai ; `status: 'valide'` en fait un événement. */
export async function createQuote(userId: string, quote: {
  client_name: string; status?: string; guest_count?: number; event_type?: string; days?: number;
  services?: unknown[]; content_html?: string | null;
}): Promise<string> {
  const [q] = await sql<{ id: string }>(
    `insert into public.quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, services, content_html)
     values ($1, $1, $2, current_date + $3::int, $4, $5, $6, $7::jsonb, $8) returning id`,
    [userId, quote.client_name, quote.days ?? 30, quote.event_type ?? 'Mariage', quote.guest_count ?? 40,
      quote.status ?? 'devis_a_faire', JSON.stringify(quote.services ?? []), quote.content_html ?? null],
  );
  return q.id;
}

/** Capture pleine page rangée par viewport : e2e/screenshots/<mobile|tablet|desktop>/<nom>.png */
export async function shot(page: Page, testInfo: TestInfo, name: string) {
  const file = path.join(__dirname, 'screenshots', testInfo.project.name, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

/** Largeur (px) dont la page déborde horizontalement du viewport ; 0 = pas de débordement. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  });
}

/** Éléments visibles qui dépassent du bord droit du viewport (les pires d'abord). */
export async function offscreenElements(page: Page, limit = 5): Promise<string[]> {
  return page.evaluate((max) => {
    const out: { over: number; label: string }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const over = Math.round(r.right - window.innerWidth);
      if (over <= 1) continue;
      // Ignore ce qui vit dans un conteneur à défilement horizontal voulu.
      let p = el.parentElement;
      let scrollable = false;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll') { scrollable = true; break; }
        p = p.parentElement;
      }
      if (scrollable) continue;
      const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      out.push({ over, label: `${el.tagName.toLowerCase()}${text ? ` « ${text} »` : ''} (+${over}px)` });
    }
    return out.sort((a, b) => b.over - a.over).slice(0, max).map((o) => o.label);
  }, limit);
}
