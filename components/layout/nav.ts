'use client';

import { useEffect, useState } from 'react';
import {
  LayoutDashboard, FileText, Users, CalendarDays, CalendarRange, Package, Carrot, LayoutTemplate,
  UserCheck, Users2, ShoppingBasket, Truck, Boxes, Wrench, Shield, FolderTree, Building2, PackageOpen, Box,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { CONFIRMED_STATUSES, PENDING_STATUSES } from '@/lib/quoteStatus';
import { hiddenRoutes } from '@/lib/modules';

export type BadgeKey = 'pendingDevis' | 'todayEvent' | 'newProspects' | 'stockAlert';

export interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  exact: boolean;
  badge?: BadgeKey;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  /** Groupe replié par défaut dans la barre latérale (déplié si une de ses pages est ouverte). */
  collapsible?: boolean;
}

// Une seule définition de la navigation, partagée par la barre latérale et le menu mobile.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Commerce',
    items: [
      { href: '/', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
      { href: '/devis', icon: FileText, label: 'Devis', exact: false, badge: 'pendingDevis' },
      { href: '/clients', icon: Users, label: 'Clients', exact: false },
      { href: '/prospects', icon: UserCheck, label: 'Prospects', exact: false, badge: 'newProspects' },
    ],
  },
  {
    title: 'Production',
    items: [
      { href: '/calendrier', icon: CalendarDays, label: 'Calendrier', exact: false, badge: 'todayEvent' },
      { href: '/evenements', icon: CalendarRange, label: 'Événements', exact: false },
      { href: '/commandes', icon: ShoppingBasket, label: 'Commandes', exact: false },
      { href: '/stock', icon: Boxes, label: 'Stock', exact: false, badge: 'stockAlert' },
    ],
  },
  {
    title: 'Catalogue',
    collapsible: true,
    items: [
      { href: '/prestations', icon: Package, label: 'Prestations', exact: false },
      { href: '/ingredients', icon: Carrot, label: 'Ingrédients', exact: false },
      { href: '/extras', icon: Users2, label: 'Extras', exact: false },
      { href: '/fournisseurs', icon: Truck, label: 'Fournisseurs', exact: false },
      { href: '/materiel', icon: Box, label: 'Matériel', exact: false },
      { href: '/location-globale', icon: PackageOpen, label: 'Location', exact: false },
      { href: '/courses-globales', icon: ShoppingBasket, label: 'Courses globales', exact: false },
    ],
  },
  {
    title: 'Paramètres',
    collapsible: true,
    items: [
      { href: '/parametres', icon: Building2, label: 'Mon entreprise', exact: true },
      { href: '/parametres/categories', icon: FolderTree, label: 'Catégories', exact: false },
      { href: '/modeles', icon: LayoutTemplate, label: 'Styles de devis', exact: false },
      { href: '/location-templates', icon: Wrench, label: 'Modèles de location', exact: false },
    ],
  },
];

export const ADMIN_ITEM: NavItem = { href: '/admin', icon: Shield, label: 'Espace admin', exact: false };

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === '/devis') return pathname === '/devis' || (pathname.startsWith('/devis/') && pathname !== '/devis/nouveau');
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

/** Groupes de navigation, avec l'espace admin pour les administrateurs. */
export function useNavGroups(): NavGroup[] {
  const { profile } = useAuth();
  // Les pages des options non activées pour ce compte disparaissent du menu.
  const hidden = hiddenRoutes(profile?.modules);
  return NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !hidden.includes(i.href)) }))
    .map((g) => (g.title === 'Paramètres' && profile?.role === 'admin' ? { ...g, items: [...g.items, ADMIN_ITEM] } : g))
    .filter((g) => g.items.length > 0);
}

export type Badges = Record<BadgeKey, number | 'dot' | null>;

/** Compteurs affichés à côté des entrées de navigation. */
export function useNavBadges(): Badges {
  const { user } = useAuth();
  const [badges, setBadges] = useState<Badges>({ pendingDevis: null, todayEvent: null, newProspects: null, stockAlert: null });

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];
    const set = (key: BadgeKey, value: number | 'dot' | null) => setBadges((b) => ({ ...b, [key]: value }));

    supabase.from('quotes').select('*', { count: 'exact', head: true }).in('status', PENDING_STATUSES)
      .then(({ count }) => set('pendingDevis', count || null));
    supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('event_date', today).in('status', CONFIRMED_STATUSES)
      .then(({ count }) => set('todayEvent', count ? 'dot' : null));
    supabase.from('user_prospect_tokens').select('token').eq('user_id', user.id).then(({ data }) => {
      const tokens = (data ?? []).map((r: { token: string }) => r.token);
      if (tokens.length === 0) return;
      supabase.from('prospect_requests').select('*', { count: 'exact', head: true }).eq('status', 'nouveau').in('user_token', tokens)
        .then(({ count }) => set('newProspects', count || null));
    });
    supabase.from('ingredients').select('id, stock_quantity, min_stock_alert').eq('user_id', user.id).then(({ data }) => {
      const low = (data ?? []).filter((i: { stock_quantity: number | null; min_stock_alert: number | null }) =>
        (i.min_stock_alert ?? 0) > 0 && (i.stock_quantity ?? 0) <= (i.min_stock_alert ?? 0)).length;
      set('stockAlert', low || null);
    });
  }, [user]);

  return badges;
}

// Panneaux de l'éditeur de devis (mode WeboWord).
export const WEBO_PANELS: { key: string; label: string }[] = [
  { key: 'client', label: 'Client' },
  { key: 'services', label: 'Prestations' },
  { key: 'event', label: 'Événement' },
  { key: 'style', label: 'Style' },
  { key: 'cover', label: 'Page de garde' },
  { key: 'photos', label: 'Page photos' },
];

/** Détecte les écrans d'édition plein écran, où la navigation laisse place aux actions de l'éditeur. */
export function useEditorMode(pathname: string | null) {
  const [params, setParams] = useState<{ mode: string | null; panel: string | null }>({ mode: null, panel: null });
  useEffect(() => {
    const update = () => {
      const sp = new URLSearchParams(window.location.search);
      setParams((p) => (p.mode === sp.get('mode') && p.panel === sp.get('panel') ? p : { mode: sp.get('mode'), panel: sp.get('panel') }));
    };
    update();
    window.addEventListener('popstate', update);
    const interval = setInterval(update, 300); // pushState ne déclenche aucun événement
    return () => { window.removeEventListener('popstate', update); clearInterval(interval); };
  }, []);

  const quoteId = pathname?.match(/\/devis\/([^/]+)\/modifier/)?.[1] ?? null;
  return {
    isQuoteEditor: !!quoteId && params.mode === 'weboword',
    isPrestationEditor: !!pathname?.includes('/prestations/') && !!pathname?.includes('/edit-webo'),
    quoteId,
    activePanel: params.panel,
  };
}
