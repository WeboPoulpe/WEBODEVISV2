'use client';

// Choisir la photo d'une brochure : celles déjà mises dans les brochures de l'entreprise et celles du catalogue, ou
// une nouvelle envoyée depuis l'appareil (convertie en WebP, stockée comme les photos de WeboWord). Et la cadrer :
// le point à garder visible (clic sur l'aperçu), le zoom, ou la photo entière. Le fichier n'est jamais modifié.

import { useEffect, useState } from 'react';
import { Check, ImagePlus, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnSecondary, labelCls } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { fileToWebp } from '@/lib/imageToWebp';
import { cn } from '@/lib/utils';
import { DEFAULT_FRAME, type PhotoFrame } from '@/lib/photoFrame';
import { listBrochurePhotos } from '@/server/brochures';
import { FramedPhoto } from './PhotoText';

/** Envoi d'une photo depuis l'appareil ; renvoie son adresse, ou null (message déjà montré). */
export function usePhotoUpload() {
  const { user } = useAuth();
  const { notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  const upload = async (original: File): Promise<string | null> => {
    if (!user) return null;
    setBusy(true);
    try {
      const file = await fileToWebp(original);
      const ext = file.name.split('.').pop();
      // Chemin préfixé par l'identifiant du compte : exigé par le stockage.
      const path = `${user.id}/brochures/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from('storage').upload(path, file, { upsert: false });
      if (error) throw error;
      return supabase.storage.from('storage').getPublicUrl(path).data.publicUrl;
    } catch {
      notify('La photo n’a pas pu être envoyée. Vérifiez votre connexion et le poids du fichier, puis réessayez.', { tone: 'error' });
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { upload, busy };
}

export function PhotoPicker({ current, onPick, onClose }: { current: string | null | undefined; onPick: (url: string | null) => void; onClose: () => void }) {
  const [photos, setPhotos] = useState<{ url: string; label: string }[] | null>(null);
  const { upload, busy } = usePhotoUpload();
  useEffect(() => {
    let alive = true;
    listBrochurePhotos().then((p) => { if (alive) setPhotos(p); }).catch(() => { if (alive) setPhotos([]); });
    return () => { alive = false; };
  }, []);

  return (
    <Modal title="Choisir une photo" onClose={onClose} wide
      footer={<>
        {current && <button type="button" onClick={() => onPick(null)} className={btnSecondary}>Pas de photo</button>}
        <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
      </>}>
      <label className={cn(btnSecondary, 'mb-4 cursor-pointer')}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        Envoyer depuis l’appareil
        <input type="file" accept="image/*" className="sr-only" disabled={busy}
          onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const url = await upload(f); if (url) onPick(url); }} />
      </label>
      <p className={labelCls}>Déjà dans vos brochures et votre catalogue</p>
      {photos === null ? (
        <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune photo pour l’instant : envoyez-en une depuis l’appareil.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Photos disponibles">
          {photos.map((p) => (
            <li key={p.url}>
              <button type="button" onClick={() => onPick(p.url)} aria-pressed={p.url === current} title={p.label}
                className={cn('relative block w-full overflow-hidden rounded-lg border', p.url === current ? 'border-primary ring-2 ring-primary' : 'border-gray-200 hover:border-primary/50')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.label} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                {p.url === current && <Check className="absolute right-1 top-1 h-5 w-5 rounded-full bg-primary p-0.5 text-white" />}
                <span className="block truncate px-1.5 py-1 text-left text-xs text-gray-600">{p.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Cadrage : clic sur l'aperçu = point gardé visible ; zoom ; photo entière. `ratio` : forme de l'aperçu (hauteur / largeur, %). */
export function PhotoFramer({ url, frame, onChange, ratio = 66 }: { url: string; frame: PhotoFrame | null | undefined; onChange: (f: PhotoFrame | null) => void; ratio?: number }) {
  const f = frame ?? DEFAULT_FRAME;
  const set = (patch: Partial<PhotoFrame>) => onChange({ ...f, ...patch });
  return (
    <div className="space-y-2">
      <div className="relative w-full max-w-[280px] cursor-crosshair overflow-hidden rounded-lg border border-gray-200 bg-[#EDE6DA]" style={{ containerType: 'inline-size' }}
        role="button" tabIndex={0} aria-label="Cliquer sur le point de la photo à garder visible"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          set({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100), fit: 'cover' });
        }}>
        <FramedPhoto url={url} frame={f} ratio={ratio} />
        {f.fit === 'cover' && (
          <span aria-hidden className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${f.x}%`, top: `${f.y}%`, background: 'rgba(180,80,45,.8)' }} />
        )}
      </div>
      <p className="text-xs text-gray-500">Cliquez sur ce qui doit rester visible (un visage, le plat).</p>
      <label className="block">
        <span className={cn(labelCls, 'flex justify-between')}>Zoom<span className="tabular-nums text-gray-500">{f.zoom} %</span></span>
        <input type="range" min={100} max={300} step={10} value={f.zoom} disabled={f.fit === 'contain'} aria-label="Zoom"
          onChange={(e) => set({ zoom: Number(e.target.value) })} className="w-full accent-primary disabled:opacity-40" />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={f.fit === 'contain'} onChange={(e) => set({ fit: e.target.checked ? 'contain' : 'cover' })} />
          Photo entière (sans recadrage)
        </label>
        {frame && <button type="button" onClick={() => onChange(null)} className="text-sm text-primary hover:text-primary-dark">Recentrer</button>}
      </div>
    </div>
  );
}
