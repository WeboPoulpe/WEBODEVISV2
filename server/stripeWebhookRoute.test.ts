import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Réponses du webhook : signature refusée (400), traitement en échec (500), sinon reçu.

const constructEvent = vi.fn();
const handleStripeEvent = vi.fn();
vi.mock('@/lib/stripe', () => ({ stripe: () => ({ webhooks: { constructEvent } }) }));
vi.mock('@/server/stripeSync', () => ({ handleStripeEvent: (e: unknown) => handleStripeEvent(e) }));

const { POST } = await import('@/app/api/stripe/webhook/route');
const post = (signature: string | null) => new NextRequest('http://localhost/api/stripe/webhook', {
  method: 'POST', body: '{"id":"evt_1"}', headers: signature ? { 'stripe-signature': signature } : {},
});

beforeEach(() => {
  process.env.WEBHOOK_SECRET_STRIPE = 'whsec_test';
  constructEvent.mockReset();
  handleStripeEvent.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/stripe/webhook', () => {
  it('vérifie la signature sur le corps brut, puis traite l’événement', async () => {
    constructEvent.mockReturnValue({ id: 'evt_1', type: 'charge.refunded' });
    const res = await POST(post('t=1,v1=abc'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(constructEvent).toHaveBeenCalledWith('{"id":"evt_1"}', 't=1,v1=abc', 'whsec_test');
    expect(handleStripeEvent).toHaveBeenCalledWith({ id: 'evt_1', type: 'charge.refunded' });
  });

  it('signature invalide ou absente : 400, rien n’est traité', async () => {
    constructEvent.mockImplementation(() => { throw new Error('No signatures found'); });
    expect((await POST(post('faux'))).status).toBe(400);
    expect((await POST(post(null))).status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it('traitement en échec : 500, pour que Stripe réessaie', async () => {
    constructEvent.mockReturnValue({ id: 'evt_1', type: 'invoice.paid' });
    handleStripeEvent.mockRejectedValue(new Error('base injoignable'));
    expect((await POST(post('t=1,v1=abc'))).status).toBe(500);
  });
});
