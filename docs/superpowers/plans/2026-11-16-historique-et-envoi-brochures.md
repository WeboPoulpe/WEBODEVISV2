# Historique des actions et envoi groupé des brochures — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un journal inaltérable de toutes les actions du compte de l'entreprise, consultable avec filtres et tri sur une page « Historique », et l'envoi d'une brochure à plusieurs clients en une fois, chacun avec son lien personnalisé.

**Architecture:** Une table `activity_log` protégée par des déclencheurs, alimentée par une fonction SQL `public.log_activity` (qui gère le regroupement). Elle est appelée automatiquement par `executeQuery` (server/compat/execute.ts) après chaque écriture sur une table suivie, dans la même transaction, et explicitement via `logActivity()` (lib/activity.ts) dans les fonctions serveur qui ne passent pas par `executeQuery`. Une action serveur `listActivity` lit le journal (titulaire et gérants seulement) pour la page `app/(app)/historique`.

**Tech Stack:** Next.js (App Router, actions serveur), Drizzle + Postgres (Neon), PGlite + Vitest pour les tests, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-16-historique-et-envoi-brochures-design.md`

## Global Constraints

- Migration **0056**, additive et rejouable (`IF NOT EXISTS`, `CREATE OR REPLACE`), ajoutée à `db/migrations/meta/_journal.json` (idx 56, tag `0056_activity_log`), testée sur PGlite (`createTestDb`), puis `npm run db:migrate`. `next build` doit passer avant tout push (pas de push dans ce plan).
- Une écriture d'historique qui échoue **n'empêche jamais l'action** : console.error `[historique]`, rien d'autre.
- Comptes de démo (`isDemoUser`) : aucune ligne d'historique conservée.
- Regroupement : action `modification` ou `consultation_client`, même entreprise, même auteur (ou les deux null), même `entity_type` + `entity_id`, dernière activité (`updated_at`) il y a **moins de 10 minutes** → la ligne existante est prolongée (`updated_at = now()`, `details.count + 1`). Jamais pour les autres actions.
- Lecture réservée au titulaire et aux gérants : `profiles.company_role = 'gerant'` (le titulaire a `gerant` par défaut). Même règle que `canManage` dans server/team.ts.
- Dates affichées et filtres de période en **Europe/Paris**.
- Brochures : au plus **50** destinataires par envoi (`MAX_BROCHURE_RECIPIENTS = 50` dans lib/emailList.ts), un email après l'autre.
- Le texte de l'interface est en français, ton du reste de l'app (phrases simples, pas de jargon).

## Review Focus

1. **Import en masse** (ImportClientsModal insère des centaines de clients d'un coup) : une seule ligne « 214 clients créés », pas 214 lignes. → test dans Task 3.
2. **Administrateur entré dans un compte** (`actingAsAdmin`) : la ligne porte `via_admin = true` et s'affiche « par l'équipe WeboDevis ». → tests Task 3 et Task 5.
3. **Élément supprimé depuis** : la ligne garde son libellé figé et n'offre pas de lien mort. → test Task 5 (`exists: false`).
4. **Suppression d'un compte** (purge existante) : la cascade efface son historique, alors que tout autre DELETE est refusé. → test Task 1.
5. **Client sans email ou doublon d'adresse** dans le sélecteur de brochures : le client sans email n'est pas cochable, un même email n'est envoyé qu'une fois. → test Task 6.

---

### Task 1: Table `activity_log` et fonction `log_activity`

**Files:**
- Create: `db/migrations/0056_activity_log.sql`
- Modify: `db/migrations/meta/_journal.json` (entrée idx 56)
- Modify: `db/schema/tables.ts` (table `activity_log`, après `audit_log`)
- Test: `server/activityLog.sql.test.ts`

**Interfaces:**
- Produces: table `public.activity_log(id, company_id, actor_id, actor_label, via_admin, action, entity_type, entity_id, entity_label, summary, details jsonb, created_at, updated_at)` ; `company_id` → `users(id) ON DELETE CASCADE`.
- Produces: `public.log_activity(p_company uuid, p_actor uuid, p_via_admin boolean, p_action text, p_entity_type text, p_entity_id uuid, p_entity_label text, p_summary text, p_details jsonb) returns void`.
  - `p_company` null → `coalesce(parent_user_id, id)` du profil de `p_actor` ; si les deux sont null, ne fait rien.
  - `actor_label` = `trim(first_name || ' ' || last_name)` du profil, sinon son email ; null si `p_actor` null.
  - Applique le regroupement (Global Constraints) ; `details.count` vaut 1 à la création.
- Produces: déclencheurs `activity_log_no_update` (BEFORE UPDATE : refuse si autre chose que `updated_at` et `details` change) et `activity_log_no_delete` (BEFORE DELETE : refuse si `exists (select 1 from users where id = old.company_id)` — la cascade d'une purge passe donc).
- Index : `(company_id, created_at desc)`, `(company_id, entity_type)`, `(company_id, actor_id)`.

- [ ] **Step 1: Écrire les tests** (`createTestDb`, deux utilisateurs + profils, l'un collaborateur `parent_user_id` = l'autre) :
  - `log_activity crée une ligne rattachée à l'entreprise du collaborateur` → `company_id` = titulaire, `actor_label` = « Sophie Durand ».
  - `deux modifications du même devis à 3 minutes d'écart ne font qu'une ligne` (entre les deux appels, `update activity_log set updated_at = now() - interval '3 min'` : autorisé, seul `updated_at` change) → 1 ligne, `details->>'count' = '2'`.
  - `après 11 minutes, une nouvelle ligne` → 2 lignes.
  - `une création n'est jamais regroupée` → 2 lignes.
  - `UPDATE du résumé refusé` → `expect(pg.exec('update activity_log set summary = ...')).rejects.toThrow()`.
  - `DELETE refusé` → rejects.
  - `la purge du compte efface son historique` → `delete from users where id = titulaire` réussit, `count(*) = 0`.
- [ ] **Step 2: Lancer** `npx vitest run server/activityLog.sql.test.ts` → FAIL (fonction inconnue).
- [ ] **Step 3: Écrire la migration, l'entrée du journal Drizzle et la table Drizzle** (commentaire français en tête de table, comme les voisines).
- [ ] **Step 4: Relancer** → PASS.
- [ ] **Step 5: Commit** `feat(historique): table activity_log inaltérable et fonction log_activity`

---

### Task 2: `lib/activity.ts` — libellés, tables suivies, `logActivity`

**Files:**
- Create: `lib/activity.ts` (pur, sans `server-only` : partagé avec l'interface pour les libellés)
- Create: `server/activityWrite.ts` (`import 'server-only'`, `logActivity`)
- Test: `lib/activity.test.ts`, `server/activityWrite.test.ts`

**Interfaces:**
- Produces (lib/activity.ts) :
  - `type ActivityAction = 'creation' | 'modification' | 'suppression' | 'envoi' | 'statut' | 'paiement' | 'acceptation' | 'relance' | 'consultation_client' | 'invitation' | 'role'` ; `ACTION_LABELS: Record<ActivityAction, string>` (« Création », « Modification », …).
  - `type ActivityEntity = 'devis' | 'facture' | 'client' | 'brochure' | 'prestation' | 'ingredient' | 'extra' | 'fournisseur' | 'commande' | 'stock' | 'materiel' | 'modele' | 'categorie' | 'degustation' | 'equipe' | 'parametres'` ; `ENTITY_LABELS: Record<ActivityEntity, { one: string; many: string }>` (« client » / « clients »).
  - `entityHref(entity: ActivityEntity, id: string | null): string | null` (devis → `/devis/{id}`, client → `/clients?id={id}`, brochure → `/brochures/{id}`, facture → `/factures?id={id}`, prestation → `/prestations?id={id}`, sinon la page de liste, null pour `parametres` → `/parametres`).
  - `TRACKED_TABLES: Record<string, { entity: ActivityEntity; id: string; label: string; forceAction?: ActivityAction }>` où `id` et `label` sont des expressions SQL sur l'alias `t0`. Minimum : `quotes`, `quote_services` / `rental_items` / `event_ingredients` / `event_extras` (→ `devis`, `id: 't0.quote_id'`, `forceAction: 'modification'`, libellé du devis parent par sous-requête), `customers`, `customer_contacts` (→ client parent), `prestations`, `prestation_categories`, `ingredients`, `ingredient_stocks`, `stock_movements`, `extras`, `suppliers`, `supplier_orders`, `supplier_order_items` (→ commande parent), `quote_templates`, `devis_templates`, `rental_templates`, `material_templates`, `profiles` (→ `parametres`, libellé « Paramètres de l'entreprise »). Libellé devis : `coalesce(t0.quote_number || ' — ', '') || coalesce(nullif(t0.name, ''), t0.client_name)` ; client : `coalesce(nullif(t0.company_name, ''), trim(coalesce(t0.first_name, '') || ' ' || coalesce(t0.last_name, '')), t0.email)`. Tables techniques (stats, notifications, jetons, versions, commentaires) absentes = non suivies.
  - `activitySummary(action: ActivityAction, entity: ActivityEntity, label: string, count = 1): string` → « Client Julie Martin créé », « 214 clients créés », « Devis D-2026-042 — Mariage Dupont modifié ».
- Produces (server/activityWrite.ts) : `logActivity(e: { company?: string | null; actor: string | null; viaAdmin?: boolean; action: ActivityAction; entity: ActivityEntity; entityId?: string | null; label: string; summary?: string; details?: Record<string, unknown> }): Promise<void>` — `db.execute(sql\`select public.log_activity(...)\`)`, résumé par défaut `activitySummary`, ne fait rien pour `isDemoUser(actor)`, n'émet jamais d'exception.

- [ ] **Step 1: Tests** : `activitySummary` (les trois phrases ci-dessus, accord masculin/féminin : « Facture F-2026-017 créée », « Brochure … supprimée ») ; `entityHref('devis', 'x') === '/devis/x'` ; `logActivity` écrit une ligne (PGlite) ; `logActivity` avec une base qui lève une erreur se résout sans exception ; acteur de démo → 0 ligne.
- [ ] **Step 2: Lancer** `npx vitest run lib/activity.test.ts server/activityWrite.test.ts` → FAIL.
- [ ] **Step 3: Implémenter.** Le genre vient d'un champ `feminine` dans `ENTITY_LABELS`.
- [ ] **Step 4: Relancer** → PASS.
- [ ] **Step 5: Commit** `feat(historique): libellés, tables suivies et logActivity`

---

### Task 3: Enregistrement automatique dans `executeQuery`

**Files:**
- Modify: `server/compat/execute.ts` (partie « Écriture », l. ~286-345)
- Test: `server/compat/executeActivity.test.ts` (pool simulé sur `createTestDb`, comme execute.test.ts mais avec le vrai schéma)

**Interfaces:**
- Consumes: `TRACKED_TABLES`, `activitySummary` (Task 2), `public.log_activity` (Task 1).
- Produces: rien de nouveau pour les autres tâches.

Approche : si `TRACKED_TABLES[d.table]` existe et `ctx.uid && !ctx.bypass`, ajouter à la requête CTE une colonne `touched` = `json_agg(json_build_object('id', <id>, 'label', <label>))` sur `m t0`. Avant le `commit` (et donc annulé avec le `rollback` de démo), dans un `savepoint activity` : action = `forceAction ?? { insert: 'creation', upsert: 'modification', update: 'modification', delete: 'suppression' }[d.op]` ; dédoublonner par `id` ; si ≤ 20 éléments distincts, un `select public.log_activity(...)` par élément ; au-delà, une seule ligne `activitySummary(action, entity, '', n)` avec `entity_id` null et `details.ids` (les 200 premiers). `p_via_admin = !!ctx.actingAsAdmin`. Erreur → `rollback to savepoint activity`, console.error, l'écriture continue.

- [ ] **Step 1: Tests**
  - `créer un client écrit « Client Julie Martin créé »` (via `executeQuery({table:'customers', op:'insert', …})`).
  - `modifier une ligne de devis note une modification du devis parent` (`quote_services` update → `entity_type = 'devis'`, `entity_id` = quote_id).
  - `supprimer un client écrit une suppression avec le libellé d'avant`.
  - `importer 30 clients d'un coup écrit une seule ligne « 30 clients créés »`.
  - `une écriture refusée (périmètre) n'écrit rien`.
  - `un compte de démo n'écrit rien`.
  - `actingAsAdmin marque via_admin`.
  - `si log_activity échoue (fonction renommée dans le test), le client est quand même créé`.
  - `une table non suivie (notifications) n'écrit rien`.
- [ ] **Step 2: Lancer** `npx vitest run server/compat/executeActivity.test.ts` → FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Relancer ce test et** `npx vitest run server/compat` → tout PASS (execute.test.ts inchangé : son schéma maison n'a pas `log_activity`, d'où le savepoint qui doit l'absorber — vérifier qu'il reste vert).
- [ ] **Step 5: Commit** `feat(historique): chaque écriture de l'application est notée`

---

### Task 4: Enregistrements explicites dans les fonctions serveur

**Files:**
- Modify: `server/quotes.ts` (`sendQuoteToClient`, `shareQuoteByWhatsapp`), `server/acceptance.ts` (`acceptQuote`, `recordQuoteView`), `server/invoices.ts` (`createInvoiceDraft`, `createCreditNoteDraft`, `deleteInvoiceDraft`, `issueInvoice`, `recordPayment`, `deletePayment`), `server/reminders.ts` (`runReminders`, les deux boucles), `server/tastings.ts` (`saveTasting`, `setTastingStatus`), `server/team.ts` (`inviteMember`, `setMemberRole`, `removeMember`, `acceptInvitation`), `server/brochures.ts` (`createBrochure`, `createKindBrochure`, `duplicateBrochure`, `deleteBrochure`, `saveBrochure` → modification, `renewBrochureLink`, `recordBrochureView` → `consultation_client` acteur null)
- Test: assertions ajoutées dans `server/quotes.test.ts`, `server/acceptance.test.ts`, `server/invoices.test.ts`, `server/reminders.test.ts`, `server/team.test.ts`

**Interfaces:**
- Consumes: `logActivity` (Task 2). Pour les actions sans acteur (client, relance automatique), passer `company` explicitement et `actor: null`.

Phrases (résumé explicite) : « Devis D-… envoyé par email à a@x.fr, b@x.fr », « Devis D-… envoyé par WhatsApp », « Devis D-… accepté et signé par le client », « Devis D-… consulté par le client », « Facture F-… émise », « Paiement de 1 200,00 € reçu — Facture F-… », « Relance envoyée — Devis D-… », « Dégustation du 12 déc. avec Julie Martin enregistrée », « Rôle de Sophie Durand : Gérant », « Brochure “Mariages 2027” consultée par un client ». Chaque appel est placé **après** la réussite de l'action.

- [ ] **Step 1: Tests** (un par fichier, dans les tests existants) : après `sendQuoteToClient` → une ligne `action='envoi', entity_type='devis'` ; après `acceptQuote` → `action='acceptation'`, `actor_id` null ; après `recordPayment` → `action='paiement'` ; après `runReminders` → `action='relance'` ; après `setMemberRole` → `action='role'`. Si le fichier de test simule `@/db` sans la vraie base, simuler `@/server/activityWrite` et vérifier l'appel (`expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'envoi' }))`).
- [ ] **Step 2: Lancer** ces cinq fichiers → FAIL.
- [ ] **Step 3: Ajouter les appels** dans toutes les fonctions listées.
- [ ] **Step 4: Lancer** `npx vitest run server --maxWorkers=3` → PASS.
- [ ] **Step 5: Commit** `feat(historique): envois, paiements, signatures, relances et équipe notés`

---

### Task 5: Lecture — `listActivity`

**Files:**
- Create: `server/activity.ts`
- Test: `server/activity.test.ts`

**Interfaces:**
- Produces:
  - `type ActivityFilters = { from?: string; to?: string /* YYYY-MM-DD, Paris, inclus */; actor?: string /* uuid | 'client' (acteur null) */; entity?: ActivityEntity; action?: ActivityAction; q?: string; order?: 'desc' | 'asc'; cursor?: string | null }`
  - `type ActivityEntry = { id: string; at: string; until: string | null /* updated_at si regroupé */; actor: string | null; viaAdmin: boolean; action: ActivityAction; entity: ActivityEntity; entityId: string | null; label: string; summary: string; details: Record<string, unknown> | null; href: string | null /* null si l'élément n'existe plus */ }`
  - `listActivity(f: ActivityFilters): Promise<{ allowed: boolean; entries: ActivityEntry[]; next: string | null; people: { id: string; label: string }[] }>` — `requireUser`, refus (`allowed: false`, listes vides) si `company_role !== 'gerant'` ; entreprise = `companyOf(uid)` ; 50 lignes ; pagination par curseur sur `(created_at, id)` encodé base64 ; `q` = `ilike` sur `summary` et `entity_label` (échapper `%` et `_`) ; `people` = auteurs distincts de l'entreprise ; existence vérifiée par type d'élément sur la page (une requête `id = any(...)` par table principale).

- [ ] **Step 1: Tests** : collaborateur `collaborateur` → `allowed: false` ; gérant → voit les lignes de son entreprise et pas celles d'une autre ; filtre `entity: 'client'` ; filtre `actor: 'client'` → seulement les acteurs null ; filtre de période en heure de Paris (une ligne à 23h30 UTC le 15 compte pour le 16) ; `order: 'asc'` ; 60 lignes → 50 puis `next` → 10 ; `q: '50%'` ne plante pas ; client supprimé → `href: null`, libellé intact.
- [ ] **Step 2: Lancer** `npx vitest run server/activity.test.ts` → FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Relancer** → PASS.
- [ ] **Step 5: Commit** `feat(historique): lecture filtrée et paginée du journal`

---

### Task 6: Envoi groupé des brochures

**Files:**
- Modify: `lib/emailList.ts` (`MAX_BROCHURE_RECIPIENTS = 50`)
- Modify: `server/brochures.ts` (`sendBrochure`)
- Create: `components/brochures/RecipientPicker.tsx`
- Modify: `components/brochures/SendBrochureModal.tsx`
- Test: `server/brochures.test.ts`, `components/brochures/RecipientPicker.test.tsx` (si l'outillage de test de composants existe ; sinon, la logique pure dans `lib/brochureRecipients.ts` + `lib/brochureRecipients.test.ts`)

**Interfaces:**
- Produces: `sendBrochure(input: { brochureId: string; to?: string; recipients?: { email: string; name?: string; customerId?: string }[]; greeting?: string /* modèle, {{client}} remplacé par le nom */; message?: string; prospectId?: string; personal?: { label: string; greeting?: string | null } | null }): Promise<{ error: string | null; sent?: number; failed?: string[] }>`. `to` et `personal` gardent leur comportement actuel (appelants : server/webo/executeMore.ts, tests existants). Avec `recipients` : dédoublonnage par email, limite 50, chaque destinataire **avec `name`** reçoit son propre `brochure_links` (`kind: 'client'`, `label: name`, `greeting` = modèle avec `{{client}}` remplacé) et son lien ; les autres reçoivent `share_token`. Une ligne d'historique `envoi` / `brochure` : « Brochure “X” envoyée à N clients », `details.to` = emails envoyés.
- Produces: `mergeRecipients(chosen: { email: string; name?: string; customerId?: string }[], typed: string): { list: …[]; invalid: string[] }` dans `lib/brochureRecipients.ts`.
- `RecipientPicker` props : `{ value: Recipient[]; onChange(v: Recipient[]): void }` ; charge `customers` (`id, customer_type, first_name, last_name, company_name, email`) via `createClient()` ; recherche ; cases à cocher ; client sans email affiché grisé, non cochable ; puces des choisis ; champ d'adresses libres. Le modal remplace le champ « Destinataire » par ce sélecteur, garde la case « Lien personnalisé » (cochée par défaut dès qu'un client est choisi) avec le modèle « Pour {{client}} » ; ouvert depuis Prospects, l'adresse et le nom pré-remplis deviennent un destinataire. Message de fin : « Brochure envoyée à 12 clients. » ou la liste des échecs.

- [ ] **Step 1: Tests** : `sendBrochure` avec 3 `recipients` dont 2 nommés → 2 nouveaux `brochure_links` avec greeting « Pour Julie », « Pour Marc », 3 emails envoyés, chacun avec son lien ; même email deux fois → 1 envoi ; 51 destinataires → erreur « 50 adresses au plus » ; un échec Resend sur 3 → `failed` = cette adresse, `sent: 2` ; une ligne `activity_log` `envoi`. `mergeRecipients` : adresse invalide signalée, doublon client/adresse tapée fusionné.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter** serveur puis interface.
- [ ] **Step 4: Lancer** `npx vitest run server/brochures.test.ts lib/brochureRecipients.test.ts` → PASS (anciens tests `to`/`personal` compris).
- [ ] **Step 5: Commit** `feat(brochures): envoyer une brochure à plusieurs clients, chacun son lien`

---

### Task 7: Page « Historique » et menu

**Files:**
- Create: `app/(app)/historique/page.tsx`, `components/historique/ActivityFilters.tsx`, `components/historique/ActivityList.tsx`
- Modify: `components/layout/nav.ts` (groupe « Paramètres » : `{ href: '/historique', icon: History, label: 'Historique', exact: false }`, masqué dans `useNavGroups` si `company_role !== 'gerant'` — `company_role` est déjà dans `context/AuthContext.tsx`)

**Interfaces:**
- Consumes: `listActivity`, `ActivityEntry`, `ActivityFilters` (Task 5) ; `ACTION_LABELS`, `ENTITY_LABELS` (Task 2).

Rendu (maquette du spec) : regroupement par jour (« Aujourd'hui », « Hier », « lundi 9 novembre »), icône/couleur par action (même famille que `components/devis/QuoteHistory.tsx`), heure `14:05` ou `14:05 → 14:18` si regroupé, auteur (« Client » si null, « l'équipe WeboDevis » si `viaAdmin`), ligne cliquable si `href`. Filtres : période (Aujourd'hui / 7 jours / 30 jours / Dates choisies → deux champs date), Personne (`people` + « Client »), Élément, Action, recherche (attente de 300 ms), tri « Plus récent d'abord / Plus ancien d'abord ». Filtres lus et écrits dans l'URL (`useSearchParams` + `router.replace`). « Voir plus » charge `next`. Sur mobile, les filtres sont repliés derrière un bouton « Filtrer ». Si `allowed: false` : « L'historique est réservé au titulaire et aux gérants. » Liste vide : « Aucune action sur cette période. » Couleurs du thème (crème / vert sapin / terracotta), pas de bloc décoratif.

- [ ] **Step 1: Implémenter** la page et le menu.
- [ ] **Step 2: Vérifier** `npx tsc --noEmit` → 0 erreur, puis `npm run build` → succès.
- [ ] **Step 3: Vérifier dans l'app** (skill `run`) : créer un client, modifier un devis deux fois, envoyer une brochure à 2 clients → 3 lignes visibles, le filtre « Élément : Client » n'en garde qu'une, le tri inverse l'ordre, l'URL garde les filtres après rechargement ; largeur 375 px sans défilement horizontal.
- [ ] **Step 4: Commit** `feat(historique): page Historique avec filtres et tri`

---

### Task 8: Mise en base et vérification finale

- [ ] **Step 1:** `npx vitest run --maxWorkers=3` → tout PASS.
- [ ] **Step 2:** `npm run build` → succès.
- [ ] **Step 3:** `npm run db:migrate` (base de prod, migration additive — voir mémoire « Bêta : migrations directes ») après accord de Maxence.
- [ ] **Step 4:** Pas de push : Maxence décide.
