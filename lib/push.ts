import 'server-only';
import webpush from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { push_subscriptions } from '@/db/schema';

// Notifications push : envoi aux appareils d'un compte (traiteur) ou d'un extra. Sans clés VAPID configurées,
// rien ne part et rien ne casse. Un appareil qui n'existe plus (désinstallé, permission retirée) est oublié.

export interface PushMessage {
  title: string;
  body: string;
  /** Page ouverte au toucher de la notification. */
  url: string;
  /** Une notification du même tag remplace la précédente au lieu de s'empiler. */
  tag?: string;
}

let configured: boolean | null = null;
function ready() {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@webomax.fr', pub!, priv!);
  return configured;
}

export const pushEnabled = () => ready();

async function send(rows: { id: string; endpoint: string; p256dh: string; auth: string }[], message: PushMessage) {
  if (!ready() || rows.length === 0) return 0;
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, JSON.stringify(message), { TTL: 60 * 60 * 24 });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) gone.push(r.id);
      else console.warn('[push] envoi impossible', status ?? e);
    }
  }));
  if (gone.length) await db.delete(push_subscriptions).where(inArray(push_subscriptions.id, gone));
  return sent;
}

const columns = { id: push_subscriptions.id, endpoint: push_subscriptions.endpoint, p256dh: push_subscriptions.p256dh, auth: push_subscriptions.auth };

export async function pushToUser(userId: string, message: PushMessage) {
  return send(await db.select(columns).from(push_subscriptions).where(eq(push_subscriptions.user_id, userId)), message);
}

export async function pushToExtra(extraId: string, message: PushMessage) {
  return send(await db.select(columns).from(push_subscriptions).where(eq(push_subscriptions.extra_id, extraId)), message);
}

export interface BrowserSubscription { endpoint: string; keys?: { p256dh?: string; auth?: string } }

/** Enregistre l'appareil pour un compte ou un extra (un appareil n'appartient qu'à un seul des deux). */
export async function saveSubscription(sub: BrowserSubscription, owner: { userId: string } | { extraId: string }) {
  const endpoint = String(sub?.endpoint ?? '');
  const p256dh = String(sub?.keys?.p256dh ?? ''), auth = String(sub?.keys?.auth ?? '');
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return { error: 'Cet appareil n’a pas pu être enregistré.' };
  }
  const values = { endpoint, p256dh, auth, user_id: 'userId' in owner ? owner.userId : null, extra_id: 'extraId' in owner ? owner.extraId : null };
  await db.insert(push_subscriptions).values(values)
    .onConflictDoUpdate({ target: push_subscriptions.endpoint, set: { p256dh, auth, user_id: values.user_id, extra_id: values.extra_id } });
  return { error: null };
}

export async function forgetSubscription(endpoint: string) {
  await db.delete(push_subscriptions).where(eq(push_subscriptions.endpoint, String(endpoint ?? '')));
}
