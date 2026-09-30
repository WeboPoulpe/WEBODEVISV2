// Scénarios des vidéos de la rubrique « Démarrer ». Un scénario par guide, même identifiant.
// « installer-application » est un guide écrit : il n'a pas de scénario.

/** Pose une valeur d'un coup dans un champ (une date, par exemple) après y avoir cliqué. */
async function put(act, field, value) {
  await act.click(field);
  await field.fill(value);
  await act.pause(500);
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

export default {
  'tableau-de-bord': {
    start: '/',
    async run({ page, act }) {
      await act.click(page.getByRole('tab', { name: 'Trimestre' }));
      await act.click(page.getByRole('tab', { name: 'Année' }));
      await act.click(page.getByRole('tab', { name: 'Ce mois' }));
      await act.hover(page.getByRole('heading', { name: 'Prochains événements confirmés' }));
      await act.hover(page.locator('a[href^="/evenements/"]').first());
      await act.pause(700);
      await act.type(page.getByPlaceholder('Rechercher un devis, un client, un événement'), 'mariage');
      await act.pause(1200);
    },
  },

  // Création guidée d'un devis : événement, client, style. La vidéo s'arrête avant « Créer le devis » :
  // dans la démonstration, le devis créé n'est pas enregistré et la page d'arrivée ne le trouverait pas.
  'premier-devis': {
    start: '/devis/nouveau',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: 'Mariage', exact: true }));
      await put(act, page.getByLabel('Date', { exact: true }), '2027-06-12');
      await act.type(page.getByLabel('Couverts'), '120');
      await act.type(page.getByLabel(/^Lieu/), 'Domaine des Hauts Tilleuls');
      await act.click(page.getByRole('button', { name: 'Continuer' }));
      await act.pause(500);
      await act.type(page.getByLabel('Rechercher un client'), 'tess');
      await act.click(page.getByRole('button', { name: /Margaux Tessier/ }));
      await act.pause(700);
      await act.click(page.getByRole('button', { name: 'Continuer' }));
      await act.pause(500);
      await act.click(page.getByRole('button', { name: /^Mariage/ }));
      await act.pause(500);
      await pointAt(page, act, page.getByRole('button', { name: 'Créer le devis' }));
      await act.pause(1300);
    },
  },
};
