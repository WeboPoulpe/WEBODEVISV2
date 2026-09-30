# Design — Chantier 1 : migration Supabase → Neon + NextAuth + Vercel Blob

Date : 2026-09-30
Statut : design validé en conversation, spec à relire avant découpage en plan d'implémentation.

## Feuille de route d'ensemble

Quatre chantiers, chacun avec sa spec, son plan et sa validation :

1. **Migration Neon** (ce document) — base, authentification, stockage, accès côté serveur. Inclut la refonte fonctionnelle de la partie Événements au moment où ce domaine est migré.
2. **Nouvelle direction artistique + responsive** — design system, coque avec tab bar, composants partagés, toutes les pages.
3. **PWA** — installation sur l'écran d'accueil, notifications push, mode hors ligne.
4. **Bascule en production** — peut avoir lieu dès la fin du chantier 1, sans attendre 2 et 3.

## Objectif

Sortir entièrement de Supabase sans changer ce que voit l'utilisateur (hors Événements), de sorte que :

- la base vit sur Neon, avec un schéma décrit dans le code et des migrations générées (plus de SQL collé dans un dashboard) ;
- plus aucun appel à la base ne part du navigateur ;
- la production reste sur Supabase, intacte, jusqu'à la bascule.

## Contexte existant (audit du 2026-09-30)

- 285 appels `.from('<table>')` sur 26 tables ; 273 (96 %) partent du navigateur avec la clé anonyme et reposent sur les règles RLS.
- 18 appels `supabase.auth.*` ; `useAuth()` est utilisé par 32 fichiers.
- 9 appels de stockage, tous sur un bucket public nommé `storage` (logos, photos de couverture, devis importés). Des URL Supabase sont enregistrées en base.
- Aucun RPC, aucun temps réel, aucune edge function.
- Couche serveur actuelle : une seule route (`app/api/prospect/route.ts`), aucune server action.
- `sql/` ne contient le `CREATE TABLE` que de 8 tables sur 26 : le schéma réel (tables, règles, triggers) n'existe que dans Supabase.
- **Export du 2026-09-30** : la base contient en réalité 58 tables (31 héritées de la v1, qui n'est plus utilisée), 4 comptes, 171 fichiers (~287 Mo) dans 4 buckets et 35 triggers. Les 58 tables sont copiées dans Neon pour ne rien perdre ; seul le code des 27 tables de la v2 est migré.
- La table `rental_templates` et les colonnes `rental_items.confirmed_individually` / `confirmed_at`, utilisées par le code, n'existent pas en production : elles sont créées pendant le lot 5.
- Hébergement : Vercel.

## Choix techniques

| Besoin | Choix | Raison |
|---|---|---|
| Base | Neon (Postgres 18), projet déjà créé | décision du propriétaire |
| Schéma et requêtes | Drizzle ORM + drizzle-kit | schéma en TypeScript, migrations générées, requêtes typées |
| Pilote | `pg` (node-postgres) avec l'URL poolée de Neon | transactions complètes, même pilote en local et sur Vercel |
| Authentification | NextAuth 4 (version stable ; la v5 est encore en bêta), fournisseur Credentials, session JWT en cookie | décision du propriétaire ; email + mot de passe comme aujourd'hui |
| Mots de passe | bcrypt (`bcryptjs`) | même format que Supabase : les hachages existants sont repris tels quels |
| Emails (mot de passe oublié) | service d'envoi à choisir (Resend proposé) | Supabase envoyait ces emails ; NextAuth ne le fait pas |
| Fichiers | Vercel Blob (accès public) | hébergement Vercel, même modèle d'URL publiques qu'aujourd'hui |
| Tests | Playwright (déjà en place) + Vitest pour les calculs | aucun test n'existait |

Neon Auth, activé par défaut sur le projet, n'est pas utilisé ; son schéma `neon_auth` est laissé de côté.

## Architecture

```
db/
  schema/            une table par fichier thématique (quotes.ts, customers.ts, events.ts…)
  index.ts           client Drizzle
  migrations/        générées par drizzle-kit
drizzle.config.ts
auth.ts              configuration NextAuth
app/api/auth/[...nextauth]/route.ts
server/
  session.ts         requireUser(), requireAdmin()
  <domaine>.ts       fonctions serveur ('use server') d'un domaine
lib/storage.ts       envoi / suppression de fichiers (Vercel Blob)
scripts/
  export-supabase.ts export du schéma et des données (lecture seule)
  import-neon.ts     import rejouable dans Neon
```

### Accès aux données

- Chaque domaine expose des fonctions serveur (`'use server'`) : `listQuotes()`, `updateQuote(id, patch)`, etc.
- Chaque fonction commence par `requireUser()` et filtre sur l'identifiant de l'utilisateur connecté. C'est ce qui remplace les règles RLS : **aucune fonction ne fait confiance à un identifiant de propriétaire envoyé par le navigateur**.
- Les fonctions renvoient `{ data }` ou `{ error }` ; l'interface affiche l'erreur (aujourd'hui les échecs sont silencieux sur la plupart des pages).
- Les pages restent des composants client et appellent ces fonctions à la place de `createClient().from(...)`. Pas de réécriture des écrans dans ce chantier, sauf Événements.
- Les sélections imbriquées PostgREST (`supplier:suppliers(id, name)`, 19 occurrences) deviennent des requêtes relationnelles Drizzle.
- Les noms de tables et de colonnes sont conservés tels quels, y compris l'incohérence `user_id` / `owner_user_id`. Les renommer est hors périmètre.

### Authentification

- Nouvelle table `users` (`id`, `email`, `password_hash`, `email_verified_at`, `created_at`). **Les identifiants UUID de Supabase sont conservés**, donc toutes les colonnes `user_id` / `owner_user_id` et `profiles.id` restent valides sans conversion.
- Les hachages bcrypt de `auth.users` sont copiés : les quatre comptes gardent leur mot de passe.
- `profiles` reste la table du profil métier ; elle est créée par la fonction serveur d'inscription (plus par le navigateur).
- `middleware.ts` garde la même logique de routes, avec la session NextAuth. `/e/` est ajouté aux routes publiques (bug actuel : le lien extra renvoie vers `/login`).
- `context/AuthContext.tsx` garde la même interface (`user`, `profile`, `signIn`, `signUp`, `signOut`) pour ne pas toucher aux 32 fichiers qui l'utilisent.
- Rôle administrateur : lu dans `profiles.role` côté serveur par `requireAdmin()`. Le trigger `enforce_profile_role` disparaît, puisque le navigateur n'écrit plus dans `profiles`.
- Mot de passe oublié : jeton à usage unique et à durée limitée, stocké haché, envoyé par email.

### Fichiers

- `lib/storage.ts` remplace les 9 appels de stockage. L'envoi passe par une fonction serveur qui vérifie la session et range le fichier sous `<id utilisateur>/…`.
- Les fichiers existants sont copiés du bucket Supabase vers Vercel Blob, et les URL enregistrées en base sont réécrites (`profiles.logo_url`, fichier de devis importé, photos de couverture dans les JSON de devis).
- `next.config.ts` : l'hôte d'images devient celui de Vercel Blob.

### Pages publiques

- `/p/[token]` et `/api/prospect` : lecture du jeton et insertion de la demande côté serveur.
- `/e/[token]` : déjà côté serveur ; passe à Drizzle, et la liste de courses liée devient une page publique protégée par le même jeton.

### Base

- Aucune règle RLS sur Neon : l'autorisation est dans `server/`.
- Les triggers sans lien avec l'authentification (mouvements de stock, alerte de stock) sont repris à l'identique.
- Les triggers d'historique de statut utilisaient `auth.uid()` : ils appellent désormais `current_app_user()`, qui lit un réglage de session posé par l'application (NULL sinon). Les triggers liés à l'authentification Supabase (création de profil, contrôle du rôle) sont supprimés et remplacés par le code serveur.
- Structure de référence : `db/baseline/` (SQL de recréation) et `db/schema/` (schéma Drizzle généré par introspection de Neon). Les évolutions passent par `npm run db:generate` puis `npm run db:migrate`.
- Une tâche planifiée Supabase (`auto-complete-events-daily`, qui appelait une edge function de la v1) n'est pas reprise.

## Refonte Événements (faite pendant la migration de ce domaine)

Décisions prises :

- Un devis devient un événement **quand il est confirmé** (`valide`, `acompte`, `paye`). La liste, le calendrier et les pages globales appliquent la même règle et les mêmes libellés de statut (source unique : `lib/quoteStatus.ts`).
- Les onglets « Courses » et « Prépa & Achats » **fusionnent** : 4 onglets (Checklist, Matériel, Courses, Extras). Chaque ligne de courses porte une origine (`auto` ou `manuelle`) ; « Recalculer » ne remplace que les lignes `auto`.

Corrections incluses :

- Un seul calcul des besoins (`lib/` pur, testé) : correspondance des prestations par nom normalisé, fournisseur préféré de l'ingrédient repris, message explicite quand rien ne correspond.
- La création de commandes fournisseurs depuis un événement ne crée plus de doublons.
- Les cases cochées du matériel sont enregistrées.
- Les frais additionnels de la fiche Finance sont enregistrés (la requête actuelle n'est jamais envoyée).
- Le lieu affiché est celui de l'événement partout (le calendrier affiche aujourd'hui l'adresse du client).
- Date, lieu, nombre de couverts et statut sont modifiables depuis la fiche ; « Retour » revient à la page d'origine.
- Toutes les actions sont accessibles au doigt (plus d'actions visibles au survol uniquement).

## Copie des données

- `scripts/export-supabase.ts` lit Supabase **en lecture seule** : schéma `public`, données, comptes (`auth.users`), liste des fichiers.
- `scripts/import-neon.ts` vide puis recharge les tables de Neon. Il est rejouable : on le relance pendant les tests, puis une dernière fois à la bascule.
- Contrôle après import : nombre de lignes par table identique des deux côtés.

## Ordre de migration

Chaque lot est terminé quand son domaine ne contient plus d'import Supabase et que ses tests passent.

1. Fondations : export, schéma Drizzle, import, `server/session.ts`.
2. Authentification : NextAuth, middleware, inscription, connexion, mot de passe oublié.
3. Devis (liste, dossiers, éditeurs, impression) et clients.
4. Prestations, catégories, ingrédients, fournisseurs, stock, commandes.
5. Événements (refonte ci-dessus), extras, calendrier, pages globales, location.
6. Prospects, pages publiques, notifications, modèles, paramètres, admin.
7. Fichiers : Vercel Blob, copie, réécriture des URL.
8. Nettoyage : suppression de `@supabase/*`, de `lib/supabase/` et des variables d'environnement Supabase.

## Tests

- **Isolation entre comptes** : un test vérifie qu'un compte ne peut ni lire ni modifier les données d'un autre, pour chaque domaine. C'est le test qui remplace la garantie que donnait RLS.
- **Calculs** (Vitest) : besoins en ingrédients, matériel auto-calculé, totaux et marge.
- **Tour des pages** (Playwright, 3 largeurs) : chaque page s'affiche sans erreur console ni requête en échec.
- **Parcours** (Playwright) : connexion, création d'un devis, passage en confirmé, fiche événement, recalcul des courses, lien extra public.

## Bascule

1. Geler les écritures côté production (courte fenêtre annoncée).
2. Dernier export / import, contrôle des comptages.
3. Copie finale des fichiers.
4. Variables d'environnement Vercel : ajout de Neon, NextAuth, Blob, email ; retrait de Supabase.
5. Réinitialisation du mot de passe de la base Neon (il a circulé en clair pendant le développement).
6. Déploiement, tour Playwright sur la production, vérification manuelle des deux comptes.
7. Supabase est conservé en l'état pendant deux semaines comme solution de repli, puis arrêté.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL`, `DATABASE_URL_POOLED` | Neon (présentes) |
| `SUPABASE_DB_URL` | export uniquement, retirée après la bascule (à fournir) |
| `AUTH_SECRET` | signature des sessions NextAuth (générée) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (à fournir) |
| clé du service d'email | mot de passe oublié (à fournir) |
| `TEST_EMAIL`, `TEST_PASSWORD` | compte de test Playwright |

## Hors périmètre

- Nouvelle direction artistique, responsive, tab bar : chantier 2.
- PWA, notifications push, hors ligne : chantier 3.
- Renommage de colonnes, refonte d'écrans autres qu'Événements.
- Reprise de l'historique des règles SQL du dossier `sql/` : il devient une archive.

## Risques

- **Schéma réel inconnu** tant que l'export n'est pas fait : des colonnes, contraintes ou triggers absents de `sql/` peuvent apparaître et allonger le lot 1.
- **Autorisation applicative** : un oubli de filtre dans une fonction serveur exposerait les données d'un autre compte. Couvert par le test d'isolation, obligatoire pour chaque domaine.
- **Volume** : 273 appels à réécrire dans environ 45 fichiers. Une fois l'authentification migrée (lot 2), les domaines pas encore migrés ne fonctionnent plus sur la branche : ils appellent Supabase sans session. La branche n'est donc complètement utilisable qu'à la fin du lot 6 ; la production, elle, n'est jamais touchée.
