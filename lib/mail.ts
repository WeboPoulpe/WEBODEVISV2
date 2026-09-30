import 'server-only';
import { headers } from 'next/headers';

interface Mail {
  to: string;
  subject: string;
  html: string;
  /** Nom d'expéditeur affiché (par exemple l'entreprise du traiteur). L'adresse reste celle de WeboDevis. */
  fromName?: string;
  /** Adresse à laquelle partent les réponses. */
  replyTo?: string | null;
}

const DEFAULT_FROM = 'WeboDevis <onboarding@resend.dev>';

/**
 * Envoi d'email via Resend. Sans RESEND_API_KEY (développement), le message n'est pas envoyé :
 * son objet et son destinataire sont écrits dans la console du serveur.
 */
export async function sendMail({ to, subject, html, fromName, replyTo }: Mail): Promise<{ error: string | null }> {
  const key = process.env.RESEND_API_KEY;
  const configured = process.env.MAIL_FROM || DEFAULT_FROM;
  const address = /<([^>]+)>/.exec(configured)?.[1] ?? configured;
  // Les guillemets et chevrons d'un nom d'entreprise casseraient l'en-tête d'expéditeur.
  const from = fromName ? `${fromName.replace(/["<>\r\n]/g, '').trim()} <${address}>` : configured;

  if (!key) {
    console.info(`[mail non envoyé — RESEND_API_KEY absent] à ${to} : ${subject}`);
    return { error: null };
  }
  // Domaines réservés aux essais : aucune boîte n'existe derrière, l'envoi ne ferait que rebondir.
  if (/\.(local|test|example|invalid)$/i.test(to.trim())) {
    console.info(`[mail non envoyé — adresse d'essai] à ${to} : ${subject}`);
    return { error: null };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) {
      console.error(`[mail] refusé par Resend (${res.status}) : ${(await res.text()).slice(0, 300)}`);
      return { error: 'L’email n’a pas pu être envoyé.' };
    }
    return { error: null };
  } catch (e) {
    console.error('[mail] envoi impossible :', e instanceof Error ? e.message : e);
    return { error: 'L’email n’a pas pu être envoyé.' };
  }
}

/** Adresse publique de l'app, pour les liens dans les emails. */
export async function appOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (host) return `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || /^\d/.test(host) ? 'http' : 'https')}://${host}`;
  return (process.env.NEXTAUTH_URL ?? 'http://localhost:3001').replace(/\/$/, '');
}
