# Origine Instagram : qui clique sur le lien et ce qu'il devient

Date : 2026-11-17 · Statut : à valider

## Pourquoi

Le compte Instagram WeboDevis démarre (33 posts programmés du 18 novembre 2026 au 29 janvier 2027, robot dans
`video/instagram/robot/`). Maxence veut savoir **qui clique sur le lien Instagram et ce que ces personnes deviennent**
sur le site : simples visites, ouverture de la démo, demande de contact, inscription. Quand la personne se fait
connaître (formulaire de démo, de contact ou inscription), il veut **voir son nom avec « venu d'Instagram »** dans
l'admin (Demandes, Comptes). Sinon, des totaux anonymes.

L'indicateur clé du plan Instagram est le nombre de demandes de démo venues d'Instagram.

## Objectifs

1. Compter les clics sur les liens Instagram, par jour et par lien (bio, chaque story).
2. Suivre ces visiteurs pendant leur visite : pages vues, ouverture de la démo, contact, inscription.
3. Enregistrer l'origine sur la demande (`site_requests`) ou le compte (`profiles`) créés pendant cette visite.
4. Afficher dans l'admin :
   - **Demandes** : une étiquette « Instagram · bio » (ou le nom du lien) sur la ligne et dans le détail.
   - **Comptes** : la même étiquette sur le compte.
   - **Statistiques** : un bloc Instagram (voir « Écran »).

## Non-objectifs

- Les statistiques internes d'Instagram (abonnés, portée, enregistrements) via l'API : pas demandé ici.
- Savoir quel post du fil a amené le clic : impossible, les liens des légendes ne sont pas cliquables sur Instagram.
- Suivre une personne d'une visite à l'autre ou sur plusieurs jours.

## Anti-objectifs (échec même si « ça marche »)

- Ajouter un cookie ou un bandeau de consentement : le site est mesuré **sans cookie**, ça doit le rester.
- Identifier un visiteur qui n'a rien rempli.
- Réveiller la base Neon à chaque clic (le temps de calcul est facturé) : le clic passe par le même paquet en
  mémoire que les pages vues (`server/siteStats.ts`).
- Ralentir ou casser une visite si la mesure échoue.

## Contraintes

- Mesure actuelle : `components/site/SiteAnalytics.tsx` envoie chaque page vue à `/api/stats` (sendBeacon) ;
  `server/siteStats.ts` met en paquet et écrit dans `site_visits` (visiteur = empreinte du jour, IP et navigateur,
  non réversible). Conservation de 13 mois, purge de nuit.
- Conversions : contact (`server/site.ts`, `site_requests` kind `devis` ou `message`) et inscription
  (`server/auth.ts`, `users` et `profiles`) appellent `recordEventNow`. La demande de démo (`server/demo.ts`,
  `requestDemoAccess`, `site_requests` kind `demo`) ne l'appelle pas : l'événement `demo` actuel n'est qu'un clic sur un
  lien `/demo`, envoyé par le navigateur.
- `SiteAnalytics` n'est monté que dans les pages du site public (`SiteShell`), pas sur `/demo` ni `/register`.
- `/ig` est déjà public dans `middleware.ts` (chemin inconnu sans session : `NextResponse.next()`). Rien à changer,
  sauf l'ajouter à `SITE_PREFIXES` par clarté.
- `/api/stats` ignore les visiteurs connectés (cookie de session) : l'équipe n'est pas comptée.
- Migrations additives appliquées directement sur la base (pas de branche Neon de dev), testées sur PGlite puis
  `npm run db:migrate`. **Prochain numéro : 0059** (la 0058, rôle support, est commitée).
- Schéma `profiles` : le type TypeScript `Profile` ne correspond pas toujours aux colonnes réelles. Partir de
  `db/schema/tables.ts`, pas du type.
- Avant tout push sur `main` (production Vercel) : `next build` et migrations appliquées.
- Pages qui lisent `window` ou `sessionStorage` : passer par `useHydrated`.

## Approches envisagées

- **A. Lien court `/ig` qui compte le clic, origine retenue pendant la visite** (choisie). Clic compté côté serveur
  même sans JavaScript ; libellé lisible par lien ; lien propre dans la bio.
- B. Lien long `?utm_source=instagram` sans route : lien laid en bio, pas de comptage du clic lui-même.
- C. Question « Comment nous avez-vous connus ? » dans les formulaires : déclaratif, aucune mesure des clics. Écartée pour
  l'instant, possible en complément plus tard.

## Conception

### Liens

- `webodevis.fr/ig` : lien de la bio. Origine `instagram`.
- `webodevis.fr/ig/<libellé>` : un lien par story ou opération (`/ig/lancement`, `/ig/demo-noel`). Origine
  `instagram:<libellé>`. Libellé : 1 à 30 caractères `[a-z0-9-]`, sinon traité comme `/ig`.
- Destination : la page d'accueil, ou un chemin interne passé en `?vers=/demo` (uniquement un chemin du site commençant
  par `/`, jamais une adresse externe, pour ne pas créer de redirection ouverte).

### Route `app/ig/[[...libelle]]/route.ts` (GET)

1. Calcule l'origine.
2. Met en paquet une ligne `site_visits` avec `event = 'clic'`, `origin` et `source = 'reseaux'`, comme `/api/stats` :
   robots exclus, visiteur connecté (cookie de session) non compté. Décision : l'équipe qui teste le lien ne fausse
   pas les chiffres ; la redirection a lieu quand même.
3. Répond par une redirection 302 vers la destination, avec `?o=<origine encodée>` ajouté.

### Pendant la visite

- Un petit composant `OrigineCapture`, monté dans la mise en page racine (donc aussi sur `/demo` et `/register`),
  lit `o`, le valide (même format que ci-dessus), le garde dans `sessionStorage` (`wd-origine`, effacé à la fermeture
  de l'onglet), puis retire `o` de l'adresse (`history.replaceState`). Il n'envoie rien. Décision : on ne monte pas
  `SiteAnalytics` sur `/demo`, pour que les statistiques existantes gardent leur périmètre.
- Chaque envoi à `/api/stats` porte `origin` si elle existe ; `buildRow` la valide, l'écrit dans `site_visits.origin`
  et, quand elle est présente, classe la visite en `source = 'reseaux'`. Décision : le navigateur intégré d'Instagram
  n'envoie souvent pas de provenance ; sans ça, ces visites tomberaient en « Accès direct » et les blocs ne
  concorderaient pas.
- Les formulaires de démo, de contact et d'inscription envoient `origin` lue dans `sessionStorage`. Le serveur la
  revalide (jamais confiance au navigateur) et l'écrit dans `site_requests.origin` ou `profiles.origin`. Contact et
  inscription passent aussi l'origine à `recordEventNow`. La démo garde son fonctionnement actuel (pas de nouvel
  événement) : le bloc Instagram compte les demandes de démo directement dans `site_requests`.
- **Compte créé depuis l'admin** (`createAccount` dans `server/admin.ts`) : s'il existe une demande (`site_requests`)
  avec la même adresse e-mail (normalisée) et une origine, le compte reprend l'origine de la plus récente.
  Décision de Maxence : voir le parcours complet, du clic au client.
  Proposition (à confirmer) : même règle à l'inscription par le formulaire quand la visite n'a pas d'origine mais
  qu'une demande antérieure avec la même adresse en a une.

### Base (migration 0059, additive)

- `site_visits.origin text null`, `site_requests.origin text null`, `profiles.origin text null`.
- Contrainte `site_visits_event_check` : ajouter `'clic'`.
- Index partiel `site_visits(day) where origin is not null` pour le bloc Instagram.

### Écran : bloc Instagram dans Statistiques (même période 7, 30 ou 90 jours)

Définitions (décision) : **Clics** = lignes `clic` ; **Visiteurs** = visiteurs distincts avec une origine ;
**Demandes de démo** = `site_requests` kind `demo` avec origine (l'indicateur clé) ; **Contacts** = `site_requests`
kind `devis` ou `message` avec origine ; **Inscriptions** = `profiles` avec origine. Les totaux existants du site ne
changent pas de sens.

```
Instagram                                         30 derniers jours
 Clics   Visiteurs   Demandes de démo   Contacts   Inscriptions
  84        71              12              3            2
 [barres : clics par jour]
 Par lien        bio 61 · lancement 17 · demo-noel 6
 Ils se sont fait connaître
  Camille Martin · Traiteur Martin   Démo      bio        12 déc.  → Demandes
  Julien Roy                          Compte    lancement  3 déc.   → Comptes
```

Les étiquettes dans Demandes et Comptes reprennent le même libellé (« Instagram · bio », « Instagram · lancement »).

### Lien avec le robot

Le lien de la bio devient `webodevis.fr/ig`. Les légendes ne changent pas (liens non cliquables). Pour chaque story,
utiliser un autocollant lien vers `webodevis.fr/ig/<libellé>`.

### Vie privée

Mettre à jour la page de confidentialité : « Quand vous arrivez depuis un de nos liens Instagram, nous notons cette
provenance pendant votre visite ; si vous nous écrivez ou créez un compte, elle est enregistrée avec votre demande. »
Pas de cookie : `sessionStorage` est effacé à la fermeture de l'onglet.

## Tests attendus

- Unitaires : validation de l'origine et du libellé ; refus d'une destination externe ; `buildRow` avec et sans origine ;
  agrégats du bloc Instagram (sur PGlite, comme `adminStats.test.ts`).
- Serveur : contact, démo et inscription enregistrent l'origine valide et ignorent une origine invalide.
- Bout en bout : `/ig/test` puis formulaire de démo, puis la demande apparaît avec l'étiquette dans l'admin.

## Laissé au constructeur

- Le découpage exact du composant du bloc Instagram et la réutilisation du graphique `DailyChart`.
- Le nom du composant d'étiquette, son style (pastille comme les autres étiquettes de l'admin).
- Comment relire `sessionStorage` dans chaque formulaire (petit utilitaire partagé `lib/origine.ts` conseillé).
