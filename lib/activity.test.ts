import { describe, expect, it } from 'vitest';
import { activitySummary, entityHref, TRACKED_TABLES } from './activity';

describe('activitySummary', () => {
  it('une création au masculin', () => {
    expect(activitySummary('creation', 'client', 'Julie Martin')).toBe('Client Julie Martin créé');
  });
  it('une création en lot', () => {
    expect(activitySummary('creation', 'client', '', 214)).toBe('214 clients créés');
  });
  it('une modification de devis', () => {
    expect(activitySummary('modification', 'devis', 'D-2026-042 — Mariage Dupont')).toBe('Devis D-2026-042 — Mariage Dupont modifié');
  });
  it('accorde au féminin', () => {
    expect(activitySummary('creation', 'facture', 'F-2026-017')).toBe('Facture F-2026-017 créée');
    expect(activitySummary('suppression', 'brochure', 'Mariages 2027')).toBe('Brochure Mariages 2027 supprimée');
    expect(activitySummary('suppression', 'prestation', '', 3)).toBe('3 prestations supprimées');
  });
  it('sans libellé, le nom de l’élément seul', () => {
    expect(activitySummary('modification', 'parametres', '')).toBe('Paramètres de l’entreprise modifiés');
  });
});

describe('entityHref', () => {
  it('mène au devis', () => expect(entityHref('devis', 'x')).toBe('/devis/x'));
  it('mène à la brochure', () => expect(entityHref('brochure', 'b')).toBe('/brochures/b'));
  it('sans identifiant, pas de lien vers un élément', () => expect(entityHref('client', null)).toBe('/clients'));
});

it('suit les tables principales, pas les tables techniques', () => {
  for (const t of ['quotes', 'quote_services', 'customers', 'prestations', 'ingredients', 'extras', 'suppliers', 'supplier_orders', 'profiles']) {
    expect(TRACKED_TABLES[t], t).toBeDefined();
  }
  for (const t of ['notifications', 'brochure_page_stats', 'quote_events', 'activity_log']) expect(TRACKED_TABLES[t], t).toBeUndefined();
  expect(TRACKED_TABLES.quote_services).toMatchObject({ entity: 'devis', id: 't0.quote_id', forceAction: 'modification' });
});
