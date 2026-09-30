import { describe, expect, it } from 'vitest';
import { notificationHref } from './notifications';

describe('notificationHref', () => {
  it('traduit les adresses de l’ancienne version', () => {
    expect(notificationHref({ type: 'prospect_request', action_url: '/prospect-requests' })).toBe('/prospects');
    expect(notificationHref({ type: 'upcoming_event', action_url: '/events/0d3e0000-0000-4000-8000-000000000001' })).toBe('/evenements/0d3e0000-0000-4000-8000-000000000001');
  });
  it('garde les adresses actuelles', () => {
    expect(notificationHref({ type: 'stock_alert', action_url: '/stock?ing=abc' })).toBe('/stock?ing=abc');
    expect(notificationHref({ type: 'upcoming_event', action_url: '/evenements/abc' })).toBe('/evenements/abc');
  });
  it('une adresse inconnue ou absente mène à la page du type, jamais à une page introuvable', () => {
    expect(notificationHref({ type: 'prospect_request', action_url: '/page-disparue' })).toBe('/prospects');
    expect(notificationHref({ type: 'stock_alert', action_url: null })).toBe('/stock');
    expect(notificationHref({ type: 'system_update', action_url: 'https://ailleurs.example' })).toBe('/notifications');
  });
});
