'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, CalendarDays, CalendarPlus, Check, Clock, Download, Loader2, Mail, MapPin, Phone, ShoppingBasket, Users, X } from 'lucide-react';
import { respondToMission, setUnavailableDates, subscribeExtraDevice, unsubscribeDevice as forgetDevice, type MissionPage } from '@/server/missions';
import { currentSubscription, isStandalone, pushSupport, subscribeDevice, unsubscribeDevice, type PushSupport } from '@/lib/pushClient';
import { missionStatus } from '@/lib/extras';
import { cn } from '@/lib/utils';

type Mission = MissionPage['missions'][number];
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const today = () => new Date().toISOString().slice(0, 10);
const longDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const btn = 'inline-flex items-center justify-center gap-2 h-12 px-4 rounded-2xl text-[15px] font-semibold transition-colors disabled:opacity-50';

export default function MissionsApp({ token, initial }: { token: string; initial: MissionPage }) {
  const router = useRouter();
  const [missions, setMissions] = useState(initial.missions);
  const [unavailable, setUnavailable] = useState(initial.extra.unavailableDates);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setMissions(initial.missions); setUnavailable(initial.extra.unavailableDates); }, [initial]);

  // Retour sur l'app (depuis une notification, ou après un moment) : les missions sont rechargées.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') router.refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [router]);

  const upcoming = missions.filter((m) => m.eventDate >= today());
  const past = missions.filter((m) => m.eventDate < today()).reverse();
  const pending = upcoming.filter((m) => m.status === 'a_solliciter').length;
  const first = initial.extra.name.trim().split(/\s+/)[0];

  const answer = async (m: Mission, value: 'confirme' | 'refuse') => {
    if (value === 'refuse' && m.status === 'confirme' && !confirm('Vous ne pourrez plus venir ? Votre traiteur sera prévenu tout de suite.')) return;
    setBusy(m.id); setError(null);
    const previous = missions;
    setMissions((list) => list.map((x) => (x.id === m.id ? { ...x, status: value, respondedAt: new Date().toISOString() } : x)));
    const res = await respondToMission(token, m.id, value).catch(() => ({ error: 'Votre réponse n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.' }));
    setBusy(null);
    if (res.error) { setMissions(previous); setError(res.error); }
  };

  return (
    <div className="min-h-screen bg-page">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-10 space-y-5">
        <header className="rounded-3xl bg-forest text-white p-5">
          <p className="text-sm text-white/70">Missions de {initial.company.name}</p>
          <h1 className="text-2xl font-bold mt-0.5">Bonjour {first}</h1>
          <p className="text-[15px] text-white/80 mt-1">
            {pending > 0 ? `${pending} mission${pending > 1 ? 's' : ''} attend${pending > 1 ? 'ent' : ''} votre réponse.` : upcoming.length > 0 ? `${upcoming.length} mission${upcoming.length > 1 ? 's' : ''} à venir.` : 'Aucune mission à venir pour le moment.'}
          </p>
          {(initial.company.phone || initial.company.email) && (
            <div className="flex gap-2 mt-4">
              {initial.company.phone && (
                <a href={`tel:${initial.company.phone.replace(/\s/g, '')}`} className={cn(btn, 'h-11 flex-1 bg-white/10 hover:bg-white/15 text-white')}><Phone className="h-4 w-4" />Appeler</a>
              )}
              {initial.company.email && (
                <a href={`mailto:${initial.company.email}`} className={cn(btn, 'h-11 flex-1 bg-white/10 hover:bg-white/15 text-white')}><Mail className="h-4 w-4" />Écrire</a>
              )}
            </div>
          )}
        </header>

        <InstallCard token={token} />

        {error && <p role="alert" className="text-sm text-danger bg-white border border-danger/30 rounded-2xl px-4 py-3">{error}</p>}

        <section aria-labelledby="a-venir" className="space-y-3">
          <h2 id="a-venir" className="text-lg font-semibold text-gray-900">À venir</h2>
          {upcoming.length === 0 ? (
            <p className="rounded-2xl bg-white border border-gray-200 px-5 py-8 text-center text-[15px] text-gray-600">
              Vos prochaines missions apparaîtront ici. {isStandaloneSafe() ? 'Vous serez prévenu par notification.' : 'Installez cette page pour être prévenu.'}
            </p>
          ) : upcoming.map((m) => (
            <MissionCard key={m.id} m={m} token={token} busy={busy === m.id} onAnswer={(v) => answer(m, v)} conflict={unavailable.includes(m.eventDate)} />
          ))}
        </section>

        <Unavailability token={token} dates={unavailable} onChange={setUnavailable} missions={upcoming} />

        {past.length > 0 && (
          <section aria-labelledby="passees" className="space-y-2">
            <h2 id="passees" className="text-lg font-semibold text-gray-900">Ces derniers jours</h2>
            {past.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-gray-200 px-4 py-3">
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-gray-900 truncate">{m.eventType || 'Événement'}</span>
                  <span className="block text-sm text-gray-500 first-letter:uppercase">{longDate(m.eventDate)}</span>
                </span>
                <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', missionStatus(m.status).tone)}>{missionStatus(m.status).label}</span>
              </div>
            ))}
          </section>
        )}

        <p className="text-center text-xs text-gray-500 pt-2">Page personnelle : ne partagez pas ce lien.</p>
      </div>
    </div>
  );
}

const isStandaloneSafe = () => typeof window !== 'undefined' && isStandalone();

function MissionCard({ m, token, busy, onAnswer, conflict }: { m: Mission; token: string; busy: boolean; onAnswer: (v: 'confirme' | 'refuse') => void; conflict: boolean }) {
  const st = missionStatus(m.status);
  const hours = m.arrival ? (m.departure ? `${m.arrival} à ${m.departure}` : `Arrivée à ${m.arrival}`) : null;
  return (
    <article className={cn('rounded-3xl bg-white border overflow-hidden', m.status === 'a_solliciter' ? 'border-primary/40 shadow-sm' : 'border-gray-200')}>
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary first-letter:uppercase">{longDate(m.eventDate)}</p>
          <h3 className="text-lg font-semibold text-gray-900 leading-snug">{m.eventType || 'Événement'}</h3>
          {m.clientName && <p className="text-sm text-gray-600">{m.clientName}</p>}
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0', st.tone)}>{st.label}</span>
      </div>

      <div className="px-5 pb-4 space-y-2 text-[15px] text-gray-800">
        {hours && <p className="flex items-center gap-2.5"><Clock className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden />{hours}</p>}
        {m.location && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(m.location)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2.5 underline decoration-gray-300 underline-offset-2">
            <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden />{m.location}<span className="sr-only"> (itinéraire)</span>
          </a>
        )}
        {m.guestCount > 0 && <p className="flex items-center gap-2.5"><Users className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden />{m.guestCount} couverts</p>}
        {m.notes && (
          <div className="mt-2 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900 mb-0.5">Consignes</p>
            <p className="text-sm text-amber-900 whitespace-pre-line">{m.notes}</p>
          </div>
        )}
        {conflict && m.status !== 'refuse' && (
          <p className="text-sm text-danger">Vous avez indiqué ne pas être disponible ce jour-là.</p>
        )}
      </div>

      <div className="px-5 pb-5 space-y-2">
        {m.status === 'a_solliciter' && (
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
            <button onClick={() => onAnswer('confirme')} disabled={busy} className={cn(btn, 'bg-primary text-white hover:bg-primary-dark')}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Je suis disponible
            </button>
            <button onClick={() => onAnswer('refuse')} disabled={busy} className={cn(btn, 'bg-gray-100 text-gray-800 hover:bg-gray-200')}>
              <X className="h-4 w-4" />Je ne peux pas
            </button>
          </div>
        )}
        {m.status === 'refuse' && (
          <button onClick={() => onAnswer('confirme')} disabled={busy} className={cn(btn, 'w-full bg-gray-100 text-gray-800 hover:bg-gray-200')}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Finalement, je suis disponible
          </button>
        )}
        {m.courses && (
          <Link href={`/e/${token}/courses/${m.quoteId}`} className={cn(btn, 'w-full bg-forest text-white hover:bg-forest/90')}>
            <ShoppingBasket className="h-4 w-4" />Ma liste de courses
          </Link>
        )}
        {m.status !== 'refuse' && (
          <div className="flex flex-col gap-2">
            <a href={`/e/${token}/agenda/${m.id}`} className={cn(btn, 'h-11 w-full bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 text-sm')}>
              <CalendarPlus className="h-4 w-4" />Ajouter à mon agenda
            </a>
            {m.status === 'confirme' && (
              <button onClick={() => onAnswer('refuse')} disabled={busy} className="h-10 text-sm font-medium text-gray-600 underline underline-offset-2 hover:text-gray-900 disabled:opacity-50">
                Je ne peux plus venir
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/** Installer la page comme une app, puis activer les notifications. Disparaît quand tout est fait. */
function InstallCard({ token }: { token: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [support, setSupport] = useState<PushSupport>('unsupported');
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [ios, setIos] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setStandalone(isStandalone());
    setSupport(pushSupport());
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    currentSubscription().then((s) => setSubscribed(!!s)).catch(() => setSubscribed(false));
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === 'accepted') setMessage('C’est installé : ouvrez « Mes missions » depuis votre écran d’accueil.');
  };

  const enable = async () => {
    setWorking(true); setMessage(null);
    try {
      const { subscription, error } = await subscribeDevice();
      if (error || !subscription) { setMessage(error); return; }
      const res = await subscribeExtraDevice(token, subscription as never);
      if (res.error) { setMessage(res.error); return; }
      setSubscribed(true);
      setMessage('Notifications activées : vous serez prévenu de chaque nouvelle mission et la veille.');
    } catch {
      setMessage('Les notifications n’ont pas pu être activées. Réessayez.');
    } finally { setWorking(false); }
  };

  const disable = async () => {
    setWorking(true);
    const endpoint = await unsubscribeDevice();
    if (endpoint) await forgetDevice(endpoint).catch(() => undefined);
    setSubscribed(false); setWorking(false);
    setMessage('Notifications coupées sur ce téléphone.');
  };

  if (subscribed === null) return null;
  const showInstall = !standalone && (prompt || ios);
  const canPush = support === 'ok';

  if (subscribed && !showInstall) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-gray-200 px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-gray-700"><Bell className="h-4 w-4 text-sage" />Notifications activées sur ce téléphone</span>
        <button onClick={disable} disabled={working} className="text-sm font-medium text-gray-600 hover:text-gray-900 inline-flex items-center gap-1.5"><BellOff className="h-4 w-4" />Couper</button>
      </div>
    );
  }

  return (
    <section className="rounded-3xl bg-white border border-gray-200 p-5 space-y-3" aria-labelledby="installer">
      <h2 id="installer" className="text-[17px] font-semibold text-gray-900">Recevez vos missions en notification</h2>
      {showInstall && (
        ios ? (
          <ol className="text-[15px] text-gray-700 space-y-1.5 list-decimal pl-5">
            <li>Touchez le bouton Partager de Safari (le carré avec une flèche).</li>
            <li>Choisissez « Sur l’écran d’accueil », puis « Ajouter ».</li>
            <li>Ouvrez « Mes missions » depuis l’écran d’accueil et activez les notifications.</li>
          </ol>
        ) : (
          <>
            <p className="text-[15px] text-gray-700">Installez cette page sur votre téléphone : elle s’ouvre comme une app, directement sur vos missions.</p>
            <button onClick={install} className={cn(btn, 'w-full bg-forest text-white hover:bg-forest/90')}><Download className="h-4 w-4" />Installer l’app</button>
          </>
        )
      )}
      {canPush && !subscribed && (
        <>
          {!showInstall && <p className="text-[15px] text-gray-700">Soyez prévenu d’une nouvelle mission, d’un changement d’horaire et la veille de chaque mission.</p>}
          <button onClick={enable} disabled={working} className={cn(btn, 'w-full bg-primary text-white hover:bg-primary-dark')}>
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}Activer les notifications
          </button>
        </>
      )}
      {support === 'denied' && <p className="text-sm text-gray-600">Les notifications sont bloquées pour ce site : autorisez-les dans les réglages de votre navigateur.</p>}
      {support === 'unsupported' && !showInstall && <p className="text-sm text-gray-600">Ce navigateur ne permet pas les notifications. Gardez ce lien en favori : vos missions y sont toujours à jour.</p>}
      {message && <p role="status" className="text-sm text-gray-700">{message}</p>}
    </section>
  );
}

/** Jours où l'extra n'est pas disponible : le traiteur le voit avant de l'affecter. */
function Unavailability({ token, dates, onChange, missions }: { token: string; dates: string[]; onChange: (d: string[]) => void; missions: Mission[] }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missionDays = useMemo(() => new Set(missions.filter((m) => m.status !== 'refuse').map((m) => m.eventDate)), [missions]);

  const save = async (next: string[]) => {
    const previous = dates;
    onChange(next); setSaving(true); setError(null);
    const res = await setUnavailableDates(token, next).catch(() => ({ error: 'L’enregistrement a échoué. Réessayez.' }));
    setSaving(false);
    if (res.error) { onChange(previous); setError(res.error); }
  };

  return (
    <section aria-labelledby="indispo" className="rounded-3xl bg-white border border-gray-200 p-5 space-y-3">
      <div>
        <h2 id="indispo" className="text-[17px] font-semibold text-gray-900 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-gray-400" />Mes jours indisponibles</h2>
        <p className="text-sm text-gray-600 mt-0.5">Votre traiteur les voit avant de vous proposer une mission.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (value && !dates.includes(value)) save([...dates, value].sort()); setValue(''); }} className="flex gap-2">
        <input type="date" value={value} min={today()} onChange={(e) => setValue(e.target.value)} aria-label="Jour indisponible"
          className="flex-1 min-w-0 h-12 px-3 rounded-2xl border border-gray-200 bg-white text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button type="submit" disabled={!value || saving} className={cn(btn, 'bg-gray-900 text-white hover:bg-gray-800')}>Ajouter</button>
      </form>
      {dates.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {dates.map((d) => (
            <li key={d} className={cn('inline-flex items-center gap-1 h-10 pl-3 pr-1 rounded-full text-sm', missionDays.has(d) ? 'bg-danger/10 text-danger' : 'bg-gray-100 text-gray-800')}>
              <span className="first-letter:uppercase">{longDate(d)}</span>
              <button onClick={() => save(dates.filter((x) => x !== d))} aria-label={`Retirer ${longDate(d)}`} className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-black/5"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  );
}
