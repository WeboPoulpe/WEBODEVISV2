'use client';

// Paramètres → Équipe : collaborateurs de l'entreprise, invitations en attente, rôles.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, UserPlus, Users, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary } from '@/components/ui/kit';
import { COMPANY_ROLE_INFO, COMPANY_ROLES, type CompanyRole } from '@/lib/team';
import { getTeam, inviteMember, removeMember, revokeInvitation, setMemberRole } from '@/server/team';

type Team = NonNullable<Awaited<ReturnType<typeof getTeam>>>;

const field = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

export default function TeamSection() {
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CompanyRole>('collaborateur');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => getTeam().then((t) => setTeam(t)).catch(() => setError('L’équipe n’a pas pu être chargée.')), []);
  useEffect(() => { load(); }, [load]);

  const run = async (key: string, action: () => Promise<{ error: string | null }>, done?: string) => {
    setBusy(key); setError(null); setNotice(null);
    const res = await action().catch(() => ({ error: 'L’action a échoué. Réessayez.' }));
    setBusy(null);
    if (res.error) { setError(res.error); return false; }
    if (done) setNotice(done);
    await load();
    return true;
  };

  const invite = async () => {
    if (await run('invite', () => inviteMember({ email, role }), `Invitation envoyée à ${email.trim()}.`)) {
      setInviteOpen(false); setEmail(''); setRole('collaborateur');
    }
  };

  if (!team) return null;
  const others = team.members.filter((m) => m.role !== 'titulaire');
  const full = team.used >= team.seats;

  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden" aria-labelledby="team-title">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="p-2 bg-primary-50 rounded-lg"><Users className="h-4 w-4 text-primary" /></div>
        <div className="flex-1">
          <h2 id="team-title" className="font-semibold text-gray-900 text-sm">Équipe</h2>
          <p className="text-xs text-gray-400">Vos collaborateurs travaillent sur les mêmes devis, catalogue et événements que vous</p>
        </div>
        {team.canManage && (
          <button onClick={() => setInviteOpen(true)} disabled={full} className={`${btnPrimary} shrink-0`} title={full ? 'Toutes les places sont prises' : undefined}>
            <UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Inviter</span>
          </button>
        )}
      </div>
      <div className="p-6 space-y-4">
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        {notice && <p className="text-sm text-emerald-700" role="status">{notice}</p>}
        <ul className="divide-y divide-gray-100 -my-2">
          {team.members.map((m) => (
            <li key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-medium truncate ${m.active ? 'text-gray-900' : 'text-gray-400'}`}>{m.name}{m.isMe ? ' (vous)' : ''}</span>
                <span className="block text-xs text-gray-500 truncate">{m.email}</span>
              </span>
              {m.role === 'titulaire' ? (
                <span className="text-xs font-semibold text-gray-600">Titulaire</span>
              ) : team.canManage && !m.isMe ? (
                <span className="flex items-center gap-2">
                  <select value={m.role} disabled={busy !== null}
                    onChange={(e) => run(`role-${m.id}`, () => setMemberRole(m.id, e.target.value as CompanyRole), 'Rôle modifié.')}
                    className={`${field} py-2 w-auto`} aria-label={`Rôle de ${m.name}`}>
                    {COMPANY_ROLES.map((r) => <option key={r} value={r}>{COMPANY_ROLE_INFO[r].label}</option>)}
                  </select>
                  <button disabled={busy !== null} className={`${btnGhost} text-red-600`}
                    onClick={() => { if (confirm(`Retirer ${m.name} de l’équipe ? Ce qu’il a créé vous revient, et son accès est désactivé.`)) run(`rm-${m.id}`, () => removeMember(m.id), `${m.name} a été retiré de l’équipe.`); }}>
                    {busy === `rm-${m.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Retirer'}
                  </button>
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-600">{COMPANY_ROLE_INFO[m.role as CompanyRole]?.label}</span>
              )}
            </li>
          ))}
          {team.invitations.map((i) => (
            <li key={i.id} className="py-3 flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="flex-1 min-w-0 text-sm text-gray-600 truncate">{i.email} · {COMPANY_ROLE_INFO[i.role].label} · invitation en attente</span>
              {team.canManage && (
                <button onClick={() => run(`inv-${i.id}`, () => revokeInvitation(i.id))} disabled={busy !== null} className={btnGhost} aria-label={`Annuler l’invitation de ${i.email}`}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {others.length === 0 && team.invitations.length === 0 && (
          <p className="text-sm text-gray-500">Vous travaillez seul pour l’instant. Invitez un associé, un commercial ou votre chef de cuisine : chacun aura son propre accès.</p>
        )}
        <p className="text-xs text-gray-400">{team.used} sur {team.seats} place{team.seats > 1 ? 's' : ''} de collaborateur utilisée{team.used > 1 ? 's' : ''}.</p>
      </div>

      {inviteOpen && (
        <Modal title="Inviter un collaborateur" onClose={() => setInviteOpen(false)}
          footer={<>
            <button onClick={() => setInviteOpen(false)} className={btnGhost}>Annuler</button>
            <button onClick={invite} disabled={busy !== null || !email.trim()} className={btnPrimary}>
              {busy === 'invite' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Envoyer l’invitation
            </button>
          </>}>
          <div className="space-y-4 text-sm">
            <label className="block">
              <span className="block font-medium text-gray-700 mb-1.5">Adresse email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className={field} placeholder="prenom@exemple.fr" />
            </label>
            <fieldset className="space-y-2">
              <legend className="font-medium text-gray-700 mb-1.5">Rôle</legend>
              {COMPANY_ROLES.map((r) => (
                <label key={r} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${role === r ? 'border-primary bg-primary-50/40' : 'border-gray-200'}`}>
                  <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="mt-0.5 accent-[rgb(var(--p-600))]" />
                  <span><span className="block font-semibold text-gray-900">{COMPANY_ROLE_INFO[r].label}</span><span className="block text-gray-500">{COMPANY_ROLE_INFO[r].detail}</span></span>
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-gray-500">La personne reçoit un lien valable 7 jours pour créer son accès.</p>
          </div>
        </Modal>
      )}
    </section>
  );
}
