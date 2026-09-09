'use client';

/**
 * Couleurs et icônes des dossiers de devis.
 * Vit dans `components/` (et non `lib/`) car Tailwind ne scanne que app/ components/ context/ :
 * les classes doivent être écrites en toutes lettres ici pour être générées.
 */

import {
  Folder, Heart, PartyPopper, Briefcase, UtensilsCrossed, Wine, CalendarDays, Star,
  Users, Building2, Gift, Music, Sun, Archive, Tag, MapPin,
} from 'lucide-react';

// ── Couleurs ────────────────────────────────────────────────────────────────
export interface FolderColor {
  key: string;
  label: string;
  /** Fond + bordure de la tuile */
  tile: string;
  /** Bordure au survol */
  hover: string;
  /** Pastille de l'icône */
  iconBg: string;
  iconText: string;
  /** Pastille pleine du sélecteur de couleur */
  swatch: string;
  /** Fond de la zone de dépôt active */
  drop: string;
}

export const FOLDER_COLORS: FolderColor[] = [
  { key: 'purple',  label: 'Violet',   tile: 'bg-[#faf5ff] border-[#e9d5ff]', hover: 'hover:border-[#9c27b0]/50', iconBg: 'bg-[#f3e5f5]', iconText: 'text-[#9c27b0]', swatch: 'bg-[#9c27b0]', drop: 'border-[#9c27b0] bg-[#f3e5f5]' },
  { key: 'blue',    label: 'Bleu',     tile: 'bg-sky-50/60 border-sky-200',   hover: 'hover:border-sky-400',      iconBg: 'bg-sky-100',   iconText: 'text-sky-600',   swatch: 'bg-sky-500',   drop: 'border-sky-500 bg-sky-100' },
  { key: 'emerald', label: 'Vert',     tile: 'bg-emerald-50/60 border-emerald-200', hover: 'hover:border-emerald-400', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', swatch: 'bg-emerald-500', drop: 'border-emerald-500 bg-emerald-100' },
  { key: 'amber',   label: 'Ambre',    tile: 'bg-amber-50/60 border-amber-200', hover: 'hover:border-amber-400',  iconBg: 'bg-amber-100', iconText: 'text-amber-600', swatch: 'bg-amber-500', drop: 'border-amber-500 bg-amber-100' },
  { key: 'rose',    label: 'Rose',     tile: 'bg-rose-50/60 border-rose-200', hover: 'hover:border-rose-400',     iconBg: 'bg-rose-100',  iconText: 'text-rose-600',  swatch: 'bg-rose-500',  drop: 'border-rose-500 bg-rose-100' },
  { key: 'teal',    label: 'Turquoise',tile: 'bg-teal-50/60 border-teal-200', hover: 'hover:border-teal-400',     iconBg: 'bg-teal-100',  iconText: 'text-teal-600',  swatch: 'bg-teal-500',  drop: 'border-teal-500 bg-teal-100' },
  { key: 'orange',  label: 'Orange',   tile: 'bg-orange-50/60 border-orange-200', hover: 'hover:border-orange-400', iconBg: 'bg-orange-100', iconText: 'text-orange-600', swatch: 'bg-orange-500', drop: 'border-orange-500 bg-orange-100' },
  { key: 'slate',   label: 'Gris',     tile: 'bg-gray-50 border-gray-200',    hover: 'hover:border-gray-400',     iconBg: 'bg-gray-100',  iconText: 'text-gray-600',  swatch: 'bg-gray-500',  drop: 'border-gray-500 bg-gray-100' },
];

const COLOR_BY_KEY = new Map(FOLDER_COLORS.map((c) => [c.key, c]));

export function folderColor(key: string | null | undefined): FolderColor {
  return COLOR_BY_KEY.get(key ?? '') ?? FOLDER_COLORS[0];
}

// ── Icônes ──────────────────────────────────────────────────────────────────
export const FOLDER_ICONS: { key: string; label: string; Icon: React.ElementType }[] = [
  { key: 'folder',    label: 'Dossier',     Icon: Folder },
  { key: 'heart',     label: 'Mariage',     Icon: Heart },
  { key: 'party',     label: 'Fête',        Icon: PartyPopper },
  { key: 'briefcase', label: 'Entreprise',  Icon: Briefcase },
  { key: 'utensils',  label: 'Repas',       Icon: UtensilsCrossed },
  { key: 'wine',      label: 'Cocktail',    Icon: Wine },
  { key: 'calendar',  label: 'Saison',      Icon: CalendarDays },
  { key: 'star',      label: 'Prioritaire', Icon: Star },
  { key: 'users',     label: 'Clients',     Icon: Users },
  { key: 'building',  label: 'Lieu',        Icon: Building2 },
  { key: 'gift',      label: 'Anniversaire',Icon: Gift },
  { key: 'music',     label: 'Soirée',      Icon: Music },
  { key: 'sun',       label: 'Été',         Icon: Sun },
  { key: 'archive',   label: 'Archives',    Icon: Archive },
  { key: 'tag',       label: 'Étiquette',   Icon: Tag },
  { key: 'pin',       label: 'Secteur',     Icon: MapPin },
];

const ICON_BY_KEY = new Map(FOLDER_ICONS.map((i) => [i.key, i.Icon]));

export function folderIcon(key: string | null | undefined): React.ElementType {
  return ICON_BY_KEY.get(key ?? '') ?? Folder;
}

/** Pastille icône + couleur d'un dossier. */
export function FolderGlyph({
  icon, color, size = 'md',
}: { icon: string | null | undefined; color: string | null | undefined; size?: 'sm' | 'md' }) {
  const c = folderColor(color);
  const Icon = folderIcon(icon);
  const box = size === 'sm' ? 'w-6 h-6 rounded-lg' : 'w-9 h-9 rounded-xl';
  const glyph = size === 'sm' ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]';
  return (
    <span className={`${box} ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`${glyph} ${c.iconText}`} />
    </span>
  );
}

// ── Sélecteur couleur + icône (formulaire création / renommage) ──────────────
export function FolderStylePicker({
  color, icon, onColor, onIcon,
}: { color: string; icon: string; onColor: (c: string) => void; onIcon: (i: string) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Couleur</p>
        <div className="flex flex-wrap gap-1.5">
          {FOLDER_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onColor(c.key)}
              title={c.label}
              className={[
                'w-7 h-7 rounded-full transition-transform',
                c.swatch,
                color === c.key ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110',
              ].join(' ')}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Icône</p>
        <div className="grid grid-cols-8 gap-1.5">
          {FOLDER_ICONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onIcon(key)}
              title={label}
              className={[
                'aspect-square flex items-center justify-center rounded-lg border transition-colors',
                icon === key
                  ? 'border-[#9c27b0] bg-[#f3e5f5] text-[#9c27b0]'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
