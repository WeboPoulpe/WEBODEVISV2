'use client';

// Éditeur de brochure : la composition à gauche (réglages, couverture, pages, prestations), l'aperçu feuilletable à
// droite (sous la composition sur téléphone), tel que le lecteur le verra. Enregistrement automatique.
// En éditeur avancé, l'aperçu et la composition laissent la place aux pages à blocs (AdvancedEditor) ; le thème, les
// réglages et la couverture restent à gauche.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, ExternalLink, Loader2, Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import SendBrochureModal from './SendBrochureModal';
import Modal from '@/components/ui/Modal';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { btnPrimary, btnSecondary, cardCls, iconBtn, iconBtnDanger, inputCls, labelCls } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import { VAT_RATES, vatLabel } from '@/lib/vat';
import {
  BROCHURE_STYLES, STYLE_LABELS, paginateBrochure, parseBrochureContent,
  type BrochureContent, type BrochureCover, type BrochureItem, type BrochureStyle, type CatalogPrestation,
} from '@/lib/brochure';
import { parseLayout, type BrochureLayout } from '@/lib/brochureLayout';
import { renewBrochureLink, saveBrochure, switchBrochureEditor, type BrochureRow, type PublicBrochure } from '@/server/brochures';
import AdvancedEditor from './advanced/AdvancedEditor';
import { Flipbook } from './Flipbook';
import { BrochurePageView } from './BrochurePages';
import PrestationPicker, { categoryLabel } from './PrestationPicker';
import ItemRetouch from './ItemRetouch';
import PhotoField from './PhotoField';

const STYLE_HINTS: Record<BrochureStyle, string> = {
  editorial: 'Une prestation par page, grande photo en couverture.',
  carte: 'Comme une carte de restaurant, groupée par catégorie.',
  magazine: 'Photos en avant, plusieurs prestations par page.',
};

interface Draft {
  name: string;
  style: BrochureStyle;
  language: 'fr' | 'en';
  show_prices: boolean;
  price_mode: 'ht' | 'ttc';
  vat_rate: number;
  is_active: boolean;
  cover: BrochureCover;
  content: BrochureContent;
}

const newId = () => `s${Math.random().toString(36).slice(2, 9)}`;
const move = <T,>(list: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={cn(cardCls, 'p-4 space-y-3')}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
      {children}
    </section>
  );
}

export default function BrochureEditor({ brochure, catalog, company, onReload }: {
  brochure: BrochureRow; catalog: CatalogPrestation[]; company: PublicBrochure['company'];
  /** Recharge la brochure (après un changement d'éditeur, qui réécrit la composition ou la mise en page). */
  onReload: () => void;
}) {
  const { notify, confirm } = useFeedback();
  const [draft, setDraft] = useState<Draft>(() => ({
    name: brochure.name,
    style: brochure.style as BrochureStyle,
    language: brochure.language === 'en' ? 'en' : 'fr',
    show_prices: brochure.show_prices,
    price_mode: brochure.price_mode === 'ht' ? 'ht' : 'ttc',
    vat_rate: Number(brochure.vat_rate),
    is_active: brochure.is_active,
    cover: { title: brochure.name, ...(brochure.cover as object) } as BrochureCover,
    content: parseBrochureContent(brochure.content),
  }));
  const [token, setToken] = useState(brochure.share_token);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const [retouch, setRetouch] = useState<{ section: number; item: number } | null>(null);
  const advanced = brochure.editor_mode === 'advanced';
  const [layout, setLayout] = useState<BrochureLayout>(() => parseLayout(brochure.layout) ?? { pages: [] });
  const [switching, setSwitching] = useState(false);
  const [choosing, setChoosing] = useState(false);

  // Enregistrement automatique, 800 ms après le dernier changement (rien à l'ouverture : la brochure est déjà enregistrée).
  const saved = useRef(JSON.stringify(draft));
  useEffect(() => {
    const now = JSON.stringify(draft);
    if (now === saved.current) return;
    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      const res = await saveBrochure(brochure.id, { ...draft, vat_rate: String(draft.vat_rate) }).catch(() => ({ error: 'réseau' }));
      if (!res.error) saved.current = now;
      setSaveState(res.error ? 'error' : 'saved');
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draft, brochure.id]);

  // La mise en page avancée s'enregistre de la même façon, à part (seulement en éditeur avancé).
  const savedLayout = useRef(JSON.stringify(layout));
  useEffect(() => {
    const now = JSON.stringify(layout);
    if (!advanced || now === savedLayout.current) return;
    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      const res = await saveBrochure(brochure.id, { layout }).catch(() => ({ error: 'réseau' }));
      if (!res.error) savedLayout.current = now;
      setSaveState(res.error ? 'error' : 'saved');
    }, 800);
    return () => window.clearTimeout(timer);
  }, [layout, advanced, brochure.id]);

  // En quittant l'éditeur (« Retour », lien du menu) avant la fin du délai : le dernier changement part tout de suite.
  // En fermant l'onglet pendant un enregistrement : le navigateur demande confirmation.
  const latest = useRef(draft);
  latest.current = draft;
  const latestLayout = useRef(layout);
  latestLayout.current = layout;
  /** Enregistre tout de suite ce qui attend encore son délai. */
  const flush = async () => {
    const jobs: Promise<unknown>[] = [];
    const d = JSON.stringify(latest.current);
    if (d !== saved.current) jobs.push(saveBrochure(brochure.id, { ...latest.current, vat_rate: String(latest.current.vat_rate) }).then((r) => { if (!r.error) saved.current = d; }));
    const l = JSON.stringify(latestLayout.current);
    if (advanced && l !== savedLayout.current) jobs.push(saveBrochure(brochure.id, { layout: latestLayout.current }).then((r) => { if (!r.error) savedLayout.current = l; }));
    await Promise.all(jobs).catch(() => {});
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const pending = () => JSON.stringify(latest.current) !== saved.current || JSON.stringify(latestLayout.current) !== savedLayout.current;
    const onLeave = (e: BeforeUnloadEvent) => { if (pending()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      void flushRef.current();
    };
  }, [brochure.id]);

  /** Changement d'éditeur : ce qui attend part d'abord, puis le serveur convertit et la brochure est rechargée. */
  const switchTo = async (to: 'simple' | 'advanced', resume?: boolean) => {
    setSwitching(true);
    await flush();
    const res = await switchBrochureEditor(brochure.id, to, resume === undefined ? {} : { resume }).catch(() => ({ error: 'réseau', needsChoice: false }));
    setSwitching(false);
    if (res.error) { notify(res.error === 'réseau' ? 'Le changement d’éditeur n’a pas abouti, vérifiez votre connexion.' : res.error, { tone: 'error' }); return; }
    if (res.needsChoice) { setChoosing(true); return; }
    setChoosing(false);
    onReload();
  };
  const toSimple = async () => {
    if (!advanced || switching) return;
    const ok = await confirm({
      title: 'Revenir à l’éditeur simple ?',
      message: 'Les pages sont recomposées automatiquement à partir de vos prestations : la disposition faite à la main est remplacée. Vous pourrez la reprendre en repassant en éditeur avancé.',
      confirmLabel: 'Passer à l’éditeur simple',
    });
    if (ok) await switchTo('simple');
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setContent = (fn: (c: BrochureContent) => BrochureContent) => setDraft((d) => ({ ...d, content: fn(d.content) }));
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const inBrochure = useMemo(() => new Set(draft.content.sections.flatMap((s) => s.items.map((i) => i.prestationId))), [draft.content]);

  /** Prestations ajoutées : rangées dans la section de leur catégorie (créée au besoin). */
  const addPrestations = (ids: string[]) => {
    setContent((c) => {
      const sections = c.sections.map((s) => ({ ...s, items: [...s.items] }));
      for (const id of ids) {
        const title = categoryLabel(byId.get(id)?.category ?? null);
        let section = sections.find((s) => s.title === title);
        if (!section) { section = { id: newId(), title, items: [] }; sections.push(section); }
        section.items.push({ prestationId: id });
      }
      return { ...c, sections };
    });
    setPicking(false);
  };

  const pages = useMemo(() => paginateBrochure(draft.content, byId, draft.style, {
    show: draft.show_prices, mode: draft.price_mode, vatRate: draft.vat_rate, language: draft.language, forEditor: true,
  }), [draft, byId]);

  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/b/${token}`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); notify('Lien copié.', { tone: 'success' }); } catch { notify(link); }
  };
  const renew = async () => {
    if (!(await confirm({ title: 'Créer un nouveau lien ?', message: 'L’ancien lien cessera de marcher pour tous ceux qui l’ont reçu.', confirmLabel: 'Nouveau lien' }))) return;
    const res = await renewBrochureLink(brochure.id);
    if (res.error || !res.token) { notify(res.error ?? 'Le lien n’a pas pu être changé.', { tone: 'error' }); return; }
    setToken(res.token);
    notify('Nouveau lien créé.', { tone: 'success' });
  };

  const retouched = retouch && draft.content.sections[retouch.section]?.items[retouch.item];
  const retouchedPrestation = retouched ? byId.get(retouched.prestationId) : undefined;

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Link href="/brochures" className={iconBtn} aria-label="Retour aux brochures"><ArrowLeft className="h-4 w-4" /></Link>
        <input value={draft.name} onChange={(e) => set('name', e.target.value)} aria-label="Nom de la brochure" maxLength={120}
          className="flex-1 min-w-[12rem] bg-transparent text-[24px] md:text-[28px] font-bold text-gray-900 outline-none border-b border-transparent focus:border-gray-300" />
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 text-sm" role="group" aria-label="Éditeur">
          {([['simple', 'Éditeur simple'], ['advanced', 'Éditeur avancé']] as const).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={advanced === (m === 'advanced')} disabled={switching}
              onClick={() => (m === 'advanced' ? !advanced && switchTo('advanced') : toSimple())}
              className={cn('rounded-lg px-3 py-1.5 font-medium', advanced === (m === 'advanced') ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50')}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500 inline-flex items-center gap-1.5" aria-live="polite">
          {saveState === 'saving' ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…</>
            : saveState === 'error' ? <span className="text-danger">Non enregistré, vérifiez votre connexion</span>
              : <><Check className="h-4 w-4 text-forest" /> Enregistré</>}
        </span>
      </div>

      <div className={cn('grid grid-cols-1 gap-6 items-start', advanced ? 'xl:grid-cols-[320px_1fr]' : 'lg:grid-cols-[400px_1fr]')}>
        <div className={cn('min-w-0 space-y-4', advanced && 'order-2 xl:order-1')} role="region" aria-label={advanced ? 'Réglages de la brochure' : 'Composition'}>
          <Section title={advanced ? 'Thème' : 'Style'}>
            <div className="grid grid-cols-3 gap-2">
              {BROCHURE_STYLES.map((s) => (
                <button key={s} type="button" onClick={() => set('style', s)} aria-pressed={draft.style === s}
                  className={cn('rounded-xl border px-2 py-2 text-sm font-medium', draft.style === s ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
                  {STYLE_LABELS[s]}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500">{advanced ? 'Couleurs et typographie de la couverture et des pages spéciales ; les pages à blocs le suivent par défaut.' : STYLE_HINTS[draft.style]}</p>
          </Section>

          <Section title="Réglages">
            <label className="block">
              <span className={labelCls}>Langue de la brochure</span>
              <select value={draft.language} onChange={(e) => set('language', e.target.value === 'en' ? 'en' : 'fr')} className={inputCls}>
                <option value="fr">Français</option>
                <option value="en">Anglais (fiches anglaises du catalogue quand elles existent)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={draft.show_prices} onChange={(e) => set('show_prices', e.target.checked)} />
              Afficher les prix
            </label>
            {draft.show_prices && (
              <div className="flex flex-wrap items-center gap-3 pl-6">
                {(['ttc', 'ht'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input type="radio" name="price_mode" className="accent-primary" checked={draft.price_mode === m} onChange={() => set('price_mode', m)} />
                    {m === 'ttc' ? 'TTC' : 'HT'}
                  </label>
                ))}
                {draft.price_mode === 'ttc' && (
                  <select value={draft.vat_rate} onChange={(e) => set('vat_rate', Number(e.target.value))} aria-label="Taux de TVA" className={cn(inputCls, 'w-auto py-1.5')}>
                    {VAT_RATES.map((r) => <option key={r} value={r}>TVA {vatLabel(r)}</option>)}
                  </select>
                )}
              </div>
            )}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
                Lien actif
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setSending(true)} disabled={!draft.is_active || saveState !== 'saved'} className={btnSecondary}><Send className="h-4 w-4" /> Envoyer</button>
                <button type="button" onClick={copyLink} className={btnSecondary}><Copy className="h-4 w-4" /> Copier le lien</button>
                <a href={`/b/${token}`} target="_blank" rel="noreferrer" className={btnSecondary}><ExternalLink className="h-4 w-4" /> Voir comme le lecteur</a>
                <button type="button" onClick={renew} className={btnSecondary}><RefreshCw className="h-4 w-4" /> Nouveau lien</button>
              </div>
            </div>
          </Section>

          <Section title="Couverture">
            <label className="block">
              <span className={labelCls}>Titre</span>
              <input value={draft.cover.title} onChange={(e) => set('cover', { ...draft.cover, title: e.target.value })} maxLength={120} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Sous-titre</span>
              <input value={draft.cover.subtitle ?? ''} onChange={(e) => set('cover', { ...draft.cover, subtitle: e.target.value })} maxLength={200} placeholder="Saison 2027" className={inputCls} />
            </label>
            <PhotoField label="Ajouter une photo" url={draft.cover.photoUrl} onChange={(url) => set('cover', { ...draft.cover, photoUrl: url })} />
          </Section>

          {!advanced && <>
          <Section title="Qui sommes-nous">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={draft.content.about.enabled}
                onChange={(e) => setContent((c) => ({ ...c, about: { ...c.about, enabled: e.target.checked } }))} />
              Afficher la page « qui sommes-nous »
            </label>
            {draft.content.about.enabled && (
              <>
                <RichTextEditor initialValue={draft.content.about.html} onChange={(html) => setContent((c) => ({ ...c, about: { ...c.about, html } }))}
                  ariaLabel="Texte de la page qui sommes-nous" placeholder="Votre histoire, votre cuisine, votre équipe…" minHeight="100px" />
                <PhotoField label="Ajouter une photo" url={draft.content.about.photoUrl}
                  onChange={(url) => setContent((c) => ({ ...c, about: { ...c.about, photoUrl: url } }))} />
              </>
            )}
          </Section>

          <Section title="Prestations">
            {draft.content.sections.length === 0 && <p className="text-sm text-gray-500">Ajoutez des prestations de votre catalogue : elles sont rangées par catégorie, que vous pouvez renommer et ordonner.</p>}
            {draft.content.sections.map((s, si) => (
              <div key={s.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-1">
                  <input value={s.title} aria-label="Titre de la section" maxLength={120}
                    onChange={(e) => setContent((c) => ({ ...c, sections: c.sections.map((x, i) => (i === si ? { ...x, title: e.target.value } : x)) }))}
                    className={cn(inputCls, 'py-1.5 font-medium')} />
                  <button type="button" className={iconBtn} aria-label="Monter la section" onClick={() => setContent((c) => ({ ...c, sections: move(c.sections, si, -1) }))}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" className={iconBtn} aria-label="Descendre la section" onClick={() => setContent((c) => ({ ...c, sections: move(c.sections, si, 1) }))}><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" className={iconBtnDanger} aria-label="Retirer la section"
                    onClick={() => setContent((c) => ({ ...c, sections: c.sections.filter((_, i) => i !== si) }))}><Trash2 className="h-4 w-4" /></button>
                </div>
                <ul className="space-y-1">
                  {s.items.map((item: BrochureItem, ii) => {
                    const p = byId.get(item.prestationId);
                    const setItems = (fn: (items: BrochureItem[]) => BrochureItem[]) =>
                      setContent((c) => ({ ...c, sections: c.sections.map((x, i) => (i === si ? { ...x, items: fn(x.items) } : x)) }));
                    return (
                      <li key={`${item.prestationId}-${ii}`} className="flex items-center gap-1 text-sm">
                        <span className={cn('flex-1 min-w-0 truncate', !p && 'line-through text-red-700')}>
                          {p ? p.name : 'Supprimée du catalogue'}{item.html && p && <span className="text-gray-400"> · retouchée</span>}
                        </span>
                        {p && <button type="button" className={iconBtn} aria-label={`Retoucher « ${p.name} »`} onClick={() => setRetouch({ section: si, item: ii })}><Pencil className="h-4 w-4" /></button>}
                        <button type="button" className={iconBtn} aria-label="Monter" onClick={() => setItems((items) => move(items, ii, -1))}><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" className={iconBtn} aria-label="Descendre" onClick={() => setItems((items) => move(items, ii, 1))}><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" className={iconBtnDanger} aria-label={`Retirer « ${p?.name ?? 'prestation supprimée'} »`} onClick={() => setItems((items) => items.filter((_, i) => i !== ii))}><Trash2 className="h-4 w-4" /></button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPicking(true)} className={btnSecondary}><Plus className="h-4 w-4" /> Ajouter des prestations</button>
              <button type="button" onClick={() => setContent((c) => ({ ...c, sections: [...c.sections, { id: newId(), title: 'Nouvelle section', items: [] }] }))} className={btnSecondary}>Nouvelle section</button>
            </div>
          </Section>

          <Section title="Dernières pages">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={draft.content.contact.enabled}
                onChange={(e) => setContent((c) => ({ ...c, contact: { enabled: e.target.checked } }))} />
              Afficher la page contact
            </label>
            <p className="text-sm text-gray-500">Le formulaire de demande est toujours la dernière page.</p>
          </Section>
          </>}
        </div>

        {advanced ? (
          <div className="order-1 xl:order-2 min-w-0">
            <AdvancedEditor layout={layout} onChange={setLayout} catalog={catalog} company={company}
              settings={{
                style: draft.style, language: draft.language, cover: draft.cover, about: draft.content.about,
                prices: { show: draft.show_prices, mode: draft.price_mode, vatRate: draft.vat_rate },
              }} />
          </div>
        ) : (

        <div className="min-w-0 overflow-hidden lg:sticky lg:top-4 flex justify-center rounded-2xl bg-[#EDE6DA] py-5">
          <Flipbook
            ariaLabel="Aperçu de la brochure"
            allowDouble={false}
            reserved={180}
            pages={pages.map((page, i) => (
              <BrochurePageView key={i} page={page} style={draft.style} cover={draft.cover} company={company} language={draft.language}
                about={draft.content.about}
                formSlot={<p className="text-sm text-gray-500">Le formulaire de demande s’affiche ici pour le lecteur.</p>} />
            ))}
          />
        </div>
        )}
      </div>

      {choosing && (
        <Modal title="Reprendre la mise en page avancée ?" onClose={() => setChoosing(false)}
          footer={<div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={switching} onClick={() => switchTo('advanced', false)} className={btnSecondary}>Repartir de la mise en page simple</button>
            <button type="button" disabled={switching} onClick={() => switchTo('advanced', true)} className={btnPrimary}>Reprendre ma mise en page avancée</button>
          </div>}>
          <p className="text-sm text-gray-700">Cette brochure a déjà une mise en page avancée. Vous pouvez la reprendre telle que vous l’aviez laissée (les prestations ajoutées entre-temps sont mises à la suite), ou repartir de la composition simple actuelle.</p>
        </Modal>
      )}
      {sending && <SendBrochureModal brochureId={brochure.id} onClose={() => setSending(false)} />}
      {picking && <PrestationPicker catalog={catalog} already={inBrochure} onAdd={addPrestations} onClose={() => setPicking(false)} />}
      {retouch && retouched && retouchedPrestation && (
        <ItemRetouch item={retouched} prestation={retouchedPrestation} language={draft.language} onClose={() => setRetouch(null)}
          onSave={(item) => {
            setContent((c) => ({ ...c, sections: c.sections.map((x, i) => (i === retouch.section ? { ...x, items: x.items.map((it, j) => (j === retouch.item ? item : it)) } : x)) }));
            setRetouch(null);
          }} />
      )}
    </div>
  );
}
