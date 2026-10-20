'use client';

import { Check, Lock } from 'lucide-react';
import { ALLERGENS, sortAllergens, type AllergenKey } from '@/lib/allergens';
import { cn } from '@/lib/utils';

// Les 14 allergènes en pastilles à cocher.
// - « value » : allergènes cochés.
// - « suggested » : parmi eux, ceux qui ne sont qu'une suggestion d'après le nom (bordure en pointillé).
// - « locked » : cochés et impossibles à décocher (ils viennent d'un ingrédient de la recette), avec leur origine.
// - « readOnly » : simple affichage, sans clic.

interface Props {
  value: readonly string[];
  onChange?: (keys: AllergenKey[]) => void;
  suggested?: readonly string[];
  locked?: readonly string[];
  /** Texte d'origine d'un allergène verrouillé, affiché en infobulle (« Farine de blé, Beurre »). */
  lockedHint?: Partial<Record<string, string>>;
  readOnly?: boolean;
  /** Nom accessible du groupe. */
  label?: string;
  className?: string;
}

export default function AllergenPicker({ value, onChange, suggested = [], locked = [], lockedHint = {}, readOnly, label = 'Allergènes', className }: Props) {
  const checked = new Set(value);
  const sugg = new Set(suggested);
  const lock = new Set(locked);
  const anySuggested = ALLERGENS.some((a) => sugg.has(a.key) && checked.has(a.key) && !lock.has(a.key));

  const toggle = (key: AllergenKey) => {
    if (readOnly || lock.has(key) || !onChange) return;
    const next = new Set(checked);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(sortAllergens(next));
  };

  return (
    <div className={className}>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {ALLERGENS.map((a) => {
          const isLocked = lock.has(a.key);
          const isOn = checked.has(a.key) || isLocked;
          const isSugg = isOn && !isLocked && sugg.has(a.key);
          const tip = [
            a.detail ? `${a.label} : ${a.detail}` : a.label,
            isLocked ? `Apporté par la recette${lockedHint[a.key] ? ` : ${lockedHint[a.key]}` : ''}` : '',
            isSugg ? 'Suggéré d’après le nom' : '',
          ].filter(Boolean).join('. ');
          const cls = cn(
            'inline-flex items-center gap-1.5 min-h-10 px-3 rounded-full border text-sm font-medium transition-colors',
            isOn
              ? isSugg
                ? 'border-dashed border-primary-400 bg-white text-primary-800'
                : 'border-primary-200 bg-primary-50 text-primary-800'
              : 'border-gray-200 bg-white text-gray-600',
            !readOnly && !isLocked && (isOn ? 'hover:border-primary-400' : 'hover:border-gray-300 hover:text-gray-900'),
            (readOnly || isLocked) && 'cursor-default',
          );
          const icon = isLocked
            ? <Lock className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            : isOn ? <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden /> : null;
          if (readOnly) {
            // En lecture seule, on n'affiche que les allergènes présents.
            if (!isOn) return null;
            return <span key={a.key} title={tip} className={cls}>{icon}{a.label}</span>;
          }
          return (
            <button
              key={a.key} type="button" title={tip}
              aria-pressed={isOn} aria-disabled={isLocked || undefined}
              onClick={() => toggle(a.key)} className={cls}
            >
              {icon}{a.label}
              {isSugg && <span className="sr-only"> (suggéré)</span>}
            </button>
          );
        })}
      </div>
      {anySuggested && (
        <p className="flex items-center gap-2 text-sm text-gray-500 mt-2">
          <span className="inline-block h-3.5 w-6 rounded-full border border-dashed border-primary-400" aria-hidden />
          Suggéré d’après le nom : vérifiez.
        </p>
      )}
    </div>
  );
}
