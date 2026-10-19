'use client';

// Dernier filet : la mise en page elle-même a planté. Pas de feuille de style de l'app ici, d'où les styles en ligne.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3EEE6', fontFamily: 'system-ui, sans-serif', color: '#1f2937', textAlign: 'center', padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0 }}>WeboDevis n’a pas pu s’afficher</h1>
          <p style={{ color: '#4b5563', maxWidth: '40ch', margin: '12px auto 0' }}>
            Vos données ne sont pas touchées. Réessayez dans un instant. Code : {error.digest ?? 'sans code'}.
          </p>
          <button onClick={reset} style={{ marginTop: 24, height: 48, padding: '0 24px', borderRadius: 12, border: 0, background: 'rgb(180 80 45)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
