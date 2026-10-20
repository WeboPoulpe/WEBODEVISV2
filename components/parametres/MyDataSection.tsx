'use client';

// Paramètres : « Mes données » — export de toutes les données du compte et suppression du compte (RGPD).

import { useState } from 'react';
import { Download, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary } from '@/components/ui/kit';
import { useAuth } from '@/context/AuthContext';
import { requestAccountDeletion } from '@/server/account';

const frDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export default function MyDataSection({ locked }: { locked: string | null }) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purgeOn, setPurgeOn] = useState<string | null>(null);

  const close = () => { setOpen(false); setPassword(''); setConfirm(''); setError(null); };

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await requestAccountDeletion({ password, confirmText: confirm });
      if (res.error) { setError(res.error); return; }
      setPurgeOn(res.purgeOn ?? null);
    } catch {
      setError('La demande n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => { await signOut(); window.location.assign('/login'); };
  const field = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden" aria-labelledby="mydata-title">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="p-2 bg-primary-50 rounded-lg"><ShieldCheck className="h-4 w-4 text-primary" /></div>
        <div>
          <h2 id="mydata-title" className="font-semibold text-gray-900 text-sm">Mes données</h2>
          <p className="text-xs text-gray-400">Récupérer tout ce que contient votre compte, ou le supprimer</p>
        </div>
      </div>
      <div className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-sm text-gray-600 max-w-[52ch]">
            Un fichier avec toutes vos données : devis, clients, prestations, factures, réglages. Lisible par un autre logiciel.
          </p>
          <a href="/api/compte/export" className={`${btnGhost} border border-gray-200 shrink-0`}><Download className="h-4 w-4" />Télécharger mes données</a>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between pt-5 border-t border-gray-100">
          <p className="text-sm text-gray-600 max-w-[52ch]">
            Le compte est désactivé tout de suite, puis toutes ses données sont effacées après 30 jours.
          </p>
          {locked
            ? <p className="text-sm text-gray-400">{locked}</p>
            : <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 shrink-0"><Trash2 className="h-4 w-4" />Supprimer mon compte</button>}
        </div>
      </div>

      {open && (
        <Modal
          title={purgeOn ? 'Demande enregistrée' : 'Supprimer mon compte'}
          onClose={purgeOn ? leave : close}
          footer={purgeOn
            ? <button onClick={leave} className={btnPrimary}>Fermer</button>
            : <>
                <button onClick={close} className={btnGhost}>Annuler</button>
                <button onClick={submit} disabled={busy || !password || confirm.trim().toUpperCase() !== 'SUPPRIMER'}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Supprimer mon compte
                </button>
              </>}
        >
          {purgeOn ? (
            <div className="space-y-3 text-sm text-gray-700">
              <p>Votre compte est désactivé. Vos données seront effacées le <strong>{frDate(purgeOn)}</strong>.</p>
              <p>Un email de confirmation vous a été envoyé. Pour annuler, écrivez-nous avant cette date.</p>
            </div>
          ) : (
            <div className="space-y-4 text-sm text-gray-700">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Vous ne pourrez plus vous connecter, dès maintenant.</li>
                <li>Dans 30 jours, tout sera effacé : devis, clients, prestations, factures, photos et fichiers.</li>
                <li><strong>Vos factures doivent être conservées dix ans</strong> : téléchargez-les avant (page Factures), ainsi que vos données ci-dessus.</li>
              </ul>
              <label className="block">
                <span className="block font-medium mb-1.5">Mot de passe</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={field} />
              </label>
              <label className="block">
                <span className="block font-medium mb-1.5">Écrivez SUPPRIMER pour confirmer</span>
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" className={field} />
              </label>
              {error && <p className="text-red-600" role="alert">{error}</p>}
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
