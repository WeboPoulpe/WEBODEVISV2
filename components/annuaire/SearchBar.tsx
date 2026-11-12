'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DEPARTMENTS, departmentByCode } from '@/lib/annuaire/departments';
import { EVENT_TYPES, isEventType } from '@/lib/annuaire/eventTypes';
import { eventPhrase, inDepartment } from '@/lib/annuaire/phrases';
import { useDirectoryHref } from './BaseContext';

// La recherche en phrase : « Un traiteur pour [un mariage] dans [l’Aube] ». Chaque choix est une vraie liste
// déroulante (clavier, lecteur d'écran), invisible, posée sur la pastille rose pâle qui affiche le choix. Sans
// JavaScript, le formulaire part quand même vers /traiteurs.

const typographic = (s: string) => s.replace(/'/g, '’');

function Choice({ label, name, value, onChange, display, options }: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  display: string;
  options: [string, string][];
}) {
  return (
    <label className="cmt-choice">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{display}</span>
      <select className="cmt-choice__select" name={name} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}

/** « dans l’Aube » se lit « dans » puis la pastille « l’Aube » ; « partout en France » tient dans la pastille. */
function splitPlace(phrase: string): [string, string] {
  const m = /^(dans|à|en) (.+)$/.exec(phrase);
  return m ? [m[1], m[2]] : ['', phrase];
}

const TYPE_OPTIONS: [string, string][] = [['', 'Tous les événements'], ...EVENT_TYPES.map((t): [string, string] => [t, t])];
const DEPARTMENT_OPTIONS: [string, string][] = [['', 'Toute la France'], ...DEPARTMENTS.map((d): [string, string] => [d.code, `${typographic(d.name)} (${d.code})`])];

export default function SearchBar({ department = '', eventType = '', compact = false, aside }: {
  department?: string;
  eventType?: string;
  /** Version réduite, sur les pages de résultats. */
  compact?: boolean;
  /** Phrase posée à côté du bouton. */
  aside?: React.ReactNode;
}) {
  const href = useDirectoryHref();
  const router = useRouter();
  const [type, setType] = useState(isEventType(eventType) ? eventType : '');
  const [dept, setDept] = useState(departmentByCode(department) ? department : '');

  const [preposition, place] = splitPlace(inDepartment(dept));

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Un département seul a sa propre page, celle que Google connaît.
    const d = departmentByCode(dept);
    if (d && !type) return router.push(href(`/traiteurs/${d.slug}`));
    const q = new URLSearchParams();
    if (d) q.set('departement', d.code);
    if (type) q.set('type', type);
    const s = q.toString();
    router.push(href(`/traiteurs${s ? `?${s}` : ''}`));
  };

  return (
    <form role="search" aria-label="Chercher un traiteur" action={href('/traiteurs')} method="get" onSubmit={onSubmit}>
      <p className={`cmt-sentence ${compact ? 'cmt-sentence--compact' : ''}`}>
        Un traiteur pour{' '}
        <Choice label="Type d’événement" name="type" value={type} onChange={setType} display={eventPhrase(type)} options={TYPE_OPTIONS} />{' '}
        {preposition && <>{preposition}{' '}</>}
        <Choice label="Département" name="departement" value={dept} onChange={setDept} display={place} options={DEPARTMENT_OPTIONS} />
      </p>
      <div className="cmt-search__foot">
        <button type="submit" className={`cmt-btn cmt-btn--dark ${compact ? '' : 'cmt-btn--big'}`}>Voir les traiteurs</button>
        {aside && <p className="cmt-search__aside">{aside}</p>}
      </div>
    </form>
  );
}
