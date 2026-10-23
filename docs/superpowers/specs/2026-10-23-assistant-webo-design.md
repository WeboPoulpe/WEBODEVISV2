# Assistant Webo — conception

Date : 2026-10-23. Maxence a demandé « fais-le pour moi » : les choix ci-dessous sont ceux de Claude, sur la base de ce
qui a été décidé avant (mémoire webo-ia-webocoins, spec des WeboCoins).

## Intention

Le traiteur parle à Webo comme à un collègue (« Prépare un devis pour le mariage Dupont, 120 personnes le 12 juin, menu
Tentation ») et Webo prépare le travail dans WeboDevis. Webo ne crée jamais rien seul : il propose, le traiteur valide.
Chaque réponse se paie en WeboCoins au coût réel × coefficient.

## Objectifs (v1)

- Une bulle **Webo** sur toutes les pages de l'application, qui ouvre un panneau de discussion.
- Un **aiguilleur** (Claude Haiku 5.5) lit chaque message et le confie au bon **spécialiste**, chacun avec sa consigne et
  ses outils :
  - **Devis** (Sonnet 5.5) : prépare un devis (client existant ou nouveau, événement, couverts, lignes du catalogue) ;
  - **Factures** (Sonnet 5.5) : prépare un brouillon de facture (acompte, solde, totale) depuis un devis ;
  - **Catalogue** (Sonnet 5.5) : crée une prestation ou change le prix / la description d'une prestation ;
  - **Prospects** (Sonnet 5.5) : rédige une réponse à une demande de prospect, envoyée par email après validation ;
  - **Aide** (Haiku 5.5) : répond aux questions d'usage avec les guides du centre d'aide, sans outil.
- **Validation humaine systématique** : une action est une *proposition* enregistrée, montrée en carte (récapitulatif)
  avec **Valider**, **Modifier**, **Annuler**. Seul « Valider » écrit, par du code déterministe du serveur (pas par
  l'IA), avec les droits de l'utilisateur. « Modifier » : le traiteur dit ce qu'il faut changer, Webo propose à nouveau.
- Les spécialistes lisent (catalogue, clients, devis, prospects de l'entreprise) mais n'écrivent rien.
- **Paiement** : chaque réponse de Webo débite le coût réel de tous ses appels × coefficient (réglage admin, 3),
  arrondi à la pièce supérieure. Il faut au moins 5 pièces pour envoyer un message. Le coût de la réponse est affiché.
- Historique des conversations (les 20 dernières), reprenables.

## Non-objectifs (v1)

- Pas d'émission de facture (numéro) ni d'envoi de devis au client : Webo prépare des brouillons ; émettre et envoyer
  restent des gestes du traiteur dans les écrans habituels. Seule exception : la réponse à un prospect, envoyée par
  email au clic sur Valider (c'est son seul intérêt), avec le texte visible et modifiable avant.
- Pas de suppression de quoi que ce soit.
- Pas de voix, pas de pièces jointes, pas de lecture des mails.

## Anti-objectifs

- Une écriture en base sans clic « Valider ».
- Une action sur les données d'une autre entreprise, ou par un compte en lecture seule ou la démo.
- Une proposition rejouable (validée deux fois → deux devis).
- Des prix inventés : les prix viennent du catalogue ; une ligne hors catalogue est marquée « à chiffrer » (prix 0) si
  le traiteur n'a pas donné de prix.
- Une facture surprise : le coût de chaque réponse est montré, et Webo refuse poliment sans assez de pièces.

## Choix techniques (Claude)

- SDK officiel, boucle d'outils écrite à la main (contrôle des limites) : 8 tours d'outils au plus par réponse,
  60 s par appel, `max_tokens` 8 000, message de l'utilisateur ≤ 4 000 caractères, 30 messages par conversation.
- Effort : aiguilleur et aide `low`, spécialistes `medium`. Repli serveur en cas de refus (`fallbacks: "default"`) sur
  les spécialistes Sonnet 5.5.
- La conversation est gardée côté serveur (tables `webo_conversations`, `webo_proposals`). D'un message à l'autre,
  l'historique est redonné au spécialiste en texte (questions, réponses, propositions et leur sort), pas en blocs bruts :
  l'aiguilleur peut changer de spécialiste sans casser quoi que ce soit.
- Traces : chaque débit au journal des WeboCoins (« Webo : <début du message> ») avec le coût réel ; chaque proposition
  gardée avec son contenu et son résultat.
- `WEBO_FAKE=1` (hors production) : spécialistes simulés pour les tests, sans appel payant.
