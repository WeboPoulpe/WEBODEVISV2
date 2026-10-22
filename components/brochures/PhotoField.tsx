'use client';

// Une photo de brochure : envoi depuis l'appareil (convertie en WebP, stockée comme les photos de WeboWord), aperçu,
// retrait.

import { useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fileToWebp } from '@/lib/imageToWebp';
import { useAuth } from '@/context/AuthContext';
import { useFeedback } from '@/components/ui/Feedback';

export default function PhotoField({ label, url, onChange }: { label: string; url: string | null | undefined; onChange: (url: string | null) => void }) {
  const { user } = useAuth();
  const { notify } = useFeedback();
  const [busy, setBusy] = useState(false);

  const upload = async (original: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const file = await fileToWebp(original);
      const ext = file.name.split('.').pop();
      // Chemin préfixé par l'identifiant du compte : exigé par le stockage.
      const path = `${user.id}/brochures/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from('storage').upload(path, file, { upsert: false });
      if (error) throw error;
      onChange(supabase.storage.from('storage').getPublicUrl(path).data.publicUrl);
    } catch {
      notify('La photo n’a pas pu être envoyée. Vérifiez votre connexion et le poids du fichier, puis réessayez.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[#E6DFD3]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      </div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {url ? 'Changer' : label}
        <input type="file" accept="image/*" className="sr-only" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f); }} />
      </label>
      {url && (
        <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <X className="h-4 w-4" /> Retirer
        </button>
      )}
    </div>
  );
}
