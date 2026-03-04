'use client';

import { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  images: string[];
  onChange: (urls: string[]) => void;
  userId: string;
  /** Max number of images (default 5) */
  max?: number;
  /** Supabase storage bucket name (default 'uploads') */
  bucket?: string;
}

export default function ImageUpload({ images, onChange, userId, max = 5, bucket = 'uploads' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - images.length;
    if (remaining <= 0) return;

    setUploading(true);
    setUploadError(null);
    const supabase = createClient();
    const newUrls: string[] = [];

    for (const file of Array.from(files).slice(0, remaining)) {
      const path = `${userId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) {
        setUploadError(`Erreur upload : ${error.message}. Vérifiez que le bucket "${bucket}" existe dans Supabase Storage avec accès public.`);
      } else {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        newUrls.push(`${data.publicUrl}?t=${Date.now()}`);
      }
    }

    if (newUrls.length > 0) onChange([...images, ...newUrls]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (url: string) => onChange(images.filter((u) => u !== url));

  return (
    <div className="space-y-3">
      {uploadError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{uploadError}</p>
      )}
      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url) => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-20 w-20 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {images.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-[#9c27b0]/40 hover:bg-[#f3e5f5]/20 transition-all disabled:opacity-60 w-full justify-center"
        >
          {uploading
            ? <><Loader2 className="h-4 w-4 animate-spin text-[#9c27b0]" /> Upload en cours…</>
            : <><Upload className="h-4 w-4" /> Ajouter des photos ({images.length}/{max})</>}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
