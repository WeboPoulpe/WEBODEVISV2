import type { HelpGuide } from '../types';

export const compte: HelpGuide[] = [
  {
    id: 'entreprise',
    category: 'compte',
    title: 'Renseigner votre entreprise, votre logo et vos conditions de vente',
    summary: 'Ces informations figurent sur vos devis.',
    keywords: ['entreprise', 'société', 'coordonnées', 'adresse', 'téléphone', 'siret', 'logo', 'cgv', 'conditions générales', 'en-tête', 'paramètres'],
    href: '/parametres',
    steps: [
      { title: 'Ouvrez « Mon entreprise » dans le menu « Paramètres »' },
      { title: 'Complétez « Identité de l\'entreprise »', text: 'Nom, adresse, téléphone et SIRET, puis « Enregistrer ». Le bouton confirme l’enregistrement.' },
      { title: 'Ajoutez votre logo', text: 'Cliquez dans le cadre « Cliquer pour uploader votre logo » et choisissez une image PNG, JPG ou WebP de 2 Mo au plus. Il s’affiche dans l’en-tête du devis.' },
      { title: 'Rédigez vos « Conditions Générales de Vente »', text: 'Saisissez ou collez votre texte, mettez-le en forme avec la barre d’outils, puis cliquez sur le bouton « Enregistrer » de ce bloc.' },
    ],
    notes: [
      'L’identité et les conditions générales ont chacune leur bouton « Enregistrer ».',
      'Les conditions générales sont ajoutées à la suite de vos devis. Sans texte, rien n’est ajouté.',
    ],
  },
  {
    id: 'mot-de-passe',
    category: 'compte',
    title: 'Changer de mot de passe ou le retrouver',
    summary: 'Le mot de passe se change depuis la page de connexion, par un lien reçu par email.',
    keywords: ['mot de passe', 'oublié', 'perdu', 'réinitialiser', 'changer', 'connexion', 'se connecter', 'identifiants', 'sécurité', 'déconnexion'],
    steps: [
      { title: 'Ouvrez la page de connexion', text: 'Si vous êtes connecté, déconnectez-vous d’abord : l’icône « Se déconnecter » est en bas du menu, à droite de votre nom.' },
      { title: 'Saisissez votre adresse email', text: 'Laissez le mot de passe vide.' },
      { title: 'Cliquez sur « Mot de passe oublié ? »', text: 'Un message confirme qu’un lien de réinitialisation vient d’être envoyé si un compte existe pour cette adresse.' },
      { title: 'Ouvrez le lien reçu par email', text: 'Il mène à la page « Nouveau mot de passe ». Il est valable une heure et ne sert qu’une fois.' },
      { title: 'Choisissez le nouveau mot de passe', text: 'Six caractères au moins, à saisir deux fois, puis « Mettre à jour le mot de passe ». L’app vous ramène à la connexion.' },
    ],
    notes: [
      'Il n’y a pas d’écran pour changer le mot de passe une fois connecté : le parcours est le même que pour un mot de passe oublié.',
      'Si le lien a expiré, refaites une demande depuis la page de connexion.',
      'Pas d’email reçu ? Vérifiez l’adresse saisie et le dossier des courriers indésirables.',
    ],
  },
  {
    id: 'notifications',
    category: 'compte',
    title: 'Lire vos notifications',
    summary: 'Nouvelles demandes de devis, événement qui approche, stock bas : l’app vous prévient.',
    keywords: ['notifications', 'alertes', 'cloche', 'rappels', 'non lues', 'demandes', 'avertissements', 'messages'],
    href: '/notifications',
    steps: [
      { title: 'Cliquez sur la cloche, en haut à droite', text: 'Le chiffre indique les notifications non lues. La liste montre les plus récentes : un clic sur l’une d’elles la marque comme lue et ouvre la page concernée.' },
      { title: 'Cliquez sur « Voir toutes les notifications »', text: 'La page « Notifications » les range par jour.' },
      { title: 'Filtrez avec « Toutes », « Non lues » et « Lues »' },
      { title: 'Marquez ce que vous avez lu', text: '« Marquer lu » agit sur une notification, « Tout marquer lu » sur toutes.' },
      { title: 'Allez à la page concernée avec « Voir »', text: 'Le bouton « Supprimer » apparaît au survol de la notification.' },
    ],
    notes: [
      'La mention « Urgent » signale une notification à traiter en priorité.',
    ],
  },
];
