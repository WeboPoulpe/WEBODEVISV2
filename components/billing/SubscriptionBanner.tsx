import Link from 'next/link';

// Bandeau en haut de l'app quand l'abonnement de l'entreprise n'est plus actif : tout reste lisible et exportable.

export default function SubscriptionBanner() {
  return (
    <div role="status" data-subscription-banner
      className="flex flex-wrap items-center gap-x-3 gap-y-2 mx-4 md:mx-6 mt-3 px-4 py-2.5 rounded-2xl bg-primary-50 border border-primary-100 text-sm text-gray-900">
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Abonnement inactif :</span>{' '}
        <span className="text-gray-700">vos données restent consultables et exportables.</span>
      </p>
      <div className="flex flex-shrink-0 items-center gap-2">
        <a href="/api/compte/export" className="inline-flex items-center h-8 px-3 rounded-lg border border-gray-200 bg-white font-medium hover:border-gray-300 transition-colors">
          Exporter mes données
        </a>
        <Link href="/parametres/abonnement" className="inline-flex items-center h-8 px-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-dark transition-colors">
          Réactiver
        </Link>
      </div>
    </div>
  );
}
