'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft, ChevronRight, Download, LogOut, Printer, Save,
  User, Package, Calendar as CalendarIcon, Palette, Image as ImageIcon, LayoutTemplate,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { isNavActive, useEditorMode, useNavGroups, WEBO_PANELS, type Badges } from './nav';

const PANEL_ICONS: Record<string, React.ElementType> = {
  client: User, services: Package, event: CalendarIcon, style: Palette, images: ImageIcon, cover: LayoutTemplate, photos: ImageIcon,
};

const itemBase = 'relative flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium transition-colors';
const itemIdle = 'text-white/70 hover:bg-white/[0.06] hover:text-white';
const itemActive = 'bg-forest-soft text-white';
const groupLabel = 'sb-label px-3 mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-white/40 select-none';

function Badge({ value }: { value: number | 'dot' | null }) {
  if (value === null) return null;
  if (value === 'dot') return <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" aria-label="Événement aujourd'hui" />;
  return (
    <span className="min-w-6 h-5 px-1.5 flex items-center justify-center rounded-full bg-white/10 text-white/80 text-[11px] font-medium tabular-nums">
      {value > 9 ? '9+' : value}
    </span>
  );
}

// Navigation latérale flottante : rail d'icônes sur tablette, barre complète sur grand écran.
export default function Sidebar({ badges }: { badges: Badges }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const groups = useNavGroups();
  const editor = useEditorMode(pathname);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  return (
    <aside
      className="fixed top-2 bottom-2 left-2 z-30 hidden md:flex flex-col rounded-[20px] bg-forest overflow-hidden transition-[width] duration-200"
      style={{ width: 'calc(var(--shell-left) - 16px)' }}
    >
      {/* Marque */}
      <div className="flex items-center gap-3 h-[68px] px-[18px] flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
          <span className="font-display text-white font-bold text-base select-none">W</span>
        </div>
        <span className="sb-label font-display font-semibold text-white text-[19px] truncate select-none">WeboDevis</span>
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

          <div className="pt-4 mt-3 border-t border-white/10 space-y-1">
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
        <nav className="flex-1 px-3 pb-2 overflow-y-auto overflow-x-hidden scrollbar-none">
          {groups.map((group, gi) => {
            const hasActive = group.items.some((it) => isNavActive(it, pathname));
            const open = !group.collapsible || hasActive || !!openGroups[group.title];
            return (
              <div key={group.title} className={gi > 0 ? 'mt-5' : 'mt-1'}>
                {group.collapsible ? (
                  <button
                    onClick={() => setOpenGroups((s) => ({ ...s, [group.title]: !open }))}
                    aria-expanded={open}
                    className="sb-label w-full flex items-center justify-between h-10 px-3 rounded-xl text-sm font-medium text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors"
                  >
                    {group.title}
                    <ChevronRight className={cn('h-4 w-4 text-white/50 transition-transform', open && 'rotate-90')} />
                  </button>
                ) : (
                  <p className={groupLabel}>{group.title}</p>
                )}
                {gi > 0 && <div className="sb-rail-only mx-3 mb-3 h-px bg-white/10" />}

                {/* Sur le rail (tablette), tous les groupes restent visibles : il n'y a pas de titre à déplier. */}
                <div className={cn('space-y-0.5', !open && 'sb-rail-only')}>
                  {group.items.map((item) => {
                    const active = isNavActive(item, pathname);
                    const badge = item.badge ? badges[item.badge] : null;
                    return (
                      <Link key={item.href} href={item.href} title={item.label} className={cn(itemBase, active ? itemActive : itemIdle)}>
                        <item.icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.8} />
                        <span className="sb-label truncate">{item.label}</span>
                        <span className="sb-label ml-auto"><Badge value={badge} /></span>
                        {badge !== null && <span className="sb-rail-only absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary-400" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      )}

      {/* Compte */}
      <button onClick={signOut} title="Se déconnecter" aria-label="Se déconnecter" className="sb-rail-only mx-auto mb-1 w-10 h-10 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors">
        <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </button>
      {profile && (
        <div className="flex-shrink-0 m-2.5 p-2 rounded-2xl bg-white/[0.06] flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-50 text-primary flex items-center justify-center flex-shrink-0 text-xs font-semibold select-none">
            {initials}
          </div>
          <div className="sb-label flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate leading-tight">{profile.first_name} {profile.last_name}</p>
            <p className="text-xs text-white/50 truncate leading-tight mt-0.5">{profile.company_name || profile.email}</p>
          </div>
          <button onClick={signOut} title="Se déconnecter" aria-label="Se déconnecter" className="sb-label w-9 h-9 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      )}
    </aside>
  );
}
