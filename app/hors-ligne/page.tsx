import Wordmark from '@/components/brand/Wordmark';

export const metadata = { title: 'Hors ligne — WeboDevis' };

// Affichée par le service worker quand une page est demandée sans réseau.
export default function HorsLignePage() {
  return (
    <div className="min-h-[100dvh] bg-page flex flex-col items-center justify-center px-6 text-center">
      <Wordmark className="text-[26px] text-gray-900" />
      <h1 className="text-[28px] font-bold text-gray-900 leading-tight mt-10">Pas de connexion</h1>
      <p className="text-base text-gray-600 mt-2 max-w-[36ch]">
        Cette page a besoin du réseau. Vos données sont en sécurité : elles réapparaîtront dès que la connexion revient.
      </p>
      <a href="/" className="mt-8 inline-flex items-center justify-center h-12 px-6 rounded-xl bg-primary text-white text-[15px] font-semibold">
        Réessayer
      </a>
    </div>
  );
}
