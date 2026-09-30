import {
  Bell, Boxes, CalendarDays, CalendarRange, Euro, FileText, Home, LayoutDashboard, LayoutGrid, Plus, Search,
  ShoppingBasket, TrendingUp, UserCheck, Users, UtensilsCrossed,
} from 'lucide-react';
import Wordmark from '@/components/brand/Wordmark';
import DateBlock from '@/components/ui/DateBlock';
import { cn } from '@/lib/utils';
import { Pill, Preview, previewCard } from './preview-kit';

// Aperçu du tableau de bord, fidèle à l'app : barre latérale vert sapin, carte de chiffre sombre,
// dates en bloc. Comme l'app, il change de forme selon la largeur : barre complète sur grand écran,
// rail d'icônes sur tablette, barre d'onglets sur téléphone. Toutes les données sont inventées.

const NAV = [
  { title: 'Commerce', items: [
    { icon: LayoutDashboard, label: 'Tableau de bord', active: true },
    { icon: FileText, label: 'Devis', badge: 9 },
    { icon: Users, label: 'Clients' },
    { icon: UserCheck, label: 'Prospects', badge: 2 },
  ] },
  { title: 'Production', items: [
    { icon: CalendarDays, label: 'Calendrier' },
    { icon: CalendarRange, label: 'Événements' },
    { icon: ShoppingBasket, label: 'Commandes' },
    { icon: Boxes, label: 'Stock' },
  ] },
];

const EVENTS = [
  { iso: '2027-05-15', name: 'Atelier Lenoir', type: 'Séminaire', guests: 60, total: '4 380 €' },
  { iso: '2027-05-29', name: 'Paul Garnier', type: 'Anniversaire', guests: 45, total: '3 150 €' },
  { iso: '2027-06-12', name: 'Camille & Antoine', type: 'Mariage', guests: 120, total: '12 540 €' },
];

const MONTHS = [
  { label: 'Déc', h: 46 }, { label: 'Janv', h: 38 }, { label: 'Févr', h: 55 },
  { label: 'Mars', h: 72 }, { label: 'Avr', h: 64 }, { label: 'Mai', h: 100 },
];

function Stat({ label, value, icon: Icon, tone, className }: { label: string; value: string; icon: React.ElementType; tone: 'sage' | 'terracotta'; className?: string }) {
  return (
    <div className={cn(previewCard, 'p-4 lg:p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-600 truncate">{label}</p>
        <span className={cn('hidden sm:flex w-8 h-8 rounded-lg items-center justify-center flex-shrink-0', tone === 'sage' ? 'bg-sage-100 text-sage' : 'bg-primary-100 text-primary')}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="font-display text-[26px] lg:text-[32px] font-bold text-gray-900 tabular-nums leading-none mt-5 lg:mt-6">{value}</p>
    </div>
  );
}

export default function DashboardPreview({ className }: { className?: string }) {
  return (
    <Preview
      label="Aperçu du tableau de bord de WeboDevis avec des données d’exemple : chiffre d’affaires du mois, couverts à venir, devis en cours et prochains événements confirmés."
      className={cn('relative flex rounded-[24px] bg-page border border-gray-300/70 shadow-float overflow-hidden', className)}
    >
      {/* Barre latérale : rail d'icônes sur tablette, complète sur grand écran */}
      <div className="hidden md:flex flex-col flex-shrink-0 w-[68px] lg:w-[220px] m-2 mr-0 rounded-[18px] bg-forest">
        <div className="flex items-center h-16 px-5">
          <Wordmark className="hidden lg:inline text-[21px] text-white" />
          <Wordmark short className="lg:hidden w-full text-center text-[21px] text-white" />
        </div>
        <div className="px-2.5 pb-4">
          {NAV.map((group, gi) => (
            <div key={group.title} className={gi > 0 ? 'mt-5' : ''}>
              <p className="hidden lg:block px-3 mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">{group.title}</p>
              {gi > 0 && <div className="lg:hidden mx-2 mb-3 h-px bg-white/10" />}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <div key={item.label} className={cn('flex items-center justify-center lg:justify-start gap-3 h-10 lg:px-3 rounded-xl text-sm font-medium',
                    item.active ? 'bg-forest-soft text-white' : 'text-white/70')}>
                    <item.icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.8} />
                    <span className="hidden lg:block truncate">{item.label}</span>
                    {item.badge && (
                      <span className="hidden lg:flex ml-auto min-w-6 h-5 px-1.5 items-center justify-center rounded-full bg-white/10 text-white/80 text-[11px] font-medium tabular-nums">{item.badge}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto m-2.5 p-2 rounded-2xl bg-white/[0.06] flex items-center justify-center lg:justify-start gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-50 text-primary flex items-center justify-center flex-shrink-0 text-xs font-semibold">ÉV</div>
          <div className="hidden lg:block min-w-0">
            <p className="text-sm font-medium text-white truncate leading-tight">Élise Verdier</p>
            <p className="text-xs text-white/50 truncate leading-tight mt-0.5">Maison Verdier</p>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0 pb-24 md:pb-5">
        {/* En-tête : recherche, notifications, création de devis */}
        <div className="flex items-center gap-2 sm:gap-3 h-[64px] px-4 lg:px-6">
          <div className="flex-1 max-w-md flex items-center gap-2.5 h-10 px-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-400 min-w-0">
            <Search className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Rechercher un devis, un client, un événement</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-700">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 w-[18px] h-[18px] flex items-center justify-center bg-primary text-white text-[10px] font-bold rounded-full leading-none ring-2 ring-page">2</span>
            </div>
            <div className="hidden md:flex items-center gap-2 h-10 px-4 bg-primary text-white text-sm font-semibold rounded-xl whitespace-nowrap">
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Nouveau devis
            </div>
          </div>
        </div>

        <div className="px-4 lg:px-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-4 lg:mb-5">
            <div>
              <p className="text-sm text-gray-500">Lundi 3 mai 2027</p>
              <p className="font-display text-[28px] lg:text-[38px] font-bold text-gray-900 leading-tight tracking-[-0.015em] mt-0.5">Bonjour Élise</p>
            </div>
            <div className="hidden sm:flex p-1 rounded-xl bg-gray-200/70 text-sm font-medium">
              <span className="flex items-center h-9 px-4 rounded-lg bg-white text-gray-900 shadow-sm">Ce mois</span>
              <span className="flex items-center h-9 px-4 rounded-lg text-gray-600">Trimestre</span>
              <span className="flex items-center h-9 px-4 rounded-lg text-gray-600">Année</span>
            </div>
          </div>

          {/* Chiffres clés */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
            <div className="col-span-2 sm:col-span-1 rounded-2xl bg-forest text-white p-4 lg:p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/70">CA ce mois</p>
                <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Euro className="h-4 w-4" /></span>
              </div>
              <p className="font-display text-[26px] lg:text-[32px] font-bold tabular-nums leading-none mt-5 lg:mt-6 whitespace-nowrap">38 420 €</p>
            </div>
            <Stat label="Couverts à venir" value="610" icon={UtensilsCrossed} tone="sage" />
            <Stat label="Devis en cours" value="9" icon={FileText} tone="terracotta" />
            <Stat label="Taux de conversion" value="62 %" icon={TrendingUp} tone="sage" className="hidden sm:block" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
            {/* Prochains événements */}
            <div className={cn(previewCard, 'p-4 lg:p-5')}>
              <p className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">Prochains événements confirmés</p>
              <div className="space-y-2.5 lg:space-y-3">
                {EVENTS.map((ev, i) => (
                  <div key={ev.iso} className={cn('flex items-center gap-3 lg:gap-4 p-2.5 lg:p-3 rounded-2xl bg-gray-50', i === 1 && 'hidden sm:flex')}>
                    <DateBlock iso={ev.iso} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{ev.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <Pill>{ev.type}</Pill>
                        <Pill tone="sage">{ev.guests} couverts</Pill>
                      </div>
                    </div>
                    <p className="hidden sm:block flex-shrink-0 font-display text-lg font-bold text-gray-900 tabular-nums">{ev.total}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CA sur 6 mois */}
            <div className={cn(previewCard, 'hidden lg:block p-5')}>
              <p className="text-lg font-semibold text-gray-900">CA sur 6 mois</p>
              <p className="mt-2">
                <span className="font-display text-[28px] font-bold text-gray-900 tabular-nums">164 900 €</span>
                <span className="ml-2 text-xs text-gray-500">déc. à mai.</span>
              </p>
              <div className="flex items-end gap-2 h-32 mt-5">
                {MONTHS.map((m, i) => (
                  <div key={m.label} className="flex-1 h-full flex items-end">
                    <div className={cn('w-full rounded-lg', i === MONTHS.length - 1 ? 'bg-primary' : 'bg-primary-200')} style={{ height: `${m.h}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                {MONTHS.map((m, i) => (
                  <p key={m.label} className={cn('flex-1 text-center text-xs', i === MONTHS.length - 1 ? 'font-semibold text-gray-900' : 'text-gray-500')}>{m.label}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Téléphone : la barre d'onglets, avec le bouton central pour créer un devis */}
      <div className="md:hidden absolute inset-x-3 bottom-3 h-16 rounded-3xl bg-forest shadow-float flex items-stretch px-1.5">
        {[{ icon: Home, label: 'Accueil', active: true }, { icon: FileText, label: 'Devis' }].map((t) => (
          <div key={t.label} className="flex-1 flex flex-col items-center justify-center gap-1">
            <span className={cn('flex items-center justify-center w-12 h-7 rounded-full', t.active && 'bg-forest-soft')}>
              <t.icon className={cn('h-5 w-5', t.active ? 'text-white' : 'text-white/55')} strokeWidth={t.active ? 2.2 : 1.8} />
            </span>
            <span className={cn('text-[11px] leading-none', t.active ? 'text-white font-semibold' : 'text-white/55 font-medium')}>{t.label}</span>
          </div>
        ))}
        <div className="flex-1 flex items-center justify-center">
          <span className="w-14 h-14 -mt-6 rounded-full bg-primary text-white flex items-center justify-center shadow-float ring-4 ring-page">
            <Plus className="h-6 w-6" strokeWidth={2.4} />
          </span>
        </div>
        {[{ icon: CalendarRange, label: 'Événements' }, { icon: LayoutGrid, label: 'Plus' }].map((t) => (
          <div key={t.label} className="flex-1 flex flex-col items-center justify-center gap-1">
            <span className="flex items-center justify-center w-12 h-7 rounded-full">
              <t.icon className="h-5 w-5 text-white/55" strokeWidth={1.8} />
            </span>
            <span className="text-[11px] leading-none text-white/55 font-medium">{t.label}</span>
          </div>
        ))}
      </div>
    </Preview>
  );
}
