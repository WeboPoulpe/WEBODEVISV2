export const dynamic = 'force-dynamic';

import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { getMissionPage } from '@/server/missions';
import MissionsApp from './MissionsApp';

// Page de missions d'un extra, sans compte : son lien personnel suffit. Elle s'installe comme une app
// (manifeste propre à l'extra) et reçoit les notifications de ses missions.

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const page = await getMissionPage(token);
  if (!page) return { title: 'Mission introuvable', robots: { index: false } };
  return {
    title: `Mes missions, ${page.company.name}`,
    manifest: `/e/${token}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: 'Mes missions', statusBarStyle: 'default' },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { themeColor: '#1C2621' };

export default async function ExtraMissionsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await getMissionPage(token);
  if (!page) notFound();
  return <MissionsApp token={token} initial={page} />;
}
