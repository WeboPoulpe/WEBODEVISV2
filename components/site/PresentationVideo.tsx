// La vidéo de présentation, en fin d'histoire sur l'accueil : une minute trente, avec la voix du fondateur et
// une musique de fond. Elle a du son, donc elle ne se lance jamais seule : la personne appuie sur lecture.
// Rien n'est téléchargé avant (preload="none"), seule l'image d'attente est chargée.

import { cn } from '@/lib/utils';

export const PRESENTATION_VIDEO = { src: '/video/presentation.mp4', poster: '/video/presentation.jpg', width: 1280, height: 720 };

export default function PresentationVideo({ className }: { className?: string }) {
  return (
    <video
      className={cn('block w-full h-auto rounded-[24px] bg-forest ring-1 ring-black/10 shadow-[0_24px_60px_rgb(0_0_0/0.18)]', className)}
      src={PRESENTATION_VIDEO.src}
      poster={PRESENTATION_VIDEO.poster}
      width={PRESENTATION_VIDEO.width}
      height={PRESENTATION_VIDEO.height}
      controls
      playsInline
      preload="none"
      aria-label="WeboDevis en une minute trente : de la demande à la facturation, en passant par l’organisation. Vidéo avec voix."
    />
  );
}
