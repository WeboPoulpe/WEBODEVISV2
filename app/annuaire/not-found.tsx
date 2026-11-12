import type { Metadata } from 'next';
import Link from 'next/link';
import { container } from '@/components/site/ui';
import { directoryBase } from '@/lib/annuaire/base';
import { directoryHref } from '@/lib/annuaire/routing';

// Page introuvable de l'annuaire (adresse inconnue, département qui n'existe pas, fiche retirée), dans son propre
// gabarit : jamais la page 404 de WeboDevis.

export const metadata: Metadata = { title: 'Page introuvable', robots: { index: false } };

export default async function AnnuaireNotFound() {
  const base = await directoryBase();
  const href = (p: string) => directoryHref(base, p);
  return (
    <div className={`${container} cmt-pagehead`} style={{ paddingBottom: 24 }}>
      <h1 className="cmt-h1">Cette page n’existe pas.</h1>
      <p className="cmt-lead">
        L’adresse a peut-être changé, ou ce traiteur a retiré sa fiche de l’annuaire. D’autres traiteurs vous attendent.
      </p>
      <p style={{ marginTop: 28 }}>
        <Link href={href('/traiteurs')} className="cmt-btn cmt-btn--primary cmt-btn--big">Voir les traiteurs</Link>
      </p>
      <p style={{ marginTop: 22 }}>
        Ou revenez à <Link href={href('/')} className="cmt-link">l’accueil</Link> pour lancer une recherche.
      </p>
    </div>
  );
}
