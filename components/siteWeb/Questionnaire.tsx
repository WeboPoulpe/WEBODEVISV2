'use client';

// Questionnaire de rappel de l'onglet « Site web », en étapes : le projet, ce que le site doit faire (ou le besoin,
// pour un logiciel), le style, puis les coordonnées pour être rappelé. Envoyé à submitSiteWebRequest.

import { useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { CALL_TIMES, emptyAnswers, NEEDS, readAnswers, SOFTWARE, STAGES, type SiteAnswers } from '@/lib/siteWeb';
import { submitSiteWebRequest, type SiteWebPage } from '@/server/siteWeb';

type Step = 'projet' | 'besoins' | 'style' | 'rappel';

const chip = (on: boolean) => cn('rounded-xl border px-4 py-3 text-left text-[15px] transition-colors',
  on ? 'border-primary bg-primary-50 text-gray-900 ring-1 ring-primary' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300');
const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

export default function Questionnaire({ page, project, onClose, onSent }: {
  page: SiteWebPage;
  /** Ce qui a ouvert le questionnaire : un pack, le logiciel, ou '' (rien de précis). */
  project: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { catalog, contact } = page;
  const [a, setA] = useState<SiteAnswers>(() => emptyAnswers(project, contact));
  const [step, setStep] = useState<Step>('projet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (patch: Partial<SiteAnswers>) => { setA((x) => ({ ...x, ...patch })); setError(null); };

  const software = a.project === SOFTWARE;
  const steps: Step[] = software ? ['projet', 'besoins', 'rappel'] : ['projet', 'besoins', 'style', 'rappel'];
  const index = steps.indexOf(step);
  const titles: Record<Step, string> = { projet: 'Votre projet', besoins: software ? 'Votre besoin' : 'Ce que le site doit faire', style: 'Le style', rappel: 'Être rappelé' };

  const next = async () => {
    if (step === 'projet' && !a.project) { setError('Choisissez votre projet.'); return; }
    if (step === 'besoins' && software && a.softwareNeed.trim().length < 10) { setError('Décrivez votre besoin en quelques mots.'); return; }
    if (step !== 'rappel') { setStep(steps[index + 1]); return; }
    const check = readAnswers(a, catalog);
    if (check.error) { setError(check.error); return; }
    setBusy(true);
    const res = await submitSiteWebRequest(a).catch(() => ({ error: 'L’envoi a échoué. Vérifiez votre connexion et réessayez.' }));
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setDone(true);
    onSent();
  };

  if (done) {
    return (
      <Modal title="Demande envoyée" onClose={onClose} footer={<button type="button" onClick={onClose} className={btnPrimary}>Fermer</button>}>
        <div className="flex flex-col items-center py-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-sage" />
          <p className="mt-4 font-display text-xl font-bold text-gray-900">C’est envoyé.</p>
          <p className="mt-1 max-w-sm text-[15px] text-gray-600">Webomax vous rappelle pour parler de votre projet. Un récapitulatif part aussi à {a.email}.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={titles[step]}
      onClose={onClose}
      footer={<>
        {index > 0 && <button type="button" onClick={() => { setStep(steps[index - 1]); setError(null); }} className={cn(btnGhost, 'mr-auto')}><ArrowLeft className="h-4 w-4" />Retour</button>}
        <button type="button" onClick={next} disabled={busy} className={btnPrimary}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{step === 'rappel' ? 'Envoyer ma demande' : 'Continuer'}
        </button>
      </>}
    >
      <div className="space-y-5 pb-2">
        <div>
          <p className="text-sm text-gray-500">Étape {index + 1} sur {steps.length}</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-gray-100" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label="Avancement">
            <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
        {error && <p role="alert" className={errorCls}>{error}</p>}

        {step === 'projet' && (
          <>
            <fieldset>
              <legend className={labelCls}>Ce qui vous intéresse</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {catalog.packs.map((p) => (
                  <button key={p.key} type="button" aria-pressed={a.project === p.key} onClick={() => set({ project: p.key })} className={chip(a.project === p.key)}>
                    <span className="block font-semibold">Site {p.name}</span><span className="text-sm text-gray-500">{p.price}</span>
                  </button>
                ))}
                <button type="button" aria-pressed={software} onClick={() => set({ project: SOFTWARE })} className={chip(software)}>
                  <span className="block font-semibold">Un logiciel sur mesure</span><span className="text-sm text-gray-500">{catalog.software.price}</span>
                </button>
              </div>
            </fieldset>
            {!software && (
              <fieldset>
                <legend className={labelCls}>Où en êtes-vous ?</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {STAGES.map((s) => (
                    <button key={s.key} type="button" aria-pressed={a.stage === s.key} onClick={() => set({ stage: s.key })} className={chip(a.stage === s.key)}>{s.label}</button>
                  ))}
                </div>
                {a.stage === 'refaire' && (
                  <div className="mt-3">
                    <label htmlFor="sw-url" className={labelCls}>Adresse du site actuel <span className="font-normal text-gray-400">(facultatif)</span></label>
                    <input id="sw-url" type="url" inputMode="url" value={a.currentUrl} onChange={(e) => set({ currentUrl: e.target.value })} placeholder="https://" className={inputCls} />
                  </div>
                )}
              </fieldset>
            )}
          </>
        )}

        {step === 'besoins' && (software ? (
          <div>
            <label htmlFor="sw-need" className={labelCls}>Décrivez votre besoin</label>
            <textarea id="sw-need" rows={6} value={a.softwareNeed} onChange={(e) => set({ softwareNeed: e.target.value })}
              placeholder="Ce que vous faites aujourd’hui à la main, ce que l’outil devrait faire, qui s’en servirait…" className={cn(inputCls, 'h-auto py-3')} />
          </div>
        ) : (
          <>
            <fieldset>
              <legend className={labelCls}>Le site doit…</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {NEEDS.map((n) => (
                  <button key={n.key} type="button" aria-pressed={a.needs.includes(n.key)} onClick={() => set({ needs: toggle(a.needs, n.key) })} className={cn(chip(a.needs.includes(n.key)), 'flex items-center gap-2')}>
                    <span className={cn('grid h-5 w-5 flex-shrink-0 place-items-center rounded-md border', a.needs.includes(n.key) ? 'border-primary bg-primary text-white' : 'border-gray-300')}>
                      {a.needs.includes(n.key) && <Check className="h-3.5 w-3.5" />}
                    </span>{n.label}
                  </button>
                ))}
              </div>
              <label htmlFor="sw-other" className={cn(labelCls, 'mt-3')}>Autre chose <span className="font-normal text-gray-400">(facultatif)</span></label>
              <input id="sw-other" value={a.otherNeed} onChange={(e) => set({ otherNeed: e.target.value })} className={inputCls} />
            </fieldset>
            {catalog.options.length > 0 && (
              <fieldset>
                <legend className={labelCls}>Options</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {catalog.options.map((o) => (
                    <button key={o.key} type="button" aria-pressed={a.options.includes(o.key)} onClick={() => set({ options: toggle(a.options, o.key) })} className={chip(a.options.includes(o.key))}>
                      <span className="block font-semibold">{o.name}</span><span className="text-sm text-gray-500">{o.text}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </>
        ))}

        {step === 'style' && (
          <>
            <fieldset>
              <legend className={labelCls}>Plutôt comme…</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {catalog.works.map((w) => (
                  <button key={w.key} type="button" aria-pressed={a.likeWork === w.key} onClick={() => set({ likeWork: w.key })} className={cn(chip(a.likeWork === w.key), 'p-2')}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {w.image && <img src={w.image} alt="" className="aspect-[16/10] w-full rounded-lg object-cover object-top" />}
                    <span className="mt-1.5 block px-1 font-semibold">{w.name}</span>
                  </button>
                ))}
                <button type="button" aria-pressed={a.likeWork === null} onClick={() => set({ likeWork: null })} className={chip(a.likeWork === null)}>Je ne sais pas encore</button>
              </div>
            </fieldset>
            {contact.logoUrl && (
              <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={contact.logoUrl} alt="Votre logo" className="h-12 w-12 rounded-lg bg-white object-contain" />
                <p className="text-sm text-gray-600">Votre logo, enregistré dans WeboDevis, servira de point de départ.</p>
              </div>
            )}
            <div>
              <label htmlFor="sw-style" className={labelCls}>Couleurs, envies, remarques <span className="font-normal text-gray-400">(facultatif)</span></label>
              <textarea id="sw-style" rows={3} value={a.style} onChange={(e) => set({ style: e.target.value })} className={cn(inputCls, 'h-auto py-3')} />
            </div>
          </>
        )}

        {step === 'rappel' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="sw-name" className={labelCls}>Nom</label>
                <input id="sw-name" autoComplete="name" value={a.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="sw-phone" className={labelCls}>Téléphone</label>
                <input id="sw-phone" type="tel" autoComplete="tel" value={a.phone} onChange={(e) => set({ phone: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="sw-email" className={labelCls}>Email</label>
                <input id="sw-email" type="email" autoComplete="email" value={a.email} onChange={(e) => set({ email: e.target.value })} className={inputCls} />
              </div>
            </div>
            <fieldset>
              <legend className={labelCls}>Le meilleur moment pour vous appeler</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CALL_TIMES.map((c) => (
                  <button key={c.key} type="button" aria-pressed={a.callTime === c.key} onClick={() => set({ callTime: c.key })} className={chip(a.callTime === c.key)}>{c.label}</button>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="sw-msg" className={labelCls}>Un mot pour Webomax <span className="font-normal text-gray-400">(facultatif)</span></label>
              <textarea id="sw-msg" rows={3} value={a.message} onChange={(e) => set({ message: e.target.value })} className={cn(inputCls, 'h-auto py-3')} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
