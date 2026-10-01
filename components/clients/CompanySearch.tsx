'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Building2, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inputCls, labelCls, pill } from '@/components/ui/kit';
import { formatSiret, parseCompanyQuery, type CompanyResult } from '@/lib/companies';
import { searchCompanies } from '@/server/companies';

// Recherche d'une entreprise par nom, SIREN ou SIRET (registre public de l'État) pour remplir une fiche
// client : suggestions au fil de la frappe, au clavier (flèches, Entrée, Échap) comme au doigt.
// Au choix, `onPick` reçoit l'entreprise ; c'est l'écran appelant qui remplit ses champs.

interface Props {
  onPick: (company: CompanyResult) => void;
  /** Proposé quand le SIRET choisi est déjà dans le carnet : ouvrir ou reprendre cette fiche. */
  onUseExisting?: (customer: { id: string; name: string }) => void;
  useExistingLabel?: string;
  /** Fiche en cours de modification : son propre SIRET n'est pas un doublon. */
  excludeCustomerId?: string | null;
  label?: string;
  /** Version resserrée pour les panneaux étroits (même cible tactile de 40 px). */
  compact?: boolean;
  className?: string;
}

const DEBOUNCE_MS = 300;

export default function CompanySearch({
  onPick, onUseExisting, useExistingLabel = 'Utiliser cette fiche', excludeCustomerId = null,
  label = 'Rechercher l’entreprise', compact = false, className,
}: Props) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const [text, setText] = useState('');
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<CompanyResult | null>(null);
  const request = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const duplicateOf = (c: CompanyResult) =>
    c.existingCustomer && c.existingCustomer.id !== excludeCustomerId ? c.existingCustomer : null;

  // Recherche avec anti-rebond ; une réponse arrivée après une frappe plus récente est ignorée.
  useEffect(() => {
    const query = parseCompanyQuery(text);
    const ticket = ++request.current;
    if (!query) { setResults([]); setLoading(false); setError(null); setSearched(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchCompanies(text);
        if (ticket !== request.current) return;
        setResults(res.results);
        setError(res.error);
      } catch {
        if (ticket !== request.current) return;
        setResults([]);
        setError('Recherche indisponible pour le moment, saisissez les informations à la main.');
      }
      setSearched(true);
      setActive(-1);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // Un toucher ou un clic ailleurs referme les suggestions.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const choose = (c: CompanyResult) => {
    setPicked(c);
    setOpen(false);
    setText('');
    setResults([]);
    setSearched(false);
    onPick(c);
  };

  const showList = open && !!parseCompanyQuery(text) && (loading || searched || !!error);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      if (results.length) setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length) setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      // Entrée ne valide jamais le formulaire autour : elle choisit la suggestion en cours (ou la seule).
      e.preventDefault();
      const target = results[active] ?? (results.length === 1 ? results[0] : undefined);
      if (showList && target) choose(target);
    } else if (e.key === 'Escape') {
      // Échap referme d'abord les suggestions, puis vide le champ ; la fiche ou le panneau autour reste
      // ouvert (leur écouteur est sur document, comme celui de React : d'où l'arrêt immédiat).
      if (showList || text) {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        if (showList) setOpen(false); else setText('');
      }
    }
  };

  const duplicate = picked ? duplicateOf(picked) : null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <label htmlFor={inputId} className={compact ? 'block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1' : labelCls}>{label}</label>
      <div className="relative">
        <Search className={cn('absolute top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none', compact ? 'left-3 h-3.5 w-3.5' : 'left-4 h-4 w-4')} />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Nom de l’entreprise ou SIRET"
          className={compact
            ? 'w-full h-10 pl-9 pr-9 text-sm bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
            : cn(inputCls, 'pl-11 pr-11')}
        />
        {loading ? (
          <Loader2 aria-hidden className={cn('absolute top-1/2 -translate-y-1/2 animate-spin text-gray-400', compact ? 'right-3 h-3.5 w-3.5' : 'right-4 h-4 w-4')} />
        ) : text ? (
          <button type="button" onClick={() => { setText(''); setOpen(false); }} aria-label="Effacer la recherche"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {showList && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-float overflow-hidden">
          {results.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Entreprises trouvées" className="max-h-72 overflow-y-auto py-1">
              {results.map((c, i) => {
                const dup = duplicateOf(c);
                return (
                  <li
                    key={c.siret}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => choose(c)}
                    onMouseEnter={() => setActive(i)}
                    className={cn('flex items-start gap-3 px-3.5 py-2.5 min-h-[48px] cursor-pointer', i === active ? 'bg-primary-50' : 'hover:bg-gray-50')}
                  >
                    <Building2 aria-hidden className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900 break-words">{c.name}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {[c.city, `SIRET ${formatSiret(c.siret)}`].filter(Boolean).join(' · ')}
                      </span>
                      {(!c.active || dup) && (
                        <span className="flex flex-wrap gap-1.5 mt-1">
                          {!c.active && <span className={cn(pill, 'bg-danger/10 text-danger')}>Établissement fermé</span>}
                          {dup && <span className={cn(pill, 'bg-sage-100 text-sage')}>Déjà dans vos clients</span>}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p id={listId} role="status" className="px-4 py-3 text-sm text-gray-600">
              {loading ? 'Recherche en cours…' : error ?? 'Aucune entreprise trouvée. Vérifiez le nom ou le SIRET, ou saisissez les informations à la main.'}
            </p>
          )}
        </div>
      )}

      {!showList && error && !picked && (
        <p role="status" className="mt-1.5 text-xs text-gray-600">{error}</p>
      )}

      {picked && (
        <div role="status" className={cn('mt-2 rounded-xl px-3.5 py-2.5 text-sm', duplicate ? 'bg-accent/10 text-gray-800' : 'bg-sage-100 text-gray-800')}>
          {duplicate ? (
            <>
              <p>Ce SIRET est déjà dans votre carnet : <strong className="font-semibold">{duplicate.name}</strong>.</p>
              {onUseExisting && (
                <button type="button" onClick={() => { onUseExisting(duplicate); setPicked(null); }}
                  className="mt-1.5 inline-flex items-center h-10 px-3 -ml-3 rounded-lg font-semibold text-primary hover:bg-white/60">
                  {useExistingLabel}
                </button>
              )}
            </>
          ) : (
            <p>Informations reprises de <strong className="font-semibold">{picked.name}</strong>. Vérifiez-les avant d’enregistrer.</p>
          )}
          {!picked.active && <p className="mt-1 text-danger font-medium">Attention : cet établissement est fermé.</p>}
        </div>
      )}
    </div>
  );
}
