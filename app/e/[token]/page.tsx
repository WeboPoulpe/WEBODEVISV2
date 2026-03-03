export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import Link from 'next/link';
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
  a_solliciter: { label: 'À confirmer',  color: 'bg-amber-100 text-amber-700'   },
  confirme:     { label: 'Confirmé',     color: 'bg-blue-100 text-blue-700'     },
  present:      { label: 'Présent',      color: 'bg-emerald-100 text-emerald-700' },
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
      <div className="bg-gradient-to-br from-[#6a1080] to-[#9c27b0] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xl">{initials}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">{extra.name}</h1>
            {extra.role && <p className="text-white/70 text-sm mt-0.5">{extra.role}</p>}
            {extra.phone && <p className="text-white/60 text-xs mt-1">📞 {extra.phone}</p>}
          </div>
        </div>
      </div>

      {/* Print button (client component) */}
      <ExtraPrintButton />

      {/* Missions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-widest">
          Mes missions {upcoming.length > 0 && `(${upcoming.length})`}
        </h2>

        {upcoming.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-gray-400 font-medium">Aucune mission à venir</p>
            <p className="text-sm text-gray-300 mt-1">Contactez votre traiteur pour plus d&apos;infos.</p>
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
                      <span className="text-lg">📅</span>
                      <span className="text-gray-700 capitalize">{dateFr(m.quote.event_date)}</span>
                    </div>
                  )}
                  {m.arrival_time && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-lg">⏰</span>
                      <span className="text-gray-700">Arrivée : <strong>{m.arrival_time}</strong></span>
                    </div>
                  )}
                  {m.quote.event_location && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-lg">📍</span>
                      <span className="text-gray-700">{m.quote.event_location}</span>
                    </div>
                  )}
                  {m.quote.guest_count && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-lg">👥</span>
                      <span className="text-gray-500">{m.quote.guest_count} invité{m.quote.guest_count > 1 ? 's' : ''}</span>
                    </div>
                  )}

                  {m.mission_notes && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1.5">Notes de mission</p>
                      <p className="text-sm text-amber-800 whitespace-pre-line leading-relaxed">{m.mission_notes}</p>
                    </div>
                  )}

                  {m.assign_courses && (
                    <Link
                      href={`/evenements/${m.quote.id}/courses`}
                      className="flex items-center justify-center gap-2 mt-2 w-full py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors"
                    >
                      🛒 Voir la liste de courses
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-300 pb-4">
        WeboDevis — Espace Extra
      </p>
    </div>
  );
}
