export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getMissionCourses } from '@/server/missions';
import CoursesChecklist from './CoursesChecklist';

export const metadata = { title: 'Liste de courses', robots: { index: false, follow: false } };

// Liste de courses d'un événement, pour l'extra à qui elles ont été confiées. Aucun compte n'est nécessaire.
export default async function MissionCoursesPage({ params }: { params: Promise<{ token: string; quoteId: string }> }) {
  const { token, quoteId } = await params;
  const data = await getMissionCourses(token, quoteId);
  if (!data) notFound();

  const date = new Date(`${data.event.event_date.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-[100dvh] bg-page">
      <div className="max-w-xl mx-auto px-4 pt-5" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
        <Link href={`/e/${token}`} className="inline-flex items-center gap-2 h-11 -ml-1 px-1 text-[15px] font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />Mes missions
        </Link>
        <h1 className="font-display text-[28px] font-bold text-gray-900 leading-tight mt-2">Liste de courses</h1>
        <p className="text-[15px] text-gray-600 mt-1">
          {data.event.event_type} {data.event.client_name}, {date}, {data.event.guest_count} couverts
        </p>
        <CoursesChecklist token={token} quoteId={quoteId} initial={data.lines} />
      </div>
    </div>
  );
}
