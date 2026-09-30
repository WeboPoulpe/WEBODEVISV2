import LoginForm from '@/components/auth/LoginForm';

export const metadata = { title: 'Connexion — WeboDevis' };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — branding ───────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-darker via-primary-darker to-primary flex-col items-center justify-center p-12">
        {/* Cercles décoratifs */}
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full bg-white/5 animate-pulse" />
        <div className="absolute bottom-[-60px] right-[-60px] w-96 h-96 rounded-full bg-white/5 animate-pulse [animation-delay:1000ms]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.03] blur-3xl" />

        <div className="relative z-10 text-center space-y-8 max-w-md">
          <div className="flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-2xl">
              <span className="text-white font-bold text-4xl tracking-tight">W</span>
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white tracking-tight">WeboDevis</h1>
            <p className="text-white/70 text-lg leading-relaxed">
              La plateforme de devis sur-mesure pour les{' '}
              <span className="text-white font-semibold">traiteurs d&apos;exception</span>
            </p>
          </div>
          <div className="space-y-3 text-left">
            {[
              'Devis élégants générés en quelques clics',
              'Gestion complète de vos événements',
              'Suivi client & staffing intégré',
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <span className="text-primary-light text-sm">✦</span>
                <span className="text-white/80 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-lg">
              <span className="text-white font-bold text-2xl">W</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">WeboDevis</h1>
          </div>

          <div className="space-y-6" style={{ animation: 'fadeInUp 0.5s ease-out both' }}>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Bon retour 👋</h2>
              <p className="text-sm text-gray-500 mt-1">Connectez-vous à votre espace traiteur</p>
            </div>
            <LoginForm />
            <p className="text-center text-xs text-gray-400">
              Pas encore de compte ?{' '}
              <a href="/register" className="text-primary hover:underline font-medium">
                Créer un compte
              </a>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
