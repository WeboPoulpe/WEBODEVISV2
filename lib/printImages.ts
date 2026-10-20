// Allège les photos d'un devis juste avant l'impression ou l'enregistrement en PDF.
//
// Pourquoi : Chrome et Edge gardent une image JPEG telle quelle dans le PDF, mais recompressent sans perte les
// images WebP et PNG — une photo de page de garde de 2000 px y pèse alors plusieurs mégaoctets. Chaque grande
// image est donc redessinée en JPEG, à deux fois la taille où elle s'affiche (assez pour une impression nette).
//
// Les petites images (logo, signature) ne sont pas touchées : elles gardent leur transparence. Une image qui ne
// peut pas être relue (autre site sans autorisation) reste telle quelle. Écrite sans dépendance : la fenêtre
// d'impression de l'éditeur l'embarque par son texte (voir buildQuotePrintPage dans lib/quoteOutput.ts).

export async function lightenImagesForPrint(doc: Document, quality = 0.82): Promise<void> {
  const MIN_AREA = 260 * 260;
  const MAX_SIDE = 2000;
  const imgs = Array.from(doc.images).filter((img) => !img.getAttribute('data-print-light') && !img.src.startsWith('data:image/jpeg'));
  await Promise.all(imgs.map(async (img) => {
    try {
      const box = img.getBoundingClientRect();
      if (box.width * box.height < MIN_AREA) return;
      // Une copie chargée avec autorisation de lecture : sans elle, le dessin ne pourrait pas être exporté.
      const source = await new Promise<HTMLImageElement | null>((resolve) => {
        const copy = new Image();
        copy.crossOrigin = 'anonymous';
        copy.onload = () => resolve(copy);
        copy.onerror = () => resolve(null);
        copy.src = img.src.startsWith('data:') ? img.src : `${img.src}${img.src.includes('?') ? '&' : '?'}impression=1`;
      });
      if (!source || !source.naturalWidth) return;
      const target = Math.min(MAX_SIDE, Math.max(box.width, box.height) * 2);
      const ratio = Math.min(1, target / Math.max(source.naturalWidth, source.naturalHeight));
      const canvas = doc.createElement('canvas');
      canvas.width = Math.max(1, Math.round(source.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(source.naturalHeight * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const light = canvas.toDataURL('image/jpeg', quality);
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.removeAttribute('srcset');
        img.setAttribute('data-print-light', '1');
        img.src = light;
      });
    } catch {
      // Image laissée telle quelle.
    }
  }));
}

/** Allège les images de la page puis ouvre la fenêtre d'impression (bouton « Imprimer » ou « Enregistrer en PDF »). */
export async function printLight(): Promise<void> {
  try {
    await lightenImagesForPrint(document);
  } finally {
    window.print();
  }
}
