import RegisterForm from '@/components/auth/RegisterForm';

export const metadata = { title: 'Créer un compte — WeboDevis' };

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — branding ───────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#3a006f] via-[#6a1080] to-[#9c27b0] flex-col items-center justify-center p-12">
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
              Rejoignez les traiteurs qui font confiance à{' '}
              <span className="text-white font-semibold">WeboDevis</span> pour leurs devis
            </p>
          </div>
          <div className="space-y-3 text-left">
            {[
              '14 jours d\'essai gratuit',
              'Aucune carte bancaire requise',
              'Support inclus dès le premier jour',
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <span className="text-emerald-400 text-sm">✓</span>
                <span className="text-white/80 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#9c27b0] mb-4 shadow-lg">
              <span className="text-white font-bold text-2xl">W</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">WeboDevis</h1>
          </div>

          <div className="space-y-6" style={{ animation: 'fadeInUp 0.5s ease-out both' }}>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Créer votre compte</h2>
              <p className="text-sm text-gray-500 mt-1">Commencez gratuitement, sans engagement</p>
            </div>
            <RegisterForm />
            <p className="text-center text-xs text-gray-400">
              Déjà un compte ?{' '}
              <a href="/login" className="text-[#9c27b0] hover:underline font-medium">
                Se connecter
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
