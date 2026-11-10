# Abonnement Stripe — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** abonnement WeboDevis (100 € HT/mois ou 1 100 € HT/an) via Stripe Checkout, paiement avant d'entrer, lecture
seule + export quand l'abonnement s'arrête, comptes offerts, pièces du mois liées à l'abonnement.

**Architecture :** une table `company_subscriptions` recopie l'état Stripe par entreprise (compte titulaire). Une règle
pure (`lib/subscription.ts`) en déduit `full | readonly | unpaid`. Elle est branchée sur les deux portes d'écriture
existantes (`requireWriter`, `executeQuery`) et sur le layout de `app/(app)`. Le webhook et le retour de Checkout
passent tous deux par une seule fonction `applyStripeSubscription`, qui relit l'abonnement chez Stripe.

**Tech Stack :** Next.js 15 (App Router, server actions), Drizzle + Postgres (Neon), PGlite pour les tests, Vitest,
paquet `stripe` (Node).

**Spec :** `docs/superpowers/specs/2026-11-10-abonnement-stripe-design.md` (à lire en entier avant toute tâche).

## Global Constraints

- Les textes de l'interface, les commentaires et les messages de commit sont en français, sur le ton du code existant.
- Prix : `STRIPE_PRICE_MENSUEL` (100 € HT/mois), `STRIPE_PRICE_ANNUEL` (1 100 € HT/an), taxe non incluse, TVA 20 %
  ajoutée par Stripe Tax (`automatic_tax: { enabled: true }`).
- Variables : `STRIPE_SECRET_KEY`, `WEBHOOK_SECRET_STRIPE`, `STRIPE_PRICE_MENSUEL`, `STRIPE_PRICE_ANNUEL`.
- Pas d'essai gratuit. Aucun prix sur le site public (`app/site`, `lib/site`).
- Le compte de démo (`isDemoUser`) n'est jamais soumis à l'abonnement. `past_due` garde l'accès complet. Dans le
  doute, on laisse l'accès.
- Réglage d'admin `billingEnforced` (clé `billing_enforced` de `app_settings`), **éteint par défaut**. Éteint, tout le
  monde a `full`.
- Migration additive et rejouable (`IF NOT EXISTS`), testée sur PGlite (`npm test`). On ajoute son entrée dans
  `db/migrations/meta/_journal.json` (idx 50).
- Avant de pousser sur `main` : `npm run build` OK, `npm test` OK, `npm run db:migrate` appliqué.
- Message unique pour une écriture refusée : « Votre abonnement n’est pas actif : vos données restent consultables et
  exportables. Réactivez-le pour modifier. »

## Review Focus

1. Un traiteur vient de payer et le webhook n'est pas encore arrivé (ou n'arrivera pas) : il doit entrer dans le
   logiciel, pas retomber sur `/abonnement`. Test dans la tâche 6 (`syncCheckoutSession`).
2. Événements Stripe rejoués ou dans le désordre (`updated` reçu avant `created`, `deleted` reçu avant un vieux
   `updated`) : l'état final doit être celui de Stripe. Test dans la tâche 5.
3. Un collaborateur d'une entreprise abonnée : accès complet, même si son propre compte n'a pas de ligne. Test dans la
   tâche 3 (`accessOf` résout l'entreprise).
4. Une fonction serveur qui écrit sans passer par `requireWriter` laisse écrire un compte inactif. Le test d'audit de
   la tâche 4 doit l'empêcher.
5. Un abonnement annuel avec anchor au 31 : les pièces doivent revenir le 28 ou 29 février, puis le 31 mars, sans
   doublon. Test dans la tâche 7.

---

### Task 1 : Schéma et migration `0050_subscriptions`

**Files :**
- Create : `db/migrations/0050_subscriptions.sql`
- Modify : `db/migrations/meta/_journal.json` (entrée idx 50, tag `0050_subscriptions`)
- Modify : `db/schema/tables.ts` (après `webo_ledger`)
- Test : `server/subscription.migration.test.ts`

**Interfaces :**
- Produces : tables Drizzle `company_subscriptions`, `stripe_events`.

`company_subscriptions` : `company_id uuid pk → users.id on delete cascade`, `stripe_customer_id text unique`,
`stripe_subscription_id text`, `plan text check in ('mensuel','annuel')`, `status text not null default 'none'`,
`current_period_end timestamptz`, `cancel_at_period_end boolean not null default false`,
`anchor_day int check 1..31`, `ever_subscribed boolean not null default false`, `comped boolean not null default false`,
`comped_note text not null default ''`, `last_event_at timestamptz`, `updated_at timestamptz not null default now()`.
`stripe_events` : `id text pk`, `type text not null`, `received_at timestamptz not null default now()`.

Remplissage dans la migration : une ligne `comped = true, comped_note = 'Bêta', ever_subscribed = true` pour chaque
titulaire existant (`profiles.parent_user_id is null`, `role <> 'admin'`, id différent de la démo), `on conflict do
nothing`.

- [ ] **Step 1 : Test qui échoue.** `createTestDb()` puis insertion de 2 titulaires, d'un collaborateur, de la démo et
  d'un admin **avant** de rejouer `0050_subscriptions.sql` à la main. On attend 2 lignes `comped = true`, aucune pour le
  collaborateur, la démo ni l'admin. Un second passage de la migration ne change rien.
- [ ] **Step 2 :** `npx vitest run server/subscription.migration.test.ts` → FAIL (table absente).
- [ ] **Step 3 :** écrire la migration, le schéma Drizzle et l'entrée du journal.
- [ ] **Step 4 :** relancer → PASS, puis `npm test` en entier → PASS.
- [ ] **Step 5 :** commit `feat(abonnement): tables company_subscriptions et stripe_events, comptes bêta offerts`.

### Task 2 : Règle d'accès et calendrier des pièces (pur, sans base)

**Files :**
- Create : `lib/subscription.ts`
- Test : `lib/subscription.test.ts`

**Interfaces :**
- Produces :
  - `type Access = 'full' | 'readonly' | 'unpaid'`
  - `interface SubRow { status: string; comped: boolean; ever_subscribed: boolean; cancel_at_period_end: boolean; current_period_end: string | null; plan: 'mensuel' | 'annuel' | null; anchor_day: number | null }`
  - `accessFrom(row: SubRow | null, opts: { demo: boolean; enforced: boolean }): Access`
  - `periodStart(anchorDay: number, now: Date): Date` : début de la période mensuelle en cours, à minuit (heure de
    Paris), le jour `min(anchorDay, dernier jour du mois)`.
  - `nextPeriodStart(anchorDay: number, now: Date): Date`
  - `periodKey(anchorDay: number, now: Date): string` : `'s:2026-11-17'`, préfixé pour ne jamais se confondre avec
    l'ancien `month_key` `'2026-11'`.
  - `statusLabel(status: string, cancelAtPeriodEnd: boolean): string` : `active` → « Actif » ; avec résiliation →
    « Se termine bientôt » ; `past_due` → « Paiement en retard » ; `canceled` → « Terminé » ; autre → « Inactif ».

- [ ] **Step 1 : Tests qui échouent.**
  - `accessFrom` : `enforced:false` → `full` quel que soit l'état ; `demo` → `full` ; `comped` → `full` ;
    `active`, `past_due` → `full` ; `canceled` + `ever_subscribed` → `readonly` ; `null` → `unpaid` ; `incomplete`
    sans `ever_subscribed` → `unpaid` ; `unpaid`/`paused` + `ever_subscribed` → `readonly`.
  - `periodStart(17, 2026-11-10)` = 17 octobre 2026 00:00 Paris ; `periodStart(31, 2027-02-15)` = 31 janvier ;
    `periodStart(31, 2027-03-01)` = 28 février 2027 ; `nextPeriodStart(31, 2027-02-15)` = 28 février 2027.
  - `periodKey(17, 2026-11-20)` = `'s:2026-11-17'`.
- [ ] **Step 2 :** `npx vitest run lib/subscription.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter. Le calcul du minuit de Paris peut réutiliser la méthode de `nextMonthStartParis`
  (`lib/webocoins.ts`), extraite en une fonction commune si besoin.
- [ ] **Step 4 :** → PASS.
- [ ] **Step 5 :** commit `feat(abonnement): règle d'accès et calendrier des pièces`.

### Task 3 : Accès d'une entreprise côté serveur, réglage `billingEnforced`

**Files :**
- Create : `server/subscription.ts`
- Modify : `server/settings.ts` (`getBillingEnforced(): Promise<boolean>`, `setBillingEnforced(v: boolean)`, clé
  `billing_enforced`, défaut `false`)
- Test : `server/subscription.test.ts` (PGlite, sur le modèle de `server/weboWallet.test.ts`)

**Interfaces :**
- Consumes : `accessFrom`, `SubRow` (tâche 2) ; `companyIdFor` (`server/weboWallet.ts`).
- Produces :
  - `getSubscription(companyId: string): Promise<SubRow & { stripe_customer_id: string | null; stripe_subscription_id: string | null } | null>`
  - `accessOf(companyId: string): Promise<Access>` : cache en mémoire de 60 s, par entreprise.
  - `accessOfUser(userId: string): Promise<Access>` : résout l'entreprise puis appelle `accessOf`.
  - `invalidateAccess(companyId: string): void`
  - `setComped(companyId: string, comped: boolean, note: string): Promise<void>` : crée la ligne au besoin ; passer à
    `true` met aussi `ever_subscribed = true`.

- [ ] **Step 1 : Tests qui échouent.** Réglage éteint → `full`. Allumé : un titulaire sans ligne → `unpaid` ; son
  collaborateur → `unpaid` ; `setComped(owner, true)` → `full` pour les deux ; `setComped(owner, false)` →
  `readonly` ; la démo → `full`. `invalidateAccess` rend visible un changement immédiatement, sans attendre la fin du
  cache.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 :** commit `feat(abonnement): accès d'une entreprise et réglage « Abonnement obligatoire »`.

### Task 4 : Blocage des écritures

**Files :**
- Modify : `server/session.ts` (`SubscriptionRequiredError`, contrôle dans `requireWriter`)
- Modify : `server/compat/execute.ts` (contrôle à côté de `isReadOnlyUser`)
- Modify : toutes les fonctions serveur qui écrivent avec `requireUser()`. On commence par `server/brochureCollab.ts`,
  `brochures.ts`, `brochureLinks.ts`, `extraHr.ts`, `invoices.ts`, `eventSheets.ts`, `accountingSettings.ts`,
  `numbering.ts`, `weboTranslate.ts`, `webo/chat.ts`, puis les routes `app/api/**` qui écrivent.
- Modify : `server/acceptance.ts` (`acceptQuote`), `server/brochureRequests.ts` (`submitBrochureRequest`)
- Modify : `server/reminders.ts` (`runReminders`) et la tâche `app/api/cron/rappels-extras` : on saute les entreprises
  dont l'accès n'est pas `full`.
- Test : `server/subscriptionGuard.test.ts`, `server/writeGates.test.ts`

**Interfaces :**
- Consumes : `accessOfUser` (tâche 3).
- Produces : `class SubscriptionRequiredError extends Error` (`name = 'SubscriptionRequiredError'`), avec le message des
  Global Constraints. Côté client, on reconnaît l'erreur à ce message ou à ce nom.

Règle : `requireWriter` lève `SubscriptionRequiredError` si `accessOfUser(user.id) !== 'full'`, **sauf** quand
`session.actingAsAdmin`. Dans ce cas, et seulement sur un compte non `full`, l'écriture est permise et inscrite au
journal (`logAudit`, action `ecriture_admin_compte_inactif`), une fois par minute au plus et par compte. `executeQuery`
applique la même règle pour les opérations autres que `select`, sauf `ctx.bypass`.

Restent permis sans abonnement, parce qu'ils n'utilisent pas `requireWriter` : la connexion, le mot de passe, la
suppression du compte, l'export `/api/compte/export`, les actions d'abonnement (tâche 6).

- [ ] **Step 1 : Tests qui échouent** (`subscriptionGuard.test.ts`) :
  - réglage allumé, entreprise `readonly` : `requireWriter` rejette avec `SubscriptionRequiredError` ;
    `executeQuery({op:'insert'})` renvoie une erreur avec le même message ; `executeQuery({op:'select'})` passe ;
  - `actingAsAdmin` : l'écriture passe et une ligne d'audit est créée ;
  - `acceptQuote` d'un devis d'une entreprise `readonly` → erreur « Ce traiteur ne peut pas recevoir de réponse en
    ligne pour le moment, contactez-le directement. » ;
  - `runReminders` n'envoie rien pour une entreprise `readonly`.
- [ ] **Step 2 : Test d'audit qui échoue** (`writeGates.test.ts`) : parcourir `server/**/*.ts` (hors tests, hors
  `compat`). Pour chaque fichier, si le texte contient `db.insert(`, `.update(` ou `.delete(` dans une fonction
  exportée qui appelle `requireUser(` sans appeler `requireWriter(`, le test échoue avec le nom du fichier et de la
  fonction. Une liste blanche commentée couvre les cas légitimes : lecture qui met un compteur à jour, `account.ts`,
  `auth.ts`, actions d'abonnement, admin.
- [ ] **Step 3 :** → FAIL. **Step 4 :** implémenter les contrôles et convertir les fonctions signalées vers
  `requireWriter`.
- [ ] **Step 5 :** `npm test` → PASS en entier. Les tests qui simulent `./session` restent valides.
- [ ] **Step 6 :** commit `feat(abonnement): lecture seule sans abonnement, côté serveur`.

### Task 5 : Client Stripe, application d'un abonnement, webhook

**Files :**
- `npm install stripe` (dernière version stable ; on fixe `apiVersion` dans le code).
- Create : `lib/stripe.ts` (`stripe(): Stripe` paresseux, lit `STRIPE_SECRET_KEY` ; `isTestMode(): boolean` si la clé
  commence par `sk_test_` ; `priceFor(plan): string` ; `planOfPrice(priceId): 'mensuel' | 'annuel' | null`)
- Create : `server/stripeSync.ts`
- Create : `app/api/stripe/webhook/route.ts` (`runtime = 'nodejs'`, corps brut `await req.text()`)
- Test : `server/stripeSync.test.ts` (PGlite + objets Stripe factices, `stripe()` simulé)

**Interfaces :**
- Consumes : `invalidateAccess` (tâche 3).
- Produces :
  - `applyStripeSubscription(subscriptionId: string, eventCreated?: number): Promise<{ companyId: string } | null>` :
    relit l'abonnement chez Stripe (`subscriptions.retrieve`). Il trouve l'entreprise par `metadata.company_id`, ou à
    défaut par `stripe_customer_id`. Il fait un upsert de `status`, `plan`, `current_period_end`,
    `cancel_at_period_end`, `stripe_subscription_id`, `anchor_day` (jour de `billing_cycle_anchor`, heure de Paris) et
    `ever_subscribed ||= status in (active, past_due)`. Il n'écrase pas une ligne dont `last_event_at` est plus récent
    que `eventCreated`. Il appelle `invalidateAccess`.
  - `handleStripeEvent(event: Stripe.Event): Promise<void>` : on insère dans `stripe_events` avec `on conflict do
    nothing`, et si l'événement existe déjà, on sort. Sinon :
    - `checkout.session.completed` en mode subscription → on lie `stripe_customer_id` à `client_reference_id`, puis
      `applyStripeSubscription(session.subscription)` ;
    - `customer.subscription.*` → `applyStripeSubscription(sub.id, event.created)` ;
    - `invoice.paid` / `invoice.payment_failed` / `invoice.payment_action_required` →
      `applyStripeSubscription(invoice.subscription)`. Un `payment_failed` envoie aussi un e-mail au titulaire (gabarit
      dans `lib/mail/templates`) ;
    - `checkout.session.async_payment_*`, `charge.refunded` → rien d'autre que l'enregistrement.

    En cas d'erreur, on retire la ligne de `stripe_events` puis on relance l'erreur, pour que Stripe réessaie.
- La route : `stripe().webhooks.constructEvent(body, signature, WEBHOOK_SECRET_STRIPE)`. Une signature invalide renvoie
  400, une erreur de `handleStripeEvent` renvoie 500, sinon `{ received: true }`. On ajoute `/api/stripe/webhook` aux
  routes publiques de `middleware.ts` si nécessaire, puisque le webhook arrive sans session.

- [ ] **Step 1 : Tests qui échouent :** un événement rejoué n'applique rien deux fois ; `updated` (created = 200) puis
  un vieux `updated` (created = 100) → l'état de 200 reste ; `deleted` → `canceled`, et l'accès devient `readonly` ;
  une entreprise inconnue n'écrit rien et ne lève pas d'erreur ; une erreur dans le traitement retire la ligne de
  `stripe_events` ; `invoice.payment_failed` envoie un e-mail (`sendMail` simulé).
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 :** commit `feat(abonnement): webhook Stripe et recopie de l'état de l'abonnement`.

### Task 6 : Actions d'abonnement

**Files :**
- Create : `server/billingActions.ts` (`'use server'`)
- Test : `server/billingActions.test.ts`

**Interfaces :**
- Consumes : `stripe()`, `priceFor`, `isTestMode` (tâche 5) ; `applyStripeSubscription` ; `getSubscription`.
- Produces (toutes renvoient `{ error: string | null; url?: string }`, refusées à la démo et aux collaborateurs
  (`parent_user_id` non nul), et elles n'utilisent pas `requireWriter`) :
  - `startCheckout(plan: 'mensuel' | 'annuel')` : réutilise ou crée le client Stripe (`metadata.company_id`). Si un
    abonnement est `active` ou `past_due`, renvoie `{ url: '/parametres/abonnement' }`. Session :
    - `mode: 'subscription'`, `client_reference_id`, `subscription_data.metadata.company_id` ;
    - `automatic_tax`, `tax_id_collection`, `billing_address_collection: 'required'`,
      `customer_update: { address: 'auto', name: 'auto' }` ;
    - `success_url: ${origin}/?abonnement=ok&session_id={CHECKOUT_SESSION_ID}`, `cancel_url: ${origin}/abonnement`.
  - `syncCheckoutSession(sessionId: string)` : relit la session. Elle doit appartenir à l'entreprise de l'utilisateur
    (`client_reference_id`). Si elle est payée, appelle `applyStripeSubscription`.
  - `switchToAnnual()` : `subscriptions.update` avec l'item remplacé par `STRIPE_PRICE_ANNUEL`,
    `proration_behavior: 'create_prorations'`.
  - `cancelSubscription()` / `resumeSubscription()` : `cancel_at_period_end` à `true` / `false`, puis
    `applyStripeSubscription`.
  - `openBillingPortal()` : `billingPortal.sessions.create({ customer, return_url: ${origin}/parametres/abonnement })`.

- [ ] **Step 1 : Tests qui échouent** (`stripe()` simulé) :
  - `startCheckout` crée un seul client par entreprise sur deux appels, et passe `automatic_tax.enabled === true` ;
  - un abonné actif est renvoyé vers la page ;
  - un collaborateur est refusé ;
  - `syncCheckoutSession` d'une session d'une autre entreprise est refusée ;
  - `syncCheckoutSession` payée → accès `full` **sans aucun webhook** (Review Focus 1) ;
  - `cancelSubscription` puis `resumeSubscription` appellent Stripe avec `true` puis `false`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 :** commit `feat(abonnement): s'abonner, passer en annuel, annuler, reprendre, portail`.

### Task 7 : Pièces du mois liées à l'abonnement

**Files :**
- Modify : `server/weboWallet.ts` (`walletOf`)
- Test : `server/weboWallet.test.ts` (ajouts)

**Interfaces :**
- Consumes : `getSubscription`, `accessOf` (tâche 3) ; `periodKey`, `nextPeriodStart` (tâche 2).

Règle dans `walletOf` :
- si le réglage `billingEnforced` est allumé et que l'entreprise a un abonnement payant `full` avec `anchor_day`, la clé
  est `periodKey(anchor_day, now)` et `renewsAt` vaut `nextPeriodStart` ;
- si elle est offerte, si le réglage est éteint ou s'il n'y a pas d'`anchor_day`, on garde l'ancien comportement
  (`monthKeyParis`) ;
- si l'accès n'est pas `full`, rien n'est remis. La clé n'avance pas, les pièces existantes restent.

La comparaison « clé plus récente » (`row.month_key < key`) doit tenir quand on passe de `'2026-11'` à
`'s:2026-11-17'` : le préfixe `s:` est plus grand en ordre texte, donc la remise a lieu une fois. Il faut le vérifier
par un test.

- [ ] **Step 1 : Tests qui échouent :**
  - abonné le 17 : remise le 17 novembre, pas de seconde remise le 20, remise le 17 décembre ;
  - anchor 31 : remises le 31 janvier, le 28 février et le 31 mars 2027, une seule fois chacune ;
  - entreprise `readonly` : rien n'est remis ;
  - le passage d'une clé de mois civil à une clé d'abonnement remet une seule fois ;
  - un compte offert garde le mois civil.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS (avec les anciens tests du portefeuille).
- [ ] **Step 5 :** commit `feat(abonnement): pièces du mois à la date anniversaire de l'abonnement`.

### Task 8 : Écrans

**Files :**
- Create : `app/abonnement/page.tsx` (hors de `app/(app)`, avec `AuthShell`)
- Create : `app/(app)/parametres/abonnement/page.tsx`
- Create : `components/billing/PlanCards.tsx`, `components/billing/SubscriptionBanner.tsx`,
  `components/billing/SubscriptionRequiredDialog.tsx`
- Modify : `app/(app)/layout.tsx` (asynchrone : si `accessOfUser === 'unpaid'` et que ce n'est pas `actingAsAdmin`,
  `redirect('/abonnement')`)
- Modify : `components/layout/AppShell.tsx` (bandeau si `readonly` ; fenêtre unique quand une action renvoie le message
  `SubscriptionRequiredError`)
- Modify : `app/(app)/page.tsx` ou le tableau de bord (`?abonnement=ok&session_id=` → `syncCheckoutSession` puis
  « Merci, votre abonnement est actif »)
- Modify : `app/(app)/parametres/page.tsx` (lien vers Abonnement, à côté de WeboCoins)
- Modify : `middleware.ts` (`/abonnement` exige une session, comme les pages de l'app)
- Test : `e2e/abonnement.spec.ts` (Playwright, sur le modèle des specs existantes ; Stripe n'est pas appelé, on vérifie
  la redirection et la lecture seule)

Textes et contenus : ceux de la section « Interface » de la spec. Les cartes affichent **Mensuel 100 € HT/mois** (120 €
TTC) et **Annuel 1 100 € HT/an** (1 320 € TTC, « 1 mois offert »). Avec une clé de test, l'écran porte la mention
« Mode test ». Le collaborateur voit « L'abonnement de votre entreprise n'est pas encore actif », sans bouton de
paiement. Les boutons ouvrent `url` par `window.location.href`.

- [ ] **Step 1 : Test e2e qui échoue :** réglage allumé, compte sans abonnement → `/devis` redirige vers
  `/abonnement` ; compte `readonly` → `/devis` s'ouvre avec le bandeau, et « Nouveau devis » ouvre la fenêtre
  « Abonnement inactif » ; `/api/compte/export` répond 200.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter les écrans. **Step 4 :** → PASS, puis `npm run build` OK.
- [ ] **Step 5 :** commit `feat(abonnement): écran de paiement, page Abonnement, bandeau lecture seule`.

### Task 9 : Admin

**Files :**
- Modify : `server/admin.ts` :
  - `listAccounts` ajoute `subscription: { plan, status, current_period_end, comped }` ;
  - `setAccountComped(id, comped, note)` → `setComped` + `logAudit` ;
  - `setBillingEnforcedAdmin(on)` refuse en production (`process.env.VERCEL_ENV === 'production'`) si `isTestMode()`,
    avec le message « Stripe est en mode test : passez les clés en Live d'abord. »
- Modify : `app/admin/comptes/page.tsx` (colonne Abonnement, case « Accès offert » et sa note)
- Modify : `app/admin/reglages` (interrupteur « Abonnement obligatoire », à côté de l'ouverture des inscriptions)
- Test : `server/adminBilling.test.ts`

- [ ] **Step 1 : Tests qui échouent :** un non-admin est refusé ; `setAccountComped` écrit une ligne d'audit ;
  l'activation est refusée avec une clé `sk_test_` quand `VERCEL_ENV=production`, et acceptée hors production.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 :** commit `feat(abonnement): admin, accès offert et interrupteur « Abonnement obligatoire »`.

### Task 10 : Suppression du compte et abonnement

**Files :**
- Modify : `server/account.ts` (`requestAccountDeletion` : si un abonnement est `active` ou `past_due`,
  `cancel_at_period_end = true` chez Stripe. L'annulation de la suppression par l'admin le remet à `false`.)
- Modify : `server/accountPurge.ts` (`purgeAccount` : `subscriptions.cancel` immédiat si un abonnement non terminé
  existe, **avant** d'effacer)
- Test : `server/account.test.ts`, `server/accountPurge.test.ts` (ajouts, `stripe()` simulé)

- [ ] **Step 1 : Tests qui échouent :** une demande de suppression programme la résiliation ; l'annulation de la
  suppression la retire ; la purge annule chez Stripe puis efface ; si Stripe est en panne, la purge s'arrête et le
  compte reste à purger le lendemain.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 :** commit `feat(abonnement): résiliation à la suppression du compte`.

### Task 11 : Vérification finale et mise en route

- [ ] `npm test` → PASS en entier ; `npm run build` → OK ; `npx playwright test e2e/abonnement.spec.ts` → PASS.
- [ ] Essai de bout en bout en local avec la Stripe CLI (`stripe listen --forward-to localhost:3001/api/stripe/webhook`)
  et la carte `4242 4242 4242 4242` : inscription → `/abonnement` → paiement → logiciel ; annulation → « prend fin
  le … » ; reprise.
- [ ] `npm run db:migrate` sur la base, puis vérifier que les comptes existants sont bien marqués offerts.
- [ ] Rappeler à Maxence l'ordre de mise en route de la spec : prix et clés Live, portail sans résiliation, webhook Live,
  « Abonnement obligatoire », puis ouverture des inscriptions.
