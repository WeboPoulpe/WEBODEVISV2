'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ListingEditor from '@/components/annuaire/ListingEditor';
import { errorCls } from '@/components/ui/kit';
import { DIRECTORY_NAME } from '@/lib/annuaire/config';
import { getMyListing, type MyListing } from '@/server/directoryListing';

// Ma fiche : la fiche du traiteur dans l'annuaire partenaire « Choisir Mon Traiteur ».

export default function MaFichePage() {
  const [listing, setListing] = useState<MyListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rafraîchit l'état enregistré sans démonter le formulaire (la saisie en cours est conservée).
  const reload = useCallback(async () => {
    try {
      const next = await getMyListing();
      setListing(next);
      return next;
    } catch {
      setError('Votre fiche n’a pas pu être chargée. Rechargez la page.');
      return null;
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  return (
    <div className="px-4 pb-8 md:px-6">
      <div className="mb-5">
        <h1 className="text-[26px] font-bold leading-tight text-gray-900 md:text-[32px]">Ma fiche</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-gray-500">
          {DIRECTORY_NAME} est l’annuaire partenaire de WeboDevis : votre fiche y présente votre activité à ceux qui cherchent un traiteur. Elle est incluse dans votre abonnement WeboDevis.
        </p>
      </div>

      {error && <p role="alert" className={errorCls}>{error}</p>}

      {listing === null ? (
        !error && <div className="flex justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" aria-label="Chargement" /></div>
      ) : (
        <ListingEditor listing={listing} reload={reload} />
      )}
    </div>
  );
}
