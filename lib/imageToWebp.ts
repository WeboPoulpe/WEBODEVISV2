// ═══════════════════════════════════════════════════════════════════════════
// Conversion d'une image en WebP côté navigateur (à l'upload)
// ═══════════════════════════════════════════════════════════════════════════
// Allège les fichiers stockés → écran, impression et PDF plus légers, sans perte
// visible. Redimensionne aussi au-delà d'une taille max (qualité impression OK).
// En cas d'échec (format non supporté, pas de canvas…), retourne le fichier d'origine.

export async function fileToWebp(file: File, opts: { quality?: number; maxDim?: number } = {}): Promise<File> {
  const { quality = 0.85, maxDim = 2000 } = opts;
  if (typeof window === 'undefined' || typeof document === 'undefined') return file;
  if (!file.type.startsWith('image/') || file.type === 'image/webp') return file;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (Math.max(width, height) > maxDim) {
      const ratio = maxDim / Math.max(width, height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], name, { type: 'image/webp' });
  } catch {
    return file;
  }
}
