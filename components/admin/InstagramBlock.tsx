import Link from 'next/link';
import { cardCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { originLabel } from '@/lib/origine';
import type { InstagramStats } from '@/server/siteStats';

// Bloc Instagram de la page Statistiques : ce que deviennent les personnes qui cliquent sur les liens
// webodevis.fr/ig (bio) et webodevis.fr/ig/<libellé> (stories). Voir lib/origine.ts.

const nf = new Intl.NumberFormat('fr-FR');
const KIND: Record<InstagramStats['personnes'][number]['kind'], { label: string; href: string }> = {
  demo: { label: 'Démo', href: '/admin/demandes' },
  contact: { label: 'Contact', href: '/admin/demandes' },
  compte: { label: 'Compte', href: '/admin/comptes' },
};
const shortDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className={cn(cardCls, 'p-4')}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-[28px] font-bold text-gray-900 tabular-nums leading-tight">{nf.format(value)}</p>
    </div>
  );
}

export default function InstagramBlock({ stats }: { stats: InstagramStats }) {
  const { totals, daily, liens, personnes } = stats;
  const max = Math.max(1, ...daily.map((d) => d.clics));
  const maxLien = Math.max(1, ...liens.map((l) => l.clics));

  return (
    <section aria-labelledby="instagram-title" className="space-y-4">
      <div>
        <h2 id="instagram-title" className="text-[20px] font-bold text-gray-900">Instagram</h2>
        <p className="text-sm text-gray-500 mt-0.5">Les personnes arrivées par un lien webodevis.fr/ig, et ce qu’elles ont fait pendant leur visite.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile label="Clics" value={totals.clics} />
        <Tile label="Visiteurs" value={totals.visiteurs} />
        <Tile label="Demandes de démo" value={totals.demos} />
        <Tile label="Contacts" value={totals.contacts} />
        <Tile label="Inscriptions" value={totals.inscriptions} />
      </div>

      {totals.clics === 0 && personnes.length === 0 ? (
        <p className={cn(cardCls, 'p-4 text-sm text-gray-500')}>
          Aucun clic sur cette période. Le lien de la bio est webodevis.fr/ig ; pour une story, webodevis.fr/ig/nom-de-la-story.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className={cn(cardCls, 'p-4')}>
            <h3 className="text-[15px] font-semibold text-gray-900">Clics par jour</h3>
            <div className="mt-3 flex h-28 items-end gap-[2px]">
              {daily.map((d) => (
                <span key={d.day} title={`${shortDay(d.day)} : ${d.clics} clic${d.clics > 1 ? 's' : ''}`} className="flex-1 h-full flex items-end">
                  <span className="block w-full rounded-t-[3px] bg-primary-400" style={{ height: d.clics ? `${Math.max(4, (d.clics / max) * 100)}%` : 2, opacity: d.clics ? 1 : 0.35 }} />
                </span>
              ))}
            </div>
          </div>
          <div className={cn(cardCls, 'p-4')}>
            <h3 className="text-[15px] font-semibold text-gray-900">Par lien</h3>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {liens.map((l) => (
                  <tr key={l.origin}>
                    <td className="py-1.5 pr-3 w-full">
                      <div className="text-gray-800 truncate">{originLabel(l.origin)}</div>
                      <div className="mt-1 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-primary-400" style={{ width: `${(l.clics / maxLien) * 100}%` }} /></div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-gray-900 font-medium">{nf.format(l.clics)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {personnes.length > 0 && (
        <div className={cn(cardCls, 'p-4')}>
          <h3 className="text-[15px] font-semibold text-gray-900">Ils se sont fait connaître</h3>
          <ul className="mt-2 divide-y divide-gray-100">
            {personnes.map((p) => (
              <li key={`${p.kind}-${p.id}`}>
                <Link href={KIND[p.kind].href} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2.5 text-sm hover:bg-gray-50 rounded-lg -mx-2 px-2">
                  <span className="font-medium text-gray-900">{p.name}</span>
                  {p.company && <span className="text-gray-500">{p.company}</span>}
                  <span className="text-gray-700">{KIND[p.kind].label}</span>
                  <span className="text-gray-500">{originLabel(p.origin)}</span>
                  <span className="ml-auto text-gray-500 tabular-nums">{shortDay(p.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
