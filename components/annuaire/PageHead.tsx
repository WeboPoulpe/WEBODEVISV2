import Link from 'next/link';
import { container, JsonLd } from '@/components/site/ui';
import { directoryHref } from '@/lib/annuaire/routing';
import { directoryBreadcrumb, type DirectoryCrumb } from '@/lib/annuaire/schema';

// En-tête d'une page intérieure : fil d'Ariane (et ses données structurées), titre, phrase d'introduction.

export function Crumbs({ crumbs, base }: { crumbs: DirectoryCrumb[]; base: '' | '/annuaire' }) {
  return (
    <>
      <JsonLd data={directoryBreadcrumb(crumbs)} />
      <nav aria-label="Fil d’Ariane" className="cmt-crumbs">
        <ol>
          {crumbs.map((c, i) => (
            <li key={c.path}>
              {i === crumbs.length - 1
                ? <span aria-current="page">{c.name}</span>
                : <Link href={directoryHref(base, c.path)}>{c.name}</Link>}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

export default function PageHead({ crumbs, base, title, lead, children }: {
  crumbs: DirectoryCrumb[];
  base: '' | '/annuaire';
  title: string;
  lead?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${container} cmt-pagehead`}>
      <Crumbs crumbs={crumbs} base={base} />
      <h1 className="cmt-h1">{title}</h1>
      {lead && <p className="cmt-lead">{lead}</p>}
      {children}
    </div>
  );
}
