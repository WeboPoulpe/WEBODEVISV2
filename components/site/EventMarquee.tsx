// Bandeau terracotta qui défile : les occasions que prépare un traiteur.
// La liste est dupliquée pour une boucle sans à-coup ; la copie est cachée aux lecteurs d'écran.
const OCCASIONS = [
  'Mariages', 'Séminaires', 'Cocktails dînatoires', 'Baptêmes', 'Repas d’entreprise',
  'Anniversaires', 'Buffets', 'Communions', 'Galas', 'Réceptions privées',
];

function Row({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="site-marquee-row">
      {OCCASIONS.map((o) => (
        <li key={o} className="flex items-center gap-8 md:gap-10">
          <span>{o}</span>
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-white/45" />
        </li>
      ))}
    </ul>
  );
}

export default function EventMarquee({ className }: { className?: string }) {
  return (
    <div className={`site-marquee-wrap ${className ?? ''}`}>
      <div className="site-marquee font-display">
        <p className="sr-only">WeboDevis prépare toutes les occasions : {OCCASIONS.join(', ')}.</p>
        <div aria-hidden className="site-marquee-track">
          <Row hidden />
          <Row hidden />
        </div>
      </div>
    </div>
  );
}
