import { expect, it } from 'vitest';
import { mergeRecipients } from './brochureRecipients';

it('ajoute les adresses tapées aux clients choisis, sans doublon', () => {
  const r = mergeRecipients([{ email: 'julie@exemple.fr', name: 'Julie', customerId: 'c1' }], 'JULIE@exemple.fr, marc@exemple.fr');
  expect(r).toEqual({ list: [{ email: 'julie@exemple.fr', name: 'Julie', customerId: 'c1' }, { email: 'marc@exemple.fr' }], invalid: [] });
});

it('signale les adresses invalides', () => {
  expect(mergeRecipients([], 'ok@exemple.fr; pas-un-email').invalid).toEqual(['pas-un-email']);
});

it('ignore un client choisi sans adresse', () => {
  expect(mergeRecipients([{ email: '', name: 'Sans email', customerId: 'c2' }], '').list).toEqual([]);
});
