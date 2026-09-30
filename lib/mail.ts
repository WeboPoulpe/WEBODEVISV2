import 'server-only';

interface Mail {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envoi d'email via Resend. Sans RESEND_API_KEY (développement), le message est
 * écrit dans la console du serveur au lieu d'être envoyé.
 */
export async function sendMail({ to, subject, html }: Mail): Promise<{ error: string | null }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[mail non envoyé — RESEND_API_KEY absent] à ${to} : ${subject}\n${html}`);
    return { error: null };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? 'WeboDevis <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) return { error: `Envoi impossible (${res.status})` };
  return { error: null };
}
