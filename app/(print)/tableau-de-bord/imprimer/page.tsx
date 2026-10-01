export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getDashboard } from '@/server/dashboard';
import { getMyProfile } from '@/server/auth';
import { BUCKETS, longDate, type TodoKind } from '@/lib/dashboard';
import { quoteStatusLabel } from '@/lib/quoteStatus';
import PrintToolbar from './PrintToolbar';

// « À faire » imprimable : la liste complète des tâches, avec une case à cocher à la main, les prochains
// événements et les chiffres du moment. Mêmes données que le tableau de bord.

export const metadata: Metadata = { title: 'À faire – WeboDevis', robots: { index: false } };

const euros = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const short = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

/** Où agir, en mots : la page de l'app et l'onglet, pas l'adresse technique. */
function placeOf(href: string): string {
  const [path, query] = href.split('?');
  const tab = new URLSearchParams(query ?? '').get('onglet');
  const TABS: Record<string, string> = { checklist: 'checklist', materiel: 'matériel', courses: 'courses', extras: 'extras' };
  if (path.startsWith('/evenements/')) return tab ? `Événement, onglet ${TABS[tab] ?? tab}` : 'Fiche de l’événement';
  if (path.startsWith('/devis/')) return 'Devis';
  if (path.startsWith('/prospects')) return 'Demandes';
  if (path.startsWith('/stock')) return 'Stock';
  if (path.startsWith('/commandes')) return 'Commandes';
  if (path.startsWith('/notifications')) return 'Notifications';
  return 'WeboDevis';
}

const KIND_LABELS: Record<TodoKind, string> = {
  prospect: 'Demande', devis: 'Devis', relance: 'Relance', preparation: 'Préparation', location: 'Location',
  acompte: 'Acompte', stock: 'Stock', commande: 'Commande', notification: 'Alerte',
};

export default async function PrintTodoPage() {
  const [data, profile] = await Promise.all([getDashboard(), getMyProfile()]);
  const { summary: s, todo, upcoming, today } = data;
  const company = (profile as { company_name?: string | null } | null)?.company_name || 'Mon entreprise';
  const printedAt = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' });
  const conversion = s.conversion.total ? Math.round((s.conversion.confirmed / s.conversion.total) * 100) : 0;
  const counts = BUCKETS.map((b) => ({ ...b, n: todo.filter((t) => t.bucket === b.key).length }));
  const byKind = Object.entries(todo.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.kind]: (acc[t.kind] ?? 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]);
  const notReady = upcoming.filter((e) => e.missing && e.missing.length > 0).length;
  const maxMonth = Math.max(1, ...s.months.map((m) => m.amount));

  return (
    <div className="print-root">
      <style>{CSS}</style>
      <PrintToolbar />

      <header className="head">
        <div>
          <p className="muted">{company}</p>
          <h1>À faire</h1>
          <p className="muted">Arrêté au {longDate(today, today)}, imprimé le {printedAt}</p>
        </div>
        <table className="kpis">
          <tbody>
            {counts.map((c) => (
              <tr key={c.key}><th>{c.label}</th><td className={c.key === 'retard' && c.n ? 'late' : ''}>{c.n}</td></tr>
            ))}
            <tr className="total"><th>Total</th><td>{todo.length}</td></tr>
          </tbody>
        </table>
      </header>

      <section className="stats">
        <div><span>Chiffre d’affaires du mois</span><strong>{euros(s.caMonth)}</strong><em>{s.caMonthEvents} événement{s.caMonthEvents > 1 ? 's' : ''}</em></div>
        <div><span>Depuis le 1er janvier</span><strong>{euros(s.caYear)}</strong><em>{s.caYearEvents} événement{s.caYearEvents > 1 ? 's' : ''}</em></div>
        <div><span>Devis en cours</span><strong>{euros(s.pendingAmount)}</strong><em>{s.pendingCount} devis</em></div>
        <div><span>Transformation (12 mois)</span><strong>{conversion} %</strong><em>{s.conversion.confirmed} sur {s.conversion.total} devis</em></div>
        <div><span>À venir</span><strong>{s.upcomingGuests} couverts</strong><em>{s.upcomingEvents} événement{s.upcomingEvents > 1 ? 's' : ''}, {notReady} à finir de préparer</em></div>
        <div><span>Ce mois-ci</span><strong>{s.quotesMonth} devis créés</strong><em>{s.requestsMonth !== null ? `${s.requestsMonth} demande${s.requestsMonth > 1 ? 's' : ''} reçue${s.requestsMonth > 1 ? 's' : ''}` : ' '}</em></div>
      </section>

      <section>
        <h2>Tâches ({todo.length})</h2>
        {todo.length === 0 ? (
          <p className="empty">Rien d’urgent pour le moment.</p>
        ) : (
          <table className="sheet">
            <thead>
              <tr><th className="tick">Fait</th><th className="due">Échéance</th><th className="kind">Type</th><th>Tâche et détails</th><th className="where">Où</th></tr>
            </thead>
            {BUCKETS.map((b) => {
              const rows = todo.filter((t) => t.bucket === b.key);
              if (rows.length === 0) return null;
              return (
                <tbody key={b.key}>
                  <tr className={`group ${b.key}`}><td colSpan={5}>{b.label} ({rows.length})</td></tr>
                  {rows.map((t) => (
                    <tr key={t.key} className="row">
                      <td className="tick"><span className="box" /></td>
                      <td className="due">{t.due ? short(t.due) : '—'}<br /><small>{t.when}</small></td>
                      <td className="kind">{KIND_LABELS[t.kind]}</td>
                      <td>
                        <strong>{t.title}</strong>
                        {t.detail && <div className="detail">{t.detail}</div>}
                        {t.links && t.links.length > 0 && (
                          <ul className="missing">{t.links.map((l) => <li key={l.href + l.label}><span className="box small" />{l.label}</li>)}</ul>
                        )}
                      </td>
                      <td className="where">{t.action}<br /><small>{placeOf(t.href)}</small></td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="keep">
          <h2>Prochains événements</h2>
          <table className="sheet">
            <thead>
              <tr><th className="due">Date</th><th>Client</th><th>Type</th><th className="num">Couverts</th><th className="num">Montant TTC</th><th>Statut</th><th>Reste à régler</th></tr>
            </thead>
            <tbody>
              {upcoming.map((e) => (
                <tr key={e.id} className="row">
                  <td className="due">{short(e.date)}</td>
                  <td><strong>{e.client}</strong></td>
                  <td>{e.eventType || '—'}</td>
                  <td className="num">{e.guests || '—'}</td>
                  <td className="num">{e.total !== null ? euros(e.total) : '—'}</td>
                  <td>{quoteStatusLabel(e.status)}</td>
                  <td>{e.missing === null ? '—' : e.missing.length === 0 ? 'Prêt' : e.missing.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="two keep">
        <div>
          <h2>Chiffre d’affaires par mois</h2>
          <table className="sheet">
            <thead><tr><th>Mois</th><th className="num">Montant TTC</th><th className="bar-cell" aria-hidden /></tr></thead>
            <tbody>
              {s.months.map((m) => (
                <tr key={m.key} className="row">
                  <td>{m.label}</td>
                  <td className="num">{euros(m.amount)}</td>
                  <td className="bar-cell"><span className="bar" style={{ width: `${Math.round((m.amount / maxMonth) * 100)}%` }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Devis en cours, par étape</h2>
          <table className="sheet">
            <thead><tr><th>Étape</th><th className="num">Devis</th><th className="num">Montant TTC</th></tr></thead>
            <tbody>
              {s.pipeline.length === 0 ? (
                <tr className="row"><td colSpan={3}>Aucun devis en cours.</td></tr>
              ) : s.pipeline.map((p) => (
                <tr key={p.status} className="row"><td>{quoteStatusLabel(p.status)}</td><td className="num">{p.count}</td><td className="num">{euros(p.amount)}</td></tr>
              ))}
            </tbody>
          </table>
          {byKind.length > 0 && (
            <>
              <h2>Tâches par type</h2>
              <table className="sheet">
                <tbody>
                  {byKind.map(([k, n]) => <tr key={k} className="row"><td>{KIND_LABELS[k as TodoKind]}</td><td className="num">{n}</td></tr>)}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>

      <footer className="foot">
        <span>{company} – À faire du {longDate(today, today)}</span>
        <span>Notes : ____________________________________________</span>
      </footer>
    </div>
  );
}

const CSS = `
  @page { size: A4; margin: 12mm 11mm; }
  html, body { background: #fff; }
  .print-root { max-width: 190mm; margin: 0 auto; padding: 24px 0 40px; color: #1C2621; font-family: 'Inter', system-ui, sans-serif; font-size: 11.5px; line-height: 1.4; }
  .print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 2px solid #1C2621; padding-bottom: 10px; margin-bottom: 12px; }
  .head h1 { font-size: 26px; font-weight: 700; margin: 2px 0; }
  .muted { color: #5b6660; margin: 0; }
  .kpis { border-collapse: collapse; min-width: 190px; }
  .kpis th { text-align: left; font-weight: 500; padding: 2px 12px 2px 0; color: #5b6660; }
  .kpis td { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .kpis td.late { color: #B4502D; }
  .kpis tr.total th, .kpis tr.total td { border-top: 1px solid #c9c2b6; padding-top: 4px; color: #1C2621; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 14px; }
  .stats div { border: 1px solid #E6DFD3; border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; break-inside: avoid; }
  .stats span { color: #5b6660; font-size: 10.5px; }
  .stats strong { font-size: 15px; font-variant-numeric: tabular-nums; }
  .stats em { font-style: normal; color: #5b6660; font-size: 10.5px; }
  h2 { font-size: 14px; font-weight: 700; margin: 14px 0 6px; break-after: avoid; }
  .sheet { width: 100%; border-collapse: collapse; }
  .sheet thead th { text-align: left; font-size: 10px; font-weight: 600; color: #5b6660; border-bottom: 1.5px solid #1C2621; padding: 4px 6px; }
  .sheet thead { display: table-header-group; }
  .sheet td { padding: 5px 6px; vertical-align: top; border-bottom: 1px solid #E6DFD3; }
  .sheet tr.row { break-inside: avoid; }
  .sheet tr.group td { font-weight: 700; padding-top: 9px; border-bottom: 1px solid #c9c2b6; break-after: avoid; }
  .sheet tr.group.retard td { color: #B4502D; }
  .sheet .tick { width: 30px; text-align: center; }
  .sheet .due { width: 82px; white-space: nowrap; }
  .sheet .kind { width: 78px; }
  .sheet .where { width: 110px; color: #5b6660; }
  .sheet .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sheet small { color: #5b6660; font-size: 9.5px; }
  .detail { color: #3d4742; margin-top: 2px; }
  .box { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #1C2621; border-radius: 3px; vertical-align: middle; }
  .box.small { width: 10px; height: 10px; border-width: 1px; margin-right: 5px; }
  .missing { list-style: none; padding: 0; margin: 4px 0 0; display: flex; flex-wrap: wrap; gap: 2px 14px; color: #3d4742; }
  .empty { padding: 10px 0; color: #5b6660; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .bar-cell { width: 35%; }
  .bar { display: block; height: 8px; border-radius: 4px; background: #B4502D; min-width: 2px; }
  .keep { break-inside: avoid; }
  .foot { display: flex; justify-content: space-between; gap: 16px; margin-top: 18px; padding-top: 8px; border-top: 1px solid #c9c2b6; color: #5b6660; font-size: 10px; }
  /* La feuille globale ne garde que le devis à l'impression (body * masqué, header caché) : cette page se rend visible. */
  @media print {
    .print-root, .print-root * { visibility: visible !important; }
    .print-root header.head { display: flex !important; }
    .print-toolbar { display: none !important; }
    .print-root { padding: 0; max-width: none; }
    html, body { background: #fff !important; }
  }
  @media screen and (max-width: 640px) { .print-root { padding: 16px; } .stats, .two { grid-template-columns: 1fr; } .head { flex-direction: column; } }
`;
