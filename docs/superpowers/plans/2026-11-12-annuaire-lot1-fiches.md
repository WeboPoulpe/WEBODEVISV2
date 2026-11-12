# Annuaire « Choisir Mon Traiteur », lot 1 : fiches et pages publiques

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les abonnés WeboDevis publient une fiche sur un annuaire public (`choisirmontraiteur.fr`), les visiteurs cherchent par département et type d'événement, puis envoient une demande qui arrive dans les Prospects du traiteur.

**Architecture:** Même application Next.js. Les pages publiques vivent sous `app/annuaire/` ; le middleware y réécrit les requêtes reçues sur l'hôte `DIRECTORY_HOST`. Les données sont dans trois tables `directory_*`, accessibles par actions serveur seulement (jamais par `/api/db`). Une fonction pure décide si une fiche est visible ; une autre rend le verdict du contrôle automatique du SIRET.

**Tech Stack:** Next.js 15 App Router, Drizzle + Postgres (Neon), Vitest + PGlite (`db/testDb.ts`), Vercel Blob, Resend, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-12-choisir-mon-traiteur-design.md` (lot 1 seulement ; les avis sont le lot 2, la fiche seule payante le lot 3).

## Global Constraints

- **Ne jamais lancer** le serveur de développement, Playwright ni `npm run db:migrate` : `.env.local` pointe sur la base de production. Vérifications permises : `npx tsc --noEmit -p .`, `npx vitest run … --hookTimeout=180000 --testTimeout=90000`, `npx next build`.
- Travail dans un worktree, branche `feat/annuaire-lot1`. Aucun envoi sur `main`, aucune migration en production sans l'accord de Maxence.
- Ne jamais ajouter `tsconfig.tsbuildinfo` à un commit.
- Fins de ligne : garder celles du fichier modifié (`middleware.ts`, `app/api/prospect/route.ts`, `app/p/[token]/page.tsx` sont en CRLF).
- Migrations additives et rejouables (`IF NOT EXISTS`), `--> statement-breakpoint` entre deux instructions, entrée ajoutée à la main dans `db/migrations/meta/_journal.json` (`idx` 54, `when` 1794700000000), `db/schema/tables.ts` édité à la main. Pas de snapshot.
- Les tables `directory_*` ne sont **pas** ajoutées à `server/compat/rules.ts` : lecture et écriture par actions serveur uniquement.
- Écritures du traiteur : `requireWriter()`. Lectures : `requireUser()`. Administration : `requireAdmin()` en première ligne. Utilisateur de démonstration : `DEMO_BLOCKED` pour une action connectée, faux succès pour un formulaire public.
- Résultat d'une action : `Promise<{ error: string | null; … }>`. Messages d'erreur en français, phrases complètes, apostrophe typographique « ’ ».
- Textes visibles : français, pas de jargon. Le nom du site est « Choisir Mon Traiteur ». Dans l'application, l'écran des demandes s'appelle « Prospects ».
- Adresse canonique de l'annuaire : `https://choisirmontraiteur.fr`. Liens des e-mails envoyés au traiteur : toujours `SITE_URL` (webodevis.fr), jamais l'hôte de la requête.
- L'annuaire ne dépose aucun cookie et ne charge pas Google Tag Manager : pas de bandeau.
- Apparence du site public : direction « B — Marché », d'après `docs/annuaire/maquette-direction-b.html` et la section « Apparence » de la conception : fond blanc, bleu nuit `#1B1B3A`, rouge tomate `#D3381F`, jaune beurre `#FFD34E`, jaune pâle `#FFF4D6`, polices Gabarito (titres, 800) et DM Sans, bordures bleu nuit de 2 px, coins de 8 à 12 px, pas d'ombre, recherche en phrase, prix sur pastille ronde. Aucune couleur ni police de WeboDevis sur le site public. L'écran « Ma fiche » (tâche 6) garde l'apparence de WeboDevis (crème, vert sapin, terracotta). Pas de logo carré, pas de bouton en double, rien de « trop IA » ; à vérifier à 360 px de large. Charger la compétence `frontend-design:frontend-design` pour les tâches 6 et 7.
- Une fiche d'un compte dont l'accès n'est pas `full` n'apparaît nulle part en public.
- Aucun classement payant. Ordre des résultats du lot 1 : date de publication, la plus récente d'abord.

## Review Focus

1. **Compte sans accès complet** (abonnement arrêté, compte désactivé ou en cours de suppression) : sa fiche disparaît de la recherche, de la page de fiche (404), du sitemap, et le formulaire refuse la demande. Test dans la tâche 4.
2. **Annuaire de l'État injoignable ou SIRET inconnu** à la soumission : la fiche passe en `en_attente`, jamais d'erreur ni de refus automatique. Test dans les tâches 2 et 3.
3. **Lien ou valeur hostile saisis par le traiteur** (`javascript:` dans le site web, HTML dans la présentation, slug `../admin`) : rien d'exécutable n'est rendu, le slug reste `[a-z0-9-]`. Tests dans la tâche 2.
4. **Formulaire public martelé** : plus de 5 demandes par heure depuis la même connexion vers la même fiche sont refusées avec un message ; pot de miel rempli ou envoi en moins de 4 secondes donnent un faux succès sans rien enregistrer. Un message qui contient un lien est accepté (une mariée colle souvent un lien d'inspiration). Tests dans la tâche 4.
5. **Deux fiches du même nom dans la même ville** : slugs distincts (`-2`, `-3`), et une fiche qui change de nom garde son slug une fois publiée. Tests dans les tâches 2 et 3.

---

### Task 1: Tables, listes fermées, configuration

**Files:**
- Create: `db/migrations/0054_directory.sql`
- Modify: `db/migrations/meta/_journal.json`, `db/schema/tables.ts`
- Create: `lib/annuaire/config.ts`, `lib/annuaire/departments.ts`, `lib/annuaire/eventTypes.ts`
- Test: `lib/annuaire/lists.test.ts`, `server/directorySchema.test.ts`

**Interfaces:**
- Produces:
  - Tables (Drizzle exports `directory_listings`, `directory_photos`, `directory_listing_brochures`) et colonne `prospect_requests.source text`.
  - `lib/annuaire/config.ts` : `DIRECTORY_NAME = 'Choisir Mon Traiteur'`, `DIRECTORY_URL = 'https://choisirmontraiteur.fr'`, `DIRECTORY_PREFIX = '/annuaire'`, `directoryUrl(path: string): string`, `MAX_PHOTOS = 20`, `REQUESTS_PER_HOUR = 5`.
  - `lib/annuaire/departments.ts` : `DEPARTMENTS: { code: string; name: string; slug: string }[]` (96 de métropole dont `2A` et `2B`, plus `971`, `972`, `973`, `974`, `976`), `departmentByCode(code)`, `departmentBySlug(slug)`, `departmentOfPostalCode(cp: string): string | null`. Slug : `aube-10`, `corse-du-sud-2a`.
  - `lib/annuaire/eventTypes.ts` : `EVENT_TYPES = ['Mariage', 'Anniversaire', 'Cocktail', 'Séminaire', 'Gala', 'Communion', 'Baptême', 'Autre'] as const`, `type EventType`, `isEventType(v: unknown): v is EventType`.

Colonnes de `directory_listings` : `company_id uuid primary key` (clé étrangère `profiles.id`, suppression en cascade), `slug text unique not null`, `status text not null default 'brouillon'` (contrainte : `brouillon`, `en_attente`, `publiee`, `refusee`, `suspendue`), `siret text`, `check_result jsonb`, `display_name text not null`, `tagline text`, `description text`, `city text`, `postal_code text`, `departments text[] not null default '{}'`, `event_types text[] not null default '{}'`, `website_url text`, `guests_min integer`, `guests_max integer`, `price_from numeric`, `cover_photo_id uuid`, `refused_reason text`, `submitted_at`, `published_at`, `validated_at`, `created_at`, `updated_at` (timestamptz). Index GIN sur `departments`, index sur `status`, index unique partiel sur `siret` quand le statut est `publiee` ou `en_attente`.

`directory_photos` : `id uuid pk`, `company_id uuid not null` (cascade), `url text not null`, `path text not null`, `alt text`, `position integer not null default 0`, `created_at`. Index sur `(company_id, position)`.

`directory_listing_brochures` : `company_id uuid not null` (cascade), `brochure_id uuid not null` (cascade vers `brochures`), `link_id uuid not null` (cascade vers `brochure_links`), `position integer not null default 0`, clé primaire `(company_id, brochure_id)`.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// lib/annuaire/lists.test.ts
it('101 départements, codes et slugs uniques', () => {
  expect(DEPARTMENTS).toHaveLength(101);
  expect(new Set(DEPARTMENTS.map((d) => d.code)).size).toBe(101);
  expect(new Set(DEPARTMENTS.map((d) => d.slug)).size).toBe(101);
  expect(departmentBySlug('aube-10')?.code).toBe('10');
  expect(departmentByCode('2A')?.slug).toBe('corse-du-sud-2a');
});
it('département d’un code postal', () => {
  expect(departmentOfPostalCode('10000')).toBe('10');
  expect(departmentOfPostalCode('20000')).toBe('2A');   // Ajaccio
  expect(departmentOfPostalCode('20200')).toBe('2B');   // Bastia
  expect(departmentOfPostalCode('97400')).toBe('974');
  expect(departmentOfPostalCode('abc')).toBeNull();
});
it('types d’événements', () => {
  expect(isEventType('Mariage')).toBe(true);
  expect(isEventType('mariage')).toBe(false);
});
```

```ts
// server/directorySchema.test.ts — le schéma se crée sur PGlite et les contraintes tiennent
const pg = await createTestDb();
// insérer users + profiles (A), puis :
await pg.query(`insert into directory_listings (company_id, slug, display_name) values ($1, 'a-troyes', 'A')`, [A]);
await expect(pg.query(`insert into directory_listings (company_id, slug, display_name) values ($1, 'a-troyes', 'B')`, [B])).rejects.toThrow();
await expect(pg.query(`update directory_listings set status = 'nimporte' where company_id = $1`, [A])).rejects.toThrow();
await pg.query(`insert into prospect_requests (first_name, last_name, email, owner_user_id, source) values ('a','b','c@d.fr',$1,'annuaire')`, [A]);
```

- [ ] **Step 2: Lancer les tests, constater l'échec** — `npx vitest run lib/annuaire server/directorySchema.test.ts --hookTimeout=180000 --testTimeout=90000`
- [ ] **Step 3: Écrire la migration, le journal, le schéma Drizzle et les trois fichiers de `lib/annuaire/`.** Corse : codes postaux `200xx` et `201xx` → `2A`, `202xx` à `206xx` → `2B`. Outre-mer : trois premiers chiffres.
- [ ] **Step 4: Relancer les tests, puis `npx tsc --noEmit -p .`** — tout passe.
- [ ] **Step 5: Commit** — `feat(annuaire): tables des fiches, départements et types d'événements`

---

### Task 2: Règles pures (visibilité, slug, saisie, contrôle de l'entreprise)

**Files:**
- Create: `lib/annuaire/listing.ts`, `lib/annuaire/companyCheck.ts`
- Modify: `lib/companies.ts` (exposer le code d'activité si `CompanyResult` ne le porte pas déjà)
- Test: `lib/annuaire/listing.test.ts`, `lib/annuaire/companyCheck.test.ts`

**Interfaces:**
- Consumes: `departmentOfPostalCode`, `isEventType`, `DEPARTMENTS`, `CompanyResult` (`lib/companies.ts`), `Access` (`lib/subscription.ts`), `cleanPaymentUrl` (`lib/paymentLink.ts`, même règle pour un lien https).
- Produces:
  - `type ListingStatus = 'brouillon' | 'en_attente' | 'publiee' | 'refusee' | 'suspendue'`
  - `listingVisible(l: { status: ListingStatus }, account: { access: Access; active: boolean; deleting: boolean }): boolean`
  - `slugify(text: string): string` (minuscules, sans accents, `[a-z0-9-]`, 60 caractères au plus, jamais vide : repli `traiteur`)
  - `listingSlug(name: string, city: string | null, taken: (slug: string) => boolean): string`
  - `interface ListingInput { displayName; tagline; description; city; postalCode; departments: string[]; eventTypes: string[]; websiteUrl; guestsMin; guestsMax; priceFrom; siret }` (chaînes brutes du formulaire, nombres en chaîne)
  - `interface ListingFields` (mêmes champs nettoyés, `null` quand vide, nombres en `number | null`)
  - `cleanListing(input: ListingInput): { fields: ListingFields; error: string | null }` — limites : nom 2 à 80, accroche 140, présentation 3000 (texte brut, balises retirées), au moins un département et un type pour être valable, `guestsMin ≤ guestsMax`, site web par `cleanPaymentUrl`.
  - `readyToSubmit(fields: ListingFields, photoCount: number): string | null` — message de ce qui manque (nom, ville, code postal, présentation de 80 caractères au moins, un département, un type, SIRET de 14 chiffres, une photo), sinon `null`.
  - `ALLOWED_ACTIVITIES = ['56.21Z', '56.10A', '56.10C', '10.13B', '47.22Z', '10.71C', '10.71D', '47.24Z']`
  - `interface CheckResult { ok: boolean; reason: string | null; checkedAt: string; legalName: string | null; activity: string | null }`
  - `companyCheck(input: { siret: string; displayName: string; postalCode: string | null }, found: CompanyResult | null | 'unavailable', opts: { duplicate: boolean; now: Date }): CheckResult`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// lib/annuaire/listing.test.ts
it('visible seulement publiée, compte actif, accès complet', () => {
  const ok = { access: 'full' as const, active: true, deleting: false };
  expect(listingVisible({ status: 'publiee' }, ok)).toBe(true);
  for (const s of ['brouillon', 'en_attente', 'refusee', 'suspendue'] as const) expect(listingVisible({ status: s }, ok)).toBe(false);
  expect(listingVisible({ status: 'publiee' }, { ...ok, access: 'readonly' })).toBe(false);
  expect(listingVisible({ status: 'publiee' }, { ...ok, access: 'unpaid' })).toBe(false);
  expect(listingVisible({ status: 'publiee' }, { ...ok, active: false })).toBe(false);
  expect(listingVisible({ status: 'publiee' }, { ...ok, deleting: true })).toBe(false);
});
it('slug propre et unique', () => {
  expect(slugify('Chez Éloïse & Fils — Traiteur')).toBe('chez-eloise-fils-traiteur');
  expect(slugify('../admin')).toBe('admin');
  expect(slugify('***')).toBe('traiteur');
  const taken = new Set(['convivial-event-troyes', 'convivial-event-troyes-2']);
  expect(listingSlug('Convivial Event', 'Troyes', (s) => taken.has(s))).toBe('convivial-event-troyes-3');
});
it('nettoie la saisie', () => {
  const { fields, error } = cleanListing({ displayName: ' Convivial Event ', tagline: '', description: '<script>x</script>Cuisine de saison', city: 'Troyes', postalCode: '10000',
    departments: ['10', '51', 'ZZ'], eventTypes: ['Mariage', 'Pirate'], websiteUrl: 'javascript:alert(1)', guestsMin: '20', guestsMax: '300', priceFrom: '45,50', siret: '925 205 767 00013' });
  expect(error).toBeNull();
  expect(fields).toMatchObject({ displayName: 'Convivial Event', description: 'xCuisine de saison', departments: ['10', '51'], eventTypes: ['Mariage'], websiteUrl: null, guestsMin: 20, guestsMax: 300, priceFrom: 45.5, siret: '92520576700013' });
  expect(cleanListing({ ...base, guestsMin: '300', guestsMax: '20' }).error).toMatch(/convives/);
  expect(cleanListing({ ...base, displayName: 'A' }).error).toMatch(/nom/i);
});
it('dit ce qui manque avant de soumettre', () => {
  expect(readyToSubmit(complete, 1)).toBeNull();
  expect(readyToSubmit(complete, 0)).toMatch(/photo/);
  expect(readyToSubmit({ ...complete, siret: null }, 1)).toMatch(/SIRET/);
});
```

```ts
// lib/annuaire/companyCheck.test.ts
const now = new Date('2026-11-12T10:00:00Z');
const found = { name: 'CONVIVIAL EVENT', siret: '92520576700013', postalCode: '10000', city: 'TROYES', active: true, activityCode: '56.21Z' /* … */ };
const input = { siret: '92520576700013', displayName: 'Convivial Event', postalCode: '10120' };
it('réussit : en activité, métier de bouche, nom proche, même département', () => {
  expect(companyCheck(input, found, { duplicate: false, now })).toMatchObject({ ok: true, reason: null, legalName: 'CONVIVIAL EVENT', activity: '56.21Z' });
});
it('doute, avec la raison', () => {
  const r = (f: unknown, o = {}) => companyCheck(input, f as never, { duplicate: false, now, ...o });
  expect(r('unavailable')).toMatchObject({ ok: false, reason: expect.stringMatching(/ne répond pas/) });
  expect(r(null)).toMatchObject({ ok: false, reason: expect.stringMatching(/introuvable/) });
  expect(r({ ...found, active: false }).reason).toMatch(/plus en activité/);
  expect(r({ ...found, activityCode: '62.01Z' }).reason).toMatch(/activité/);
  expect(r({ ...found, name: 'GARAGE DUPONT' }).reason).toMatch(/nom/);
  expect(r({ ...found, postalCode: '75011' }).reason).toMatch(/département/);
  expect(r(found, { duplicate: true }).reason).toMatch(/déjà/);
});
```

Rapprochement du nom : comparer les formes passées par `slugify`, mots de 3 lettres et plus ; réussi si un mot est commun, ou si l'une des formes contient l'autre. Comparer aussi avec le nom commercial et l'enseigne s'ils sont fournis par `CompanyResult`.

- [ ] **Step 2: Lancer, constater l'échec** — `npx vitest run lib/annuaire`
- [ ] **Step 3: Implémenter les deux fichiers.** Lire `lib/companies.ts` : si `CompanyResult` ne porte pas le code d'activité (NAF) de l'établissement, l'ajouter dans `normalizeCompanies` sous `activityCode`, avec un test dans le fichier de test existant de `lib/companies`.
- [ ] **Step 4: Relancer, `tsc`.**
- [ ] **Step 5: Commit** — `feat(annuaire): règles de visibilité, de saisie et contrôle de l'entreprise`

---

### Task 3: Actions du traiteur (« Ma fiche », côté serveur)

**Files:**
- Create: `server/companyLookup.ts` (`server-only`), `server/directoryListing.ts` (`'use server'`)
- Modify: `server/companies.ts` (déplacer la fonction privée `fetchCompanies` dans `companyLookup.ts` et l'importer)
- Test: `server/directoryListing.test.ts`

**Interfaces:**
- Consumes: tâche 1 (tables), tâche 2 (`cleanListing`, `readyToSubmit`, `listingSlug`, `companyCheck`, `ListingInput`), `companyIdFor` (`server/weboWallet.ts`), `companyIdsOf` (`server/companyScope.ts`), `requireUser`, `requireWriter`, `isDemoUser`, `DEMO_BLOCKED`, `newLinkToken` (`server/brochureAccess.ts`).
- Produces:
  - `findCompanyBySiret(siret: string): Promise<CompanyResult | null | 'unavailable'>` (`server/companyLookup.ts`)
  - `interface MyListing { status: ListingStatus; slug: string | null; fields: ListingFields; photos: { id; url; alt; position }[]; coverPhotoId: string | null; brochures: { brochureId; name; selected: boolean }[]; refusedReason: string | null; publishedAt: string | null; missing: string | null; publicUrl: string | null; stats: { views30: number; requests30: number } }`
  - `getMyListing(): Promise<MyListing>` — crée rien ; sans fiche, renvoie un brouillon prérempli depuis le profil de l'entreprise (nom, site web, SIRET `siret` puis `company_siret`).
  - `saveListing(input: ListingInput): Promise<{ error: string | null }>`
  - `addListingPhoto(photo: { url: string; path: string; alt?: string }): Promise<{ error: string | null; id?: string }>` — refuse au-delà de `MAX_PHOTOS`, refuse une `url` qui n'est pas en `https://` ; la première photo devient la couverture.
  - `removeListingPhoto(id: string)`, `reorderListingPhotos(ids: string[])`, `setListingCover(id: string)`, `updateListingPhotoAlt(id: string, alt: string)` : `Promise<{ error: string | null }>`
  - `setListingBrochures(brochureIds: string[]): Promise<{ error: string | null }>` — crée pour chaque brochure choisie un `brochure_links` (`kind 'source'`, `label 'Choisir Mon Traiteur'`) s'il n'existe pas ; retire les lignes des brochures décochées sans supprimer leur lien.
  - `submitListing(): Promise<{ error: string | null; status?: ListingStatus }>`
  - `withdrawListing(): Promise<{ error: string | null }>` — repasse en `brouillon`.

Règles de `submitListing` : fiche enregistrée et `readyToSubmit` sans message, sinon erreur. Statut `suspendue` : refusé (« Votre fiche est suspendue. Écrivez-nous… »). Sinon `findCompanyBySiret`, puis `companyCheck` (doublon = un autre `company_id` a ce SIRET en `publiee` ou `en_attente`). Verdict `ok` → `publiee`, `validated_at` et `published_at` posés. Sinon → `en_attente`. `check_result` enregistré dans les deux cas. Une fiche déjà `publiee` qu'on resoumet reste `publiee` (modifications libres).

Règles de `saveListing` : le slug est calculé au premier enregistrement et ne change plus une fois la fiche publiée ; avant publication il suit le nom et la ville. Une fiche `publiee` reste `publiee` après modification, `updated_at` change. Si le SIRET d'une fiche `publiee` change, elle repasse en `brouillon` (il faut resoumettre).

- [ ] **Step 1: Écrire les tests qui échouent** (en-tête de mocks copié de `server/brochures.test.ts` ; `vi.mock('./companyLookup', …)` avec une variable `lookup` modifiable)

```ts
it('brouillon prérempli depuis le profil', async () => {
  const l = await d.getMyListing();
  expect(l).toMatchObject({ status: 'brouillon', slug: null, fields: { displayName: 'Traiteur A', siret: '92520576700013' } });
});
it('enregistre, puis publie quand le contrôle réussit', async () => {
  expect((await d.saveListing(valid)).error).toBeNull();
  expect((await d.submitListing()).error).toMatch(/photo/);
  await d.addListingPhoto({ url: 'https://x.public.blob.vercel-storage.com/a.webp', path: `${A}/annuaire/a.webp` });
  lookup = found;
  expect(await d.submitListing()).toEqual({ error: null, status: 'publiee' });
  expect((await d.getMyListing()).slug).toBe('traiteur-a-troyes');
});
it('passe en attente si l’annuaire de l’État ne répond pas, sans erreur', async () => {
  current = B; await d.saveListing(validB); await d.addListingPhoto(photoB);
  lookup = 'unavailable';
  expect(await d.submitListing()).toEqual({ error: null, status: 'en_attente' });
  const { rows } = await pg.query(`select check_result->>'reason' as r from directory_listings where company_id = $1`, [B]);
  expect(rows[0].r).toMatch(/ne répond pas/);
});
it('un doublon de SIRET passe en attente', …);                       // C soumet le SIRET de A
it('le slug ne change plus après publication, même si le nom change', …);
it('deux fiches du même nom dans la même ville : slugs distincts', …);
it('20 photos au plus, adresse https obligatoire', …);
it('un collaborateur modifie la fiche de son entreprise', …);       // current = M (parent A) : getMyListing renvoie la fiche de A
it('brochures : crée un lien « Choisir Mon Traiteur », refuse la brochure d’une autre entreprise', …);
it('démonstration : refusé', …);
```

- [ ] **Step 2: Lancer, constater l'échec.**
- [ ] **Step 3: Implémenter.** `stats` : `views30` = lignes de `site_visits` des 30 derniers jours avec `event = 'view'` et `path = '/annuaire/traiteur/<slug>'` ; `requests30` = `prospect_requests` de l'entreprise avec `source = 'annuaire'`.
- [ ] **Step 4: Relancer ce fichier, `server/writeGates.test.ts`, les tests de `server/companies`, puis `tsc`.**
- [ ] **Step 5: Commit** — `feat(annuaire): actions de la fiche du traiteur et contrôle du SIRET`

---

### Task 4: Lecture publique et demande de contact

**Files:**
- Create: `server/directoryPublic.ts` (`server-only`, lectures), `server/directoryRequest.ts` (`'use server'`, envoi du formulaire)
- Modify: `server/prospectMail.ts`, `lib/mail/templates.ts` (variante « depuis votre fiche Choisir Mon Traiteur »), `app/(app)/prospects/page.tsx` (étiquette de provenance)
- Test: `server/directoryPublic.test.ts`, `server/directoryRequest.test.ts`

**Interfaces:**
- Consumes: tâches 1 et 2 ; `accessOf` (`server/subscription.ts`) ; `notifyProspect` ; `spamReason`, `MIN_FILL_MS` (`lib/siteSpam.ts`) ; `recordEventNow` (`server/siteStats.ts`) ; `SITE_URL` (`lib/site/config.ts`).
- Produces:
  - `interface ListingCard { slug; name; tagline; city; departments: string[]; eventTypes: string[]; coverUrl: string | null; logoUrl: string | null; priceFrom: number | null }`
  - `interface PublicListing extends ListingCard { description; postalCode; websiteUrl; guestsMin; guestsMax; photos: { url; alt }[]; brochures: { name; token; coverUrl: string | null }[]; publishedAt: string; updatedAt: string }`
  - `searchListings(q: { department?: string; eventType?: string }): Promise<ListingCard[]>`
  - `getPublicListing(slug: string): Promise<PublicListing | null>`
  - `departmentsWithListings(): Promise<{ code: string; count: number }[]>`
  - `listPublicSlugs(): Promise<{ slug: string; updatedAt: string }[]>` (pour le sitemap)
  - `submitDirectoryRequest(slug: string, fields: { firstName; lastName; email; phone; eventType; eventDate; guestCount; location; message; website; startedAt: number }): Promise<{ error: string | null }>`
  - `notifyProspect` accepte `source?: 'annuaire'` et `appUrl?: string` ; `prospectNotificationEmail` écrit « vient de vous contacter depuis votre fiche Choisir Mon Traiteur » quand la source est l'annuaire.

Toutes les lectures publiques appliquent `listingVisible` : statut `publiee` filtré en SQL, puis accès de chaque entreprise par `accessOf` (résultat en cache 60 s), `is_active` et `deletion_requested_at` du profil. Les brochures renvoyées sont celles encore actives dont le lien est actif. Les comptes de démonstration ne sont jamais listés.

`submitDirectoryRequest`, dans l'ordre : fiche visible, sinon « Ce traiteur ne reçoit plus de demandes ici. Choisissez-en un autre dans l’annuaire. » ; prénom, nom et e-mail obligatoires et e-mail valable ; pot de miel `website` rempli ou `Date.now() - startedAt < MIN_FILL_MS` → `{ error: null }` sans rien enregistrer ; empreinte de l'adresse IP (`sha256(ip:NEXTAUTH_SECRET)`, comme `server/brochureRequests.ts`) ; plus de `REQUESTS_PER_HOUR` demandes en une heure pour cette empreinte et cette entreprise → « Vous avez déjà envoyé plusieurs demandes. Réessayez dans une heure. » ; insertion dans `prospect_requests` (`owner_user_id` = entreprise, `source = 'annuaire'`, `user_token` nul, `status 'nouveau'`, `service_address` = lieu) ; `recordEventNow('contact', '/annuaire/traiteur/<slug>', ctx)` ; `notifyProspect({ ownerId, prospect, source: 'annuaire', appUrl: SITE_URL })` sans bloquer le succès.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// server/directoryPublic.test.ts — A publiée (10, 51 ; Mariage, Cocktail), B publiée (75 ; Séminaire), C en_attente, D publiée mais abonnement inactif
it('recherche par département et par type', async () => {
  expect((await p.searchListings({})).map((l) => l.slug).sort()).toEqual(['a-troyes', 'b-paris']);
  expect((await p.searchListings({ department: '51' })).map((l) => l.slug)).toEqual(['a-troyes']);
  expect((await p.searchListings({ department: '10', eventType: 'Séminaire' }))).toEqual([]);
});
it('une fiche non publiée ou d’un compte sans accès complet n’existe pas en public', async () => {
  expect(await p.getPublicListing('c-lyon')).toBeNull();
  expect(await p.getPublicListing('d-reims')).toBeNull();
  expect((await p.listPublicSlugs()).map((s) => s.slug).sort()).toEqual(['a-troyes', 'b-paris']);
  expect((await p.departmentsWithListings()).map((d) => d.code).sort()).toEqual(['10', '51', '75']);
});
it('compte désactivé ou en cours de suppression : retiré', …);
it('n’expose ni le SIRET ni le résultat du contrôle', async () => {
  expect(JSON.stringify(await p.getPublicListing('a-troyes'))).not.toMatch(/92520576700013|check_result|legalName/);
});
```

```ts
// server/directoryRequest.test.ts
it('enregistre la demande, prévient le traiteur et accuse réception', async () => {
  expect(await r.submitDirectoryRequest('a-troyes', ok)).toEqual({ error: null });
  const { rows } = await pg.query(`select owner_user_id, source, status, user_token from prospect_requests`);
  expect(rows).toEqual([{ owner_user_id: A, source: 'annuaire', status: 'nouveau', user_token: null }]);
  expect(sent.map((m) => m.to).sort()).toEqual(['contact@traiteur-a.fr', 'marie@exemple.fr']);
  expect(sent.find((m) => m.to === 'contact@traiteur-a.fr')!.html).toContain('https://webodevis.fr/prospects');
  expect(sent.find((m) => m.to === 'contact@traiteur-a.fr')!.html).toContain('Choisir Mon Traiteur');
});
it('un message avec un lien est accepté', …);
it('pot de miel ou envoi trop rapide : faux succès, rien d’enregistré, aucun e-mail', …);
it('6e demande dans l’heure depuis la même connexion : refusée', …);
it('fiche qui n’est plus visible : refusée avec un message', …);
it('e-mail invalide ou nom manquant : refusé', …);
```

- [ ] **Step 2: Lancer, constater l'échec.**
- [ ] **Step 3: Implémenter.** Dans `app/(app)/prospects/page.tsx`, afficher une pastille « Choisir Mon Traiteur » sur les demandes dont `source === 'annuaire'` ; vérifier dans `server/compat/rules.ts` que la colonne `source` est bien lue (sinon l'ajouter aux colonnes lisibles de `prospect_requests`).
- [ ] **Step 4: Relancer ces deux fichiers, les tests existants de `server/prospectMail` et de `lib/mail`, puis `tsc`.**
- [ ] **Step 5: Commit** — `feat(annuaire): lecture publique des fiches et demande de contact`

---

### Task 5: Administration

**Files:**
- Create: `server/adminDirectory.ts` (`'use server'`), `app/admin/annuaire/page.tsx`
- Modify: `components/admin/AdminShell.tsx` (entrée « Annuaire » avec un compteur), `app/admin/labels.ts` (`LISTING_STATUS`), `server/writeGates.test.ts` (ajouter `'adminDirectory.ts:*'` à la liste des fichiers d'administration)
- Test: `server/adminDirectory.test.ts`

**Interfaces:**
- Consumes: tâches 1 à 3 ; `requireAdmin` ; `logAudit` (`@/lib/audit`) ; `sendMail`, `renderEmail`.
- Produces:
  - `interface AdminListing { companyId; slug; status: ListingStatus; displayName; city; postalCode; siret; check: CheckResult | null; ownerEmail; submittedAt; publishedAt; updatedAt; modifiedSinceValidation: boolean; coverUrl: string | null; photoCount: number; refusedReason: string | null }`
  - `listAdminListings(): Promise<AdminListing[]>`
  - `pendingListingCount(): Promise<number>`
  - `decideListing(companyId: string, decision: 'valider' | 'refuser' | 'suspendre' | 'republier', reason?: string): Promise<{ error: string | null }>`

`valider` : `en_attente` → `publiee` (dates posées). `refuser` : `en_attente` → `refusee`, motif obligatoire. `suspendre` : `publiee` → `suspendue`, motif obligatoire. `republier` : `suspendue` ou `refusee` → `publiee`. Toute autre transition : erreur. Chaque décision est notée par `logAudit` et envoie un e-mail au titulaire (objet et une phrase par cas, motif cité, bouton « Ouvrir ma fiche » vers `SITE_URL/ma-fiche`).

Écran : onglets « À valider », « Publiées », « Modifiées depuis la validation », « Refusées et suspendues », sur le modèle de `app/admin/demandes/page.tsx`. Chaque ligne montre la photo de couverture, le nom, la ville, le SIRET, la dénomination trouvée, le code d'activité et la raison du doute. Fenêtre de détail avec un lien « Voir la fiche » (`/annuaire/traiteur/<slug>` pour une fiche publiée) et les boutons de décision.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
it('valide une fiche en attente : publiée, e-mail au titulaire, audit', …);
it('refuser et suspendre exigent un motif', async () => {
  expect((await a.decideListing(C, 'refuser')).error).toMatch(/motif/i);
});
it('transitions interdites', async () => {
  expect((await a.decideListing(A, 'valider')).error).not.toBeNull();     // déjà publiée
});
it('compte les fiches à valider', async () => { expect(await a.pendingListingCount()).toBe(1); });
it('signale une fiche modifiée depuis sa validation', …);
it('réservé aux administrateurs', …);                                      // requireAdmin lève → l'action lève
```

- [ ] **Step 2: Lancer, constater l'échec.**
- [ ] **Step 3: Implémenter l'action, l'écran et le compteur du menu** (`AdminShell` appelle `pendingListingCount()` au montage ; pastille seulement si le nombre dépasse 0).
- [ ] **Step 4: Relancer, `server/writeGates.test.ts`, `tsc`.**
- [ ] **Step 5: Commit** — `feat(annuaire): validation des fiches dans l'administration`

---

### Task 6: Écran « Ma fiche » dans l'application

**Files:**
- Create: `app/(app)/ma-fiche/page.tsx`, `components/annuaire/ListingEditor.tsx`, `components/annuaire/ListingPhotos.tsx`, `components/annuaire/ListingPreviewCard.tsx`
- Modify: `components/layout/nav.ts` (entrée « Ma fiche », groupe Commerce, après « Site web »), `middleware.ts` (`'/ma-fiche'` dans `APP_PREFIXES`), `app/robots.ts` (`APP_ROUTES`)

**Interfaces:**
- Consumes: toutes les actions de la tâche 3 ; `DEPARTMENTS`, `EVENT_TYPES` ; `usePhotoUpload` (`components/brochures/PhotoPicker.tsx`) ou `createClient().storage` avec le chemin `${user.id}/annuaire/<horodatage>-<uuid>.webp` et `fileToWebp` ; `btnPrimary`, `btnSecondary`, `inputCls`, `labelCls`, `cardCls`, `pill` (`components/ui/kit`) ; `useFeedback`.

Page cliente, dans l'ordre : bandeau d'état (brouillon / en cours de vérification / en ligne avec le lien public / refusée avec le motif / suspendue) ; ce qui manque (`missing`) ; identité (nom, accroche, présentation avec compteur) ; lieu (ville, code postal, départements desservis en cases à cocher avec recherche, le département du code postal coché d'office) ; types d'événements (pastilles) ; repères (convives min et max, prix de départ, site web) ; SIRET ; photos (envoi multiple, réordonner, choisir la couverture, texte de remplacement, supprimer) ; brochures à afficher ; chiffres des 30 derniers jours quand la fiche est en ligne. Un seul bouton principal : « Enregistrer » tant que la fiche est en ligne ou en attente, « Enregistrer et publier » pour un brouillon complet. Lien « Retirer ma fiche » discret, avec confirmation.

- [ ] **Step 1: Construire la page et ses composants** en suivant les conventions de `app/(app)/brochures/page.tsx` (chargement par action serveur, `Loader2`, retours par `useFeedback`).
- [ ] **Step 2: Ajouter l'entrée de menu, le préfixe du middleware et la route interdite aux robots.**
- [ ] **Step 3: Vérifier** — `npx tsc --noEmit -p .`, puis `npx next build` (la route `/ma-fiche` apparaît dans la sortie).
- [ ] **Step 4: Commit** — `feat(annuaire): écran Ma fiche`

---

### Task 7: Le site public

**Files:**
- Modify: `middleware.ts`, `components/` du service worker (`RegisterServiceWorker`), `server/siteStats.ts` (`getSiteStats` ignore les chemins `/annuaire%`)
- Create: `lib/annuaire/routing.ts`, `lib/annuaire/routing.test.ts`, `lib/annuaire/metadata.ts`, `lib/annuaire/schema.ts`, `lib/annuaire/schema.test.ts`
- Create: `app/annuaire/layout.tsx`, `not-found.tsx`, `page.tsx`, `traiteurs/page.tsx`, `traiteurs/[departement]/page.tsx`, `traiteur/[slug]/page.tsx`, `favoris/page.tsx`, `referencer-mon-entreprise/page.tsx`, `mentions-legales/page.tsx`, `confidentialite/page.tsx`, `conditions/page.tsx`, `sitemap.ts`, `robots.ts`
- Create: `components/annuaire/AnnuaireShell.tsx`, `AnnuaireMark.tsx`, `SearchBar.tsx`, `ListingCard.tsx`, `ListingGallery.tsx`, `ContactForm.tsx`, `FavoriteButton.tsx`, `DirectoryAnalytics.tsx`, `BaseContext.tsx`

**Interfaces:**
- Consumes: tâche 4 (lectures et `submitDirectoryRequest`), tâche 1 (listes, configuration), `container`, `JsonLd`, `Breadcrumb` (`components/site/ui`), `components/site/site.css`.
- Produces:
  - `directoryRewrite(host: string | null, pathname: string, directoryHost: string | undefined): { kind: 'rewrite'; to: string } | { kind: 'redirect'; to: string } | null` (`lib/annuaire/routing.ts`)
  - `directoryBase(): Promise<'' | '/annuaire'>` (serveur, lit l'en-tête `host`) et `useDirectoryBase()` (client, contexte posé par le layout)
  - `listingJsonLd(l: PublicListing): object`, `directoryBreadcrumb(crumbs): object`, `directoryMetadata({ title, description, path, noindex? }): Metadata`

`directoryRewrite` : sans `directoryHost`, `null`. Sur l'hôte de l'annuaire (avec ou sans `www.`, port ignoré) : chemins `/api`, `/_next`, `/icons`, `/b/`, `/embed/` et fichiers statiques → `null` ; `/sw.js` et `/manifest.webmanifest` → `null` ; chemin commençant par `/annuaire` → redirection vers le même chemin sans ce préfixe ; tout le reste → réécriture vers `/annuaire` + chemin (`/` devient `/annuaire`, `/sitemap.xml` devient `/annuaire/sitemap.xml`). Sur un autre hôte dont le nom est `webodevis.fr` ou `www.webodevis.fr` : chemin commençant par `/annuaire` → redirection vers `https://<directoryHost>` + chemin sans préfixe. Ailleurs (local, aperçus Vercel) : `null`, `/annuaire` se consulte tel quel. Le middleware l'appelle en tout premier et ajoute `/annuaire` aux chemins publics.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// lib/annuaire/routing.test.ts
const H = 'choisirmontraiteur.fr';
it('réécrit les pages de l’annuaire', () => {
  expect(directoryRewrite(H, '/', H)).toEqual({ kind: 'rewrite', to: '/annuaire' });
  expect(directoryRewrite(`www.${H}`, '/traiteur/a-troyes', H)).toEqual({ kind: 'rewrite', to: '/annuaire/traiteur/a-troyes' });
  expect(directoryRewrite(`${H}:443`, '/sitemap.xml', H)).toEqual({ kind: 'rewrite', to: '/annuaire/sitemap.xml' });
});
it('laisse passer l’API, les fichiers et les brochures', () => {
  for (const p of ['/api/stats', '/_next/static/x.js', '/icons/a.png', '/b/abc', '/embed/b/abc', '/sw.js']) expect(directoryRewrite(H, p, H)).toBeNull();
});
it('retire le préfixe en double et renvoie webodevis.fr vers l’annuaire', () => {
  expect(directoryRewrite(H, '/annuaire/traiteurs', H)).toEqual({ kind: 'redirect', to: '/traiteurs' });
  expect(directoryRewrite('webodevis.fr', '/annuaire/traiteur/a', H)).toEqual({ kind: 'redirect', to: `https://${H}/traiteur/a` });
});
it('ne touche à rien ailleurs', () => {
  expect(directoryRewrite('webodevis.fr', '/tarifs', H)).toBeNull();
  expect(directoryRewrite('localhost:3001', '/annuaire', H)).toBeNull();
  expect(directoryRewrite(H, '/', undefined)).toBeNull();
});
```

```ts
// lib/annuaire/schema.test.ts
it('données structurées d’une fiche, sans note tant qu’il n’y a pas d’avis', () => {
  const j = listingJsonLd(listing) as Record<string, unknown>;
  expect(j['@type']).toBe('FoodEstablishment');
  expect(j.url).toBe('https://choisirmontraiteur.fr/traiteur/a-troyes');
  expect(j).not.toHaveProperty('aggregateRating');
  expect(JSON.stringify(j)).not.toContain('</script');
});
```

- [ ] **Step 2: Lancer, constater l'échec.**
- [ ] **Step 3: Implémenter `routing.ts`, brancher le middleware (fins de ligne CRLF), `metadata.ts`, `schema.ts`.**
- [ ] **Step 4: Construire le layout et le gabarit.** `app/annuaire/layout.tsx` : ses propres métadonnées (`metadataBase` = `DIRECTORY_URL`, titre « Choisir Mon Traiteur », icônes propres), `AnnuaireShell` (en-tête : marque, « Trouver un traiteur », « Mes favoris », « Référencer mon entreprise » ; pied : liens légaux, phrase sur le classement, « Propulsé par WeboDevis »), `BaseContext`, `DirectoryAnalytics` (envoie `/annuaire` + chemin à `/api/stats`). `RegisterServiceWorker` ne s'enregistre pas quand le chemin interne commence par `/annuaire` ou que l'hôte est celui de l'annuaire. Aucune importation de `SiteShell`, `CookieConsent`, `DemoButton` ni de `lib/site/pages`.
- [ ] **Step 5: Construire les pages.**
  - Accueil : titre, barre de recherche (département, type d'événement), fiches récentes (aucun compteur global), trois étapes, bloc pour les traiteurs.
  - `/traiteurs` : filtres dans l'adresse (`?departement=10&type=Mariage`), cartes, état vide qui propose les départements voisins couverts ; `noindex` quand un filtre est posé.
  - `/traiteurs/[departement]` : slug de `DEPARTMENTS`, 404 sinon ; `noindex` s'il n'y a aucune fiche.
  - `/traiteur/[slug]` : 404 si `getPublicListing` renvoie `null` ; galerie, présentation (texte brut, sauts de ligne gardés), repères, départements, brochures (liens vers `/b/<token>`, nouvel onglet), site web (`rel="nofollow noopener noreferrer"`), formulaire de contact, bouton favori, données structurées.
  - Formulaire : champs de la conception, champ caché `website`, `startedAt` posé au montage, message de succès qui dit que le traiteur répondra par e-mail ou par téléphone.
  - Favoris : slugs gardés dans `localStorage` sous `cmt:favoris` (lecture et écriture dans un `try/catch`), page qui charge les cartes de ces fiches.
  - Page pour les traiteurs : ce que comprend la fiche, gratuite pour les abonnés WeboDevis, bouton vers `SITE_URL/login?source=annuaire` ; une phrase annonce l'offre sans le logiciel « bientôt », sans prix ni formulaire (lot 3).
  - Mentions légales, confidentialité, conditions : sur le modèle des pages de WeboDevis, éditeur Webomax (SIRET 925 205 767 00013) jusqu'au 1er janvier 2027 ; la confidentialité décrit la demande de contact (transmise au traiteur choisi), l'empreinte de l'adresse IP, les statistiques sans cookie, les favoris gardés dans le navigateur ; les conditions décrivent le classement (date de publication, aucun paiement).
  - `sitemap.ts` : accueil, `/traiteurs`, départements qui ont au moins une fiche, fiches, pages légales, adresses absolues sur `DIRECTORY_URL`. `robots.ts` : tout autorisé, sitemap de l'annuaire.
- [ ] **Step 6: Vérifier** — `npx vitest run --hookTimeout=180000 --testTimeout=90000` (toute la suite), `npx tsc --noEmit -p .`, `npx next build`.
- [ ] **Step 7: Commit** — `feat(annuaire): site public Choisir Mon Traiteur`

---

## Après le lot

À faire avec Maxence, jamais sans son accord : appliquer la migration 0054 sur la base, fusionner dans `main` et pousser ; ajouter `choisirmontraiteur.fr` au projet Vercel et la variable `DIRECTORY_HOST=choisirmontraiteur.fr` ; relire les trois textes légaux ; regarder le résultat sur un aperçu Vercel à 360 px avant l'ouverture.
