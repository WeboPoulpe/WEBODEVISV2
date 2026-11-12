'use client';

import { useEffect, useRef, useState } from 'react';

// Galerie d'une fiche : une grande photo et trois vignettes ; la dernière annonce les photos restantes. Chaque photo
// s'agrandit dans une fenêtre (<dialog> natif : focus gardé, Échap pour fermer, flèches pour passer de l'une à l'autre).
// Sans photo, un aplat rose pâle porte le nom du traiteur.

type Photo = { url: string; alt: string };
const SHOWN = 4;

export default function ListingGallery({ photos, name }: { photos: Photo[]; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const altOf = (p: Photo, i: number) => p.alt || `Photo ${i + 1} de ${name}`;

  const open = (i: number) => {
    setIndex(i);
    dialog.current?.showModal();
  };
  const step = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  if (!photos.length) {
    return (
      <div className="cmt-gallery">
        <p className="cmt-gallery__empty" aria-hidden="true">{name}</p>
      </div>
    );
  }

  const more = photos.length - SHOWN;
  const current = photos[index] ?? photos[0];
  return (
    <>
      <div className="cmt-gallery">
        {photos.slice(0, SHOWN).map((p, i) => {
          const last = i === SHOWN - 1 && more > 0;
          return (
            <button
              key={p.url + i}
              type="button"
              className="cmt-gallery__tile"
              onClick={() => open(i)}
              aria-label={last ? `Voir les ${photos.length} photos` : `Agrandir : ${altOf(p, i)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
              {last && <span className="cmt-gallery__more" aria-hidden="true">{more === 1 ? '1 photo de plus' : `${more} photos de plus`}</span>}
            </button>
          );
        })}
      </div>

      <dialog ref={dialog} className="cmt-lightbox" aria-label={`Photos de ${name}`} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cmt-lightbox__img" src={current.url} alt={altOf(current, index)} />
        <div className="cmt-lightbox__bar">
          <p aria-live="polite">Photo {index + 1} sur {photos.length}{current.alt ? ` : ${current.alt}` : ''}</p>
          <div className="cmt-lightbox__nav">
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => step(-1)}>Précédente</button>
                <button type="button" onClick={() => step(1)}>Suivante</button>
              </>
            )}
            <button type="button" onClick={() => dialog.current?.close()}>Fermer</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
