'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileTabBar from './MobileTabBar';
import { useNavBadges } from './nav';
import OnboardingOverlay from '@/components/onboarding/OnboardingOverlay';
import HelpWidget from '@/components/help/HelpWidget';
import { useAuth } from '@/context/AuthContext';

// Coque de l'app : barre latérale (tablette et ordinateur), barre d'onglets (téléphone).
// La largeur de la barre latérale vient de la variable CSS --shell-left (app/globals.css).
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { user, profile, loading } = useAuth();
  const badges = useNavBadges();

  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
  }, [collapsed]);

  // Show onboarding overlay if user has not completed it
  const showOnboarding = !loading && user && profile && profile.has_completed_onboarding === false;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {showOnboarding && <OnboardingOverlay userId={user!.id} />}

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} badges={badges} />

      <div className="app-main-area flex flex-col flex-1 min-w-0 transition-[margin-left] duration-200" style={{ marginLeft: 'var(--shell-left)' }}>
        <Header onHelp={() => setHelpOpen(true)} />
        <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'var(--tabbar-h)' }}>
          {children}
        </main>
      </div>

      <MobileTabBar badges={badges} />
      <HelpWidget open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
