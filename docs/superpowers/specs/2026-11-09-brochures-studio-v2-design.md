# Brochures V2 : le Studio

Demandé par Maxence le 2026-11-09 : « une v2 de la brochure (garder l'actuelle active), un mix entre WeboWord et
Canva, et le visuel sur téléphone doit faire tout le téléphone ». Choix validés avec lui : pages **A4** qui remplissent
la largeur du téléphone (le fond de la page remplit le reste de l'écran), et le Studio comme **3e éditeur** d'une
brochure (simple / avancé / Studio), l'existant restant le choix par défaut.

## Ce qui est fait

- **Données** : `brochures.studio` (jsonb) et `editor_mode = 'studio'` (migration 0044, additive). Module sans base :
  `lib/brochureStudio.ts` (lecture bornée, nettoyage HTML côté serveur, modèles de pages, composition initiale,
  résolution des prestations). Mesures en centièmes de la largeur de page (A4 : 100 × 141,4) : rendu identique
  partout (cqw).
- **Éléments posés librement** : texte riche, photo (cadrage, arrondi, bordure), forme (rectangle, cercle, ligne,
  cadre), prestation du catalogue (vivante : nom, texte court/complet, prix, photo en haut/gauche/droite, retouche
  propre à la brochure), formulaire (unique, sur la dernière page, qu'on place et dimensionne).
- **Côté Canva** : glisser, poignées de redimensionnement, rotation, repères d'alignement magnétiques (Alt : sans),
  calques, verrou, dupliquer, copier/coller, transparence, position au millimètre, alignement sur la page, modèles de
  pages, galerie de photos, fond de page (couleur, photo), bandeau des pages.
- **Côté WeboWord** : on écrit directement dans la page (double-clic ou « Écrire ») avec une barre de mise en forme :
  police, taille en points, gras/italique/souligné, couleur, alignement et justification, listes, majuscules,
  interligne, espacement des lettres, effacer la mise en forme. Annuler / rétablir par geste.
- **Lien public** (`/b/<jeton>`) : sur téléphone, plein écran, la page prend toute la largeur ; la couleur de fond (ou
  la photo de fond / pleine page, floutée) remplit le haut et le bas, la barre du navigateur prend la couleur de la
  page ; on glisse ou on touche les bords pour tourner (barre d'avancement façon story). Le formulaire s'ouvre en
  plein écran en arrivant au bout. Sur ordinateur, le livre en double page. Aucun identifiant de prestation exposé.
- **Passage d'un éditeur à l'autre** : vers le Studio la première fois, pages composées depuis la brochure
  (couverture, qui sommes-nous, prestations deux par deux, contact, formulaire) ; ensuite reprises telles quelles.
  Retour au simple/avancé sans rien perdre. « Recomposer depuis la brochure » repart de zéro. Création directe dans le
  Studio depuis « Nouvelle brochure ». Duplication : le Studio est copié.
- **Webo** lit une brochure Studio mais ne modifie pas encore ses pages (nom, langue, prix seulement).

## Limites

- Une seule sélection à la fois (pas de sélection multiple ni de groupes).
- Le texte d'une prestation trop long pour son cadre est coupé (signalé « Texte coupé » dans l'éditeur).
- Éditeur utilisable sur téléphone (toucher, glisser, panneaux sous la page) mais pensé pour l'ordinateur.

## Lot 2 (2026-11-09) : « fais tout »

Demandé par Maxence après la liste d'améliorations proposée : tout est fait.

- **Sélection multiple et groupes** : Maj+clic, cadre de sélection tiré sur la page, Ctrl+A ; déplacer ensemble,
  aligner (bords, milieux), répartir, grouper / dégrouper (Ctrl+G, Ctrl+Maj+G), calques, dupliquer et supprimer
  pour tous. Un clic sur un élément groupé prend le groupe ; double-clic, l'élément seul.
- **Texte de prestation qui tient** : réduit automatiquement (jusqu'à 55 %), mesuré dans le navigateur ; bouton
  « Agrandir le cadre pour tout afficher ».
- **Thème et styles** (à la WeboWord) : 5 thèmes (Sapin et terracotta, Noir et or, Champêtre, Poudré, Épuré) qui
  habillent toute la brochure ; styles Titre 1, Titre 2, Sur-titre, Paragraphe modifiables une fois pour toute la
  brochure ; un texte relié à un style le suit, le mettre en forme à la main l'en détache. Les couleurs du thème
  passent en tête des nuanciers. Les pages avec photo de fond ou photo pleine page gardent leurs couleurs.
- **Logo** de l'entreprise : dans « Photos », repris par les couvertures et la page contact.
- **Glisser-déposer** depuis le panneau (ordinateur) ; une photo lâchée sur une photo la remplace.
- **Brochures complètes** Mariage, Entreprise, Cocktail (thème, textes types, prestations) : dans « Modèles »,
  à la création d'une brochure, et par Webo.
- **Déco** : ornements groupés (filet et motif, double filet, pointillés, coins), 70 pictogrammes au trait ;
  forme Arche ; traits pleins, tirets, points, doubles ; ensembles de textes (sur-titre + titre + filet…).
- **Effets photo** : filtres (N&B, sépia, chaud, froid, doux), photo ronde ou en arche ; ombre portée sur tout élément.
- **Grille (5 mm) et règles** en millimètres, avec aimantation à la grille ; **zoom** 50 à 250 %.
- **Liens** dans les textes (site, email, téléphone), ouverts dans un nouvel onglet sur le lien public.
- **Webo dans le texte** : corriger, reformuler, raccourcir, plus chaleureux, plus élégant, traduire en anglais ;
  1 WeboCoin par texte (prix d'une traduction de fiche), rendu si l'appel échoue. Correcteur du navigateur pendant
  la saisie.
- **Lecture page par page** (table `brochure_page_stats`, migration 0045) : vues, temps moyen, atteinte par page,
  envoyées par le lecteur (`/api/b/<jeton>/stats`), sans compter l'entreprise ; remise à zéro possible.
- **Boutons Appeler et WhatsApp** sur le lien (numéro de l'entreprise), au choix.
- **Export PDF** : `/b/<jeton>/pdf`, une feuille A4 par page (sans le formulaire), impression ouverte seule.
- **Apparition en douceur** des éléments à l'affichage d'une page (désactivable ; respecte « moins d'animations »).
- **Webo** lit les pages du Studio, y change des textes, ajoute titres, textes, prestations et pages (modèles),
  en retire ; et crée une brochure complète (`propose_brochure_create`).

Limites : le PDF passe par la fenêtre d'impression du navigateur (« Enregistrer en PDF ») ; la lecture page par page
suit l'ordre actuel des pages (remettre à zéro après les avoir réorganisées) ; Webo réécrit un texte entier, pas une
partie sélectionnée.
