import { CalendarRange, Check, Clock, FileText, Home, LayoutGrid, MapPin, Plus, Users } from 'lucide-react';
import DateBlock from '@/components/ui/DateBlock';
import { cn } from '@/lib/utils';
import { Pill, Preview } from './preview-kit';

// L'app sur téléphone : un cadre et cinq écrans, construits en code avec des données inventées.
// La barre d'onglets vert sapin et son « + » terracotta reprennent components/layout/MobileTabBar.tsx.

type Tab = 'accueil' | 'devis' | 'evenements';

const TABS: { id: Tab | 'plus'; icon: React.ElementType; label: string }[] = [
  { id: 'accueil', icon: Home, label: 'Accueil' },
  { id: 'devis', icon: FileText, label: 'Devis' },
  { id: 'evenements', icon: CalendarRange, label: 'Événements' },
  { id: 'plus', icon: LayoutGrid, label: 'Plus' },
];

function TabBar({ active }: { active: Tab }) {
  const item = (t: (typeof TABS)[number]) => {
    const on = t.id === active;
    return (
      <div key={t.id} className="flex-1 flex flex-col items-center justify-center gap-1">
        <span className={cn('flex items-center justify-center w-10 h-6 rounded-full', on && 'bg-forest-soft')}>
          <t.icon className={cn('h-[18px] w-[18px]', on ? 'text-white' : 'text-white/55')} strokeWidth={on ? 2.2 : 1.8} />
        </span>
        <span className={cn('text-[10px] leading-none', on ? 'text-white font-semibold' : 'text-white/55 font-medium')}>{t.label}</span>
      </div>
    );
  };
  return (
    <div className="absolute inset-x-2.5 bottom-2.5 h-[60px] rounded-3xl bg-forest shadow-float flex items-stretch px-1">
      {TABS.slice(0, 2).map(item)}
      <div className="flex-1 flex items-center justify-center">
        <span className="w-12 h-12 -mt-5 rounded-full bg-primary text-white flex items-center justify-center ring-4 ring-page">
          <Plus className="h-5 w-5" strokeWidth={2.4} />
        </span>
      </div>
      {TABS.slice(2).map(item)}
    </div>
  );
}

/** Le cadre du téléphone. `tab` affiche la barre d'onglets de l'app ; sans lui, c'est une page publique. */
export function PhoneFrame({ label, tab, className, children }: { label: string; tab?: Tab; className?: string; children: React.ReactNode }) {
  return (
    <Preview label={label} className={cn('relative w-[288px] max-w-full rounded-[44px] bg-gray-900 p-[9px] shadow-float', className)}>
      <div className="relative h-[580px] rounded-[36px] bg-page overflow-hidden">
        <div className="absolute z-10 left-1/2 top-2.5 -translate-x-1/2 w-[84px] h-[22px] rounded-full bg-gray-900" />
        {children}
        {tab && <TabBar active={tab} />}
      </div>
    </Preview>
  );
}

const screenTitle = 'font-display text-[24px] font-bold text-gray-900 leading-tight tracking-[-0.015em]';

/** Accueil : le tableau de bord. */
export function PhoneHome({ className }: { className?: string }) {
  return (
    <PhoneFrame tab="accueil" className={className} label="WeboDevis sur téléphone : le tableau de bord, avec le chiffre d’affaires du mois, les couverts à venir, les devis en cours et les prochains événements. Données d’exemple.">
      <div className="px-4 pt-12">
        <p className="text-[13px] text-gray-500">Lundi 3 mai 2027</p>
        <p className={screenTitle}>Bonjour Élise</p>
        <div className="rounded-2xl bg-forest text-white p-4 mt-3">
          <p className="text-[13px] text-white/70">CA ce mois</p>
          <p className="font-display text-[26px] font-bold tabular-nums leading-none mt-3">38 420 €</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="bg-white border border-gray-200 rounded-2xl p-3">
            <p className="text-[12px] text-gray-600">Couverts à venir</p>
            <p className="font-display text-[22px] font-bold text-gray-900 tabular-nums leading-none mt-2.5">610</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-3">
            <p className="text-[12px] text-gray-600">Devis en cours</p>
            <p className="font-display text-[22px] font-bold text-gray-900 tabular-nums leading-none mt-2.5">9</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-3 mt-2">
          <p className="text-[13px] font-semibold text-gray-900">Prochains événements</p>
          {[{ iso: '2027-05-15', name: 'Atelier Lenoir', type: 'Séminaire', guests: 60 }, { iso: '2027-06-12', name: 'Camille & Antoine', type: 'Mariage', guests: 120 }].map((e) => (
            <div key={e.iso} className="flex items-center gap-2.5 p-2 mt-2 rounded-xl bg-gray-50">
              <DateBlock iso={e.iso} className="w-11 h-11 rounded-lg" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{e.name}</p>
                <div className="flex gap-1 mt-1">
                  <Pill className="!px-2 !text-[10px]">{e.type}</Pill>
                  <Pill tone="sage" className="!px-2 !text-[10px]">{e.guests} couverts</Pill>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

const QUOTES = [
  { iso: '2027-06-12', name: 'Camille & Antoine', meta: 'Mariage, 120 couverts', status: 'Devis envoyé', tone: 'terracotta' as const, total: '12 540 €' },
  { iso: '2027-06-19', name: 'Cabinet Marchal', meta: 'Cocktail, 80 couverts', status: 'Devis à faire', tone: 'terracotta' as const, total: 'Non chiffré' },
  { iso: '2027-07-03', name: 'Inès Carpentier', meta: 'Anniversaire, 40 couverts', status: 'Devis final', tone: 'terracotta' as const, total: '2 960 €' },
  { iso: '2027-09-18', name: 'Sarah & Thomas', meta: 'Mariage, 150 couverts', status: 'Nouveau', tone: 'terracotta' as const, total: 'Non chiffré' },
];

/** Devis : la liste, avec les statuts. */
export function PhoneQuotes({ className }: { className?: string }) {
  return (
    <PhoneFrame tab="devis" className={className} label="WeboDevis sur téléphone : la liste des devis en cours, chacun avec sa date, son statut et son montant. Données d’exemple.">
      <div className="px-4 pt-12">
        <p className={screenTitle}>Devis</p>
        <div className="flex p-1 mt-3 rounded-xl bg-gray-200/70 text-[12px] font-medium">
          <span className="flex-1 flex items-center justify-center h-8 rounded-lg bg-white text-gray-900 shadow-sm">En cours 9</span>
          <span className="flex-1 flex items-center justify-center h-8 rounded-lg text-gray-600">Confirmés 6</span>
          <span className="flex-1 flex items-center justify-center h-8 rounded-lg text-gray-600">Refusés 2</span>
        </div>
        <div className="space-y-2 mt-3">
          {QUOTES.map((q) => (
            <div key={q.iso} className="flex items-center gap-2.5 p-2.5 bg-white border border-gray-200 rounded-2xl">
              <DateBlock iso={q.iso} className="w-11 h-11 rounded-lg" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{q.name}</p>
                <p className="text-[11px] text-gray-600 truncate">{q.meta}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Pill tone={q.tone} className="!px-2 !text-[10px]">{q.status}</Pill>
                  <span className={cn('text-[11px] tabular-nums', q.total === 'Non chiffré' ? 'text-gray-400' : 'font-semibold text-gray-900')}>{q.total}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

const TASKS = [
  { label: 'Commander la vaisselle', done: true },
  { label: 'Valider le plan de table', done: true },
  { label: 'Visiter le domaine', done: true },
  { label: 'Confirmer les extras', done: false },
  { label: 'Réserver le camion frigo', done: false },
];

/** Événement : la checklist. */
export function PhoneChecklist({ className }: { className?: string }) {
  return (
    <PhoneFrame tab="evenements" className={className} label="WeboDevis sur téléphone : la checklist d’un événement, trois tâches faites sur cinq. Données d’exemple.">
      <div className="px-4 pt-12">
        <div className="flex items-center gap-3">
          <DateBlock iso="2027-06-12" className="w-12 h-12" />
          <div className="min-w-0">
            <p className="font-display text-[19px] font-bold text-gray-900 leading-tight truncate">Camille &amp; Antoine</p>
            <div className="flex gap-1 mt-1">
              <Pill className="!px-2 !text-[10px]">Mariage</Pill>
              <Pill tone="sage" className="!px-2 !text-[10px]">120 couverts</Pill>
            </div>
          </div>
        </div>
        <div className="flex p-1 mt-3.5 rounded-xl bg-gray-200/70 text-[11px] font-medium">
          {['Checklist', 'Matériel', 'Courses', 'Extras'].map((t, i) => (
            <span key={t} className={cn('flex-1 flex items-center justify-center h-8 rounded-lg', i === 0 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600')}>{t}</span>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4 text-[12px]">
          <span className="text-gray-600">3 sur 5 tâches faites</span>
          <span className="font-semibold text-gray-900 tabular-nums">60 %</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 mt-2 overflow-hidden"><div className="h-full w-3/5 rounded-full bg-sage" /></div>
        <div className="space-y-1.5 mt-3">
          {TASKS.map((t) => (
            <div key={t.label} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50">
              {t.done
                ? <span className="w-6 h-6 rounded-lg bg-sage text-white flex items-center justify-center flex-shrink-0"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                : <span className="w-6 h-6 rounded-lg border-2 border-gray-300 bg-white flex-shrink-0" />}
              <span className={cn('text-[13px] truncate', t.done ? 'line-through text-gray-400' : 'font-medium text-gray-900')}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

const LINES = [
  { name: 'Filet de bœuf', qty: '21,6 kg', done: true },
  { name: 'Pommes grenaille', qty: '24 kg', done: true },
  { name: 'Asperges vertes', qty: '9,6 kg', done: false },
  { name: 'Fraises gariguette', qty: '12 kg', done: false },
  { name: 'Crème liquide', qty: '6 L', done: false },
];

/** Mode courses : la liste à cocher. */
export function PhoneCourses({ className }: { className?: string }) {
  return (
    <PhoneFrame tab="evenements" className={className} label="WeboDevis sur téléphone : la liste de courses d’un mariage en mode courses, deux ingrédients cochés sur cinq. Données d’exemple.">
      <div className="px-4 pt-12">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={screenTitle}>Courses</p>
            <p className="text-[13px] text-gray-600 truncate">Camille &amp; Antoine</p>
          </div>
          <p className="font-display text-xl font-bold text-gray-900 tabular-nums whitespace-nowrap">2<span className="text-gray-400"> / 5</span></p>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 mt-3 overflow-hidden"><div className="h-full w-2/5 rounded-full bg-sage" /></div>
        <div className="flex gap-1.5 mt-3 text-[12px] font-medium overflow-hidden">
          <span className="flex-shrink-0 flex items-center h-8 px-3 rounded-full bg-gray-900 text-white">Tout</span>
          <span className="flex-shrink-0 flex items-center h-8 px-3 rounded-full bg-white border border-gray-200 text-gray-700">Viandes</span>
          <span className="flex-shrink-0 flex items-center h-8 px-3 rounded-full bg-white border border-gray-200 text-gray-700">Légumes</span>
          <span className="flex-shrink-0 flex items-center h-8 px-3 rounded-full bg-white border border-gray-200 text-gray-700">Crèmerie</span>
        </div>
        <div className="space-y-2 mt-3">
          {LINES.map((l) => (
            <div key={l.name} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-gray-200', l.done ? 'bg-gray-50' : 'bg-white')}>
              <div className="flex-1 min-w-0">
                <p className={cn('text-[14px] font-semibold leading-snug truncate', l.done ? 'line-through text-gray-400' : 'text-gray-900')}>{l.name}</p>
                <p className={cn('text-[12px] tabular-nums', l.done ? 'text-gray-400' : 'text-gray-700')}>{l.qty}</p>
              </div>
              {l.done
                ? <span className="w-7 h-7 rounded-full bg-sage text-white flex items-center justify-center flex-shrink-0"><Check className="h-4 w-4" strokeWidth={3} /></span>
                : <span className="w-7 h-7 rounded-full border-2 border-gray-300 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

/** La page de mission d'un extra : ouverte par un lien, sans compte ni barre d'onglets. */
export function PhoneMission({ className }: { className?: string }) {
  return (
    <PhoneFrame className={className} label="La page de mission d’un extra, ouverte sur son téléphone : ses deux missions à venir, avec la date, l’heure d’arrivée, le lieu et les consignes. Données d’exemple.">
      <div className="bg-primary-800 text-white px-4 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center text-sm font-semibold">JM</span>
          <div className="min-w-0">
            <p className="font-display text-[19px] font-bold leading-tight">Julie Moreau</p>
            <p className="text-[12px] text-white/70">Serveuse</p>
          </div>
        </div>
      </div>
      <div className="px-4 pt-4">
        <p className="text-[13px] font-semibold text-gray-900">Mes missions (2)</p>
        <div className="bg-white border border-gray-200 rounded-2xl p-3.5 mt-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500">Mariage</p>
              <p className="text-[15px] font-semibold text-gray-900 truncate">Camille &amp; Antoine</p>
            </div>
            <Pill tone="sage" className="!text-[10px]">Confirmé</Pill>
          </div>
          <p className="font-display text-[17px] font-bold text-gray-900 mt-2.5">Samedi 12 juin 2027</p>
          <ul className="mt-2 space-y-1.5 text-[12px] text-gray-700">
            <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-gray-400" />Arrivée : 16:00</li>
            <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-gray-400" />Domaine des Tilleuls</li>
            <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-gray-400" />120 invités</li>
          </ul>
          <p className="mt-3 rounded-xl bg-primary-50 border border-primary-100 px-3 py-2 text-[12px] leading-snug text-primary-900">
            Tenue noire. Service du cocktail, puis rang 2 au dîner.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-3.5 mt-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500">Séminaire</p>
              <p className="text-[15px] font-semibold text-gray-900 truncate">Atelier Lenoir</p>
            </div>
            <Pill className="!text-[10px]">À confirmer</Pill>
          </div>
          <p className="font-display text-[17px] font-bold text-gray-900 mt-2.5">Samedi 15 mai 2027</p>
        </div>
      </div>
    </PhoneFrame>
  );
}
