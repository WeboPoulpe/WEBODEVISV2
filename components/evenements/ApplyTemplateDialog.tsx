'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Replace } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnGhost } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { planApply, planSummary, type ApplyMode, type ApplyPlan, type CurrentLine, type IncomingLine } from '@/lib/templateApply';
import { formatQty } from '@/lib/equipment';
import { money } from './shared';

// Appliquer un modèle (location ou matériel) dans un événement : on choisit le modèle en voyant les quantités
// calculées pour les couverts de l'événement. S'il y a déjà des articles, on choisit d'ajouter ou de remplacer,
// avec le récapitulatif de ce qui va changer ; sinon le modèle s'applique tout de suite.

export interface TemplateChoice<T> {
  id: string;
  name: string;
  /** Articles avec leur quantité déjà calculée pour l'événement. */
  lines: IncomingLine<T>[];
  /** Montant estimé (location). */
  total?: number;
}

export interface ApplyLabels {
  /** « Ajouter à la location actuelle » */
  add: string;
  /** « Remplacer la location actuelle » */
  replace: string;
  /** « 5 articles de location » */
  current: (n: number) => string;
}

const PREVIEW = 5;
const qtyText = (qty: number, unit: string | null) => formatQty(qty, unit);

export default function ApplyTemplateDialog<T>({ sets, guests, current, labels, onApply, onClose }: {
  sets: TemplateChoice<T>[];
  guests: number;
  current: CurrentLine[];
  labels: ApplyLabels;
  onApply: (set: TemplateChoice<T>, plan: ApplyPlan<T>, mode: ApplyMode) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<TemplateChoice<T> | null>(null);
  // Les articles déjà commandés sont gardés, sauf si on décoche.
  const [keepLocked, setKeepLocked] = useState(true);
  const locked = current.filter((c) => c.locked);

  const plans = useMemo(() => chosen && ({
    add: planApply('add', current, chosen.lines),
    replace: planApply('replace', current, chosen.lines, keepLocked),
  }), [chosen, current, keepLocked]);

  const choose = (set: TemplateChoice<T>) => {
    // Rien dans l'événement : pas de question, le modèle s'applique.
    if (current.length === 0) onApply(set, planApply('add', [], set.lines), 'add');
    else setChosen(set);
  };

  if (!chosen || !plans) {
    return (
      <Modal title="Quel modèle appliquer ?" onClose={onClose}>
        <p className="text-sm text-gray-500 mb-3">
          {guests > 0 ? `Quantités calculées pour ${guests} couverts.` : 'Le nombre de couverts n’est pas indiqué : les articles comptés par couvert sont laissés de côté.'}
        </p>
        <ul className="space-y-2 pb-3">
          {sets.map((s) => {
            const shown = s.lines.filter((l) => l.qty > 0);
            return (
              <li key={s.id}>
                <button onClick={() => choose(s)} disabled={shown.length === 0}
                  className="w-full flex items-start justify-between gap-3 px-4 py-3.5 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left transition-colors disabled:opacity-50">
                  <span className="min-w-0">
                    <span className="block font-semibold text-gray-900 break-words">{s.name}</span>
                    <span className="block text-sm text-gray-600 break-words">
                      {shown.slice(0, PREVIEW).map((l) => `${l.name} : ${qtyText(l.qty, l.unit)}`).join(' · ')}
                      {shown.length > PREVIEW && ` · et ${shown.length - PREVIEW} autre${shown.length - PREVIEW > 1 ? 's' : ''}`}
                      {shown.length === 0 && 'Aucun article pour ce nombre de couverts'}
                    </span>
                  </span>
                  {!!s.total && s.total > 0 && <span className="font-display font-bold text-gray-900 tabular-nums whitespace-nowrap">{money(s.total)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>
    );
  }

  const option = (mode: ApplyMode, title: string, plan: ApplyPlan<T>, detail: string | null, extra?: React.ReactNode) => (
    <div className={cn('rounded-2xl border border-gray-200 bg-white overflow-hidden', mode === 'replace' && extra && 'pb-1')}>
      <button onClick={() => onApply(chosen, plan, mode)}
        className="w-full flex items-start gap-3 px-4 py-3.5 min-h-14 text-left hover:bg-gray-50 transition-colors">
        <span className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary">
          {mode === 'add' ? <Plus className="h-4 w-4" /> : <Replace className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-gray-900">{title}</span>
          <span className="block text-sm text-gray-600">{planSummary(plan)}</span>
          {detail && <span className="block text-sm text-gray-500 break-words">{detail}</span>}
        </span>
      </button>
      {extra}
    </div>
  );

  const addDetail = [
    ...plans.add.update.map((u) => `${u.line.name} : ${u.line.qty.toLocaleString('fr-FR')} → ${u.qty.toLocaleString('fr-FR')}`),
    ...plans.add.add.filter((a) => a.complementOf).map((a) => `${a.name} : complément de ${a.qty.toLocaleString('fr-FR')} (déjà commandé)`),
  ];

  return (
    <Modal
      title={`Appliquer « ${chosen.name} »`}
      onClose={onClose}
      footer={<>
        {sets.length > 1 && <button onClick={() => setChosen(null)} className={cn(btnGhost, 'mr-auto')}><ArrowLeft className="h-4 w-4" />Autre modèle</button>}
        <button onClick={onClose} className={btnGhost}>Annuler</button>
      </>}
    >
      <div className="space-y-3 pb-3">
        <p className="text-[15px] text-gray-700">
          L’événement contient déjà {labels.current(current.length)}. « {chosen.name} » en apporte {chosen.lines.filter((l) => l.qty > 0).length}
          {guests > 0 ? `, calculés pour ${guests} couverts` : ''}. Que voulez-vous faire ?
        </p>
        {option('add', labels.add, plans.add,
          addDetail.length ? `${addDetail.slice(0, 4).join(' ; ')}${addDetail.length > 4 ? ' ; …' : ''}.${plans.add.update.length ? ' Les quantités s’additionnent.' : ''}` : null)}
        {option('replace', labels.replace, plans.replace,
          plans.replace.keep.length ? `Gardés : ${plans.replace.keep.map((k) => k.name).join(', ')}.` : null,
          locked.length > 0 && (
            <label className="flex items-start gap-3 mx-2 mb-1 px-2 py-2 min-h-11 rounded-xl bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={keepLocked} onChange={(e) => setKeepLocked(e.target.checked)}
                className="mt-0.5 h-6 w-6 rounded-md accent-sage flex-shrink-0" />
              <span className="text-sm text-gray-700 break-words">
                Garder {locked.length > 1 ? `les ${locked.length} articles déjà commandés` : 'l’article déjà commandé'} ({locked.map((l) => l.name).join(', ')})
              </span>
            </label>
          ))}
        <details className="rounded-2xl bg-gray-50 px-4 py-2">
          <summary className="cursor-pointer py-2 text-sm font-medium text-gray-700">Voir les articles du modèle</summary>
          <ul className="pb-2 space-y-1">
            {chosen.lines.filter((l) => l.qty > 0).map((l, i) => (
              <li key={`${l.name}-${i}`} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 break-words text-gray-900">{l.name}</span>
                <span className="tabular-nums whitespace-nowrap text-gray-600">{qtyText(l.qty, l.unit)}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </Modal>
  );
}
