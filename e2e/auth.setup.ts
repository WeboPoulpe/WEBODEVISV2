import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { Client } from 'pg';
import { AUTH_FILE } from '../playwright.config';

/** Lit une variable de .env.local sans la placer dans l'environnement du serveur Next. */
function envLocal(name: string): string | undefined {
  const file = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return undefined;
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
}

// Ouvre une session une seule fois ; elle est réutilisée par tous les tests.
setup('session de test', async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (email && password) {
    // Compte de test fourni : connexion par le formulaire.
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    await page.context().storageState({ path: AUTH_FILE });
    return;
  }

  // Sinon : session signée avec le secret local, pour le compte qui possède le plus de devis
  // dans la base de développement. Aucun mot de passe n'est lu ni modifié.
  const secret = envLocal('NEXTAUTH_SECRET');
  const dbUrl = envLocal('DATABASE_URL');
  if (!secret || !dbUrl) throw new Error('NEXTAUTH_SECRET et DATABASE_URL sont requis dans .env.local');
  const db = new Client({ connectionString: dbUrl.replace('sslmode=require', 'sslmode=verify-full') });
  await db.connect();
  const { rows } = await db.query(
    `select u.id, u.email from public.users u
     left join public.quotes q on q.owner_user_id = u.id
     group by u.id, u.email order by count(q.id) desc limit 1`,
  );
  await db.end();
  if (rows.length === 0) throw new Error('Aucun compte dans la base de développement');

  const token = await encode({ token: { sub: rows[0].id, email: rows[0].email }, secret });
  await page.context().addCookies([{
    name: 'next-auth.session-token',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    expires: Math.floor(Date.now() / 1000) + 24 * 3600,
  }]);
  await page.goto('/');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
