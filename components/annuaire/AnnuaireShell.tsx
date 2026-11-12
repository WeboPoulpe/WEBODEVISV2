'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { container } from '@/components/site/ui';
import { DIRECTORY_PREFIX } from '@/lib/annuaire/config';
import { SITE_URL } from '@/lib/site/config';
import { AnnuaireLogo } from './AnnuaireMark';
import { useDirectoryHref } from './BaseContext';

// Gabarit de Choisir Mon Traiteur : en-tête bleu nuit et store rayé, pied de page avec les liens légaux, la règle
// de classement et le partenariat avec WeboDevis. Rien de la présentation de WeboDevis (ni logo, ni couleurs).

const NAV = [
  { path: '/traiteurs', label: 'Trouver un traiteur' },
  { path: '/favoris', label: 'Mes favoris' },
];
const CTA = { path: '/referencer-mon-entreprise', label: 'Référencer mon entreprise' };
const LEGAL = [
  { path: '/mentions-legales', label: 'Mentions légales' },
  { path: '/confidentialite', label: 'Confidentialité' },
  { path: '/conditions', label: 'Conditions d’utilisation' },
];

/** Chemin public de la page affichée, quel que soit l'hôte. */
function publicPath(pathname: string): string {
  if (pathname === DIRECTORY_PREFIX) return '/';
  return pathname.startsWith(`${DIRECTORY_PREFIX}/`) ? pathname.slice(DIRECTORY_PREFIX.length) : pathname;
}

export default function AnnuaireShell({ children }: { children: React.ReactNode }) {
  const href = useDirectoryHref();
  const current = publicPath(usePathname() ?? '/');
  const [open, setOpen] = useState(false);
  const menuId = useId();

  // Une page ouverte depuis le menu le referme.
  useEffect(() => setOpen(false), [current]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const isCurrent = (path: string) => current === path || current.startsWith(`${path}/`);

  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-bold">
        Aller au contenu
      </a>
      <header className="cmt-header">
        <div className={`${container} cmt-header__bar`}>
          <Link href={href('/')} className="cmt-logo">
            <AnnuaireLogo />
          </Link>
          <button type="button" className="cmt-menu-btn" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((v) => !v)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              {open ? <path d="M4 4l10 10M14 4L4 14" /> : <path d="M2 4.5h14M2 9h14M2 13.5h14" />}
            </svg>
            Menu
          </button>
          <nav id={menuId} className="cmt-nav" aria-label="Menu principal" data-open={open}>
            {NAV.map((n) => (
              <Link key={n.path} href={href(n.path)} aria-current={isCurrent(n.path) ? 'page' : undefined}>{n.label}</Link>
            ))}
            <Link href={href(CTA.path)} className="cmt-nav__cta" aria-current={isCurrent(CTA.path) ? 'page' : undefined}>{CTA.label}</Link>
          </nav>
        </div>
      </header>
      <div className="cmt-awning" aria-hidden="true" />

      <main id="contenu" className="cmt-main">{children}</main>

      <footer className="cmt-footer">
        <div className="cmt-awning cmt-awning--top" aria-hidden="true" />
        <div className={container}>
          <div className="cmt-footer__grid">
            <div className="grid content-start gap-5">
              <Link href={href('/')} className="cmt-logo">
                <AnnuaireLogo />
              </Link>
              <p className="cmt-footer__note">
                Les fiches sont classées par date de publication, la plus récente d’abord. Aucun traiteur ne paie pour être mieux placé.
              </p>
            </div>
            <nav aria-label="L’annuaire">
              <p className="cmt-footer__title">L’annuaire</p>
              <ul>
                {[...NAV, CTA].map((n) => <li key={n.path}><Link href={href(n.path)}>{n.label}</Link></li>)}
              </ul>
            </nav>
            <nav aria-label="Informations">
              <p className="cmt-footer__title">Informations</p>
              <ul>
                {LEGAL.map((n) => <li key={n.path}><Link href={href(n.path)}>{n.label}</Link></li>)}
              </ul>
            </nav>
          </div>
          <div className="cmt-footer__base">
            <p>
              En partenariat avec <a href={SITE_URL}>WeboDevis</a>, le logiciel des traiteurs
            </p>
            <p>© {new Date().getFullYear()} Choisir Mon Traiteur</p>
          </div>
        </div>
      </footer>
    </>
  );
}
