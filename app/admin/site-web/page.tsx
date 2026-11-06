'use client';

// Contenu de l'onglet « Site web » des traiteurs : packs, options, réalisations et bloc logiciel. Enregistré dans
// app_settings (server/siteWeb.ts) ; la page des traiteurs le lit tel quel.

import { useEffect, useState } from 'react';
import { ImageUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFeedback } from '@/components/ui/Feedback';
import { btnPrimary, btnSecondary, cardCls, errorCls, iconBtnDanger, inputCls, labelCls } from '@/components/ui/kit';
import { createClient } from '@/lib/supabase/client';
import { fileToWebp } from '@/lib/imageToWebp';
import { cn } from '@/lib/utils';
import type { SiteCatalog, SiteOption, SitePack, SiteWork } from '@/lib/siteWeb';
import { getSiteWebCatalogAdmin, saveSiteWebCatalog } from '@/server/siteWeb';

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const area = cn(inputCls, 'h-auto py-2.5');

export default function AdminSiteWebPage() {
  const [c, setC] = useState<SiteCatalog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useFeedback();

  useEffect(() => { getSiteWebCatalogAdmin().then(setC); }, []);
  if (!c) return <div className="flex justify-center py-20 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const setPack = (i: number, patch: Partial<SitePack>) => setC({ ...c, packs: c.packs.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setOption = (i: number, patch: Partial<SiteOption>) => setC({ ...c, options: c.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const setWork = (i: number, patch: Partial<SiteWork>) => setC({ ...c, works: c.works.map((w, j) => (j === i ? { ...w, ...patch } : w)) });

  const save = async () => {
    setBusy(true); setError(null);
    const res = await saveSiteWebCatalog(c).catch(() => ({ error: 'L’enregistrement a échoué. Réessayez.' }));
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    // Relu tel qu'enregistré (nettoyé).
    setC(await getSiteWebCatalogAdmin());
    notify('Onglet Site web enregistré.');
  };

  return (
    <div className="px-4 md:px-6 pb-8 max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Onglet Site web</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ce que les traiteurs voient dans l’onglet « Site web ». Les demandes arrivent dans Demandes.</p>
        </div>
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
      </div>
      {error && <p role="alert" className={errorCls}>{error}</p>}

      <section className={cn(cardCls, 'p-5 space-y-4')}>
        <h2 className="text-lg font-semibold text-gray-900">Packs</h2>
        {c.packs.map((p, i) => (
          <div key={i} className="rounded-2xl bg-gray-50 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
              <Field label="Nom"><input value={p.name} onChange={(e) => setPack(i, { name: e.target.value })} className={inputCls} /></Field>
              <Field label="Prix"><input value={p.price} onChange={(e) => setPack(i, { price: e.target.value })} placeholder="1 500 € ou Sur devis" className={inputCls} /></Field>
              <button type="button" onClick={() => setC({ ...c, packs: c.packs.filter((_, j) => j !== i) })} className={iconBtnDanger} aria-label={`Retirer le pack ${p.name}`}><Trash2 className="h-4 w-4" /></button>
            </div>
            <Field label="Phrase"><input value={p.pitch} onChange={(e) => setPack(i, { pitch: e.target.value })} className={inputCls} /></Field>
            <Field label="Ce qui est compris (une ligne par point)">
              <textarea rows={4} value={p.features.join('\n')} onChange={(e) => setPack(i, { features: e.target.value.split('\n') })} onBlur={(e) => setPack(i, { features: lines(e.target.value) })} className={area} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={p.featured} onChange={(e) => setC({ ...c, packs: c.packs.map((x, j) => ({ ...x, featured: j === i ? e.target.checked : e.target.checked ? false : x.featured })) })} />
              Mis en avant (« Le plus demandé »)
            </label>
          </div>
        ))}
        {c.packs.length < 4 && <button type="button" onClick={() => setC({ ...c, packs: [...c.packs, { key: '', name: '', price: '', pitch: '', features: [], featured: false }] })} className={btnSecondary}><Plus className="h-4 w-4" />Ajouter un pack</button>}
      </section>

      <section className={cn(cardCls, 'p-5 space-y-4')}>
        <h2 className="text-lg font-semibold text-gray-900">Options <span className="text-sm font-normal text-gray-500">(sans prix)</span></h2>
        {c.options.map((o, i) => (
          <div key={i} className="grid gap-3 rounded-2xl bg-gray-50 p-4 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
            <Field label="Nom"><input value={o.name} onChange={(e) => setOption(i, { name: e.target.value })} className={inputCls} /></Field>
            <Field label="Texte"><input value={o.text} onChange={(e) => setOption(i, { text: e.target.value })} className={inputCls} /></Field>
            <button type="button" onClick={() => setC({ ...c, options: c.options.filter((_, j) => j !== i) })} className={iconBtnDanger} aria-label={`Retirer l’option ${o.name}`}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setC({ ...c, options: [...c.options, { key: '', name: '', text: '' }] })} className={btnSecondary}><Plus className="h-4 w-4" />Ajouter une option</button>
      </section>

      <section className={cn(cardCls, 'p-5 space-y-4')}>
        <h2 className="text-lg font-semibold text-gray-900">Réalisations</h2>
        {c.works.map((w, i) => (
          <div key={i} className="rounded-2xl bg-gray-50 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <Field label="Nom"><input value={w.name} onChange={(e) => setWork(i, { name: e.target.value })} className={inputCls} /></Field>
              <Field label="Adresse du site"><input value={w.url} onChange={(e) => setWork(i, { url: e.target.value })} placeholder="https://" className={inputCls} /></Field>
              <button type="button" onClick={() => setC({ ...c, works: c.works.filter((_, j) => j !== i) })} className={iconBtnDanger} aria-label={`Retirer ${w.name}`}><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Capture label="Capture ordinateur" url={w.image} onChange={(image) => setWork(i, { image })} />
              <Capture label="Capture téléphone" url={w.mobileImage} onChange={(mobileImage) => setWork(i, { mobileImage })} />
            </div>
            <Field label="Pastilles (séparées par des virgules)">
              <input value={w.tags.join(', ')} onChange={(e) => setWork(i, { tags: e.target.value.split(',').map((t) => t.trimStart()) })} className={inputCls} />
            </Field>
          </div>
        ))}
        <button type="button" onClick={() => setC({ ...c, works: [...c.works, { key: '', name: '', url: 'https://', image: '', mobileImage: '', tags: [] }] })} className={btnSecondary}><Plus className="h-4 w-4" />Ajouter une réalisation</button>
      </section>

      <section className={cn(cardCls, 'p-5 space-y-3')}>
        <h2 className="text-lg font-semibold text-gray-900">Logiciels sur mesure</h2>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field label="Titre"><input value={c.software.title} onChange={(e) => setC({ ...c, software: { ...c.software, title: e.target.value } })} className={inputCls} /></Field>
          <Field label="Prix"><input value={c.software.price} onChange={(e) => setC({ ...c, software: { ...c.software, price: e.target.value } })} className={inputCls} /></Field>
        </div>
        <Field label="Texte"><textarea rows={2} value={c.software.text} onChange={(e) => setC({ ...c, software: { ...c.software, text: e.target.value } })} className={area} /></Field>
        <Field label="Exemples de besoins (un par ligne, aucun client réel)">
          <textarea rows={3} value={c.software.examples.join('\n')} onChange={(e) => setC({ ...c, software: { ...c.software, examples: e.target.value.split('\n') } })} className={area} />
        </Field>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className={labelCls}>{label}</span>{children}</label>;
}

/** Une capture : adresse, ou image envoyée depuis l'appareil (convertie en WebP). */
function Capture({ label, url, onChange }: { label: string; url: string; onChange: (url: string) => void }) {
  const { user } = useAuth();
  const { notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  const upload = async (original: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const file = await fileToWebp(original, { maxDim: 1600 });
      // Chemin préfixé par l'identifiant du compte : exigé par le stockage.
      const path = `${user.id}/site-web/${Date.now()}-${crypto.randomUUID()}.${file.name.split('.').pop()}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from('storage').upload(path, file, { upsert: false });
      if (error) throw error;
      onChange(supabase.storage.from('storage').getPublicUrl(path).data.publicUrl);
    } catch {
      notify('La capture n’a pas pu être envoyée. Réessayez.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" className="h-16 w-24 flex-shrink-0 rounded-lg bg-white object-cover object-top" /> : <span className="h-16 w-24 flex-shrink-0 rounded-lg bg-white" />}
        <label className={cn(btnSecondary, 'cursor-pointer')}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}Envoyer
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
        </label>
      </div>
    </div>
  );
}
