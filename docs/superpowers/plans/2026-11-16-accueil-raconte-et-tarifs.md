# Accueil raconté, Tarifs en trois étapes, fin de l'annuel : plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un seul prix dit partout de la même façon, plus d'abonnement annuel, une page Tarifs en trois étapes, la page Nouveautés masquée, et un accueil qui raconte la semaine de Julien, traiteur, jusqu'au tarif et à la démo.

**Architecture:** `lib/pricing.ts` reste la seule source des montants et des listes de l'offre ; le site et l'écran Abonnement la lisent. L'accueil est une page rendue côté serveur qui assemble de petits composants dans `components/site/story/` ; seuls les morceaux qui bougent sont des composants client. Les chiffres de l'histoire vivent dans `lib/site/story.ts`.

**Tech Stack:** Next.js (App Router), React, Tailwind, Vitest (`npm test`), Stripe. Aucune nouvelle dépendance.

**Spec:** `docs/superpowers/specs/2026-11-16-accueil-raconte-et-tarifs-design.md`. Maquettes de référence : `.superpowers/brainstorm/1041-1794814935/content/accueil-histoire-v3-personnage.html` et `tarifs.html`.

## Global Constraints

- Formulation du prix, partout : « 1 250 € HT le premier mois, mise en service comprise, puis 100 € HT par mois, sans engagement ». Jamais « mise en service 1 250 € » seul, jamais « 1 150 € » sur le site.
- Montants inchangés : `MONTHLY_HT = 100`, `FIRST_MONTH_HT = 1250`, `SETUP_HT = 1150`. Aucun changement de prix dans Stripe, aucune migration.
- L'import des clients n'est plus compris dans la mise en service : c'est une option sur devis.
- La démo est « gratuite, sans carte bancaire », jamais « sans inscription ».
- Julien est un personnage : la page le dit. Le témoignage de Convivial Event reste, sans nombre de bêta-testeurs.
- Direction artistique du site : crème, vert sapin, terracotta ; classes existantes (`site-h1`, `site-h2`, `site-body`, `container`, `sectionGap`, `bg-forest`, `site-dark`, `site-reveal`) ; pas deux boutons démo visibles en même temps (voir `DemoButton` et la barre fixe du téléphone dans `components/site/ui.tsx` et `SiteShell.tsx`).
- Textes en français : espaces insécables, guillemets français, apostrophe typographique « ’ », pas de tiret long dans les phrases.
- Toute animation s'arrête avec `prefers-reduced-motion` et montre alors l'état final.
- Travail sur la branche `feat/accueil-raconte`, un commit par tâche. Rien n'est poussé ni fusionné dans `main` (production Vercel) sans l'accord de Maxence. `npm test` et `npm run build` passent avant.
- Fichiers statiques : le dossier s'appelle `Public/` ; `git add` avec le chemin `public/...` complet.

## Review Focus

1. **Abonné annuel existant** : son écran Abonnement affiche toujours « Annuel » et « 1 100 € HT / an (1 320 € TTC) », sans bouton pour changer de formule. Test : tâche 1 (`planAmount`).
2. **Ancien abonné qui se réabonne** (`setupDue = false`) : on ne lui annonce pas 1 250 €, seulement 100 € HT par mois. Test : tâche 1 (`subscribeSummary`).
3. **Visiteur qui arrive sur `/nouveautes` depuis Google ou un vieux lien** : page introuvable, et aucun lien du site (menu, pied de page, page 404, guides, sitemap) n'y renvoie. Test : tâche 4.
4. **Animations coupées ou script pas encore chargé** : les six notifications, la checklist et la marge sont lisibles dans leur état final ; aucun texte de l'histoire ne reste invisible. Test : tâche 8 (rendu serveur des composants) et contrôle de la tâche 10.
5. **Téléphone étroit (360 px)** : pas de défilement horizontal de la page, la barre de la semaine défile dans sa propre ligne et ne passe ni sous l'en-tête collant ni sous la barre démo du bas ; le compteur de convives reste entre ses bornes. Test : tâche 7 (`clampGuests`) et contrôle de la tâche 10.

---

## Lot 1 : l'offre

### Task 1 : `lib/pricing.ts`, la nouvelle offre

**Files:**
- Modify: `lib/pricing.ts`
- Create: `lib/pricing.test.ts`

**Interfaces:**
- Produces:
  - `SETUP_INCLUDES: string[]`, `MONTHLY_INCLUDES: string[]`, `EXTRAS: string[]`
  - `FIRST_YEAR_HT: number` (2350), `NEXT_YEAR_HT: number` (1200)
  - `PRICE_LINE: string` : « 1 250 € HT le premier mois, mise en service comprise, puis 100 € HT par mois, sans engagement »
  - `SETUP_SUMMARY: string` : « Formation, modèles de devis et prestations essentielles » (description courte, réutilisée par Stripe et `PlanCards`)
  - `planAmount(plan: 'mensuel' | 'annuel'): string`
  - `subscribeSummary(setupDue: boolean): string`
- Supprime : `YEARLY_HT`, `YEARLY_BONUS` (le montant annuel devient une constante non exportée, `LEGACY_YEARLY_HT = 1100`, utilisée par `planAmount` seulement).

- [ ] **Step 1 : écrire les tests qui échouent** dans `lib/pricing.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import * as pricing from './pricing';

describe('offre WeboDevis', () => {
  it('garde les montants', () => {
    expect([pricing.MONTHLY_HT, pricing.FIRST_MONTH_HT, pricing.SETUP_HT]).toEqual([100, 1250, 1150]);
    expect(pricing.FIRST_YEAR_HT).toBe(2350);
    expect(pricing.NEXT_YEAR_HT).toBe(1200);
  });
  it('décrit la mise en service de la nouvelle offre', () => {
    expect(pricing.SETUP_INCLUDES).toEqual([
      '3 séances de formation de 2 h',
      'Vos infos d’entreprise et votre première facture, préparées avec vous',
      '6 modèles de devis : mariage, entreprise, à emporter',
      'Vos prestations essentielles, déjà créées',
    ]);
    expect(pricing.MONTHLY_INCLUDES).toHaveLength(4);
    expect(pricing.EXTRAS).toHaveLength(2);
  });
  it('ne promet plus l’import des clients ni l’annuel', () => {
    const all = JSON.stringify([pricing.SETUP_INCLUDES, pricing.MONTHLY_INCLUDES, pricing.PRICE_LINE, pricing.SETUP_SUMMARY, pricing.subscribeSummary(true)]);
    expect(all).not.toMatch(/import|annuel|offert|1 150/i);
    expect(pricing).not.toHaveProperty('YEARLY_HT');
    expect(pricing).not.toHaveProperty('YEARLY_BONUS');
  });
  it('dit le prix d’une seule façon', () => {
    expect(pricing.PRICE_LINE).toBe('1 250 € HT le premier mois, mise en service comprise, puis 100 € HT par mois, sans engagement');
  });
  it('affiche le montant d’un abonnement existant, annuel compris', () => {
    expect(pricing.planAmount('mensuel')).toBe('100 € HT / mois (120 € TTC)');
    expect(pricing.planAmount('annuel')).toBe('1 100 € HT / an (1 320 € TTC)');
  });
  it('n’annonce la mise en service qu’au premier abonnement', () => {
    expect(pricing.subscribeSummary(true)).toContain('1 250 € HT');
    expect(pricing.subscribeSummary(false)).not.toContain('1 250');
    expect(pricing.subscribeSummary(false)).toContain('100 € HT');
  });
});
```

Les espaces des montants sont ceux que rend `euros()` (insécable des milliers, espace avant « € ») : écrire les valeurs attendues avec `euros()` si la comparaison littérale échoue sur un type d'espace.

- [ ] **Step 2 : lancer** `npx vitest run lib/pricing.test.ts`. Attendu : échec (exports manquants).
- [ ] **Step 3 : écrire `lib/pricing.ts`.** `MONTHLY_INCLUDES` et `EXTRAS` : listes de la spec, section 1. Mettre à jour le commentaire d'en-tête (plus de `STRIPE_PRICE_ANNUEL` côté vente).
- [ ] **Step 4 : relancer le test.** Attendu : réussite. Le reste du projet ne compile plus (imports de `YEARLY_*`) : c'est attendu, les tâches 2, 3, 5 et 6 les retirent.
- [ ] **Step 5 : commit** `feat(tarifs): nouvelle mise en service, plus d'annuel dans lib/pricing`

### Task 2 : le serveur refuse l'annuel

**Files:**
- Modify: `server/billingActions.ts` (lignes 56-59, 82, 128-147)
- Modify: `server/billingActions.test.ts`

**Interfaces:**
- Consumes: `SETUP_SUMMARY` (tâche 1).
- Produces: `startCheckout(plan)` rend `{ error: 'Formule inconnue.' }` pour tout ce qui n'est pas `'mensuel'` ; `switchToAnnual` n'existe plus.

- [ ] **Step 1 : adapter les tests.** Dans `billingActions.test.ts` : les cas qui appellent `startCheckout('annuel')` (lignes 83, 110, 116) attendent `{ error: 'Formule inconnue.' }` et aucun appel à `checkout.sessions.create` ; le cas « passe en annuel avec prorata » (ligne 191) est supprimé ; ajouter `expect(actions).not.toHaveProperty('switchToAnnual')` ; ajouter un cas : au premier abonnement mensuel, la ligne de mise en service envoyée à Stripe a `unit_amount: 115000` et une description sans le mot « import ». Les cas d'un abonné annuel existant (résiliation, reprise, portail) restent.
- [ ] **Step 2 : lancer** `npx vitest run server/billingActions.test.ts`. Attendu : échec.
- [ ] **Step 3 : modifier `server/billingActions.ts`.** Garder le type `Plan` et `priceFor`/`planOfPrice` de `lib/stripe.ts` intacts (synchronisation des abonnements annuels existants).
- [ ] **Step 4 : lancer** `npx vitest run server`. Attendu : réussite, y compris `stripeSync`, `subscriptionView`, `adminBilling` sans les modifier.
- [ ] **Step 5 : commit** `feat(abonnement): plus de nouvel abonnement annuel`

### Task 3 : l'écran Abonnement, une seule formule

**Files:**
- Modify: `components/billing/PlanCards.tsx`
- Modify: `components/billing/SubscriptionManager.tsx` (lignes 14, 17, 22, 52-59, 130, 138)

**Interfaces:**
- Consumes: `planAmount`, `subscribeSummary`, `MONTHLY_HT`, `euros`, `ttc` (tâche 1).
- Produces: `PlanCards` garde les mêmes props (`canSubscribe`, `testMode`, `setupDue`, `buttonClassName`) ; il n'exporte plus `PLANS` ni `planAmount`.

- [ ] **Step 1 : `PlanCards`.** Plus de `radiogroup` ni d'état `plan` : un bloc avec « 100 € HT / mois », « 120 € TTC · sans engagement », la phrase `subscribeSummary(setupDue)`, le bouton « S’abonner » qui appelle `startCheckout('mensuel')`. Le mode test, l'erreur et la mention Stripe restent.
- [ ] **Step 2 : `SubscriptionManager`.** Retirer `onAnnual`, le bouton « Passer en annuel » et l'import de `switchToAnnual` ; importer `planAmount` depuis `@/lib/pricing`. `PLAN_LABEL` garde `annuel: 'Annuel'`.
- [ ] **Step 3 : vérifier** `npx tsc --noEmit` : plus aucune erreur dans `components/billing` ni `app/abonnement`.
- [ ] **Step 4 : commit** `feat(abonnement): écran à une seule formule`

### Task 4 : la page Nouveautés, masquée

**Files:**
- Modify: `lib/site/config.ts`, `lib/site/pages.ts`, `app/nouveautes/page.tsx`, `components/site/SiteShell.tsx` (ligne 62), `app/not-found.tsx` (ligne 15), `components/site/guides/FactureElectronique.tsx` (ligne 71), `app/site/page.tsx` (lignes 83, 127-129, 286)
- Create: `lib/site/pages.test.ts`

**Interfaces:**
- Produces: `SHOW_RELEASES = false` dans `lib/site/config.ts`. Quand il est faux : `MENU_LINKS`, `FOOTER`, `SITEMAP` ne contiennent pas `/nouveautes` ; l'entrée Fonctionnalités de `MENU` n'a pas de `note` ; `RELEASE_NOTE` vaut `undefined`.

- [ ] **Step 1 : écrire le test qui échoue**

```ts
import { describe, expect, it } from 'vitest';
import { SHOW_RELEASES } from './config';
import { FOOTER, MENU, MENU_LINKS, SITEMAP } from './pages';

describe('page Nouveautés masquée', () => {
  it('est éteinte', () => expect(SHOW_RELEASES).toBe(false));
  it('n’apparaît dans aucun lien ni dans le sitemap', () => {
    const all = JSON.stringify({ MENU, MENU_LINKS, FOOTER, SITEMAP });
    expect(all).not.toContain('/nouveautes');
  });
});
```

- [ ] **Step 2 : lancer** `npx vitest run lib/site/pages.test.ts`. Attendu : échec.
- [ ] **Step 3 : `config.ts` et `pages.ts`.** Les listes se construisent selon `SHOW_RELEASES`, pour que la rallumer tienne en une ligne.
- [ ] **Step 4 : la page et les liens.** `app/nouveautes/page.tsx` : `notFound()` en tête du composant et `robots: { index: false }` dans les métadonnées quand `SHOW_RELEASES` est faux ; son contenu reste. `SiteShell`, `not-found.tsx` : le lien n'est rendu que si `SHOW_RELEASES`. `FactureElectronique` : « nous l’annoncerons ici », sans lien. `app/site/page.tsx` : retirer les deux liens et la phrase « La page Nouveautés détaille… » (la date de sortie reste dite, sans lien).
- [ ] **Step 5 : vérifier** le test, puis `grep -rn "nouveautes" app components lib --include=*.ts --include=*.tsx` : il ne reste que `lib/site/pages.ts` (la constante `RELEASES`), `app/nouveautes/` et le test.
- [ ] **Step 6 : commit** `feat(site): page Nouveautés masquée jusqu'aux vraies nouveautés`

### Task 5 : la page Tarifs en trois étapes

**Files:**
- Modify: `app/tarifs/page.tsx` (réécriture), `app/tarifs/layout.tsx` si son titre cite l'ancien prix

**Interfaces:**
- Consumes: `SETUP_INCLUDES`, `MONTHLY_INCLUDES`, `EXTRAS`, `FIRST_MONTH_HT`, `MONTHLY_HT`, `FIRST_YEAR_HT`, `NEXT_YEAR_HT`, `PRICE_LINE`, `euros`, `ttc` (tâche 1) ; `HeroPanel`, `FaqList`, `DemoButton`, `JsonLd` existants.

- [ ] **Step 1 : réécrire la page** selon `tarifs.html` et la spec, section 4 : ouverture « Un seul prix, en trois étapes. » ; trois cartes numérotées (1. Aujourd’hui, gratuit, la démo ; 2. Le premier mois, une seule fois, `euros(FIRST_MONTH_HT)` HT, TTC, « mise en service et premier mois compris », `SETUP_INCLUDES` ; 3. Ensuite, chaque mois, `euros(MONTHLY_HT)` HT, TTC, sans engagement, `MONTHLY_INCLUDES`) ; la ligne « Votre première année, tout compris » ; « En option, sur simple devis » avec `EXTRAS` et `QUOTE_REQUEST` ; les quatre questions de la maquette ; la fin « Le mieux, c’est de l’essayer. ». Tous les montants passent par `euros()` : aucun chiffre en dur.
- [ ] **Step 2 :** un seul bouton démo visible à la fois : celui de la carte 1 utilise `DemoButton always` seulement si la barre fixe du téléphone ne fait pas doublon ; sinon un `TextLink`. `DESCRIPTION` reprend `PRICE_LINE`. `faqSchema` suit les quatre questions.
- [ ] **Step 3 : vérifier** `npx tsc --noEmit`, puis `npm run dev` et ouvrir `/tarifs` à 390 px et 1280 px : trois cartes empilées puis en ligne, pas de défilement horizontal, aucun « annuel », « mois offert », « import ».
- [ ] **Step 4 : commit** `feat(site): page Tarifs en trois étapes`

### Task 6 : alignement du reste, et lot 1 livrable

**Files:**
- Modify: `app/site/page.tsx` (ligne 85, réponse « Combien coûte WeboDevis ? », et import de `YEARLY_HT`), `app/site/opengraph-image.tsx`, `lib/site/schema.ts`, `components/site/MenuAsides.tsx`, et tout fichier que la recherche ci-dessous fait remonter

- [ ] **Step 1 : rechercher** `grep -rniE "annuel|mois offert|import de vos clients|Deux modèles|sans inscription|1 150" app components lib server --include=*.ts --include=*.tsx`. Attendu après correction : il ne reste que l'affichage des abonnements annuels existants (`lib/stripe.ts`, `lib/subscription.ts`, `lib/pricing.ts` pour `planAmount`, `SubscriptionManager` pour `PLAN_LABEL`, `server/` et leurs tests).
- [ ] **Step 2 : corriger chaque occurrence.** La réponse sur le prix de l'accueil devient `PRICE_LINE` suivi de « La démonstration est gratuite. La page Tarifs détaille tout. ». Si `softwareSchema` porte une offre, son prix reste 100 € par mois.
- [ ] **Step 3 : vérifier** `npm test` (tout passe), `npm run lint`, `npm run build` (réussit).
- [ ] **Step 4 : commit** `fix(site): un seul prix partout, plus d'annuel ni d'import compris`
- [ ] **Step 5 : s'arrêter et rendre compte à Maxence** : le lot 1 est livrable seul. Lui rappeler de vérifier dans le tableau de bord Stripe que le portail de facturation ne propose pas de changer de formule. Ne rien pousser sans son accord.

---

## Lot 2 : l'accueil raconté

### Task 7 : les chiffres de l'histoire

**Files:**
- Create: `lib/site/story.ts`, `lib/site/story.test.ts`

**Interfaces:**
- Produces:
  - `STORY = { couple: 'Léa & Hugo', client: 'Léa Martin', dateLabel: 'samedi 14 juin', guests: 120, finalGuests: 132, minGuests: 20, maxGuests: 300, step: 10 }`
  - `quoteLines(guests: number): { label: string; amount: number }[]` (trois lignes HT : cocktail 18 € par convive, dîner 52 € par convive, service et vaisselle 600 € + 7 € par convive)
  - `quoteTotalTtc(guests: number): number` (TVA 10 %, arrondi à l'euro)
  - `clampGuests(n: number): number`
  - `INVOICED: number` = `quoteTotalTtc(STORY.finalGuests)`, `MARGIN: number` (exemple, inférieur à `INVOICED`)
  - `REQUESTS: { source: string; text: string }[]` (les six demandes du lundi), `CREW: { name; role; when; where; outfit }[]` (trois extras), `CHECKLIST: string[]` (cinq lignes), `DAYS: { id: string; label: string }[]` (les huit entrées de la barre de la semaine, dans l'ordre de la spec)
- Les ingrédients du jeudi viennent de `lib/site/coursesExample.ts` si `CoursesCalculator` est réutilisé ; sinon les ajouter ici.

- [ ] **Step 1 : tests qui échouent**

```ts
import { describe, expect, it } from 'vitest';
import { CHECKLIST, CREW, DAYS, INVOICED, MARGIN, REQUESTS, STORY, clampGuests, quoteLines, quoteTotalTtc } from './story';

describe('la semaine de Julien', () => {
  it('raconte six demandes, trois extras, huit étapes', () => {
    expect(REQUESTS).toHaveLength(6);
    expect(CREW).toHaveLength(3);
    expect(CHECKLIST).toHaveLength(5);
    expect(DAYS.map((d) => d.id)).toEqual(['lun', 'devis', 'mer', 'jeu', 'ven', 'sam', 'fin', 'tarif']);
  });
  it('calcule le devis du mariage', () => {
    expect(quoteLines(120).map((l) => l.amount)).toEqual([2160, 6240, 1440]);
    expect(quoteTotalTtc(120)).toBe(10824);
  });
  it('facture ce que le devis final annonce', () => {
    expect(INVOICED).toBe(quoteTotalTtc(STORY.finalGuests));
    expect(MARGIN).toBeGreaterThan(0);
    expect(MARGIN).toBeLessThan(INVOICED);
  });
  it('garde le nombre de convives entre ses bornes', () => {
    expect(clampGuests(0)).toBe(20);
    expect(clampGuests(9999)).toBe(300);
    expect(clampGuests(Number.NaN)).toBe(STORY.guests);
  });
});
```

- [ ] **Step 2 : lancer** `npx vitest run lib/site/story.test.ts`. Attendu : échec.
- [ ] **Step 3 : écrire `lib/site/story.ts`.** Textes des demandes, des extras et de la checklist : ceux de la maquette v3.
- [ ] **Step 4 : relancer.** Attendu : réussite.
- [ ] **Step 5 : commit** `feat(site): les chiffres de la semaine de Julien`

### Task 8 : Julien et les visuels de la semaine

**Files:**
- Create: `components/site/story/Julien.tsx`, `Van.tsx`, `LockScreen.tsx`, `QuoteStepper.tsx`, `SignedMessages.tsx`, `CrewPhones.tsx`, `AutoChecklist.tsx`, `MarginCounter.tsx`, `WeekBar.tsx`, `useInView.ts`
- Create: `components/site/story/story.test.tsx`
- Modify: `components/site/site.css` (animations de Julien et des visuels)

**Interfaces:**
- Consumes: tout `lib/site/story.ts` (tâche 7).
- Produces:
  - `Julien({ pose, className, title? }: { pose: 'cafe' | 'bureau' | 'caisse' | 'detente' | 'plateau' | 'victoire'; className?: string; title?: string })` : SVG en ligne, `aria-hidden` sauf si `title` est donné (`role="img"`). Composant serveur.
  - `Van({ className })` : le camion « Julien Traiteur », `aria-hidden`.
  - `LockScreen()`, `SignedMessages()`, `CrewPhones()` : composants serveur, tout leur contenu est dans le HTML ; l'entrée en scène se fait en CSS.
  - `QuoteStepper()`, `AutoChecklist()`, `MarginCounter()`, `WeekBar()` : composants client (`'use client'`).
  - `useInView(ref, options?): boolean`.

Règles communes : le dessin et les poses partent de la fonction `julien()` et de `POSES` de la maquette v3, à soigner (proportions, mains, visage) sans changer de style ; couleurs par variables du thème (`--p-*`, `--forest`, `--sage`) ; respiration, clignement, vapeur et entrée du camion en CSS dans `site.css`, coupés par `prefers-reduced-motion`. État rendu par le serveur = état final lisible : les six notifications présentes, la checklist cochée (quatre lignes sur cinq), la marge à sa valeur `MARGIN`. L'animation part de cet état quand le bloc entre à l'écran, jamais l'inverse.

- [ ] **Step 1 : tests de rendu qui échouent** (`story.test.tsx`, avec `renderToStaticMarkup` de `react-dom/server`, sans nouvelle dépendance) :

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CHECKLIST, MARGIN, REQUESTS } from '@/lib/site/story';
import { euros } from '@/lib/pricing';
import AutoChecklist from './AutoChecklist';
import Julien from './Julien';
import LockScreen from './LockScreen';
import MarginCounter from './MarginCounter';
import QuoteStepper from './QuoteStepper';

describe('visuels de l’histoire, sans script', () => {
  it('affiche les six demandes', () => {
    const html = renderToStaticMarkup(<LockScreen />);
    for (const r of REQUESTS) expect(html).toContain(r.text);
  });
  it('affiche la checklist et la marge dans leur état final', () => {
    const list = renderToStaticMarkup(<AutoChecklist />);
    for (const line of CHECKLIST) expect(list).toContain(line);
    expect(renderToStaticMarkup(<MarginCounter />)).toContain(euros(MARGIN));
  });
  it('affiche le devis à 120 convives', () => {
    expect(renderToStaticMarkup(<QuoteStepper />)).toContain(euros(10824));
  });
  it('cache Julien aux lecteurs d’écran, sauf quand on le décrit', () => {
    expect(renderToStaticMarkup(<Julien pose="bureau" />)).toContain('aria-hidden="true"');
    const named = renderToStaticMarkup(<Julien pose="cafe" title="Julien, traiteur" />);
    expect(named).toContain('role="img"');
    expect(named).toContain('Julien, traiteur');
  });
});
```

Si Vitest n'est pas réglé pour le JSX ou l'alias `@/`, regarder comment un test `.tsx` existant ou `vitest.config` le fait, et s'y conformer.

- [ ] **Step 2 : lancer** `npx vitest run components/site/story`. Attendu : échec.
- [ ] **Step 3 : écrire les composants.** `QuoteStepper` : boutons « − » et « + » avec `aria-label`, pas de `STORY.step`, bornes par `clampGuests`, total dans une zone `aria-live="polite"`. `WeekBar` : liens d'ancre vers les `id` de `DAYS`, entrée active suivie par `IntersectionObserver`, `overflow-x: auto` sur sa propre ligne, collante sous l'en-tête du site (lire la hauteur de l'en-tête dans `SiteShell`/`site.css`, ne pas la deviner).
- [ ] **Step 4 : relancer le test.** Attendu : réussite.
- [ ] **Step 5 : commit** `feat(site): Julien et les visuels de sa semaine`

### Task 9 : la page d'accueil

**Files:**
- Modify: `app/site/page.tsx` (réécriture)
- Modify: `components/site/site.css` si besoin
- Delete: les composants de `components/site/` qui ne sont plus importés nulle part après la réécriture (le vérifier par recherche avant de supprimer ; candidats : `EventMarquee`, `JourneyTabs`, `DashboardPreview`, `RequestPreview`, `EventPreview`)

**Interfaces:**
- Consumes: les composants de la tâche 8, `lib/site/story.ts`, `SETUP_INCLUDES`, `MONTHLY_INCLUDES`, `EXTRAS`, `PRICE_LINE`, `FIRST_MONTH_HT`, `MONTHLY_HT`, `euros` ; `Testimonial`, `FaqList`, `LinkList`, `CoursesCalculator`, `DemoButton`, `TextLink`, `JsonLd` existants.

- [ ] **Step 1 : réécrire la page** dans l'ordre de la spec, section 3, blocs 1 à 12, avec les textes de la maquette v3. Chaque jour est une `<section id>` dont l'`id` est celui de `DAYS`, avec un `aria-labelledby`. Points fixés :
  - ouverture : `<h1>` « Six demandes sont arrivées ce week-end. » ; la ligne de prix est `PRICE_LINE` ; la date de sortie en une phrase sans lien ; sur téléphone, titre, texte et prix passent avant Julien et le téléphone verrouillé ;
  - jeudi : `CoursesCalculator` existant, réglé sur 120 couverts au départ ;
  - sous le lundi suivant : « Julien est un personnage : sa semaine et ses chiffres sont un exemple. » ;
  - `Testimonial` entre le lundi suivant et le tarif ;
  - bloc tarif : « 1. Le premier mois, une seule fois » `euros(FIRST_MONTH_HT)` HT « mise en service comprise », puis « 2. Ensuite » `euros(MONTHLY_HT)` HT par mois ; un lien vers `/tarifs` ; la ligne des options ;
  - « Pour aller plus loin » : trois colonnes Gestion commerciale, Organisation, Gestion, liens pris dans `FEATURES` (`lib/site/features.ts`) par leur `slug`, plus les guides ;
  - FAQ : cinq questions (à qui ça s'adresse, combien ça coûte, faut-il installer quelque chose, peut-on essayer avant, puis-je garder mes anciens devis).
- [ ] **Step 2 : métadonnées et données structurées.** `TITLE` inchangé ; `DESCRIPTION` sans « import » ; `faqSchema` suit les cinq questions ; `organizationSchema`, `websiteSchema`, `softwareSchema`, `breadcrumbSchema` restent.
- [ ] **Step 3 : supprimer les composants orphelins** et leurs styles morts dans `site.css`.
- [ ] **Step 4 : vérifier** `npx tsc --noEmit`, `npm run lint`, `npm test`.
- [ ] **Step 5 : commit** `feat(site): l'accueil raconte la semaine de Julien`

### Task 10 : contrôle à l'œil et remise à Maxence

- [ ] **Step 1 :** `npm test`, `npm run lint`, `npm run build`. Attendu : tout réussit.
- [ ] **Step 2 :** `npm run dev`, ouvrir `/` (sans session) à 360 px, 390 px, 768 px et 1280 px. Contrôler : pas de défilement horizontal ; la barre de la semaine reste sous l'en-tête et ne recouvre pas la barre démo du bas ; un seul bouton démo visible à la fois ; Julien visible à chaque jour sans cacher de texte ; les sept poses dessinées proprement.
- [ ] **Step 3 :** activer « réduire les animations » dans le navigateur : rien ne bouge, tout est lisible dans l'état final. Couper JavaScript : tout le texte de l'histoire et les prix sont visibles.
- [ ] **Step 4 :** faire des captures (téléphone et ordinateur) de l'accueil et de `/tarifs`, vérifier `/nouveautes` (introuvable), `/abonnement` (une seule formule).
- [ ] **Step 5 : s'arrêter.** Montrer les captures à Maxence, lui dire ce qui a été contrôlé et ce qui ne l'a pas été. Si Julien ne lui convient pas : l'accueil doit pouvoir sortir sans lui (retirer les `<Julien>` et `<Van>` de la page, sans autre changement). Ne rien pousser ni fusionner sans son accord.
