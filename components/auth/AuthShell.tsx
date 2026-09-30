// Mise en page commune aux écrans de connexion, d'inscription et de mot de passe.
// Grand écran : panneau vert sapin à gauche, formulaire à droite. Téléphone : formulaire seul.

interface AuthShellProps {
  title: string;
  subtitle?: string;
  /** Points affichés dans le panneau de gauche (grand écran). */
  points: string[];
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const authInput =
  'w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-colors';
export const authLabel = 'block text-sm font-medium text-gray-700 mb-1.5';
export const authButton =
  'w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-primary text-white text-[15px] font-semibold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const authError = 'text-sm text-danger bg-white border border-danger/30 rounded-xl px-4 py-3';
export const authInfo = 'text-sm text-sage bg-sage-100 rounded-xl px-4 py-3';

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
        <span className="font-display text-white font-bold text-lg select-none">W</span>
      </div>
      <span className={`font-display font-semibold text-xl ${light ? 'text-white' : 'text-gray-900'}`}>WeboDevis</span>
    </div>
  );
}

export default function AuthShell({ title, subtitle, points, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-[100dvh] flex bg-page">
      <aside className="hidden lg:flex w-[44%] max-w-[560px] m-2 rounded-[20px] bg-forest text-white flex-col justify-between p-10">
        <Brand light />
        <div>
          <p className="font-display text-[40px] font-bold leading-[1.1]">
            Du premier devis au dernier couvert servi.
          </p>
          <ul className="mt-8 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[15px] text-white/80">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/40">WeboDevis, le logiciel des traiteurs</p>
      </aside>

      <main className="flex-1 flex flex-col px-6 py-8 sm:px-10">
        <div className="lg:hidden"><Brand /></div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-[400px] py-10">
            <h1 className="text-[32px] font-bold text-gray-900 leading-tight">{title}</h1>
            {subtitle && <p className="text-[15px] text-gray-600 mt-2">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-sm text-gray-600">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
