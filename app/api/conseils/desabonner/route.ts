import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { readTicket } from '@/server/tickets';

// Désinscription des emails de conseils, depuis le lien de l'email (jeton signé, sans connexion).
export async function GET(request: NextRequest) {
  const ticket = readTicket<{ k: string; u: string }>(request.nextUrl.searchParams.get('t'));
  const page = (title: string, text: string, status = 200) => new NextResponse(
    `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>`
    + `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F3EEE6;font-family:system-ui,sans-serif;color:#1f2937;padding:24px;text-align:center">`
    + `<div><h1 style="font-size:24px;margin:0">${title}</h1><p style="color:#4b5563;max-width:40ch;margin:12px auto 0">${text}</p></div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
  if (!ticket || ticket.k !== 'tips' || typeof ticket.u !== 'string') return page('Lien invalide', 'Ce lien de désinscription n’est pas valable.', 400);
  await db.update(profiles).set({ tips_opt_out: true }).where(eq(profiles.id, ticket.u));
  return page('C’est noté', 'Vous ne recevrez plus nos conseils par email. Les emails liés à votre activité (devis acceptés, factures…) continuent d’arriver.');
}
