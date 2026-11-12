# Choisir Mon Traiteur : annuaire public de traiteurs

Conception du 12 novembre 2026. Décisions de Maxence marquées **[M]**, choix de Claude marqués **[C]** (à contester à la relecture).

## Intention

Un site public, pour les particuliers et les entreprises qui cherchent un traiteur : ils parcourent des fiches, lisent
des avis, feuillettent des brochures, puis contactent le traiteur de leur choix. Modèle : mariages.net, limité aux
traiteurs.

Pourquoi :

- **Une vente de plus.** Un traiteur qui n'a pas le logiciel paie pour avoir sa fiche.
- **Un argument pour le logiciel.** Les abonnés WeboDevis ont leur fiche gratuitement, plus riche que les autres.
- **Une porte d'entrée.** Un traiteur en « fiche seule » reçoit ses demandes dans un WeboDevis réduit, et voit à chaque
  demande ce que le logiciel complet ferait pour lui.
- **Aucun concurrent du dossier comparatif du 10 novembre ne propose d'annuaire.**

## Décisions prises

- **[M] Nom et adresse** : « Choisir Mon Traiteur », `choisirmontraiteur.fr`. Site distinct de `webodevis.fr`.
- **[M] Contenu d'une fiche** : présentation, photos, brochures, avis, lien vers le site web du traiteur, formulaire de
  contact.
- **[M] Contact** : un simple formulaire. Pas de messagerie.
- **[M] Prix** : 29,99 € par mois pour un traiteur sans le logiciel ; gratuit pour les abonnés WeboDevis.
- **[C] 29,99 € s'entend HT, mensuel, sans engagement, sans frais de départ**, comme l'abonnement du logiciel (TVA 20 %
  en plus). Pas de formule annuelle au départ.
- **[M] WeboDevis ne gère aucun paiement** entre un traiteur et ses clients (décision du 12 novembre, valable ici).

## Objectifs

1. Un visiteur trouve les traiteurs de son département, pour son type d'événement, et en contacte un en moins de deux
   minutes.
2. Un abonné WeboDevis publie sa fiche en quelques minutes, à partir de ce qu'il a déjà (logo, brochures, photos).
3. Un traiteur sans le logiciel peut s'inscrire, remplir sa fiche, payer et recevoir des demandes, sans accès au reste.
4. Les avis sont crédibles : déposés sur invitation seulement, les négatifs publiés comme les positifs.
5. Une fiche n'est publiée que si l'entreprise existe vraiment : contrôle automatique du SIRET, validation de
   Maxence pour les seuls cas douteux, et droit de suspendre toute fiche après coup.

## Hors périmètre

- Messagerie entre visiteur et traiteur.
- Paiement, réservation ou acompte en ligne.
- Demande envoyée à plusieurs traiteurs à la fois, comparateur de devis.
- Mise en avant payante, publicité, classement sponsorisé.
- Avis ouverts à tout visiteur.
- Récupération automatique des photos du site web du traiteur.
- Autres métiers que traiteur (lieux, photographes, fleuristes).
- Compte ou espace client pour les visiteurs **[M, 12 novembre]**. À la place : des favoris gardés dans le navigateur
  et un e-mail de confirmation qui récapitule la demande et le traiteur contacté.

## À éviter absolument

- **Un annuaire qui a l'air vide.** Pas de compteur « 3 traiteurs », pas de page de département sans fiche dans Google.
- **De faux avis ou de faux traiteurs.** D'où l'invitation obligatoire et la validation des fiches.
- **Une brèche dans le logiciel.** Un compte « fiche seule » ne doit jamais pouvoir créer un devis, une facture ou un
  événement, ni par l'écran ni par `/api/db`.
- **Un classement trompeur.** L'ordre des fiches ne dépend jamais d'un paiement, et la page le dit.
- **Un site qui ressemble à un outil pour professionnels.** Le visiteur est un particulier.

## Comment c'est fait

### Un seul projet, deux adresses

**[C]** Même dépôt, même base Neon, même projet Vercel. Les pages de l'annuaire vivent sous `app/annuaire/`. Le
middleware réécrit les requêtes reçues sur l'hôte de l'annuaire (variable `DIRECTORY_HOST`) vers ce dossier, et renvoie
`webodevis.fr/annuaire/…` vers l'autre adresse en production. En local et sur les aperçus Vercel, on consulte
`/annuaire` directement. `sitemap.xml` et `robots.txt` dépendent de l'hôte.

### Pages publiques

| Adresse | Contenu |
| --- | --- |
| `/` | Recherche (département, type d'événement), fiches récentes, explication en trois étapes |
| `/traiteurs` | Résultats de recherche, filtrables |
| `/traiteurs/[departement]` | Les traiteurs d'un département ; indexée seulement s'il y a au moins une fiche |
| `/traiteur/[slug]` | La fiche |
| `/avis/[jeton]` | Dépôt d'un avis, depuis le lien d'invitation |
| `/referencer-mon-entreprise` | Page pour les traiteurs : ce que comprend la fiche, le prix, le bouton d'inscription |
| `/avis-clients` | Comment les avis sont recueillis, vérifiés et classés (obligation légale) |
| `/mentions-legales`, `/confidentialite`, `/conditions` | Textes légaux, éditeur Webomax jusqu'au 1er janvier 2027 |

**[C] Recherche par département** (là où le traiteur déclare se déplacer), pas par ville avec un rayon : plus simple,
et suffisant tant qu'il y a peu de fiches.

**[C] Ordre des fiches** : d'abord celles qui ont des avis, par date du dernier avis ; puis les autres, par date de
publication. Écrit en clair sur `/avis-clients` et en pied des résultats.

### La fiche d'un traiteur

- Nom, logo, ville, départements desservis, types d'événements, phrase d'accroche, présentation.
- Repères facultatifs : nombre de convives minimum et maximum, « à partir de X € par personne ».
- Galerie de photos (20 au plus), dont une photo de couverture.
- Brochures feuilletables **(abonnés du logiciel seulement)**, ouvertes dans le lecteur existant (`/b/[token]`).
- Avis : note moyenne, nombre, liste ; mention « avis vérifié » pour ceux liés à un devis signé.
- Lien vers le site web du traiteur (`rel="nofollow noopener"`).
- Formulaire de contact : prénom, nom, e-mail, téléphone, type d'événement, date, nombre d'invités, lieu, message.
- Données structurées `FoodEstablishment` avec `aggregateRating` quand il y a des avis.

### Le formulaire de contact

La demande est enregistrée dans `prospect_requests`, comme celles du formulaire actuel du traiteur, avec une nouvelle
colonne `source = 'annuaire'`. Elle déclenche les deux e-mails existants (au traiteur, accusé de réception au
visiteur) et apparaît dans « Demandes ». Protections reprises de l'existant : filtre anti-spam (`lib/siteSpam.ts`),
limite par empreinte d'adresse IP, pas d'e-mail pour une demande suspecte.

### Les avis

- **Sur invitation seulement.** Le traiteur invite un client par e-mail ; le lien contient un jeton à usage unique.
- **Abonnés du logiciel** : après la date d'un événement dont le devis est signé, WeboDevis propose d'envoyer
  l'invitation (un clic, ou automatique si le traiteur l'active). L'avis est alors marqué « vérifié ».
- **Fiche seule** : le traiteur saisit le nom et l'e-mail de son client. L'avis est publié sans la mention « vérifié ».
- Contenu : note de 1 à 5, texte, prénom et initiale du nom, type et mois de l'événement.
- **Publié dès le dépôt**, positif ou négatif. Le traiteur ne peut ni le modifier ni le supprimer ; il peut y
  répondre une fois (réponse modifiable) et le signaler.
- Un avis signalé reste visible jusqu'à la décision de l'administrateur, qui ne le retire que pour un motif listé sur
  `/avis-clients` (injure, hors sujet, données personnelles, auteur qui n'a pas été client). Le motif est noté.
- Chaque avis affiche sa date et la date de la prestation (Code de la consommation, art. L111-7-2 et D111-17).

### Deux sortes de comptes

Nouvelle colonne `profiles.account_kind` : `logiciel` (défaut, tous les comptes actuels) ou `annuaire`.

| | Abonné du logiciel | Fiche seule |
| --- | --- | --- |
| Prix | Compris dans l'abonnement | 29,99 € HT par mois |
| Fiche, photos, lien, formulaire | Oui | Oui |
| Brochures sur la fiche | Oui | Non |
| Avis | Vérifiés | Simples |
| Demandes | Dans « Demandes », avec « Créer le devis » | Dans « Demandes », bouton verrouillé |
| Reste du logiciel | Oui | Verrouillé, avec proposition d'abonnement |

**Accès.** `Access` gagne une valeur : `'full' | 'listing' | 'readonly' | 'unpaid'`. Un compte `annuaire` n'a jamais
plus que `listing`, que l'interrupteur « Abonnement obligatoire » soit allumé ou non. En `listing`, seules les écritures
d'une liste fermée sont permises : sa fiche, ses photos, les invitations et réponses aux avis, le statut de ses
demandes, ses réglages d'entreprise et de compte. Tout le reste est refusé par `requireWriter` et par `/api/db`, avec un
test d'audit sur le modèle de `writeGates.test.ts`.

**Écrans d'un compte fiche seule** : Ma fiche, Demandes, Avis, Paramètres (entreprise, abonnement, compte). Les autres
entrées du menu restent visibles, grisées, et ouvrent une fenêtre « Passez à WeboDevis ».

**Passage au logiciel** : depuis cette fenêtre, paiement de l'abonnement du logiciel (mise en service comprise) ;
l'abonnement « fiche seule » est résilié, le compte devient `logiciel`, la fiche reste en ligne.

### Parcours d'inscription « fiche seule »

**[M, 12 novembre]** La vérification est automatique ; Maxence n'intervient que sur les cas douteux. Le paiement vient
toujours après la vérification, pour ne jamais avoir à rembourser une fiche refusée.

1. Création du compte depuis `/referencer-mon-entreprise` (`account_kind = 'annuaire'`), e-mail confirmé par un lien.
2. Le traiteur saisit son SIRET, remplit sa fiche et la soumet.
3. Contrôle automatique (voir ci-dessous).
   - Réussi : la fiche est validée tout de suite.
   - Douteux : elle passe en `en_attente` ; Maxence la valide ou la refuse (avec un motif), un e-mail prévient le
     traiteur.
4. Fiche validée : le traiteur paie (Stripe Checkout, prix `STRIPE_PRICE_ANNUAIRE`). La fiche est publiée dès le
   paiement. Maxence reçoit une notification et peut la suspendre.
5. Résiliation ou impayé : la fiche est retirée à la fin de la période payée ; ses données sont gardées.

Pour un abonné du logiciel : il remplit sa fiche dans l'application et la soumet ; le même contrôle s'applique, avec le
SIRET de ses mentions légales. Si son abonnement s'arrête, la fiche est retirée.

### Contrôle automatique de l'entreprise

À la soumission, le serveur interroge l'annuaire public des entreprises de l'État (API « Recherche d'entreprises »,
`recherche-entreprises.api.gouv.fr`, gratuite et sans clé ; à confirmer au moment de construire) avec le SIRET saisi.
Le contrôle réussit si toutes ces conditions sont vraies :

- l'établissement existe et il est en activité ;
- son code d'activité est dans une liste fermée : traiteurs (56.21Z), restauration (56.10A, 56.10C), charcuterie et
  boucherie (10.13B, 47.22Z), boulangerie-pâtisserie (10.71C, 10.71D, 47.24Z) ;
- le nom saisi ressemble à la dénomination, au nom commercial ou à l'enseigne déclarés ;
- le code postal de la fiche est celui de l'établissement, ou du même département ;
- ce SIRET n'a pas déjà une fiche.

Sinon, ou si l'annuaire de l'État ne répond pas, la fiche passe en validation manuelle : jamais de refus automatique.
Le résultat du contrôle (date, code d'activité, dénomination trouvée, raison du doute) est gardé avec la fiche et
affiché dans l'administration. Le contrôle ne voit ni les photos volées ni les textes mensongers : d'où le droit de
suspendre après coup.

### Une fiche est visible si

Son statut est `publiee`, **et** le compte est actif, **et** soit le compte est `logiciel` avec un accès complet, soit
il est `annuaire` avec un abonnement « fiche seule » actif. Cette règle est une seule fonction, testée.

### Stripe

Un troisième prix, `STRIPE_PRICE_ANNUAIRE` (29,99 € HT par mois, taxe exclue). `company_subscriptions.plan` accepte
`annuaire`. Pas de mise en service, pas de WeboCoins, pas d'accès à Webo. Le webhook et la relecture de l'abonnement
existants servent tels quels ; seule la traduction prix → formule s'étend.

### Données

- `directory_listings` : une ligne par entreprise. Slug unique, statut (`brouillon`, `en_attente`, `publiee`,
  `refusee`, `suspendue`), SIRET, résultat du contrôle automatique, nom affiché, accroche, présentation, ville, code postal, départements desservis, types
  d'événements, site web, convives min et max, prix de départ, photo de couverture, motif de refus, dates.
- `directory_photos` : photos de la fiche, ordonnées, avec texte de remplacement. Fichiers envoyés par `/api/files`.
- `directory_listing_brochures` : brochures choisies pour la fiche, chacune avec un lien de brochure dédié
  (`brochure_links`, libellé « Choisir Mon Traiteur ») pour que les demandes venues d'une brochure soient attribuées.
- `directory_reviews` : jeton d'invitation, e-mail et nom de l'invité, devis lié (facultatif), note, texte, auteur
  affiché, type et mois de l'événement, statut (`invite`, `publie`, `retire`), vérifié, signalement, réponse, dates,
  empreinte d'adresse IP.
- `prospect_requests.source`, `profiles.account_kind`.

Migrations additives, testées sur PGlite, puis `db:migrate` avant l'envoi sur `main`.

### Administration

Nouvel écran `/admin/annuaire` : fiches en attente parce que le contrôle automatique a un doute (aperçu, raison du
doute, valider, refuser avec motif), fiches publiées récemment, toutes les fiches (suspendre, republier), avis signalés (garder, retirer avec motif). Un compteur dans le menu, comme pour les demandes du site.

### Statistiques

Les visites de l'annuaire passent par l'outil sans cookie existant (`site_visits`), avec le chemin interne
`/annuaire/…`. Le traiteur voit sur « Ma fiche » le nombre de vues et de demandes des 30 derniers jours. Aucune écriture
de plus en base : les mêmes paquets, au plus une fois par heure.

### Apparence

Un site pour particuliers, avec son propre nom et son propre logo, dans la même famille de couleurs que WeboDevis
(crème, vert sapin, terracotta). De grandes photos, peu de texte. Pas de logo carré, pas de bouton en double, rien qui
fasse « trop IA ». Mention discrète « Propulsé par WeboDevis » en pied de page.

## Précisions après relecture

Toutes sont des choix de Claude **[C]**.

- **Où se connecte le traiteur.** Sur `webodevis.fr`, comme tout le monde : connexion, inscription, « Ma fiche »,
  paiement Stripe et liens des e-mails restent sur cet hôte. `choisirmontraiteur.fr` ne sert que les pages publiques ;
  son bouton d'inscription mène à `webodevis.fr/register?offre=annuaire`. Aucune session sur le second domaine.
- **Qui porte `account_kind`.** Le profil de l'entreprise (le titulaire), lu par la même règle que l'abonnement
  (`parent_user_id`, sinon soi-même). Un compte fiche seule est créé comme les autres, avec un seul utilisateur :
  pas d'invitation de collaborateur en fiche seule.
- **Modifier une fiche publiée.** Les modifications sont en ligne tout de suite, sans nouvelle validation. La fiche
  garde la date de sa dernière modification ; l'administration liste les fiches « modifiées depuis la validation » et
  peut les suspendre. Les photos suivent la même règle.
- **Invitation à laisser un avis (abonnés).** Elle s'appuie sur la date d'événement du devis, pour un devis au statut
  « Validé », « Acompte reçu » ou « Payé ». Par défaut, le traiteur l'envoie d'un clic depuis l'événement passé ou sa
  page Avis. S'il active l'envoi automatique, la tâche planifiée quotidienne existante (`app/api/cron/relances`) envoie
  l'invitation trois jours après l'événement, une seule fois par devis.
- **Passage de la fiche seule au logiciel.** Nouveau paiement pour l'abonnement du logiciel ; à sa réussite,
  l'abonnement fiche seule est résilié tout de suite, sans remboursement du mois entamé. `company_subscriptions` garde
  une ligne par entreprise : la relecture existante retient le meilleur abonnement.
- **Un abonné du logiciel qui résilie.** L'écran « Abonnement inactif » lui propose de garder sa fiche à 29,99 € ; s'il
  accepte, son compte devient `annuaire`. Sinon la fiche est retirée à la fin de la période payée.
- **Fichiers.** Les photos passent par l'envoi existant vers Vercel Blob, dont les adresses sont publiques. L'envoi
  d'images dans son propre dossier fait partie des écritures permises en accès `listing`.
- **Brochures.** Une fiche retirée n'affiche plus ses brochures, mais les liens de brochure restent actifs : ils
  suivent les règles actuelles des brochures, pas celles de la fiche.
- **Listes fermées.** Départements : les 96 de métropole (dont 2A et 2B) et les 5 d'outre-mer, stockés en tableau de
  codes. Types d'événements : une liste fermée dans `lib/`, reprise du formulaire de demande actuel s'il en a une.
- **Demande envoyée à une fiche qui n'est plus visible.** Refusée, avec un message au visiteur l'invitant à choisir un
  autre traiteur.
- **Facturation et textes légaux.** Les factures Stripe suffisent, comme pour l'abonnement du logiciel. Le
  constructeur rédige les textes légaux sur le modèle de ceux de WeboDevis ; Maxence les relit avant l'ouverture. Pour
  les clients invités à laisser un avis, le traiteur est responsable du traitement et Webomax son sous-traitant.

## Découpage

Trois lots, chacun utilisable seul :

1. **Fiches et annuaire** : tables, « Ma fiche » pour les abonnés du logiciel, pages publiques, formulaire de contact,
   validation dans l'administration, textes légaux, second domaine.
2. **Avis** : invitations, dépôt, affichage, réponse, signalement, modération, page `/avis-clients`.
3. **Fiche seule** : `account_kind`, accès `listing`, inscription, prix Stripe à 29,99 €, passage au logiciel.

## Laissé au constructeur

La mise en page, les textes, le découpage des composants, les noms de fonctions, la forme exacte des index et des
contraintes, le détail des e-mails.

## Risques connus

- **Peu de fiches au départ.** WeboDevis a aujourd'hui une poignée de comptes. L'annuaire ouvrira avec très peu de
  traiteurs ; un traiteur qui paie 29,99 € sans recevoir de demande partira. Le lot 3 gagne à attendre que l'annuaire
  reçoive des visites.
- **Référencement à zéro** sur un domaine neuf.
- **Avis** : cadre légal à respecter dès le premier avis publié.
