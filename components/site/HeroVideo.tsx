'use client';

// La vidéo du hero de l'accueil : la semaine de Julien en une boucle muette, avec les vrais écrans du logiciel.
// Elle se lance seule, sans son. Si la personne a demandé moins d'animations, elle reste sur son image
// et se lance à la demande (les commandes du lecteur s'affichent).

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export const HERO_VIDEO = { src: '/video/hero-accueil.mp4', poster: '/video/hero-accueil.jpg', width: 1280, height: 720 };

export default function HeroVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setCalm(reduced);
    if (!reduced) ref.current?.play().catch(() => setCalm(true));
  }, []);

  return (
    <video
      ref={ref}
      className={cn('block w-full h-auto rounded-[20px] bg-forest ring-1 ring-white/10 shadow-[0_24px_60px_rgb(0_0_0/0.35)]', className)}
      src={HERO_VIDEO.src}
      poster={HERO_VIDEO.poster}
      width={HERO_VIDEO.width}
      height={HERO_VIDEO.height}
      muted
      loop
      playsInline
      preload="metadata"
      controls={calm}
      aria-label="WeboDevis en trente secondes : la semaine de Julien, traiteur, de la demande reçue le lundi au chiffre d’affaires du lundi suivant. Vidéo sans son."
    />
  );
}
