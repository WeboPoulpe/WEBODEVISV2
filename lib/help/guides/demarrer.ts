import type { HelpGuide } from '../types';

export const demarrer: HelpGuide[] = [
  {
    id: 'tableau-de-bord',
    category: 'demarrer',
    title: 'Lire le tableau de bord',
    summary: 'Votre activité d’un coup d’œil : chiffre d’affaires, couverts à venir, devis en cours, prochains événements.',
    keywords: ['accueil', 'chiffre d’affaires', 'ca', 'statistiques', 'période', 'recherche'],
    href: '/',
    steps: [
      { title: 'Choisissez la période', text: '« Ce mois », « Trimestre » ou « Année » : les quatre chiffres du haut se recalculent.' },
      { title: 'Regardez les prochains événements', text: 'Ce sont vos devis confirmés, du plus proche au plus lointain. Un clic ouvre la fiche de l’événement.' },
      { title: 'Cherchez depuis n’importe quelle page', text: 'La barre du haut retrouve un devis, un client ou un événement par son nom.' },
    ],
    notes: ['Le taux de conversion compare les devis confirmés à l’ensemble des devis de la période.'],
  },
  {
    id: 'premier-devis',
    category: 'demarrer',
    title: 'Créer votre premier devis',
    summary: 'La création guidée pose l’essentiel en trois écrans : l’événement, le client, le style.',
    keywords: ['nouveau devis', 'créer', 'création', 'premier', 'commencer', 'débuter', 'proposition', 'mariage', 'couverts', 'client', 'style'],
    href: '/devis/nouveau',
    steps: [
      { title: 'Cliquez sur « Nouveau devis »', text: 'Le bouton est en haut à droite de chaque page.' },
      { title: 'Décrivez l’événement', text: 'Choisissez le type, la date et le nombre de couverts. Le lieu est facultatif.' },
      { title: 'Choisissez le client', text: 'Cherchez-le par son nom, son email ou son entreprise. Pour une nouvelle personne, passez sur « Nouveau client ».' },
      { title: 'Choisissez le style', text: '« Standard », « Mariage » ou « Business », puis la langue du devis.' },
      { title: 'Cliquez sur « Créer le devis »', text: 'Le devis s’ouvre dans l’éditeur.' },
    ],
    notes: [
      'Le nouveau devis apparaît dans la page Devis avec le statut « Devis à faire ».',
      'Un nouveau client saisi avec son email est ajouté à vos clients.',
    ],
  },
  {
    id: 'installer-application',
    category: 'demarrer',
    title: 'Installer WeboDevis sur votre téléphone',
    summary: 'Ajoutez WeboDevis à l’écran d’accueil pour l’ouvrir comme une application.',
    keywords: ['installer', 'application', 'appli', 'téléphone', 'mobile', 'smartphone', 'iphone', 'android', 'tablette', 'écran d’accueil', 'icône', 'raccourci'],
    steps: [
      { title: 'Ouvrez WeboDevis dans le navigateur de votre téléphone', text: 'Safari sur iPhone, Chrome sur Android. Connectez-vous à votre compte.' },
      { title: 'Sur iPhone, touchez le bouton Partager', text: 'Choisissez « Sur l’écran d’accueil », puis validez avec « Ajouter ».' },
      { title: 'Sur Android, ouvrez le menu de Chrome', text: 'Touchez les trois points en haut à droite, puis « Installer l’application ».' },
      { title: 'Lancez WeboDevis depuis son icône', text: 'Il s’ouvre en plein écran, sans la barre d’adresse du navigateur.' },
    ],
    notes: [
      'L’application installée est la même que dans le navigateur : vous y retrouvez votre compte et vos données.',
      'Une connexion internet reste nécessaire pour travailler.',
    ],
  },
];
