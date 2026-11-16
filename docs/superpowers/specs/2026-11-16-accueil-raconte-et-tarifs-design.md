# Accueil raconté par Julien, page Tarifs en trois étapes, fin de l'annuel

Date : 16 novembre 2026. Sortie visée : avant la version 0.1 du 1er décembre 2026.

## Pourquoi

Un traiteur a relu le site. Son retour : trop d'informations, il s'y perd, la page ne mène nulle part (pas de tunnel de vente), et la page Tarifs n'est pas compréhensible. Il a écrit sur une feuille ce qu'il aurait voulu lire : ce que fait le logiciel en trois colonnes, « mise en service 1 250 € HT puis 100 € HT/mois, sans engagement », ce que comprend la mise en service, et « essayez gratuitement la démo ».

Maxence a décidé :

- l'accueil raconte une histoire du point de vue d'un traiteur (« lundi, je me lève, j'ai 6 demandes via la brochure »), avec le tarif à la fin ;
- les pages détaillées (fonctionnalités, pour qui, guides) sont gardées telles quelles ;
- la page Nouveautés est masquée pour l'instant : le produit sort le 1er décembre, tout y est déjà, ce ne sont pas des nouveautés ;
- un personnage dessiné, Julien, porte l'histoire (la vraie 3D a été écartée pour la sortie) ;
- l'abonnement annuel est retiré ;
- le contenu de la mise en service devient celui de la feuille du traiteur.

## Maquettes validées

Les maquettes HTML validées par Maxence sont la référence pour le déroulé, les textes et l'esprit. Elles sont dans `.superpowers/brainstorm/1041-1794814935/content/` (dossier ignoré par git, présent sur le poste) :

- `accueil-histoire-v3-personnage.html` : l'accueil, avec Julien ;
- `tarifs.html` : la page Tarifs.

Ce sont des maquettes : polices, espacements et petits encadrés blancs sont approximatifs. Le vrai site garde ses polices, ses classes (`site-h1`, `site-h2`, `site-body`, `container`, `sectionGap`, `bg-forest`, `site-dark`, `site-reveal`) et sa direction artistique : crème, vert sapin, terracotta, rien qui fasse « trop IA », pas de bouton en double côte à côte.

## Buts

1. Un traiteur comprend en une lecture ce que le logiciel change dans sa semaine, ce que ça coûte, et clique sur « Essayer la démo ».
2. Un seul prix, dit de la même façon partout : 1 250 € HT le premier mois (mise en service et premier mois compris), puis 100 € HT par mois, sans engagement.
3. Une seule action demandée au visiteur : la démo gratuite.

## Hors périmètre

- La 3D, une vidéo, des photos de mise en scène.
- La refonte des pages fonctionnalités, pour qui, guides, contact, démo.
- Tout changement des prix dans Stripe ou de la table des abonnements.
- L'annuaire (branche `feat/annuaire-lot1`, mise de côté).

## Ce qui serait un échec

- Une page d'accueil aussi longue à lire qu'avant, ou Julien qui prend plus de place que le logiciel.
- Julien présenté comme un vrai client. Il est un personnage, et la page le dit.
- Un prix qui se lit de deux façons selon la page (site, écran Abonnement, Stripe, image de partage).
- Une page lourde ou saccadée sur téléphone : les traiteurs lisent sur leur téléphone.

## 1. La nouvelle offre (source unique : `lib/pricing.ts`)

Montants inchangés : `MONTHLY_HT = 100`, `FIRST_MONTH_HT = 1250`, `SETUP_HT = 1150`. Le premier mois à 1 250 € HT comprend la mise en service et le premier mois d'abonnement.

**La formulation qui fait foi, partout** *(choix de Claude)* : « 1 250 € HT le premier mois, mise en service comprise, puis 100 € HT par mois, sans engagement ». On n'écrit jamais « mise en service 1 250 € » seul (la maquette d'accueil le fait dans la ligne de prix de l'ouverture et dans le bloc tarif : à corriger), ni « 1 150 € » sur le site. Le paiement Stripe garde ses deux lignes (mise en service 1 150 € et abonnement 100 €) : leur total fait bien 1 250 €. `PlanCards` annonce ce total avant le paiement.

`SETUP_INCLUDES` devient :

- 3 séances de formation de 2 h
- Vos infos d'entreprise et votre première facture, préparées avec vous
- 6 modèles de devis : mariage, entreprise, à emporter
- Vos prestations essentielles, déjà créées

Ajouter une liste `MONTHLY_INCLUDES` (elle remplace `INCLUDED` de la page Tarifs) :

- Tout le logiciel, sur PC et smartphone
- Webo, l'assistant, avec 200 WeboCoins par mois
- SAV et mises à jour
- Vos données exportables à tout moment

Ajouter `FIRST_YEAR_HT = FIRST_MONTH_HT + 11 * MONTHLY_HT` (2 350) et `NEXT_YEAR_HT = 12 * MONTHLY_HT` (1 200).

Options sur devis (liste `EXTRAS`) : la reprise des clients et des devis déjà signés ; la création des brochures par l'équipe. **L'import des clients n'est plus compris dans la mise en service** : toute phrase qui le dit doit disparaître (accueil, Tarifs, `PlanCards`, description du produit Stripe dans `server/billingActions.ts` ligne 82, métadonnées, image de partage si elle le mentionne).

Supprimer `YEARLY_HT` et `YEARLY_BONUS` une fois qu'ils n'ont plus d'usage.

## 2. Fin de l'abonnement annuel

- **Site** : plus aucune mention de l'annuel, du mois offert ni des bonus annuels.
- **Écran d'abonnement** (`components/billing/PlanCards.tsx`, utilisé par `/abonnement` et Paramètres > Abonnement) : plus de choix de formule. Un seul bloc : le prix mensuel, la phrase du premier mois quand `setupDue`, le bouton « S'abonner ».
- **`components/billing/SubscriptionManager.tsx`** : retirer le bouton et la confirmation « Passer en annuel ».
- **Serveur** (`server/billingActions.ts`) : `startCheckout` refuse `'annuel'` (« Formule inconnue. ») ; l'action `switchToAnnual` est supprimée. *(choix de Claude)*
- **Ce qui reste** : le type `Plan = 'mensuel' | 'annuel'`, `planOfPrice`, la synchronisation Stripe et l'affichage d'un abonnement annuel existant (libellé, montant). Un compte déjà en annuel continue de fonctionner et d'être affiché correctement. `planAmount('annuel')` doit donc toujours rendre un texte juste (1 100 € HT / an) : garder ce montant comme constante locale à l'affichage des abonnements existants. *(choix de Claude)*
- Aucune migration de base, aucun changement des prix dans Stripe.
- **À faire à la main par Maxence** : le portail de facturation Stripe (`openBillingPortal`) se règle dans le tableau de bord Stripe, pas dans le code. Vérifier qu'il ne propose pas de changer de formule, sinon un abonné pourrait encore passer en annuel par là. *(choix de Claude : réglage manuel plutôt qu'une configuration de portail dans le code)*
- Les tests existants (`billingActions.test.ts`, `stripeSync.test.ts`, `subscriptionView.test.ts`, `adminBilling.test.ts`) sont mis à jour : les cas « nouvel abonnement annuel » et « passer en annuel » deviennent des refus ; les cas « abonné annuel existant » restent.

## 3. L'accueil (`app/site/page.tsx`)

La page est réécrite. Ordre des blocs :

1. **Ouverture** (panneau vert) : « Lundi, 7 h 30 » ; titre « Six demandes sont arrivées ce week-end. » ; « Moi, c'est Julien, traiteur à Troyes. Je dormais. Ma brochure, elle, a travaillé. Voici ma semaine avec WeboDevis. » ; bouton démo ; ligne de prix. À droite, Julien (café, téléphone) et un téléphone verrouillé où six notifications de demandes apparaissent l'une après l'autre.
2. **Barre de la semaine**, collante sous le menu, qui suit le défilement : Lundi 7 h 30, Lundi 9 h, Mercredi, Jeudi, Vendredi, Samedi, Lundi suivant, Le tarif. Défilable horizontalement sur téléphone.
3. **Lundi 9 h, au bureau** : « À 9 h 30, les six devis sont partis. » Un devis où l'on change le nombre de convives et le prix suit. Julien à son bureau. Lien : les devis.
4. **Mercredi, dans le camion** : « Mon téléphone vibre. Léa a signé. » Le message de la cliente, puis « Événement créé ». Le camion « Julien Traiteur » arrive par la gauche. Lien : signature en ligne et événements.
5. **Jeudi, avant le marché** (panneau vert) : « Léa rappelle : ils seront 132. » Le calcul des courses par fournisseur, avec le curseur de couverts. Julien et sa caisse de légumes. Lien : liste de courses.
6. **Vendredi, la veille** : « Personne ne m'appelle pour redemander l'adresse. » Trois téléphones d'extras avec leur mission. Julien, mains derrière la tête. Lien : extras.
7. **Samedi, on charge** : « Je coche, je sers, je ne cherche rien. » Une checklist qui se coche. Julien et son plateau. Lien : événements.
8. **Lundi suivant, 8 h** : « La facture part en un clic. Et je sais ce que j'ai gagné. » La marge en très grand, facturé / encaissé / reste à payer, puis « Et il est 8 h 05 : trois nouvelles demandes sont arrivées ce week-end. » Lien : factures. Juste dessous : « Julien est un personnage : sa semaine et ses chiffres sont un exemple. »
9. **Le témoignage réel** de Convivial Event (`Testimonial`, inchangé) : après l'histoire inventée, la parole d'un vrai traiteur. *(choix de Claude : absent de la maquette, gardé parce que c'est la seule preuve réelle de la page)*
10. **Le tarif** (panneau vert) : « Et pour commencer ? Vous ne partez pas d'un logiciel vide. » Deux blocs : « 1. Au démarrage, une seule fois : 1 250 € HT » avec `SETUP_INCLUDES` ; « 2. Ensuite : 100 € HT par mois, sans engagement » avec `MONTHLY_INCLUDES`. Bouton démo, lien vers la page Tarifs, et la ligne des options sur devis.
11. **Pour aller plus loin** : trois colonnes de liens, comme sur la feuille du traiteur : Gestion commerciale, Organisation, Gestion. Elles pointent vers les pages fonctionnalités existantes, plus un lien vers les guides.
12. **Questions fréquentes**, courte : cinq questions au plus (à qui ça s'adresse, combien ça coûte, faut-il installer quelque chose, puis-je essayer avant, puis-je garder mes anciens devis). La réponse sur le prix n'évoque plus l'annuel ni l'import des clients compris. *(choix de Claude : gardée pour le référencement, raccourcie)*

Chaque jour : une étiquette (jour, heure, lieu), un titre, deux phrases au plus, parfois une phrase « Avant, … » en italique, **un seul lien** vers la page détaillée, et un visuel.

Sortent de l'accueil (les pages qu'ils annonçaient restent accessibles par le menu et le pied de page) : le bandeau des occasions, les blocs Brochures et Webo, les écrans du téléphone à faire défiler, la grande liste « Tout ce que fait WeboDevis », « Pour quel traiteur ? », le bloc de la date de sortie, les couvertures de guides. La date de sortie reste dite en une ligne discrète dans l'ouverture.

Les données structurées (organisation, site, logiciel, fil d'Ariane, FAQ) et les métadonnées restent, avec une description mise à jour.

### Les visuels de chaque jour

Réutiliser d'abord ce qui existe dans `components/site/` quand ça raconte la même chose (`CoursesCalculator` pour jeudi, `QuotePreview`, les écrans `Phone*`, `preview-kit`), plutôt que de refaire des encadrés. Là où rien n'existe (téléphone verrouillé aux notifications, message de la cliente, checklist qui se coche, marge qui monte), créer un petit composant dédié. Les composants qui ne servent plus nulle part après la réécriture sont supprimés.

Chiffres de l'histoire : cohérents d'un jour à l'autre (même mariage, Léa et Hugo, 120 puis 132 couverts, samedi 14 juin, mêmes montants entre le devis, la facture et la marge). Ce sont des exemples, au choix du constructeur.

### Julien

- Un composant SVG, dessiné dans le code, sans fichier externe ni bibliothèque : un seul personnage, plusieurs poses (café et téléphone, au bureau, au volant du camion, caisse de légumes, mains derrière la tête, plateau, poing levé). La maquette v3 contient un premier jet du dessin et des poses, à reprendre et à soigner.
- À plat, aux couleurs du site (tablier terracotta, chemise blanche), sur une pastille de couleur.
- Vivant sans être agité : légère respiration, clignement des yeux, vapeur du café, camion qui entre. Tout s'arrête avec `prefers-reduced-motion`.
- Décoratif pour les lecteurs d'écran (`aria-hidden`), sauf une description à l'ouverture.
- Sur téléphone, il reste visible à chaque jour, en plus petit, sans pousser le texte sous la ligne de flottaison de l'ouverture : titre, bouton démo et prix passent avant lui.

### Mouvement et poids

Apparitions au défilement avec le mécanisme existant (`site-reveal`). Les parties interactives (convives, couverts, barre de la semaine, checklist, marge) sont de petits composants client ; le reste de la page reste rendu côté serveur. Aucune nouvelle dépendance.

## 4. La page Tarifs (`app/tarifs/page.tsx`)

Selon `tarifs.html` :

1. Ouverture : « Un seul prix, en trois étapes. » et une phrase.
2. Trois cartes numérotées : **1. Aujourd'hui : gratuit** (la démo, avec le bouton) ; **2. Le premier mois, une seule fois : 1 250 € HT** (1 500 € TTC, mise en service et premier mois compris, `SETUP_INCLUDES`) ; **3. Ensuite, chaque mois : 100 € HT** (120 € TTC, sans engagement, `MONTHLY_INCLUDES`).
3. Une ligne « Votre première année, tout compris : 2 350 € HT », avec le détail et « les années suivantes : 1 200 € HT ».
4. « En option, sur simple devis » : `EXTRAS` et le bouton « Demander un devis ».
5. Quatre questions : pourquoi une mise en service, suis-je engagé, les prix sont-ils hors taxes, les brochures sont-elles comprises.
6. Fin : « Le mieux, c'est de l'essayer. » et le bouton démo.

Tous les montants viennent de `lib/pricing.ts`. Titre, description et données structurées mis à jour.

La démo demande un nom, un email et un téléphone avant de s'ouvrir : écrire « gratuite, sans carte bancaire », jamais « sans inscription ».

## 5. La page Nouveautés, masquée

Décision de Maxence : on la masque pour l'instant. Elle reviendra quand il y aura de vraies nouveautés après la sortie.

- Un réglage dans `lib/site/config.ts` (par exemple `SHOW_RELEASES = false`) commande tout, pour la rallumer en une ligne. *(choix de Claude)*
- Quand il est éteint : la page `/nouveautes` répond « page introuvable » ; elle sort du menu (`MENU_LINKS`), du pied de page, du sitemap ; le lien « Version 0.1 le 1er décembre » en pied du menu Fonctionnalités (`RELEASE_NOTE`) disparaît ; plus aucun lien « Voir ce qu'elle contient » ni « Ce que contient la version 0.1 ». *(choix de Claude : introuvable plutôt que simplement non liée, pour qu'elle ne soit plus référencée)*
- Le code et le contenu de la page sont gardés.
- La date de sortie peut rester dite en une phrase dans l'ouverture de l'accueil et dans la FAQ, sans lien, et sans renvoyer à « la page Nouveautés ».

## 6. Ailleurs sur le site

Relire et aligner tout ce qui cite le prix, l'annuel ou le contenu de la mise en service : `app/site/opengraph-image.tsx`, `lib/site/schema.ts` (offre du logiciel), les pages fonctionnalités et « pour qui » si elles en parlent, le menu (`MenuAsides`). Une recherche sur « annuel », « mois offert », « import de vos clients », « Deux modèles » ne doit plus rien renvoyer dans `app/`, `components/` et `lib/`, hors affichage des abonnements annuels existants.

## Ordre de livraison *(choix de Claude)*

Deux lots, pour que le plus sûr ne dépende pas du plus risqué :

1. **Lot 1, l'offre** : `lib/pricing.ts`, fin de l'annuel (site, écran Abonnement, serveur, tests), page Tarifs, page Nouveautés masquée, alignement des textes ailleurs. Peut partir en ligne seul.
2. **Lot 2, l'accueil raconté** : la page, ses visuels, Julien. Maxence la valide à l'œil sur son poste, sur téléphone et sur ordinateur, avant toute mise en ligne.

Si le dessin de Julien ne convainc pas à temps pour le 1er décembre, l'accueil sort avec l'histoire et ses visuels, sans le personnage : la page doit tenir debout sans lui.

## Contraintes

- `next build` et les tests passent avant toute mise en ligne ; `main` part en production sur Vercel, donc rien n'est poussé sans l'accord de Maxence.
- Le dossier des fichiers statiques s'appelle `Public/` (majuscule) : `git add` avec le chemin `public/...` complet.
- Textes en français, typographie du site (espaces insécables, guillemets français), pas de tiret long dans les phrases.
- Le témoignage reste celui de Convivial Event, sans jamais afficher le nombre de bêta-testeurs.

## Laissé au constructeur

- Le découpage en composants et leurs noms.
- Le dessin final de Julien et le détail des animations.
- Les chiffres d'exemple de l'histoire, tant qu'ils sont cohérents.
- Le choix, jour par jour, entre réutiliser un aperçu existant et en créer un.
- La formulation exacte des cinq questions de l'accueil.
