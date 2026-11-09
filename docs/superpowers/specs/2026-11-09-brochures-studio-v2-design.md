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

## Lot 3 (2026-11-09) : limites corrigées

- **Lecture page par page** : chaque page est suivie par son identifiant (migration 0046, lectures notées par rang
  effacées) : une page déplacée garde ses chiffres, une page inconnue est ignorée ; vignette de la page dans le tableau.
- **PDF** : export réservé à l'entreprise (`/brochures/<id>/pdf`), même lien désactivé ; le dernier changement est
  enregistré avant ; le nom de la brochure est proposé comme nom de fichier ; consignes d'impression affichées.
- **Webo** réécrit le passage sélectionné pendant la saisie (le reste du texte ne bouge pas), ou tout le texte.
- **Téléphone** : barre d'outils sur une ligne qui défile, menus Lien et Webo sous la barre ; bouton « Plusieurs »
  pour choisir plusieurs éléments au doigt.
- **Ensemble redimensionnable** : poignées aux coins d'une sélection ou d'un groupe (proportions gardées, textes et
  traits suivent).

Limite restante : le PDF passe par la fenêtre d'impression du navigateur (pas de fichier créé directement).

## Lot 4 (2026-11-09) : vendre, suivre, travailler à plusieurs, diffuser

Demandé par Maxence : toute la liste proposée.

- **Vendre plus** : bouton « Je veux ce menu » sous chaque prestation (option du lien), barre « Faire ma demande » ;
  sélection et estimation instantanée (invités × prix affichés) dans le formulaire ; prestations choisies gardées
  avec la demande (migration 0047, figées au catalogue : nom, prix HT…), visibles dans l'email et la fiche
  prospect, et lignes du devis créé depuis Prospects ou par Webo.
- **Liens** (migration 0048) : par source (Instagram, salon, site…) ou par client (message d'accueil, `{{client}}`
  remplacé par son nom), chacun avec ouvertures, demandes, expiration, code d'accès ; expiration et code aussi sur le
  lien principal (empreinte du code, cookie signé 30 jours après saisie). Envoi par email avec lien personnalisé.
  Prospects dit par quel lien la demande est arrivée.
- **Notifications push** au traiteur : ouverture et arrivée au formulaire, une par demi-heure et par lien ; les
  aperçus de l'entreprise ne comptent pas. Coupables par brochure.
- **Aperçu du lien partagé** (WhatsApp, Facebook…) : titre (ou message d'accueil), entreprise, photo de couverture ;
  rien de privé si un code est demandé.
- **Éditeur** : annuler / rétablir gardés dans le navigateur ; versions (migration 0049 : automatiques au plus toutes
  les 30 min, nommées, retour à l'une d'elles) ; commentaires (page ou brochure) ; validation par un collègue avant
  l'envoi (à refaire après une modification) ; modèles de pages de l'entreprise ; vidéo courte et GIF ; QR code
  (élément, et QR de chaque lien en PNG ou SVG).
- **Webo** : « Fais-moi une couverture » (mise en page, thème, photo de l'entreprise, titres ; 1 WeboCoin) — Webo
  ne dessine pas d'image, il choisit parmi les photos de l'entreprise ; version anglaise en un clic (copie traduite,
  mise en page gardée, 1 WeboCoin par 10 textes).
- **Diffusion** : intégration au site (`/embed/b/<jeton>`, code iframe à copier) ; images pour Instagram (4:5, 9:16,
  1:1, page entière), faites dans le navigateur.

Limites : les notifications demandent qu'elles soient activées sur l'appareil (Paramètres) et les clés VAPID du
serveur ; l'export d'images peut échouer si une photo est hébergée sur un site qui refuse d'être lu par une autre
page (photos envoyées dans l'app : pas de souci) ; le PDF passe toujours par la fenêtre d'impression.
