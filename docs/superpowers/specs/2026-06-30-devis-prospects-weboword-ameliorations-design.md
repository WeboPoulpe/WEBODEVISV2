# Améliorations Devis / Prospects / WeboWord — Design

**Date :** 2026-06-30
**Statut :** Validé (plan global), en attente de relecture spec

## Contexte

Application de devis traiteur (Next.js 15 + React 19 + Supabase). Deux générations
d'éditeur coexistent :

- **Ancien système** : étapes (`DevisStepper`) → rendu via `QuoteDocument`,
  `QuoteDocumentMariage`, `QuoteDocumentBusiness`. Ce rendu inclut déjà logo + CGV.
- **WeboWord (nouveau)** : éditeur HTML (`WeboWordEditor.tsx`) produisant un
  `content_html` stocké sur `quotes`. La plupart des flux pointent vers
  `?mode=weboword`. **Ce rendu n'inclut ni logo ni CGV.**

Ce document couvre 9 demandes regroupées en 4 lots, à livrer dans l'ordre A→B→C→D.

## Découvertes techniques importantes

1. **Incohérence de colonnes `customers`** : la table utilise `owner_user_id` et
   `customer_type` (cf. [ClientForm.tsx](../../../components/clients/ClientForm.tsx)
   et [app/(app)/clients/page.tsx](<../../../app/(app)/clients/page.tsx>)). Or la page
   Prospects insère avec `user_id` / `type` → échec d'insertion.
2. **Divergence de rendu WeboWord** : la route d'impression
   [app/(print)/devis/[id]/imprimer/page.tsx](<../../../app/(print)/devis/[id]/imprimer/page.tsx>)
   ne rend que `content_html` (padding 20mm) — **sans page de garde, sans page photos,
   sans logo, sans CGV**. À l'inverse, les boutons Imprimer/PDF de l'éditeur
   (`buildPrintHtml` / `handleSavePdf` dans `WeboWordEditor.tsx`) incluent page de garde
   + page photos, mais toujours pas logo/CGV.
3. **`client_name` souvent vide** : les devis créés depuis un prospect
   (`CreateDevisModal` dans la page Prospects) ou un modèle ne remplissent pas
   `client_name`. La recherche « Mes devis » ne filtre que `client_name` + `event_type`,
   d'où « aucun résultat ».

---

## Lot A — Bugs

### A1 (#7) — Erreur enregistrement client depuis Prospects

**Problème.** Dans [app/(app)/prospects/page.tsx](<../../../app/(app)/prospects/page.tsx>) :
- `SaveAsCustomerButton.save()` insère `{ user_id, customer_type }` → devrait être
  `owner_user_id`.
- `CreateDevisModal.handleCreate()` : la recherche client utilise `.eq('user_id', …)`
  et l'insertion `{ user_id, type: 'particulier' }` → devrait être `owner_user_id` et
  `customer_type`.

**Solution.** Aligner toutes les requêtes `customers` sur les colonnes réelles
(`owner_user_id`, `customer_type`). Vérifier aussi la recherche d'unicité d'email
(`SaveAsCustomerButton` filtre sur email global sans `owner_user_id` → à scoper au
propriétaire).

**Critère de réussite.** Depuis la fiche prospect, « Enregistrer en client » crée bien
la fiche sans erreur ; « Créer un devis » crée/lie le client sans erreur.

### A2 (#3) — Recherche « Mes devis » ne trouve aucun résultat

**Problème.** [app/(app)/devis/page.tsx](<../../../app/(app)/devis/page.tsx>) filtre
`matchSearch` uniquement sur `client_name` + `event_type`. Les devis sans `client_name`
(prospect/modèle) sont introuvables.

**Solution.**
1. Étendre le filtre de recherche aux champs `client_first_name`, `client_last_name`,
   `client_email` (et concaténation prénom+nom).
2. Charger ces colonnes dans la requête `quotes` (actuellement non sélectionnées).
3. À la conversion prospect→devis (`CreateDevisModal`), renseigner `client_name`
   (= « prénom nom »), `client_first_name`, `client_last_name`, `client_email`.

**Critère de réussite.** Taper le nom d'un client (même issu d'un prospect) retrouve son
devis.

---

## Lot B — Pipeline & Prospects unifiés

### B1 (#1) — Actions rapides sur les cartes Pipeline

**Problème.** Dans `PipelineView` (devis/page.tsx), une carte ne propose qu'une flèche
ouvrant le panneau.

**Solution.** Ajouter sur chaque carte pipeline les actions rapides déjà présentes sur
les cartes Grille (`QuoteCard`) : Aperçu (ouvre le panneau), PDF
(`/devis/[id]/imprimer`), Éditer (`/devis/[id]/modifier`). Garder la carte compacte
(icônes au survol).

**Critère de réussite.** Depuis le pipeline, on peut ouvrir le PDF et éditer un devis
sans passer par le panneau.

### B2 (#2) — Prospects visibles dans « Mes devis »

**Approche retenue : cartes virtuelles (pas de duplication).**

**Solution.**
1. Dans la page Devis, charger en plus les `prospect_requests` du user **non encore liés
   à un devis** (pas de `quote.prospect_id` pointant dessus).
2. Les afficher comme cartes « prospect » (style distinct, badge « Prospect ») dans la
   **colonne Nouveau** (vue pipeline) et dans le filtre/section **Nouveau** (vues
   grille/tableau).
3. Permettre le changement de statut directement sur ces cartes — écrit dans
   `prospect_requests.status`.
4. Bouton « Convertir en devis » sur la carte prospect → réutilise le flux
   `CreateDevisModal` existant (déplacé/partagé si nécessaire).

**Alternative écartée.** Auto-créer un devis brouillon par prospect : duplication de
données et bruit dans la liste.

**Critère de réussite.** Les nouveaux prospects apparaissent dans « Mes devis » sous
Nouveau, leur statut est modifiable, et la conversion en devis fonctionne.

---

## Lot C — Import de devis

### C1 (#4) — Lier un client (nouveau ou existant) à l'import

**Problème.** [components/devis/ImportDevisModal.tsx](../../../components/devis/ImportDevisModal.tsx)
saisit le client en texte libre et ne crée/lie aucune fiche `customers`.

**Solution.**
1. Ajouter en haut du modal un sélecteur : « Client existant » (champ de recherche sur
   `customers` du user) **ou** « Nouveau client » (les champs texte actuels).
2. Si client existant choisi : pré-remplir les champs et conserver son `id`.
3. À la sauvegarde : si nouveau client, créer la fiche `customers` (colonnes correctes
   cf. A1) ; dans tous les cas, renseigner `customer_id` sur le devis importé en plus des
   champs `client_*` déjà stockés.

**Critère de réussite.** À l'import, on peut rattacher un client existant ou en créer un,
et le devis importé est lié à une fiche client.

---

## Lot D — Rendu WeboWord

**Principe directeur.** Centraliser la construction du rendu final pour que **aperçu,
impression et PDF soient identiques** et incluent : page de garde → logo → corps →
page(s) photos → CGV (dernière page). Sources : `quotes.cover_page_config`,
`quotes.photos_page_config`, `quotes.content_html`, `profiles.logo_url`, `profiles.cgv`.

La route `/devis/[id]/imprimer` doit reconstruire le même document que l'éditeur (au lieu
de rendre seulement `content_html`). Les helpers de construction
(`buildCoverPageHtml`, `buildPhotosPageHtml` dans `printHelpers.ts`) sont réutilisés ;
on ajoute un `buildCgvHtml` et l'injection du logo.

### D1 (#9) — Logo dans le devis WeboWord

**Solution.** Récupérer `profiles.logo_url` et l'intégrer en en-tête de la page de garde
(et/ou en haut du corps si pas de page de garde). Disponible dans l'éditeur (aperçu) et
dans la route d'impression.

### D2 (#8) — CGV sur dernière page dédiée, condensée

**Solution.** Récupérer `profiles.cgv` et le rendre sur une **dernière page dédiée**
(`page-break-before`), avec un style compact (taille réduite, interligne serré,
multi-colonnes si pertinent). Ajouté dans `buildPrintHtml`/`handleSavePdf` et dans la
route d'impression.

### D3 (#5) — Aperçu de la page de garde

**Solution.** Corriger la divergence : la route d'impression/aperçu inclut désormais la
page de garde (via `cover_page_config`). L'éditeur garde son aperçu live existant
(`CoverPage` rend déjà le template). Vérifier la cohérence visuelle éditeur ↔ PDF.

### D4 (#6) — Ajouter une ligne de texte sur la page de garde

**Solution.** Dans l'éditeur de page de garde, ajouter un bouton « + Ajouter une ligne de
texte ». Mécanisme : ajouter un élément `type: 'text'` à `customLayout`
(cf. `CoverPageLayoutElement` dans `weboword.types.ts`). Si le mode template ne supporte
pas les éléments libres, prévoir le rendu de ces lignes additionnelles par-dessus le
template, ou basculer/compléter en mode builder.

**Critère de réussite.** On peut ajouter une ou plusieurs lignes de texte personnalisées
sur la page de garde, visibles dans l'aperçu et le PDF.

---

## Hors périmètre (YAGNI)

- Refonte des anciens rendus `QuoteDocument*` (le logo/CGV y sont déjà).
- Migration de données des anciens devis V1.
- Modification du schéma SQL au-delà de ce qui est strictement nécessaire (les colonnes
  `cover_page_config`, `photos_page_config`, `customer_id`, `client_*`, `logo_url`, `cgv`
  existent déjà).

## Ordre de livraison

A (bugs) → B (pipeline/prospects) → C (import) → D (rendu WeboWord).
Chaque lot est indépendant et livrable séparément.
