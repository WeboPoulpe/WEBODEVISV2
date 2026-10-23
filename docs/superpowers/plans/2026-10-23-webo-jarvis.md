# Webo « Jarvis » : historique, apparence des devis, événements — conception et plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Intention (Maxence, 2026-10-23) :** « c'est un Jarvis du logiciel, il est censé pouvoir tout faire ». Ce lot : un
historique des conversations comme sur Claude, changer l'apparence d'un devis, et toute la gestion d'événement.
Déjà fait dans ce lot : spécialistes sur Haiku 5.5 (56569dd). Règles inchangées : Webo propose, le traiteur valide.

**Goal:** page Webo plein écran avec historique (dates, recherche, renommer, supprimer) ; `propose_quote_update`
étendu à l'apparence ; spécialiste Événements (lecture et propositions : check-list, matériel, déroulé, heure
d'arrivée, contact sur place, extras et leur invitation, recalcul des courses).

## Global Constraints
- Événements = devis aux statuts `valide, acompte, paye` (`CONFIRMED_STATUSES`).
- Formes JSON : `checklist [{id,text,done}]`, `event_materials [{id,name,qty,unit,checked?}]`,
  `run_sheet [{time,label,note}]` (via `cleanRunSheet`), `team_arrival_time` (HH:MM), `onsite_contact` texte.
- Extras : `event_extras (quote_id, extra_id, status 'a_solliciter', arrival_time, departure_time, mission_notes)`,
  unique (extra_id, quote_id) ; invitation par `inviteToMissions(ids)` (email + notification), seulement si demandée.
- Courses : `recalculateCourses(quoteId)` existant.
- Apparence : `template ∈ classique|standard|mariage|business`, `selected_font` (polices de l'éditeur),
  `language fr|en`, `hide_price` ; document mis en forme remis à jour dans le navigateur (`resyncQuoteDocument`,
  avec `relang` si la langue change).
- Historique : conversations de l'utilisateur, 30 par page, recherche dans le titre et le texte.

## Review Focus
1. Événement d'une autre entreprise, ou extra d'une autre entreprise → refusés à la proposition et à l'exécution.
2. Extra déjà affecté à l'événement → pas de doublon (contrainte unique), pas d'erreur bloquante.
3. Invitation d'extras : seulement si la carte le dit, une seule fois par validation.
4. Suppression d'une conversation : seulement la sienne ; ses propositions en attente ne sont plus validables.
5. Changement de langue d'un devis mis en forme : document remis à jour (carte, mentions), pas de perte de retouches.

---

### Task 1: Historique façon Claude
- `server/webo/chat.ts` : `listWeboConversations({ query?, page? })` (30 par page, plus récentes d'abord, recherche
  `ilike` sur titre et transcript texte) ; `renameWeboConversation(id, title)` ; `deleteWeboConversation(id)`
  (ses propositions encore « proposed » passent « cancelled »).
- Page `app/(app)/webo/page.tsx` : liste groupée (Aujourd'hui, Hier, 7 derniers jours, Plus ancien), recherche,
  renommer, supprimer ; conversation à droite (composant partagé avec la bulle) ; `?c=<id>` ouvre une conversation.
- Bulle : bouton « Agrandir » vers `/webo?c=<id>` ; masquée sur `/webo`. Entrée « Webo » dans le menu.
- Tests : recherche, pagination, renommer / supprimer seulement les siennes, proposition d'une conversation supprimée
  non validable ; e2e page.
- Commit `feat(webo): historique des conversations`.

### Task 2: Apparence d'un devis
- `propose_quote_update` : champs `template`, `font`, `language`, `hide_price` (null = inchangé) ; exécution :
  colonnes ; resync avec `relang` si la langue change.
- Tests : apparence changée à la validation ; valeur hors liste refusée.
- Commit `feat(webo): changer l'apparence d'un devis`.

### Task 3: Spécialiste Événements
- Outils : `list_events {from, to}`, `get_event {quote_id}`, `list_extras {query, date}`,
  `propose_event_update {...}`, `propose_courses_recalc {quote_id}` ; exécutions ; agent `evenements` (aiguilleur).
- Tests : lecture limitée à l'entreprise ; check-list ajoutée et cochée ; matériel ajouté ; déroulé remplacé ;
  extras affectés sans doublon ; invitation seulement si demandée ; extra ou événement d'une autre entreprise refusé ;
  courses recalculées.
- Commit `feat(webo): gestion des événements`.
