# Abonnement Stripe : formule mensuelle ou annuelle, lecture seule sans abonnement

Date : 2026-11-10 · Statut : à valider par Maxence

## Pourquoi

WeboDevis sort en v0.1 le 1er décembre 2026. Le logiciel se paie par **abonnement**. Maxence a créé son compte Stripe :
il faut brancher l'abonnement, la résiliation et la coupure d'accès. Les recharges de WeboCoins par carte arrivent ensuite
(voir `2026-10-23-webocoins-traduction-webo-design.md`) : le même webhook doit pouvoir les accueillir.

Réussite : un traiteur qui sort de la démo s'abonne seul, est facturé chaque mois ou chaque année avec la TVA, peut
résilier seul, et un compte non payé ne peut plus travailler mais garde ses données.

## Décisions de Maxence

- **Prix** : 100 € HT par mois. **Annuel** : 1 100 € HT par an (11 mois payés, un mois offert). TVA française 20 % en
  plus.
- **Pas de période d'essai** : la démo suffit.
- **Les 200 pièces du mois sont liées à l'abonnement.** Elles sont renouvelées chaque mois à la date anniversaire de
  l'abonnement, y compris pour la formule annuelle. Sans abonnement actif, il n'y a pas de pièces du mois.
- **Un bouton « Annuler l'abonnement »** dans le logiciel.
- **Sans abonnement actif** : **lecture seule et export des données**, rien d'autre.
- **Les comptes bêta actuels (4) sont offerts** : ils gardent un accès complet sans Stripe.

## Objectifs

1. S'abonner (mensuel ou annuel) avec Stripe Checkout hébergé : pas de formulaire de carte chez nous.
2. Un webhook signé qui tient à jour l'état de l'abonnement de chaque entreprise.
3. La page Paramètres → Abonnement : formule, prochaine échéance, annuler / reprendre, passer en annuel, carte et
   factures (portail client Stripe).
4. Le passage en lecture seule appliqué **côté serveur** à toute écriture quand l'accès n'est pas actif.
5. Les pièces du mois redonnées à la date anniversaire, seulement aux comptes actifs.
6. Dans l'admin : l'état de l'abonnement de chaque compte, et une case « Accès offert ».

## Ce que ce projet ne fait pas

- Pas de recharges de WeboCoins : ce sera le projet suivant. Le webhook est seulement préparé pour elles.
- Pas de paiement de l'acompte par les clients du traiteur (Stripe Connect, plus tard).
- Pas d'affichage du prix sur le site public : le prix n'est montré qu'**à l'intérieur de l'app**, sur la page
  Abonnement. Pour le site, la règle « jamais de prix » tient toujours.
- Pas de codes promo ni de multiples formules (une seule offre).

## À ne surtout pas rater

- **Un traiteur qui a payé est bloqué** (webhook en retard, mauvaise lecture d'un statut) : c'est pire que tout. En cas
  de doute, on laisse l'accès. `past_due` garde l'accès complet pendant les relances de Stripe.
- **Des données perdues ou impossibles à exporter** pour un compte inactif.
- **Le double crédit** de pièces, ou un événement Stripe traité deux fois.
- **La démo touchée** : le compte de démo (`isDemoUser`) n'est jamais soumis à l'abonnement.

## État actuel du code (ce sur quoi on construit)

- Une entreprise = son compte titulaire (`profiles.parent_user_id` nul). Les collaborateurs y sont rattachés
  (`companyIdFor`, `server/companyScope.ts`). **L'abonnement est porté par l'entreprise**, et tous ses membres en
  dépendent.
- Il y a deux portes d'écriture côté serveur :
  - `requireWriter()` (`server/session.ts`) pour les fonctions serveur. Elle refuse déjà le rôle `lecture` avec
    `ReadOnlyError` ;
  - `executeQuery` (`server/compat/execute.ts`) pour `/api/db`. Toute opération autre que `select` y est refusée si
    `isReadOnlyUser`, avec un cache d'une minute.
- Une partie des fonctions qui écrivent appellent `requireUser()` au lieu de `requireWriter()`, par exemple certaines
  de `brochureCollab.ts`, `brochures.ts`, `extraHr.ts`, `invoices.ts`, `eventSheets.ts` et `accountingSettings.ts`.
- L'export RGPD existe déjà : `GET /api/compte/export` (JSON). Les PDF existants se téléchargent par les routes
  actuelles.
- Le portefeuille de pièces (`server/weboWallet.ts`, `webo_wallets`) remet les pièces au premier usage de chaque mois
  civil de Paris (`month_key`). L'idempotence passe par `webo_ledger.idempotency_key`.
- Les crons sont déclarés dans `vercel.json`. Les migrations sont dans `db/migrations` (prochaine : `0050`), additives, et
  testées sur PGlite avant `db:migrate`.

## Conception

### Données (migration `0050_subscriptions.sql`, additive)

Une table `company_subscriptions`, une ligne par entreprise (clé : `company_id` → `users.id`, on delete cascade) :

| colonne | rôle |
|---|---|
| `stripe_customer_id` | client Stripe de l'entreprise, créé au premier passage en caisse |
| `stripe_subscription_id` | abonnement en cours (null si aucun) |
| `plan` | `mensuel` / `annuel` / null |
| `status` | statut Stripe recopié tel quel (`active`, `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, `paused`) ou `none` |
| `current_period_end` | fin de la période payée |
| `cancel_at_period_end` | résiliation programmée |
| `anchor_day` | jour du mois de la date de départ (1-31), pour les pièces |
| `comped` | booléen : **accès offert** (bêta, geste commercial) |
| `comped_note` | pourquoi, pour l'admin |
| `last_event_at` | horodatage Stripe (`event.created`) du dernier événement appliqué |
| `updated_at` | |

Une table `stripe_events` (`id` = identifiant d'événement Stripe, `type`, `received_at`) : un événement déjà traité est
ignoré.

**Migration de départ** : les entreprises existantes (titulaires actuels, hors démo) reçoivent une ligne `comped = true`
avec la note « Bêta ». Les comptes bêta sont offerts, et aucun compte existant n'est bloqué le jour du déploiement.

### Règle d'accès (une seule fonction, testée)

`accessOf(companyId)` → `'full' | 'readonly' | 'unpaid'` (`unpaid` : voir la section suivante) :
- démo → `full`.
- `comped` → `full`.
- `status` ∈ { `active`, `past_due` } → `full`. Avec `cancel_at_period_end`, l'accès reste complet jusqu'à
  `current_period_end`, puisque Stripe garde `active` jusque-là.
- sinon (`none`, `canceled`, `unpaid`, `incomplete*`, `paused`) → `readonly` si `ever_subscribed`, `unpaid` sinon.

Cache d'une minute en mémoire, comme `isReadOnlyUser`, **vidé** pour l'entreprise concernée dès qu'un webhook ou une
action de l'admin la modifie.

### Payer avant d'entrer (décision de Maxence)

On distingue deux cas : une entreprise qui **n'a jamais été abonnée**, et une entreprise **dont l'abonnement s'est
arrêté**. On ajoute pour cela la colonne `ever_subscribed` (booléen, vrai dès le premier abonnement actif) :

- **jamais abonnée et non offerte** → `accessOf` renvoie un troisième état, `'unpaid'`. Le titulaire ne voit pas le
  logiciel : toute page de l'app (`app/(app)`) le renvoie vers **`/abonnement`**. C'est un écran hors de l'app, dans le
  style des pages de connexion (`AuthShell`), avec les deux formules et « S'abonner » vers Checkout. Il propose aussi
  « Se déconnecter » et « Essayer la démo ». Les écritures sont refusées comme en lecture seule.
- **abonnement arrêté** → `'readonly'` : il entre dans le logiciel, en lecture seule avec export, comme décrit plus bas.

Le parcours d'inscription : le formulaire `/register` (quand les inscriptions sont ouvertes, `isSignupOpen`) crée le
compte et connecte le traiteur comme aujourd'hui, puis l'envoie sur `/abonnement` au lieu du tableau de bord. Après le
paiement, Checkout le ramène sur `/?abonnement=ok`. Si le webhook n'est pas encore passé, la page d'arrivée applique la
session Checkout elle-même (voir Interface), pour qu'il ne retombe jamais sur `/abonnement` après avoir payé.

Les **collaborateurs** invités dépendent de l'abonnement de leur entreprise. Si elle est `unpaid`, ils voient un écran
« L'abonnement de votre entreprise n'est pas encore actif » sans bouton de paiement. Un compte créé **par l'admin**
suit la même règle que `/register`, sauf si l'admin coche « Accès offert ».

Le contrôle de redirection se fait côté serveur, dans le layout de `app/(app)`, et non dans le middleware : celui-ci ne
lit pas la base. Le contrôle des écritures reste celui de `requireWriter` / `executeQuery`.

### Blocage des écritures

- `requireWriter()` : après le contrôle du rôle, si `accessOf(entreprise) === 'readonly'`, elle lève une nouvelle
  `SubscriptionRequiredError` (« Votre abonnement n'est pas actif : vos données restent consultables et exportables.
  Réactivez-le pour modifier. »).
- `executeQuery` : même contrôle pour toute opération autre que `select`, à côté de `isReadOnlyUser`, avec le même
  message.
- **Audit obligatoire** : toutes les fonctions serveur et routes qui écrivent et appellent encore `requireUser()` passent
  à `requireWriter()`, ou à une variante qui fait le même contrôle. On ajoute un test qui échoue si une fonction
  exportée d'un fichier `server/*.ts` fait un `insert` / `update` / `delete` sans passer par une porte d'écriture. La
  forme de ce test (analyse statique simple ou liste blanche) est laissée au développeur.
- Ce qui reste permis en lecture seule :
  - lire, chercher, imprimer et télécharger les PDF déjà produits ;
  - l'export `/api/compte/export` ;
  - se connecter et changer son mot de passe ;
  - supprimer son compte (droit RGPD) ;
  - la page Abonnement et ses actions Stripe.
- Ce qui est interdit : tout ce qui crée, modifie ou envoie quelque chose, y compris les e-mails aux clients, les
  relances et Webo (le débit de pièces passe par `requireWriter`, mais l'assistant et la traduction le vérifient aussi à
  l'entrée).
- **Les crons** : les relances automatiques (`/api/cron/relances`, `rappels-extras`) sautent les entreprises en lecture
  seule. La purge des comptes n'est pas concernée.
- **Les liens publics déjà envoyés** (devis `/d`, brochures `/b`, `/p`, `/e`) restent **consultables**. L'acceptation
  en ligne d'un devis et la demande « Je veux ce menu » sont refusées, avec un message neutre pour le client final :
  « Ce traiteur ne peut pas recevoir de réponse en ligne pour le moment, contactez-le directement. »

### Interface

- **Bandeau** en haut de l'app quand l'accès est en lecture seule : « Abonnement inactif : vos données restent
  consultables et exportables. » avec deux boutons, **Réactiver** et **Exporter mes données**.
- Les boutons d'écriture ne sont pas tous grisés un par un. Une erreur `SubscriptionRequiredError` renvoyée par le
  serveur affiche une fenêtre unique, « Abonnement inactif », avec le bouton Réactiver. Le développeur peut, s'il veut,
  masquer les gros boutons « Nouveau devis » et autres, mais la sécurité vient du serveur.
- **Paramètres → Abonnement** (nouvelle page, visible du titulaire ; les collaborateurs voient l'état sans les boutons) :
  - sans abonnement : deux cartes, **Mensuel 100 € HT/mois** et **Annuel 1 100 € HT/an** (« 1 mois offert »), avec les
    montants TTC en dessous. Un bouton « S'abonner » mène à Stripe Checkout ;
  - abonné : formule, statut en français, prochaine échéance, montant. Boutons **Passer en annuel** (si mensuel),
    **Gérer ma carte et mes factures** (portail Stripe) et **Annuler l'abonnement** ;
  - **Annuler** : confirmation (« Votre abonnement s'arrêtera le 17 décembre 2026. Jusque-là vous gardez tout. Ensuite
    vos données restent consultables et exportables. »), puis `cancel_at_period_end = true` par l'API ;
  - résiliation programmée : « Votre abonnement prend fin le … » et un bouton **Reprendre mon abonnement**, qui remet
    `cancel_at_period_end = false` ;
  - `past_due` : « Le dernier paiement a échoué, mettez à jour votre carte », avec le lien vers le portail ;
  - accès offert : « Accès offert », sans bouton de paiement.
- Retour de Checkout : `?abonnement=ok` affiche « Merci, votre abonnement est actif ». La page relit l'état. Si le
  webhook n'est pas encore passé, elle va chercher la session Checkout chez Stripe et applique l'abonnement elle-même,
  par la même fonction que le webhook. Ainsi le traiteur qui vient de payer n'est jamais bloqué.
- **Admin → Comptes** : une colonne Abonnement (formule, statut, échéance) et une case **Accès offert** avec une note.
  Chaque changement est inscrit dans le journal d'admin (`lib/audit.ts`).

### Stripe

- Dépendance : le paquet officiel `stripe` (Node), version d'API fixée dans le code.
- Variables : `STRIPE_SECRET_KEY`, `WEBHOOK_SECRET_STRIPE` (nom choisi par Maxence, déjà dans `.env.local`),
  `STRIPE_PRICE_MENSUEL`, `STRIPE_PRICE_ANNUEL`. `STRIPE_PUBLISHABLE_KEY` est présente mais inutile : Checkout est
  hébergé chez Stripe.
- **Checkout** en `mode: 'subscription'`, avec :
  - un client Stripe réutilisé et `client_reference_id` = `company_id`, plus `metadata.company_id` sur la session et
    l'abonnement ;
  - `automatic_tax` activé (Stripe Tax) ;
  - la collecte de l'adresse de facturation et du **numéro de TVA intracommunautaire** (`tax_id_collection`) ;
  - le nom de l'entreprise.

  Si un abonnement non terminé existe déjà, on n'ouvre pas de nouvelle session, on renvoie vers la page.
- **Passer en annuel** : changement du prix de l'abonnement existant, avec prorata (comportement Stripe par défaut).
  Le passage en mensuel depuis l'annuel se fait par le portail ou est refusé, au choix du développeur ; ce n'est pas
  demandé.
- **Portail client** : carte, factures et adresse. Dans la configuration du portail, la résiliation est **désactivée**,
  pour qu'elle passe par notre bouton et nos messages.
- **Webhook** `POST /api/stripe/webhook` (runtime Node, corps brut, signature vérifiée avec `STRIPE_WEBHOOK_SECRET`).
  Un événement déjà présent dans `stripe_events` répond 200 sans rien refaire. Un événement plus ancien que
  `last_event_at` ne remplace pas un état plus récent. Au lieu de se fier au contenu de l'événement, on **relit
  l'abonnement chez Stripe** et on l'applique : l'ordre d'arrivée ne compte plus. Événements traités :
  - `checkout.session.completed` (mode subscription) → lier le client et l'abonnement à l'entreprise ;
  - `customer.subscription.created` / `updated` / `deleted` → recopier l'état ;
  - `invoice.paid` / `invoice.payment_failed` / `invoice.payment_action_required` → recopier l'état. Un échec envoie
    aussi un e-mail au titulaire (`lib/mail`) en plus des e-mails de Stripe, si ces derniers sont activés : au choix du
    développeur ;
  - `checkout.session.async_payment_succeeded` / `_failed`, `charge.refunded` → acceptés et journalisés, sans effet pour
    l'instant (recharges WeboCoins, projet suivant).
- Une erreur interne répond 500 pour que Stripe réessaie. Une signature invalide répond 400.

### Pièces du mois liées à l'abonnement

- La remise des pièces ne suit plus le mois civil de Paris mais une **période d'abonnement** : la clé devient la date de
  début de la période mensuelle en cours, calculée à partir de `anchor_day`. Exemple : abonné le 17, les pièces
  reviennent chaque 17. Un `anchor_day` de 31 tombe au dernier jour des mois plus courts.
- `walletOf` reste « au premier usage » : si `accessOf` donne `full` **par abonnement payant** et que la période a
  changé, il remet les pièces. Sinon, il ne remet rien, et les pièces du mois déjà présentes ne sont pas retirées. Pas
  de cron nécessaire.
- Comptes offerts : ils continuent au mois civil, comme aujourd'hui.
- Démo : inchangée (0 pièce).
- Lecture seule : Webo est refusé de toute façon. Les pièces gardées restent dans le portefeuille et redeviennent
  utilisables à la réactivation.
- `renewsAt` sur « Mes WeboCoins » affiche la prochaine date anniversaire.
- Le réglage `monthly_override` et la valeur générale (`monthlyCoins`) s'appliquent toujours.

### Tests

- `accessOf` : tous les statuts, offert, démo, résiliation programmée.
- Webhook : signature invalide, événement rejoué, événements dans le désordre, entreprise inconnue.
- Lecture seule : une écriture par `requireWriter` et une par `/api/db` refusées ; lecture et export autorisés ;
  acceptation publique d'un devis refusée.
- Pièces : allocation à la date anniversaire, pas de double allocation, rien pour un compte inactif, fin de mois
  (anchor 31).
- Migration : les comptes existants deviennent offerts.

### Mise en route (Maxence, mode Test puis Live)

1. Produit « WeboDevis » avec deux prix récurrents, **taxe non incluse** : 100 €/mois et 1 100 €/an. **Fait en mode
   Test** le 2026-11-10 (`prod_VbNYG07s65nykC`, clés de recherche `webodevis_mensuel` / `webodevis_annuel`, code fiscal
   SaaS `txcd_10103001`). Les identifiants sont dans `.env.local`. Il faudra refaire ces prix en Live.
2. Stripe Tax activé avec le numéro de TVA de Webomax.
3. Portail client activé, **résiliation désactivée**.
4. Webhook sur `https://<domaine>/api/stripe/webhook`, avec les 10 événements listés plus haut.
5. Les 4 variables dans Vercel et `.env.local`.

## Laissé au développeur

L'emplacement exact des fichiers (`server/subscription.ts`, `app/(app)/parametres/abonnement`…), la forme du test
d'audit des écritures, le choix de masquer ou non certains boutons, le libellé exact des statuts, et l'e-mail maison en
cas d'échec de paiement.

## Choix faits par Claude (à vérifier par Maxence)

- **L'admin connecté dans le compte d'un client** (`actingAsAdmin`) n'est bloqué ni par la lecture seule ni par l'écran
  de paiement. Il peut ainsi corriger des données ou dépanner. Chaque écriture faite ainsi sur un compte inactif est
  inscrite au journal d'admin.
- **Décocher « Accès offert »** fait passer le compte en **lecture seule**, pas sur l'écran de paiement : le traiteur
  garde l'accès à ses données et voit le bouton « Réactiver ». Une ligne cochée « offert » compte donc comme
  `ever_subscribed`.

- **Suppression du compte par un abonné** : l'abonnement est mis en `cancel_at_period_end` dès la demande de suppression,
  sans remboursement. Si l'admin annule la suppression, la résiliation programmée est retirée. La purge à 30 jours
  annule immédiatement chez Stripe un abonnement encore actif, avant d'effacer les données. (Conseil donné à Maxence,
  qui ne s'y est pas opposé.)
- **Comptes offerts à la migration** : tous les titulaires existants hors démo (4 selon le dernier état connu). L'admin
  peut décocher ensuite.

## Ouverture des inscriptions (décision de Maxence, 2026-11-10)

Les inscriptions s'ouvrent maintenant. Le paiement doit donc fonctionner pour de vrai. Pour que personne n'entre avec une
carte de test :
- un réglage d'admin **« Abonnement obligatoire »** (`billingEnforced`, dans les réglages existants). Tant qu'il est
  éteint, `accessOf` renvoie `full` pour tous, et l'écran de paiement reste accessible à qui veut s'abonner ;
- en production, l'app **refuse d'allumer ce réglage avec une clé `sk_test_`**. Elle affiche dans l'admin : « Stripe est
  en mode test : passez les clés en Live d'abord ». Avec une clé de test, l'écran de paiement porte la mention « Mode
  test » ;
- ordre de mise en route : code en production → clés et prix Live dans Vercel → webhook Live → allumer « Abonnement
  obligatoire » → ouvrir les inscriptions (`isSignupOpen`).
