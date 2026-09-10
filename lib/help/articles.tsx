import Link from 'next/link';
import {
  Rocket, FileText, Users, CalendarRange, Boxes, Package, Settings,
  Plus, Send, Save, Download, Printer, Search, Trash2, Pencil, Copy,
  ChevronDown, Bell, ArrowRight, Eye, Wallet, Heart,
  LayoutDashboard, UserCheck, ShoppingBasket, Carrot, Truck, FolderTree,
  LayoutTemplate, Wrench, Building2, Shield, CalendarDays, Users2,
  FolderInput, Folder, Image as ImageIcon, Palette, User, Package as PackageIcon,
  CheckSquare, ShoppingCart, UtensilsCrossed, TrendingUp, TrendingDown, UploadCloud,
  Columns3, LayoutGrid, List, Library, FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react';

export type HelpCategoryId =
  | 'demarrer'
  | 'devis'
  | 'clients'
  | 'evenements'
  | 'stock'
  | 'catalogue'
  | 'compte';

export interface HelpCategory {
  id: HelpCategoryId;
  label: string;
  icon: LucideIcon;
  gradient: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'demarrer',   label: 'Démarrer',            icon: Rocket,        gradient: 'from-fuchsia-500 to-purple-600' },
  { id: 'devis',      label: 'Devis',               icon: FileText,      gradient: 'from-violet-500 to-indigo-600' },
  { id: 'clients',    label: 'Clients & Prospects', icon: Users,         gradient: 'from-blue-500 to-cyan-600' },
  { id: 'evenements', label: 'Événements',          icon: CalendarRange, gradient: 'from-emerald-500 to-teal-600' },
  { id: 'stock',      label: 'Stock & achats', icon: Boxes,         gradient: 'from-amber-500 to-orange-600' },
  { id: 'catalogue',  label: 'Catalogue',           icon: Package,       gradient: 'from-rose-500 to-pink-600' },
  { id: 'compte',     label: 'Compte & Paramètres', icon: Settings,      gradient: 'from-slate-500 to-gray-600' },
];

export interface HelpArticle {
  id: string;
  category: HelpCategoryId;
  title: string;
  description: string;
  keywords: string[];
  body: React.ReactNode;
}

// ── Visual building blocks ──────────────────────────────────────────────────
const Lead = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[15px] text-gray-700 leading-relaxed font-medium">{children}</p>
);

const P = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-sm text-gray-700 leading-relaxed ${className}`}>{children}</p>
);

const Section = ({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 mt-5 first:mt-0">
      <span className="text-base">{icon}</span>
      <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-800">{title}</h3>
      <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
    </div>
    <div className="space-y-3 pl-1">{children}</div>
  </div>
);

const Step = ({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) => (
  <div className="flex gap-3">
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#9c27b0] to-[#6a1b9a] text-white text-xs font-bold flex items-center justify-center shadow-sm">{n}</div>
    <div className="flex-1 pt-0.5">
      <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
      {children && <div className="text-sm text-gray-600 leading-relaxed space-y-1.5">{children}</div>}
    </div>
  </div>
);

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
    <span className="text-base flex-shrink-0">💡</span>
    <div className="text-xs text-amber-900 leading-relaxed flex-1">{children}</div>
  </div>
);

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
    <span className="text-base flex-shrink-0">ℹ️</span>
    <div className="text-xs text-blue-900 leading-relaxed flex-1">{children}</div>
  </div>
);

const Warning = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 p-3 bg-rose-50 border-l-4 border-rose-400 rounded-r-lg">
    <span className="text-base flex-shrink-0">⚠️</span>
    <div className="text-xs text-rose-900 leading-relaxed flex-1">{children}</div>
  </div>
);

const Code = ({ children }: { children: React.ReactNode }) => (
  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-[12px] font-mono">{children}</span>
);

const Btn = ({ children, color = 'purple' }: { children: React.ReactNode; color?: 'purple' | 'gray' | 'green' | 'red' }) => {
  const colors = {
    purple: 'bg-[#9c27b0] text-white',
    gray: 'bg-gray-100 text-gray-700 border border-gray-200',
    green: 'bg-emerald-500 text-white',
    red: 'bg-rose-500 text-white',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${colors[color]} mx-0.5 align-middle`}>
      {children}
    </span>
  );
};

const Path = ({ items }: { items: string[] }) => (
  <div className="flex items-center flex-wrap gap-1 p-2 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-lg">
    {items.map((it, i) => (
      <span key={i} className="flex items-center gap-1">
        {i > 0 && <span className="text-purple-300">→</span>}
        <span className="text-xs font-medium text-purple-800">{it}</span>
      </span>
    ))}
  </div>
);

const Mockup = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 bg-gray-50/50">
    {title && <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">{title}</p>}
    <div className="text-xs text-gray-600">{children}</div>
  </div>
);

const Bullets = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="text-sm text-gray-700 space-y-1.5 pl-5 list-disc marker:text-[#9c27b0]">
    {items.map((it, i) => <li key={i}>{it}</li>)}
  </ul>
);

const StatusPill = ({ color, label }: { color: 'gray' | 'amber' | 'blue' | 'green' | 'red'; label: string }) => {
  const colors = {
    gray:  'bg-gray-100 text-gray-700 border-gray-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue:  'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red:   'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colors[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        color === 'gray'  ? 'bg-gray-400'    :
        color === 'amber' ? 'bg-amber-500'   :
        color === 'blue'  ? 'bg-blue-500'    :
        color === 'green' ? 'bg-emerald-500' :
                            'bg-rose-500'
      }`} />
      {label}
    </span>
  );
};

const FAQ = ({ q, children }: { q: string; children: React.ReactNode }) => (
  <details className="group border border-gray-200 rounded-lg overflow-hidden">
    <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 flex items-center justify-between">
      <span>{q}</span>
      <span className="text-[#9c27b0] text-xs group-open:rotate-90 transition-transform">▶</span>
    </summary>
    <div className="px-3 py-2.5 text-sm text-gray-600 border-t border-gray-100 bg-gray-50/50 space-y-2">
      {children}
    </div>
  </details>
);

// ── REAL UI mockups (mimic actual app components) ───────────────────────────

/** Real-looking primary button (purple gradient) like the actual app */
const RealBtn = ({ icon: Icon, label, variant = 'primary' }: {
  icon?: LucideIcon; label: string; variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
}) => {
  const styles: Record<string, string> = {
    primary:   'bg-[#9c27b0] hover:bg-[#7b1fa2] text-white shadow-sm',
    secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200',
    success:   'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm',
    danger:    'bg-rose-500 hover:bg-rose-600 text-white shadow-sm',
    ghost:     'text-gray-600 hover:bg-gray-100',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${styles[variant]} mx-0.5 align-middle select-none`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
};

/** Real-looking sidebar nav item with icon + optional badge */
const RealNavItem = ({ icon: Icon, label, badge, active = false }: {
  icon: LucideIcon; label: string; badge?: number | 'dot'; active?: boolean;
}) => (
  <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${active ? 'bg-white/15' : 'hover:bg-white/8'} text-white/90 text-xs font-medium select-none`}>
    {active && <span className="absolute left-0 w-[3px] h-4 bg-gradient-to-b from-fuchsia-400 to-purple-600 rounded-r-full" />}
    <Icon className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.6} />
    <span className="flex-1 truncate">{label}</span>
    {badge != null && (
      badge === 'dot'
        ? <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        : <span className="px-1.5 min-w-[16px] h-[16px] flex items-center justify-center bg-[#9c27b0] text-white text-[9px] font-bold rounded-full">{badge}</span>
    )}
  </div>
);

/** Mini sidebar mockup — shows a few nav items in the real dark gradient */
const SidebarMockup = ({ items, sectionLabel }: {
  items: { icon: LucideIcon; label: string; badge?: number | 'dot'; active?: boolean }[];
  sectionLabel?: string;
}) => (
  <div
    className="rounded-lg overflow-hidden p-2 space-y-px max-w-[200px]"
    style={{ background: 'linear-gradient(175deg, #1a0733 0%, #2a1554 55%, #1e0e42 100%)' }}
  >
    {sectionLabel && (
      <p className="px-3 mb-1 text-[8px] font-bold tracking-[0.18em] text-white/30 uppercase select-none">
        {sectionLabel}
      </p>
    )}
    {items.map((it, i) => (
      <RealNavItem key={i} icon={it.icon} label={it.label} badge={it.badge} active={it.active} />
    ))}
  </div>
);

/** Status pill matching the real status colors used in the app */
const RealHeader = ({ title, action, count }: {
  title: string; action?: React.ReactNode; count?: string;
}) => (
  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <div>
        <p className="text-base font-bold text-gray-900">{title}</p>
        {count && <p className="text-[11px] text-gray-500">{count}</p>}
      </div>
      {action}
    </div>
  </div>
);

/** Browser-frame style screenshot mockup */
const Frame = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
    <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border-b border-gray-200">
      <span className="w-2 h-2 rounded-full bg-rose-400" />
      <span className="w-2 h-2 rounded-full bg-amber-400" />
      <span className="w-2 h-2 rounded-full bg-emerald-400" />
      {title && <span className="ml-3 text-[10px] text-gray-500 font-medium">{title}</span>}
    </div>
    <div className="bg-white p-3">{children}</div>
  </div>
);

/** A "Go to this page" link button — actually navigates from inside the help widget */
const GoTo = ({ href, label = 'Aller à cette page' }: { href: string; label?: string }) => (
  <Link
    href={href}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#9c27b0] to-[#6a1b9a] text-white rounded-lg hover:from-[#7b1fa2] hover:to-[#5a1880] transition-all shadow-sm"
  >
    {label}
    <ArrowRight className="h-3 w-3" />
  </Link>
);

/** Quote card mockup — fidèle à la vraie carte de la page Devis */
const QuoteCardMockup = ({ name, eventType = 'Mariage', status, amount, date, guests = 100, highlightAction }: {
  name: string;
  eventType?: string;
  status: string;
  amount: string;
  date: string;
  guests?: number;
  /** Optionally pulse one action button to indicate "click here" */
  highlightAction?: 'apercu' | 'pdf' | 'duplicate' | 'finance' | 'move' | 'weboword' | 'delete';
}) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-4 max-w-sm">
    {/* Header: icon + name + event type */}
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-xl bg-[#f3e5f5] flex items-center justify-center flex-shrink-0">
        <Heart className="h-4 w-4 text-[#9c27b0]" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{name}</p>
        <p className="text-xs text-gray-500 truncate">{eventType}</p>
      </div>
    </div>

    {/* Date + couverts */}
    <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3">
      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{date}</span>
      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{guests} couverts</span>
    </div>

    {/* Amount + status */}
    <div className="pt-3 border-t border-gray-100 flex items-center justify-between mb-2.5">
      <p className="font-bold text-gray-900 text-sm">{amount}<span className="text-[10px] font-normal text-gray-400 ml-1">TTC</span></p>
      <QS k={status} />
    </div>

    {/* Action row : Aperçu + 5 icônes */}
    <div className="flex items-center gap-1">
      <div className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-gray-500 border border-gray-200 rounded-lg ${highlightAction === 'apercu' ? 'ring-2 ring-rose-400 ring-offset-1 animate-pulse' : ''}`}>
        <Eye className="h-3 w-3" /> Aperçu
      </div>
      <div className={`p-1.5 text-gray-400 ${highlightAction === 'pdf' ? 'ring-2 ring-rose-400 ring-offset-1 rounded-lg animate-pulse' : ''}`}><Printer className="h-3 w-3" /></div>
      <div className={`p-1.5 text-gray-400 ${highlightAction === 'duplicate' ? 'ring-2 ring-rose-400 ring-offset-1 rounded-lg animate-pulse text-[#9c27b0]' : ''}`}><Copy className="h-3 w-3" /></div>
      <div className={`p-1.5 text-gray-400 ${highlightAction === 'finance' ? 'ring-2 ring-rose-400 ring-offset-1 rounded-lg animate-pulse text-emerald-600' : ''}`}><Wallet className="h-3 w-3" /></div>
      <div className={`p-1.5 text-gray-400 ${highlightAction === 'move' ? 'ring-2 ring-rose-400 ring-offset-1 rounded-lg animate-pulse text-[#9c27b0]' : ''}`}><FolderInput className="h-3 w-3" /></div>
      <div className={`p-1.5 text-[#9c27b0]/50 ${highlightAction === 'weboword' ? 'ring-2 ring-rose-400 ring-offset-1 rounded-lg animate-pulse text-[#9c27b0]' : ''}`}><LayoutTemplate className="h-3 w-3" /></div>
      <div className={`p-1.5 text-gray-300 ${highlightAction === 'delete' ? 'ring-2 ring-rose-400 ring-offset-1 rounded-lg animate-pulse text-rose-500' : ''}`}><Trash2 className="h-3 w-3" /></div>
    </div>
  </div>
);

/** Légende des actions disponibles sur une carte devis */
const QuoteCardActionsLegend = () => (
  <div className="grid grid-cols-2 gap-2 text-xs">
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"><Eye className="h-3.5 w-3.5 text-gray-500" /> <span><strong>Aperçu</strong> — fiche latérale</span></div>
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"><Printer className="h-3.5 w-3.5 text-gray-500" /> <span><strong>Imprimer / PDF</strong></span></div>
    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg"><Copy className="h-3.5 w-3.5 text-[#9c27b0]" /> <span><strong>Dupliquer</strong></span></div>
    <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg"><Wallet className="h-3.5 w-3.5 text-emerald-600" /> <span><strong>Gestion financière</strong></span></div>
    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg"><FolderInput className="h-3.5 w-3.5 text-[#9c27b0]" /> <span><strong>Déplacer</strong> vers un dossier</span></div>
    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg"><LayoutTemplate className="h-3.5 w-3.5 text-[#9c27b0]" /> <span><strong>WeboWord</strong> — éditer</span></div>
    <div className="flex items-center gap-2 p-2 bg-rose-50 rounded-lg"><Trash2 className="h-3.5 w-3.5 text-rose-500" /> <span><strong>Supprimer</strong> — devis non engagés</span></div>
  </div>
);

/** Les 12 statuts réels d'un devis (mêmes libellés et couleurs que la page Devis). */
const QUOTE_STATUSES: { key: string; label: string; badge: string; dot: string; group: 'cours' | 'confirme' | 'refus' }[] = [
  { key: 'nouveau',         label: 'Nouveau',          badge: 'bg-sky-50 text-sky-700',         dot: 'bg-sky-400',     group: 'cours'    },
  { key: 'broch_envoyee',   label: 'Brochure envoyée', badge: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400',   group: 'cours'    },
  { key: 'devis_a_faire',   label: 'Devis à faire',    badge: 'bg-yellow-50 text-yellow-700',   dot: 'bg-yellow-400',  group: 'cours'    },
  { key: 'devis_envoye',    label: 'Devis envoyé',     badge: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-400',   group: 'cours'    },
  { key: 'rdv_deg_a_venir', label: 'RDV/Dég à venir',  badge: 'bg-violet-50 text-violet-700',   dot: 'bg-violet-400',  group: 'cours'    },
  { key: 'rdv_deg_fait',    label: 'RDV/Dég fait',     badge: 'bg-purple-50 text-purple-700',   dot: 'bg-purple-400',  group: 'cours'    },
  { key: 'devis_final',     label: 'Devis final',      badge: 'bg-orange-50 text-orange-700',   dot: 'bg-orange-400',  group: 'cours'    },
  { key: 'valide',          label: 'Validé',           badge: 'bg-teal-50 text-teal-700',       dot: 'bg-teal-400',    group: 'confirme' },
  { key: 'acompte',         label: 'Acompte reçu',     badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400', group: 'confirme' },
  { key: 'paye',            label: 'Payé',             badge: 'bg-green-50 text-green-700',     dot: 'bg-green-500',   group: 'confirme' },
  { key: 'refus_client',    label: 'Refus client',     badge: 'bg-red-50 text-red-600',         dot: 'bg-red-300',     group: 'refus'    },
  { key: 'refus_traiteur',  label: 'Refus traiteur',   badge: 'bg-rose-50 text-rose-700',       dot: 'bg-rose-400',    group: 'refus'    },
];

/** Pastille de statut identique à celle de la page Devis. */
const QS = ({ k }: { k: string }) => {
  const st = QUOTE_STATUSES.find((x) => x.key === k) ?? QUOTE_STATUSES[0];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.badge} mx-0.5 align-middle`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
    </span>
  );
};

/** Récapitulatif des statuts d'un groupe, avec leur signification. */
const StatusTable = ({ group, rows }: { group: 'cours' | 'confirme' | 'refus'; rows: Record<string, string> }) => (
  <div className="space-y-1.5">
    {QUOTE_STATUSES.filter((s) => s.group === group).map((s) => (
      <div key={s.key} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
        <span className="flex-shrink-0"><QS k={s.key} /></span>
        <p className="text-xs text-gray-600 flex-1 pt-0.5">{rows[s.key]}</p>
      </div>
    ))}
  </div>
);

/** Tuile de dossier de devis, telle qu'elle apparaît au-dessus de la liste. */
const FolderTile = ({ name, count, sub, color = 'purple' }: { name: string; count: number; sub?: number; color?: 'purple' | 'blue' | 'emerald' | 'amber' }) => {
  const tones: Record<string, string> = {
    purple:  'bg-[#faf5ff] border-[#e9d5ff] text-[#9c27b0]',
    blue:    'bg-sky-50/60 border-sky-200 text-sky-600',
    emerald: 'bg-emerald-50/60 border-emerald-200 text-emerald-600',
    amber:   'bg-amber-50/60 border-amber-200 text-amber-600',
  };
  return (
    <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${tones[color]}`}>
      <span className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
        <Folder className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-[11px] text-gray-400">{count} devis{sub ? ` · ${sub} sous-dossier${sub > 1 ? 's' : ''}` : ''}</p>
      </div>
    </div>
  );
};

/** WeboWord editor sidebar mockup — les 7 panneaux réels de l'éditeur */
const WeboSidebarMockup = ({ activePanel }: { activePanel?: 'client' | 'services' | 'event' | 'style' | 'images' | 'cover' | 'photos' }) => {
  const items = [
    { key: 'client',   icon: User,          label: 'Client' },
    { key: 'services', icon: PackageIcon,   label: 'Prestations' },
    { key: 'event',    icon: CalendarDays,  label: 'Événement' },
    { key: 'style',    icon: Palette,       label: 'Style' },
    { key: 'images',   icon: ImageIcon,     label: 'Images' },
    { key: 'cover',    icon: LayoutTemplate, label: 'Page de garde' },
    { key: 'photos',   icon: ImageIcon,     label: 'Page photos' },
  ];
  return (
    <SidebarMockup
      sectionLabel="Édition du devis"
      items={items.map((it) => ({ icon: it.icon, label: it.label, active: it.key === activePanel }))}
    />
  );
};

// ── Articles ────────────────────────────────────────────────────────────────
// ⚠️ Cette aide décrit le logiciel TEL QU'IL EST. Avant d'ajouter ou de modifier
//    un article, vérifie le comportement dans le code (pages app/(app)/…) plutôt
//    que de décrire une intention : une aide qui décrit des boutons inexistants
//    fait perdre confiance dans tout le reste.
export const HELP_ARTICLES: HelpArticle[] = [
  // ════════════════════════════════════════════════════════════════════════
  // DÉMARRER
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'tour-app',
    category: 'demarrer',
    title: 'Visite guidée de WeboDevis',
    description: "Comprendre l'organisation de l'app en 5 minutes",
    keywords: ['début', 'sidebar', 'navigation', 'menu', 'tour', 'organisation'],
    body: (
      <div className="space-y-4">
        <Lead>WeboDevis couvre toute ta chaîne : prospection, devis, événement, courses, stock et achats. Tout est rangé dans 5 groupes de la barre latérale.</Lead>

        <Section icon="🗺️" title="Les 5 groupes de la sidebar">
          <div className="grid grid-cols-2 gap-3">
            <SidebarMockup
              sectionLabel="Commerce"
              items={[
                { icon: LayoutDashboard, label: 'Tableau de bord' },
                { icon: FileText,        label: 'Devis', badge: 4 },
                { icon: Users,           label: 'Clients' },
                { icon: UserCheck,       label: 'Prospects', badge: 2 },
              ]}
            />
            <SidebarMockup
              sectionLabel="Production"
              items={[
                { icon: CalendarDays,    label: 'Calendrier', badge: 'dot' },
                { icon: CalendarRange,   label: 'Événements' },
                { icon: ShoppingBasket,  label: 'Commandes' },
              ]}
            />
            <SidebarMockup
              sectionLabel="Stock"
              items={[{ icon: Boxes, label: 'Stock', badge: 3 }]}
            />
            <SidebarMockup
              sectionLabel="Catalogue ▼"
              items={[
                { icon: Package,        label: 'Prestations' },
                { icon: Carrot,         label: 'Ingrédients' },
                { icon: Users2,         label: 'Extras' },
                { icon: Boxes,          label: 'Location' },
                { icon: ShoppingBasket, label: 'Courses globales' },
                { icon: Truck,          label: 'Fournisseurs' },
              ]}
            />
          </div>
          <P>Le 5ᵉ groupe <strong>Paramètres</strong> contient : Catégories, Profil entreprise, Modèles de devis, Templates location — et <strong>Espace admin</strong> si ton compte a ce rôle.</P>
          <Note><strong>Catalogue</strong> et <strong>Paramètres</strong> sont des groupes dépliables : ils s&apos;ouvrent tout seuls quand tu es sur une de leurs pages.</Note>
        </Section>

        <Section icon="🔔" title="Ce que veulent dire les badges">
          <Bullets items={[
            <>Sur <strong>Devis</strong> : le nombre de devis <strong>en cours</strong>, c&apos;est-à-dire dans un des 7 statuts de prospection (de <QS k="nouveau" /> à <QS k="devis_final" />).</>,
            <>Sur <strong>Prospects</strong> : le nombre de demandes au statut <QS k="nouveau" /> pas encore traitées.</>,
            <>Sur <strong>Stock</strong> : le nombre d&apos;ingrédients passés sous leur seuil d&apos;alerte.</>,
            <>Point rouge sur <strong>Calendrier</strong> : un événement <strong>confirmé</strong> a lieu aujourd&apos;hui.</>,
          ]} />
        </Section>

        <Section icon="📱" title="Sur mobile">
          <P>La sidebar laisse place à une barre d&apos;onglets en bas de l&apos;écran : Accueil, Devis, Clients, Calendrier, Événements, Paramètres.</P>
        </Section>

        <Section icon="⌨️" title="Repères utiles">
          <Bullets items={[
            <>Bouton <Code>?</Code> violet en bas à droite : ouvre ce centre d&apos;aide. Il se déplace, se redimensionne, et reste ouvert quand tu changes de page.</>,
            <>Bouton <RealBtn variant="ghost" label="Réduire" /> en bas de la sidebar : la rétrécit à 64 px (icônes seules).</>,
            <>Icône <Bell className="inline h-3.5 w-3.5 text-gray-600" /> dans le header : centre de notifications.</>,
          ]} />
        </Section>

        <Tip>Ordre conseillé pour démarrer : <strong>1.</strong> profil entreprise → <strong>2.</strong> quelques prestations → <strong>3.</strong> ton premier devis.</Tip>

        <div className="flex flex-wrap gap-2">
          <GoTo href="/parametres" label="Profil entreprise" />
          <GoTo href="/prestations" label="Mes prestations" />
          <GoTo href="/devis" label="Mes devis" />
        </div>
      </div>
    ),
  },
  {
    id: 'premier-devis',
    category: 'demarrer',
    title: 'Créer mon premier devis (parcours complet)',
    description: 'De la page vide au PDF imprimé',
    keywords: ['premier', 'commencer', 'starter', 'tutoriel', 'guide'],
    body: (
      <div className="space-y-4">
        <Lead>Le chemin complet, dans l&apos;ordre. Compte 10 minutes la première fois, 2 minutes les suivantes.</Lead>

        <Section icon="📋" title="À faire une seule fois">
          <Step n={1} title="Compléter le profil entreprise">
            <P>Nom de l&apos;entreprise, adresse, téléphone, SIRET et logo. Ces informations s&apos;impriment en tête de tous tes devis.</P>
            <GoTo href="/parametres" label="Aller aux paramètres" />
          </Step>
          <Step n={2} title="(Recommandé) Créer quelques prestations">
            <P>Tu pourras piocher dedans par autocomplétion. Sans catalogue, tu peux quand même saisir des lignes libres dans le devis.</P>
            <GoTo href="/prestations" label="Aller aux prestations" />
          </Step>
        </Section>

        <Section icon="✏️" title="Créer le devis">
          <Step n={1} title="Page Devis → Nouveau">
            <Frame title="Page Devis — header">
              <RealHeader
                title="Mes devis"
                count="0 devis au total"
                action={<RealBtn icon={Plus} label="Nouveau" variant="primary" />}
              />
            </Frame>
            <GoTo href="/devis" label="Aller à la page Devis" />
          </Step>
          <Step n={2} title="Renseigner le client et l'événement">
            <P>L&apos;écran de démarrage demande : le client (existant ou nouveau), le type d&apos;événement, la date, le lieu, le nombre de convives, le modèle de document et la langue.</P>
            <Note>Un client saisi avec un email est enregistré dans ton carnet Clients au passage — pas de double saisie.</Note>
          </Step>
          <Step n={3} title="Ajouter les prestations">
            <P>Tu arrives directement dans l&apos;éditeur WeboWord. Ouvre le panneau <strong>Prestations</strong> :</P>
            <WeboSidebarMockup activePanel="services" />
            <Bullets items={[
              <>Autocomplétion sur ton catalogue.</>,
              <>Ou <RealBtn icon={Plus} label="Ligne personnalisée" variant="secondary" /> pour une ligne unique.</>,
              <>Prix enfant, ligne offerte, ligne en option, saut de page : tout se règle sur la ligne.</>,
            ]} />
          </Step>
          <Step n={4} title="(Optionnel) Soigner le document">
            <P>Panneaux <strong>Style</strong>, <strong>Images</strong>, <strong>Page de garde</strong> et <strong>Page photos</strong>.</P>
          </Step>
          <Step n={5} title="Enregistrer, puis sortir le document">
            <P>En bas de la barre latérale de l&apos;éditeur, bloc <strong>Actions</strong> :</P>
            <div className="flex gap-2 flex-wrap p-3 bg-gradient-to-br from-purple-900/95 to-purple-950 rounded-lg">
              <RealBtn icon={Save} label="Enregistrer" variant="primary" />
              <RealBtn icon={Download} label="Enregistrer PDF" variant="secondary" />
              <RealBtn icon={Printer} label="Imprimer" variant="secondary" />
            </div>
            <Warning>Il n&apos;y a <strong>pas de sauvegarde automatique</strong> dans l&apos;éditeur : clique <strong>Enregistrer</strong> avant de quitter la page.</Warning>
          </Step>
        </Section>

        <Section icon="🎯" title="Après coup">
          <P>Ton devis apparaît dans la liste sous cette forme :</P>
          <QuoteCardMockup
            name="M. et Mme MARTIN"
            eventType="Mariage"
            status="devis_a_faire"
            amount="11 540 €"
            date="29 mai 2027"
          />
          <Bullets items={[
            <>Le statut de départ est <QS k="devis_a_faire" />. Tu le fais avancer à la main au fil de ta relation client.</>,
            <>Quand il passe en <QS k="valide" />, <QS k="acompte" /> ou <QS k="paye" />, il devient un événement de production (calendrier, courses, staffing).</>,
          ]} />
        </Section>

        <Tip>Pour aller plus vite ensuite : duplique un devis existant, ou enregistre-le comme <strong>modèle</strong> réutilisable.</Tip>
      </div>
    ),
  },
  {
    id: 'sidebar-personnaliser',
    category: 'demarrer',
    title: 'Personnaliser ma sidebar',
    description: 'Réduire, déplier les groupes, comprendre les badges',
    keywords: ['barre', 'menu', 'collapse', 'badges'],
    body: (
      <div className="space-y-4">
        <Lead>La sidebar s&apos;adapte : tu peux la rétrécir et replier les groupes que tu utilises rarement.</Lead>

        <Section icon="📐" title="Réduire la sidebar">
          <P>Bouton <Btn color="gray">Réduire</Btn> tout en bas : elle passe de 240 px à 64 px, seules les icônes restent. Survole une icône pour voir son libellé.</P>
        </Section>

        <Section icon="📁" title="Groupes dépliables">
          <P>Deux groupes se plient : <strong>Catalogue</strong> (prestations, ingrédients, extras, location, courses globales, fournisseurs) et <strong>Paramètres</strong> (catégories, profil, modèles, templates location).</P>
          <P>Si tu navigues vers une page interne (ex. <Code>/prestations</Code>), le groupe s&apos;ouvre automatiquement.</P>
        </Section>

        <Section icon="🔔" title="Les badges, en détail">
          <Bullets items={[
            <><Btn>4</Btn> sur <strong>Devis</strong> — devis en cours de prospection : <QS k="nouveau" /> <QS k="broch_envoyee" /> <QS k="devis_a_faire" /> <QS k="devis_envoye" /> <QS k="rdv_deg_a_venir" /> <QS k="rdv_deg_fait" /> <QS k="devis_final" />.</>,
            <><Btn>2</Btn> sur <strong>Prospects</strong> — demandes au statut <QS k="nouveau" />.</>,
            <><Btn color="red">3</Btn> sur <strong>Stock</strong> — ingrédients sous le seuil d&apos;alerte.</>,
            <>Point rouge sur <strong>Calendrier</strong> — un événement confirmé a lieu aujourd&apos;hui.</>,
          ]} />
        </Section>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // DEVIS
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'liste-devis',
    category: 'devis',
    title: 'La page Devis : 3 vues, 4 sections',
    description: 'Grille, tableau, pipeline, recherche, filtres et tri',
    keywords: ['liste', 'vue', 'grille', 'tableau', 'pipeline', 'filtre', 'tri', 'recherche'],
    body: (
      <div className="space-y-4">
        <Lead>Toute ta activité commerciale tient sur cette page. Trois façons de la regarder, selon ce que tu cherches.</Lead>

        <GoTo href="/devis" label="Aller à la page Devis" />

        <Section icon="🔭" title="Changer de vue">
          <Frame>
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
              <span className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-[#9c27b0] rounded shadow-sm"><LayoutGrid className="h-3 w-3" />Grille</span>
              <span className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-gray-500 rounded"><List className="h-3 w-3" />Tableau</span>
              <span className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-gray-500 rounded"><Columns3 className="h-3 w-3" />Pipeline</span>
            </div>
          </Frame>
          <Bullets items={[
            <><strong>Grille</strong> — les cartes, rangées en 4 sections repliables. La vue de travail au quotidien.</>,
            <><strong>Tableau</strong> — une ligne par devis (client, événement, date, statut, montant TTC). Pour balayer vite.</>,
            <><strong>Pipeline</strong> — un kanban à 12 colonnes, une par statut, avec glisser-déposer.</>,
          ]} />
        </Section>

        <Section icon="🗂️" title="Les 4 sections de la vue Grille">
          <Bullets items={[
            <><strong>Prospection</strong> — les demandes reçues via ton formulaire qui n&apos;ont pas encore de devis.</>,
            <><strong>Devis en cours</strong> — les 7 statuts de prospection. Ouverte par défaut.</>,
            <><strong>Confirmés / Événements</strong> — <QS k="valide" /> <QS k="acompte" /> <QS k="paye" />.</>,
            <><strong>Archivés / Refusés</strong> — <QS k="refus_client" /> <QS k="refus_traiteur" />.</>,
          ]} />
          <P>Clique sur l&apos;en-tête d&apos;une section pour la replier. Le compteur reste visible.</P>
        </Section>

        <Section icon="🔍" title="Rechercher, filtrer, trier">
          <Bullets items={[
            <><strong>Recherche</strong> — sur le nom du client, son prénom/nom, son email et le type d&apos;événement.</>,
            <><strong>Filtres de statut</strong> — un bouton par statut, plus « Tous ». Les refus n&apos;apparaissent que si tu sélectionnes explicitement un filtre de refus.</>,
            <><strong>Tri</strong> — Plus récents, Date d&apos;événement, Montant, Client A-Z.</>,
          ]} />
        </Section>

        <Section icon="🎛️" title="Les actions d'une carte">
          <QuoteCardMockup
            name="RICHARD"
            eventType="Mariage"
            status="devis_envoye"
            amount="13 848,00 €"
            date="29 mai 2027"
            guests={100}
          />
          <QuoteCardActionsLegend />
          <Note>Le bouton <strong>Supprimer</strong> n&apos;apparaît que sur les devis non engagés (<QS k="nouveau" />, <QS k="devis_a_faire" />, <QS k="broch_envoyee" />) ou importés — pour éviter d&apos;effacer un dossier en cours.</Note>
        </Section>

        <Section icon="🧮" title="Comment le montant est calculé">
          <P>Le montant affiché est recalculé depuis les lignes du devis, pas figé en base :</P>
          <Bullets items={[
            <>Les lignes <strong>offertes</strong>, <strong>en option</strong> et les sauts de page sont exclus.</>,
            <>Le prix enfant est appliqué au nombre d&apos;enfants quand il est renseigné.</>,
            <>Le total est affiché <strong>TTC</strong>, au taux de TVA propre au devis.</>,
          ]} />
        </Section>
      </div>
    ),
  },
  {
    id: 'dossiers-devis',
    category: 'devis',
    title: 'Ranger mes devis dans des dossiers',
    description: 'Dossiers et sous-dossiers, couleurs, icônes, glisser-déposer',
    keywords: ['dossier', 'ranger', 'classer', 'organiser', 'sous-dossier', 'arborescence'],
    body: (
      <div className="space-y-4">
        <Lead>Au-dessus de la liste des devis, une barre de dossiers permet de classer tes devis comme des fichiers : par saison, par type d&apos;événement, par lieu… avec autant de niveaux que tu veux.</Lead>

        <GoTo href="/devis" label="Aller à la page Devis" />

        <Section icon="📁" title="Créer un dossier">
          <Step n={1} title="Bouton « Nouveau dossier »">À droite du fil d&apos;Ariane, en haut de la liste.</Step>
          <Step n={2} title="Nomme-le, choisis une couleur et une icône">
            <P>8 couleurs et 16 icônes (mariage, entreprise, saison, lieu, archives…) pour repérer un dossier d&apos;un coup d&apos;œil.</P>
            <div className="grid grid-cols-2 gap-2">
              <FolderTile name="Mariages 2026" count={12} sub={2} color="purple" />
              <FolderTile name="Entreprises" count={7} color="blue" />
            </div>
          </Step>
          <Step n={3} title="Entre dedans pour créer des sous-dossiers">
            <P>Un dossier créé pendant que tu es <em>dans</em> un dossier devient son sous-dossier. Le fil d&apos;Ariane <Code>Mes devis › Mariages › 2026</Code> te dit toujours où tu es.</P>
          </Step>
        </Section>

        <Section icon="🖐️" title="Ranger un devis">
          <Bullets items={[
            <><strong>Glisser-déposer</strong> — attrape une carte (ou une ligne du tableau) et lâche-la sur une tuile de dossier. Lâche-la sur un segment du fil d&apos;Ariane pour la faire remonter d&apos;un niveau.</>,
            <><strong>Bouton <FolderInput className="inline h-3.5 w-3.5 text-[#9c27b0]" /> Déplacer</strong> — sur la carte, la ligne du tableau, la carte du pipeline et dans la fiche du devis. Plus pratique sur mobile.</>,
            <>Un <strong>dossier</strong> se glisse aussi dans un autre dossier. Impossible de le déposer dans l&apos;un de ses propres sous-dossiers.</>,
          ]} />
        </Section>

        <Section icon="👁️" title="Ce que tu vois dans un dossier">
          <Bullets items={[
            <>Le dossier ouvert filtre les <strong>trois vues</strong> (grille, tableau, pipeline), <strong>sous-dossiers compris</strong>.</>,
            <>Le compteur d&apos;une tuile inclut les devis de ses sous-dossiers.</>,
            <>Un devis créé, importé ou dupliqué depuis un dossier y atterrit directement.</>,
            <>L&apos;adresse de la page retient le dossier ouvert : le rafraîchissement et le bouton Retour te ramènent au bon endroit.</>,
          ]} />
        </Section>

        <Section icon="🔎" title="La recherche traverse les dossiers">
          <P>Dès que tu tapes dans la barre de recherche, WeboDevis cherche dans <strong>tous</strong> les dossiers, pas seulement celui ouvert. Un bandeau te le rappelle, et le chemin du dossier s&apos;affiche sous chaque résultat.</P>
        </Section>

        <Section icon="🗑️" title="Supprimer un dossier">
          <P>Supprimer un dossier ne supprime <strong>aucun devis</strong> : ses devis et ses sous-dossiers remontent dans le dossier parent. Une confirmation te le rappelle avant.</P>
        </Section>
      </div>
    ),
  },
  {
    id: 'nom-interne',
    category: 'devis',
    title: 'Nommer un devis pour s’y retrouver',
    description: 'Le nom interne, visible par toi seul',
    keywords: ['nom', 'renommer', 'titre', 'interne', 'libellé'],
    body: (
      <div className="space-y-4">
        <Lead>Quand tu as trois devis pour le même client, le nom du client ne suffit plus. Le <strong>nom interne</strong> te permet de les distinguer sans rien changer au document du client.</Lead>

        <Section icon="✏️" title="Où le saisir">
          <Step n={1} title="Ouvre la fiche du devis">Carte du devis → <RealBtn icon={Eye} label="Aperçu" variant="secondary" />.</Step>
          <Step n={2} title="Champ « Nom du devis (interne) »">Juste sous l&apos;encart de l&apos;événement. Il s&apos;enregistre dès que tu sors du champ.</Step>
        </Section>

        <Section icon="👁️" title="Ce que ça change">
          <Bullets items={[
            <>Ce nom remplace le nom du client <strong>dans tes listes</strong> (grille, tableau, pipeline, dossiers).</>,
            <>Il n&apos;apparaît <strong>jamais</strong> sur le devis imprimé ou en PDF.</>,
            <>Laissé vide, l&apos;affichage retombe sur le nom du client.</>,
          ]} />
        </Section>

        <Tip>Utile pour les versions : « MARTIN — option 120 couverts », « MARTIN — version cocktail ».</Tip>
      </div>
    ),
  },
  {
    id: 'creer-devis',
    category: 'devis',
    title: "L'éditeur de devis",
    description: 'WeboWord, ses 7 panneaux, et le mode assistant',
    keywords: ['nouveau devis', 'créer', 'ajouter', 'éditeur', 'weboword', 'wizard'],
    body: (
      <div className="space-y-4">
        <Lead>WeboDevis propose deux éditeurs pour le même devis : <strong>WeboWord</strong>, une page façon traitement de texte, et un <strong>assistant</strong> plus guidé.</Lead>

        <Section icon="🧭" title="Les 7 panneaux de WeboWord">
          <WeboSidebarMockup activePanel="services" />
          <Step n={1} title="Client">
            Recherche dans ton carnet ou saisie directe : nom, email, téléphone, adresse. Pour un client entreprise, tu choisis aussi le contact destinataire.
          </Step>
          <Step n={2} title="Prestations">
            <Bullets items={[
              <>Autocomplétion sur ton catalogue de prestations.</>,
              <><RealBtn icon={Plus} label="Ligne personnalisée" variant="secondary" /> pour une ligne libre.</>,
              <>Par ligne : quantité, prix unitaire, <strong>prix enfant</strong>, ligne <strong>offerte</strong>, ligne <strong>en option</strong> (affichée mais hors total), <strong>saut de page</strong>.</>,
            ]} />
          </Step>
          <Step n={3} title="Événement">
            Type, date, lieu, nombre de convives (adultes + enfants). Ces informations alimentent le calendrier et la fiche événement.
          </Step>
          <Step n={4} title="Style">
            Police, taille, interligne, couleur du texte, alignement, et masquage des prix pour un rendu « menu ».
          </Step>
          <Step n={5} title="Images">
            Photos insérées dans le corps du document.
          </Step>
          <Step n={6} title="Page de garde">
            Couverture du document : modèle Standard, Mariage ou Business, nom du client, lieu, date, titre et sous-titre.
          </Step>
          <Step n={7} title="Page photos">
            Une page dédiée aux visuels, composée par blocs.
          </Step>
        </Section>

        <Section icon="🔀" title="Les deux éditeurs">
          <Bullets items={[
            <><strong>WeboWord</strong> — <Code>/devis/[id]/modifier?mode=weboword</Code>. C&apos;est ce qui s&apos;ouvre depuis l&apos;icône <LayoutTemplate className="inline h-3.5 w-3.5 text-[#9c27b0]" /> de la carte, et par défaut dès qu&apos;un devis a une mise en page enregistrée.</>,
            <><strong>Assistant</strong> — <Code>?mode=wizard</Code>. Formulaire plus classique (client, prestations, options) pour saisir vite sans se soucier de la mise en page.</>,
          ]} />
        </Section>

        <Section icon="💾" title="Enregistrer son travail">
          <P>Le bloc <strong>Actions</strong>, en bas de la barre latérale de l&apos;éditeur :</P>
          <div className="flex gap-2 flex-wrap p-3 bg-gradient-to-br from-purple-900/95 to-purple-950 rounded-lg">
            <RealBtn icon={Save} label="Enregistrer" variant="primary" />
            <RealBtn icon={Download} label="Enregistrer PDF" variant="secondary" />
            <RealBtn icon={Printer} label="Imprimer" variant="secondary" />
          </div>
          <Bullets items={[
            <><strong>Enregistrer</strong> — sauvegarde le contenu, la mise en page, la police et les pages de garde/photos.</>,
            <><strong>Enregistrer PDF</strong> — produit le fichier à envoyer au client.</>,
            <><strong>Imprimer</strong> — ouvre la fenêtre d&apos;impression du navigateur.</>,
          ]} />
          <Warning>L&apos;éditeur ne sauvegarde <strong>pas tout seul</strong>. Prends le réflexe de cliquer <strong>Enregistrer</strong> avant de changer de page ou de fermer l&apos;onglet — la même règle vaut pour le mode assistant.</Warning>
        </Section>
      </div>
    ),
  },
  {
    id: 'imprimer-devis',
    category: 'devis',
    title: 'Imprimer ou transmettre un devis',
    description: 'Page d’impression, PDF, envoi au client',
    keywords: ['imprimer', 'pdf', 'envoyer', 'transmettre', 'partager', 'mail'],
    body: (
      <div className="space-y-4">
        <Lead>Le devis se transmet sous forme de document : tu l&apos;imprimes ou tu l&apos;enregistres en PDF, puis tu l&apos;envoies par tes propres moyens (email, messagerie, remise en main propre).</Lead>

        <Section icon="🖨️" title="Sortir le document">
          <Step n={1} title="Depuis l'éditeur">
            <P>Bloc <strong>Actions</strong> de la barre latérale : <RealBtn icon={Download} label="Enregistrer PDF" variant="secondary" /> pour le fichier, <RealBtn icon={Printer} label="Imprimer" variant="secondary" /> pour l&apos;impression directe. Pense à <RealBtn icon={Save} label="Enregistrer" variant="primary" /> avant.</P>
          </Step>
          <Step n={2} title="Ou depuis la liste des devis">
            <P>L&apos;icône imprimante de la carte ouvre la page d&apos;impression dans un nouvel onglet, mise en page finale comprise.</P>
            <QuoteCardMockup
              name="RICHARD"
              eventType="Mariage"
              status="devis_final"
              amount="13 848,00 €"
              date="29 mai 2027"
              highlightAction="pdf"
            />
          </Step>
          <Step n={3} title="Ctrl + P">
            <P>Puis <em>Enregistrer au format PDF</em> pour un fichier à joindre à un mail, ou choisis ton imprimante pour un rendez-vous en présentiel.</P>
          </Step>
        </Section>

        <Section icon="📎" title="Ce que contient le document">
          <Bullets items={[
            <>L&apos;en-tête de ton entreprise (nom, adresse, téléphone, SIRET, logo) depuis ton profil.</>,
            <>La page de garde et la page photos si tu les as activées.</>,
            <>Le détail des prestations, les options, les totaux HT/TVA/TTC.</>,
            <>Tes <strong>CGV</strong> en fin de document.</>,
          ]} />
        </Section>

        <Section icon="🔄" title="Après l'envoi, mets le statut à jour">
          <P>WeboDevis ne sait pas que tu as envoyé le mail : c&apos;est toi qui fais avancer le statut, à la main ou par glisser-déposer dans le pipeline.</P>
          <Bullets items={[
            <>Devis parti au client → <QS k="devis_envoye" />.</>,
            <>Version définitive envoyée → <QS k="devis_final" />.</>,
            <>Accord du client → <QS k="valide" />, puis <QS k="acompte" /> et <QS k="paye" />.</>,
          ]} />
        </Section>

        <Note>Le client n&apos;a pas d&apos;espace en ligne pour accepter ou refuser un devis : la validation se fait hors application, et tu la traduis par le statut.</Note>
      </div>
    ),
  },
  {
    id: 'pipeline-statuts',
    category: 'devis',
    title: 'Les 12 statuts et le pipeline',
    description: 'Suivre chaque affaire de la demande au paiement',
    keywords: ['kanban', 'statut', 'workflow', 'crm', 'avancement', 'pipeline'],
    body: (
      <div className="space-y-4">
        <Lead>Un devis porte un statut qui dit où en est l&apos;affaire. Ils se répartissent en trois familles : en cours, confirmés, refusés.</Lead>

        <GoTo href="/devis" label="Aller à la page Devis" />

        <Section icon="🕐" title="En cours (7 statuts)">
          <StatusTable
            group="cours"
            rows={{
              nouveau: 'Demande tout juste arrivée, rien n’a encore été fait.',
              broch_envoyee: 'Tu as envoyé ta brochure ou ta plaquette commerciale.',
              devis_a_faire: 'À chiffrer. C’est le statut par défaut d’un devis créé.',
              devis_envoye: 'Le devis est parti chez le client, tu attends son retour.',
              rdv_deg_a_venir: 'Un rendez-vous ou une dégustation est planifié.',
              rdv_deg_fait: 'Le rendez-vous a eu lieu, décision en attente.',
              devis_final: 'Version définitive envoyée après ajustements.',
            }}
          />
          <Note>Ce sont ces 7 statuts qui alimentent le badge <strong>Devis</strong> de la sidebar.</Note>
        </Section>

        <Section icon="✅" title="Confirmés (3 statuts)">
          <StatusTable
            group="confirme"
            rows={{
              valide: 'Le client a dit oui. Le devis devient un événement de production.',
              acompte: 'L’acompte est encaissé.',
              paye: 'Le solde est réglé.',
            }}
          />
          <P>Ces trois statuts alimentent la section <strong>Confirmés / Événements</strong>, le calendrier et les listes de courses.</P>
        </Section>

        <Section icon="❌" title="Refusés (2 statuts)">
          <StatusTable
            group="refus"
            rows={{
              refus_client: 'Le client n’a pas donné suite ou a choisi ailleurs.',
              refus_traiteur: 'Tu as décliné : date prise, hors zone, non rentable.',
            }}
          />
        </Section>

        <Section icon="📊" title="Vue Pipeline">
          <P>Une colonne par statut, dans l&apos;ordre du cycle de vente. Chaque colonne affiche son nombre de devis et son total TTC cumulé.</P>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-yellow-50/40 border border-yellow-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between"><QS k="devis_a_faire" /><span className="text-[9px] text-gray-400 font-bold">2</span></div>
              <div className="bg-white border border-gray-200 rounded p-1.5 text-[10px] font-medium text-gray-700">M. DURAND</div>
              <div className="bg-white border border-gray-200 rounded p-1.5 text-[10px] font-medium text-gray-700">Mme PETIT</div>
            </div>
            <div className="p-2 bg-amber-50/40 border border-amber-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between"><QS k="devis_envoye" /><span className="text-[9px] text-amber-500 font-bold">1</span></div>
              <div className="bg-white border border-gray-200 rounded p-1.5 text-[10px] font-medium text-gray-700">M. MARTIN</div>
            </div>
            <div className="p-2 bg-teal-50/40 border border-teal-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between"><QS k="valide" /><span className="text-[9px] text-teal-500 font-bold">3</span></div>
              <div className="bg-white border border-gray-200 rounded p-1.5 text-[10px] font-medium text-gray-700">RICHARD</div>
              <div className="bg-white border border-gray-200 rounded p-1.5 text-[10px] font-medium text-gray-700">+2</div>
            </div>
          </div>
          <Bullets items={[
            <><strong>Glisser-déposer</strong> une carte d&apos;une colonne à l&apos;autre change son statut immédiatement.</>,
            <>Les prospects non convertis apparaissent aussi dans la colonne de leur statut, avec un badge « Prospect ».</>,
          ]} />
        </Section>

        <Section icon="🔄" title="Changer un statut sans glisser">
          <P>Ouvre la fiche du devis (bouton <RealBtn icon={Eye} label="Aperçu" variant="secondary" />) : la section <strong>Statut</strong> propose les 12 boutons. Plus confortable sur mobile.</P>
          <Note>Si le devis est rattaché à une prospection, changer son statut met aussi à jour celui du prospect — les deux restent synchronisés.</Note>
        </Section>
      </div>
    ),
  },
  {
    id: 'dupliquer-devis',
    category: 'devis',
    title: 'Dupliquer un devis ou créer un modèle',
    description: 'Repartir d’un existant pour gagner du temps',
    keywords: ['copier', 'duplication', 'cloner', 'modèle', 'template'],
    body: (
      <div className="space-y-4">
        <Lead>Deux façons de ne pas repartir de zéro : la duplication ponctuelle, et le modèle réutilisable.</Lead>

        <Section icon="📋" title="Dupliquer">
          <P>Icône <Copy className="inline h-3.5 w-3.5 text-[#9c27b0]" /> sur la carte du devis (ou la ligne du tableau) :</P>
          <QuoteCardMockup
            name="RICHARD"
            eventType="Mariage"
            status="valide"
            amount="13 848,00 €"
            date="29 mai 2027"
            guests={100}
            highlightAction="duplicate"
          />
          <P>Une fenêtre propose deux options. <strong>Duplication simple</strong> crée une copie qui reprend :</P>
          <Bullets items={[
            <>Les prestations, prix, remarques, TVA, style et mise en page WeboWord.</>,
            <>Le <strong>client à l&apos;identique</strong> (c&apos;est une copie, pas un nouveau client).</>,
            <>Le <strong>dossier</strong> du devis d&apos;origine.</>,
            <>Le statut <QS k="devis_a_faire" />.</>,
          ]} />
          <P>Tu es envoyé directement dans l&apos;éditeur de la copie.</P>
        </Section>

        <Section icon="📚" title="Dupliquer + enregistrer comme modèle">
          <P>Dans la même fenêtre, la seconde option demande un nom (ex. <Code>Mariage 100p Premium</Code>) et enregistre la structure dans ta bibliothèque de modèles, en plus de créer la copie.</P>
          <Step n={1} title="Retrouve tes modèles">
            <P>En haut de la page Devis : <RealBtn icon={Library} label="Mes modèles (3)" variant="secondary" />.</P>
          </Step>
          <Step n={2} title="Utilise-en un">
            <P>Bouton <Btn>Utiliser</Btn> sur la vignette : un nouveau devis est créé avec la structure du modèle, prêt à recevoir client et date.</P>
          </Step>
          <Step n={3} title="Gère la bibliothèque">
            <P>Sur chaque vignette : aperçu au clic, ✏️ pour renommer, 🗑️ pour supprimer.</P>
          </Step>
        </Section>

        <Section icon="⚖️" title="Lequel choisir ?">
          <Mockup>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-bold text-gray-900 mb-1">📋 Dupliquer</p>
                <p>Un événement similaire, une fois. Action ponctuelle.</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-1">📚 Modèle</p>
                <p>Une structure que tu revends souvent. Investissement qui se rentabilise.</p>
              </div>
            </div>
          </Mockup>
        </Section>
      </div>
    ),
  },
  {
    id: 'importer-devis',
    category: 'devis',
    title: 'Importer un devis fait ailleurs',
    description: 'Reprendre l’historique venu d’un autre logiciel',
    keywords: ['import', 'reprise', 'ancien', 'pdf', 'migration', 'historique'],
    body: (
      <div className="space-y-4">
        <Lead>Tu as des devis déjà signés sous Word, Excel ou un autre logiciel ? Importe-les pour que ton calendrier, tes courses et ton chiffre d&apos;affaires soient complets, sans les ressaisir.</Lead>

        <Section icon="📥" title="Comment importer">
          <Step n={1} title="Bouton Importer">
            <P>En haut de la page Devis, à côté de « Nouveau » : <RealBtn icon={UploadCloud} label="Importer" variant="secondary" />.</P>
            <GoTo href="/devis" label="Aller à la page Devis" />
          </Step>
          <Step n={2} title="Renseigne le client">
            <P>Recherche dans ton carnet, ou saisis prénom, nom, email, téléphone et adresse.</P>
          </Step>
          <Step n={3} title="Renseigne l'événement">
            <P>Type, date, lieu, nombre de convives, et le <strong>montant total</strong> du devis d&apos;origine.</P>
          </Step>
          <Step n={4} title="Joins le document original">
            <P>Le fichier est stocké et reste accessible depuis la carte du devis (bandeau ambre <FileText className="inline h-3 w-3 text-amber-700" /> et bouton de téléchargement).</P>
          </Step>
        </Section>

        <Section icon="🏷️" title="Ce que devient un devis importé">
          <Bullets items={[
            <>Il porte un badge <strong>Importé</strong> dans les listes.</>,
            <>Son statut de départ est <QS k="valide" /> : il compte donc comme événement confirmé.</>,
            <>Il n&apos;a pas de lignes de prestations détaillées — juste le montant. Les listes de courses ne peuvent donc pas être calculées pour lui.</>,
            <>Il reste modifiable : icône ✏️ ambre sur la carte pour corriger prix, fichier ou informations.</>,
            <>Il atterrit dans le dossier ouvert au moment de l&apos;import.</>,
          ]} />
        </Section>

        <Tip>Importe au moins les événements à venir : ils apparaîtront dans ton calendrier et dans ta charge de production.</Tip>
      </div>
    ),
  },
  {
    id: 'finance-devis',
    category: 'devis',
    title: 'Gestion financière d’un devis',
    description: 'Marge et rentabilité, prestation par prestation',
    keywords: ['marge', 'coût', 'finance', 'rentabilité', 'bénéfice'],
    body: (
      <div className="space-y-4">
        <Lead>Le panneau <strong>Gestion financière</strong> répond à une question : est-ce que ce devis est rentable ?</Lead>

        <Section icon="📍" title="Où le trouver">
          <P>Icône <Wallet className="inline h-3.5 w-3.5 text-emerald-600" /> sur la carte du devis.</P>
          <QuoteCardMockup
            name="M. et Mme MARTIN"
            eventType="Mariage"
            status="valide"
            amount="11 540 €"
            date="29 mai 2027"
            highlightAction="finance"
          />
        </Section>

        <Section icon="📊" title="Ce que tu y vois">
          <Step n={1} title="Détail par prestation">
            <P>Pour chaque ligne du devis : le prix de <strong>vente</strong>, le <strong>coût</strong> de revient et la <strong>marge</strong> qui en découle.</P>
          </Step>
          <Step n={2} title="Frais additionnels">
            <P>Ajoute les coûts qui ne sont pas dans les prestations : personnel extra, transport, location, imprévus.</P>
          </Step>
          <Step n={3} title="Synthèse">
            <P>Chiffre d&apos;affaires HT, coût des prestations, frais additionnels, et <strong>marge brute estimée</strong>.</P>
          </Step>
        </Section>

        <Section icon="🎯" title="Pour que les coûts soient justes">
          <P>Le coût de revient d&apos;une prestation vient de ses <strong>ingrédients liés</strong> et de leur prix unitaire. Plus ton catalogue est renseigné, plus la marge affichée est fiable.</P>
          <div className="flex flex-wrap gap-2">
            <GoTo href="/prestations" label="Mes prestations" />
            <GoTo href="/ingredients" label="Mes ingrédients" />
          </div>
        </Section>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // CLIENTS & PROSPECTS
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'creer-client',
    category: 'clients',
    title: 'Créer et gérer mes clients',
    description: 'Particuliers, entreprises, historique',
    keywords: ['contact', 'fiche', 'ajouter client', 'carnet adresse', 'particulier', 'entreprise'],
    body: (
      <div className="space-y-4">
        <Lead>Le carnet clients centralise les personnes et les sociétés pour qui tu travailles. Deux natures de fiche : <strong>particulier</strong> et <strong>entreprise</strong>.</Lead>

        <GoTo href="/clients" label="Aller à la page Clients" />

        <Section icon="➕" title="Créer un client">
          <Bullets items={[
            <><strong>Depuis la page Clients</strong> — bouton <RealBtn icon={Plus} label="Nouveau" variant="primary" />, puis choix Particulier / Entreprise.</>,
            <><strong>Pendant un devis</strong> — le client saisi avec un email dans l&apos;écran de création est enregistré automatiquement dans le carnet.</>,
          ]} />
          <P><strong>Particulier</strong> : prénom, nom, email, téléphone, adresse, notes.</P>
          <P><strong>Entreprise</strong> : raison sociale, SIRET, adresse de facturation, plus une liste de contacts (voir l&apos;article dédié).</P>
        </Section>

        <Section icon="🔍" title="Retrouver un client">
          <Bullets items={[
            <>Barre de recherche : nom, société, email, téléphone.</>,
            <>Clique une ligne pour ouvrir sa fiche latérale.</>,
            <>La couleur du libellé distingue les entreprises (bleu) des particuliers (violet).</>,
          ]} />
        </Section>

        <Section icon="📜" title="La fiche client">
          <P>Onglets de la fiche : informations, contacts (entreprises) et historique de ses devis avec statut et montant.</P>
        </Section>

        <Tip>Renseigne l&apos;adresse complète : elle sert de lien vers la carte depuis la fiche événement le jour J.</Tip>
      </div>
    ),
  },
  {
    id: 'clients-entreprise',
    category: 'clients',
    title: 'Clients entreprise : contacts et destinataire',
    description: 'Plusieurs interlocuteurs, un seul destinataire du devis',
    keywords: ['entreprise', 'société', 'contact', 'siret', 'facturation', 'destinataire'],
    body: (
      <div className="space-y-4">
        <Lead>Une entreprise, c&apos;est rarement une seule personne : l&apos;assistante qui demande, le responsable qui valide, la compta qui paie. WeboDevis gère plusieurs contacts par société.</Lead>

        <GoTo href="/clients" label="Aller à la page Clients" />

        <Section icon="🏢" title="La fiche entreprise">
          <Bullets items={[
            <><strong>Raison sociale</strong> — c&apos;est elle qui s&apos;affiche dans les listes.</>,
            <><strong>SIRET</strong> — repris sur le devis pour la facturation.</>,
            <><strong>Adresse</strong> de facturation, email et téléphone généraux.</>,
          ]} />
        </Section>

        <Section icon="👥" title="Les contacts">
          <P>Onglet <strong>Contacts</strong> de la fiche : ajoute autant d&apos;interlocuteurs que nécessaire, avec nom, rôle, email, téléphone et notes. L&apos;un d&apos;eux peut être marqué comme contact principal.</P>
        </Section>

        <Section icon="✉️" title="Le destinataire du devis">
          <P>Dans l&apos;éditeur, panneau <strong>Client</strong> : après avoir choisi l&apos;entreprise, tu choisis <strong>quel contact</strong> reçoit le devis. Ses coordonnées et son rôle sont recopiés sur le document au moment de la sélection.</P>
          <Note>Ce choix est mémorisé sur le devis : modifier la fiche du contact plus tard ne réécrit pas un devis déjà établi.</Note>
        </Section>
      </div>
    ),
  },
  {
    id: 'prospects',
    category: 'clients',
    title: 'Prospects et formulaire public',
    description: 'Recevoir les demandes de devis automatiquement',
    keywords: ['lead', 'demande', 'formulaire', 'inbound', 'prospect', 'iframe', 'site web'],
    body: (
      <div className="space-y-4">
        <Lead>Le formulaire public transforme ton site, ta bio Instagram ou un QR code en source de demandes qui arrivent directement dans WeboDevis.</Lead>

        <GoTo href="/prospects" label="Aller aux prospects" />

        <Section icon="🔗" title="Ton lien de formulaire">
          <P>En haut de la page Prospects, encart <strong>Lien de formulaire</strong> : un lien partageable qui t&apos;est propre. Tu peux :</P>
          <Bullets items={[
            <>Le partager tel quel (bio, signature de mail, QR code).</>,
            <>L&apos;<strong>intégrer à ton site</strong> en iframe — une version <Code>/embed/…</Code> du formulaire s&apos;adapte à tes couleurs (couleur d&apos;accent, fond, texte, arrondi, police, titre).</>,
            <>Y associer une <strong>URL de brochure</strong> : elle est proposée au prospect juste après l&apos;envoi de sa demande.</>,
          ]} />
        </Section>

        <Section icon="📨" title="Ce que remplit le prospect">
          <P>Prénom, nom, email, téléphone, type d&apos;événement, date, nombre de convives, lieu et message libre. La demande apparaît immédiatement dans ta liste et déclenche une notification.</P>
        </Section>

        <Section icon="🏷️" title="Statuts et suivi">
          <P>Les prospects utilisent <strong>exactement les mêmes 12 statuts que les devis</strong>, ce qui permet de suivre une affaire de la demande au paiement sans changer de vocabulaire.</P>
          <div className="flex flex-wrap gap-1">
            <QS k="nouveau" /><QS k="broch_envoyee" /><QS k="devis_a_faire" /><QS k="devis_envoye" />
            <QS k="rdv_deg_a_venir" /><QS k="rdv_deg_fait" /><QS k="devis_final" /><QS k="valide" />
            <QS k="acompte" /><QS k="paye" /><QS k="refus_client" /><QS k="refus_traiteur" />
          </div>
        </Section>

        <Section icon="🔄" title="Transformer un prospect en devis">
          <Step n={1} title="Ouvre la demande">Clique la ligne du prospect.</Step>
          <Step n={2} title="Bouton « Créer un devis »">Les informations client et événement sont reprises.</Step>
          <Step n={3} title="Les deux restent liés">
            <P>Une fois le devis créé, <strong>les statuts se synchronisent</strong> dans les deux sens : tu ne mets à jour qu&apos;un seul endroit.</P>
          </Step>
        </Section>

        <Section icon="🔎" title="Filtres">
          <P>La liste se filtre par statut, par type d&apos;événement et par année.</P>
        </Section>

        <Note>Les prospects non encore convertis apparaissent aussi sur la page Devis, dans la section <strong>Prospection</strong> et dans les colonnes du pipeline.</Note>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // ÉVÉNEMENTS
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'evenement-fiche',
    category: 'evenements',
    title: 'La fiche événement et ses 5 onglets',
    description: 'Tout ce qui se passe après la validation du devis',
    keywords: ['fiche', 'préparation', 'event', 'production', 'onglets'],
    body: (
      <div className="space-y-4">
        <Lead>Dès qu&apos;un devis passe en <QS k="valide" />, <QS k="acompte" /> ou <QS k="paye" />, il devient un événement avec sa propre fiche de production.</Lead>

        <GoTo href="/evenements" label="Voir mes événements" />

        <Section icon="🗂️" title="Les 5 onglets">
          <Step n={1} title="Checklist">
            <P>Ta liste de tâches libre pour cet événement : ajoute, coche, supprime. Parfait pour le « ne pas oublier » (glace, cadeaux invités, matériel emprunté).</P>
          </Step>
          <Step n={2} title="Matériel">
            <P>Le matériel à louer pour l&apos;événement, à partir de tes <strong>templates de location</strong> (quantité par convive) ou ajouté à la main. Tu peux marquer une ligne comme commandée séparément et éditer un <strong>bon de commande location</strong> à imprimer.</P>
          </Step>
          <Step n={3} title="Courses">
            <P>La liste d&apos;achats calculée automatiquement depuis les ingrédients des prestations du devis × le nombre de convives. Cochable au fur et à mesure.</P>
          </Step>
          <Step n={4} title="Prépa & Achats">
            <P>Le complément manuel : ajoute des ingrédients qui ne viennent pas des prestations, avec quantité et fournisseur, et génère un <strong>bon de commande</strong>.</P>
          </Step>
          <Step n={5} title="Extras">
            <P>Le staffing : qui travaille, à quelle heure, avec quelles consignes. Voir l&apos;article dédié.</P>
          </Step>
        </Section>

        <Section icon="🧭" title="En-tête de la fiche">
          <P>Client, date, lieu, nombre de convives et montant, avec accès direct au devis d&apos;origine.</P>
        </Section>
      </div>
    ),
  },
  {
    id: 'liste-courses',
    category: 'evenements',
    title: 'Listes de courses',
    description: 'Par événement, ou groupées sur une période',
    keywords: ['ingrédients', 'achat', 'recette', 'production', 'courses'],
    body: (
      <div className="space-y-4">
        <Lead>La liste de courses se calcule toute seule à partir des ingrédients liés à tes prestations.</Lead>

        <Section icon="⚙️" title="Le mécanisme">
          <Step n={1} title="Lier des ingrédients à une prestation">
            <P>Sur la fiche d&apos;une prestation, section <strong>Ingrédients (par personne)</strong> : chaque ingrédient avec sa quantité <strong>par convive</strong>.</P>
            <Mockup title="Exemple — prestation « Entrée saumon »">
              <Bullets items={[
                <>Saumon fumé : 80 g / personne</>,
                <>Aneth frais : 2 g / personne</>,
                <>Citron : 0,1 unité / personne</>,
              ]} />
            </Mockup>
          </Step>
          <Step n={2} title="L'événement multiplie">
            <P>Pour 100 convives : 8 kg de saumon, 200 g d&apos;aneth, 10 citrons. Les prestations qui partagent un ingrédient sont cumulées.</P>
          </Step>
          <Step n={3} title="Tu coches en faisant tes achats">
            <P>Onglet <strong>Courses</strong> de la fiche événement. L&apos;état des cases est conservé.</P>
          </Step>
        </Section>

        <Section icon="🛒" title="Courses globales">
          <P>Page <Path items={['Catalogue', 'Courses globales']} /> : choisis une <strong>date de début</strong> et une <strong>date de fin</strong>, et l&apos;app agrège les ingrédients de tous les événements de la période, avec le détail des événements concernés pour chaque ligne.</P>
          <GoTo href="/courses-globales" label="Ouvrir les courses globales" />
          <Tip>C&apos;est la vue qui permet de faire <strong>une seule grosse commande hebdomadaire</strong> au lieu d&apos;une par événement.</Tip>
        </Section>

        <Note>Un devis <strong>importé</strong> n&apos;a pas de prestations détaillées : il ne génère donc aucune ligne de courses.</Note>
      </div>
    ),
  },
  {
    id: 'staffing-extras',
    category: 'evenements',
    title: 'Staffing : assigner des extras',
    description: 'Équipe, heures d’arrivée et fiches mission',
    keywords: ['extra', 'personnel', 'équipe', 'serveur', 'mission', 'staffing'],
    body: (
      <div className="space-y-4">
        <Lead>Les extras sont ton vivier de personnel. Tu les crées une fois, puis tu les assignes aux événements qui en ont besoin.</Lead>

        <Section icon="👥" title="1. Constituer le vivier">
          <P>Page <Path items={['Catalogue', 'Extras']} /> : crée chaque personne avec son <strong>rôle</strong> (Cuisinier, Sous-chef, Serveur, Barman, Aide, Autre) et ses coordonnées.</P>
          <GoTo href="/extras" label="Gérer mes extras" />
        </Section>

        <Section icon="📆" title="2. Assigner à un événement">
          <P>Depuis la fiche événement, onglet <strong>Extras</strong>, ou depuis la page Extras (bouton « Assigner à un événement ») :</P>
          <Bullets items={[
            <>Choix de l&apos;extra et de l&apos;événement.</>,
            <><strong>Heure d&apos;arrivée</strong> attendue.</>,
            <><strong>Notes de mission</strong> : tenue, consignes, personne à contacter sur place.</>,
            <>Option <strong>mission courses</strong> : l&apos;extra est aussi chargé des achats.</>,
          ]} />
        </Section>

        <Section icon="🏷️" title="3. Suivre les confirmations">
          <div className="space-y-2">
            <div className="flex items-center gap-3"><StatusPill color="amber" label="À solliciter" /><span className="text-xs text-gray-600">Tu ne l&apos;as pas encore contacté.</span></div>
            <div className="flex items-center gap-3"><StatusPill color="blue" label="Confirmé" /><span className="text-xs text-gray-600">Il a dit oui, la date est bloquée.</span></div>
            <div className="flex items-center gap-3"><StatusPill color="green" label="Présent" /><span className="text-xs text-gray-600">Il était bien là le jour J.</span></div>
          </div>
        </Section>

        <Section icon="📄" title="4. Fiches mission">
          <P>Depuis l&apos;onglet Extras, tu peux éditer les <strong>fiches mission</strong> : un récapitulatif par personne avec l&apos;événement, l&apos;adresse, l&apos;heure d&apos;arrivée et les consignes — à imprimer ou à transmettre.</P>
        </Section>
      </div>
    ),
  },
  {
    id: 'calendrier-lecture',
    category: 'evenements',
    title: 'Lire le calendrier',
    description: 'Couleurs, capacité, filtres, navigation',
    keywords: ['agenda', 'planning', 'mois', 'capacité'],
    body: (
      <div className="space-y-4">
        <Lead>Le calendrier est ta vue de charge : qui mange, où, combien, et à quel moment tu satures.</Lead>

        <GoTo href="/calendrier" label="Ouvrir mon calendrier" />

        <Section icon="🎨" title="Code couleur">
          <Bullets items={[
            <><strong>Violet plein</strong> — événement confirmé (<QS k="valide" /> <QS k="acompte" /> <QS k="paye" />).</>,
            <><strong>Contour violet</strong> — affaire en cours, non confirmée : une opportunité à relancer.</>,
            <><strong>Journée en rouge</strong> — capacité dépassée : plus de <strong>300 couverts cumulés</strong> sur la même journée.</>,
          ]} />
        </Section>

        <Section icon="🔍" title="Navigation et filtres">
          <Bullets items={[
            <>Flèches <Code>‹</Code> <Code>›</Code> pour changer de mois, bouton <Btn color="gray">Aujourd&apos;hui</Btn> pour revenir.</>,
            <>Filtre pour n&apos;afficher que les événements confirmés.</>,
            <>Statistiques du mois en haut : confirmés, en attente, total des couverts.</>,
          ]} />
        </Section>

        <Section icon="👆" title="Cliquer un événement">
          <P>Une fiche latérale s&apos;ouvre : statut, couverts, date, adresse (avec lien vers la carte), prestations et montant, plus l&apos;accès à la fiche événement et au devis.</P>
        </Section>

        <Note>Les devis refusés n&apos;apparaissent jamais dans le calendrier, quel que soit le filtre.</Note>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // STOCK & ACHATS
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'gerer-ingredients',
    category: 'stock',
    title: 'Créer et gérer mes ingrédients',
    description: 'Fiche, unités, seuils, import CSV',
    keywords: ['inventaire', 'fiche', 'matière première', 'csv', 'import'],
    body: (
      <div className="space-y-4">
        <Lead>Chaque ingrédient porte son unité, son prix, son fournisseur, son stock et son seuil d&apos;alerte. C&apos;est la base des courses, des coûts et des alertes.</Lead>

        <GoTo href="/ingredients" label="Aller aux ingrédients" />

        <Section icon="➕" title="Créer un ingrédient">
          <Bullets items={[
            <><strong>Nom</strong> (obligatoire).</>,
            <><strong>Catégorie</strong> — pour filtrer la liste.</>,
            <><strong>Unité</strong> — celle dans laquelle tu achètes (kg, g, L, unité…).</>,
            <><strong>Prix unitaire</strong> — sert au calcul des coûts et des marges.</>,
            <><strong>Fournisseur</strong> — sert au regroupement des commandes.</>,
            <><strong>Stock</strong> et <strong>seuil d&apos;alerte</strong> — « alerte si stock ≤ ce seuil ».</>,
            <><strong>Photo</strong> — tu peux la récupérer automatiquement depuis Open Food Facts.</>,
          ]} />
        </Section>

        <Section icon="📥" title="Aller plus vite">
          <Bullets items={[
            <><strong>Import CSV</strong> <FileSpreadsheet className="inline h-3.5 w-3.5 text-gray-500" /> — crée des dizaines d&apos;ingrédients d&apos;un coup. Les doublons ne sont pas réimportés.</>,
            <><strong>Bibliothèque globale</strong> — pioche dans une base d&apos;ingrédients communs plutôt que de tout saisir.</>,
          ]} />
        </Section>

        <Tip>Commence par les 30 à 40 ingrédients que tu utilises vraiment souvent. Le reste se complète au fil des prestations.</Tip>
      </div>
    ),
  },
  {
    id: 'gerer-stock',
    category: 'stock',
    title: 'Mouvements de stock',
    description: 'Entrée, sortie, ajustement',
    keywords: ['mouvement', 'entrée', 'sortie', 'inventaire', 'achat'],
    body: (
      <div className="space-y-4">
        <Lead>Le stock évolue par <strong>mouvements</strong> : un journal daté qui garde la trace de tout.</Lead>

        <GoTo href="/stock" label="Aller à mon stock" />

        <Section icon="🔄" title="Les 3 types de mouvement">
          <div className="space-y-2">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="font-bold text-emerald-900 text-sm flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Entrée</p>
              <p className="text-xs text-emerald-800 mt-1">Une livraison arrive. Le stock augmente.</p>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="font-bold text-rose-900 text-sm flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5" />Sortie</p>
              <p className="text-xs text-rose-800 mt-1">Consommation pour un événement, casse, perte. Le stock diminue.</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-bold text-blue-900 text-sm">🔧 Ajustement</p>
              <p className="text-xs text-blue-800 mt-1">Inventaire physique : tu forces la valeur réelle et l&apos;écart est enregistré.</p>
            </div>
          </div>
          <Note>Une sortie ne peut pas dépasser le stock disponible : le stock ne peut jamais devenir négatif.</Note>
        </Section>

        <Section icon="📝" title="Saisir un mouvement">
          <Step n={1} title="Page Stock"><Path items={['Stock']} /></Step>
          <Step n={2} title="Sur la ligne d'un ingrédient, choisis Entrée ou Sortie">Une fenêtre s&apos;ouvre.</Step>
          <Step n={3} title="Quantité + raison (optionnelle)">La raison t&apos;aidera à relire l&apos;historique dans six mois.</Step>
          <Step n={4} title="Valide">Stock mis à jour immédiatement, mouvement ajouté au journal.</Step>
        </Section>

        <Section icon="📜" title="Historique">
          <P>Chaque ingrédient a son journal : date, type, quantité (+ / − / =) et note. Utile pour auditer les pertes ou retrouver une livraison.</P>
        </Section>

        <Section icon="📌" title="Repères de la page Stock">
          <P>En haut : le nombre total d&apos;ingrédients suivis, ceux en alerte et ceux <strong>épuisés</strong> (stock à zéro).</P>
        </Section>
      </div>
    ),
  },
  {
    id: 'alertes-stock',
    category: 'stock',
    title: 'Alertes de stock bas',
    description: 'Seuils et notifications',
    keywords: ['notification', 'badge', 'seuil', 'alerte', 'rupture'],
    body: (
      <div className="space-y-4">
        <Lead>Chaque ingrédient a un seuil. En dessous, WeboDevis te prévient avant que ça devienne un problème.</Lead>

        <Section icon="🎯" title="Définir un seuil">
          <P>Sur la fiche de l&apos;ingrédient : <strong>« Alerte si stock ≤ ce seuil »</strong>.</P>
          <Mockup title="Exemple — Saumon fumé">
            <Bullets items={[
              <>Stock : 12 kg — Seuil : 5 kg.</>,
              <>Tant que le stock reste au-dessus de 5 kg, rien ne se passe.</>,
              <>Dès qu&apos;il tombe à 5 kg ou moins, l&apos;alerte se déclenche.</>,
            ]} />
          </Mockup>
        </Section>

        <Section icon="🔔" title="Ce qui se passe alors">
          <Bullets items={[
            <>Une <strong>notification</strong> est créée dans le centre de notifications.</>,
            <>Un <strong>badge rouge</strong> apparaît sur <strong>Stock</strong> dans la sidebar : c&apos;est le nombre d&apos;ingrédients en alerte.</>,
            <>Pas de doublon : si une alerte non lue existe déjà pour cet ingrédient, elle n&apos;est pas recréée.</>,
          ]} />
          <GoTo href="/notifications" label="Voir mes notifications" />
        </Section>

        <Tip>Cale ton seuil sur le <strong>délai de livraison</strong> de ton fournisseur : s&apos;il livre en 48 h, le seuil doit couvrir 48 h de consommation.</Tip>
      </div>
    ),
  },
  {
    id: 'commandes-fournisseurs',
    category: 'stock',
    title: 'Commandes fournisseurs',
    description: 'Suivre ce qui est commandé, envoyé, reçu',
    keywords: ['achat', 'commande', 'fournisseur', 'bon de commande'],
    body: (
      <div className="space-y-4">
        <Lead>Les bons de commande se créent depuis les besoins d&apos;un événement, puis se suivent sur la page Commandes.</Lead>

        <GoTo href="/commandes" label="Voir mes commandes" />

        <Section icon="📦" title="Pour que ça marche">
          <Bullets items={[
            <>Tes ingrédients ont un <strong>fournisseur</strong> renseigné.</>,
            <>Tes prestations ont des <strong>ingrédients liés</strong> avec une quantité par personne.</>,
          ]} />
        </Section>

        <Section icon="🛒" title="Créer une commande">
          <P>Depuis la fiche événement, onglet <strong>Prépa & Achats</strong> : tu constitues la liste des ingrédients à acheter (avec fournisseur et quantité) et tu génères le <strong>bon de commande</strong>. L&apos;onglet <strong>Matériel</strong> produit de la même façon un bon de commande de location.</P>
        </Section>

        <Section icon="🏷️" title="Les 4 statuts d'une commande">
          <div className="space-y-2">
            <div className="flex items-center gap-3"><StatusPill color="gray" label="Brouillon" /><span className="text-xs text-gray-600">En préparation, pas encore transmise.</span></div>
            <div className="flex items-center gap-3"><StatusPill color="blue" label="Envoyée" /><span className="text-xs text-gray-600">Transmise au fournisseur.</span></div>
            <div className="flex items-center gap-3"><StatusPill color="green" label="Reçue" /><span className="text-xs text-gray-600">Marchandise livrée.</span></div>
            <div className="flex items-center gap-3"><StatusPill color="red" label="Annulée" /><span className="text-xs text-gray-600">Commande abandonnée.</span></div>
          </div>
          <P>La page affiche les montants cumulés à commander et déjà envoyés, et se filtre par statut.</P>
        </Section>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // CATALOGUE
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'creer-prestation',
    category: 'catalogue',
    title: 'Créer une prestation',
    description: 'Prix, prix enfant, options, ingrédients, carte',
    keywords: ['service', 'plat', 'menu', 'item', 'prestation'],
    body: (
      <div className="space-y-4">
        <Lead>Une prestation, c&apos;est une ligne vendable : une entrée, un buffet, un service. Bien renseignée, elle nourrit tes devis, tes courses et tes marges.</Lead>

        <GoTo href="/prestations" label="Aller à mes prestations" />

        <Section icon="🎯" title="Anatomie d'une prestation">
          <Step n={1} title="Identité">Nom, description, catégorie et sous-catégorie, photo.</Step>
          <Step n={2} title="Prix">
            <P>Prix unitaire HT, et un <strong>prix enfant</strong> distinct si tu en pratiques un. Une prestation peut aussi être marquée <strong>Option</strong> : elle apparaît sur le devis sans entrer dans le total.</P>
          </Step>
          <Step n={3} title="Ingrédients (par personne)">
            <P>Chaque ingrédient avec sa quantité par convive. C&apos;est ce qui alimente la liste de courses et le coût de revient.</P>
          </Step>
          <Step n={4} title="Extrait du devis">
            <P>Le texte enrichi qui décrit la prestation sur le document client — mis en page dans l&apos;éditeur WeboWord dédié.</P>
          </Step>
        </Section>

        <Section icon="📥" title="Import CSV">
          <P>Bouton <RealBtn icon={FileSpreadsheet} label="Import CSV" variant="secondary" /> pour créer ton catalogue en masse. Les doublons ne sont pas importés.</P>
        </Section>

        <Tip>Trente minutes pour créer dix prestations bien faites, et tes cinquante prochains devis se montent en deux minutes.</Tip>
      </div>
    ),
  },
  {
    id: 'categories-perso',
    category: 'catalogue',
    title: 'Catégories personnelles et globales',
    description: 'Organiser le catalogue à ta façon',
    keywords: ['rangement', 'sous-catégorie', 'organiser', 'globale'],
    body: (
      <div className="space-y-4">
        <Lead>Tu disposes de catégories <strong>globales</strong> fournies avec l&apos;app, et de tes propres catégories <strong>personnelles</strong>.</Lead>

        <GoTo href="/parametres/categories" label="Gérer mes catégories" />

        <Section icon="🌐" title="Globales (lecture seule)">
          <P>Les standards du métier, visibles par tous, que tu ne peux ni renommer ni supprimer. Elles portent un badge <Code>Globale</Code>.</P>
        </Section>

        <Section icon="⭐" title="Personnelles">
          <P>Les tiennes : « Cocktails signature », « Menus végétariens »… Modifiables et supprimables à volonté, avec des <strong>sous-catégories</strong>.</P>
        </Section>

        <Section icon="✏️" title="Les gérer">
          <Path items={['Paramètres', 'Catégories']} />
          <Step n={1} title="Créer une catégorie">Bouton en haut de la page.</Step>
          <Step n={2} title="Déplier pour ajouter des sous-catégories">Ex. « Menu Tradition », « Menu Prestige ».</Step>
          <Step n={3} title="Renommer / supprimer">Icônes ✏️ et 🗑️ sur chaque ligne.</Step>
        </Section>

        <Warning>Supprimer une catégorie supprime ses sous-catégories. Les prestations concernées ne sont pas supprimées, mais perdent leur classement.</Warning>
      </div>
    ),
  },
  {
    id: 'fournisseurs',
    category: 'catalogue',
    title: 'Mes fournisseurs',
    description: 'Carnet d’adresses et regroupement des achats',
    keywords: ['supplier', 'achat', 'commande', 'fournisseur'],
    body: (
      <div className="space-y-4">
        <Lead>Les fournisseurs servent à deux choses : garder leurs coordonnées, et regrouper tes achats par fournisseur.</Lead>

        <GoTo href="/fournisseurs" label="Voir mes fournisseurs" />

        <Section icon="➕" title="Créer un fournisseur">
          <Path items={['Catalogue', 'Fournisseurs']} />
          <P>Champs : nom, téléphone, email, adresse, notes.</P>
        </Section>

        <Section icon="🔗" title="Lier à un ingrédient">
          <P>Sur la fiche d&apos;un ingrédient, champ <strong>Fournisseur</strong>. Les lignes d&apos;achat se regroupent ensuite par fournisseur au moment du bon de commande.</P>
        </Section>
      </div>
    ),
  },
  {
    id: 'extras-location',
    category: 'catalogue',
    title: 'Extras et matériel en location',
    description: 'Personnel additionnel, mobilier, vaisselle',
    keywords: ['matériel', 'mobilier', 'rental', 'location', 'extra', 'personnel'],
    body: (
      <div className="space-y-4">
        <Lead>Au-delà de la cuisine, tu gères aussi le personnel additionnel et le matériel loué pour tes événements.</Lead>

        <div className="flex gap-2 flex-wrap">
          <GoTo href="/extras" label="Extras (personnel)" />
          <GoTo href="/location-globale" label="Location globale" />
          <GoTo href="/location-templates" label="Templates location" />
        </div>

        <Section icon="👥" title="Extras">
          <P>Ton vivier de personnel avec son rôle : Cuisinier, Sous-chef, Serveur, Barman, Aide, Autre. Ils s&apos;assignent ensuite aux événements (voir <strong>Staffing</strong>).</P>
        </Section>

        <Section icon="🪑" title="Templates de location">
          <P>Le catalogue du matériel louable : nom, <strong>quantité par convive</strong>, unité, fournisseur par défaut et prix unitaire HT.</P>
          <Note>La quantité par convive permet de proposer automatiquement le bon nombre d&apos;articles selon la taille de l&apos;événement (ex. 1 assiette / personne, 0,2 nappe / personne).</Note>
        </Section>

        <Section icon="🌐" title="Location globale">
          <P>Vue agrégée sur une période : pour chaque article, la <strong>quantité totale</strong> mobilisée, le <strong>coût</strong> et le <strong>détail des événements</strong> concernés. C&apos;est la vue qui évite de louer deux fois ou de manquer le jour J.</P>
        </Section>
      </div>
    ),
  },
  {
    id: 'modeles-devis',
    category: 'catalogue',
    title: 'Modèles de devis',
    description: 'Le style par défaut de tes documents',
    keywords: ['modèle', 'template', 'style', 'mise en page', 'défaut'],
    body: (
      <div className="space-y-4">
        <Lead>La page Modèles règle l&apos;allure de tes documents : quel style s&apos;applique par défaut aux nouveaux devis.</Lead>

        <GoTo href="/modeles" label="Voir mes modèles" />

        <Section icon="🎨" title="Les modèles fournis">
          <Bullets items={[
            <><strong>Standard</strong> — sobre, violet, tous usages.</>,
            <><strong>Mariage</strong> — plus chaleureux, tons dorés.</>,
            <><strong>Business</strong> — sombre et sec, pour les clients entreprise.</>,
          ]} />
          <P>Un aperçu permet de comparer avant de choisir ton <strong>modèle par défaut</strong>.</P>
        </Section>

        <Section icon="📚" title="À ne pas confondre">
          <P>Ce sont des <strong>styles de document</strong>. Les modèles de <strong>contenu</strong> (structure de prestations réutilisable) se créent depuis la duplication d&apos;un devis et se retrouvent dans « Mes modèles » sur la page Devis.</P>
        </Section>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // COMPTE & PARAMÈTRES
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'profil-entreprise',
    category: 'compte',
    title: 'Mon profil entreprise',
    description: 'Ce qui s’imprime en tête de tes devis',
    keywords: ['identité', 'siret', 'logo', 'profil', 'entreprise'],
    body: (
      <div className="space-y-4">
        <Lead>Ces informations apparaissent sur tous tes devis. À compléter avant le premier envoi.</Lead>

        <GoTo href="/parametres" label="Aller au profil entreprise" />

        <Section icon="🏢" title="Identité de l'entreprise">
          <Bullets items={[
            <><strong>Nom de l&apos;entreprise</strong> — en tête du document.</>,
            <><strong>Adresse</strong> — siège social.</>,
            <><strong>Téléphone</strong>.</>,
            <><strong>SIRET</strong> — mention obligatoire sur un devis professionnel.</>,
          ]} />
        </Section>

        <Section icon="🖼️" title="Logo">
          <P>Envoie un PNG ou un JPG. Un format carré avec fond transparent rend le mieux. Le logo apparaît en haut du document.</P>
        </Section>

        <Section icon="📊" title="Et la TVA ?">
          <P>Le taux de TVA se règle <strong>devis par devis</strong> (20 % par défaut), pas dans le profil : la restauration, les boissons et la location ne relèvent pas toujours du même taux.</P>
        </Section>

        <Tip>Imprime un devis de test une fois le profil rempli, pour vérifier l&apos;en-tête en conditions réelles.</Tip>
      </div>
    ),
  },
  {
    id: 'cgv',
    category: 'compte',
    title: 'Mes conditions générales de vente',
    description: 'Ajoutées automatiquement à tes devis',
    keywords: ['conditions', 'légal', 'mentions', 'contrat', 'cgv'],
    body: (
      <div className="space-y-4">
        <Lead>Tes CGV sont ajoutées en <strong>page 2</strong> de tous tes devis PDF. Elles cadrent la relation commerciale.</Lead>

        <GoTo href="/parametres" label="Aller aux paramètres" />

        <Section icon="📍" title="Où les éditer">
          <Path items={['Paramètres', 'Conditions Générales de Vente']} />
          <P>Éditeur de texte enrichi : titres, gras, italique, listes, liens, couleurs et alignement.</P>
        </Section>

        <Section icon="✅" title="Ce qu'on y met en général">
          <Bullets items={[
            <>Conditions de réservation et montant de l&apos;acompte.</>,
            <>Politique d&apos;annulation (délais, frais retenus).</>,
            <>Modalités et délais de paiement.</>,
            <>Limites de responsabilité (allergènes, matériel, retards).</>,
            <>Traitement des données personnelles.</>,
            <>Juridiction compétente.</>,
          ]} />
        </Section>

        <Warning>Un document contractuel : fais-le relire par un professionnel du droit avant de l&apos;utiliser.</Warning>
      </div>
    ),
  },
  {
    id: 'mot-de-passe',
    category: 'compte',
    title: 'Sécurité du compte',
    description: 'Changer ou récupérer son mot de passe',
    keywords: ['password', 'sécurité', 'oubli', 'connexion'],
    body: (
      <div className="space-y-4">
        <Lead>Ton compte donne accès à des données clients : soigne ton mot de passe.</Lead>

        <Section icon="🔁" title="Changer de mot de passe">
          <P>Le changement passe par la procédure « mot de passe oublié » :</P>
          <Step n={1} title="Déconnecte-toi">Depuis la sidebar.</Step>
          <Step n={2} title="Sur l'écran de connexion, clique « Mot de passe oublié »">Saisis ton email.</Step>
          <Step n={3} title="Ouvre le lien reçu par email">Tu arrives sur la page de réinitialisation.</Step>
          <Step n={4} title="Choisis un nouveau mot de passe">Long, unique, et différent de celui de ta boîte mail.</Step>
        </Section>

        <Section icon="🛡️" title="Bonnes pratiques">
          <Bullets items={[
            <>Un gestionnaire de mots de passe (Bitwarden, 1Password, KeePass) plutôt qu&apos;un pense-bête.</>,
            <>Un mot de passe unique pour WeboDevis.</>,
            <>Chaque compte est individuel : un employé doit avoir le sien.</>,
          ]} />
        </Section>
      </div>
    ),
  },
  {
    id: 'notifications-centre',
    category: 'compte',
    title: 'Centre de notifications',
    description: 'Ce que l’app te signale',
    keywords: ['notification', 'alerte', 'badge', 'rappel'],
    body: (
      <div className="space-y-4">
        <Lead>Les signalements du système sont regroupés dans le centre de notifications.</Lead>

        <GoTo href="/notifications" label="Voir mes notifications" />

        <Section icon="📍" title="Y accéder">
          <P>Icône <Bell className="inline h-3.5 w-3.5 text-gray-600" /> dans le header, avec le compteur de non-lues.</P>
        </Section>

        <Section icon="🏷️" title="Les types de notification">
          <Bullets items={[
            <><strong>Nouvelle demande</strong> — quelqu&apos;un a rempli ton formulaire public.</>,
            <><strong>Événement à venir</strong> — un événement approche.</>,
            <><strong>Stock bas</strong> — un ingrédient est passé sous son seuil.</>,
            <><strong>Échéance de facturation</strong> — un règlement arrive à échéance.</>,
            <><strong>Rappel de tâche</strong>, <strong>ticket de support</strong> et <strong>mise à jour</strong> du logiciel.</>,
          ]} />
        </Section>

        <Section icon="✅" title="Les traiter">
          <P>Cliquer une notification la marque comme lue et t&apos;emmène vers l&apos;élément concerné. Un bouton permet de tout marquer comme lu.</P>
        </Section>
      </div>
    ),
  },
  {
    id: 'admin-espace',
    category: 'compte',
    title: 'Espace admin',
    description: 'Réservé aux comptes administrateurs',
    keywords: ['admin', 'rôle', 'utilisateurs', 'modération'],
    body: (
      <div className="space-y-4">
        <Lead>Si ton compte a le rôle <strong>admin</strong>, un lien « Espace admin » apparaît en bas du groupe Paramètres.</Lead>

        <GoTo href="/admin" label="Aller à l'espace admin" />

        <Section icon="🛡️" title="Ce qu'on y fait">
          <Bullets items={[
            <><strong>Vue d&apos;ensemble</strong> — indicateurs sur l&apos;ensemble des comptes.</>,
            <><strong>Utilisateurs</strong> — consulter et administrer les comptes.</>,
            <><strong>Catégories globales</strong> — gérer les catégories standards proposées à tous.</>,
          ]} />
        </Section>

        <Note>Le rôle admin s&apos;ajoute à ton compte traiteur : tu continues à gérer tes propres devis normalement.</Note>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // FAQ TRANSVERSE
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'faq-generale',
    category: 'demarrer',
    title: 'FAQ — Questions fréquentes',
    description: 'Les questions qui reviennent le plus souvent',
    keywords: ['faq', 'questions', 'aide', 'problème'],
    body: (
      <div className="space-y-3">
        <Lead>Réponses courtes aux questions les plus fréquentes.</Lead>

        <FAQ q="Mon travail est-il sauvegardé automatiquement ?">
          <P>Pas dans l&apos;éditeur de devis : il faut cliquer <strong>Enregistrer</strong> dans le bloc Actions avant de quitter la page.</P>
          <P>En revanche, les actions faites depuis les listes et les fiches sont enregistrées immédiatement : changement de statut, nom interne, déplacement dans un dossier, cases de la checklist et des courses.</P>
        </FAQ>
        <FAQ q="Comment le client reçoit-il son devis ?">
          <P>Tu ouvres la page d&apos;impression du devis, tu l&apos;enregistres en PDF (Ctrl + P), et tu l&apos;envoies par tes propres moyens. Il n&apos;y a pas d&apos;envoi automatique ni d&apos;espace client en ligne : c&apos;est toi qui fais ensuite avancer le statut.</P>
        </FAQ>
        <FAQ q="Pourquoi mon devis n'apparaît-il pas dans le calendrier ?">
          <P>Seuls les devis confirmés y figurent : <QS k="valide" />, <QS k="acompte" />, <QS k="paye" />. Les refus n&apos;y apparaissent jamais.</P>
        </FAQ>
        <FAQ q="Pourquoi je ne vois pas tous mes devis ?">
          <P>Trois causes possibles : un <strong>dossier</strong> est ouvert (le fil d&apos;Ariane le montre — reviens à « Mes devis »), un <strong>filtre de statut</strong> est actif, ou une <strong>recherche</strong> est en cours. Les devis refusés ne s&apos;affichent que si tu sélectionnes un filtre de refus.</P>
        </FAQ>
        <FAQ q="Puis-je supprimer n'importe quel devis ?">
          <P>Non : le bouton de suppression n&apos;apparaît que sur les devis non engagés (<QS k="nouveau" />, <QS k="devis_a_faire" />, <QS k="broch_envoyee" />) et sur les devis importés. Pour les autres, passe-les en refus afin de garder l&apos;historique.</P>
        </FAQ>
        <FAQ q="Supprimer un dossier supprime-t-il mes devis ?">
          <P>Non. Les devis et les sous-dossiers remontent dans le dossier parent.</P>
        </FAQ>
        <FAQ q="Pourquoi mes listes de courses sont-elles vides ?">
          <P>Elles se calculent depuis les <strong>ingrédients liés aux prestations</strong> du devis. Sans ingrédients renseignés — ou pour un devis importé, qui n&apos;a pas de lignes détaillées — il n&apos;y a rien à calculer.</P>
        </FAQ>
        <FAQ q="Puis-je travailler à plusieurs sur le même compte ?">
          <P>Chaque compte est individuel : tes données ne sont visibles que par toi. Pour une équipe, crée un compte par personne.</P>
        </FAQ>
        <FAQ q="Comment changer le taux de TVA ?">
          <P>Sur le devis lui-même. Le taux est propre à chaque devis (20 % par défaut) et sert au calcul du montant TTC affiché dans les listes.</P>
        </FAQ>
        <FAQ q="À quoi sert le nom interne d'un devis ?">
          <P>À distinguer plusieurs devis d&apos;un même client dans tes listes. Il n&apos;apparaît jamais sur le document remis au client.</P>
        </FAQ>
      </div>
    ),
  },
];
