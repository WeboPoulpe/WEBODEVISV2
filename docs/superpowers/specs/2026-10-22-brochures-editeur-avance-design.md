# Brochures — éditeur avancé (blocs) et formulaire plein écran — conception

Date : 2026-10-22. Suite du module Brochures (`docs/superpowers/specs/2026-10-22-brochures-design.md`, en production
depuis le commit `6eb6722`). Demandé par Maxence après l'avoir essayé.

## Intention

Le module actuel met en page tout seul : un style, des prestations cochées, et l'appli pagine. Maxence veut pouvoir
**décider de la disposition de chaque page** — « comme un Elementor » : glisser des blocs sur une page, les ranger en
colonnes, régler leur allure — tout en gardant la possibilité de faire vite. Ce qui compte pour lui, c'est **le
positionnement et la disposition**, pas de réécrire les textes : le contenu des prestations reste celui du catalogue,
à jour en direct (prix, photos), avec la retouche ponctuelle qui existe déjà.

Deux éditeurs pour une même brochure, au choix du traiteur :
- **simple** : celui d'aujourd'hui (style + prestations cochées, mise en page automatique) ;
- **avancé** : un constructeur de pages à blocs (maquette validée :
  `.superpowers/brainstorm/*/content/editeur-blocs.html`).

Et, quel que soit l'éditeur, **le formulaire de demande s'ouvre en plein écran sur téléphone** quand le lecteur
arrive à la dernière page (aujourd'hui il est à l'étroit dans la page du livre).

## Objectifs

1. **Formulaire plein écran sur téléphone** (lien public) : en arrivant sur la dernière page sur un écran étroit, le
   formulaire s'ouvre en plein écran, avec un bouton pour revenir au livre ; sur ordinateur, il reste dans la page.
   La saisie survit aux allers-retours (comme aujourd'hui).
2. **Choix de l'éditeur par brochure** : bascule « Éditeur simple / Éditeur avancé » dans l'éditeur.
3. **Éditeur avancé** :
   - **Pages** en vignettes (bandeau) : ajouter, dupliquer, supprimer, réordonner ; la page de formulaire est toujours la
     dernière et ne se supprime pas.
   - **Palette de blocs** à poser sur la page sélectionnée : Prestation, Titre, Texte, Image, 2 colonnes,
     3 colonnes, Séparateur, Espace. Pages spéciales disponibles : Couverture, Contact.
   - **Disposition** : un bloc se place avant/après un autre, dans une colonne, se déplace (glisser sur ordinateur,
     flèches monter/descendre partout), se duplique, se supprime.
   - **Réglages du bloc sélectionné** (panneau de droite) :
     - Prestation : la prestation du catalogue (liste), photo en haut / à gauche / à droite / aucune, afficher nom /
       texte / prix (chacun cochable), alignement, retouche du texte (fenêtre actuelle `ItemRetouch`).
     - Titre : texte, niveau (grand / moyen / petit), alignement.
     - Texte : texte riche (éditeur actuel `RichTextEditor`).
     - Image : photo (envoi, comme aujourd'hui), hauteur, recadrage (remplir / contenir).
     - Colonnes : nombre (2 ou 3), espacement.
     - Séparateur : couleur, largeur ; Espace : hauteur.
     - Pour tous : marges intérieures, fond (aucun ou une couleur de la palette), et pour les blocs à texte : police,
       taille, couleur du titre.
   - **Réglages de la page** : fond, police par défaut de la page.
   - **Aperçu** : la page éditée est celle du livre, à l'échelle ; le lecteur verra exactement ça.
4. **Passage entre les éditeurs** :
   - simple → avancé : l'éditeur avancé démarre des pages que l'éditeur simple produisait, converties en blocs (rien
     de perdu) ;
   - avancé → simple : avertissement (« la disposition faite à la main sera remplacée par la mise en page
     automatique ») puis confirmation ; la mise en page avancée est gardée de côté tant que la brochure existe, pour
     revenir à l'avancé sans tout refaire (choix de Claude).
5. **Contenu vivant** : un bloc Prestation lit le catalogue à l'affichage (nom, texte ou fiche, prix HT/TTC selon la
   brochure, photo) ; prestation supprimée du catalogue : bloc sauté sur le lien public, signalé dans l'éditeur.
6. **Page trop pleine** : si les blocs d'une page dépassent sa hauteur, l'éditeur le signale sur la page et sur sa
   vignette ; sur le lien public, la page défile à l'intérieur (pas de texte coupé).

## Hors sujet

- Positionnement libre au pixel (glisser n'importe où) : les blocs s'empilent et se rangent en colonnes, comme
  Elementor en mode « sections ».
- Bibliothèque de modèles de pages partagés entre brochures, annuler/rétablir multiple (un « annuler » simple suffit
  si le constructeur le juge utile), animations par bloc, polices importées.
- Éditeur avancé pour les devis WeboWord.

## À ne surtout pas faire

- Modifier le catalogue depuis la brochure (inchangé).
- Casser les brochures existantes : une brochure en éditeur simple s'affiche comme aujourd'hui.
- Exposer sur le lien public autre chose qu'aujourd'hui (pas d'identifiant de prestation, pas de prix masqués).
- Un rendu « trop IA » ou des réglages en double ; direction artistique WeboDevis.
- Une dépendance lourde (disque de dev presque plein) : glisser-déposer natif (HTML5) + flèches.

## Contraintes

- Même pile que le module (voir sa conception). Migration additive, appliquée avant l'envoi sur `main`.
- Écriture des brochures uniquement par les actions serveur (règle `/api/db` en lecture seule), HTML nettoyé côté
  serveur, comme aujourd'hui.
- Le rendu des pages (lien public, aperçu, éditeur) doit être le même composant, pour que le lecteur voie ce que le
  traiteur a construit.

## Décisions prises avec Maxence

- Disposition des pages plutôt que réécriture des textes ; contenu des prestations vivant. (Maxence)
- « Comme un Elementor » ; maquette validée. (Maxence)
- Deux éditeurs au choix, simple et avancé. (Maxence)
- Formulaire en dernière page, plein écran sur téléphone. (Maxence)

## Choix de Claude (à vérifier en relisant)

- **Données** : nouvelles colonnes `brochures.editor_mode` (`simple` | `advanced`, défaut `simple`) et
  `brochures.layout` (jsonb, null tant que l'éditeur avancé n'a pas servi). `layout` = `{ pages: LayoutPage[] }` ;
  `LayoutPage = { id, kind: 'cover' | 'blocks' | 'contact' | 'form', background?, font?, blocks: Block[] }` ;
  `Block` = union discriminée par `type` (`prestation`, `title`, `text`, `image`, `columns`, `separator`, `spacer`),
  chacun avec `id` et ses réglages ; `columns` contient `cols: Block[][]` (pas de colonnes dans des colonnes).
- **Lecture publique** : en mode avancé, les pages viennent de `layout` (prestations résolues à l'affichage, comme
  `resolveItems`) ; en mode simple, de `paginateBrochure` comme aujourd'hui. Même `Flipbook`.
- **Couverture, contact, formulaire** restent des pages spéciales (réglages actuels : titre, sous-titre, photo ;
  coordonnées) ; seules les pages `blocks` reçoivent des blocs.
- **Conversion simple → avancé** : chaque page `items` produite par `paginateBrochure` devient une page `blocks` (titre
  de section → bloc Titre ; prestations → blocs Prestation, en colonnes selon le style : Carte → liste, Magazine →
  photo à gauche/droite en alternance) ; « qui sommes-nous » → bloc Titre + Texte + Image.
- **Téléphone** : éditeur avancé utilisable (flèches, palette dans un menu, panneau de réglages en bas) mais pensé
  pour l'ordinateur.
- **Hauteur de page** : mesurée dans le navigateur (éditeur) pour l'alerte « page trop pleine ».

## Choix de Claude après relecture (à vérifier en relisant)

- **Une seule source de vérité selon l'éditeur actif.** En mode avancé, `layout` fait foi ; en mode simple,
  `content.sections` fait foi. Ce que le traiteur a fait dans un éditeur n'est jamais perdu en changeant d'éditeur,
  seule la disposition l'est :
  - avancé → simple : `content.sections` est reconstruit depuis les blocs Prestation, dans l'ordre des pages (une
    section par bloc Titre rencontré, sinon « Nos prestations »), retouches comprises. `layout` est gardé tel quel.
  - simple → avancé, sans `layout` gardé : conversion des pages simples en blocs (voir plus haut).
  - simple → avancé, avec un `layout` gardé : la fenêtre propose « Reprendre ma mise en page avancée » (les
    prestations ajoutées en mode simple depuis s'ajoutent sur une page à la fin, celles retirées disparaissent de la
    mise en page) ou « Repartir de la mise en page simple » (nouvelle conversion).
- **Le style reste, comme thème.** En mode avancé, le choix Éditorial / Carte / Magazine reste visible sous le nom
  « Thème » : il donne l'allure de la couverture, du contact et du formulaire, et les réglages par défaut des blocs.
  Les réglages d'un bloc ou d'une page passent devant.
- **Texte d'un bloc Prestation : « complet » ou « court »** (extrait d'environ 150 caractères). La conversion reprend
  ce que le style montrait : complet en Éditorial, court en Carte et Magazine (même rendu, pas d'alerte « trop pleine »).
- **Pages spéciales en mode avancé** : couverture facultative, une au plus, toujours en premier ; contact facultatif,
  un au plus, avant le formulaire ; formulaire toujours en dernier, non supprimable. Le serveur refuse le reste.

## Laissé au constructeur

- Le découpage exact des composants, la mise en œuvre du glisser-déposer natif, la palette de couleurs proposée (celle
  de la direction artistique), les tailles de police proposées, l'emplacement exact des contrôles, l'ordre des lots
  (le formulaire plein écran en premier, livrable seul).
