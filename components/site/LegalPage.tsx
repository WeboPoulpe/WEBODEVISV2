import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

/** Information légale manquante : marqueur visible, à remplacer par l'éditeur avant la mise en ligne. */
export function Todo({ children }: { children: React.ReactNode }) {
  return <span className="site-todo">[À COMPLÉTER : {children}]</span>;
}

/** Gabarit sobre des pages légales : en-tête clair, une colonne de texte, pied de page. */
export default function LegalPage({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
      <SiteHeader tone="light" />
      <main id="contenu" className="site-legal max-w-[68ch] pt-10 sm:pt-16 pb-20">
        <h1 className="site-h2">{title}</h1>
        {intro && <div className="mt-5">{intro}</div>}
        {children}
      </main>
      <div className="pb-8">
        <SiteFooter tone="light" />
      </div>
    </div>
  );
}
