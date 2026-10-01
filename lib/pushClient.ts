'use client';

// Côté navigateur : activer ou couper les notifications push sur cet appareil.
// L'abonnement est ensuite enregistré par une action serveur (compte du traiteur ou page de l'extra).

export type PushSupport = 'ok' | 'unsupported' | 'ios-install' | 'denied';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Ce que cet appareil permet : sur iPhone, les notifications n'existent qu'une fois la page installée. */
export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if (isIos() && !isStandalone()) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !window.isSecureContext) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/** L'abonnement en cours sur cet appareil, s'il existe. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Demande la permission puis abonne l'appareil. Renvoie l'abonnement à envoyer au serveur, ou un message. */
export async function subscribeDevice(): Promise<{ subscription: PushSubscriptionJSON | null; error: string | null }> {
  const support = pushSupport();
  if (support === 'ios-install') return { subscription: null, error: 'Sur iPhone, installez d’abord la page sur l’écran d’accueil, puis ouvrez-la depuis son icône.' };
  if (support === 'denied') return { subscription: null, error: 'Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur.' };
  if (support !== 'ok') return { subscription: null, error: 'Ce navigateur ne permet pas les notifications.' };
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return { subscription: null, error: 'Les notifications ne sont pas encore disponibles.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { subscription: null, error: 'Notifications refusées. Vous pourrez les activer plus tard.' };
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  return { subscription: sub.toJSON(), error: null };
}

/** Coupe les notifications sur cet appareil ; renvoie l'adresse d'abonnement à oublier côté serveur. */
export async function unsubscribeDevice(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => undefined);
  return endpoint;
}
