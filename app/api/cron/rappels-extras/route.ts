import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { event_extras, extras, profiles, quotes } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { appOrigin, sendMail } from '@/lib/mail';
import { missionReminderEmail } from '@/lib/mail/templates';
import { pushToExtra } from '@/lib/push';

// Rappel de la veille aux extras confirmés : email et notification. Lancé chaque jour en fin d'après-midi par
// Vercel (vercel.json), qui envoie « Authorization: Bearer CRON_SECRET ». Un rappel n'est envoyé qu'une fois.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  // Demain, à l'heure de Paris.
  const parisToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const tomorrow = new Date(parisToday + 'T12:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const day = tomorrow.toISOString().slice(0, 10);

  const rows = await db.select({
    id: event_extras.id, extraId: extras.id, extraName: extras.name, email: extras.email, token: extras.access_token, owner: extras.user_id,
    arrival: event_extras.arrival_time, departure: event_extras.departure_time, notes: event_extras.mission_notes,
    eventType: quotes.event_type, eventDate: quotes.event_date, location: quotes.event_location,
    company: profiles.company_name, first: profiles.first_name, last: profiles.last_name,
  })
    .from(event_extras)
    .innerJoin(extras, eq(extras.id, event_extras.extra_id))
    .innerJoin(quotes, eq(quotes.id, event_extras.quote_id))
    .leftJoin(profiles, eq(profiles.id, extras.user_id))
    .where(and(eq(quotes.event_date, day), eq(event_extras.status, 'confirme'), isNull(event_extras.reminded_at)));

  const origin = await appOrigin();
  let sent = 0;
  for (const r of rows) {
    if (isDemoUser(r.owner)) continue;
    const company = r.company || [r.first, r.last].filter(Boolean).join(' ') || 'Votre traiteur';
    const link = `${origin}/e/${r.token}`;
    const pushed = await pushToExtra(r.extraId, {
      title: `Demain : ${r.eventType || 'mission'} avec ${company}`,
      body: `${r.arrival ? `Arrivée à ${r.arrival}` : 'Votre mission de demain'}${r.location ? `, ${r.location}` : ''}.`,
      url: `/e/${r.token}`, tag: `rappel-${r.id}`,
    });
    const mailed = r.email
      ? !(await sendMail({ to: r.email, fromName: company, ...missionReminderEmail({ mission: { extraName: r.extraName, companyName: company, eventType: r.eventType, eventDate: r.eventDate, location: r.location, arrival: r.arrival, departure: r.departure, notes: r.notes }, link }) })).error
      : false;
    if (pushed || mailed) {
      await db.update(event_extras).set({ reminded_at: new Date().toISOString() }).where(eq(event_extras.id, r.id));
      sent++;
    }
  }
  return NextResponse.json({ day, missions: rows.length, reminded: sent });
}
