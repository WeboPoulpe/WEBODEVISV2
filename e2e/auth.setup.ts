import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { AUTH_FILE } from '../playwright.config';
import { DEMO_USER_ID, sessionCookie, sql } from './helpers';

// Session commune des tests qui lisent (screens.spec.ts) : le compte de démonstration, un traiteur fictif
// rempli par scripts/seed-demo.mjs. Ce n'est le compte d'aucun client, et le serveur annule toute écriture
// qui en vient. Les tests qui écrivent n'utilisent pas cette session : ils créent leur propre compte d'essai.
setup('session de test (compte de démonstration)', async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const [demo] = await sql<{ email: string; prestations: number; events: number }>(
    `select u.email,
            (select count(*)::int from public.prestations where user_id = u.id) as prestations,
            (select count(*)::int from public.quotes where owner_user_id = u.id and status in ('valide', 'acompte', 'paye')) as events
     from public.users u where u.id = $1`, [DEMO_USER_ID]);
  if (!demo || !demo.prestations || !demo.events) {
    throw new Error('Compte de démonstration absent ou vide : lancer node scripts/seed-demo.mjs');
  }

  await page.context().addCookies([{ ...(await sessionCookie({ id: DEMO_USER_ID, email: demo.email })), expires: Math.floor(Date.now() / 1000) + 24 * 3600 }]);
  await page.goto('/');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
