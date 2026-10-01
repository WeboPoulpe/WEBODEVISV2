'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileTabBar from './MobileTabBar';
import { useNavBadges } from './nav';
import OnboardingOverlay from '@/components/onboarding/OnboardingOverlay';
import HelpCenter from '@/components/help/HelpCenter';
import { HELP_OPEN_EVENT, type HelpOpenDetail } from '@/lib/help';
import { useAuth } from '@/context/AuthContext';
import { isDemoUser } from '@/lib/demo';
import { signOut as endSession } from 'next-auth/react';

// Coque de l'app : barre latérale (tablette et ordinateur), barre d'onglets (téléphone).
// La largeur de la barre latérale vient de la variable CSS --shell-left (app/globals.css).
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  // Le centre d'aide s'ouvre aussi par l'événement « aide:ouvrir » (mégamenu de la barre latérale),
  // sur les guides d'une page précise ou directement sur un guide.
  const [helpTarget, setHelpTarget] = useState<HelpOpenDetail>({});
  const openHelp = () => { setHelpTarget({}); setHelpOpen(true); };
  useEffect(() => {
    const onOpen = (e: Event) => { setHelpTarget((e as CustomEvent<HelpOpenDetail>).detail ?? {}); setHelpOpen(true); };
    window.addEventListener(HELP_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(HELP_OPEN_EVENT, onOpen);
  }, []);
  const { user, profile, loading, actingAsAdmin, actAs } = useAuth();
  const leaveAccount = async () => {
    await actAs(null);
    window.location.assign('/admin/comptes');
  };
  const badges = useNavBadges();

  // Show onboarding overlay if user has not completed it
  const showOnboarding = !loading && !actingAsAdmin && user && profile && profile.has_completed_onboarding === false;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {showOnboarding && <OnboardingOverlay userId={user!.id} />}

      <Sidebar badges={badges} />

      <div className="app-main-area flex flex-col flex-1 min-w-0 transition-[margin-left] duration-200" style={{ marginLeft: 'var(--shell-left)' }}>
        {actingAsAdmin && (
          <div role="status" className="flex items-center justify-between gap-3 mx-4 md:mx-6 mt-3 px-4 py-2.5 rounded-2xl bg-primary text-white text-sm">
            <p className="min-w-0 truncate">
              <span className="font-semibold">Administration.</span>{' '}
              <span className="text-white/85">Vous êtes dans le compte de {profile?.company_name || profile?.email || user?.email}.</span>
            </p>
            <button onClick={leaveAccount} className="flex-shrink-0 font-semibold underline underline-offset-4 hover:no-underline">
              Revenir
            </button>
          </div>
        )}
        {isDemoUser(user?.id) && (
          <div role="status" data-demo-banner className="flex items-center justify-between gap-3 mx-4 md:mx-6 mt-3 px-4 py-2.5 rounded-2xl bg-forest text-white text-sm">
            <p className="min-w-0">
              <span className="font-semibold">Démonstration.</span>{' '}
              <span className="text-white/75">Essayez tout : rien de ce que vous modifiez n’est enregistré.</span>
            </p>
            <a href="/contact?objet=devis" className="hidden sm:inline-flex flex-shrink-0 items-center h-8 px-3 ml-auto rounded-lg bg-primary font-semibold hover:bg-primary-dark transition-colors">
              Demander un devis
            </a>
            <button onClick={() => endSession({ callbackUrl: '/' })} className="flex-shrink-0 font-semibold underline underline-offset-4 hover:no-underline">
              Quitter
            </button>
          </div>
        )}
        <Header onHelp={openHelp} />
        <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'var(--tabbar-h)' }}>
          {children}
        </main>
      </div>

      <MobileTabBar badges={badges} onHelp={openHelp} />
      <HelpCenter open={helpOpen} onClose={() => setHelpOpen(false)} page={helpTarget.page ?? null} guideId={helpTarget.guide ?? null} />
    </div>
  );
}
