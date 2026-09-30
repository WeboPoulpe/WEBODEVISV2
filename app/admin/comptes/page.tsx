'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, LogIn, Plus, Search, Trash2 } from 'lucide-react';
import {
  createAccount, deleteEmptyAccount, listAccounts, sendAccountPasswordLink, setAccountActive, setAccountRole, updateAccount,
  type AdminAccount,
} from '@/server/admin';
import { useAuth } from '@/context/AuthContext';
import { MODULES } from '@/lib/modules';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, inputCls, labelCls, pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const accountName = (a: AdminAccount) => a.company_name || [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email;
const STANDARD = MODULES.filter((m) => m.standard).map((m) => m.key);

type Filter = 'tous' | 'actifs' | 'desactives';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'actifs', label: 'Actifs' },
  { key: 'desactives', label: 'Désactivés' },
];

/** Interrupteur accessible : un bouton à deux états, avec son libellé à gauche. */
function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex items-center justify-between gap-4 py-2.5', disabled && 'opacity-50')}>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-gray-900">{label}</span>
        {hint && <span className="block text-sm text-gray-500">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn('relative w-12 h-7 rounded-full flex-shrink-0 transition-colors', checked ? 'bg-primary' : 'bg-gray-300')}>
        <span className={cn('absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </label>
  );
}

function ModulesPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="divide-y divide-gray-100">
      {MODULES.map((m) => (
        <Switch key={m.key} label={m.label} hint={m.description} checked={value.includes(m.key)}
          onChange={(on) => onChange(on ? [...value, m.key] : value.filter((k) => k !== m.key))} />
      ))}
    </div>
  );
}

export default function AdminAccountsPage() {
  const { actAs } = useAuth();
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => setAccounts(await listAccounts()), []);
  useEffect(() => {
    load();
    // Lien direct depuis la vue d'ensemble : /admin/comptes?compte=<id>
    setOpenId(new URLSearchParams(window.location.search).get('compte'));
  }, [load]);

  const filtered = useMemo(() => (accounts ?? []).filter((a) => {
    const text = `${a.email} ${a.first_name ?? ''} ${a.last_name ?? ''} ${a.company_name ?? ''}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase()))
      && (filter === 'tous' || (filter === 'actifs' ? a.is_active : !a.is_active));
  }), [accounts, search, filter]);

  const open = accounts?.find((a) => a.id === openId) ?? null;
  const enter = async (id: string) => { await actAs(id); window.location.assign('/'); };

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Comptes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{accounts ? `${accounts.length} compte${accounts.length > 1 ? 's' : ''}` : ' '}</p>
        </div>
        <button onClick={() => setCreating(true)} className={btnPrimary}><Plus className="h-4 w-4" />Nouveau compte</button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom, entreprise ou email" aria-label="Rechercher un compte" className={cn(inputCls, 'pl-11')} />
        </div>
        <div className="flex p-1 rounded-xl bg-gray-200/70" role="tablist" aria-label="Comptes affichés">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={cn('flex-1 lg:flex-none h-10 px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                filter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!accounts ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse space-y-2"><div className="h-4 bg-gray-100 rounded w-1/3" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(cardCls, 'px-6 py-14 text-center')}>
          <p className="font-semibold text-gray-900">Aucun compte ne correspond</p>
          <p className="text-sm text-gray-500 mt-1">Essayez un autre nom ou un autre filtre.</p>
        </div>
      ) : (
        <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {filtered.map((a) => (
            <li key={a.id}>
              <button onClick={() => setOpenId(a.id)} className="w-full flex items-center gap-4 px-4 sm:px-5 py-3.5 text-left hover:bg-gray-50 transition-colors">
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className={cn('font-semibold truncate', a.is_active ? 'text-gray-900' : 'text-gray-500')}>{accountName(a)}</span>
                    {a.role === 'admin' && <span className={cn(pill, 'bg-forest text-white')}>Administrateur</span>}
                    {a.is_demo && <span className={cn(pill, 'bg-gray-100 text-gray-700')}>Démonstration</span>}
                    {!a.is_active && <span className={cn(pill, 'bg-gray-100 text-gray-700')}>Désactivé</span>}
                  </span>
                  <span className="block text-sm text-gray-500 truncate mt-0.5">{a.email}</span>
                </span>
                <span className="hidden md:block w-40 text-sm text-gray-700">
                  {a.quotes} devis, {a.customers} client{a.customers > 1 ? 's' : ''}
                  <span className="block text-gray-500">{a.last_quote_at ? `Actif le ${day(a.last_quote_at)}` : 'Aucune activité'}</span>
                </span>
                <span className="hidden sm:block w-28 text-right text-sm text-gray-500 whitespace-nowrap">{day(a.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <AccountDialog key={open.id} account={open} onClose={() => setOpenId(null)} onChanged={load} onEnter={() => enter(open.id)} />}
      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={async () => { await load(); setCreating(false); }} />}
    </div>
  );
}

// ── Fiche d'un compte ─────────────────────────────────────────────────────────
function AccountDialog({ account, onClose, onChanged, onEnter }: { account: AdminAccount; onClose: () => void; onChanged: () => Promise<void>; onEnter: () => void }) {
  const [firstName, setFirstName] = useState(account.first_name ?? '');
  const [lastName, setLastName] = useState(account.last_name ?? '');
  const [companyName, setCompanyName] = useState(account.company_name ?? '');
  const [modules, setModules] = useState(account.modules);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = account.is_demo;
  const isEmpty = account.quotes === 0 && account.customers === 0;

  const run = async (name: string, action: () => Promise<{ error: string | null }>, done?: string) => {
    setBusy(name); setError(null); setNotice(null);
    const res = await action().catch(() => ({ error: 'L’action a échoué. Réessayez.' }));
    setBusy(null);
    if (res.error) { setError(res.error); return false; }
    if (done) setNotice(done);
    await onChanged();
    return true;
  };

  const save = () => run('save', () => updateAccount(account.id, { firstName, lastName, companyName, modules }), 'Modifications enregistrées.');
  const remove = async () => {
    if (!confirm(`Supprimer définitivement le compte ${account.email} ?`)) return;
    if (await run('delete', () => deleteEmptyAccount(account.id))) onClose();
  };

  return (
    <Modal
      title={accountName(account)}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Fermer</button>
        {!locked && <button onClick={save} disabled={busy !== null} className={btnPrimary}>{busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>}
      </>}
    >
      <div className="space-y-6 pb-3">
        <p className="text-sm text-gray-500 -mt-1">
          {account.email}. Créé le {day(account.created_at)}. {account.quotes} devis, {account.customers} client{account.customers > 1 ? 's' : ''}.
        </p>
        {error && <p role="alert" className={errorCls}>{error}</p>}
        {notice && <p role="status" className="text-sm text-sage bg-sage-100 rounded-xl px-4 py-3">{notice}</p>}

        {!account.is_self && (
          <button onClick={onEnter} className={cn(btnSecondary, 'w-full')}>
            <LogIn className="h-4 w-4" />Ouvrir le compte
          </button>
        )}
        {!account.is_self && (
          <p className="text-sm text-gray-500 -mt-3">
            Vous entrez dans l’app à la place du client, pour ajouter ses prestations, ses clients ou son matériel. Un bandeau permet d’en ressortir.
          </p>
        )}

        {!locked && (
          <section className="space-y-4">
            <h3 className="text-[15px] font-semibold text-gray-900">Identité</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="acc-first" className={labelCls}>Prénom</label><input id="acc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} /></div>
              <div><label htmlFor="acc-last" className={labelCls}>Nom</label><input id="acc-last" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} /></div>
            </div>
            <div><label htmlFor="acc-company" className={labelCls}>Entreprise</label><input id="acc-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} /></div>
          </section>
        )}

        {!locked && (
          <section>
            <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Options</h3>
            <ModulesPicker value={modules} onChange={setModules} />
          </section>
        )}

        {!locked && !account.is_self && (
          <section>
            <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Accès</h3>
            <div className="divide-y divide-gray-100">
              <Switch label="Compte actif" hint="Désactivé, le compte ne peut plus se connecter. Ses données sont conservées." checked={account.is_active}
                disabled={busy !== null} onChange={(v) => run('active', () => setAccountActive(account.id, v))} />
              <Switch label="Administrateur" hint="Donne accès à cet espace d’administration." checked={account.role === 'admin'}
                disabled={busy !== null} onChange={(v) => run('role', () => setAccountRole(account.id, v ? 'admin' : 'user'))} />
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => run('link', () => sendAccountPasswordLink(account.id), `Lien envoyé à ${account.email}.`)} disabled={busy !== null} className={btnSecondary}>
                {busy === 'link' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Envoyer un lien de mot de passe
              </button>
              {isEmpty && (
                <button onClick={remove} disabled={busy !== null} className={cn(btnGhost, 'text-danger hover:bg-gray-100')}>
                  <Trash2 className="h-4 w-4" />Supprimer
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

// ── Nouveau compte ────────────────────────────────────────────────────────────
function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [modules, setModules] = useState<string[]>(STANDARD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await createAccount({ email, firstName, lastName, companyName, modules }).catch(() => ({ error: 'La création a échoué. Réessayez.' }));
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    await onCreated();
  };

  return (
    <Modal
      title="Nouveau compte"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Annuler</button>
        <button form="create-account" type="submit" disabled={busy || !email} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Créer le compte</button>
      </>}
    >
      <form id="create-account" onSubmit={submit} className="space-y-4 pb-3">
        {error && <p role="alert" className={errorCls}>{error}</p>}
        <div><label htmlFor="new-email" className={labelCls}>Email</label><input id="new-email" type="email" inputMode="email" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="traiteur@exemple.fr" className={inputCls} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="new-first" className={labelCls}>Prénom</label><input id="new-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} /></div>
          <div><label htmlFor="new-last" className={labelCls}>Nom</label><input id="new-last" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} /></div>
        </div>
        <div><label htmlFor="new-company" className={labelCls}>Entreprise</label><input id="new-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} /></div>
        <div>
          <p className={labelCls}>Options</p>
          <ModulesPicker value={modules} onChange={setModules} />
        </div>
        <p className="text-sm text-gray-500">La personne reçoit un email avec un lien, valable sept jours, pour choisir son mot de passe.</p>
      </form>
    </Modal>
  );
}
