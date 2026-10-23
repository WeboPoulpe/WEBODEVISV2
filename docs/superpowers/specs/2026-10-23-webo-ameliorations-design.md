# Webo : améliorations (vitesse, contexte, mémoire, actions, voix et photo) — conception

Date : 2026-10-23. Maxence a choisi les points 2 à 5 de la liste d'améliorations, avec une base de tests et un retour
👍 / 👎, livrés « d'une traite ». Choix de Claude sauf mention contraire. Règles inchangées : Webo propose, le traiteur
valide (carte) ; chaque réponse se paie au coût réel × coefficient ; 5 pièces réservées par message.

## Lot A — ressenti
- **Réponse mot à mot** : une route `POST /api/webo/chat` renvoie un flux d'événements (texte au fil de l'eau,
  spécialiste choisi, propositions, fin avec pièces et solde). L'action serveur actuelle reste pour les tests.
- **Cache** : consignes et outils mis en cache (le préfixe ne change pas d'un tour à l'autre) ; la partie variable
  (date, page ouverte, habitudes) va dans le message.
- **Page ouverte** : le navigateur envoie le chemin ; sur `/devis/<id>…`, le serveur ajoute au message le résumé du
  devis (numéro, client, date, couverts, lignes, total) après avoir vérifié qu'il est de l'entreprise.

## Lot B — mémoire
- **Habitudes** : outil `propose_memory` (carte « Retenir : … ») ; validées, elles vont dans `webo_memories`
  (30 au plus par entreprise, 300 caractères) et sont redonnées à chaque spécialiste. Paramètres > Webo : liste et
  suppression.
- **Devis passés** : la recherche de devis porte aussi sur le type d'événement et l'année ; `propose_quote` reconnaît
  une ligne sans identifiant dont le nom est exactement celui d'une prestation du catalogue (prix du catalogue) ;
  consigne « fais comme le devis X » : reprendre ses lignes avec `get_quote`.

## Lot C — actions et qualité
- **Modifier un devis** : `propose_quote_update` (couverts, date, lieu, lignes à ajouter, lignes à retirer par nom).
  Validé : lignes et total recalculés. Si le devis a un document mis en forme, il est remis à jour dans le navigateur
  juste après la validation (même mécanisme que l'éditeur en formulaire).
- **Préparer l'envoi / relancer** : `propose_quote_send` (destinataire, message) → envoi par `sendQuoteToClient`
  au clic sur Valider ; outil `stale_quotes` (devis envoyés sans réponse depuis N jours) pour les relances.
- **Fiche prestation appétissante** : consigne du spécialiste Catalogue (description courte, sensorielle, sans
  promesse).
- **Résumé de la journée** : nouveau spécialiste **Journée** (Haiku 5.5) avec l'outil `day_overview` (le tableau de
  bord : à faire, événements à venir).
- **Mail collé** : consigne du spécialiste Devis et de l'aiguilleur (un message de client collé → devis).
- **Qualité** : 👍 / 👎 sous chaque réponse (enregistré dans la conversation) ; admin : les réponses notées 👎 ;
  `scripts/webo-eval.ts` : 20 demandes types avec leurs attentes, lancé à la main (appels payants, jamais en CI).

## Lot D — voix et photo
- **Dictée** : bouton micro (reconnaissance vocale du navigateur, français), masqué si le navigateur ne la propose pas.
- **Photo** : une image (JPEG, PNG, WebP, ≤ 5 Mo) jointe au message ; envoyée au spécialiste (Devis ou Catalogue)
  qui en tire des prestations ou un devis à proposer. L'image n'est pas gardée (l'historique note « photo jointe »).

## Anti-objectifs
- Aucune écriture sans validation (la mémoire comprise).
- Pas d'envoi de devis sans validation ; pas de modification d'un devis validé, payé ou refusé.
- Pas de photo ou d'audio conservés.
