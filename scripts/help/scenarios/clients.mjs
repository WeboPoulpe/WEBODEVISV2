// Scénarios des vidéos de la rubrique « Clients et demandes ». Un scénario par guide, même identifiant.
//
// Le compte de démonstration n'enregistre rien : chaque vidéo s'arrête avant les boutons qui changent
// de page ou relisent la liste après une écriture (« Créer le client », « Importer 3 clients », « Créer le devis »).

/** Collage : le curseur clique dans le champ, puis tout le texte arrive d'un coup, comme un Ctrl+V. */
async function paste(act, field, text) {
  await act.click(field);
  await act.pause(300);
  await field.fill(text);
  await act.pause(900);
}

/**
 * Montre un bouton sans cliquer : le curseur s'arrête sur son bord droit, pour que le libellé reste lisible
 * (`act.hover` vise le milieu et cache le texte des petits boutons).
 */
async function pointAt(page, act, target) {
  await target.waitFor({ state: 'visible', timeout: 20_000 });
  await target.scrollIntoViewIfNeeded();
  await act.pause(150);
  const box = await target.boundingBox();
  await page.mouse.move(box.x + box.width - 10, box.y + box.height - 6, { steps: 32 });
  await act.pause(300);
}

// Quatre lignes copiées depuis un tableur, titres compris ; la dernière n'a pas d'email.
const LIGNES = [
  ['Prénom', 'Nom', 'Entreprise', 'Email', 'Téléphone'],
  ['Claire', 'Martin', '', 'claire.martin@exemple.fr', '06 12 34 56 78'],
  ['Julien', 'Roy', 'Domaine des Coteaux', 'j.roy@coteaux.exemple.fr', '03 80 55 12 40'],
  ['Inès', 'Morel', '', 'ines.morel@exemple.fr', '06 98 76 54 32'],
  ['Hugo', 'Petit', '', '', '06 45 45 45 45'],
].map((cells) => cells.join('\t')).join('\n');

export default {
  // Ajouter un client à la main (la vidéo s'arrête avant « Créer le client », qui revient à la liste).
  'ajouter-client': {
    start: '/clients',
    async run({ page, act }) {
      await act.click(page.getByRole('link', { name: 'Nouveau client' }));
      await page.waitForURL(/\/clients\/nouveau/);
      await page.getByPlaceholder('Jean', { exact: true }).waitFor({ timeout: 20_000 });
      await act.pause(700);
      await act.type(page.getByPlaceholder('Jean', { exact: true }), 'Paul');
      await act.type(page.getByPlaceholder('Dupont', { exact: true }), 'Garnier');
      await act.type(page.getByPlaceholder('jean@exemple.fr'), 'paul.garnier@exemple.fr');
      await act.type(page.getByPlaceholder('06 00 00 00 00'), '06 24 18 30 52');
      await act.type(page.getByPlaceholder('12 rue de la Paix, 75001 Paris'), '8 rue du Lavoir, 21000 Dijon');
      await pointAt(page, act, page.getByRole('button', { name: 'Créer le client' }));
      await act.pause(1300);
    },
  },

  // Retrouver un client et ouvrir sa fiche : coordonnées, contacts, notes.
  'fiche-client': {
    start: '/clients',
    async run({ page, act }) {
      await act.click(page.getByRole('tab', { name: 'Entreprises' }));
      await act.pause(500);
      await act.type(page.getByLabel('Rechercher un client'), 'sor');
      await act.pause(500);
      await act.click(page.getByRole('button', { name: /Groupe Sorélia/ }).first());
      await act.pause(1500);
      const fiche = page.locator('.animate-slide-in-right');
      await act.click(fiche.getByRole('button', { name: 'Notes', exact: true }));
      await act.pause(900);
      const notes = fiche.locator('textarea');
      await act.click(notes);
      await page.keyboard.press('Control+End');
      await page.keyboard.type('\nRappeler en janvier pour le séminaire de printemps.', { delay: 50 });
      await act.pause(500);
      await act.click(fiche.getByRole('button', { name: 'Sauvegarder les notes' }));
      await act.pause(900);
    },
  },

  // Importer des clients en masse par collage (la vidéo s'arrête avant « Importer 3 clients »).
  'importer-clients': {
    start: '/clients',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: 'Importer' }));
      await act.pause(900);
      await paste(act, page.getByLabel('Collez vos clients, une ligne par client'), LIGNES);
      await act.pause(2200); // le temps de lire l'aperçu : trois clients prêts, une ligne laissée de côté
      await pointAt(page, act, page.getByRole('button', { name: 'Choisir un fichier CSV' }));
      await act.pause(900);
      await pointAt(page, act, page.getByRole('button', { name: /^Importer \d+ clients?$/ }));
      await act.pause(1300);
    },
  },

  // Traiter une demande reçue : l'ouvrir, changer son statut, préparer le devis.
  'demandes-devis': {
    start: '/prospects',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: /Laure Chevalier/ }).first());
      await act.pause(1200);
      await act.click(page.getByRole('button', { name: 'Nouveau', exact: true }).last());
      await act.pause(500);
      await act.click(page.getByRole('button', { name: 'Brochure envoyée', exact: true }).last());
      await act.pause(800);
      await act.click(page.getByRole('button', { name: 'Créer un devis', exact: true }));
      await act.pause(1500);
      await pointAt(page, act, page.getByRole('button', { name: 'Créer le devis', exact: true }));
      await act.pause(1300);
    },
  },

  // Le formulaire de demande : ouvrir son lien, le copier. La vidéo reste dans la fenêtre du lien :
  // « Voir le formulaire » ouvre un autre onglet, qui ne s'enregistre pas.
  'formulaire-demande': {
    start: '/prospects',
    async run({ page, act }) {
      // Sans cette autorisation, le navigateur de l'enregistreur refuse la copie dans le presse-papiers.
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await act.pause(500);
      await act.click(page.getByRole('button', { name: 'Mon formulaire' }));
      await page.getByText('Lien partageable').waitFor({ timeout: 20_000 });
      await act.pause(1400);
      await act.click(page.getByRole('button', { name: 'Copier' }));
      await act.pause(1500);
      await act.hover(page.getByPlaceholder('https://…'));
      await act.pause(1200);
      await pointAt(page, act, page.getByRole('link', { name: 'Voir le formulaire' }));
      await act.pause(1600);
    },
  },
};
