# Webo : améliorations — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lots A à D de la spec : réponse mot à mot, cache, page ouverte, mémoire, devis passés, modifier / envoyer /
relancer un devis, journée, mail collé, 👍/👎 et évaluations, dictée et photo.

**Architecture:** le cœur de la discussion passe dans `server/webo/turn.ts` (`runWeboTurn(user, input, emit)`),
appelé par l'action `sendWeboMessage` (tests) et par la route `app/api/webo/chat/route.ts` (flux). Nouveaux outils dans
`server/webo/tools.ts`, exécutions dans `server/webo/execute.ts`, mémoire dans `server/webo/memory.ts`.

**Spec:** `docs/superpowers/specs/2026-10-23-webo-ameliorations-design.md`

## Global Constraints
- Toutes les règles de l'assistant (plan 2026-10-23-assistant-webo) restent vraies.
- Flux : `application/x-ndjson`, une ligne JSON par événement `{ type: 'agent'|'text'|'proposal'|'done'|'error', … }`.
- Mémoire : 30 notes / entreprise, 300 caractères ; jamais écrite sans validation.
- Modification de devis : seulement aux statuts `nouveau, broch_envoyee, devis_a_faire, devis_envoye, rdv_deg_a_venir, rdv_deg_fait, devis_final`.
- Photo : JPEG / PNG / WebP, ≤ 5 Mo, une par message, non conservée.
- Migration 0039 additive ; contrainte `kind` des propositions élargie à `memory, quote_update, quote_send`.
- e2e : `playwright.brochures.config.ts` (`WEBO_FAKE=1`), `--workers=1`.

## Review Focus
1. Devis d'une autre entreprise sur la page ouverte (chemin forgé) → ignoré, rien de lui dans le message.
2. Modification d'un devis validé ou payé → refusée à la proposition et à la validation.
3. Envoi de devis : adresse invalide ou devis d'une autre entreprise → refus, aucun email.
4. Flux coupé par le navigateur en cours de réponse → réponse quand même payée et enregistrée.
5. Image trop lourde ou d'un autre type → refusée avant tout appel ; pas de pièce prise.

---

### Task 1: Lot A — tour de discussion en flux, cache, page ouverte
- `server/webo/turn.ts` : `runWeboTurn(user, { conversationId, text, path, image? }, emit)` (logique actuelle de
  `sendWeboMessage`, plus `emit` pour chaque morceau) ; `sendWeboMessage` l'appelle sans flux.
- `agents.ts` : appels en flux (`callClaudeStream` avec `onText`) ; `cache_control` en tête de requête ; contexte
  variable dans le message.
- Page ouverte : `/devis/<uuid>` → résumé via `get_quote` (entreprise vérifiée).
- Route `app/api/webo/chat/route.ts` (session exigée) ; client : lecture du flux.
- Tests `server/webo/turn.test.ts` : morceaux de texte émis puis `done` ; page d'un devis de l'entreprise → résumé dans
  le message ; devis d'une autre entreprise → rien ; requête avec `cache_control` en tête.
- Commit `feat(webo): réponse au fil de l'eau, cache et page ouverte`.

### Task 2: Lot B — mémoire et devis passés
- Migration 0039 : `webo_memories (id, company_id, text, created_by, created_at)`, contrainte des propositions élargie,
  `webo_feedback` non (la note va dans le transcript).
- Outil `propose_memory {text}` (tous les spécialistes sauf Aide) ; exécution : insertion (30 au plus) ;
  `server/webo/memory.ts` : `listWeboMemories()`, `deleteWeboMemory(id)` ; notes redonnées dans le message.
- `find_quotes` : recherche aussi sur `event_type` et l'année ; `propose_quote` : nom exact du catalogue reconnu.
- Paramètres > Webo : « Ce que Webo retient » (liste, suppression).
- Tests : mémoire proposée puis validée → listée et redonnée ; 31e note refusée ; autre entreprise ne la voit pas ;
  ligne par nom exact → prix du catalogue.
- Commit `feat(webo): mémoire du traiteur et devis passés`.

### Task 3: Lot C — modifier, envoyer, relancer un devis
- Outils `propose_quote_update`, `propose_quote_send`, `stale_quotes {days}` ; exécutions ; `lib/webo/resyncQuote.ts`
  (navigateur) remet à jour le document mis en forme après validation ; `ProposalCard` l'appelle quand le résultat
  porte `resync`.
- Tests : couverts et lignes modifiés, total recalculé ; devis validé → refus ; envoi → `sendQuoteToClient` appelé
  une fois ; adresse invalide → refus ; `stale_quotes` → devis envoyés il y a plus de N jours seulement.
- Commit `feat(webo): modifier, envoyer et relancer un devis`.

### Task 4: Lot C — journée, consignes, 👍/👎, évaluations
- Spécialiste `journee` (Haiku 5.5) avec `day_overview` ; consignes fiche prestation et mail collé ; aiguilleur mis à
  jour.
- `rateWeboReply(conversationId, index, rating)` ; admin : page « Webo » des réponses notées 👎 ;
  `scripts/webo-eval.ts`.
- Tests : `day_overview` résume à faire et événements ; note enregistrée seulement par l'auteur ; admin seulement.
- Commit `feat(webo): journée, notes des réponses et évaluations`.

### Task 5: Lot D — dictée et photo
- Client : micro (Web Speech API, `fr-FR`), pièce jointe photo (aperçu, retrait) ; route : image validée (type, taille)
  avant réservation ; spécialiste : bloc image.
- Tests : image trop lourde / mauvais type → refus sans pièce ; image transmise au spécialiste ; e2e : photo jointe
  (mode simulé) → réponse qui la mentionne ; micro masqué sans reconnaissance vocale.
- Commit `feat(webo): dictée et photo`.
