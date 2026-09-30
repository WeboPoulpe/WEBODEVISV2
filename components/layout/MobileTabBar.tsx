'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, CalendarRange, Download, FileText, HelpCircle, Home, LayoutGrid, LogOut, PanelLeft, Plus, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { isNavActive, useEditorMode, useNavGroups, WEBO_PANELS, type Badges } from './nav';
import QuoteEditorActions from '@/components/devis/QuoteEditorActions';

const bar = 'md:hidden fixed inset-x-3 z-30 h-16 rounded-3xl bg-forest shadow-float flex items-stretch px-1.5';
const barStyle = { bottom: 'max(12px, env(safe-area-inset-bottom))' };

function Tab({ href, icon: Icon, label, active, dot }: { href: string; icon: React.ElementType; label: string; active: boolean; dot?: boolean }) {
  return (
    <Link href={href} className="relative flex-1 flex flex-col items-center justify-center gap-1" aria-current={active ? 'page' : undefined}>
      <span className={cn('relative flex items-center justify-center w-12 h-7 rounded-full transition-colors', active && 'bg-forest-soft')}>
        <Icon className={cn('h-5 w-5', active ? 'text-white' : 'text-white/55')} strokeWidth={active ? 2.2 : 1.8} />
        {dot && <span className="absolute top-0 right-1.5 w-2 h-2 rounded-full bg-primary-400 ring-2 ring-forest" />}
      </span>
      <span className={cn('text-[11px] leading-none', active ? 'text-white font-semibold' : 'text-white/55 font-medium')}>{label}</span>
    </Link>
  );
}

// Navigation sur téléphone : quatre destinations, un bouton central pour créer, et « Plus » pour tout le reste.
export default function MobileTabBar({ badges, onHelp }: { badges: Badges; onHelp: () => void }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const groups = useNavGroups();
  const editor = useEditorMode(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelsOpen, setPanelsOpen] = useState(false);

  // Le menu se referme à chaque changement de page.
  useEffect(() => { setMenuOpen(false); setPanelsOpen(false); }, [pathname, editor.activePanel]);

  // ── Éditeur plein écran : les actions du document remplacent la navigation ──
  if (editor.isQuoteEditor || editor.isPrestationEditor) {
    return (
      <>
        {panelsOpen && editor.isQuoteEditor && (
          <div className="md:hidden fixed inset-0 z-40" onClick={() => setPanelsOpen(false)}>
            <div className="absolute inset-0 bg-gray-900/30" />
            <div className="absolute inset-x-3 bottom-24 rounded-3xl bg-white border border-gray-200 shadow-float p-2 animate-sheet-up" onClick={(e) => e.stopPropagation()}>
              {WEBO_PANELS.map((panel) => (
                <Link
                  key={panel.key}
                  href={`/devis/${editor.quoteId}/modifier?mode=weboword&panel=${panel.key}`}
                  className={cn('flex items-center h-12 px-4 rounded-2xl text-[15px] font-medium', editor.activePanel === panel.key ? 'bg-primary-100 text-primary' : 'text-gray-800')}
                >
                  {panel.label}
                </Link>
              ))}
              {editor.quoteId && (
                <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                  <QuoteEditorActions quoteId={editor.quoteId} light
                    itemBase="flex items-center gap-3 h-12 px-4 rounded-2xl text-[15px] font-medium" itemIdle="text-gray-800 hover:bg-gray-50" />
                </div>
              )}
            </div>
          </div>
        )}
        <nav className={cn(bar, 'gap-1.5 items-center px-2')} style={barStyle} aria-label="Actions du document">
          <Link href={editor.isQuoteEditor ? '/devis' : '/prestations'} className="w-12 h-12 flex items-center justify-center rounded-2xl text-white/80" aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {editor.isQuoteEditor && (
            <>
              <button onClick={() => setPanelsOpen((v) => !v)} className="h-12 px-3 flex items-center gap-2 rounded-2xl text-sm font-medium text-white/90">
                <PanelLeft className="h-5 w-5" />
                Menu
              </button>
              <button onClick={() => window.dispatchEvent(new CustomEvent('weboword:savepdf'))} className="w-12 h-12 flex items-center justify-center rounded-2xl text-white/80" aria-label="Enregistrer en PDF">
                <Download className="h-5 w-5" />
              </button>
            </>
          )}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent(editor.isQuoteEditor ? 'weboword:save' : 'presta-webo:save'))}
            className="ml-auto h-12 px-5 flex items-center gap-2 rounded-2xl bg-primary text-white text-sm font-semibold"
          >
            <Save className="h-[18px] w-[18px]" />
            Enregistrer
          </button>
        </nav>
      </>
    );
  }

  const inMore = !['/', '/devis', '/evenements'].some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));

  return (
    <>
      {/* ── Menu complet ─────────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-label="Menu">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setMenuOpen(false)} />
          <div className="relative max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-page animate-sheet-up" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 pt-5 pb-3 bg-page">
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold text-gray-900 truncate">{profile?.company_name || 'WeboDevis'}</p>
                <p className="text-sm text-gray-500 truncate">{profile?.email}</p>
              </div>
              <button onClick={() => setMenuOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600" aria-label="Fermer le menu">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 space-y-5">
              {groups.map((group) => (
                <section key={group.title}>
                  <h3 className="px-1 mb-2 text-sm font-medium text-gray-500">{group.title}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const active = isNavActive(item, pathname);
                      const badge = item.badge ? badges[item.badge] : null;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn('relative flex items-center gap-3 h-14 px-3.5 rounded-2xl border text-[15px] font-medium',
                            active ? 'bg-primary-100 border-primary-200 text-primary' : 'bg-white border-gray-200 text-gray-800')}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.8} />
                          <span className="truncate">{item.label}</span>
                          {badge !== null && (
                            <span className="ml-auto min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-gray-900 text-white text-[11px] font-semibold tabular-nums">
                              {badge === 'dot' ? '•' : badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}

              <button onClick={() => { setMenuOpen(false); onHelp(); }} className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-gray-200 bg-white text-[15px] font-medium text-gray-700">
                <HelpCircle className="h-5 w-5" strokeWidth={1.8} />
                Aide
              </button>

              <button onClick={signOut} className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-gray-200 bg-white text-[15px] font-medium text-gray-700">
                <LogOut className="h-5 w-5" strokeWidth={1.8} />
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Barre d'onglets ──────────────────────────────────────────────────── */}
      <nav className={bar} style={barStyle} aria-label="Navigation principale">
        <Tab href="/" icon={Home} label="Accueil" active={pathname === '/'} />
        <Tab href="/devis" icon={FileText} label="Devis" active={pathname.startsWith('/devis') && pathname !== '/devis/nouveau'} dot={!!badges.pendingDevis} />
        <div className="flex-1 flex items-center justify-center">
          <Link href="/devis/nouveau" aria-label="Nouveau devis" className="w-14 h-14 -mt-6 rounded-full bg-primary text-white flex items-center justify-center shadow-float ring-4 ring-page active:scale-95 transition-transform">
            <Plus className="h-6 w-6" strokeWidth={2.4} />
          </Link>
        </div>
        <Tab href="/evenements" icon={CalendarRange} label="Événements" active={pathname.startsWith('/evenements')} dot={badges.todayEvent === 'dot'} />
        <button onClick={() => setMenuOpen(true)} className="relative flex-1 flex flex-col items-center justify-center gap-1" aria-haspopup="dialog">
          <span className={cn('relative flex items-center justify-center w-12 h-7 rounded-full', inMore && 'bg-forest-soft')}>
            <LayoutGrid className={cn('h-5 w-5', inMore ? 'text-white' : 'text-white/55')} strokeWidth={inMore ? 2.2 : 1.8} />
            {(badges.newProspects || badges.stockAlert) && <span className="absolute top-0 right-1.5 w-2 h-2 rounded-full bg-primary-400 ring-2 ring-forest" />}
          </span>
          <span className={cn('text-[11px] leading-none', inMore ? 'text-white font-semibold' : 'text-white/55 font-medium')}>Plus</span>
        </button>
      </nav>
    </>
  );
}
