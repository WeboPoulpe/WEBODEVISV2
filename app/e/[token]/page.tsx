export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Clock, MapPin, Phone, Users } from 'lucide-react';
import { adminSupabase } from '@/lib/supabase/admin';
import ExtraPrintButton from './ExtraPrintButton';

interface Mission {
  id: string;
  status: string;
  arrival_time: string | null;
  mission_notes: string | null;
  assign_courses: boolean;
  quote: {
    id: string;
    client_name: string;
    event_type: string;
    event_date: string | null;
    event_location: string | null;
    guest_count: number | null;
  };
}

const dateFr = (s?: string | null) => {
  if (!s) return '';
  try {
    return new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch { return s; }
};

const statusLabel: Record<string, { label: string; color: string }> = {
  a_solliciter: { label: 'En attente de confirmation', color: 'bg-amber-100 text-amber-800' },
  confirme:     { label: 'Confirmée',                  color: 'bg-primary-50 text-primary-dark' },
  present:      { label: 'Présence notée',             color: 'bg-emerald-100 text-emerald-800' },
};

export default async function ExtraPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Validate token and get extra
  const { data: extra } = await adminSupabase
    .from('extras')
    .select('id, name, role, phone, email')
    .eq('access_token', token)
    .single();

  if (!extra) notFound();

  // Get their event assignments
  const { data: rawAssignments } = await adminSupabase
    .from('event_extras')
    .select('id, status, arrival_time, mission_notes, assign_courses, quote_id')
    .eq('extra_id', extra.id)
    .order('created_at');

  const assignments = rawAssignments ?? [];

  // Fetch the quotes for these assignments
  const quoteIds = assignments.map((a: { quote_id: string }) => a.quote_id);
  const { data: quotes } = quoteIds.length > 0
    ? await adminSupabase
        .from('quotes')
        .select('id, client_name, event_type, event_date, event_location, guest_count')
        .in('id', quoteIds)
    : { data: [] };

  type QuoteRow = Mission['quote'];
  type RawAssignment = { id: string; status: string; arrival_time: string | null; mission_notes: string | null; assign_courses: boolean; quote_id: string };

  const quoteMap = new Map<string, QuoteRow>((quotes ?? []).map((q: QuoteRow) => [q.id, q]));

  const missions: Mission[] = (assignments as RawAssignment[])
    .map((a) => ({
      id: a.id,
      status: a.status,
      arrival_time: a.arrival_time,
      mission_notes: a.mission_notes,
      assign_courses: a.assign_courses,
      quote: quoteMap.get(a.quote_id),
    }))
    .filter((m): m is Mission => !!m.quote)
    .sort((a, b) => {
      const da = a.quote.event_date ?? '';
      const db = b.quote.event_date ?? '';
      return da.localeCompare(db);
    });

  const upcoming = missions.filter(
    (m) => !m.quote.event_date || new Date(m.quote.event_date + 'T23:59:59') >= new Date(),
  );

  const initials = extra.name
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-br from-primary-darker to-primary rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xl">{initials}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">{extra.name}</h1>
            {extra.role && <p className="text-white/70 text-sm mt-0.5">{extra.role}</p>}
            {extra.phone && <p className="text-white/70 text-sm mt-1 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" aria-hidden />{extra.phone}</p>}
          </div>
        </div>
      </div>

      {/* Print button (client component) */}
      <ExtraPrintButton />

      {/* Missions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Mes missions {upcoming.length > 0 && `(${upcoming.length})`}
        </h2>

        {upcoming.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-gray-700 font-medium">Aucune mission à venir</p>
            <p className="text-sm text-gray-500 mt-1">Les prochaines apparaîtront ici dès que votre traiteur vous les aura confiées.</p>
          </div>
        ) : (
          upcoming.map((m) => {
            const st = statusLabel[m.status] ?? statusLabel.a_solliciter;
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Event header */}
                <div className="px-5 py-4 border-b border-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{m.quote.event_type || 'Événement'}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{m.quote.client_name}</p>
                    </div>
                    <span className={['text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0', st.color].join(' ')}>
                      {st.label}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="px-5 py-4 space-y-2.5">
                  {m.quote.event_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden />
                      <span className="text-gray-700 capitalize">{dateFr(m.quote.event_date)}</span>
                    </div>
                  )}
                  {m.arrival_time && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden />
                      <span className="text-gray-700">Arrivée : <strong>{m.arrival_time}</strong></span>
                    </div>
                  )}
                  {m.quote.event_location && (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(m.quote.event_location)}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-700 underline decoration-gray-300 underline-offset-2">
                      <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden />
                      <span>{m.quote.event_location}<span className="sr-only"> (itinéraire)</span></span>
                    </a>
                  )}
                  {m.quote.guest_count && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden />
                      <span className="text-gray-700">{m.quote.guest_count} invité{m.quote.guest_count > 1 ? 's' : ''}</span>
                    </div>
                  )}

                  {m.mission_notes && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <p className="text-sm font-semibold text-amber-800 mb-1">Consignes</p>
                      <p className="text-sm text-amber-800 whitespace-pre-line leading-relaxed">{m.mission_notes}</p>
                    </div>
                  )}

                  {m.assign_courses && (
                    <Link
                      href={`/e/${token}/courses/${m.quote.id}`}
                      className="flex items-center justify-center gap-2 mt-2 w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors"
                    >
                      Voir la liste de courses
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 pb-4">
        WeboDevis — Espace Extra
      </p>
    </div>
  );
}
