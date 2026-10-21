import type { ContractDoc } from '@/lib/extraContract';

// Le contrat d'extra en page lisible (aperçu du traiteur, page de signature de l'extra) : le même contenu que le PDF.
export default function ContractView({ doc }: { doc: ContractDoc }) {
  return (
    <div className="text-[15px] leading-relaxed text-gray-800">
      <h2 className="font-display text-xl font-bold text-gray-900 text-center leading-snug">{doc.title}</h2>
      <p className="text-sm text-gray-500 text-center mt-1">{doc.subtitle}</p>

      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        {([['Employeur', doc.employer], ['Salarié', doc.employee]] as const).map(([label, p]) => (
          <div key={label} className="rounded-2xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
            <p className="font-semibold text-gray-900 mt-0.5">{p.name}</p>
            {p.lines.map((l) => <p key={l} className="text-sm text-gray-600">{l}</p>)}
          </div>
        ))}
      </div>

      <ol className="mt-5 space-y-4">
        {doc.articles.map((a, i) => (
          <li key={a.title}>
            <h3 className="font-semibold text-gray-900">Article {i + 1}. {a.title}</h3>
            {a.paragraphs.map((p, j) => <p key={j} className="mt-1 whitespace-pre-line">{p}</p>)}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-gray-600">{doc.madeAt}</p>
      <p className="text-sm text-gray-600">Pour l’employeur : {doc.employerSigner}</p>
    </div>
  );
}
