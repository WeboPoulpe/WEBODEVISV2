import 'server-only';
import crypto from 'node:crypto';

// Jetons signés, sans stockage : la signature prouve qu'ils viennent du serveur et n'ont pas été modifiés.
// Le contenu est lisible par qui détient le jeton : ne jamais y mettre une information à garder secrète.

const secret = () => {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET est requis');
  return s;
};

export const hmac = (value: string) => crypto.createHmac('sha256', secret()).update(value).digest('base64url');

export function signTicket(payload: Record<string, unknown>, ttlMs: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString('base64url');
  return `${body}.${hmac(body)}`;
}

export function readTicket<T extends Record<string, unknown>>(ticket: unknown): (T & { exp: number }) | null {
  if (typeof ticket !== 'string') return null;
  const [body, signature] = ticket.split('.');
  if (!body || !signature) return null;
  const expected = hmac(body);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp: number };
    return typeof payload.exp === 'number' && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
