# Historique des actions et envoi groupé des brochures — design

Date : 2026-11-16

## Pourquoi

1. **Brochures** : le traiteur veut envoyer une même brochure à plusieurs clients d'un coup, au lieu de recommencer client par client.
2. **Historique** : le traiteur veut **suivre** tout ce qui se passe dans son compte (qui a fait quoi, le jour et l'heure), avec des filtres pour trier. **Rien ne peut être supprimé** de cet historique.

## Objectifs

- Un module « Historique » qui liste toutes les actions du compte de l'entreprise, de la plus récente à la plus ancienne, avec date, heure, auteur, élément concerné.
- Filtres et tri.
- Un journal inaltérable : ni l'interface, ni la couche d'accès générique, ni même une requête SQL ordinaire ne peuvent modifier ou effacer une ligne.
- Dans « Envoyer une brochure » : cocher plusieurs clients du fichier client, et ajouter des adresses à la main.

## Non-objectifs

- Annuler une action depuis l'historique (« revenir en arrière »).
- Afficher l'ancienne et la nouvelle valeur de chaque champ modifié (on dit *quoi* a été modifié, pas le détail champ par champ).
- Les lectures (« X a ouvert le devis ») ne sont pas des actions et ne figurent pas dans l'historique. Exception : la consultation d'un devis ou d'une brochure **par le client**, qui est déjà suivie et utile au suivi.

## Anti-objectifs (échec même si « ça marche »)

- Un historique noyé sous le bruit : 200 lignes « Devis modifié » parce que l'éditeur enregistre toutes les 2 secondes.
- Une action qui échoue parce que l'écriture dans l'historique a échoué.
- Un historique qu'on peut vider ou retoucher.

## Approches considérées

- **A. Enregistrement au point d'entrée commun + compléments à la main** — *choisie par Maxence.* Presque toutes les écritures du navigateur passent par `app/api/db/route.ts` → `executeQuery` (server/compat/execute.ts) : on y note automatiquement chaque création / modification / suppression. Les actions qui passent par des fonctions serveur dédiées (envois d'email, factures, paiements, acceptation, relances, brochures) reçoivent un appel explicite avec une phrase claire. Couvre tout dès le premier jour, et toute nouvelle page est suivie sans rien faire.
- **B. Appel explicite dans chaque action** — libellés soignés, mais des dizaines de fichiers et le moindre oubli laisse un trou : contraire de « tout voir ».
- **C. Déclencheurs en base** — rien n'échappe, mais la base ne sait pas facilement *qui* agit et ignore les envois d'email.

## Design — Historique

### Table `activity_log` (migration 0056, additive)

| colonne | rôle |
|---|---|
| `id` uuid | |
| `company_id` uuid | compte titulaire de l'entreprise (comme `owner_user_id` ailleurs) |
| `actor_id` uuid null | qui a agi (null = le client ou le système) |
| `actor_label` text | nom de l'auteur **figé au moment de l'action** (reste lisible si le collaborateur est retiré) |
| `via_admin` boolean | action faite par l'équipe WeboDevis entrée dans le compte |
| `action` text | `creation`, `modification`, `suppression`, `envoi`, `paiement`, `acceptation`, `relance`, `consultation_client`, `statut`, … |
| `entity_type` text | `devis`, `facture`, `client`, `brochure`, `evenement`, `prestation`, … |
| `entity_id` uuid null | |
| `entity_label` text | libellé figé (« Devis D-2026-042 — Mariage Dupont », « Client Julie Martin ») |
| `summary` text | phrase affichée |
| `details` jsonb | complément (destinataires, montant, statut avant/après…) |
| `created_at` timestamptz | |
| `updated_at` timestamptz | dernière action regroupée (voir regroupement) |

Index : `(company_id, created_at desc)`, `(company_id, entity_type)`, `(company_id, actor_id)`.

**Inaltérable** : un déclencheur `BEFORE DELETE` refuse toute suppression ; un déclencheur `BEFORE UPDATE` refuse toute modification sauf l'allongement d'un regroupement (seuls `updated_at` et `details` peuvent changer). La table n'est **pas** dans `server/compat/rules.ts` : le navigateur ne peut ni la lire ni l'écrire par la couche générique ; la lecture passe par une fonction serveur dédiée. Pas de purge : conservation illimitée. (Seule la suppression complète d'un compte, déjà existante, l'emporte — via `ON DELETE CASCADE` sur le compte, à vérifier compatible avec le déclencheur.)

### Écriture

- `lib/activity.ts` : `logActivity({...})`, même principe que `logAudit` : une écriture qui échoue est journalisée en console et **n'empêche jamais l'action**.
- **Automatique** dans `executeQuery` : après une écriture réussie (insert / upsert / update / delete) sur une table suivie, une ligne par élément touché, à partir des lignes `returning *`. Une table de correspondance `table → { entity_type, libellé }` (ex. `customers → client`, libellé = nom ou raison sociale) décide quelles tables sont suivies. Les tables techniques sont exclues (statistiques de pages, notifications, sessions, brouillons de mise en page, jetons…).
- **Explicite** dans les fonctions serveur qui ne passent pas par `executeQuery` : envoi de devis (email / WhatsApp), envoi de brochure, factures (création, envoi, paiement), acceptation signée par le client, relances, dégustations, changement de rôle d'un collaborateur, réglages importants. Libellé clair (« Brochure “Mariages 2027” envoyée à 4 clients »).
- **Regroupement** : plusieurs modifications du même élément par la même personne à moins de 10 minutes d'intervalle ne font qu'une ligne (« Devis D-2026-042 modifié », heure de début et de fin). Les créations, suppressions et envois ne sont jamais regroupés.

### Qui voit l'historique

Le titulaire et les **gérants** voient tout l'historique de l'entreprise. Les rôles « collaborateur » et « consultation » n'y ont pas accès. *(Mon choix : un suivi de l'équipe n'a de sens que pour ceux qui la dirigent — à corriger si besoin.)*

### Page « Historique » (`app/(app)/historique`)

Entrée dans le menu, près de Paramètres. Liste chronologique dans le style de `components/devis/QuoteHistory.tsx` (icône par type d'action), groupée par jour (« Aujourd'hui », « Hier », « lundi 9 novembre »).

```
Historique                                        [ Plus récent ▾ ]
[ Période: 7 derniers jours ▾ ] [ Personne ▾ ] [ Élément ▾ ] [ Action ▾ ] [ 🔍 Rechercher… ]

Aujourd'hui
 ✉  Brochure « Mariages 2027 » envoyée à 4 clients        14:32 · Julien
 ✎  Devis D-2026-042 — Mariage Dupont modifié             14:05 → 14:18 · Sophie
 +  Client Julie Martin créé                              11:47 · Julien
Hier
 €  Paiement de 1 200 € reçu — Facture F-2026-017         18:02 · Julien
 ✓  Devis D-2026-039 accepté et signé par le client       09:15 · Client
                                   [ Voir plus ]
```

- **Filtres** : période (aujourd'hui, 7 jours, 30 jours, dates choisies), personne, type d'élément, type d'action, recherche dans le texte. Filtres reflétés dans l'URL (lien partageable, retour arrière).
- **Tri** : plus récent d'abord / plus ancien d'abord.
- Pagination par 50 avec « Voir plus ».
- Clic sur une ligne → ouvre l'élément s'il existe encore.
- Responsive mobile (filtres repliés derrière un bouton « Filtrer »).
- L'onglet Historique d'un devis existant reste tel quel.

## Design — Envoi groupé des brochures

Dans `components/brochures/SendBrochureModal.tsx` :

- Le champ « Destinataire » devient un **sélecteur de clients** : recherche dans le fichier client (clients qui ont un email), cases à cocher, puces des clients choisis, plus un champ pour ajouter des adresses libres.
- **Chaque client coché reçoit son propre lien personnalisé** (nom du client, message d'accueil « Pour {nom} », statistiques à part). Le message d'accueil devient un modèle avec `{{client}}`. Les adresses libres reçoivent le lien principal.
- Le message (corps de l'email) reste commun.
- `sendBrochure` accepte une liste `{ email, customerId?, name? }[]`. Limite portée à **50 destinataires** par envoi pour les brochures (10 aujourd'hui), toujours un email après l'autre.
- Résultat : « Brochure envoyée à 12 clients » ; en cas d'échecs partiels, la liste des adresses qui n'ont pas reçu l'email.
- Le cas actuel depuis une demande de Prospects (adresse pré-remplie) continue de marcher.
- Une ligne d'historique par envoi groupé, avec la liste des destinataires dans les détails.

## Contraintes

- Migration additive testée sur PGlite, puis `db:migrate` ; `next build` avant push (voir mémoire projet).
- Comptes de démo : pas d'écriture d'historique réelle, comme pour les autres écritures.
- L'écriture de l'historique ne doit pas ralentir sensiblement les enregistrements (insertion simple, sans attente bloquante côté utilisateur si possible).

## Laissé au constructeur

- La liste exacte des tables suivies / exclues et les libellés de chacune.
- Les icônes et couleurs par type d'action.
- La forme exacte des tests (PGlite pour l'inaltérabilité, le regroupement et les droits de lecture ; test de la modale d'envoi groupé).
