import { Check, Lock } from 'lucide-react';
import Wordmark from '@/components/brand/Wordmark';

// Mise en page commune aux écrans de connexion, d'inscription et de mot de passe.
// Fond vert sapin avec le nom de la marque ; le formulaire est posé dessus sur un panneau clair.

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const authInput =
  'w-full h-[52px] px-4 bg-white border border-gray-200 rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100 transition-colors';
export const authLabel = 'block text-sm font-medium text-gray-700 mb-2';
export const authButton =
  'w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-primary text-white text-base font-semibold hover:bg-primary-dark active:scale-[0.99] disabled:opacity-60 transition';
export const authError = 'text-sm text-danger bg-white border border-danger/30 rounded-2xl px-4 py-3';
export const authInfo = 'text-sm text-sage bg-sage-100 rounded-2xl px-4 py-3';

const heroBackground = {
  background:
    'radial-gradient(70% 55% at 90% 0%, rgb(var(--p-700) / 0.42), transparent 70%),' +
    'radial-gradient(60% 50% at 0% 100%, rgb(var(--sage) / 0.55), transparent 72%),' +
    'rgb(var(--forest))',
};

/** Aperçu du produit : trois fragments d'écran, avec des données d'exemple. */
function ProductPreview() {
  const glass = 'rounded-3xl bg-white/[0.07] border border-white/10 backdrop-blur-md';
  return (
    <div className="relative w-full max-w-[520px] h-[330px]" aria-hidden>
      {/* Prochain événement */}
      <div className={`${glass} absolute left-0 top-6 w-[340px] p-5`}>
        <p className="text-sm text-white/60">Prochain événement</p>
        <div className="flex items-center gap-4 mt-4">
          <div className="w-14 h-14 rounded-2xl bg-white flex flex-col items-center justify-center flex-shrink-0">
            <span className="font-display text-xl font-bold text-gray-900 leading-none">14</span>
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-1 leading-none">Juin 27</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">Mariage Léa &amp; Hugo</p>
            <div className="flex gap-1.5 mt-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-primary/80 text-white text-xs font-medium">Mariage</span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-xs font-medium">140 couverts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chiffre d'affaires */}
      <div className="absolute right-0 top-0 w-[200px] rounded-3xl bg-white p-5 shadow-float">
        <p className="text-sm text-gray-600">CA ce mois</p>
        <p className="font-display text-[28px] font-bold text-gray-900 tabular-nums leading-none mt-4">48 660 €</p>
        <div className="flex items-end gap-1.5 h-10 mt-4">
          {[38, 52, 44, 70, 62, 100].map((h, i) => (
            <div key={i} className={`flex-1 rounded-md ${i === 5 ? 'bg-primary' : 'bg-primary-200'}`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      {/* Checklist */}
      <div className={`${glass} absolute left-16 bottom-0 w-[320px] p-5`}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Préparation</span>
          <span className="font-semibold text-white tabular-nums">8 sur 12</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/15 mt-3 overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-primary-400" />
        </div>
        <ul className="mt-4 space-y-2.5 text-sm">
          <li className="flex items-center gap-2.5 text-white/50 line-through">
            <span className="w-5 h-5 rounded-full bg-primary-400 flex items-center justify-center"><Check className="h-3 w-3 text-forest" strokeWidth={3} /></span>
            Commander la vaisselle
          </li>
          <li className="flex items-center gap-2.5 text-white">
            <span className="w-5 h-5 rounded-full border border-white/40" />
            Confirmer les extras
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row" style={heroBackground}>
      {/* Marque et promesse */}
      <section className="flex flex-col lg:flex-1 lg:min-h-[100dvh] px-6 pt-[max(28px,env(safe-area-inset-top))] pb-9 lg:p-12 xl:p-16 text-white">
        <Wordmark className="text-[26px] lg:text-[30px] text-white" />
        <div className="mt-10 lg:my-auto lg:py-12">
          <p className="font-display text-[34px] sm:text-[44px] xl:text-[56px] font-bold leading-[1.05] tracking-[-0.02em] max-w-[14ch] lg:max-w-[13ch]">
            Du premier devis au dernier couvert servi.
          </p>
          <p className="hidden lg:block text-lg text-white/65 mt-5 max-w-[44ch]">
            Devis, événements, courses et équipe : tout le métier de traiteur dans un seul outil.
          </p>
          <div className="hidden lg:block mt-12"><ProductPreview /></div>
        </div>
        <p className="hidden lg:block text-sm text-white/40">Le logiciel des traiteurs.</p>
      </section>

      {/* Formulaire */}
      <main className="flex-1 lg:flex-none lg:w-[520px] xl:w-[560px] flex bg-page rounded-t-[32px] lg:rounded-[28px] lg:m-2.5 px-6 sm:px-10 pt-8 pb-[max(32px,env(safe-area-inset-bottom))] lg:p-12">
        <div className="w-full max-w-[420px] mx-auto lg:my-auto">
          <h1 className="text-[30px] font-bold text-gray-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-base text-gray-600 mt-2">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-[15px] text-gray-600">{footer}</div>}
          <p className="flex items-center gap-2 mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
            <Lock className="h-4 w-4" strokeWidth={1.8} />
            Connexion sécurisée. Vos données ne sont visibles que par vous.
          </p>
        </div>
      </main>
    </div>
  );
}
