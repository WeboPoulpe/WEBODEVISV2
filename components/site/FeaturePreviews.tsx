import { Building2, Check, Clock, Download, FileCode2, FileText, Paperclip, Truck } from 'lucide-react';
import DateBlock from '@/components/ui/DateBlock';
import type { FeaturePreview } from '@/lib/site/features';
import { cn } from '@/lib/utils';
import EventPreview from './EventPreview';
import { PhoneCourses, PhoneHome, PhoneMission, PhoneQuotes } from './Phone';
import QuotePreview from './QuotePreview';
import RequestPreview from './RequestPreview';
import { Pill, Preview, previewCard } from './preview-kit';

// Aperçus du produit montrés en ouverture des pages fonctionnalités. Construits en code d'après les
// écrans de l'app, avec des données inventées (le mariage de Camille et Antoine, 120 couverts).

const panel = cn(previewCard, 'shadow-float');

// ── Clients ────────────────────────────────────────────────────────────────────
const CLIENTS = [
  { initials: null, name: 'Atelier Lenoir', type: 'Entreprise', email: 'contact@atelier-lenoir.exemple', phone: '01 23 45 67 89', quotes: 5 },
  { initials: 'CR', name: 'Camille Roussel', type: 'Particulier', email: 'camille.roussel@exemple.fr', phone: '06 12 34 56 78', quotes: 1 },
  { initials: null, name: 'Cabinet Marchal', type: 'Entreprise', email: 'accueil@cabinet-marchal.exemple', phone: '01 98 76 54 32', quotes: 3 },
  { initials: 'PG', name: 'Paul Garnier', type: 'Particulier', email: 'paul.garnier@exemple.fr', phone: '06 98 76 54 32', quotes: 2 },
  { initials: 'IC', name: 'Inès Carpentier', type: 'Particulier', email: 'ines.carpentier@exemple.fr', phone: '06 45 67 89 01', quotes: 1 },
];

function ClientsPreview() {
  return (
    <Preview label="Aperçu du fichier clients : cinq clients, particuliers et entreprises, avec leur email, leur téléphone et leur nombre de devis. Deux portent l’étiquette Habitué. Données d’exemple." className={cn(panel, 'p-4 sm:p-6')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[26px] font-bold text-gray-900 leading-tight tracking-[-0.015em]">Clients</p>
          <p className="text-sm text-gray-600">5 clients, dont 2 habitués</p>
        </div>
        <div className="flex p-1 rounded-xl bg-gray-200/70 text-[13px] font-medium overflow-hidden">
          {['Tous', 'Particuliers', 'Entreprises', 'Habitués'].map((f, i) => (
            <span key={f} className={cn('flex items-center h-8 px-2.5 sm:px-3.5 rounded-lg', i === 0 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600', i === 3 && 'hidden sm:flex')}>{f}</span>
          ))}
        </div>
      </div>
      <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
        {CLIENTS.map((c) => (
          <div key={c.name} className="flex items-center gap-3 py-3">
            <span className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold">
              {c.initials ?? <Building2 className="h-4 w-4" />}
            </span>
            <div className="flex-1 min-w-0 md:flex-none md:w-[230px]">
              <p className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 truncate">{c.name}</span>
                {c.quotes >= 3 && <Pill>Habitué</Pill>}
              </p>
              <p className="text-xs text-gray-500">{c.type}</p>
            </div>
            <p className="hidden md:block flex-1 min-w-0 text-sm text-gray-600 truncate">{c.email}</p>
            <p className="hidden lg:block w-[130px] text-sm text-gray-600 tabular-nums">{c.phone}</p>
            <p className="flex-shrink-0 text-sm font-medium text-gray-900 tabular-nums">{c.quotes} devis</p>
          </div>
        ))}
      </div>
    </Preview>
  );
}

// ── Calendrier ─────────────────────────────────────────────────────────────────
// Juin 2027 commence un mardi : une case vide avant le 1er.
const EVENTS: Record<number, { name: string; confirmed: boolean }[]> = {
  5: [{ name: 'Léa & Hugo', confirmed: true }],
  12: [{ name: 'Camille & Antoine', confirmed: true }, { name: 'Club nautique', confirmed: false }],
  17: [{ name: 'Atelier Lenoir', confirmed: true }],
  19: [{ name: 'Cabinet Marchal', confirmed: false }],
  26: [{ name: 'Noces Perrin', confirmed: false }],
};

function CalendarPreview() {
  const cells: (number | null)[] = [null, ...Array.from({ length: 30 }, (_, i) => i + 1), null, null, null, null];
  return (
    <Preview label="Aperçu du calendrier de juin 2027 : trois événements confirmés et trois devis en cours, 470 couverts. Le samedi 12 juin est sélectionné, avec un mariage confirmé et un devis en cours. Données d’exemple." className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-3">
      <div className={cn(panel, 'p-3 sm:p-5')}>
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <p className="font-display text-[26px] sm:text-[32px] font-bold text-gray-900 leading-tight tracking-[-0.015em]">Juin 2027</p>
          <p className="text-sm text-gray-600">3 confirmés, 3 en cours, 470 couverts</p>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mt-4">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
            <p key={d} className="pb-1 text-center text-xs text-gray-500">{d}</p>
          ))}
          {cells.map((day, i) => {
            const events = day ? EVENTS[day] ?? [] : [];
            const selected = day === 12;
            return (
              <div key={i} className={cn('min-w-0 h-12 sm:h-[76px] rounded-lg sm:rounded-xl p-1 sm:p-1.5', day ? (selected ? 'bg-primary-50 ring-2 ring-primary-300' : 'bg-gray-50') : '')}>
                {day && <p className={cn('text-[11px] sm:text-xs tabular-nums', selected ? 'font-semibold text-primary' : 'text-gray-600')}>{day}</p>}
                <div className="hidden sm:block mt-1 space-y-0.5">
                  {events.map((e) => (
                    <p key={e.name} className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate', e.confirmed ? 'bg-primary text-white' : 'bg-white border border-primary/40 text-primary')}>{e.name}</p>
                  ))}
                </div>
                <div className="sm:hidden flex gap-0.5 mt-1">
                  {events.map((e) => <span key={e.name} className={cn('w-1.5 h-1.5 rounded-full', e.confirmed ? 'bg-primary' : 'border border-primary')} />)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 px-1 text-xs text-gray-600">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" />Confirmé</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-primary" />En cours</span>
        </div>
      </div>

      <div className={cn(panel, 'p-4 sm:p-5 self-start')}>
        <p className="text-base font-semibold text-gray-900">Samedi 12 juin</p>
        <p className="text-sm text-gray-600">200 couverts ce jour-là</p>
        {[{ name: 'Camille & Antoine', type: 'Mariage', guests: 120, status: 'Acompte reçu', ok: true }, { name: 'Club nautique', type: 'Cocktail', guests: 80, status: 'Devis envoyé', ok: false }].map((e) => (
          <div key={e.name} className="flex items-center gap-3 p-2.5 mt-3 rounded-2xl bg-gray-50">
            <DateBlock iso="2027-06-12" className="w-12 h-12" />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{e.name}</p>
              <p className="text-xs text-gray-500 truncate">{e.type}, {e.guests} couverts</p>
              <Pill tone={e.ok ? 'sage' : 'terracotta'} className="mt-1.5">{e.status}</Pill>
            </div>
          </div>
        ))}
      </div>
    </Preview>
  );
}

// ── Suivi financier ────────────────────────────────────────────────────────────
const FINANCE_ROWS = [
  { name: 'Cocktail, 12 pièces', sale: '2 160 €', cost: '780 €', margin: '1 380 €' },
  { name: 'Dîner, trois plats', sale: '7 440 €', cost: '2 820 €', margin: '4 620 €' },
  { name: 'Service', sale: '1 800 €', cost: 'à saisir', margin: '1 800 €' },
];
const FINANCE_FEES = [['Extras', '1 900 €'], ['Location', '900 €'], ['Transport', '300 €']];

function FinancePreview() {
  return (
    <Preview label="Aperçu de la fiche Marge et coûts d’un devis : 11 400 euros de chiffre d’affaires hors taxes, 6 700 euros de charges, 4 700 euros de marge brute, soit 41 %. Données d’exemple." className={cn(panel, 'p-4 sm:p-6')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-semibold text-gray-900">Marge et coûts</p>
        <p className="text-sm text-gray-600">Camille &amp; Antoine, 120 couverts</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div className="rounded-2xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Chiffre d’affaires</p>
          <p className="font-display text-[28px] font-bold text-gray-900 tabular-nums leading-none mt-4">11 400 €</p>
          <p className="text-xs text-gray-500 mt-2">hors taxes</p>
        </div>
        <div className="rounded-2xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Charges</p>
          <p className="font-display text-[28px] font-bold text-gray-900 tabular-nums leading-none mt-4">6 700 €</p>
          <p className="text-xs text-gray-500 mt-2">coûts de revient et frais</p>
        </div>
        <div className="rounded-2xl bg-forest text-white p-4">
          <p className="text-sm text-white/70">Marge brute</p>
          <p className="font-display text-[28px] font-bold tabular-nums leading-none mt-4">4 700 €</p>
          <p className="text-xs text-white/60 mt-2">41 % du chiffre d’affaires</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-x-10 gap-y-6 mt-6 text-sm">
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5.5rem] gap-x-2 pb-2 text-gray-500">
            <p>Prestation</p><p className="text-right hidden sm:block">Vente</p><p className="text-right">Coût</p><p className="text-right">Marge</p>
          </div>
          {FINANCE_ROWS.map((r) => (
            <div key={r.name} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5.5rem] gap-x-2 py-3 border-t border-gray-100 items-baseline">
              <p className="font-medium text-gray-900 truncate">{r.name}</p>
              <p className="hidden sm:block text-right text-gray-600 tabular-nums">{r.sale}</p>
              <p className={cn('text-right tabular-nums', r.cost === 'à saisir' ? 'text-primary' : 'text-gray-600')}>{r.cost}</p>
              <p className="text-right font-display font-bold text-gray-900 tabular-nums">{r.margin}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="pb-2 text-gray-500">Frais additionnels</p>
          {FINANCE_FEES.map(([label, amount]) => (
            <p key={label} className="flex justify-between gap-4 py-3 border-t border-gray-100">
              <span className="font-medium text-gray-900">{label}</span>
              <span className="text-gray-600 tabular-nums">{amount}</span>
            </p>
          ))}
        </div>
      </div>
    </Preview>
  );
}

// ── Stock et commandes ─────────────────────────────────────────────────────────
const STOCK = [
  { name: 'Farine T55', qty: '25 kg', threshold: 'Seuil : 10', state: null },
  { name: 'Crème liquide', qty: '4 L', threshold: 'Seuil : 6', state: 'Bas' },
  { name: 'Beurre doux', qty: '12 kg', threshold: 'Seuil : 5', state: null },
  { name: 'Huile d’olive', qty: '0 L', threshold: 'Seuil : 3', state: 'Épuisé' },
];

function StockPreview() {
  return (
    <Preview label="Aperçu du stock et d’une commande fournisseur : quatre ingrédients dont un bas et un épuisé, et une commande de filet de bœuf au statut Envoyée. Données d’exemple." className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
      <div className={cn(panel, 'p-4 sm:p-6')}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-semibold text-gray-900">Stock</p>
          <p className="text-sm text-gray-600">1 stock bas, 1 épuisé</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
          {STOCK.map((s) => (
            <div key={s.name} className="rounded-2xl bg-gray-50 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-900 truncate">{s.name}</p>
                {s.state && <Pill tone={s.state === 'Épuisé' ? 'solid' : 'terracotta'}>{s.state}</Pill>}
              </div>
              <p className={cn('font-display text-[26px] font-bold tabular-nums leading-none mt-3', s.state ? 'text-primary' : 'text-gray-900')}>{s.qty}</p>
              <div className="flex items-center justify-between gap-2 mt-3">
                <p className="text-xs text-gray-500">{s.threshold}</p>
                <p className="flex gap-1.5 text-xs font-medium">
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-700">Entrée</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-700">Sortie</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={cn(panel, 'p-4 sm:p-6 self-start')}>
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary-100 text-primary flex items-center justify-center flex-shrink-0"><Truck className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">Boucherie Martin</p>
            <p className="text-xs text-gray-500">Commande pour Camille &amp; Antoine</p>
          </div>
          <Pill>Envoyée</Pill>
        </div>
        <div className="mt-4 text-sm">
          {[['Filet de bœuf', '21,6 kg'], ['Jus de veau', '4 L']].map(([n, q]) => (
            <p key={n} className="flex justify-between gap-4 py-2.5 border-t border-gray-100">
              <span className="text-gray-900">{n}</span><span className="font-medium text-gray-900 tabular-nums">{q}</span>
            </p>
          ))}
        </div>
        <ol className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 text-xs font-medium">
          {[['Brouillon', 'done'], ['Envoyée', 'current'], ['Reçue', 'todo']].map(([step, state], i) => (
            <li key={step} className="flex items-center gap-2">
              {i > 0 && <span className="w-4 h-px bg-gray-300" />}
              <span className={cn('px-2.5 py-1 rounded-full', state === 'done' && 'bg-sage-100 text-sage', state === 'current' && 'bg-primary text-white', state === 'todo' && 'bg-gray-100 text-gray-500')}>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-gray-500 mt-3">À la réception, les quantités s’ajoutent au stock.</p>
      </div>
    </Preview>
  );
}

// ── Extras ─────────────────────────────────────────────────────────────────────
const TEAM = [
  { initials: 'JM', name: 'Julie Moreau', role: 'Serveuse', time: '16:00', status: 1 },
  { initials: 'KH', name: 'Karim Haddad', role: 'Cuisinier', time: '11:00', status: 1 },
  { initials: 'NB', name: 'Nora Blanc', role: 'Barman', time: '17:30', status: 0 },
];
const STATUSES = ['À solliciter', 'Confirmé', 'Présent'];

function ExtrasPreview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] items-start gap-4 md:gap-8">
      <Preview label="Aperçu de l’onglet Extras d’un événement : trois extras affectés avec leur heure d’arrivée, deux confirmés sur trois. Données d’exemple." className={cn(panel, 'p-4 sm:p-6')}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-semibold text-gray-900">Extras</p>
          <p className="text-sm text-gray-600">2 confirmés sur 3</p>
        </div>
        <div className="space-y-2.5 mt-4">
          {TEAM.map((p) => (
            <div key={p.name} className="rounded-2xl bg-gray-50 p-3.5">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold">{p.initials}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.role}</p>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-gray-700 tabular-nums"><Clock className="h-4 w-4 text-gray-400" />{p.time}</p>
              </div>
              <div className="flex p-1 mt-3 rounded-xl bg-gray-200/70 text-xs font-medium">
                {STATUSES.map((s, i) => (
                  <span key={s} className={cn('flex-1 flex items-center justify-center h-8 rounded-lg', i === p.status ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Preview>
      <div className="flex justify-center">
        <PhoneMission />
      </div>
    </div>
  );
}

// ── Liste de courses ───────────────────────────────────────────────────────────
const SUPPLIERS = [
  { name: 'Boucherie Martin', lines: [{ n: 'Filet de bœuf', q: '21,6 kg', done: true }] },
  { name: 'Primeur des Halles', lines: [{ n: 'Pommes grenaille', q: '24 kg', done: true }, { n: 'Asperges vertes', q: '9,6 kg', done: false }, { n: 'Fraises gariguette', q: '12 kg', done: false }] },
  { name: 'Crèmerie Duval', lines: [{ n: 'Crème liquide', q: '6 L', done: false }] },
];

function CoursesPreview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] items-start gap-4 md:gap-8">
      <Preview label="Aperçu de la liste de courses d’un événement de 120 couverts, regroupée par fournisseur : filet de bœuf 21,6 kilos, pommes grenaille 24 kilos, asperges 9,6 kilos, fraises 12 kilos, crème 6 litres. Données d’exemple." className={cn(panel, 'p-4 sm:p-6')}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-semibold text-gray-900">Courses</p>
          <p className="text-sm text-gray-600">Camille &amp; Antoine, 120 couverts</p>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 text-[13px] font-medium">
          <span className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900">Calculer depuis le devis</span>
          <span className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900">Créer les commandes</span>
          <span className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900">Mode courses</span>
        </div>
        <div className="flex items-center justify-between mt-5 text-sm">
          <span className="text-gray-600">2 sur 5 articles pris</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 mt-2 overflow-hidden"><div className="h-full w-2/5 rounded-full bg-sage" /></div>
        {SUPPLIERS.map((s) => (
          <div key={s.name} className="mt-5">
            <p className="text-sm font-semibold text-gray-900">{s.name}</p>
            <div className="space-y-1.5 mt-2">
              {s.lines.map((l) => (
                <div key={l.n} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50">
                  {l.done
                    ? <span className="w-6 h-6 rounded-lg bg-sage text-white flex items-center justify-center flex-shrink-0"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                    : <span className="w-6 h-6 rounded-lg border-2 border-gray-300 bg-white flex-shrink-0" />}
                  <span className={cn('flex-1 min-w-0 truncate text-sm', l.done ? 'line-through text-gray-400' : 'font-medium text-gray-900')}>{l.n}</span>
                  <span className={cn('font-display font-bold tabular-nums', l.done ? 'text-gray-400' : 'text-gray-900')}>{l.q}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Preview>
      <div className="hidden md:flex justify-center">
        <PhoneCourses />
      </div>
    </div>
  );
}

// ── Signature en ligne ─────────────────────────────────────────────────────────
function SignaturePreview() {
  return (
    <Preview label="Aperçu du bloc d’acceptation d’un devis consulté en ligne : nom du signataire, case d’acceptation cochée, signature tracée et bouton Accepter et signer. À côté, le devis passé au statut Validé, consulté trois fois. Données d’exemple." className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
      <div className={cn(panel, 'p-4 sm:p-6')}>
        <p className="text-lg font-semibold text-gray-900">Accepter ce devis</p>
        <p className="text-sm text-gray-600 mt-1">Valable jusqu’au 30 novembre</p>
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700">Prénom et nom</p>
          <p className="mt-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900">Camille Roussel</p>
        </div>
        <p className="flex items-start gap-3 mt-4 text-sm text-gray-700">
          <span className="w-5 h-5 mt-0.5 rounded-md bg-primary text-white flex items-center justify-center flex-shrink-0"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
          J’accepte le devis et les conditions de vente.
        </p>
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 h-[110px] flex items-center justify-center">
          <svg viewBox="0 0 220 70" className="w-[200px] h-auto text-gray-900" aria-hidden>
            <path d="M8 48 C 24 10, 34 12, 36 40 S 52 62, 60 34 S 74 8, 82 38 C 86 52, 96 50, 104 36 S 120 22, 128 40 C 134 52, 146 46, 156 34 S 178 28, 190 40 L 212 36" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="mt-4 flex items-center justify-center h-12 rounded-xl bg-primary text-white font-semibold">Accepter et signer</span>
      </div>
      <div className={cn(panel, 'p-4 sm:p-6 self-start')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">Camille &amp; Antoine</p>
            <p className="text-xs text-gray-500">Mariage, 120 couverts</p>
          </div>
          <Pill tone="sage">Validé</Pill>
        </div>
        <div className="mt-4 text-sm">
          {[['Consulté', '3 fois'], ['Signé par', 'Camille Roussel'], ['Le', '14 octobre, 21 h 42']].map(([k, v]) => (
            <p key={k} className="flex justify-between gap-4 py-2.5 border-t border-gray-100">
              <span className="text-gray-600">{k}</span><span className="font-medium text-gray-900 text-right">{v}</span>
            </p>
          ))}
        </div>
      </div>
    </Preview>
  );
}

// ── Factures ───────────────────────────────────────────────────────────────────
const INVOICES = [
  { number: 'FAC-2026-0041', kind: 'Facture d’acompte, 30 %', ttc: '3 762,00 €', status: 'Payée', tone: 'sage' as const },
  { number: 'FAC-2026-0057', kind: 'Facture de solde', ttc: '8 778,00 €', status: 'Payée en partie', tone: 'terracotta' as const },
];

function InvoicesPreview() {
  return (
    <Preview label="Aperçu des factures d’un devis de mariage : une facture d’acompte payée et une facture de solde payée en partie, avec leurs numéros et montants TTC, la TVA ventilée et le bouton Exporter en CSV. Données d’exemple." className={cn(panel, 'p-4 sm:p-6')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[26px] font-bold text-gray-900 leading-tight tracking-[-0.015em]">Factures</p>
          <p className="text-sm text-gray-600">Camille &amp; Antoine, 120 couverts</p>
        </div>
        <span className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-[13px] font-medium text-gray-900"><Download className="h-4 w-4" />Exporter (CSV)</span>
      </div>
      <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
        {INVOICES.map((i) => (
          <div key={i.number} className="flex items-center gap-3 py-3">
            <span className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center flex-shrink-0"><FileText className="h-4 w-4" /></span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate tabular-nums">{i.number}</p>
              <p className="text-xs text-gray-500">{i.kind}</p>
            </div>
            <Pill tone={i.tone} className="hidden sm:inline-flex">{i.status}</Pill>
            <p className="w-[96px] text-right font-display font-bold text-gray-900 tabular-nums">{i.ttc}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5 mt-4 text-sm">
        {[['TVA 10 %', '1 140,00 €'], ['Facturé TTC', '12 540,00 €'], ['Encaissé', '9 762,00 €']].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{k}</p>
            <p className="font-display font-bold text-gray-900 tabular-nums mt-1.5">{v}</p>
          </div>
        ))}
      </div>
    </Preview>
  );
}

// ── Facture électronique ───────────────────────────────────────────────────────
function FacturXPreview() {
  return (
    <Preview label="Aperçu d’une facture au format Factur-X : un fichier PDF/A-3 qui contient en pièce jointe le fichier factur-x.xml au profil EN 16931. Le PDF Factur-X est prêt, le raccordement à une plateforme agréée est prévu. Données d’exemple." className={cn(panel, 'p-4 sm:p-6 max-w-[620px]')}>
      <div className="flex items-start gap-3">
        <span className="w-12 h-12 rounded-xl bg-primary-100 text-primary flex items-center justify-center flex-shrink-0"><FileText className="h-6 w-6" /></span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate tabular-nums">FAC-2026-0057.pdf</p>
          <p className="text-xs text-gray-500">Facture de solde, Camille &amp; Antoine</p>
        </div>
        <Pill tone="sage">PDF/A-3</Pill>
      </div>
      <div className="mt-4 ml-6 pl-5 border-l-2 border-dashed border-gray-200">
        <div className="flex items-start gap-3 rounded-2xl bg-gray-50 p-3.5">
          <span className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-700 flex items-center justify-center flex-shrink-0"><FileCode2 className="h-5 w-5" /></span>
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-gray-900"><Paperclip className="h-3.5 w-3.5 text-gray-400" />factur-x.xml</p>
            <p className="text-xs text-gray-500">Profil EN 16931</p>
          </div>
        </div>
        <div className="mt-3 text-sm">
          {[['Vendeur et client', 'SIRET, n° de TVA'], ['Lignes', '6'], ['TVA ventilée', '10 %'], ['Échéance', '30 jours']].map(([k, v]) => (
            <p key={k} className="flex justify-between gap-4 py-2 border-t border-gray-100">
              <span className="text-gray-600">{k}</span><span className="font-medium text-gray-900">{v}</span>
            </p>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-5">
        <Pill tone="sage">Prêt : PDF Factur-X</Pill>
        <Pill tone="neutral">Prévu : plateforme agréée</Pill>
      </div>
    </Preview>
  );
}

// ── Allergènes ─────────────────────────────────────────────────────────────────
const ALLERGEN_COLS = ['Gluten', 'Crustacés', 'Œufs', 'Poissons', 'Arachides', 'Soja', 'Lait', 'Fruits à coque', 'Céleri', 'Moutarde', 'Sésame', 'Sulfites', 'Lupin', 'Mollusques'];
const DISHES: { name: string; has: number[] }[] = [
  { name: 'Gougères au comté', has: [0, 2, 6] },
  { name: 'Tartare de saumon au sésame', has: [3, 10] },
  { name: 'Crevettes, sauce cocktail', has: [1, 2, 9] },
  { name: 'Velouté de céleri', has: [6, 8] },
  { name: 'Financiers aux noisettes', has: [0, 2, 6, 7] },
];
const allergenGrid = 'grid grid-cols-[minmax(0,1fr)_repeat(7,1.5rem)] sm:grid-cols-[minmax(0,1fr)_repeat(14,1.5rem)] gap-x-0.5';

function AllergensPreview() {
  return (
    <Preview label="Aperçu d’une fiche allergènes d’événement : cinq plats en lignes, les quatorze allergènes en colonnes, un point pour chaque allergène présent. Données d’exemple." className={cn(panel, 'p-4 sm:p-6')}>
      <p className="text-[11px] uppercase tracking-wide text-gray-500">Votre maison</p>
      <p className="font-display text-[22px] font-bold text-gray-900 leading-tight">Allergènes du menu</p>
      <p className="text-xs text-gray-600 mt-1">Cocktail · 80 couverts</p>
      <div className={cn(allergenGrid, 'items-end mt-4 pb-2 border-b-2 border-gray-800 text-[10px] font-semibold text-gray-700')}>
        <p className="text-xs">Plat</p>
        {ALLERGEN_COLS.map((a, i) => (
          <p key={a} className={cn('h-[78px] items-center justify-end whitespace-nowrap [writing-mode:vertical-rl] rotate-180', i >= 7 ? 'hidden sm:flex' : 'flex')}>{a}</p>
        ))}
      </div>
      {DISHES.map((d) => (
        <div key={d.name} className={cn(allergenGrid, 'items-center py-2 border-b border-gray-100')}>
          <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
          {ALLERGEN_COLS.map((a, i) => (
            <span key={a} className={cn('justify-center', i >= 7 ? 'hidden sm:flex' : 'flex')}>
              {d.has.includes(i) && <span className="w-2.5 h-2.5 rounded-full bg-gray-900" />}
            </span>
          ))}
        </div>
      ))}
      <p className="text-[11px] text-gray-500 mt-3">● : le plat contient cet allergène ou des traces.</p>
    </Preview>
  );
}

// ── Application mobile ─────────────────────────────────────────────────────────
function MobilePreview() {
  return (
    <div className="flex justify-center items-start gap-6 lg:gap-10">
      <PhoneQuotes className="hidden md:block mt-16" />
      <PhoneHome />
      <PhoneCourses className="hidden lg:block mt-16" />
    </div>
  );
}

/** L'aperçu d'une page fonctionnalité, d'après la clé `preview` de sa fiche. */
export default function FeaturePreviewFor({ kind }: { kind: FeaturePreview }) {
  switch (kind) {
    case 'demandes': return <RequestPreview className="rounded-3xl bg-white border border-gray-200 shadow-float p-4 sm:p-7" />;
    case 'devis': return <QuotePreview className="max-w-[760px]" />;
    case 'clients': return <ClientsPreview />;
    case 'evenement': return <EventPreview />;
    case 'courses': return <CoursesPreview />;
    case 'extras': return <ExtrasPreview />;
    case 'stock': return <StockPreview />;
    case 'calendrier': return <CalendarPreview />;
    case 'finance': return <FinancePreview />;
    case 'mobile': return <MobilePreview />;
    case 'signature': return <SignaturePreview />;
    case 'factures': return <InvoicesPreview />;
    case 'facturx': return <FacturXPreview />;
    case 'allergenes': return <AllergensPreview />;
  }
}
