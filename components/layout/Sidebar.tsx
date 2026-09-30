'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft, ChevronsLeft, ChevronsRight, Download, LogOut, Printer, Save,
  User, Package, Calendar as CalendarIcon, Palette, Image as ImageIcon, LayoutTemplate,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { isNavActive, useEditorMode, useNavGroups, WEBO_PANELS, type Badges } from './nav';

const PANEL_ICONS: Record<string, React.ElementType> = {
  client: User, services: Package, event: CalendarIcon, style: Palette, images: ImageIcon, cover: LayoutTemplate, photos: ImageIcon,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  badges: Badges;
}

const itemBase = 'relative flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium transition-colors';
const itemIdle = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';
const itemActive = 'bg-primary-100 text-primary';

function Badge({ value }: { value: number | 'dot' | null }) {
  if (value === null) return null;
  if (value === 'dot') return <span className="ml-auto w-2 h-2 rounded-full bg-accent flex-shrink-0" aria-label="Événement aujourd'hui" />;
  return (
    <span className="ml-auto min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-gray-900 text-white text-[11px] font-semibold tabular-nums">
      {value > 99 ? '99+' : value}
    </span>
  );
}

// Navigation latérale : rail d'icônes sur tablette, barre complète sur grand écran.
export default function Sidebar({ collapsed, onToggle, badges }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const groups = useNavGroups();
  const editor = useEditorMode(pathname);

  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden md:flex flex-col bg-white border-r border-gray-200 overflow-hidden transition-[width] duration-200"
      style={{ width: 'var(--shell-left)' }}
    >
      {/* Marque */}
      <div className="flex items-center gap-3 h-[60px] px-[18px] flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
          <span className="font-display text-white font-bold text-base select-none">W</span>
        </div>
        <span className="sb-label font-display font-semibold text-gray-900 text-[17px] truncate select-none">WeboDevis</span>
      </div>

      {editor.isQuoteEditor || editor.isPrestationEditor ? (
        // Éditeur plein écran : la navigation laisse place aux panneaux et aux actions du document.
        <nav className="flex-1 px-3 py-2 overflow-y-auto scrollbar-none space-y-1">
          <Link href={editor.isQuoteEditor ? '/devis' : '/prestations'} className={cn(itemBase, itemIdle)} title="Retour">
            <ArrowLeft className="h-[18px] w-[18px] flex-shrink-0" />
            <span className="sb-label truncate">{editor.isQuoteEditor ? 'Retour aux devis' : 'Retour aux prestations'}</span>
          </Link>

          {editor.isQuoteEditor && (
            <div className="pt-3 space-y-1">
              {WEBO_PANELS.map((panel) => {
                const Icon = PANEL_ICONS[panel.key];
                return (
                  <Link
                    key={panel.key}
                    href={`/devis/${editor.quoteId}/modifier?mode=weboword&panel=${panel.key}`}
                    title={panel.label}
                    className={cn(itemBase, editor.activePanel === panel.key ? itemActive : itemIdle)}
                  >
                    <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                    <span className="sb-label truncate">{panel.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="pt-4 mt-3 border-t border-gray-200 space-y-1">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent(editor.isQuoteEditor ? 'weboword:save' : 'presta-webo:save'))}
              title="Enregistrer"
              className={cn(itemBase, 'w-full bg-primary text-white hover:bg-primary-dark')}
            >
              <Save className="h-[18px] w-[18px] flex-shrink-0" />
              <span className="sb-label">Enregistrer</span>
            </button>
            {editor.isQuoteEditor && (
              <>
                <button onClick={() => window.dispatchEvent(new CustomEvent('weboword:savepdf'))} title="Enregistrer en PDF" className={cn(itemBase, itemIdle, 'w-full')}>
                  <Download className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="sb-label">Enregistrer en PDF</span>
                </button>
                <button onClick={() => window.dispatchEvent(new CustomEvent('weboword:print'))} title="Imprimer" className={cn(itemBase, itemIdle, 'w-full')}>
                  <Printer className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="sb-label">Imprimer</span>
                </button>
              </>
            )}
          </div>
        </nav>
      ) : (
        <nav className="flex-1 px-3 py-2 overflow-y-auto overflow-x-hidden scrollbar-none">
          {groups.map((group, gi) => (
            <div key={group.title} className={gi > 0 ? 'mt-5' : ''}>
              <p className="sb-label px-3 mb-1.5 text-xs font-medium text-gray-400 select-none">{group.title}</p>
              {gi > 0 && <div className="sb-rail-only block mx-3 mb-3 h-px bg-gray-200" />}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isNavActive(item, pathname);
                  const badge = item.badge ? badges[item.badge] : null;
                  return (
                    <Link key={item.href} href={item.href} title={item.label} className={cn(itemBase, active ? itemActive : itemIdle)}>
                      <item.icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={active ? 2.1 : 1.8} />
                      <span className="sb-label truncate">{item.label}</span>
                      <span className="sb-label ml-auto"><Badge value={badge} /></span>
                      {badge !== null && <span className="sb-rail-only absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      )}

      {/* Compte */}
      <div className="flex-shrink-0 border-t border-gray-200 p-3 space-y-1">
        {profile && (
          <div className="flex items-center gap-3 px-1.5 py-1.5">
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary flex items-center justify-center flex-shrink-0 text-xs font-semibold select-none">
              {initials}
            </div>
            <div className="sb-label flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate leading-tight">{profile.first_name} {profile.last_name}</p>
              <p className="text-xs text-gray-500 truncate leading-tight">{profile.email}</p>
            </div>
          </div>
        )}
        <button onClick={signOut} title="Se déconnecter" className={cn(itemBase, itemIdle, 'w-full')}>
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.8} />
          <span className="sb-label">Se déconnecter</span>
        </button>
        {/* Replier : utile seulement sur grand écran (la tablette est toujours en rail) */}
        <button onClick={onToggle} title={collapsed ? 'Déplier le menu' : 'Replier le menu'} className={cn(itemBase, itemIdle, 'w-full hidden lg:flex')}>
          {collapsed ? <ChevronsRight className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.8} /> : <ChevronsLeft className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.8} />}
          <span className="sb-label">Replier le menu</span>
        </button>
      </div>
    </aside>
  );
}
