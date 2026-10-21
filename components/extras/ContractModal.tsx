'use client';

// Contrat et DPAE d'une mission : le contrat d'extra (conditions, aperçu, envoi à l'extra pour signature en ligne,
// ou signé sur papier) et la fiche DPAE (informations à recopier sur due.urssaf.fr, case « DPAE faite »).

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, Copy, ExternalLink, FileDown, FileSignature, Info, Link2, Loader2, RotateCcw, Send,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import { CONTRACT_DISCLAIMER, DPAE_URL, type DpaeAlert, type DpaeField } from '@/lib/extraContract';
import {
  getMissionHr, markContractSigned, resetContract, saveContractTerms, saveDpae, sendContract, type MissionHr,
} from '@/server/extraHr';
import ContractView from './ContractView';
import ExtraHrForm from './ExtraHrForm';

const when = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Couleur d'une alerte DPAE, partagée avec les listes. */
export const DPAE_TONES: Record<DpaeAlert['level'], string> = {
  done: 'bg-sage-100 text-sage',
  none: 'bg-gray-100 text-gray-600',
  early: 'bg-gray-100 text-gray-700',
  open: 'bg-amber-100 text-amber-800',
  urgent: 'bg-danger/10 text-danger',
  late: 'bg-danger/10 text-danger',
};

export default function ContractModal({ assignmentId, extraName, onClose, onChanged, initialTab = 'contrat' }: {
  assignmentId: string; extraName: string; onClose: () => void; onChanged?: () => void; initialTab?: 'contrat' | 'dpae';
}) {
  const [tab, setTab] = useState<'contrat' | 'dpae'>(initialTab);
  const [data, setData] = useState<MissionHr | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getMissionHr(assignmentId);
      if (res.error !== null) { setError(res.error); return; }
      setData(res as MissionHr);
    } catch {
      setError('Le contrat n’a pas pu être chargé. Réessayez.');
    }
  }, [assignmentId]);
  useEffect(() => { load(); }, [load]);

  const changed = async () => { await load(); onChanged?.(); };
  const dpaeAlert = data?.dpae.alert;

  return (
    <Modal
      title={`Contrat et DPAE : ${extraName}`}
      onClose={onClose}
      wide
      toolbar={
        <div className="flex p-1 mb-1 rounded-xl bg-gray-200/70 w-full sm:w-fit" role="tablist" aria-label="Contrat ou DPAE">
          {([['contrat', 'Contrat'], ['dpae', 'DPAE']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn('flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-colors', tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {l}
              {k === 'dpae' && dpaeAlert && (dpaeAlert.level === 'urgent' || dpaeAlert.level === 'late' || dpaeAlert.level === 'open') && (
                <span className={cn('w-2 h-2 rounded-full', dpaeAlert.level === 'open' ? 'bg-amber-500' : 'bg-danger')} aria-label="à faire" />
              )}
            </button>
          ))}
        </div>
      }
    >
      {error && !data ? <p role="alert" className={errorCls}>{error}</p>
        : !data ? <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 text-gray-400 animate-spin" /></div>
        : (
          <div className="pb-3">
            {!data.available && (
              <p className="mb-4 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900">
                Les contrats et la DPAE seront disponibles après la prochaine mise à jour de la base.
              </p>
            )}
            {tab === 'contrat' ? <ContractTab data={data} assignmentId={assignmentId} onChanged={changed} />
              : <DpaeTab data={data} assignmentId={assignmentId} onChanged={changed} />}
          </div>
        )}
    </Modal>
  );
}

// ── Contrat ─────────────────────────────────────────────────────────────────

function ContractTab({ data, assignmentId, onChanged }: { data: MissionHr; assignmentId: string; onChanged: () => Promise<void> }) {
  const { confirm, notify } = useFeedback();
  const { contract } = data;
  const draft = contract.status === 'brouillon';
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDoc, setShowDoc] = useState(false);
  const [showHr, setShowHr] = useState(false);
  const [copied, setCopied] = useState(false);
  const extraMissing = data.missing.some((m) => /de l’extra$/.test(m));

  const run = async (key: string, fn: () => Promise<{ error: string | null }>, ok?: string) => {
    setBusy(key); setError(null);
    try {
      const res = await fn();
      if (res.error) { setError(res.error); return; }
      if (ok) notify(ok, { tone: 'success' });
      await onChanged();
    } catch {
      setError('L’opération n’a pas abouti. Réessayez.');
    } finally {
      setBusy(null);
    }
  };

  const send = () => run('send', async () => {
    const res = await sendContract(assignmentId);
    if (!res.error && !res.emailed && res.link) {
      notify(data.extra.email ? 'Contrat prêt, mais l’email n’est pas parti : copiez le lien de signature.' : 'Contrat prêt : l’extra n’a pas d’email, envoyez-lui le lien de signature.');
    } else if (!res.error) notify('Contrat envoyé à l’extra.', { tone: 'success' });
    return res;
  });

  const copyLink = async () => {
    if (!contract.link) return;
    try {
      await navigator.clipboard.writeText(contract.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Le lien n’a pas pu être copié.');
    }
  };

  const reset = async () => {
    const signed = contract.status === 'signe';
    if (!(await confirm({
      title: signed ? 'Préparer un nouveau contrat ?' : 'Modifier le contrat ?',
      message: signed ? 'La signature actuelle sera effacée : le nouveau contrat devra être signé à nouveau.' : 'Le lien envoyé à l’extra ne marchera plus : vous renverrez le contrat une fois modifié.',
      confirmLabel: signed ? 'Nouveau contrat' : 'Modifier', danger: signed,
    }))) return;
    await run('reset', () => resetContract(assignmentId));
  };

  const paper = async () => {
    if (!(await confirm({ title: 'Noter le contrat signé sur papier ?', message: 'Gardez l’original signé : il fait foi.', confirmLabel: 'Signé sur papier' }))) return;
    await run('paper', () => markContractSigned(assignmentId), 'Contrat noté signé.');
  };

  return (
    <div className="space-y-5">
      <StatusLine data={data} />

      {draft && data.missing.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Pour établir le contrat, il manque :</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">{data.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}

      {data.canEdit && (
        <section className="rounded-2xl border border-gray-200">
          <button type="button" onClick={() => setShowHr((v) => !v)} aria-expanded={showHr}
            className="w-full flex items-center justify-between gap-3 px-4 min-h-12 text-left text-[15px] font-medium text-gray-900">
            <span>Fiche de {data.extra.name}{extraMissing && <span className="ml-2 text-sm font-normal text-amber-800">à compléter</span>}</span>
            <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform', showHr && 'rotate-180')} />
          </button>
          {showHr && <div className="px-4 pb-4"><ExtraHrForm extraId={data.extra.id} onSaved={onChanged} /></div>}
        </section>
      )}

      {draft && data.canEdit && <TermsForm data={data} assignmentId={assignmentId} onSaved={onChanged} />}

      <section className="rounded-2xl border border-gray-200">
        <button type="button" onClick={() => setShowDoc((v) => !v)} aria-expanded={showDoc}
          className="w-full flex items-center justify-between gap-3 px-4 min-h-12 text-left text-[15px] font-medium text-gray-900">
          <span>{draft ? 'Aperçu du contrat' : 'Contrat envoyé'}</span>
          <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform', showDoc && 'rotate-180')} />
        </button>
        {showDoc && <div className="px-4 pb-4 max-h-[60dvh] overflow-y-auto"><ContractView doc={data.doc} /></div>}
      </section>

      {error && <p role="alert" className={errorCls}>{error}</p>}

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
        {data.canEdit && contract.status !== 'signe' && (
          <button onClick={send} disabled={!!busy || data.missing.length > 0} className={btnPrimary}>
            {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {draft ? 'Envoyer à l’extra pour signature' : 'Renvoyer le contrat'}
          </button>
        )}
        {contract.link && contract.status === 'envoye' && (
          <button onClick={copyLink} className={btnSecondary}>
            {copied ? <Check className="h-4 w-4 text-sage" /> : <Link2 className="h-4 w-4" />}{copied ? 'Lien copié' : 'Copier le lien de signature'}
          </button>
        )}
        <a href={`/api/extras/contrat/${assignmentId}?telecharger=1`} className={btnSecondary}>
          <FileDown className="h-4 w-4" />{contract.status === 'signe' ? 'PDF signé' : draft ? 'PDF (brouillon)' : 'PDF'}
        </a>
        {data.canEdit && contract.status !== 'signe' && (
          <button onClick={paper} disabled={!!busy} className={btnGhost}>
            {busy === 'paper' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}Signé sur papier
          </button>
        )}
        {data.canEdit && !draft && (
          <button onClick={reset} disabled={!!busy} className={btnGhost}>
            {busy === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {contract.status === 'signe' ? 'Nouveau contrat' : 'Modifier le contrat'}
          </button>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-gray-500">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>{CONTRACT_DISCLAIMER} Le contrat se remet à l’extra au plus tard dans les deux jours ouvrables suivant l’embauche. Convention collective, caisses et clauses : Paramètres, rubrique Employeur.</span>
      </p>
    </div>
  );
}

function StatusLine({ data }: { data: MissionHr }) {
  const c = data.contract;
  if (c.status === 'signe') {
    return (
      <p role="status" className="flex items-start gap-2 rounded-2xl bg-sage-100/70 px-4 py-3 text-sm text-gray-800">
        <CheckCircle2 className="h-4 w-4 text-sage flex-shrink-0 mt-0.5" />
        {c.onPaper ? `Contrat signé sur papier${c.signedAt ? `, noté le ${when(c.signedAt)}` : ''}.` : `Signé en ligne par ${c.signerName} le ${c.signedAt ? when(c.signedAt) : ''}.`}
      </p>
    );
  }
  if (c.status === 'envoye') {
    return (
      <p role="status" className="flex items-start gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
        <Send className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
        Envoyé le {c.sentAt ? when(c.sentAt) : ''}{data.extra.email ? ` à ${data.extra.email}` : ''} : en attente de signature.
      </p>
    );
  }
  return <p className="text-sm text-gray-600">Contrat à durée déterminée d’usage pour cette mission. Vérifiez les conditions, puis envoyez-le : {data.extra.name} le signe en ligne depuis sa page de missions.</p>;
}

function TermsForm({ data, assignmentId, onSaved }: { data: MissionHr; assignmentId: string; onSaved: () => Promise<void> }) {
  const t = data.terms;
  const [f, setF] = useState({
    position: t.position, classification: t.classification ?? '', rate: t.hourly_rate == null ? '' : String(t.hourly_rate).replace('.', ','),
    location: t.location ?? '', start: t.start ?? '', end: t.end ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const rate = f.rate.trim() === '' ? null : Number(f.rate.replace(',', '.').replace(/\s/g, ''));
  const rateBad = rate !== null && (!Number.isFinite(rate) || rate <= 0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); setDone(false); };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await saveContractTerms(assignmentId, { position: f.position, classification: f.classification, hourly_rate: rate, location: f.location, start: f.start, end: f.end });
      if (res.error) { setError(res.error); return; }
      setDone(true);
      await onSaved();
    } catch {
      setError('Les conditions n’ont pas pu être enregistrées. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <h3 className="font-semibold text-gray-900">Conditions de la mission</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ct-position" className={labelCls}>Poste</label>
          <input id="ct-position" value={f.position} onChange={set('position')} className={inputCls} placeholder="Serveur" />
        </div>
        <div>
          <label htmlFor="ct-class" className={labelCls}>Classification (facultatif)</label>
          <input id="ct-class" value={f.classification} onChange={set('classification')} className={inputCls} placeholder="Niveau I, échelon 1" />
        </div>
        <div>
          <label htmlFor="ct-start" className={labelCls}>Début</label>
          <input id="ct-start" type="time" value={f.start} onChange={set('start')} className={inputCls} />
        </div>
        <div>
          <label htmlFor="ct-end" className={labelCls}>Fin prévue</label>
          <input id="ct-end" type="time" value={f.end} onChange={set('end')} className={inputCls} />
        </div>
        <div>
          <label htmlFor="ct-rate" className={labelCls}>Taux horaire brut</label>
          <div className="relative">
            <input id="ct-rate" inputMode="decimal" value={f.rate} onChange={set('rate')} aria-invalid={rateBad} className={cn(inputCls, 'pr-14')} placeholder="13,50" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">€/h</span>
          </div>
          {rateBad && <p className="text-sm text-danger mt-1.5">Indiquez un montant, par exemple 13,50.</p>}
        </div>
        <div>
          <label htmlFor="ct-location" className={labelCls}>Lieu de travail</label>
          <input id="ct-location" value={f.location} onChange={set('location')} className={inputCls} placeholder="Adresse de l’événement" />
        </div>
      </div>
      {error && <p role="alert" className={errorCls}>{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {done && <p role="status" className="inline-flex items-center gap-1.5 text-sm text-forest"><Check className="h-4 w-4" />Enregistré</p>}
        <button type="button" onClick={save} disabled={busy || rateBad || !f.position.trim()} className={btnSecondary}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer les conditions
        </button>
      </div>
    </section>
  );
}

// ── DPAE ────────────────────────────────────────────────────────────────────

const ALERT_TEXT: Record<DpaeAlert['level'], (a: DpaeAlert) => string> = {
  done: () => 'DPAE faite.',
  none: () => 'La DPAE se fait une fois l’extra confirmé, au plus tôt 8 jours avant la mission et au plus tard avant sa prise de poste.',
  early: (a) => `Trop tôt pour la DPAE : elle peut se faire à partir du ${a.opensOn ? new Date(`${a.opensOn}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''}, au plus tard avant la prise de poste.`,
  open: () => 'DPAE à faire avant la prise de poste.',
  urgent: () => 'Prise de poste dans moins de 48 heures : faites la DPAE maintenant.',
  late: () => 'La prise de poste est passée et la DPAE n’est pas notée comme faite. Faites-la sans attendre, ou notez-la si elle est faite.',
};

function DpaeTab({ data, assignmentId, onChanged }: { data: MissionHr; assignmentId: string; onChanged: () => Promise<void> }) {
  const a = data.dpae.alert;
  const [done, setDone] = useState(data.dpae.done);
  const [date, setDate] = useState(data.dpae.date ?? today());
  const [ack, setAck] = useState(data.dpae.ack ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const changed = done !== data.dpae.done || (done && (date !== (data.dpae.date ?? today()) || ack !== (data.dpae.ack ?? '')));

  const save = async () => {
    setBusy(true); setError(null); setSaved(false);
    try {
      const res = await saveDpae(assignmentId, { done, date: done ? date : null, ack: done ? ack : null });
      if (res.error) { setError(res.error); return; }
      setSaved(true);
      await onChanged();
    } catch {
      setError('La DPAE n’a pas pu être enregistrée. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p role="status" className={cn('flex items-start gap-2 rounded-2xl px-4 py-3 text-sm', a.level === 'none' || a.level === 'early' ? 'bg-gray-50 text-gray-700' : DPAE_TONES[a.level])}>
        {a.level === 'done' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : a.level === 'none' || a.level === 'early' ? <Info className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
        <span>{ALERT_TEXT[a.level](a)}{a.level === 'done' && data.dpae.ack ? ` Accusé de réception n° ${data.dpae.ack}.` : ''}</span>
      </p>

      <div className="rounded-2xl bg-gray-50 px-4 py-3 space-y-2">
        <p className="text-sm text-gray-700">La DPAE se fait en ligne sur le site de l’URSSAF. Recopiez-y les informations ci-dessous, rubrique par rubrique, puis notez le n° de l’accusé de réception.</p>
        <a href={DPAE_URL} target="_blank" rel="noopener noreferrer" className={cn(btnSecondary, 'h-10 w-full sm:w-auto')}>
          <ExternalLink className="h-4 w-4" />Ouvrir due.urssaf.fr
        </a>
      </div>

      {data.sheetMissing.length > 0 && (
        <p className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900">
          À compléter avant la DPAE : {data.sheetMissing.join(', ')}. La fiche de l’extra se remplit dans l’onglet Contrat ; l’entreprise dans Paramètres.
        </p>
      )}

      {data.sheet.map((s) => (
        <section key={s.title}>
          <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
          <ul className="rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {s.fields.map((f) => <DpaeRow key={f.label} field={f} />)}
          </ul>
        </section>
      ))}

      {data.canEdit && (
        <section className="rounded-2xl border border-gray-200 p-4 space-y-4">
          <label className="flex items-center gap-3 min-h-10 cursor-pointer text-[15px] font-medium text-gray-900">
            <input type="checkbox" checked={done} onChange={(e) => { setDone(e.target.checked); setSaved(false); }} className="w-5 h-5 rounded accent-[rgb(var(--p-600))]" />
            DPAE faite
          </label>
          {done && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dpae-ack" className={labelCls}>N° d’accusé de réception</label>
                <input id="dpae-ack" value={ack} onChange={(e) => { setAck(e.target.value); setSaved(false); }} className={inputCls} autoComplete="off" />
              </div>
              <div>
                <label htmlFor="dpae-date" className={labelCls}>Date de la déclaration</label>
                <input id="dpae-date" type="date" value={date} max={today()} onChange={(e) => { setDate(e.target.value); setSaved(false); }} className={inputCls} />
              </div>
            </div>
          )}
          {error && <p role="alert" className={errorCls}>{error}</p>}
          <div className="flex items-center justify-end gap-3">
            {saved && <p role="status" className="inline-flex items-center gap-1.5 text-sm text-forest"><Check className="h-4 w-4" />Enregistré</p>}
            <button type="button" onClick={save} disabled={busy || !changed} className={btnPrimary}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function DpaeRow({ field }: { field: DpaeField }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!field.value) return;
    try {
      await navigator.clipboard.writeText(field.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* presse-papiers refusé */ }
  };
  return (
    <li className="flex items-center gap-3 pl-4 pr-1.5 py-1.5 min-h-12">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">{field.label}</p>
        <p className={cn('text-[15px] break-words', field.value ? 'font-medium text-gray-900' : 'text-gray-400')}>{field.value ?? (field.hint || 'À compléter')}</p>
      </div>
      {field.value && (
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 flex-shrink-0"
          aria-label={`Copier : ${field.label}`}>
          {copied ? <Check className="h-4 w-4 text-sage" /> : <Copy className="h-4 w-4" />}<span className="hidden sm:inline">{copied ? 'Copié' : 'Copier'}</span>
        </button>
      )}
    </li>
  );
}
