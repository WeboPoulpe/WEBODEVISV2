# WeboCoins et traduction par Webo — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un portefeuille de WeboCoins par entreprise (200 offerts par mois, pièces offertes par l'admin) et la traduction des prestations au choix gratuite (MyMemory) ou par Webo (Claude Haiku 5.5) à 1 WeboCoin la fiche.

**Architecture:** Deux tables (portefeuille, journal) et des réglages dans `app_settings` ; un module serveur `server/weboWallet.ts` qui seul touche au solde (débit atomique et idempotent, remboursement, allocation mensuelle paresseuse) ; un module `server/weboTranslate.ts` qui réserve une pièce par fiche, appelle Claude côté serveur, rend la pièce en cas d'échec et dit au navigateur quelles fiches passer en gratuit ; l'interface (pièce W, solde dans l'en-tête, page « Mes WeboCoins », choix du mode là où on traduit) et une page d'admin.

**Tech Stack:** Next.js 15 (app router, actions serveur), Drizzle + Neon (PGlite en test), `@anthropic-ai/sdk` (à installer), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-webocoins-traduction-webo-design.md`

## Global Constraints

- 1 € = 100 WeboCoins ; nombres entiers ; solde jamais négatif.
- Réglages par défaut : `webo_monthly_coins` 200 ; `webo_translation_price` 1 ; `webo_action_coefficient` 3 ; `webo_translation_cap` 500 (fiches Webo par entreprise et par mois) ; `webo_usd_eur` 0,92 ; `webo_low_balance` 20.
- Mois civil à l'heure de Paris (`Europe/Paris`), clé `YYYY-MM`. Pièces du mois remises au premier usage du mois ; le reste du mois précédent est perdu. Débit : pièces du mois d'abord, puis pièces gardées.
- Compte de démonstration (`isDemoUser`) : 0 pièce du mois, aucune dépense possible.
- Modèle : `claude-haiku-5-5` ; prix 0,10 $ / 0,50 $ par million de jetons (entrée / sortie) ; clé `ANTHROPIC_API_KEY`, lue côté serveur seulement.
- Le portefeuille appartient à l'entreprise : clé = `companyOf(uid)` (server/companyScope.ts). Dépenser exige `requireWriter()` ; voir le solde, `requireUser()`.
- Textes en français, ton WeboDevis ; « WeboCoin(s) », « Webo » ; pièce : cercle doré discret avec un W, palette crème #FBF7F0 / vert sapin #1C2621 / terracotta #B4502D — pas de style crypto.
- Aucun vrai appel payant dans les tests : Claude simulé (vi.mock en unitaire ; `WEBO_FAKE=1` côté serveur pour l'e2e, ignoré si `NODE_ENV === 'production'`).
- Migrations additives et idempotentes (commentaires en français), testées sur PGlite, appliquées par `npm run db:migrate` avant toute mise sur `main` ; `npx next build` puis `rm -rf .next/cache`.
- Tests e2e lancés avec `playwright.brochures.config.ts` (port 3002 ; le 3001 appartient à un autre projet).

## Review Focus

1. Deux traductions lancées en même temps sur la même entreprise avec 1 seule pièce → une seule part chez Webo, l'autre en gratuit ; solde 0, jamais −1. (Task 2)
2. Double clic / action rejouée avec la même clé d'unicité → un seul débit. (Task 2)
3. Claude renvoie du HTML piégé (`<script>`, `onerror=`) ou une réponse illisible → HTML nettoyé ; réponse illisible = échec, pièce rendue, fiche en gratuit. (Task 3)
4. Changement de mois entre deux usages (31 → 1er, heure de Paris, y compris à 23 h 30 UTC le 31) → pièces du mois remises à 200, pièces gardées intactes. (Task 2)
5. Collaborateur en lecture seule ou compte démo qui appelle l'action de traduction Webo → rien n'est débité, toutes les fiches reviennent « en gratuit ». (Task 3)

---

### Task 1: Tables, réglages et calculs purs

**Files:**
- Modify: `db/schema/tables.ts` (deux tables), `server/settings.ts` (réglages Webo)
- Create: `db/migrations/0036_webocoins.sql` (via `npx drizzle-kit generate`, puis rendue idempotente à la main), `lib/webocoins.ts`, `lib/webocoins.test.ts`

**Interfaces:**
- Produces (schéma) :
  - `webo_wallets` : `company_id uuid` PK → `profiles.id` on delete cascade ; `month_key text not null default ''` ; `month_coins integer not null default 0` ; `kept_coins integer not null default 0` ; `monthly_override integer` (null = valeur générale) ; `translation_mode text not null default 'webo'` check `in ('webo','free')` ; `updated_at` ; checks `month_coins >= 0`, `kept_coins >= 0`, `monthly_override is null or monthly_override >= 0`.
  - `webo_ledger` : `id uuid` PK ; `company_id uuid not null` → profiles cascade ; `user_id uuid` ; `created_at timestamptz default now()` ; `kind text` check `in ('allocation','debit','refund','gift','purchase')` ; `coins integer not null` (signé : débit négatif) ; `from_month integer not null default 0` ; `from_kept integer not null default 0` ; `reason text not null` ; `idempotency_key text` unique (partiel, non null) ; `model text`, `input_tokens integer`, `output_tokens integer`, `cost_usd numeric(12,6)` ; index `(company_id, created_at desc)`.
  - `server/settings.ts` : `export interface WeboSettings { monthlyCoins: number; translationPrice: number; actionCoefficient: number; translationCap: number; usdEur: number; lowBalance: number }`, `getWeboSettings(): Promise<WeboSettings>`, `setWeboSettings(patch: Partial<WeboSettings>): Promise<void>` (clés `webo_monthly_coins`, …, valeurs bornées : entiers ≥ 0, coefficient 1–20, usdEur 0,5–2).
- Produces (`lib/webocoins.ts`, sans base) :
  - `monthKeyParis(d: Date): string` → `'2026-10'`.
  - `nextMonthStartParis(d: Date): Date` (date de renouvellement affichée).
  - `splitDebit(month: number, kept: number, amount: number): { fromMonth: number; fromKept: number } | null` (null si insuffisant).
  - `haikuCostUsd(u: { input: number; output: number; cacheWrite?: number; cacheRead?: number }): number` — 0,10 $/M entrée, 0,50 $/M sortie, écriture cache ×1,25, lecture ×0,1.
  - `coinsForCost(costUsd: number, coefficient: number, usdEur: number): number` — `Math.max(1, Math.ceil(costUsd * usdEur * 100 * coefficient))`.
  - `formatCoins(n: number): string` → `'1 234 W'`.

- [ ] **Step 1: Write the failing tests** `lib/webocoins.test.ts` :
  - `monthKeyParis(new Date('2026-10-31T23:30:00Z'))` = `'2026-11'` ; `('2026-10-31T21:59:00Z')` = `'2026-10'`.
  - `splitDebit(3, 10, 5)` = `{ fromMonth: 3, fromKept: 2 }` ; `splitDebit(3, 1, 5)` = `null` ; `splitDebit(0, 0, 0)` = `{0,0}`.
  - `haikuCostUsd({ input: 4000, output: 2000 })` ≈ `0.0014` ; `coinsForCost(0.0014, 3, 0.92)` = `1` ; `coinsForCost(0.03, 3, 0.92)` = `9`.
  - Migration : sur `createTestDb()`, insérer un portefeuille avec `kept_coins = -1` échoue ; deux lignes de journal avec la même `idempotency_key` échouent ; deux avec clé nulle passent.
- [ ] **Step 2: Run** `npx vitest run lib/webocoins.test.ts` — Expected: FAIL (module absent).
- [ ] **Step 3: Implement** le schéma, la migration (`create table if not exists`, contraintes dans des blocs `do $$ … if not exists … $$`), `lib/webocoins.ts`, les réglages.
- [ ] **Step 4: Run** `npx vitest run lib/webocoins.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(webo): tables et calculs des WeboCoins`.

### Task 2: Le portefeuille (serveur)

**Files:**
- Create: `server/weboWallet.ts`, `server/weboWallet.test.ts`

**Interfaces:**
- Consumes: Task 1 (tables, `getWeboSettings`, `monthKeyParis`, `splitDebit`), `companyOf`, `isDemoUser`.
- Produces (fonctions internes, non exportées comme actions — fichier `import 'server-only'`, pas `'use server'`) :
  - `walletOf(companyId: string, now?: Date): Promise<{ month: number; kept: number; total: number; monthKey: string; mode: 'webo' | 'free'; renewsAt: string }>` — crée la ligne au besoin et applique l'allocation du mois (ligne `allocation` au journal, montant = `monthly_override ?? monthlyCoins`, 0 pour la démo ; ligne au journal seulement si > 0).
  - `debitCoins(companyId: string, input: { userId: string; amount: number; reason: string; idempotencyKey: string }, now?: Date): Promise<{ ok: true; ledgerId: string } | { ok: false; reason: 'balance' | 'demo' }>` — un seul `update … set month_coins = month_coins - $a, kept_coins = kept_coins - $b where company_id = $c and month_key = $k and month_coins >= $a and kept_coins >= $b returning` dans une transaction avec l'insertion au journal ; même clé déjà au journal → renvoie `ok: true` avec le débit existant, sans re-débiter ; échec de l'update (course) → relire et réessayer une fois.
  - `refundDebit(ledgerId: string): Promise<void>` — rend exactement `from_month` (si le mois n'a pas changé, sinon perdu comme le reste du mois) et `from_kept`, ligne `refund` (clé `refund:<ledgerId>`, donc une seule fois).
  - `recordUsage(ledgerId: string, u: { model: string; input: number; output: number; costUsd: number }): Promise<void>`.
  - `giftCoins(companyId: string, input: { byUserId: string; coins: number; reason: string }): Promise<void>` — ajoute aux pièces gardées, ligne `gift`.
  - `ledgerOf(companyId: string, page: number): Promise<{ rows: LedgerRow[]; more: boolean }>` (25 par page, plus récent d'abord ; `LedgerRow = { id; created_at; kind; coins; reason; user_name: string | null }`).
  - Actions `'use server'` dans `server/weboWalletActions.ts` : `getMyWallet()` (`requireUser`) → `walletOf(companyOf)` + `lowBalance` ; `getMyLedger(page)` ; `setTranslationMode(mode)` (`requireWriter`).

- [ ] **Step 1: Write the failing tests** `server/weboWallet.test.ts` (PGlite, mocks comme `server/brochures.test.ts`) :
  - `'premier usage du mois : 200 pièces, une seule allocation même appelé deux fois'`.
  - `'débit : pièces du mois puis pièces gardées'` (mois 3 + gardées 10, débit 5 → 0 / 8 ; journal `from_month 3, from_kept 2`).
  - `'solde insuffisant : refusé, rien ne bouge'`.
  - `'même clé d’unicité : un seul débit'`.
  - `'deux débits simultanés pour la dernière pièce : un seul passe'` (`Promise.all` de deux `debitCoins` à 1 pièce avec solde 1 → un `ok: true`, un `balance` ; solde final 0).
  - `'remboursement : rendu une seule fois'`.
  - `'nouveau mois (31 octobre 23 h 30 UTC) : pièces du mois remises, gardées intactes'`.
  - `'démo : 0 pièce du mois, débit refusé (demo)'`.
  - `'réglage propre du compte : 0 coupe l’allocation, 500 la remplace'`.
  - `'deux comptes de la même entreprise partagent le portefeuille ; un autre ne le voit pas'` (via `getMyWallet` avec `current` changé).
- [ ] **Step 2: Run** `npx vitest run server/weboWallet.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(webo): portefeuille de WeboCoins`.

### Task 3: Traduction par Webo (serveur)

**Files:**
- Create: `lib/menuGlossary.ts` (glossaire déplacé de `lib/prestationCard.ts` : `MENU_TERMS`, `MENU_TITLES`, plus une liste `KEEP_FRENCH` de termes laissés en français si la carte les garde : à défaut, ceux d'aujourd'hui), `lib/webo/claude.ts`, `server/weboTranslate.ts`, `server/weboTranslate.test.ts`
- Modify: `lib/prestationCard.ts` (importe le glossaire), `package.json` (`npm i @anthropic-ai/sdk`)

**Interfaces:**
- Consumes: Task 2 (`walletOf`, `debitCoins`, `refundDebit`, `recordUsage`), `getWeboSettings`, `haikuCostUsd`, `sanitizeHtml` (lib/sanitize).
- Produces:
  - `lib/webo/claude.ts` (`server-only`) : `translateFicheFrToEn(f: { name: string; html: string }): Promise<{ name: string; html: string; usage: { input: number; output: number; cacheWrite: number; cacheRead: number } }>` — `new Anthropic()`, `client.messages.create` avec `model: 'claude-haiku-5-5'`, `max_tokens: 16000`, `output_config: { effort: 'low', format: { type: 'json_schema', schema: { type: 'object', properties: { name: { type: 'string' }, html: { type: 'string' } }, required: ['name', 'html'], additionalProperties: false } } }`, système figé avec `cache_control: { type: 'ephemeral' }` (consigne + glossaire ; rien de variable) ; lève une erreur si `stop_reason` ≠ `end_turn` ou si le JSON est illisible. Avec `WEBO_FAKE=1` hors production : renvoie `{ name: 'EN ' + name, html: html.replace(/>([^<]+)</g, '>EN $1<') , usage: { input: 100, output: 50, cacheWrite: 0, cacheRead: 0 } }` sans réseau. Vérifier la forme exacte d'`output_config.format` contre la doc du skill `claude-api` (typescript/claude-api/tool-use.md, Structured outputs) avant d'écrire.
  - `server/weboTranslate.ts` (`'use server'`) : `translateWithWebo(fiches: { key: string; requestId: string; name: string; html: string }[]): Promise<{ results: ({ key: string; ok: true; name: string; html: string } | { key: string; ok: false; why: 'balance' | 'cap' | 'error' | 'readonly' | 'demo' | 'off' })[]; spent: number; balance: number }>` — au plus 40 fiches par appel ; `requireUser` puis rôle (lecture → toutes `readonly`) ; démo → `demo` ; clé absente → `off` ; fiche par fiche, dans l'ordre : plafond du mois atteint (débits de traduction du mois ≥ `translationCap`) → `cap` ; `debitCoins(translationPrice, idempotencyKey: requestId, reason: 'Traduction : <nom>')` refusé → `balance` ; appel Claude échoué → `refundDebit` + `error` ; succès → `recordUsage` + HTML `sanitizeHtml` + nom en texte brut (≤ 200 car.). Jusqu'à 4 appels Claude en parallèle.

- [ ] **Step 1: Write the failing tests** `server/weboTranslate.test.ts` (`vi.mock('@/lib/webo/claude')`) :
  - `'3 fiches, 2 pièces : 2 par Webo, la 3e en gratuit (balance) ; solde 0'`.
  - `'Claude échoue sur une fiche : pièce rendue, fiche en error, les autres traduites'`.
  - `'HTML renvoyé piégé : nettoyé'` (`<p onclick="x()">Hi</p><script>a()</script>` → contient `<p>Hi</p>`, ni `script` ni `onclick`).
  - `'même requestId rejoué : un seul débit'`.
  - `'plafond du mois atteint : cap, rien débité'` (cap réglé à 1).
  - `'lecture seule, démo : rien débité'` (`company_role = 'lecture'` ; `isDemoUser`).
  - `'coût réel noté au journal'` (model `claude-haiku-5-5`, jetons, `cost_usd` > 0).
  - Dans `lib/webo/claude.test.ts` : réponse simulée de l'API avec `stop_reason: 'max_tokens'` → rejet ; texte non JSON → rejet (mock de `@anthropic-ai/sdk`).
- [ ] **Step 2: Run** `npx vitest run server/weboTranslate.test.ts lib/webo` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS ; `npx vitest run lib/prestationCard` toujours vert.
- [ ] **Step 5: Commit** `feat(webo): traduction des fiches par Webo`.

### Task 4: La pièce, le solde et « Mes WeboCoins »

**Files:**
- Create: `components/webo/WeboCoin.tsx` (SVG : disque doré dégradé #E4C77A → #B8913A, liseré #8C6A22, « W » serif crème ; prop `size`), `components/webo/CoinBalance.tsx` (pastille de l'en-tête : pièce + solde, lien vers `/parametres/webocoins`, `aria-label="Solde : N WeboCoins"`, alerte terracotta sous `lowBalance`), `app/(app)/parametres/webocoins/page.tsx`, `components/webo/WalletContext.tsx` (`useWallet(): { wallet; refresh(): Promise<void> }`, chargé une fois, rafraîchi après une traduction)
- Modify: `components/layout/Header.tsx` (pastille à gauche de la cloche), `app/(app)/parametres/page.tsx` (lien « Mes WeboCoins » + réglage « Traduction : gratuite / Webo » pour les rédacteurs), layout de l'app (fournisseur du contexte)
- Test: `e2e/webocoins.spec.ts`

**Interfaces:**
- Consumes: `getMyWallet`, `getMyLedger`, `setTranslationMode` (Task 2).
- Produces: `useWallet()`, `<WeboCoin size />`.

- [ ] **Step 1: Write the failing e2e** `e2e/webocoins.spec.ts`, `test('solde dans l’en-tête, page Mes WeboCoins, pièces offertes au journal')` : compte d'essai (`withAccount`) → l'en-tête montre `getByLabel('Solde : 200 WeboCoins')` ; on insère en base un `gift` de 50 (`kept_coins += 50` + journal « Geste commercial ») → après rechargement « Solde : 250 WeboCoins » ; la page `/parametres/webocoins` montre « 200 pièces du mois », la date de renouvellement, « Geste commercial » au journal, le bouton « Recharger » avec « bientôt » ; Paramètres : choisir « Gratuite » puis recharger → toujours « Gratuite ». Téléphone 360 px : pas de défilement horizontal ; captures `e2e/screenshots/webocoins-*.png`.
- [ ] **Step 2: Run** `npx playwright test -c playwright.brochures.config.ts e2e/webocoins.spec.ts --project=desktop --reporter=line` — Expected: FAIL.
- [ ] **Step 3: Implement.** Regarder les captures : pièce lisible à 16 px, pas de style crypto.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(webo): la pièce W, le solde et Mes WeboCoins`.

### Task 5: Le choix gratuite / Webo là où on traduit

**Files:**
- Modify: `components/prestations/PrestationCarteSection.tsx`, `components/devis/WeboWordSidePanels.tsx` (`translateServicesToEnglish`, appel de `translateCarteToEnglish`), `lib/prestationCard.ts` (`translateCarteToEnglish` accepte un traducteur injecté)
- Create: `lib/weboTranslateClient.ts`, `lib/weboTranslateClient.test.ts`
- Test: `e2e/webocoins.spec.ts` (ajout)

**Interfaces:**
- Consumes: `translateWithWebo` (Task 3), `useWallet` (Task 4), `translateHtmlFrToEnDetailed` / `translateTextFrToEn` (gratuit, existants).
- Produces:
  - `lib/weboTranslateClient.ts` : `translateFiches(fiches: { key: string; name: string; html: string }[], mode: 'webo' | 'free', webo = translateWithWebo): Promise<{ byKey: Map<string, { name: string; html: string; by: 'webo' | 'free' }>; webo: number; free: number; fallbackWhy: 'balance' | 'cap' | 'error' | 'readonly' | 'demo' | 'off' | null; missed: number }>` — dédoublonne les fiches au même `html` (une seule traduction, réutilisée pour chaque `key`), génère un `requestId` (`crypto.randomUUID()`) par fiche distincte, envoie par lots de 40 en mode Webo, puis traduit en gratuit (MyMemory) celles revenues `ok: false` ; en mode gratuit, tout en MyMemory.
  - `countFiches(fiches): number` (fiches distinctes, celles que le bouton annonce).
  - `translateCarteToEnglish(html, onProgress?, known?, translate?: (fiches) => Promise<Map<string, {name, html}>>)` : quand `translate` est fourni, les plats sont traduits en un lot par lui (clé = index du plat) au lieu de un par un.
- Textes :
  - fiche prestation : bouton « Traduire avec Webo · 1 W » / « Traduire (gratuit) », petit menu « Changer pour cette fois » ; « Retraduire depuis le français » idem.
  - WeboWord, passage en anglais : avant de lancer, si mode Webo et N > 0 : « N fiches à traduire · N W » avec « Traduire avec Webo » / « En gratuit cette fois » ; message de fin : « 4 fiches traduites par Webo (4 W), 2 en gratuit » ; raison du gratuit : `balance` « Plus assez de WeboCoins — rechargez bientôt depuis Mes WeboCoins », `cap` « Limite mensuelle de traductions Webo atteinte », `error` « Webo n’a pas répondu pour certaines fiches », `off` « Webo est indisponible ».
  - après une traduction Webo : `useWallet().refresh()`.
  - un nom seul à traduire (fiche anglaise déjà là, nom anglais absent) reste traduit en gratuit, sans pièce (spec : « un nom seul est gratuit »).

- [ ] **Step 1: Write the failing tests** `lib/weboTranslateClient.test.ts` (traducteur Webo et MyMemory simulés) : `'deux fiches identiques : une seule traduction, deux clés'` ; `'Webo refuse 1 fiche (balance) : traduite en gratuit, compte 2 webo / 1 free, fallbackWhy balance'` ; `'mode gratuit : Webo jamais appelé'` ; `'countFiches dédoublonne'`. Et e2e, `test('traduire une prestation avec Webo débite 1 pièce ; en gratuit, rien')` avec `WEBO_FAKE=1` (ajouté à `webServer.env` de `playwright.brochures.config.ts`) : fiche prestation → « Traduire avec Webo · 1 W » → texte anglais contient « EN » → solde 199 ; mode « Traduire (gratuit) » → solde inchangé.
- [ ] **Step 2: Run** `npx vitest run lib/weboTranslateClient.test.ts` puis l'e2e — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** les deux, puis tout `e2e/brochures.spec.ts` (WeboWord n'a pas régressé côté brochures) — Expected: PASS.
- [ ] **Step 5: Commit** `feat(webo): traduction au choix gratuite ou Webo`.

### Task 6: Admin WeboCoins

**Files:**
- Create: `app/admin/webocoins/page.tsx`, `server/adminWebo.ts`, `server/adminWebo.test.ts`
- Modify: `components/admin/AdminShell.tsx` (entrée « WeboCoins », icône `Coins`)

**Interfaces:**
- Consumes: Task 1 réglages, Task 2 `giftCoins`, `ledgerOf`, `walletOf`.
- Produces (`'use server'`, `requireAdmin`) :
  - `weboStats(monthKey: string): Promise<{ spentCoins: number; spentFromMonth: number; spentFromKept: number; costUsd: number; costEur: number; valueEur: number; marginEur: number; companies: { companyId: string; name: string; balance: number; spent: number; costUsd: number; override: number | null }[] }>` — `valueEur` = pièces dépensées / 100 ; `marginEur` = `valueEur − costEur` (théorique : les pièces sont encore toutes offertes, l'écran le dit).
  - `adminGiftCoins(companyId: string, coins: number, reason: string)` (1–100 000, motif obligatoire).
  - `adminSetMonthlyOverride(companyId: string, coins: number | null)`.
  - `adminSetWeboSettings(patch: Partial<WeboSettings>)`.
  - `adminLedger(companyId: string, page: number)`.

- [ ] **Step 1: Write the failing tests** `server/adminWebo.test.ts` : `'stats du mois : pièces, coût réel, valeur, marge théorique, par entreprise'` (deux débits de 1 avec `cost_usd` 0.0014 ; usdEur 0.92 → coût ≈ 0,0026 €, valeur 0,02 €) ; `'offrir des pièces : pièces gardées + journal gift avec motif ; motif vide refusé'` ; `'réglage propre du compte appliqué au mois suivant'` ; `'non-admin : refusé'`.
- [ ] **Step 2: Run** `npx vitest run server/adminWebo.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** la page : sélecteur de mois, quatre chiffres (pièces dépensées, coût réel, valeur, marge théorique), tableau des entreprises (solde, dépense, coût, réglage propre modifiable, « Offrir des pièces »), journal d'une entreprise, panneau des réglages.
- [ ] **Step 4: Run** les tests, `npx tsc --noEmit -p .`, `npm test`, tout `e2e/webocoins.spec.ts` et `e2e/brochures.spec.ts`, `npx next build` (puis `rm -rf .next/cache`) — Expected: PASS.
- [ ] **Step 5: Commit** `feat(webo): admin des WeboCoins`.
