# Brochures : photos et suite de page — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** photos réglables (place, taille, cadrage, galerie, aucune sans cadre) et contenu qui continue sur la page
suivante, dans les deux éditeurs et sur le lien public.

**Architecture:** réglages de photo stockés à côté de l'URL dans le JSON existant (aucune migration) ; un rendu
commun photo + texte ; pagination « par fenêtres » : le contenu d'une page est rendu une fois dans un mesureur
caché de largeur fixe, les coupures sont calculées (fonction pure) sur les boîtes des paragraphes, lignes, titres
et photos, puis chaque page affiche une fenêtre décalée du même contenu. Tailles en cqw : coupures exprimées en
centièmes de largeur, donc identiques à toute taille.

**Tech Stack:** Next.js 15, React, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-11-03-brochures-photos-pages-design.md

## Global Constraints

- Aucune migration : les champs nouveaux sont optionnels dans les JSON `content`, `cover`, `layout`.
- Une brochure existante s'affiche comme avant tant qu'on ne touche à rien (hors cadre vide retiré et suite de page).
- Rien d'interne au catalogue sur le lien public.
- Ne jamais montrer de prix sur le site vitrine (sans objet ici).

## Review Focus

- Contenu qui tient pile sur une page : aucune page vide ajoutée.
- Titre de section en bas de page : il passe avec la suite.
- Photo plus haute qu'une page : coupée une fois, pas de boucle infinie.
- Images qui se chargent après la mesure : la pagination se recalcule.
- Formulaire (dernière page) toujours dernier, index du formulaire du lien public recalculé après expansion.

---

### Task 1: Réglages de photo (`lib/photoFrame.ts`)

- Types `PhotoFrame { x, y, zoom, fit }` (x, y : 0–100, défaut 50 ; zoom 100–300, défaut 100 ; fit cover|contain)
  et `PhotoPlacement { pos: 'top'|'bottom'|'left'|'right'|'none'; size }` ; `parsePhotoFrame(raw)`,
  `parsePlacement(raw)` (null si absent), `frameImgStyle(frame)` (object-position, transform scale autour du point).
- Bornes de taille : gauche/droite 25–60 % de largeur (défaut 40) ; haut/bas 30–100 % de la largeur en hauteur
  (défaut 66).
- Tests : `lib/photoFrame.test.ts` (bornes, valeurs absurdes, défauts).

### Task 2: Coupures (`lib/flowBreaks.ts`)

- `computeBreaks(units, pageHeight, total): number[]` : débuts de pages (le premier est 0). Unités
  `{ top, bottom, kind: 'line'|'block'|'heading', lineHeight? }`. Coupure valide : aucune unité « block » à cheval ;
  une unité « line » à cheval seulement sur une frontière de ligne ; jamais juste après un titre suivi de contenu.
  Sans coupure valide : coupe à la hauteur de page. Rien qui tient : `[0]`.
- Tests : `lib/flowBreaks.test.ts` (tient pile, paragraphes, ligne, photo à cheval, titre orphelin, unité géante).

### Task 3: Données

- `BrochureItem.photo?: PhotoPlacement & { frame? }`, `BrochureCover.photoFrame?`, `about.photoFrame?`, bloc
  Prestation : `photo` accepte `bottom`, `photoSize?`, `photoFrame?` ; bloc Image : `frame?` (x, y, zoom).
- Lecture/nettoyage dans `parseBrochureContent`, `parseLayout`, `parseCover` ; `resolveItems` donne
  `ResolvedItem.placement` et `frame` ; conversions simple ↔ avancé gardent les réglages.
- Tests ajoutés dans `lib/brochure.test.ts`, `lib/brochureLayout.test.ts`.

### Task 4: Rendu

- `components/brochures/PhotoText.tsx` : `FramedPhoto` (rien sans URL, sauf repère en éditeur) et `PhotoText`
  (photo + corps selon place et taille). BrochurePages (trois styles, qui sommes-nous, couverture) et BlockPage
  l'utilisent. Magazine passe en flux (plus de grille à hauteur fixe).

### Task 5: Suite de page

- `components/brochures/useFlowPages.tsx` : mesureur caché, coupures (Task 2), recalcul sur ResizeObserver et
  `document.fonts.ready` ; renvoie les pages étendues (`{ page, slice?: { from, to } }`).
- `BrochurePageView` accepte `slice` ; lien public, aperçu simple, bandeau de l'éditeur avancé l'utilisent ; index du
  formulaire recalculé. Page en cours de l'éditeur avancé : repères de coupure en pointillés, alerte reformulée.
- e2e `e2e/brochures.spec.ts` : prestation très longue → une page de plus dans l'aperçu, pas de défilement interne ;
  prestation sans photo → aucun cadre.

### Task 6: Galerie et réglages

- Action `listBrochurePhotos()` (`server/brochures.ts`) : URL distinctes des brochures de l'entreprise (couverture,
  qui sommes-nous, prestations, blocs Image) et des photos du catalogue. Test dans `server/brochures.test.ts`.
- `PhotoPicker` (galerie + envoi + « Pas de photo ») remplace l'envoi direct de `PhotoField` ; `PhotoFrameEditor`
  (clic = point, zoom, photo entière) ; place et taille dans `ItemRetouch` et `BlockSettings`.
