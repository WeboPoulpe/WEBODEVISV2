// Scénarios des vidéos de la rubrique « Compte ». Un scénario par guide, même identifiant.
// Le guide « mot-de-passe » est écrit, sans vidéo : le parcours passe par la page de connexion et par un email.
// L'envoi du logo est fermé dans la démonstration : la vidéo montre la zone d'envoi sans cliquer dessus.

// ── Outils locaux ─────────────────────────────────────────────────────────────
/** Champ déjà rempli : remplace sa valeur au lieu d'écrire à la suite. */
const retype = async (act, page, field, text) => {
  await act.click(field);
  await page.keyboard.press('Control+A');
  await field.pressSequentially(text, { delay: 70 });
  await act.pause(500);
};

export default {
  entreprise: {
    start: '/parametres',
    async run({ page, act }) {
      await retype(act, page, page.getByPlaceholder('+33 1 23 45 67 89'), '01 99 00 21 07');
      await act.click(page.getByRole('button', { name: 'Enregistrer' }).first());
      await act.pause(1000);
      await act.scroll(420);
      await act.hover(page.getByText('Cliquer pour uploader votre logo'));
      await act.pause(1000);
      await act.scroll(420);
      await act.hover(page.getByRole('heading', { name: 'Conditions Générales de Vente' }));
      await act.pause(700);
      await act.scroll(420);
      await act.click(page.getByRole('button', { name: 'Enregistrer' }).last());
      await act.pause(900);
    },
  },

  notifications: {
    start: '/notifications',
    async run({ page, act }) {
      await act.click(page.getByRole('button', { name: /^Non lues/ }));
      await act.pause(700);
      await act.click(page.getByRole('button', { name: 'Marquer lu', exact: true }).first());
      await act.pause(900);
      await act.hover(page.getByRole('link', { name: /^Voir/ }).first());
      await act.pause(700);
      await act.click(page.getByRole('button', { name: 'Tout marquer lu' }));
      await act.pause(900);
      await act.click(page.getByRole('button', { name: /^Toutes/ }));
      await act.pause(900);
    },
  },
};
