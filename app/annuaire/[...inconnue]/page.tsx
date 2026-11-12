import { notFound } from 'next/navigation';

// Toute adresse inconnue sous l'annuaire (et donc toute adresse inconnue sur choisirmontraiteur.fr, réécrite ici par le
// middleware : /login, /admin…) reçoit la page 404 de l'annuaire, pas celle de WeboDevis.
export default function UnknownDirectoryPage(): never {
  notFound();
}
