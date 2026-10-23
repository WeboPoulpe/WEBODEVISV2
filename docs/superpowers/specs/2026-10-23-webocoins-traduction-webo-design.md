# WeboCoins et traduction par Webo — conception

Date : 2026-10-23. Statut : à valider par Maxence.

## Intention

WeboDevis va intégrer une IA, **Webo** (Claude, via l'API Anthropic), d'abord pour la traduction, plus tard comme
assistant capable de préparer devis, factures et prestations (projet séparé). Chaque usage de Webo coûte de l'argent à
Maxence ; il doit en **gagner** quand un traiteur s'en sert davantage. D'où une monnaie interne, le **WeboCoin**, au
ton ludique (« un peu le marketing TikTok ») : le traiteur reçoit des pièces chaque mois, en dépense en utilisant Webo,
et pourra en racheter (paiement Stripe, projet suivant).

Ce document couvre les deux premières marches de la feuille de route :

1. **Le portefeuille de WeboCoins** (sans paiement pour l'instant).
2. **La traduction au choix : gratuite (MyMemory) ou par Webo**, payée en WeboCoins.

Suivront, chacun avec sa propre conception : 3. recharges par carte (Stripe) ; 4. l'assistant Webo et ses sous-agents.

## Objectifs

- Un solde de WeboCoins par entreprise, visible du traiteur, avec l'historique de ce qui l'a fait bouger.
- 200 WeboCoins offerts chaque mois, dépensés en premier, non cumulables d'un mois sur l'autre.
- La traduction des prestations en anglais (WeboWord, fiche prestation) au choix : gratuite, ou par Webo pour
  1 WeboCoin par fiche, nettement meilleure (fiche entière, mise en forme gardée, vocabulaire de cuisine).
- Dans l'admin, pour Maxence : le coût réel Anthropic, ce que les traiteurs ont dépensé, la marge ; les réglages
  (prix des actions, pièces offertes par mois) ; offrir des pièces à un compte.

## Non-objectifs (pour ce projet)

- Pas de paiement ni de recharge par carte (projet 3). Seules sources de pièces ici : l'allocation mensuelle et les
  pièces offertes par l'admin.
- Pas d'assistant, pas de bulle de discussion (projet 4). Mais le portefeuille doit déjà savoir débiter une action
  « au coût réel × coefficient », pour que le projet 4 n'ait qu'à l'appeler.
- Pas de traduction vers d'autres langues que l'anglais.

## Anti-objectifs (ce qui serait un échec même si ça marche)

- Une clé API visible côté navigateur, ou un appel à Claude possible sans session.
- Un traiteur bloqué : solde vide ou Claude en panne ne doivent jamais empêcher de traduire (on passe alors en gratuit,
  avec un message) ni de travailler.
- Un débit sans service rendu (traduction échouée mais pièce prise), ou un double débit sur un double clic.
- Un solde qui peut devenir négatif, ou deux débits simultanés qui dépensent la même pièce.
- Un style « crypto » ou criard : la pièce reste dans la direction artistique de WeboDevis (crème, vert sapin,
  terracotta ; doré discret pour la pièce).
- Des prix publics : jamais de prix sur le site vitrine (règle existante). Les WeboCoins sont un sujet de l'application.

## Décisions prises avec Maxence

- **Nom de l'IA : Webo.** **Monnaie : le WeboCoin**, une pièce ronde avec un **W**.
- **1 € = 100 WeboCoins** (1 pièce = 1 centime) ; nombres entiers, pas de fraction de pièce.
- **200 WeboCoins offerts chaque mois**, non reportés, dépensés avant les pièces achetées ou offertes.
- **Qui les reçoit** : toutes les entreprises sauf les comptes de démonstration (0 pièce du mois). Dans l'admin, le
  montant mensuel se règle aussi compte par compte (par exemple 0 pour couper, ou plus pour un client important) ; sans
  réglage propre, le compte suit la valeur générale.
- **Traduction au choix** gratuite / Webo ; **Webo = 1 WeboCoin par fiche traduite**, prix fixe.
- Plus tard (assistant) : action débitée au **coût réel × coefficient réglable**, arrondie à la pièce supérieure.
- Les WeboCoins ne servent que dans WeboDevis, ne se revendent pas, ne se remboursent pas en euros (crédit prépayé).
- Modèle de traduction : **Claude Haiku 5.5** (`claude-haiku-5-5`, 0,10 $ / 0,50 $ par million de jetons), le meilleur
  rapport qualité/prix pour ce travail ; coût estimé 0,1 à 0,2 centime par fiche.
- Ordre : portefeuille, traduction, Stripe, assistant.

## Le portefeuille

**À qui** : à l'entreprise (le compte propriétaire et ses membres partagent le même solde), comme les autres données
d'équipe de WeboDevis.

**Deux réserves** dans un même solde affiché :
- *pièces du mois* : remises à 200 au premier usage de chaque mois civil (heure de Paris) — pas besoin de tâche
  planifiée ; ce qui reste du mois précédent est perdu ;
- *pièces gardées* : offertes par l'admin (et achetées, au projet 3) ; elles ne périment pas.
Un débit prend d'abord dans les pièces du mois, puis dans les pièces gardées. Solde affiché = somme des deux.

**Journal** : chaque mouvement est une ligne datée et immuable — allocation du mois, débit (avec son motif lisible :
« Traduction : Menu Tentation »), pièces offertes (avec qui et pourquoi), et plus tard achat. Chaque débit lié à Webo
garde aussi le coût réel (jetons d'entrée et de sortie, modèle, coût en dollars) pour les comptes de l'admin.

**Débit sûr** : un débit vérifie et retire le solde en une seule opération en base (jamais négatif, deux débits
simultanés ne se marchent pas dessus), et porte une clé d'unicité fournie par l'appelant pour qu'un double envoi ne
débite qu'une fois. Ordre pour une action Webo : réserver la pièce → appeler Claude → si l'appel échoue, rendre la
pièce (ligne de remboursement au journal) ; si le solde ne suffit pas, l'action n'est pas lancée.

**Réglages (admin)**, modifiables sans redéployer : pièces offertes par mois (200), prix d'une fiche traduite (1),
coefficient des actions au coût réel (3), plafond de traductions Webo par entreprise et par mois (500, garde-fou contre
un usage anormal).

**Ce que voit le traiteur** :
- la pièce W et son solde dans l'en-tête de l'application ; un clic ouvre la page « Mes WeboCoins » ;
- la page « Mes WeboCoins » (dans Paramètres) : solde (dont pièces du mois et date de leur renouvellement), historique
  paginé, et un bouton « Recharger » présent mais indiquant « bientôt » tant que Stripe n'est pas branché ;
- une alerte discrète quand il reste moins de 20 pièces.

**Ce que voit l'admin** (nouvelle page dans /admin) :
- par mois : pièces dépensées, coût réel Anthropic (en $ et en €), valeur des pièces dépensées, marge ;
- par entreprise : solde, dépense du mois, coût réel ; le journal d'une entreprise ;
- « Offrir des pièces » à une entreprise, avec un motif ;
- les réglages ci-dessus.

## La traduction au choix

**Aujourd'hui** (lib/prestationCard.ts) : le navigateur découpe la fiche en morceaux de texte et les envoie un par un
à MyMemory après un petit glossaire ; les morceaux qui échouent restent en français. Utilisé par WeboWord (traduction
des prestations et de la carte d'un devis en anglais) et par la fiche prestation (bouton « Traduire »). Les règles
existantes restent : une fiche qui a déjà son anglais n'est jamais retraduite ; la traduction est enregistrée dans le
catalogue ; la retouche faite dans WeboWord met la prestation à jour.

**Le choix** :
- réglage dans Paramètres : « Traduction : gratuite / Webo » (par défaut : Webo, puisque 200 pièces sont offertes) ;
- là où on traduit, le bouton dit le mode (« Traduire avec Webo · 1 W » / « Traduire (gratuit) ») et permet de changer
  pour cette fois ; pour une traduction de plusieurs fiches (devis en anglais), le nombre de pièces est annoncé avant
  de lancer (« 6 fiches à traduire · 6 W ») ;
- solde insuffisant, plafond atteint ou Webo indisponible : on traduit en gratuit, avec un message qui le dit
  (et propose de recharger quand c'est le solde).

**Traduction par Webo** :
- côté serveur uniquement (action serveur, session exigée), clé lue dans `ANTHROPIC_API_KEY` ;
- la fiche entière (HTML) part en un seul appel ; consigne : traduire en anglais de carte de restaurant, garder
  exactement la structure et la mise en forme HTML (balises, attributs, ordre), ne rien ajouter ni retirer, respecter
  le glossaire ;
- glossaire : celui d'aujourd'hui (termes et titres de menu), étendu, gardé en un seul endroit du code ;
- la réponse est nettoyée (même nettoyage HTML que le reste de l'application) avant d'être rendue et enregistrée ;
- le nom de la prestation est traduit dans le même appel que sa fiche (une fiche = un nom + son texte = 1 pièce) ;
- une seule pièce par fiche, même si la fiche est longue ; les fiches déjà en anglais ne coûtent rien (elles ne
  partent pas).

**Traduction gratuite** : MyMemory, comme aujourd'hui, inchangée.

## Choix faits par Claude après relecture (à vérifier par Maxence)

- **Traduction de plusieurs fiches, solde partiel** : fiche par fiche. Tant qu'il reste des pièces (et de la place sous
  le plafond), la fiche part chez Webo ; les suivantes passent en gratuit ; une fiche que Webo n'a pas réussi à traduire
  passe en gratuit et sa pièce est rendue. Message de fin : « 4 fiches traduites par Webo (4 W), 2 en gratuit ». Chaque
  fiche a sa propre réservation et sa propre clé d'unicité.
- **Ce qui compte pour une fiche** : chaque texte réellement envoyé à Webo, qu'il vienne d'une ligne du devis ou d'un
  plat de la carte, rattaché ou non à une prestation. Le nom traduit avec sa fiche est compris ; un nom seul (fiche déjà
  en anglais) est gratuit. Une ligne et son plat qui portent le même nom ne comptent qu'une fois (une seule traduction,
  réutilisée). Le nombre annoncé avant de lancer suit exactement ces règles.
- **« Retraduire depuis le français »** sur la fiche prestation : 1 pièce, comme une traduction.
- **Réserve débitée gardée au journal** : chaque débit note combien de pièces viennent des pièces du mois et combien des
  pièces gardées (et plus tard achetées). L'admin montre le coût réel, la valeur théorique des pièces dépensées
  (1 pièce = 1 centime) et, séparément, la part venant de pièces offertes, pour que la vraie marge apparaisse dès que
  Stripe arrive.
- **Qui décide, qui dépense** : le réglage « gratuite / Webo » est celui de l'entreprise (un seul pour tous ses membres).
  Seuls les membres qui peuvent modifier (pas le rôle lecture) dépensent des pièces ; tous les membres voient le solde
  et la page « Mes WeboCoins ».

## Contraintes

- Next.js (app router), actions serveur, Drizzle + Neon ; migrations additives appliquées sur la base directement
  (règle bêta), testées d'abord sur PGlite ; build et migrations avant toute mise sur `main`.
- SDK officiel `@anthropic-ai/sdk`, modèle `claude-haiku-5-5`.
- Textes de l'interface en français, ton de WeboDevis ; accessibles (lecteurs d'écran : « Solde : 184 WeboCoins »).
- Tests : unitaires sur le portefeuille (débit, remboursement, concurrence, mois, idempotence) avec PGlite ; Claude
  simulé dans les tests ; e2e sur la traduction avec un faux service (aucun vrai appel payant dans les tests).

## Ce qui est laissé au constructeur

- Le schéma exact des tables (portefeuille, journal, réglages) et la façon de garantir le débit atomique.
- Le dessin de la pièce (SVG), dans la palette existante.
- La conversion $ → € dans l'admin (taux fixe réglable suffit).
- Le découpage de l'appel Claude (prompt système en cache, sortie structurée ou HTML brut) tant que la mise en forme est
  rendue à l'identique et nettoyée.
