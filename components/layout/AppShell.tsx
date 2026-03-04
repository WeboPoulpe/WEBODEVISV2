'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileTabBar from './MobileTabBar';
import OnboardingOverlay from '@/components/onboarding/OnboardingOverlay';
import { useAuth } from '@/context/AuthContext';

const SIDEBAR_W = 240;
const SIDEBAR_W_COLLAPSED = 64;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, profile, loading } = useAuth();

  const sidebarWidth = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W;

  // Show onboarding overlay if user has not completed it
  const showOnboarding = !loading && user && profile && profile.has_completed_onboarding === false;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Override sidebar margin on mobile (sidebar is hidden below lg) */}
      <style>{`@media (max-width: 1023px) { .app-main-area { margin-left: 0 !important; } }`}</style>

      {showOnboarding && <OnboardingOverlay userId={user!.id} />}

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      {/* Main area shifts right on desktop only */}
      <div
        className="app-main-area flex flex-col flex-1 min-w-0 transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft: sidebarWidth }}
      >
        <Header sidebarWidth={sidebarWidth} onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0" style={{ paddingTop: 60 }}>
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
