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
