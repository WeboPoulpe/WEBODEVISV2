'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import BrochureEditor from '@/components/brochures/BrochureEditor';
import { getBrochureEditorData } from '@/server/brochures';

type Data = NonNullable<Awaited<ReturnType<typeof getBrochureEditorData>>>;

export default function BrochureEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null | undefined>(undefined);
  useEffect(() => {
    getBrochureEditorData(id).then(setData).catch(() => setData(null));
  }, [id]);

  if (data === undefined) return <div className="flex justify-center py-20 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (data === null) return <p className="px-6 py-10 text-gray-600">Cette brochure est introuvable.</p>;
  return <BrochureEditor brochure={data.brochure} catalog={data.catalog} company={data.company} />;
}
