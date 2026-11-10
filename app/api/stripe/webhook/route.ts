import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { handleStripeEvent } from '@/server/stripeSync';

// Webhook Stripe (abonnement). Il arrive sans session : la signature, vérifiée sur le corps brut avec
// WEBHOOK_SECRET_STRIPE, est la seule preuve qu'il vient de Stripe. Une erreur répond 500 pour que Stripe réessaie.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET_STRIPE;
  const signature = request.headers.get('stripe-signature');
  if (!secret) {
    console.error('[stripe] WEBHOOK_SECRET_STRIPE manquante');
    return NextResponse.json({ error: 'Webhook non configuré' }, { status: 500 });
  }
  const body = await request.text();
  let event: Stripe.Event;
  try {
    if (!signature) throw new Error('signature absente');
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    console.warn('[stripe] signature invalide :', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }
  try {
    await handleStripeEvent(event);
  } catch (e) {
    console.error(`[stripe] événement ${event.id} (${event.type}) en échec :`, e);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
