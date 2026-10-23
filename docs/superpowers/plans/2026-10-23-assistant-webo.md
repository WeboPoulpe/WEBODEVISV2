# Assistant Webo — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Une bulle Webo sur toute l'application : un aiguilleur et cinq spécialistes qui lisent les données de
l'entreprise et proposent des actions (devis, facture brouillon, prestation, réponse à un prospect) validées par le
traiteur, payées en WeboCoins.

**Architecture:** `server/webo/` : `tools.ts` (lectures et création de propositions, sans écriture métier),
`execute.ts` (exécution déterministe d'une proposition validée), `agents.ts` (consignes, aiguilleur, boucle d'outils,
mode simulé), `chat.ts` (actions serveur de la discussion, débit). Interface : `components/webo/assistant/`.

**Tech Stack:** Next.js 15, Drizzle + Neon (PGlite en test), `@anthropic-ai/sdk`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-assistant-webo-design.md`

## Global Constraints

- Modèles : aiguilleur et aide `claude-haiku-5-5` (effort `low`) ; spécialistes `claude-sonnet-5-5` (effort `medium`).
- Prix ($/M jetons, entrée/sortie) : Haiku 5.5 0,10/0,50 ; Sonnet 5.5 2/10 ; écriture cache ×1,25, lecture ×0,1.
- Débit d'une réponse : `coinsForCost(coût total, actionCoefficient, usdEur)` ; solde minimum pour écrire : 5 pièces ;
  si le coût dépasse le solde, on prend ce qui reste.
- Limites : 8 tours d'outils, 60 s par appel, 1 nouvel essai, `max_tokens` 8 000, message ≤ 4 000 caractères,
  30 messages par conversation, 20 conversations listées.
- Écrire exige `requireWriter()` ; démo bloquée (`isDemoUser`). Tout est restreint à l'entreprise (`companyIdsOf`).
- Une proposition ne s'exécute qu'une fois (statut `proposed` → `done` par un update conditionnel).
- Devis créés : `status 'devis_a_faire'`, `template 'classique'`, `vat_rate` par défaut du profil, numéro laissé au
  déclencheur, quantité = couverts si `isPerGuestPrestation`, sinon 1 ; `total_amount` via `lib/quoteTotals`.
- Factures : `createInvoiceDraft` existant (brouillon seulement, jamais émise).
- Réponse prospect : `sendMail` (nom de l'entreprise en expéditeur, réponse au traiteur).
- `WEBO_FAKE=1` hors production : spécialistes simulés.
- e2e : `playwright.brochures.config.ts` (port 3005, `WEBO_FAKE=1`), `--workers=1`.

## Review Focus

1. Proposition validée deux fois (double clic, deux onglets) → un seul devis créé.
2. Proposition d'une autre entreprise, ou décidée par un compte en lecture seule / démo → refusée, rien d'écrit.
3. Identifiants inventés par l'IA (prestation, client, devis d'une autre entreprise) → refusés à la proposition et à
   l'exécution.
4. Solde sous 5 pièces → message refusé sans appel à Claude ; réponse plus chère que le solde → solde à 0, jamais négatif.
5. Texte de l'utilisateur ou des données (nom de client, description) contenant des consignes (« ignore tes règles ») →
   au pire une proposition bizarre, jamais une écriture sans validation.

---

### Task 1: Tables et coût par modèle
- Create `db/migrations/0037_webo_assistant.sql` (drizzle-kit, rendue idempotente) ; tables dans `db/schema/tables.ts` :
  - `webo_conversations` : `id uuid pk`, `company_id uuid` → users cascade, `user_id uuid` → users cascade, `title text`,
    `transcript jsonb not null default '[]'` (liste `{ role: 'user'|'assistant', text, agent?, proposalIds?, coins? }`),
    `created_at`, `updated_at` ; index `(user_id, updated_at desc)`.
  - `webo_proposals` : `id uuid pk`, `conversation_id` → cascade, `company_id`, `user_id`, `kind text` check in
    `('quote','invoice','prestation','prestation_update','prospect_reply')`, `payload jsonb`, `summary jsonb`,
    `status text` check in `('proposed','done','cancelled','failed')` default `proposed`, `result jsonb`, `created_at`,
    `decided_at`.
- `lib/webo/models.ts` : `WEBO_MODELS = { router, help, specialist }`, `modelCostUsd(model, usage)`.
- Tests `lib/webo/models.test.ts` : coût Haiku 4000/2000 ≈ 0,0014 ; Sonnet 1000/1000 = 0,012 ; modèle inconnu → tarif Sonnet.
- Commit `feat(webo): tables de l'assistant et coût par modèle`.

### Task 2: Outils (lectures et propositions)
- `server/webo/tools.ts` : `toolsFor(agent)` → définitions (JSON Schema `strict`) ; `runTool(ctx, name, input)` →
  texte JSON ; `ctx = { userId, companyId, conversationId, guests? , proposals: string[] }`.
  - Lectures : `search_catalogue {query}` (≤ 15, id, nom, prix, catégorie, par couvert ?) ; `search_customers {query}`
    (≤ 8) ; `find_quotes {query}` (≤ 8 : id, numéro, client, date, statut, total) ; `get_quote {quote_id}` ;
    `list_prospects {status?}` (≤ 10).
  - Propositions : `propose_quote`, `propose_invoice`, `propose_prestation`, `propose_prestation_update`,
    `propose_prospect_reply` → vérifient les identifiants dans l'entreprise, construisent un `summary` lisible
    (lignes, totaux HT/TTC, client…), insèrent `webo_proposals`, renvoient `{ proposal_id, summary }`.
- Tests `server/webo/tools.test.ts` (PGlite) : recherche limitée à l'entreprise ; `propose_quote` avec une prestation
  d'une autre entreprise → erreur ; prix repris du catalogue (pas celui de l'IA) sauf ligne hors catalogue ;
  quantité = couverts pour une prestation par couvert ; résumé avec total TTC.
- Commit `feat(webo): outils de lecture et de proposition`.

### Task 3: Exécution d'une proposition
- `server/webo/execute.ts` (`'use server'`) : `decideProposal(id, decision: 'accept'|'cancel')` →
  `{ error, result?: { href, label } }` ; `requireWriter`, démo refusée, proposition de l'entreprise, update
  conditionnel `proposed → done|cancelled` d'abord (une seule exécution), puis l'écriture ; en cas d'échec → `failed` avec
  le message.
- Tests `server/webo/execute.test.ts` : devis créé (client nouveau créé aussi), lien `/devis/<id>/modifier?mode=weboword` ;
  double validation → un seul devis ; autre entreprise / lecture seule → refus ; facture brouillon via
  `createInvoiceDraft` ; prestation créée et mise à jour ; réponse prospect → `sendMail` appelé une fois.
- Commit `feat(webo): validation des propositions`.

### Task 4: Agents et discussion
- `server/webo/agents.ts` : consignes (français, ton WeboDevis, jamais de prix inventé, toujours proposer plutôt que
  dire « c'est fait », poser une question si une information indispensable manque) ; `routeMessage(text, history)` →
  agent (Haiku, sortie JSON) ; `runSpecialist(agent, ctx, historyText, text)` → `{ text, proposalIds, usage[] }`
  (boucle manuelle) ; aide : guides `HELP_GUIDES` en consigne mise en cache ; mode simulé.
- `server/webo/chat.ts` (`'use server'`) : `sendWeboMessage(conversationId | null, text)` →
  `{ error, conversationId, reply: { text, agent, proposals: ProposalView[], coins }, balance }` ;
  `listWeboConversations()`, `getWeboConversation(id)`.
- Tests `server/webo/chat.test.ts` (Anthropic simulé) : solde < 5 → refus sans appel ; débit = coût × coefficient ;
  coût > solde → solde 0 ; conversation d'un autre compte → introuvable ; message trop long → refus ; transcript
  enregistré ; démo / lecture seule → refus.
- Commit `feat(webo): aiguilleur, spécialistes et discussion`.

### Task 5: Interface
- `components/webo/assistant/WeboAssistant.tsx` (bouton flottant « Webo », au-dessus de la barre d'onglets du
  téléphone ; panneau latéral, plein écran sur téléphone), `ProposalCard.tsx`, montés dans `AppShell`.
- e2e `e2e/webo-assistant.spec.ts` (`WEBO_FAKE=1`) : ouvrir Webo, demander un devis → carte avec le client, 50 couverts,
  « Menu Tentation » ; Valider → lien « Ouvrir le devis », devis en base, solde débité ; Annuler une autre proposition
  → rien créé ; téléphone 360 px sans débordement ; captures.
- Commit `feat(webo): l'assistant dans l'application`.
