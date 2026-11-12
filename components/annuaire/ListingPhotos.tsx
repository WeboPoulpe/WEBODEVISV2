'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react';
import { btnSecondary, iconBtn, iconBtnDanger, inputCls, labelCls, pill } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { fileToWebp } from '@/lib/imageToWebp';
import { cn } from '@/lib/utils';
import { MAX_PHOTOS } from '@/lib/annuaire/config';
import { addListingPhoto, removeListingPhoto, reorderListingPhotos, setListingCover, updateListingPhotoAlt, type MyListing } from '@/server/directoryListing';

type Photo = MyListing['photos'][number];

// Cibles tactiles de 44 px (les boutons icône du kit font 40 px).
const touchIcon = 'w-11 h-11';

function PhotoRow({ photo, index, count, isCover, busy, onMove, onCover, onRemove, onAlt }: {
  photo: Photo; index: number; count: number; isCover: boolean; busy: boolean;
  onMove: (delta: -1 | 1) => void; onCover: () => void; onRemove: () => void; onAlt: (alt: string) => void;
}) {
  const [alt, setAlt] = useState(photo.alt ?? '');
  const id = `photo-alt-${photo.id}`;
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-3 sm:flex-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={alt || `Photo ${index + 1} de la fiche`} loading="lazy" className="aspect-[4/3] w-full rounded-xl bg-[#E6DFD3] object-cover sm:w-44 sm:flex-shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">Description de la photo</label>
          <input id={id} value={alt} maxLength={160} placeholder="Buffet de mariage dressé dans un jardin" className={inputCls}
            onChange={(e) => setAlt(e.target.value)}
            onBlur={() => { if (alt.trim() !== (photo.alt ?? '')) onAlt(alt); }} />
          <p className="mt-1 text-xs text-gray-500">Elle aide les personnes qui ne voient pas l’image, et le référencement.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {isCover
            ? <span className={cn(pill, 'h-11 bg-sage-100 px-3 text-sm text-forest')}><Star className="mr-1.5 h-4 w-4" aria-hidden /> Photo de couverture</span>
            : <button type="button" onClick={onCover} disabled={busy} className={btnSecondary}><Star className="h-4 w-4" aria-hidden /> Choisir comme couverture</button>}
          <span className="ml-auto flex items-center">
            <button type="button" onClick={() => onMove(-1)} disabled={busy || index === 0} className={cn(iconBtn, touchIcon)} aria-label={`Monter la photo ${index + 1}`}><ArrowUp className="h-4 w-4" /></button>
            <button type="button" onClick={() => onMove(1)} disabled={busy || index === count - 1} className={cn(iconBtn, touchIcon)} aria-label={`Descendre la photo ${index + 1}`}><ArrowDown className="h-4 w-4" /></button>
            <button type="button" onClick={onRemove} disabled={busy} className={cn(iconBtnDanger, touchIcon)} aria-label={`Supprimer la photo ${index + 1}`}><Trash2 className="h-4 w-4" /></button>
          </span>
        </div>
      </div>
    </li>
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Photos de la fiche : envoi de plusieurs fichiers, ordre, couverture, texte de remplacement, suppression. */
export default function ListingPhotos({ photos, coverPhotoId, ensureSaved, onChange }: {
  photos: Photo[];
  coverPhotoId: string | null;
  /** Les photos s'attachent à une fiche enregistrée : l'enregistre au besoin, renvoie false si elle n'a pas pu l'être. */
  ensureSaved: () => Promise<boolean>;
  onChange: () => Promise<void>;
}) {
  const { user } = useAuth();
  const { confirm, notify } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = busy || progress !== null;
  const room = MAX_PHOTOS - photos.length;

  const upload = async (picked: File[]) => {
    if (!user || !picked.length) return;
    if (room <= 0) { notify(`Une fiche compte ${MAX_PHOTOS} photos au plus.`, { tone: 'error' }); return; }
    const files = picked.slice(0, room);
    if (!(await ensureSaved())) return;
    const supabase = createClient();
    let sent = 0;
    let failed = 0;
    let serverError: string | null = null;
    setProgress({ done: 0, total: files.length });
    for (const original of files) {
      try {
        const file = await fileToWebp(original);
        const path = `${user.id}/annuaire/${Date.now()}-${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage.from('storage').upload(path, file, { upsert: false });
        if (error) throw error;
        const url = supabase.storage.from('storage').getPublicUrl(path).data.publicUrl;
        const res = await addListingPhoto({ url, path });
        if (res.error) { failed += 1; serverError = res.error; } else sent += 1;
      } catch {
        failed += 1;
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);
    await onChange();
    if (failed) {
      notify(serverError ?? `${plural(failed, 'Une photo n’a pas pu être envoyée', `${failed} photos n’ont pas pu être envoyées`)}. Vérifiez votre connexion et le poids des fichiers, puis réessayez.`, { tone: 'error' });
    } else if (picked.length > files.length) {
      notify(`${sent} ${plural(sent, 'photo ajoutée', 'photos ajoutées')} : une fiche compte ${MAX_PHOTOS} photos au plus.`);
    }
  };

  const run = async (action: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    const res = await action().catch(() => ({ error: 'L’action n’a pas pu aboutir. Réessayez.' }));
    if (res.error) notify(res.error, { tone: 'error' });
    await onChange();
    setBusy(false);
  };

  const move = (index: number, delta: -1 | 1) => {
    const ids = photos.map((p) => p.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    return run(() => reorderListingPhotos(ids));
  };

  const remove = async (photo: Photo) => {
    if (!(await confirm({ title: 'Supprimer cette photo ?', message: 'Elle disparaît de votre fiche.', danger: true }))) return;
    await run(() => removeListingPhoto(photo.id));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={locked || room <= 0} className={btnSecondary}>
          {progress ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
          {progress ? `Envoi ${Math.min(progress.done + 1, progress.total)} sur ${progress.total}…` : 'Ajouter des photos'}
        </button>
        <span className="text-sm text-gray-500">{photos.length} sur {MAX_PHOTOS}</span>
        <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-label="Choisir des photos"
          onChange={(e) => { const picked = Array.from(e.target.files ?? []); e.target.value = ''; void upload(picked); }} />
      </div>
      {photos.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">Ajoutez au moins une photo : un plat, un buffet, une réception. La première devient la couverture de votre fiche.</p>
      ) : (
        <>
          <p className={cn(labelCls, 'mb-0 mt-4')}>Vos photos, dans l’ordre d’affichage</p>
          <ul className="mt-2 space-y-3">
            {photos.map((p, i) => (
              <PhotoRow key={p.id} photo={p} index={i} count={photos.length} isCover={p.id === coverPhotoId} busy={locked}
                onMove={(d) => move(i, d)} onCover={() => run(() => setListingCover(p.id))} onRemove={() => remove(p)}
                onAlt={(alt) => run(() => updateListingPhotoAlt(p.id, alt))} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
