// La pièce WeboCoin : un disque doré, discret, avec un W gravé. Décorative (le texte à côté dit le montant).

import { useId } from 'react';

export default function WeboCoin({ size = 18, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E9D18A" />
          <stop offset="1" stopColor="#B8913A" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill={`url(#${id}-g)`} stroke="#8C6A22" strokeWidth="1" />
      <circle cx="12" cy="12" r="8.4" fill="none" stroke="#FBF7F0" strokeOpacity="0.55" strokeWidth="0.8" />
      <path d="M6.6 8.4 L8.9 15.8 L12 10.6 L15.1 15.8 L17.4 8.4" fill="none" stroke="#FBF7F0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
