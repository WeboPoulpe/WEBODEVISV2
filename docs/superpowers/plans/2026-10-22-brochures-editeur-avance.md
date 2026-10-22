# Brochures — éditeur avancé à blocs et formulaire plein écran — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le formulaire de fin de brochure s'ouvre en plein écran sur téléphone, et chaque brochure peut passer en éditeur avancé où le traiteur compose ses pages avec des blocs (prestation, titre, texte, image, colonnes, séparateur, espace), le contenu des prestations restant lu en direct dans le catalogue.

**Architecture:** Une bibliothèque pure `lib/brochureLayout.ts` porte le modèle de mise en page (types, nettoyage, règles des pages spéciales, opérations sur l'arbre de blocs, conversions simple ↔ avancé, résolution pour l'affichage). Le serveur (`server/brochures.ts`) enregistre `editor_mode` et `layout`, change d'éditeur et sert au lien public des pages `blocks` déjà résolues. Un même rendu (`BlockPage`) sert au lien public, à l'aperçu et au canevas de l'éditeur avancé.

**Tech Stack:** comme le module Brochures (Next.js app router, Drizzle/Neon, PGlite, Playwright) ; glisser-déposer HTML5 natif, aucune dépendance nouvelle.

**Spec:** `docs/superpowers/specs/2026-10-22-brochures-editeur-avance-design.md` (complète `docs/superpowers/specs/2026-10-22-brochures-design.md`).

## Global Constraints

- Migration additive `0035`, appliquée par `npm run db:migrate` avant tout envoi sur `main`.
- Une brochure en mode `simple` s'affiche exactement comme aujourd'hui.
- Contenu des prestations lu en direct dans le catalogue ; retoucher ne modifie jamais `prestations`.
- Écriture des brochures uniquement par les actions serveur (règle `/api/db` en lecture seule) ; tout HTML (blocs Texte, retouches) passé par `sanitizeHtml` côté serveur.
- Lien public : aucun identifiant de prestation ni de bloc interne au catalogue, aucun prix quand `show_prices` est faux.
- Couleurs proposées : `PALETTE = ['#1C2621', '#2F4A3A', '#B4502D', '#5b5b55', '#FBF7F0', '#EDE6DA', '#E6DFD3', '#FFFFFF']` ; polices proposées : `BLOCK_FONTS = ['Georgia', 'Playfair Display', 'Lora', 'Montserrat', 'Inter']` ; tailles de titre : `[14, 18, 22, 28, 36]` px à l'échelle de la page (cqw : taille ÷ 4.2).
- Limites : 40 pages, 30 blocs par page (colonnes comprises).
- Disque de dev presque plein : `rm -rf .next/cache` après chaque `next build`.

## Review Focus

1. Prestation supprimée du catalogue utilisée dans un bloc → bloc sauté sur le lien public, signalé « supprimée du catalogue » dans l'éditeur. (Task 2)
2. Mise en page envoyée à l'action avec des règles violées (deux couvertures, formulaire pas en dernier, colonnes dans des colonnes, plus de 30 blocs, `<script>` dans un bloc Texte) → refusée ou nettoyée, jamais enregistrée telle quelle. (Task 3)
3. Avancé → simple → avancé en reprenant : les prestations ajoutées en mode simple arrivent sur une page à la fin, celles retirées disparaissent des blocs. (Task 2)
4. `show_prices = false` en mode avancé → aucune donnée de prix dans `getPublicBrochure`. (Task 3)
5. Téléphone sur la dernière page : le plein écran se ferme par « Revenir au livre », ne revient pas tout seul tant qu'on n'a pas retourné la page, et n'apparaît jamais sur ordinateur. (Task 1)

---

### Task 1: Formulaire plein écran sur téléphone

**Files:**
- Modify: `components/brochures/Flipbook.tsx` (prop `onPageChange`), `app/b/[token]/BrochureBook.tsx`
- Create: `components/brochures/FormSheet.tsx`
- Test: `e2e/brochures.spec.ts`

**Interfaces:**
- Produces: `Flipbook` prop `onPageChange?: (visible: number[]) => void` (index des pages visibles après chaque tour, appelée aussi au montage) ; `<FormSheet open onClose title language>{children}</FormSheet>` : plein écran (`fixed inset-0`, fond `#FBF7F0`, `role="dialog"`, `aria-modal`), bouton « Revenir au livre » / « Back to the brochure ».

- [ ] **Step 1: Write the failing e2e test** `test('sur téléphone, le formulaire s’ouvre en plein écran')` : à 390 × 844, avancer jusqu'à la dernière page → `getByRole('dialog')` visible, contient « Envoyer ma demande » et a la taille de l'écran (`boundingBox().height >= 800`) ; « Revenir au livre » → dialogue absent ; « Page précédente » puis « Page suivante » → dialogue de nouveau visible avec la saisie gardée. À 1280 × 800 : dernière page → aucun `dialog`, le formulaire est dans la page.
- [ ] **Step 2: Run** `npx playwright test e2e/brochures.spec.ts --project=desktop -g "plein écran"` — Expected: FAIL (pas de dialog).
- [ ] **Step 3: Implement** : `BrochureBook` suit les pages visibles ; quand la page `form` devient visible et que `window.innerWidth < 640`, ouvre `FormSheet` avec le même `BrochureRequestForm` (même état `useBrochureForm`) ; la page du livre affiche alors un bouton « Remplir le formulaire » qui rouvre le plein écran.
- [ ] **Step 4: Run** the e2e test and the whole `e2e/brochures.spec.ts` — Expected: PASS ; capture `e2e/screenshots/brochure-formulaire-plein-ecran.png` relue.
- [ ] **Step 5: Commit** `feat(brochures): formulaire en plein écran sur téléphone`.

### Task 2: Bibliothèque de mise en page

**Files:**
- Create: `lib/brochureLayout.ts`, `lib/brochureLayout.test.ts`
- Modify: `lib/brochure.ts` (export `shortText(html: string, max: number): string`, déplacée de `BrochurePages.tsx`)

**Interfaces:**
- Consumes: `BrochureContent`, `BrochureSection`, `BrochureItem`, `CatalogPrestation`, `PriceOptions`, `ResolvedItem`, `BrochureStyle`, `paginateBrochure`, `resolveItems` (lib/brochure.ts).
- Produces (types) :
  - `type Align = 'left' | 'center' | 'right'`
  - `interface BlockStyle { padding?: number; background?: string | null; font?: string | null; titleSize?: number | null; titleColor?: string | null; align?: Align }`
  - `type Block =`
    `| { id: string; type: 'prestation'; prestationId: string; photo: 'top' | 'left' | 'right' | 'none'; show: { name: boolean; text: boolean; price: boolean }; text: 'full' | 'short'; html?: string; titled?: boolean; photoUrl?: string; hidePrice?: boolean; style?: BlockStyle }`
    `| { id: string; type: 'title'; text: string; level: 'l' | 'm' | 's'; style?: BlockStyle }`
    `| { id: string; type: 'text'; html: string; style?: BlockStyle }`
    `| { id: string; type: 'image'; url: string | null; height: number; fit: 'cover' | 'contain'; style?: BlockStyle }`
    `| { id: string; type: 'columns'; count: 2 | 3; gap: number; cols: Block[][]; style?: BlockStyle }`
    `| { id: string; type: 'separator'; color: string; width: number; style?: BlockStyle }`
    `| { id: string; type: 'spacer'; height: number }`
  - `interface LayoutPage { id: string; kind: 'cover' | 'blocks' | 'contact' | 'form'; background?: string | null; font?: string | null; blocks: Block[] }`
  - `interface BrochureLayout { pages: LayoutPage[] }`
  - `type ResolvedBlock` = `Block` où `prestation` devient `{ id: string; type: 'prestation'; item: ResolvedItem; photo; show; text; style? }` (sans `prestationId`) et `columns.cols: ResolvedBlock[][]`.
- Produces (fonctions) :
  - `parseLayout(raw: unknown): BrochureLayout | null` — nettoie (types et valeurs connus, couleurs dans `PALETTE`, polices dans `BLOCK_FONTS`, URLs d'image http(s)), ignore l'inconnu ; null si illisible.
  - `layoutError(layout: BrochureLayout): string | null` — message français si : couverture pas en premier ou plusieurs, plus d'un contact, formulaire absent / pas en dernier / plusieurs, colonnes dans des colonnes, plus de 40 pages ou de 30 blocs sur une page.
  - Opérations (renvoient une nouvelle mise en page) : `addBlock(l, pageId, block, at?: { parentId?: string; col?: number; index: number })`, `moveBlock(l, blockId, dir: -1 | 1)`, `placeBlock(l, blockId, at)`, `removeBlock(l, blockId)`, `duplicateBlock(l, blockId)`, `updateBlock(l, blockId, patch)`, `addPage(l, kind, afterPageId?)`, `movePage(l, pageId, dir)`, `removePage(l, pageId)`, `duplicatePage(l, pageId)`, `updatePage(l, pageId, patch)` ; ids nouveaux par `newBlockId(): string`.
  - `newBlock(type: Block['type'], prestationId?: string): Block` — réglages par défaut.
  - `layoutFromSimple(content: BrochureContent, style: BrochureStyle, catalog: ReadonlyMap<string, CatalogPrestation>): BrochureLayout` — pages de `paginateBrochure(..., forEditor: true)` converties : `cover`/`contact`/`form` gardées ; `about` → page `blocks` (Titre « Qui sommes-nous », Texte, Image si photo) ; `items` → page `blocks` (Titre de section s'il y en a un, puis une prestation par bloc ; Éditorial : `photo: 'top'`, `text: 'full'` ; Carte : `photo: 'none'`, `text: 'short'` ; Magazine : `photo` alternée `'left'`/`'right'`, `text: 'short'`), retouches reprises.
  - `sectionsFromLayout(l: BrochureLayout): BrochureSection[]` — une section par bloc Titre rencontré (titre = texte du bloc), sinon « Nos prestations » ; blocs Prestation dans l'ordre (colonnes de gauche à droite), retouches reprises.
  - `mergeLayout(l: BrochureLayout, content: BrochureContent): BrochureLayout` — retire les blocs Prestation absents de `content`, ajoute avant le formulaire une page `blocks` avec les prestations de `content` absentes de `l` (rien si aucune).
  - `resolveLayout(l: BrochureLayout, catalog, o: PriceOptions & { forEditor: boolean }): { kind: LayoutPage['kind']; background?: string | null; font?: string | null; blocks: ResolvedBlock[] }[]` — prestation absente : sautée (public) ou `item.missing` (éditeur) ; `text: 'short'` → `item.html` = `shortText(..., 150)` ; HTML passé par `sanitizeHtml` ; `show.price` faux ou `hidePrice` → prix null.

- [ ] **Step 1: Write the failing tests** in `lib/brochureLayout.test.ts` :
  - `parseLayout` : un bloc de type inconnu est retiré ; une couleur hors `PALETTE` devient null ; `parseLayout('x') === null`.
  - `layoutError` : deux couvertures → message ; formulaire pas en dernier → message ; colonnes dans des colonnes → message ; mise en page correcte → null.
  - Opérations : `addBlock` puis `moveBlock(-1)` change l'ordre ; `placeBlock` dans la colonne 2 d'un bloc colonnes ; `duplicateBlock` donne un nouvel id ; `removePage` refuse (renvoie la même mise en page) la page `form`.
  - `layoutFromSimple` : 3 prestations en Carte → une page `blocks` avec un Titre et 3 blocs `photo: 'none'`, `text: 'short'` ; Éditorial → 3 pages `blocks` ; ordre des `kind` : `['cover', 'blocks', ..., 'contact', 'form']`.
  - `sectionsFromLayout(layoutFromSimple(c, 'carte', catalog))` redonne les mêmes `prestationId` dans le même ordre, et la retouche d'un item.
  - Review Focus 3 : `mergeLayout` avec une prestation retirée de `content` et une ajoutée → le bloc retiré disparaît, une page `blocks` avec la nouvelle prestation se place juste avant `form`.
  - Review Focus 1 : `resolveLayout` avec une prestation absente du catalogue → absente en public, `missing: true` en éditeur.
  - `resolveLayout` ne contient pas l'identifiant de prestation (`JSON.stringify` sans l'id).
- [ ] **Step 2: Run** `npx vitest run lib/brochureLayout.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `lib/brochureLayout.ts`** ; déplacer `shortText` dans `lib/brochure.ts` et l'importer dans `BrochurePages.tsx`.
- [ ] **Step 4: Run** `npx vitest run lib/brochureLayout.test.ts lib/brochure.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(brochures): modèle de mise en page à blocs`.

### Task 3: Base et serveur — mode d'éditeur, mise en page, lecture publique

**Files:**
- Modify: `db/schema/tables.ts`, `server/brochures.ts`, `server/brochures.test.ts`
- Create: `db/migrations/0035_brochure_layout.sql` (+ meta via `npx drizzle-kit generate --name brochure_layout`, SQL rendu idempotent et commenté)

**Interfaces:**
- Consumes: Task 2 (`parseLayout`, `layoutError`, `layoutFromSimple`, `sectionsFromLayout`, `mergeLayout`, `resolveLayout`).
- Produces :
  - Colonnes `brochures.editor_mode text not null default 'simple'` (check `simple|advanced`), `brochures.layout jsonb` (null).
  - `saveBrochure(id, patch)` accepte aussi `layout` : `parseLayout` puis `layoutError` (erreur renvoyée telle quelle), HTML des blocs Texte et des retouches passé par `sanitizeHtml`.
  - `switchBrochureEditor(id: string, to: 'simple' | 'advanced', opts?: { resume?: boolean }): Promise<{ error: string | null; needsChoice?: boolean }>` — vers `advanced` : sans `layout` → `layoutFromSimple` ; avec `layout` et `opts.resume === undefined` → `{ error: null, needsChoice: true }` sans rien changer ; `resume: true` → `mergeLayout` ; `resume: false` → `layoutFromSimple`. Vers `simple` : `content.sections = sectionsFromLayout(layout)`, `layout` gardé.
  - `PublicBrochure.pages` devient `PublicPage[]` avec `type PublicPage = BrochurePage | { kind: 'blocks'; background: string | null; font: string | null; blocks: ResolvedBlock[] }` ; en mode `advanced`, pages tirées de `resolveLayout(..., forEditor: false)` (pages `cover`, `contact`, `form` gardées dans l'ordre de la mise en page).
  - `getBrochureEditorData` renvoie la brochure avec `editor_mode` et `layout` (inchangé sinon).

- [ ] **Step 1: Write the failing tests** (`describe('brochures : éditeur avancé')`) :
  - `switchBrochureEditor(id, 'advanced')` sur une brochure simple → `editor_mode = 'advanced'`, `layout.pages` commence par `cover` et finit par `form`.
  - Review Focus 2 : `saveBrochure(id, { layout })` avec deux couvertures → erreur, `layout` en base inchangé ; avec un bloc Texte `<p>ok</p><script>x()</script>` → enregistré sans `<script>`.
  - Review Focus 4 : mode avancé, `show_prices: false` → `getPublicBrochure` sans `€` ni prix, et sans l'identifiant de prestation.
  - Retour vers `simple` puis `switchBrochureEditor(id, 'advanced')` → `{ needsChoice: true }` ; `resume: true` garde un bloc Titre ajouté à la main.
  - Une brochure jamais passée en avancé donne exactement les mêmes pages publiques qu'avant (comparer à `paginateBrochure`).
- [ ] **Step 2: Run** `npx vitest run server/brochures.test.ts` — Expected: FAIL.
- [ ] **Step 3: Declare columns, generate migration 0035, implement the actions.**
- [ ] **Step 4: Run** `npx vitest run server/brochures.test.ts lib/brochureLayout.test.ts` and `npx tsc --noEmit -p .` — Expected: PASS ; puis `npm run db:migrate` (additive, consigne bêta) avant les tests e2e.
- [ ] **Step 5: Commit** `feat(brochures): mode d'éditeur et mise en page enregistrée`.

### Task 4: Rendu des pages à blocs (lien public et aperçu)

**Files:**
- Create: `components/brochures/BlockPage.tsx`
- Modify: `components/brochures/BrochurePages.tsx` (page `blocks`), `app/b/[token]/BrochureBook.tsx`, `server/brochures.ts` (polices utilisées : `googleFontsHref`), `app/b/[token]/page.tsx` (lien de polices)
- Test: `e2e/brochures.spec.ts`

**Interfaces:**
- Consumes: `ResolvedBlock`, `PublicPage` (Tasks 2, 3).
- Produces: `<BlockPage page={{ background, font, blocks }} theme={BrochureStyle} language editing?={{ selectedId: string | null; onSelect(id): void; onMove(id, dir): void; onRemove(id): void; onDrop(at): void }} />` — tailles en cqw comme `BrochurePages`, police par défaut celle du thème ; une page trop pleine défile à l'intérieur (`overflow-y: auto`), jamais de texte coupé ; en mode `editing`, contour pointillé, sélection terracotta, flèches, zones de dépôt ; `PublicBrochure.fontsHref: string | null`.

- [ ] **Step 1: Write the failing e2e test** `test('brochure en éditeur avancé : le lien public montre les blocs')` : brochure insérée en SQL avec `editor_mode = 'advanced'` et une page `blocks` (Titre « Nos menus », colonnes 2 avec deux prestations, Séparateur) → sur `/b/<token>`, la deuxième page montre « Nos menus » et les deux noms côte à côte (même `boundingBox().y` à 2 px près) ; capture mobile et ordinateur.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement `BlockPage` and wire `kind: 'blocks'`.**
- [ ] **Step 4: Run** the e2e test and the whole `e2e/brochures.spec.ts` — Expected: PASS ; captures relues.
- [ ] **Step 5: Commit** `feat(brochures): rendu des pages à blocs`.

### Task 5: Éditeur avancé — pages, palette, canevas, choix de l'éditeur

**Files:**
- Create: `components/brochures/advanced/AdvancedEditor.tsx`, `components/brochures/advanced/PagesStrip.tsx`, `components/brochures/advanced/BlockPalette.tsx`
- Modify: `components/brochures/BrochureEditor.tsx` (bascule « Éditeur simple | Éditeur avancé », fenêtres de passage)
- Test: `e2e/brochures.spec.ts`

**Interfaces:**
- Consumes: opérations de Task 2, `switchBrochureEditor` et `saveBrochure({ layout })` (Task 3), `BlockPage` en mode `editing` (Task 4), `PrestationPicker` (choix de la prestation d'un nouveau bloc Prestation).
- Produces: `<AdvancedEditor brochure catalog company />` ; enregistrement automatique (800 ms, envoi au départ de la page comme l'éditeur simple) ; alerte « Page trop pleine » (mesure `scrollHeight > clientHeight + 2` de la page) sur la page et sa vignette ; sur un écran < 1024 px : palette dans un menu « Ajouter un bloc », réglages sous la page.

- [ ] **Step 1: Write the failing e2e test** `test('éditeur avancé : passer en avancé, ajouter et déplacer des blocs')` : depuis une brochure simple avec deux prestations, cliquer « Éditeur avancé » → les vignettes de pages apparaissent ; sélectionner la page 2, ajouter un bloc Titre (« Titre » dans la palette), le monter en premier (« Monter »), ajouter une page, la supprimer ; attendre « Enregistré » ; le lien public montre le titre en haut de la page 2. Puis « Éditeur simple » → fenêtre d'avertissement → confirmer → l'éditeur simple liste toujours les deux prestations. Puis « Éditeur avancé » → fenêtre « Reprendre ma mise en page avancée » → le titre ajouté est toujours là. Ajouter 12 blocs Espace → « Page trop pleine » visible. Capture 360 px : pas de défilement horizontal.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** : bandeau de vignettes (miniatures = `BlockPage` réduit, glisser pour réordonner + flèches, « + » ajoute une page `blocks`, menu de page : dupliquer, supprimer, monter, descendre ; ajout Couverture/Contact grisé s'ils existent) ; palette (clic = ajout en fin de page sélectionnée, glisser = dépôt à l'endroit visé) ; canevas = la page sélectionnée à l'échelle du livre.
- [ ] **Step 4: Run** the e2e test and the whole `e2e/brochures.spec.ts` — Expected: PASS ; captures 1280 et 360 px relues.
- [ ] **Step 5: Commit** `feat(brochures): éditeur avancé, pages et blocs`.

### Task 6: Réglages des blocs et des pages

**Files:**
- Create: `components/brochures/advanced/BlockSettings.tsx`, `components/brochures/advanced/PageSettings.tsx`
- Modify: `components/brochures/advanced/AdvancedEditor.tsx`
- Test: `e2e/brochures.spec.ts`

**Interfaces:**
- Consumes: `updateBlock`, `updatePage` (Task 2) ; `ItemRetouch`, `RichTextEditor`, `PhotoField` existants ; `PALETTE`, `BLOCK_FONTS`, tailles de titre (Global Constraints).
- Produces: panneau de réglages selon le type (Spec, objectif 3) : Prestation (prestation, photo haut/gauche/droite/aucune, afficher nom/texte/prix, texte complet/court, alignement, retoucher), Titre (texte, niveau, alignement), Texte (texte riche), Image (photo, hauteur, remplir/contenir), Colonnes (2/3, espacement), Séparateur (couleur, largeur), Espace (hauteur) ; communs : marges, fond, police, taille et couleur du titre. Réglages de page : fond, police.

- [ ] **Step 1: Write the failing e2e test** `test('réglages : photo à gauche, texte court, prix masqué, fond de page')` : en éditeur avancé, sélectionner un bloc Prestation, choisir « Gauche » → la photo est à gauche du nom dans le canevas (`x` photo < `x` nom) ; « Texte : court » → le texte du canevas fait au plus 151 caractères ; décocher « Prix » → plus de « € » dans le bloc ; fond de page « #EDE6DA » → le lien public montre ce fond (`getComputedStyle` de la page). Vérifier en base que `prestations` n'a pas changé.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement the panels.**
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit -p .`, the whole `e2e/brochures.spec.ts`, `npx next build` (puis `rm -rf .next/cache`) — Expected: PASS.
- [ ] **Step 5: Commit** `feat(brochures): réglages des blocs et des pages`.
