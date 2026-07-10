# Design — Lot C : Clients entreprise (contacts multiples + destinataire + SIRET)

Date : 2026-07-10
Statut : validé (design), à décomposer en plan d'implémentation.

## Objectif

Pour les clients **entreprise** :
1. Gérer **plusieurs contacts** par client (chacun avec nom, rôle, email, téléphone, notes).
2. Lors de la création d'un devis, **choisir le contact destinataire** ; ce choix est **figé (snapshot)** sur le devis.
3. Afficher sur le **document généré** la **raison sociale + SIRET du client** ainsi que le **contact destinataire** (nom, rôle, email, tél).

Les clients **particuliers** sont inchangés (une seule personne).

## Contexte existant

- Table `customers` : `owner_user_id`, `customer_type` (`particulier` | `entreprise`), `first_name`, `last_name`, `company_name`, `siret_number`, `contact_person_name`, `contact_person_email`, `contact_person_phone`, `email`, `phone`, `address`, `service_address`, `notes`.
- Table `quotes` : porte déjà un snapshot client (`client_name`, `client_first_name/last_name`, `client_email`, `client_phone`, `client_address`, `client_type`, `company_name`, `contact_person_name`, `customer_id`). **Pas** de SIRET ni d'email/tél de contact côté devis.
- Le document est généré par `lib/generateQuoteHtml.ts` (bloc client = nom, email, tél, adresse). Le SIRET/infos entreprise ne sont pas affichés.
- Points d'entrée où un client est choisi/saisi pour un devis :
  - `components/devis/steps/StepClientEvent.tsx` (wizard nouveau devis)
  - `components/devis/QuoteInlineEditor.tsx` (édition inline sur `/devis/[id]/modifier`)
  - `components/devis/WeboWordSidePanels.tsx` + modal admin de `WeboWordEditor.tsx`

## Modèle de données

### Nouvelle table `customer_contacts`
Source de vérité des contacts d'un client.

| colonne | type | notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `customer_id` | uuid | FK → `customers(id)` `ON DELETE CASCADE` |
| `owner_user_id` | uuid | pour RLS (= propriétaire du client) |
| `name` | text | nom du contact |
| `role` | text null | fonction (« Décideur », « Comptabilité »…) |
| `email` | text null | |
| `phone` | text null | |
| `notes` | text null | |
| `is_primary` | boolean | défaut `false` ; un seul primaire par client (garanti applicativement) |
| `created_at` | timestamptz | défaut `now()` |

- RLS activée : lecture/écriture si `owner_user_id = auth.uid()` (+ policy admin via `is_admin()` par cohérence).
- Index sur `customer_id`.

### Migration des contacts existants
Pour chaque `customers` de type entreprise ayant `contact_person_name` non nul et **aucun** `customer_contacts`, insérer un contact `is_primary = true` reprenant `contact_person_name / _email / _phone`. Idempotent (ne recrée pas si un contact existe déjà).

### Mirroir de compatibilité
Le contact **primaire** est recopié dans `customers.contact_person_name / _email / _phone` à chaque modification des contacts. Ainsi le code existant qui lit ces colonnes continue de fonctionner sans réécriture massive.

### Snapshot sur `quotes` (nouvelles colonnes)
Le devis fige son destinataire au moment du choix :

| colonne | type |
|---|---|
| `client_siret` | text null |
| `recipient_contact_email` | text null |
| `recipient_contact_phone` | text null |
| `recipient_contact_role` | text null |

Le **nom** du destinataire réutilise `quotes.contact_person_name` (existant) ; la raison sociale réutilise `quotes.company_name` (existant).

## UX

### A. Fiche client (création + édition) — type entreprise
- Nouvelle section **« Contacts »** sous l'identité entreprise :
  - Liste des contacts (nom · rôle · email · tél · notes).
  - Ajouter / éditer / supprimer un contact.
  - Bouton « Définir comme principal » (radio-like ; un seul primaire).
- Le champ SIRET reste dans l'identité entreprise (`siret_number`).
- `components/clients/ClientForm.tsx` (création) : gérer les contacts en mémoire, insérer `customers` puis les `customer_contacts` (le premier ou celui coché = primaire).
- Édition client (`app/(app)/clients/page.tsx`) : même gestion sur un client existant.

### B. Création / édition de devis — sélection du destinataire
Quand le client sélectionné est une **entreprise** :
- Afficher un sélecteur **« Destinataire du devis »** listant les `customer_contacts` du client (label = `name` + `role`).
- Au choix : copier sur le devis `contact_person_name`, `recipient_contact_email/phone/role`, `company_name`, `client_siret` (depuis `customers.siret_number`).
- Défaut : le contact primaire.
- Appliqué aux 3 points d'entrée (StepClientEvent, QuoteInlineEditor, WeboWordSidePanels/modal admin). Un composant partagé `RecipientPicker` évite la duplication.

### C. Document généré (`generateQuoteHtml`)
- Étendre `QuoteHtmlData` avec : `companyNameClient` (raison sociale client), `clientSiret`, `contactName`, `contactRole`, `contactEmail`, `contactPhone`.
- Bloc client, si devis entreprise :
  ```
  RAISON SOCIALE (company_name)
  SIRET : xxxxxxxxxxxxxx
  À l'attention de : {contactName} — {role}
  {email} · {tél}
  {adresse}
  ```
- Particulier : bloc client inchangé.
- Les appelants (`modifier/page.tsx`, `LivePreview`, `QuoteInlineEditor`, `StepWeboWord`) passent ces champs depuis le snapshot du devis.

## Composants / limites

- `customer_contacts` : accès données isolé (helpers de lecture/écriture réutilisables).
- `RecipientPicker` : composant isolé (props = contacts + valeur + onChange), testable seul.
- `ContactsEditor` : composant isolé de gestion de la liste de contacts (utilisé en création et édition client).
- `generateQuoteHtml` : extension additive du bloc client, sans toucher le bloc financier.

## Hors périmètre (YAGNI)

- Pas de permissions/rôles applicatifs par contact.
- Pas d'historique/versionning des contacts.
- Pas de contacts multiples pour les particuliers.
- Pas d'affichage du SIRET émetteur (traiteur) — décision : **SIRET du client uniquement**.

## SQL (nouveau fichier `sql/lot_c_customer_contacts.sql`)

- `CREATE TABLE IF NOT EXISTS customer_contacts (...)` + index + RLS + policies (owner + admin).
- `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_siret / recipient_contact_email / recipient_contact_phone / recipient_contact_role`.
- Bloc de migration idempotent des contacts primaires existants.
- Ajouté au fichier consolidé `sql/00_APPLIQUER_TOUT.sql`.

## Risques / points d'attention

- **`customers.siret_number`** est la colonne réelle du SIRET client (confirmé dans `ClientForm`). Le snapshot devis lit cette colonne.
- Garantir « un seul primaire » applicativement (au save : mettre les autres `is_primary=false`).
- Le mirroir `contact_person_*` doit rester synchro avec le primaire pour ne pas régresser les lectures existantes.
- Snapshot devis : une fois le devis créé, éditer un contact ne modifie pas les devis passés (comportement voulu).
