'use client';

// Fenêtre unique « Abonnement inactif » : elle s'ouvre quand le serveur refuse une écriture faute d'abonnement, quelle
// que soit la page (événement SUBSCRIPTION_REQUIRED_EVENT, envoyé par le client de données et par useFeedback().notify).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary } from '@/components/ui/kit';
import { SUBSCRIPTION_REQUIRED_EVENT, SUBSCRIPTION_REQUIRED_MESSAGE } from '@/lib/subscription';

export default function SubscriptionRequiredDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onRequired = (e: Event) => { e.preventDefault(); setOpen(true); };
    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, onRequired);
  }, []);
  if (!open) return null;
  const close = () => setOpen(false);
  return (
    <Modal title="Abonnement inactif" onClose={close}
      footer={
        <>
          <button type="button" onClick={close} className={btnSecondary}>Fermer</button>
          <Link href="/parametres/abonnement" onClick={close} className={btnPrimary}>Réactiver</Link>
        </>
      }>
      <p className="text-[15px] text-gray-600">{SUBSCRIPTION_REQUIRED_MESSAGE}</p>
    </Modal>
  );
}
