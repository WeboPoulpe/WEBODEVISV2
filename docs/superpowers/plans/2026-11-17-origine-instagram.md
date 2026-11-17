# Origine Instagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compter les clics sur les liens Instagram (`/ig`, `/ig/<libellé>`), retenir l'origine pendant la visite, l'enregistrer sur les demandes et les comptes, et l'afficher dans l'admin (Demandes, Comptes, bloc Instagram dans Statistiques).

**Architecture:** Une route `/ig` met un clic dans le paquet de `site_visits` puis redirige avec `?o=`. Un composant racine range l'origine dans `sessionStorage` ; la mesure d'audience et les trois formulaires l'envoient ; le serveur la revalide et l'écrit dans trois colonnes `origin` (migration 0059). L'admin lit ces colonnes.

**Tech Stack:** Next.js App Router, Drizzle ORM (Neon Postgres), Vitest + PGlite (`db/testDb.ts`), Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-17-origine-instagram-design.md`

## Global Constraints

- Aucun cookie, aucun bandeau : l'origine vit dans `sessionStorage` (clé `wd-origine`) et dans les lignes en base.
- Format d'origine : `instagram` ou `instagram:<libellé>`, libellé `^[a-z0-9-]{1,30}$`. Tout le reste est ignoré (null).
- Destination de `/ig` : chemin interne commençant par `/` et pas par `//`, sans `\`, 200 caractères max ; sinon `/site`.
- Un clic ne réveille pas la base : il passe par `recordHit` (paquet en mémoire), comme `/api/stats`.
- Visiteur connecté (cookie `next-auth.session-token` ou `__Secure-next-auth.session-token`) : redirigé, jamais compté.
- Migration additive **0059**, testée sur PGlite (`npm test`), appliquée par `npm run db:migrate` avant tout push.
- Partir des colonnes de `db/schema/tables.ts`, jamais du type `Profile`.
- Lecture de `window` / `sessionStorage` dans un composant : seulement dans un `useEffect` ou via `useHydrated`, chaque accès dans un `try/catch`.
- Avant tout push sur `main` : `npx next build` doit passer. Ne pas pousser sans l'accord de Maxence.

## Review Focus

1. `?o=` ou `?vers=` piégés (`javascript:`, `//exemple.com`, `/\exemple.com`, 5 000 caractères) : origine ignorée, destination `/site`. Tests en tâche 1.
2. Origine forgée envoyée à une action serveur (`instagram:<script>`, `facebook`) : enregistrée à null, la demande passe quand même. Test en tâche 5.
3. Lien `/ig` ouvert par quelqu'un de l'équipe connecté : redirection normale, aucune ligne. Test en tâche 3.
4. `sessionStorage` indisponible (navigation privée, stockage bloqué) : pas d'erreur, la visite et les formulaires marchent sans origine. Test en tâche 4.
5. Adresse écrite avec une casse différente entre la demande de démo et le compte créé dans l'admin (`Camille@X.fr` / `camille@x.fr`) : l'origine est reprise. Test en tâche 5.

---

### Task 1: Format d'origine, migration 0059 et colonnes

**Files:**
- Create: `lib/origine.ts`, `lib/origine.test.ts`, `db/migrations/0059_origine.sql`
- Modify: `db/migrations/meta/_journal.json` (entrée idx 59, tag `0059_origine`, `when` 1795200000000), `db/schema/tables.ts` (`site_visits`, `site_requests`, `profiles` : colonne `origin: text()` ; `site_visits_event_check` avec `'clic'`), `lib/siteStats.ts` (`SiteEvent` et `SITE_EVENTS` avec `'clic'`)

**Interfaces:**
- Produces:
  - `parseOrigin(raw: unknown): string | null`
  - `originFromPath(segments: string[] | undefined): string` (`[]` → `'instagram'`, `['lancement']` → `'instagram:lancement'`, libellé invalide → `'instagram'`)
  - `safeDestination(raw: string | null): string` (défaut `'/site'`)
  - `originLabel(origin: string): string` (`'instagram'` → `'Instagram · bio'`, `'instagram:lancement'` → `'Instagram · lancement'`)
  - `ORIGIN_KEY = 'wd-origine'`
  - `readStoredOrigin(): string | null` et `storeOrigin(origin: string): void` (accès `sessionStorage` protégés par `try/catch`)

- [ ] **Step 1: Write the failing tests** in `lib/origine.test.ts`

```ts
it('accepte bio et libellés', () => {
  expect(parseOrigin('instagram')).toBe('instagram');
  expect(parseOrigin('instagram:lancement')).toBe('instagram:lancement');
});
it('refuse le reste', () => {
  for (const v of ['facebook', 'instagram:', 'instagram:A', 'instagram:<script>', 'instagram:' + 'a'.repeat(31), 42, null]) expect(parseOrigin(v)).toBeNull();
});
it('libellé du chemin', () => {
  expect(originFromPath(undefined)).toBe('instagram');
  expect(originFromPath(['demo-noel'])).toBe('instagram:demo-noel');
  expect(originFromPath(['Pas Bon'])).toBe('instagram');
});
it('destination interne seulement', () => {
  expect(safeDestination('/demo')).toBe('/demo');
  for (const v of [null, 'https://x.fr', '//x.fr', '/\\x.fr', 'javascript:alert(1)', '/' + 'a'.repeat(300)]) expect(safeDestination(v)).toBe('/site');
});
it('libellé lisible', () => {
  expect(originLabel('instagram')).toBe('Instagram · bio');
  expect(originLabel('instagram:lancement')).toBe('Instagram · lancement');
});
it('stockage absent : pas d’erreur', () => {
  vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } });
  expect(readStoredOrigin()).toBeNull();
  expect(() => storeOrigin('instagram')).not.toThrow();
});
```

- [ ] **Step 2: Run** `npx vitest run lib/origine.test.ts` — Expected: FAIL (module introuvable).
- [ ] **Step 3: Implement `lib/origine.ts`** avec les signatures ci-dessus.
- [ ] **Step 4: Write `0059_origine.sql`** (rejouable) : `ALTER TABLE ... ADD COLUMN IF NOT EXISTS origin text` sur `site_visits`, `site_requests`, `profiles` ; `DROP CONSTRAINT IF EXISTS site_visits_event_check` puis recréation avec `'view','demo','contact','signup','clic'` ; `CREATE INDEX IF NOT EXISTS idx_site_visits_origin_day ON public.site_visits (day) WHERE origin IS NOT NULL`. Séparer les instructions par `--> statement-breakpoint`. Mettre à jour le journal et `tables.ts`.
- [ ] **Step 5: Run** `npm test` — Expected: tout passe, y compris les tests PGlite existants (la migration se rejoue dans `createTestDb`).
- [ ] **Step 6: Commit** `feat(origine): format d'origine Instagram et migration 0059`

### Task 2: Mesure d'audience avec origine et événement « clic »

**Files:**
- Modify: `server/siteStats.ts` (`buildRow`), `app/api/stats/route.ts`
- Test: `server/siteStats.origin.test.ts`

**Interfaces:**
- Consumes: `parseOrigin` (tâche 1).
- Produces: `buildRow(input: { path: string; referrer?: string | null; event?: SiteEvent; origin?: unknown }, ctx: HitContext, now?: Date)` ; la ligne porte `origin` (validée) et, si `origin` n'est pas null, `source = 'reseaux'`.

- [ ] **Step 1: Write the failing tests**

```ts
it('origine valide : écrite, source réseaux', () => {
  const r = buildRow({ path: '/site', origin: 'instagram:lancement' }, ctx);
  expect(r).toMatchObject({ origin: 'instagram:lancement', source: 'reseaux' });
});
it('origine invalide : ignorée', () => {
  expect(buildRow({ path: '/site', origin: 'facebook' }, ctx)?.origin).toBeNull();
});
it('événement clic accepté', () => {
  expect(buildRow({ path: '/ig', event: 'clic', origin: 'instagram' }, ctx)?.event).toBe('clic');
});
```

- [ ] **Step 2: Run** `npx vitest run server/siteStats.origin.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** dans `buildRow` ; dans `/api/stats`, lire `body.origin` et le passer (la route continue de refuser `clic`, `contact`, `signup` venus du navigateur).
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(origine): la mesure d'audience retient l'origine`

### Task 3: Route `/ig`

**Files:**
- Create: `app/ig/[[...libelle]]/route.ts`, `app/ig/route.test.ts`
- Modify: `middleware.ts` (ajouter `'/ig'` à `SITE_PREFIXES`)

**Interfaces:**
- Consumes: `originFromPath`, `safeDestination` (tâche 1), `buildRow`, `recordHit` (tâche 2).
- Produces: `GET(request: NextRequest, ctx: { params: Promise<{ libelle?: string[] }> }): Promise<NextResponse>` → 302 vers `<destination>?o=<origine>` (en conservant les autres paramètres de la destination). `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.

- [ ] **Step 1: Write the failing tests** (mock de `@/server/siteStats` : `recordHit` espionné, `buildRow` réel ou simulé)

```ts
it('bio : compte et redirige', async () => {
  const res = await GET(req('/ig'), { params: Promise.resolve({}) });
  expect(res.status).toBe(302);
  expect(res.headers.get('location')).toMatch(/\/site\?o=instagram$/);
  expect(recordHit).toHaveBeenCalledWith(expect.objectContaining({ event: 'clic', origin: 'instagram' }));
});
it('story et destination', async () => {
  const res = await GET(req('/ig/lancement?vers=/demo'), { params: Promise.resolve({ libelle: ['lancement'] }) });
  expect(res.headers.get('location')).toMatch(/\/demo\?o=instagram%3Alancement$/);
});
it('destination externe refusée', async () => {
  const res = await GET(req('/ig?vers=//exemple.com'), { params: Promise.resolve({}) });
  expect(res.headers.get('location')).toMatch(/\/site\?o=instagram$/);
});
it('connecté : redirigé sans compter', async () => {
  const res = await GET(req('/ig', { cookie: 'next-auth.session-token=x' }), { params: Promise.resolve({}) });
  expect(res.status).toBe(302);
  expect(recordHit).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run** `npx vitest run app/ig/route.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** la route (même lecture d'IP, de navigateur et de cookies que `app/api/stats/route.ts` ; `path` de la ligne = `/ig` ou `/ig/<libellé>`).
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(origine): lien court /ig qui compte le clic`

### Task 4: Capture de l'origine dans le navigateur

**Files:**
- Create: `components/site/OrigineCapture.tsx`
- Modify: `app/layout.tsx` (monter `<OrigineCapture />` dans `body`), `components/site/SiteAnalytics.tsx` (ajouter `origin: readStoredOrigin()` à chaque envoi)
- Test: ajout dans `lib/origine.test.ts`

**Interfaces:**
- Consumes: `parseOrigin`, `storeOrigin`, `readStoredOrigin` (tâche 1).
- Produces: `captureOriginFromUrl(href: string): { origin: string | null; cleaned: string | null }` dans `lib/origine.ts` (cleaned = adresse sans `o`, null si rien à retirer). `OrigineCapture` : au montage et à chaque changement de chemin, appelle `captureOriginFromUrl(window.location.href)`, range l'origine valide, puis `history.replaceState(history.state, '', cleaned)` ; rend `null`.

- [ ] **Step 1: Write the failing tests**

```ts
it('capte et nettoie', () => {
  expect(captureOriginFromUrl('https://webodevis.fr/site?o=instagram%3Alancement&x=1'))
    .toEqual({ origin: 'instagram:lancement', cleaned: '/site?x=1' });
});
it('origine invalide : retirée, pas gardée', () => {
  expect(captureOriginFromUrl('https://webodevis.fr/demo?o=facebook')).toEqual({ origin: null, cleaned: '/demo' });
});
it('rien à faire', () => {
  expect(captureOriginFromUrl('https://webodevis.fr/demo')).toEqual({ origin: null, cleaned: null });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/origine.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `captureOriginFromUrl`, `OrigineCapture`, le montage et l'envoi dans `SiteAnalytics`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(origine): l'origine suit la visite (sessionStorage)`

### Task 5: Origine enregistrée par les formulaires et les comptes

**Files:**
- Modify: `server/site.ts` (`SiteRequestInput.origin?: string | null`, colonne `origin`, passée à `recordEventNow`), `server/demo.ts` (`DemoAccessInput.origin?: string | null`, colonne `origin`), `server/auth.ts` (`registerUser` : paramètre `origin?: string | null`), `server/admin.ts` (`createAccount`), `server/siteStats.ts` (`recordEventNow(event, path, ctx, origin?: string | null)`), `context/AuthContext.tsx` (`signUp` transmet `readStoredOrigin()`), `components/site/ContactForm.tsx`, `app/demo/DemoStart.tsx` (envoient `readStoredOrigin()`)
- Create: `server/origine.ts` (fonction partagée), `server/origine.test.ts`

**Interfaces:**
- Consumes: `parseOrigin`, `readStoredOrigin` (tâche 1).
- Produces: `originForEmail(email: string, given: unknown): Promise<string | null>` dans `server/origine.ts` : `parseOrigin(given)` si valide, sinon l'origine de la plus récente `site_requests` dont `lower(email)` = l'adresse normalisée et `origin is not null`, sinon null. Utilisée par `registerUser` et `createAccount` pour remplir `profiles.origin`. Les formulaires de contact et de démo écrivent seulement `parseOrigin(input.origin)`.

- [ ] **Step 1: Write the failing tests** (PGlite, même montage que `server/adminStats.test.ts`)

```ts
it('contact : origine valide gardée, forgée ignorée', async () => {
  await submitSiteRequest({ ...contact, email: 'a@t.fr', origin: 'instagram' });
  await submitSiteRequest({ ...contact, email: 'b@t.fr', origin: 'instagram:<script>' });
  expect(await originOf('site_requests', 'a@t.fr')).toBe('instagram');
  expect(await originOf('site_requests', 'b@t.fr')).toBeNull();
});
it('compte créé dans l’admin : reprend l’origine de la demande, casse différente', async () => {
  await pg.exec(`insert into site_requests (kind, name, email, message, origin) values ('demo', 'Camille', 'Camille@X.fr', '-', 'instagram:lancement')`);
  await createAccount({ email: 'camille@x.fr', firstName: 'Camille', lastName: 'M', companyName: 'Traiteur', modules: [] });
  expect(await originOf('profiles', 'camille@x.fr')).toBe('instagram:lancement');
});
it('inscription sans origine de visite : reprise par l’adresse', async () => {
  await pg.exec(`insert into site_requests (kind, name, email, message, origin) values ('message', 'J', 'j@t.fr', '-', 'instagram')`);
  await registerUser({ email: 'j@t.fr', password: 'secret1', firstName: 'J', lastName: 'R' });
  expect(await originOf('profiles', 'j@t.fr')).toBe('instagram');
});
```

(`requestDemoAccess` passe par un défi anti-robot : tester son écriture de `origin` avec un ticket valide si `server/demo.ts` expose de quoi en fabriquer, sinon le couvrir par le test bout en bout de la tâche 7.)

- [ ] **Step 2: Run** `npx vitest run server/origine.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `originForEmail` et les modifications listées.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(origine): demandes et comptes gardent leur origine`

### Task 6: Admin — étiquettes et bloc Instagram

**Files:**
- Create: `components/admin/OriginPill.tsx`, `server/instagramStats.test.ts`
- Modify: `server/siteStats.ts` (`getInstagramStats`), `server/admin.ts` (`AdminAccount.origin: string | null`, colonne lue dans `listAccounts` ; `adminInstagramStats(days)`), `app/admin/demandes/page.tsx`, `app/admin/comptes/page.tsx`, `app/admin/statistiques/page.tsx`

**Interfaces:**
- Consumes: `originLabel` (tâche 1).
- Produces:
  - `OriginPill({ origin }: { origin: string | null })` : rien si null, sinon une pastille `originLabel(origin)` dans le style des pastilles de l'admin (`pill` de `@/components/ui/kit`).
  - `interface InstagramStats { totals: { clics: number; visiteurs: number; demos: number; contacts: number; inscriptions: number }; daily: { day: string; clics: number }[]; liens: { origin: string; clics: number }[]; personnes: { kind: 'demo' | 'contact' | 'compte'; name: string; company: string | null; origin: string; at: string; id: string }[] }`
  - `getInstagramStats(days: number): Promise<InstagramStats>` (jours sur le fuseau Europe/Paris comme `getSiteStats` ; `daily` complet, jours sans clic à 0) et `adminInstagramStats(days: number)` (avec `requireAdmin`, appelle `flushVisits` avant, comme `adminSiteStats`).

- [ ] **Step 1: Write the failing tests** (PGlite)

```ts
it('compte clics, visiteurs, conversions et liste les personnes', async () => {
  // Jeu d'essai : aujourd'hui 3 clics 'instagram' (visiteurs v1, v1, v2) ; il y a 10 jours 1 clic 'instagram:lancement' (v3) ;
  // 1 vue sans origine ; 1 site_requests demo origin 'instagram' ; 1 site_requests message sans origine ; 1 profil 'instagram:lancement'
  const s = await getInstagramStats(30);
  expect(s.totals).toEqual({ clics: 4, visiteurs: 3, demos: 1, contacts: 0, inscriptions: 1 });
  expect(s.liens).toEqual([{ origin: 'instagram', clics: 3 }, { origin: 'instagram:lancement', clics: 1 }]);
  expect(s.personnes.map((p) => p.kind).sort()).toEqual(['compte', 'demo']);
  expect(s.daily).toHaveLength(30);
});
it('hors période : non compté', async () => {
  expect((await getInstagramStats(7)).totals.clics).toBe(3);
});
```

- [ ] **Step 2: Run** `npx vitest run server/instagramStats.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `getInstagramStats` / `adminInstagramStats`, `OriginPill`, puis les écrans : pastille sur la ligne et dans le détail (Demandes), pastille sur le compte (Comptes), bloc « Instagram » sous les statistiques du site avec les 5 tuiles, les clics par jour (réutiliser le style de `DailyChart`), « Par lien », et « Ils se sont fait connaître » (lien vers `/admin/demandes` ou `/admin/comptes`). Même sélecteur de période que la page.
- [ ] **Step 4: Run** `npm test` puis `npx tsc --noEmit` — Expected: PASS, aucune erreur de type.
- [ ] **Step 5: Commit** `feat(origine): étiquettes et bloc Instagram dans l'admin`

### Task 7: Confidentialité, liens Instagram et vérification complète

**Files:**
- Modify: `app/confidentialite/page.tsx` (phrase de la spec, section mesure d'audience), `video/instagram/robot/LISEZMOI.md` (bio = `webodevis.fr/ig`, stories = `webodevis.fr/ig/<libellé>`)
- Test: `e2e/origine.spec.ts` (Playwright, config par défaut `playwright.config.ts`)

- [ ] **Step 1: Write the e2e test**: ouvrir `/ig/test-e2e?vers=/demo`, vérifier l'arrivée sur `/demo` sans `o` dans l'adresse et `sessionStorage['wd-origine'] === 'instagram:test-e2e'` ; remplir le formulaire de démo jusqu'à l'envoi si le défi le permet en test, puis, connecté en admin, voir la pastille « Instagram · test-e2e » dans Demandes.
- [ ] **Step 2: Run** `npx playwright test e2e/origine.spec.ts` — Expected: PASS.
- [ ] **Step 3: Update** la page de confidentialité et `LISEZMOI.md`.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `npx next build` — Expected: tout passe.
- [ ] **Step 5: Commit** `docs(origine): confidentialité et liens Instagram`
- [ ] **Step 6: Avant le push (avec l'accord de Maxence)** : `npm run db:migrate` (applique 0059 sur la base), puis pousser.
