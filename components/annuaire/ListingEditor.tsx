'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Hourglass, Loader2, PencilLine, ShieldAlert, XCircle } from 'lucide-react';
import { btnPrimary, cardCls, inputCls, labelCls } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import { DEPARTMENTS, departmentOfPostalCode } from '@/lib/annuaire/departments';
import { EVENT_TYPES } from '@/lib/annuaire/eventTypes';
import {
  DESCRIPTION_MAX, DESCRIPTION_MIN_TO_SUBMIT, NAME_MAX, TAGLINE_MAX, cleanListing, readyToSubmit, type ListingInput,
} from '@/lib/annuaire/listing';
import { inputOf } from '@/lib/annuaire/listingForm';
import {
  saveListing, setListingBrochures, submitListing, withdrawListing, type MyListing,
} from '@/server/directoryListing';
import ListingPhotos from './ListingPhotos';
import ListingPreviewCard from './ListingPreviewCard';

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={cn(cardCls, 'p-4 sm:p-5')}>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-gray-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function StatusBanner({ listing }: { listing: MyListing }) {
  const { status, refusedReason, publicUrl } = listing;
  const tone = {
    brouillon: { icon: PencilLine, box: 'border-gray-200 bg-white', ink: 'text-gray-500' },
    en_attente: { icon: Hourglass, box: 'border-primary-200 bg-primary-50', ink: 'text-primary' },
    publiee: { icon: CheckCircle2, box: 'border-sage bg-sage-100', ink: 'text-forest' },
    refusee: { icon: XCircle, box: 'border-danger/30 bg-white', ink: 'text-danger' },
    suspendue: { icon: ShieldAlert, box: 'border-danger/30 bg-white', ink: 'text-danger' },
  }[status];
  const Icon = tone.icon;
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-4', tone.box)} role="status">
      <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', tone.ink)} aria-hidden />
      <div className="min-w-0 space-y-1 text-sm text-gray-700">
        {status === 'brouillon' && (<>
          <p className="font-semibold text-gray-900">Votre fiche n’est pas encore en ligne.</p>
          <p>Remplissez-la, puis publiez-la : elle apparaîtra dans l’annuaire.</p>
        </>)}
        {status === 'en_attente' && (<>
          <p className="font-semibold text-gray-900">Votre fiche est en cours de vérification.</p>
          <p>Notre équipe la relit avant de la mettre en ligne. Vous pouvez continuer à la modifier en attendant.</p>
        </>)}
        {status === 'publiee' && (<>
          <p className="font-semibold text-gray-900">Votre fiche est en ligne.</p>
          {publicUrl && (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 break-all font-medium text-forest underline underline-offset-2">
              {publicUrl.replace(/^https?:\/\//, '')} <ExternalLink className="h-4 w-4 flex-shrink-0" aria-hidden />
            </a>
          )}
        </>)}
        {status === 'refusee' && (<>
          <p className="font-semibold text-gray-900">Votre fiche a été refusée.</p>
          {refusedReason && <p className="break-words">Motif : {refusedReason}</p>}
          <p>Corrigez-la, puis envoyez-la de nouveau : elle repartira en vérification.</p>
        </>)}
        {status === 'suspendue' && (<>
          <p className="font-semibold text-gray-900">Votre fiche est suspendue.</p>
          {refusedReason && <p className="break-words">Motif : {refusedReason}</p>}
          <p>Elle ne peut pas être renvoyée en ligne depuis cet écran : écrivez à l’équipe WeboDevis pour en parler.</p>
        </>)}
      </div>
    </div>
  );
}

/** Formulaire de la fiche. Le formulaire garde sa propre saisie : `reload` rafraîchit l'état enregistré sans la remplacer. */
export default function ListingEditor({ listing, reload }: { listing: MyListing; reload: () => Promise<MyListing | null> }) {
  const { confirm, notify } = useFeedback();
  const [form, setForm] = useState<ListingInput>(() => inputOf(listing.fields));
  const [chosen, setChosen] = useState<string[]>(() => listing.brochures.filter((b) => b.selected).map((b) => b.brochureId));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const text = (key: Exclude<keyof ListingInput, 'departments' | 'eventTypes'>) => ({
    value: form[key], onChange: (e: { target: { value: string } }) => set(key, e.target.value),
  });
  const toggle = (key: 'departments' | 'eventTypes', value: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));

  // Le département du code postal est coché d'office.
  const setPostalCode = (value: string) => setForm((f) => {
    const code = departmentOfPostalCode(value.replace(/\s/g, ''));
    return { ...f, postalCode: value, departments: code && !f.departments.includes(code) ? [...f.departments, code] : f.departments };
  });

  const { fields } = cleanListing(form);
  const missing = listing.status === 'suspendue' ? null : readyToSubmit(fields, listing.photos.length);
  const status = listing.status;
  const publishes = !missing && (status === 'brouillon' || status === 'refusee');
  const coverUrl = listing.photos.find((p) => p.id === listing.coverPhotoId)?.url ?? listing.photos[0]?.url ?? null;
  const shownDepartments = DEPARTMENTS.filter((d) => !search.trim() || plain(`${d.code} ${d.name}`).includes(plain(search.trim())));

  /** Enregistre les champs puis les brochures choisies. Les erreurs sont déjà montrées. */
  const persist = async (): Promise<boolean> => {
    const res = await saveListing(form).catch(() => ({ error: 'La fiche n’a pas pu être enregistrée. Réessayez.' }));
    if (res.error) { notify(res.error, { tone: 'error' }); return false; }
    if (listing.brochures.length) {
      const b = await setListingBrochures(chosen).catch(() => ({ error: 'Les brochures n’ont pas pu être enregistrées. Réessayez.' }));
      if (b.error) { notify(b.error, { tone: 'error' }); return false; }
    }
    return true;
  };

  const ensureSaved = async () => {
    if (listing.slug) return true;
    const ok = await persist();
    if (ok) await reload();
    return ok;
  };

  const save = async () => {
    setSaving(true);
    try {
      if (!(await persist())) return;
      if (publishes) {
        const res = await submitListing().catch(() => ({ error: 'La fiche n’a pas pu être envoyée. Réessayez.', status: undefined }));
        await reload();
        if (res.error) { notify(`Fiche enregistrée, mais pas publiée. ${res.error}`, { tone: 'error' }); return; }
        notify(res.status === 'publiee'
          ? 'Votre fiche est en ligne dans l’annuaire.'
          : 'Votre fiche est enregistrée. Notre équipe la vérifie avant de la mettre en ligne.', { tone: 'success' });
        return;
      }
      const fresh = await reload();
      if (status === 'publiee' && fresh?.status === 'brouillon') {
        notify('Fiche enregistrée. Comme le SIRET a changé, elle n’est plus en ligne tant qu’elle n’est pas vérifiée de nouveau : publiez-la quand elle est prête.');
      } else if (status === 'en_attente' && fresh?.status === 'brouillon') {
        notify('Fiche enregistrée. Comme le SIRET a changé, elle doit être vérifiée de nouveau : publiez-la quand elle est prête.');
      } else {
        notify('Fiche enregistrée.', { tone: 'success' });
      }
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async () => {
    if (!(await confirm({
      title: 'Retirer ma fiche ?',
      message: 'Elle disparaît de l’annuaire. Vos informations et vos photos sont conservées : vous pourrez la publier de nouveau.',
      danger: true, confirmLabel: 'Retirer',
    }))) return;
    const res = await withdrawListing().catch(() => ({ error: 'La fiche n’a pas pu être retirée. Réessayez.' }));
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    await reload();
    notify('Votre fiche est retirée de l’annuaire.', { tone: 'success' });
  };

  const descLen = (form.description ?? '').trim().length;
  const chip = 'inline-flex h-11 items-center rounded-full border px-4 text-[15px] font-medium transition-colors';

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Entrée dans un champ d'une ligne (la recherche de département comprise) n'envoie pas la fiche : seul le bouton le fait. */}
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (!saving) void save(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault(); }}
        className="min-w-0 space-y-4">
        <StatusBanner listing={listing} />

        {missing && <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{missing}</p>}

        <Section title="Identité">
          <div className="space-y-4">
            <Field id="fiche-nom" label="Nom de l’entreprise">
              <input id="fiche-nom" maxLength={NAME_MAX} autoComplete="organization" className={inputCls} {...text('displayName')} />
            </Field>
            <Field id="fiche-accroche" label="Accroche" hint="Une phrase qui donne envie, affichée sous votre nom.">
              <input id="fiche-accroche" maxLength={TAGLINE_MAX} placeholder="Cuisine de saison pour vos mariages et réceptions" className={inputCls} {...text('tagline')} />
            </Field>
            <Field id="fiche-presentation" label="Présentation"
              hint={`Votre cuisine, votre façon de travailler, ce qui vous distingue. Au moins ${DESCRIPTION_MIN_TO_SUBMIT} caractères pour publier.`}>
              <textarea id="fiche-presentation" rows={7} maxLength={DESCRIPTION_MAX} className={cn(inputCls, 'h-auto py-3 leading-relaxed')} {...text('description')} />
              <p className={cn('mt-1 text-right text-xs tabular-nums', descLen > 0 && descLen < DESCRIPTION_MIN_TO_SUBMIT ? 'text-primary' : 'text-gray-500')} aria-live="polite">
                {descLen} / {DESCRIPTION_MAX} caractères
              </p>
            </Field>
          </div>
        </Section>

        <Section title="Où vous intervenez">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="fiche-ville" label="Ville">
              <input id="fiche-ville" autoComplete="address-level2" maxLength={80} className={inputCls} {...text('city')} />
            </Field>
            <Field id="fiche-cp" label="Code postal">
              <input id="fiche-cp" inputMode="numeric" autoComplete="postal-code" maxLength={5} className={inputCls}
                value={form.postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </Field>
          </div>
          <fieldset className="mt-5">
            <legend className={labelCls}>Départements desservis</legend>
            <label htmlFor="fiche-dep-recherche" className="sr-only">Rechercher un département</label>
            <input id="fiche-dep-recherche" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un département" className={inputCls} />
            <p className="mt-2 text-sm text-gray-500" aria-live="polite">
              {form.departments.length === 0 ? 'Aucun département choisi.' : `${form.departments.length} département${form.departments.length > 1 ? 's' : ''} choisi${form.departments.length > 1 ? 's' : ''}.`}
            </p>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-gray-200">
              {shownDepartments.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Aucun département ne correspond à « {search.trim()} ».</p>
              ) : (
                <ul className="grid sm:grid-cols-2">
                  {shownDepartments.map((d) => (
                    <li key={d.code}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm text-gray-800 hover:bg-gray-50">
                        <input type="checkbox" className="h-5 w-5 flex-shrink-0 accent-primary" checked={form.departments.includes(d.code)} onChange={() => toggle('departments', d.code)} />
                        <span className="min-w-0"><span className="tabular-nums text-gray-500">{d.code}</span> {d.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </fieldset>
        </Section>

        <Section title="Vos événements" hint="Choisissez ceux que vous organisez.">
          <fieldset>
            <legend className="sr-only">Types d’événements</legend>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((t) => {
                const on = form.eventTypes.includes(t);
                return (
                  <button key={t} type="button" aria-pressed={on} onClick={() => toggle('eventTypes', t)}
                    className={cn(chip, on ? 'border-forest bg-forest text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300')}>
                    {t}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </Section>

        <Section title="Repères pour vos clients" hint="Facultatif, mais ces informations aident à choisir.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="fiche-min" label="Convives au minimum">
              <input id="fiche-min" inputMode="numeric" className={inputCls} {...text('guestsMin')} />
            </Field>
            <Field id="fiche-max" label="Convives au maximum">
              <input id="fiche-max" inputMode="numeric" className={inputCls} {...text('guestsMax')} />
            </Field>
            <Field id="fiche-prix" label="Prix de départ par personne, en €">
              <input id="fiche-prix" inputMode="decimal" placeholder="45" className={inputCls} {...text('priceFrom')} />
            </Field>
            <Field id="fiche-site" label="Site web">
              <input id="fiche-site" inputMode="url" autoComplete="url" placeholder="https://" className={inputCls} {...text('websiteUrl')} />
            </Field>
          </div>
        </Section>

        <Section title="SIRET" hint="Nous le vérifions auprès de l’annuaire des entreprises de l’État. Il n’apparaît pas sur votre fiche.">
          <Field id="fiche-siret" label="Numéro SIRET (14 chiffres)">
            <input id="fiche-siret" inputMode="numeric" maxLength={20} className={cn(inputCls, 'sm:max-w-xs')} {...text('siret')} />
          </Field>
        </Section>

        <Section title="Photos" hint="Elles donnent envie avant même de lire. Vous pouvez en choisir plusieurs d’un coup.">
          <ListingPhotos photos={listing.photos} coverPhotoId={listing.coverPhotoId} ensureSaved={ensureSaved} onChange={async () => { await reload(); }} />
        </Section>

        <Section title="Brochures à afficher" hint="Les visiteurs pourront demander celles que vous cochez. Leurs demandes arrivent dans Prospects.">
          {listing.brochures.length === 0 ? (
            <p className="text-sm text-gray-500">
              Vous n’avez pas encore de brochure. <Link href="/brochures" className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-2">Créer une brochure</Link>
            </p>
          ) : (
            <fieldset>
              <legend className="sr-only">Brochures à afficher sur la fiche</legend>
              <ul className="space-y-1">
                {listing.brochures.map((b) => (
                  <li key={b.brochureId}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-[15px] text-gray-800 hover:bg-gray-50">
                      <input type="checkbox" className="h-5 w-5 flex-shrink-0 accent-primary" checked={chosen.includes(b.brochureId)}
                        onChange={() => setChosen((c) => (c.includes(b.brochureId) ? c.filter((i) => i !== b.brochureId) : [...c, b.brochureId]))} />
                      <span className="min-w-0 break-words">{b.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
        </Section>

        {status === 'publiee' && (
          <Section title="Les 30 derniers jours">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Visites de votre fiche</dt>
                <dd className="text-2xl font-semibold tabular-nums text-gray-900">{listing.stats.views30}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Demandes reçues</dt>
                <dd className="text-2xl font-semibold tabular-nums text-gray-900">{listing.stats.requests30}</dd>
              </div>
            </dl>
          </Section>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="submit" disabled={saving} className={cn(btnPrimary, 'w-full sm:w-auto')}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {!publishes ? 'Enregistrer' : status === 'refusee' ? 'Enregistrer et renvoyer' : 'Enregistrer et publier'}
          </button>
          {(status === 'publiee' || status === 'en_attente') && (
            <button type="button" onClick={withdraw} disabled={saving}
              className="inline-flex min-h-11 items-center justify-center px-2 text-sm text-gray-500 underline underline-offset-2 hover:text-danger">
              Retirer ma fiche
            </button>
          )}
        </div>
      </form>

      <aside className="sticky top-6 hidden lg:block" aria-label="Aperçu de votre fiche">
        <p className="mb-2 text-sm font-medium text-gray-700">Aperçu dans l’annuaire</p>
        <ListingPreviewCard fields={fields} coverUrl={coverUrl} />
      </aside>
    </div>
  );
}
