'use client';

import { useMemo, useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { analyzeCustomerImport } from '@/lib/customers/import';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

const BATCH = 100;

// Import de clients en masse : on colle des lignes copiées depuis un tableur, ou on choisit un fichier CSV.
export default function ImportClientsModal({ existingEmails, onClose, onImported }: {
  existingEmails: string[];
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysis = useMemo(() => (text.trim() ? analyzeCustomerImport(text, existingEmails) : null), [text, existingEmails]);
  const ready = analysis?.customers.length ?? 0;

  const readFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(file, 'UTF-8');
  };

  const submit = async () => {
    if (!user || !analysis || ready === 0) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    let done = 0;
    for (let i = 0; i < analysis.customers.length; i += BATCH) {
      const rows = analysis.customers.slice(i, i + BATCH).map((c) => ({ ...c, owner_user_id: user.id }));
      const { error: err } = await supabase.from('customers').insert(rows);
      if (err) {
        setBusy(false);
        setError(done > 0
          ? `${done} clients ont été ajoutés, puis l’import s’est arrêté. Relancez-le : les clients déjà ajoutés seront ignorés.`
          : 'L’import n’a pas abouti. Vérifiez le contenu collé, puis réessayez.');
        if (done > 0) onImported(done);
        return;
      }
      done += rows.length;
    }
    onImported(done);
    onClose();
  };

  return (
    <Modal
      title="Importer des clients"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Annuler</button>
        <button onClick={submit} disabled={busy || ready === 0 || !user} className={btnPrimary}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {ready > 0 ? `Importer ${ready} client${ready > 1 ? 's' : ''}` : 'Importer'}
        </button>
      </>}
    >
      <div className="space-y-4 pb-3">
        {error && <p role="alert" className={errorCls}>{error}</p>}
        <div>
          <label htmlFor="import-clients" className={labelCls}>Collez vos clients, une ligne par client</label>
          <textarea
            id="import-clients" rows={6} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={'Prénom\tNom\tEmail\tTéléphone\nClaire\tMartin\tclaire@exemple.fr\t06 12 34 56 78'}
            className={cn(inputCls, 'h-auto py-3 resize-none font-mono text-sm whitespace-pre')}
          />
          <p className="text-sm text-gray-500 mt-2">
            Copiez les lignes depuis Excel ou Google Sheets, titres de colonnes compris : prénom, nom, entreprise, email, téléphone, adresse. L’email est obligatoire.
          </p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" onChange={readFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className={btnSecondary}><FileUp className="h-4 w-4" />Choisir un fichier CSV</button>

        {analysis && (
          <div className="rounded-2xl bg-gray-50 p-4 space-y-3" role="status">
            <p className="text-[15px] font-semibold text-gray-900">
              {ready} client{ready > 1 ? 's' : ''} prêt{ready > 1 ? 's' : ''} à importer
              {analysis.skipped.length > 0 && <span className="font-normal text-gray-600">, {analysis.skipped.length} ligne{analysis.skipped.length > 1 ? 's' : ''} laissée{analysis.skipped.length > 1 ? 's' : ''} de côté</span>}
            </p>
            {ready > 0 && (
              <ul className="text-sm text-gray-700 space-y-1">
                {analysis.customers.slice(0, 5).map((c) => (
                  <li key={c.email} className="flex justify-between gap-3">
                    <span className="truncate">{c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ')}</span>
                    <span className="text-gray-500 truncate">{c.email}</span>
                  </li>
                ))}
                {ready > 5 && <li className="text-gray-500">et {ready - 5} autre{ready - 5 > 1 ? 's' : ''}</li>}
              </ul>
            )}
            {analysis.skipped.length > 0 && (
              <ul className="text-sm text-gray-600 space-y-1 pt-3 border-t border-gray-200">
                {analysis.skipped.slice(0, 6).map((s) => (
                  <li key={s.line} className="flex justify-between gap-3">
                    <span className="truncate">Ligne {s.line} : {s.label || 'vide'}</span>
                    <span className="text-gray-500 whitespace-nowrap">{s.reason}</span>
                  </li>
                ))}
                {analysis.skipped.length > 6 && <li className="text-gray-500">et {analysis.skipped.length - 6} autre{analysis.skipped.length - 6 > 1 ? 's' : ''}</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
