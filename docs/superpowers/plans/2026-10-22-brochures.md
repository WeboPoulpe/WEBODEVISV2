# Module Brochures — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un traiteur crée plusieurs brochures de ses prestations (trois styles), les envoie par un lien public qui se feuillette comme un livre et se termine par un formulaire de demande qui arrive dans ses Prospects.

**Architecture:** Une table `brochures` (contenu en jsonb qui référence les prestations par identifiant, retouches à côté). Une bibliothèque pure `lib/brochure.ts` résout et pagine le contenu selon le style ; le serveur (`server/brochures.ts`) lit, écrit, publie et envoie ; un composant client `Flipbook` affiche les pages à l'identique dans l'éditeur et sur le lien public `/b/[token]`.

**Tech Stack:** Next.js app router, Drizzle + Neon (PGlite en test), couche `createClient().from()` + `server/compat/rules.ts`, Vercel Blob (`supabase.storage` de compat), Resend (`lib/mail`), Tailwind (jetons `primary`, `forest`, `sage`, `page`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-brochures-design.md`

## Global Constraints

- Migrations additives seulement (`IF NOT EXISTS`), commentées en français ; prochaine : `0033`. Appliquer `npm run db:migrate` avant tout envoi sur `main`.
- Retoucher une brochure ne modifie jamais `prestations`.
- Le lien public n'expose que la brochure : pas d'identifiant interne de prestation, aucun prix quand `show_prices` est faux (absent des données envoyées, pas seulement masqué).
- Prix : mention « HT » ou « TTC » toujours affichée ; en TTC, taux `vat_rate` de la brochure (défaut `defaultVatRate(profile)` de `lib/vat.ts`).
- Direction artistique WeboDevis (crème `page`, vert `forest`, terracotta `primary`), sobre, sans emojis, une seule entrée par action.
- Lisible à 360 px ; feuilletage double page sur ordinateur, page par page sur téléphone et si `prefers-reduced-motion` ; flèches du clavier.
- Compte démo (`isDemoUser`) : crée et voit, n'envoie pas d'email (`DEMO_BLOCKED`).
- Pas de nouvelle dépendance lourde (disque presque plein) ; feuilletage en CSS maison.
- Écart avec la conception : la banque de photos (`user_library_photos`) n'est utilisée par aucun code et n'a pas de règle d'accès ; les photos viennent de `prestations.photo_url` ou d'un envoi (Vercel Blob).
- Textes de l'interface en français ; textes fixes de la brochure publique en français ou anglais selon `language`.

## Review Focus

1. Prestation supprimée du catalogue après la création de la brochure → le lien public la saute sans erreur ; l'éditeur l'affiche barrée « supprimée du catalogue ». (Task 2, Task 3)
2. `show_prices = false` → aucune donnée de prix dans la réponse de `getPublicBrochure` (prix et prix enfant à `null`). (Task 3)
3. Lien désactivé, régénéré ou inconnu → page « Cette brochure n'est plus disponible » ; un envoi de formulaire sur ce jeton est refusé. (Task 3, Task 7)
4. Formulaire envoyé en rafale depuis une même adresse IP → refusé au-delà de 5 envois par heure et par brochure. (Task 7)
5. Le traiteur qui ouvre son propre lien n'augmente pas le compteur d'ouvertures ; un lecteur anonyme si. (Task 3)

---

### Task 1: Table `brochures`, colonne `prospect_requests.brochure_id`, règles d'accès

**Files:**
- Modify: `db/schema/tables.ts` (après `devis_templates`), `db/schema/relations.ts`, `server/compat/rules.ts`
- Create: `db/migrations/0033_brochures.sql` (+ journal et snapshot via `npm run db:generate -- --name brochures`, puis SQL rendu idempotent et commenté)
- Test: `server/brochures.test.ts` (créé ici, enrichi aux tâches suivantes)

**Interfaces:**
- Produces: table `brochures` : `id uuid pk default random`, `owner_user_id uuid not null` (fk users cascade), `user_id uuid not null` (fk users cascade), `name text not null`, `style text not null default 'editorial'` (check `editorial|carte|magazine`), `language text not null default 'fr'` (check `fr|en`), `show_prices boolean not null default true`, `price_mode text not null default 'ttc'` (check `ht|ttc`), `vat_rate numeric not null default 20`, `is_active boolean not null default true`, `share_token text not null` (unique), `cover jsonb not null default '{}'`, `content jsonb not null default '{}'`, `view_count integer not null default 0`, `viewed_at timestamptz`, `created_at`, `updated_at timestamptz default now()`. Index sur `owner_user_id`. `prospect_requests.brochure_id uuid null` (fk brochures on delete set null).
- Produces: règle `brochures: both(team('owner_user_id'))` (lecture publique : jamais par `/api/db`, seulement côté serveur avec `adminSupabase`/`db`).

- [ ] **Step 1: Write the failing test** — `describe('brochures : base')`, `it('la migration crée la table et la colonne de provenance des demandes')` : sur `createTestDb()`, `insert into brochures (owner_user_id, user_id, name, share_token) values (...)` réussit avec les valeurs par défaut (`style = 'editorial'`, `price_mode = 'ttc'`, `is_active = true`) ; un second insert avec le même `share_token` échoue ; `insert into brochures (..., style) values (..., 'autre')` échoue ; `select brochure_id from prospect_requests limit 0` réussit.
- [ ] **Step 2: Run** `npx vitest run server/brochures.test.ts` — Expected: FAIL (relation "brochures" does not exist).
- [ ] **Step 3: Declare the table and relations, generate `0033_brochures.sql`, make it idempotent, add the RULES entry.**
- [ ] **Step 4: Run** `npx vitest run server/brochures.test.ts` and `npx tsc --noEmit -p .` — Expected: PASS, no type error.
- [ ] **Step 5: Commit** `feat(brochures): table des brochures et provenance des demandes`.

### Task 2: Bibliothèque pure — contenu, prix, pagination

**Files:**
- Create: `lib/brochure.ts`, `lib/brochure.test.ts`
- Modify: `components/devis/WeboWordSidePanels.tsx` (`addPrestation` utilise `isPerGuestPrestation`)

**Interfaces:**
- Produces (types) :
  - `type BrochureStyle = 'editorial' | 'carte' | 'magazine'`
  - `interface BrochureItem { prestationId: string; html?: string | null; photoUrl?: string | null; hidePrice?: boolean }`
  - `interface BrochureSection { id: string; title: string; items: BrochureItem[] }`
  - `interface BrochureContent { about: { enabled: boolean; html: string; photoUrl?: string | null }; contact: { enabled: boolean }; sections: BrochureSection[] }`
  - `interface BrochureCover { title: string; subtitle?: string | null; photoUrl?: string | null }`
  - `interface CatalogPrestation { id: string; name: string; description: string | null; gastro_card_html: string | null; gastro_card_html_en: string | null; unit_price: number | string | null; child_unit_price: number | string | null; category: string | null; photo_url: string | null }`
  - `interface PriceOptions { show: boolean; mode: 'ht' | 'ttc'; vatRate: number; language: 'fr' | 'en' }`
  - `interface ResolvedItem { key: string; name: string; html: string; photoUrl: string | null; price: string | null; childPrice: string | null; missing: boolean }`
  - `type BrochurePage = { kind: 'cover' } | { kind: 'about' } | { kind: 'items'; sectionTitle: string | null; items: ResolvedItem[] } | { kind: 'contact' } | { kind: 'form' }`
- Produces (fonctions) :
  - `parseBrochureContent(raw: unknown): BrochureContent` — valeurs par défaut `{ about: { enabled: true, html: '' }, contact: { enabled: true }, sections: [] }`, éléments invalides ignorés.
  - `isPerGuestPrestation(p: { category?: string | null; name?: string | null; unit_price?: number | string | null }): boolean` — règle reprise d'`addPrestation` : catégorie hors `matériel|materiel|personnel|logistique`, nom sans « forfait », prix < 150.
  - `formatPrice(p: CatalogPrestation, o: PriceOptions): { price: string | null; childPrice: string | null }`
  - `resolveItems(section: BrochureSection, catalog: ReadonlyMap<string, CatalogPrestation>, o: PriceOptions & { forEditor: boolean }): ResolvedItem[]` — texte : `item.html`, sinon fiche de carte (anglaise si `language === 'en'` et présente), sinon nom + description ; prix masqué si `item.hidePrice` ; prestation absente → sautée (public) ou `missing: true` (éditeur) ; `key` = index, jamais l'identifiant de prestation côté public.
  - `paginateBrochure(content: BrochureContent, catalog: ReadonlyMap<string, CatalogPrestation>, style: BrochureStyle, o: PriceOptions & { forEditor: boolean }): BrochurePage[]` — couverture, « qui sommes-nous » si activé, sections (`ITEMS_PER_PAGE = { editorial: 1, carte: 6, magazine: 3 }`, titre de section sur la première page de la section), contact si activé, formulaire toujours en dernier.

- [ ] **Step 1: Write the failing tests** in `lib/brochure.test.ts` :
  - `formatPrice` : prestation menu 76 € HT, `mode: 'ttc'`, `vatRate: 10` → `price === '83,60 € TTC / pers.'` ; `mode: 'ht'` → `'76,00 € HT / pers.'` ; catégorie `matériel` 300 € → `'300,00 € HT'` (sans « / pers. ») ; `child_unit_price: 18` → `childPrice === 'enfant : 18,00 € HT'` ; `show: false` → `{ price: null, childPrice: null }` ; `language: 'en'` → `'€76.00 excl. VAT per guest'`.
  - `isPerGuestPrestation` : `{ category: 'personnel', unit_price: 30 }` → false ; `{ name: 'Forfait barman', unit_price: 90 }` → false ; `{ category: 'dîner', unit_price: 76 }` → true ; `{ unit_price: 300 }` → false.
  - `paginateBrochure` : 3 prestations dans une section, style `editorial` → pages `['cover','about','items','items','items','contact','form']` ; style `carte` → `['cover','about','items','contact','form']` ; `about.enabled = false` → pas de page `about` ; la dernière page est toujours `form`.
  - Review Focus 1 : un item dont la prestation n'est pas au catalogue → absent avec `forEditor: false`, présent avec `missing: true` avec `forEditor: true`.
  - `parseBrochureContent(null)` renvoie les valeurs par défaut ; un item sans `prestationId` est ignoré.
- [ ] **Step 2: Run** `npx vitest run lib/brochure.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `lib/brochure.ts`**; formats : `Intl.NumberFormat('fr-FR' | 'en-GB', { style: 'currency', currency: 'EUR' })`, suffixes `HT`/`TTC`/`/ pers.` (fr) et `excl. VAT`/`incl. VAT`/`per guest` (en). Remplacer la condition d'`addPrestation` par `isPerGuestPrestation(p)`.
- [ ] **Step 4: Run** `npx vitest run lib/brochure.test.ts` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(brochures): contenu, prix et pagination des brochures`.

### Task 3: Actions serveur — gestion, lecture publique, ouvertures

**Files:**
- Create: `server/brochures.ts` (`'use server'`)
- Test: `server/brochures.test.ts` (mocks : `server-only`, `next/headers`, `@/lib/mail`, `./session`, `@/db`, comme `server/quoteFormulas.test.ts`)

**Interfaces:**
- Consumes: Task 1 (table), Task 2 (`parseBrochureContent`, `paginateBrochure`, types).
- Produces :
  - `listBrochures(): Promise<BrochureSummary[]>` — `BrochureSummary { id; name; style; is_active; view_count; viewed_at; updated_at; share_token; coverPhotoUrl: string | null }`, entreprise entière (`companyIdsOf`).
  - `createBrochure(input: { name: string; style?: BrochureStyle }): Promise<{ error: string | null; id?: string }>` — `share_token = crypto.randomBytes(18).toString('base64url')`, `vat_rate` = `defaultVatRate(profil de l'entreprise)`, couverture : `{ title: name }`.
  - `getBrochure(id: string): Promise<BrochureRow | null>` (pour l'éditeur, portée entreprise).
  - `saveBrochure(id: string, patch: Partial<Pick<BrochureRow, 'name' | 'style' | 'language' | 'show_prices' | 'price_mode' | 'vat_rate' | 'cover' | 'content' | 'is_active'>>): Promise<{ error: string | null }>` — `content` passé par `parseBrochureContent`, HTML par `sanitizeHtml`.
  - `duplicateBrochure(id: string): Promise<{ error: string | null; id?: string }>` (nom « … (copie) », nouveau jeton, compteurs à zéro).
  - `deleteBrochure(id: string): Promise<{ error: string | null }>`.
  - `renewBrochureLink(id: string): Promise<{ error: string | null; token?: string }>`.
  - `getPublicBrochure(token: string): Promise<PublicBrochure | null>` — `null` si jeton invalide (`/^[A-Za-z0-9_-]{16,}$/`), inconnu ou inactif ; `PublicBrochure { name; style; language; cover: BrochureCover; pages: BrochurePage[]; company: { name; logoUrl; address; phone; email; website } }`, profil de l'entreprise parente (comme `app/d/[token]`), pages via `paginateBrochure(..., { forEditor: false })`.
  - `brochureUnavailableCompany(token: string): Promise<{ name: string; email: string | null } | null>` (lien désactivé : contact de l'entreprise).
  - `recordBrochureView(token: string): Promise<void>` — comme `recordQuoteView` : ignore le traiteur connecté de l'entreprise ; `view_count + 1`, `viewed_at = now()`.

- [ ] **Step 1: Write the failing tests** (`describe('brochures : serveur')`) :
  - un traiteur crée, renomme, change de style, duplique, supprime ; un autre compte reçoit `null` / « introuvable » sur `getBrochure`, `saveBrochure`, `deleteBrochure`.
  - `saveBrochure` avec une retouche d'item ne change pas la ligne `prestations` correspondante (anti-objectif).
  - Review Focus 2 : `show_prices = false` → toutes les pages `items` de `getPublicBrochure` ont `price === null` et `childPrice === null`, et le JSON sérialisé ne contient pas `unit_price`.
  - Le JSON public ne contient aucun identifiant de prestation (`expect(JSON.stringify(pub)).not.toContain(prestationId)`).
  - Review Focus 3 : après `saveBrochure(id, { is_active: false })` puis après `renewBrochureLink`, l'ancien jeton → `getPublicBrochure` renvoie `null`.
  - Review Focus 1 : prestation supprimée du catalogue → `getPublicBrochure` réussit sans elle.
  - Review Focus 5 : `recordBrochureView` avec la session du traiteur → `view_count` inchangé ; session anonyme → `view_count === 1`.
  - Compte démo : `createBrochure` autorisé.
- [ ] **Step 2: Run** `npx vitest run server/brochures.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `server/brochures.ts`** (Drizzle via `db`, portée `companyIdsOf(user.id)`, `requireWriter` pour écrire, `requireUser` pour lire).
- [ ] **Step 4: Run** `npx vitest run server/brochures.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(brochures): actions serveur et lecture publique`.

### Task 4: Le livre — composant `Flipbook` et lien public `/b/[token]`

Passe visible : une brochure créée en base (ou par Task 5) se feuillette sur téléphone.

**Files:**
- Create: `components/brochures/Flipbook.tsx` (client), `components/brochures/BrochurePages.tsx` (rendu d'une `BrochurePage` par style), `app/b/[token]/page.tsx` (serveur, `dynamic = 'force-dynamic'`, `robots: { index: false, follow: false }`), `app/b/[token]/Unavailable.tsx`
- Test: `e2e/brochures.spec.ts` (Playwright, compte d'essai comme `e2e/weboword-extra.spec.ts`)

**Interfaces:**
- Consumes: `getPublicBrochure`, `recordBrochureView`, `brochureUnavailableCompany` (Task 3) ; `BrochurePage`, `BrochureCover` (Task 2).
- Produces: `<Flipbook pages: ReactNode[]; ariaLabel: string />` — double page au-delà de 900 px de large, une page sinon ou si `prefers-reduced-motion` ; boutons précédente/suivante, flèches du clavier, balayage tactile ; numéro « 3 / 12 ». `<BrochurePageView page: BrochurePage; style: BrochureStyle; cover: BrochureCover; company: PublicBrochure['company']; language: 'fr' | 'en'; formSlot?: ReactNode />` (la page `form` affiche `formSlot`, rempli en Task 7).

- [ ] **Step 1: Write the failing e2e test** `test('le lien public se feuillette, page par page sur téléphone')` : compte d'essai, une prestation, une brochure insérée en SQL avec une section ; à 390 × 844 : `/b/<token>` affiche le titre de couverture, `page.keyboard.press('ArrowRight')` puis le nom de la prestation est visible, pas de défilement horizontal (`scrollWidth - innerWidth === 0`) ; `/b/jetonInconnu1234567890` affiche « Cette brochure n'est plus disponible ».
- [ ] **Step 2: Run** `npx playwright test e2e/brochures.spec.ts --project=desktop` — Expected: FAIL (404).
- [ ] **Step 3: Implement the components and the page** — styles des trois maquettes de `.superpowers/brainstorm/*/content/styles-brochure.html` (format de page 210 × 297 en proportions, coin de page) ; feuilletage par `transform: rotateY` sur la page qui tourne ; `recordBrochureView(token).catch(() => {})` à l'affichage.
- [ ] **Step 4: Run** the e2e test and capture `e2e/screenshots/brochure-mobile.png` and `-desktop.png` — Expected: PASS ; relire les captures (360 et 1280 px).
- [ ] **Step 5: Commit** `feat(brochures): lien public feuilletable`.

### Task 5: Liste des brochures et entrée de navigation

Passe visible : créer une brochure et ouvrir son lien depuis l'appli.

**Files:**
- Create: `app/(app)/brochures/page.tsx`
- Modify: `components/layout/nav.ts` (entrée `{ href: '/brochures', icon: BookOpen, label: 'Brochures', exact: false }` juste après Prospects), `lib/navMega.ts` (`'/brochures'` : résumé + action « Nouvelle brochure »), `lib/modules.ts` (route `/brochures` dans le module `prospects`)

**Interfaces:**
- Consumes: `listBrochures`, `createBrochure`, `duplicateBrochure`, `deleteBrochure` (Task 3).
- Produces: route `/brochures` ; création → redirection vers `/brochures/[id]` (Task 6).

- [ ] **Step 1: Write the failing e2e test** `test('créer une brochure depuis la liste')` : `/brochures`, bouton « Nouvelle brochure », nom « Mariages 2027 », la carte apparaît avec « Éditorial » et « 0 ouverture » ; menu de la carte : « Copier le lien » met une URL `/b/` dans le presse-papiers.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement the page** (gabarit de `app/(app)/modeles/page.tsx` ; cartes avec miniature de couverture, style, ouvertures, dernière ouverture ; actions Ouvrir, Copier le lien, Dupliquer, Supprimer avec `confirm`).
- [ ] **Step 4: Run** the e2e test — Expected: PASS ; capture à 360 px.
- [ ] **Step 5: Commit** `feat(brochures): liste et navigation`.

### Task 6: Éditeur de brochure

Passe visible : composer une brochure et la voir se mettre à jour en direct.

**Files:**
- Create: `app/(app)/brochures/[id]/page.tsx`, `components/brochures/BrochureEditor.tsx`, `components/brochures/PrestationPicker.tsx`, `components/brochures/ItemRetouch.tsx`

**Interfaces:**
- Consumes: `getBrochure`, `saveBrochure`, `renewBrochureLink` (Task 3) ; `paginateBrochure(..., { forEditor: true })`, `parseBrochureContent` (Task 2) ; `Flipbook`, `BrochurePageView` (Task 4) ; catalogue lu par `createClient().from('prestations').select('id, name, description, gastro_card_html, gastro_card_html_en, unit_price, child_unit_price, category, photo_url')` ; envoi de photo par `supabase.storage.from('storage').upload` avec `fileToWebp` (comme `PhotoBuilder.tsx`, chemin `${user.id}/brochures/...`).
- Produces: enregistrement automatique (anti-rebond 800 ms) par `saveBrochure` ; aperçu = `Flipbook` des pages éditeur.

- [ ] **Step 1: Write the failing e2e test** `test('composer une brochure : sections, prestations, style, prix')` : ouvrir l'éditeur, « Ajouter des prestations », cocher deux prestations, l'aperçu montre leurs noms ; passer au style « Carte » → les deux tiennent sur une page ; décocher « Afficher les prix » → plus de « € » dans l'aperçu ; retoucher le texte d'une prestation → la ligne `prestations` en base est inchangée.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** : panneau de composition (nom ; style à trois vignettes ; langue ; prix affichés, HT/TTC, taux ; couverture : titre, sous-titre, photo ; « qui sommes-nous » activable avec texte et photo ; contact activable ; sections renommables, ordonnables, avec leurs prestations ordonnables ; prestation `missing` barrée avec « supprimée du catalogue » et bouton Retirer) ; aperçu à droite (sous le panneau sur téléphone) ; clic sur une prestation de l'aperçu → `ItemRetouch` (texte riche via `RichTextEditor`, photo, masquer le prix).
- [ ] **Step 4: Run** the e2e test — Expected: PASS ; captures 360 et 1280 px.
- [ ] **Step 5: Commit** `feat(brochures): éditeur de brochure`.

### Task 7: Formulaire de fin de livre

**Files:**
- Create: `components/brochures/BrochureRequestForm.tsx`, `server/brochureRequests.ts` (`'use server'`)
- Modify: `app/b/[token]/page.tsx` (`formSlot`), `app/api/prospect/route.ts` (envoi des deux emails extrait dans `server/prospectMail.ts`, réutilisé)
- Create: `server/prospectMail.ts`
- Test: `server/brochures.test.ts`

**Interfaces:**
- Consumes: `getPublicBrochure` (Task 3).
- Produces: `submitBrochureRequest(token: string, fields: { first_name: string; last_name: string; email: string; phone?: string; event_type?: string; event_date?: string; guest_count?: number; guest_count_children?: number; service_address?: string; message?: string }): Promise<{ error: string | null }>` — brochure active obligatoire ; mêmes contrôles que `/api/prospect` (nom, prénom, email valide) ; limite `MAX_REQUESTS_PER_HOUR = 5` par brochure et par empreinte d'IP (motif de `server/site.ts`) ; insertion `prospect_requests` avec `owner_user_id` = propriétaire, `user_token` null, `brochure_id`, `status 'nouveau'` ; `notifyProspect({ ownerId, prospect, brochureName })` de `server/prospectMail.ts` (notification au traiteur + accusé au lecteur, mêmes modèles `prospectNotificationEmail` / `prospectAckEmail`, mention de la brochure dans la notification) ; compte démo : faux succès sans insertion.

- [ ] **Step 1: Write the failing tests** : envoi valide → une ligne `prospect_requests` avec `brochure_id` et `owner_user_id` du traiteur, deux emails envoyés ; email invalide → erreur, rien d'inséré ; Review Focus 3 : brochure désactivée → erreur ; Review Focus 4 : sixième envoi de la même IP dans l'heure → erreur « Trop de demandes » ; `/api/prospect` envoie toujours ses deux emails (test existant ou nouveau sur `notifyProspect`).
- [ ] **Step 2: Run** `npx vitest run server/brochures.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `server/prospectMail.ts`, `server/brochureRequests.ts`, le formulaire (champs et libellés du formulaire de `app/p/[token]`, en anglais si `language === 'en'`, message de remerciement à la place après envoi).
- [ ] **Step 4: Run** the unit tests and extend `e2e/brochures.spec.ts` with `test('une demande depuis la dernière page arrive dans les Prospects')` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(brochures): formulaire de demande en fin de brochure`.

### Task 8: Envoyer une brochure, et la brochure dans les Prospects

**Files:**
- Create: `components/brochures/SendBrochureModal.tsx`
- Modify: `server/brochures.ts` (`sendBrochure`), `lib/mail/templates.ts` (`brochureEmail`), `app/(app)/brochures/page.tsx` et `components/brochures/BrochureEditor.tsx` (bouton « Envoyer »), `app/(app)/prospects/page.tsx` (envoi depuis une demande ; champ « URL brochure » : liste de choix des brochures actives en plus de la saisie libre)
- Test: `server/brochures.test.ts`

**Interfaces:**
- Consumes: `listBrochures` (Task 3).
- Produces:
  - `sendBrochure(input: { brochureId: string; to: string; message?: string; prospectId?: string }): Promise<{ error: string | null }>` — comme `sendQuoteToClient` : `requireWriter`, démo → `DEMO_BLOCKED`, destinataires validés (`lib/emailList`), portée entreprise, brochure active, lien `${await appOrigin()}/b/${token}`, `fromName` = nom de l'entreprise, `replyTo` = email de l'entreprise ; avec `prospectId` (même entreprise) : `prospect_requests.status = 'broch_envoyee'` si la demande est encore `nouveau`.
  - `brochureEmail({ companyName, brochureName, message, link, language }): Email` (bouton « Feuilleter la brochure » / « Browse the brochure »).

- [ ] **Step 1: Write the failing tests** : `sendBrochure` envoie un email contenant `/b/<token>` ; avec `prospectId` la demande passe `broch_envoyee` ; une demande d'une autre entreprise reste inchangée ; compte démo → `DEMO_BLOCKED` ; brochure désactivée → erreur.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** l'action, le modèle d'email, la fenêtre d'envoi (destinataire, message, « Copier le lien » à côté) et les points d'entrée.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit -p .`, `npx next build` (puis `rm -rf .next/cache`) — Expected: PASS.
- [ ] **Step 5: Commit** `feat(brochures): envoi par email et depuis les Prospects`.
