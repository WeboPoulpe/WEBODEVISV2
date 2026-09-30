'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, Check, Upload, FileText, CalendarDays, Users, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import ImageUpload from '@/components/ui/ImageUpload';

interface Props {
  userId: string;
}

export default function OnboardingOverlay({ userId }: Props) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 2 form state
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [vatRate, setVatRate] = useState('20');
  const [logoUrls, setLogoUrls] = useState<string[]>([]);

  const complete = async (next?: string) => {
    setSaving(true);
    await createClient()
      .from('profiles')
      .update({
        has_completed_onboarding: true,
        ...(companyName.trim() && { company_name: companyName.trim() }),
        ...(companyAddress.trim() && { company_address: companyAddress.trim() }),
        ...(vatRate && { default_vat_rate: parseInt(vatRate) }),
        ...(logoUrls[0] && { logo_url: logoUrls[0] }),
      })
      .eq('id', userId);
    await refreshProfile();
    setSaving(false);
    if (next) router.push(next);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto">

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-gradient-to-r from-primary-darker to-primary transition-all duration-500"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Step 1 — Bienvenue */}
        {step === 1 && (
          <div className="p-8 text-center space-y-6">
            <div className="flex items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-darker to-primary flex items-center justify-center shadow-xl animate-[fadeInDown_0.4s_ease-out]">
                <span className="text-white font-bold text-4xl">W</span>
              </div>
            </div>
            <div className="space-y-2 animate-[fadeInUp_0.4s_ease-out_0.1s_both]">
              <h1 className="text-2xl font-bold text-gray-900">Bienvenue sur WeboDevis !</h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                La plateforme de devis pensée pour les traiteurs. En 2 minutes, vous serez prêt à créer vos premiers devis professionnels.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center animate-[fadeInUp_0.4s_ease-out_0.2s_both]">
              {[
                { icon: FileText, label: 'Devis soignés' },
                { icon: CalendarDays, label: 'Suivi des événements' },
                { icon: Users, label: 'Équipes d’extras' },
              ].map((f) => (
                <div key={f.label} className="p-3 bg-primary-50 rounded-xl">
                  <f.icon className="h-6 w-6 mx-auto mb-1.5 text-primary" aria-hidden />
                  <p className="text-xs font-medium text-gray-700">{f.label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors animate-[fadeInUp_0.4s_ease-out_0.3s_both]"
            >
              Commencer la configuration
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 2 — Profil traiteur */}
        {step === 2 && (
          <div className="p-8 space-y-5">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Étape 2/3</p>
              <h2 className="text-xl font-bold text-gray-900">Votre profil traiteur</h2>
              <p className="text-sm text-gray-500 mt-1">Ces informations apparaîtront sur vos devis.</p>
            </div>

            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Logo de l&apos;entreprise</label>
              <ImageUpload images={logoUrls} onChange={setLogoUrls} userId={userId} max={1} bucket="storage" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l&apos;entreprise</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Traiteur Dupont & Associés"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input
                type="text"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="12 rue de la Gastronomie, 75001 Paris"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Taux de TVA par défaut</label>
              <div className="flex gap-2">
                {['0', '5.5', '10', '20'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setVatRate(r)}
                    className={[
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      vatRate === r ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    ].join(' ')}
                  >
                    {r === '0' ? 'Exo.' : `${r}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Retour
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
              >
                Continuer <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Guide rapide */}
        {step === 3 && (
          <div className="p-8 space-y-5">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Étape 3/3</p>
              <h2 className="text-xl font-bold text-gray-900">Prêt à démarrer !</h2>
              <p className="text-sm text-gray-500 mt-1">Par où commencer : choisissez, ou fermez pour arriver au tableau de bord.</p>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: FileText,
                  title: 'Créer votre premier devis',
                  desc: 'Un modèle, votre client, vos prestations : le document se remplit tout seul.',
                  href: '/devis/nouveau',
                },
                {
                  icon: UtensilsCrossed,
                  title: 'Remplir votre catalogue',
                  desc: 'Vos prestations habituelles, à ajouter ensuite à chaque devis en un clic.',
                  href: '/prestations',
                },
                {
                  icon: Users,
                  title: 'Enregistrer vos extras',
                  desc: 'Vos serveurs et cuisiniers, à affecter ensuite à vos événements.',
                  href: '/extras',
                },
              ].map((item: { icon: LucideIcon; title: string; desc: string; href: string }) => (
                <button key={item.title} type="button" onClick={() => complete(item.href)} disabled={saving}
                  className="w-full flex items-start gap-3 p-3 bg-gray-50 hover:bg-primary-50 rounded-xl text-left transition-colors disabled:opacity-60">
                  <item.icon className="h-6 w-6 flex-shrink-0 text-primary mt-0.5" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" aria-hidden />
                </button>
              ))}
            </div>

            <button
              onClick={() => complete()}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-colors"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Finalisation…</>
              ) : (
                <><Check className="h-4 w-4" /> Commencer à utiliser WeboDevis</>
              )}
            </button>
          </div>
        )}

      </div>

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
