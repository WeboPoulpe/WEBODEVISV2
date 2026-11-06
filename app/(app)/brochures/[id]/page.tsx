'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import BrochureEditor from '@/components/brochures/BrochureEditor';
import { getBrochureEditorData } from '@/server/brochures';

type Data = NonNullable<Awaited<ReturnType<typeof getBrochureEditorData>>>;

export default function BrochureEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null | undefined>(undefined);
  const load = useCallback(() => {
    getBrochureEditorData(id).then(setData).catch(() => setData(null));
  }, [id]);
  useEffect(load, [load]);
  // Brochure modifiée par Webo : l'éditeur repart de ce qui est enregistré (sinon il écraserait le changement).
  useEffect(() => {
    const onChanged = (e: Event) => { if ((e as CustomEvent<string>).detail === id) load(); };
    window.addEventListener('webo:brochure-changed', onChanged);
    return () => window.removeEventListener('webo:brochure-changed', onChanged);
  }, [id, load]);

  if (data === undefined) return <div className="flex justify-center py-20 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (data === null) return <p className="px-6 py-10 text-gray-600">Cette brochure est introuvable.</p>;
  // Remonté à chaque changement d'éditeur : la composition et la mise en page repartent de ce que le serveur a écrit.
  return <BrochureEditor key={`${data.brochure.editor_mode}-${String(data.brochure.updated_at)}`} brochure={data.brochure} catalog={data.catalog} company={data.company} onReload={load} />;
}
