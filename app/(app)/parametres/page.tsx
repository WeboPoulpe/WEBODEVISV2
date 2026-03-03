'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Check, Building2, Upload, X, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import RichTextEditor from '@/components/ui/RichTextEditor';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Profile {
  company_name: string;
  company_address: string;
  company_phone: string;
  siret: string;
  logo_url: string | null;
  cgv: string | null;
}

const DEFAULT_PROFILE: Profile = {
  company_name: '', company_address: '', company_phone: '',
  siret: '', logo_url: null, cgv: null,
};

// ── Field helper ──────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
      />
    </div>
  );
}

// ── Save button helper ────────────────────────────────────────────────────────
function SaveBtn({ loading, saved, onClick }: { loading: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
      {loading ? 'Sauvegarde…' : saved ? 'Enregistré !' : 'Enregistrer'}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ParametresPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Section save states
  const [savingId, setSavingId] = useState(false);
  const [savedId, setSavedId] = useState(false);
  const [savingCgv, setSavingCgv] = useState(false);
  const [savedCgv, setSavedCgv] = useState(false);

  // Logo upload
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // CGV local state (RichTextEditor is uncontrolled — we track HTML separately)
  const [cgvHtml, setCgvHtml] = useState('');

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setProfile({
          company_name: data.company_name ?? '',
          company_address: data.company_address ?? '',
          company_phone: data.company_phone ?? '',
          siret: data.siret ?? '',
          logo_url: data.logo_url ?? null,
          cgv: data.cgv ?? null,
        });
        setCgvHtml(data.cgv ?? '');
      }
      setLoadingProfile(false);
    });
  }, [user]);

  // ── Save identity info ──────────────────────────────────────────────────────
  const saveIdentity = async () => {
    if (!user) return;
    setSavingId(true); setSavedId(false);
    const supabase = createClient();
    await supabase.from('profiles').upsert({
      id: user.id,
      company_name: profile.company_name.trim() || null,
      company_address: profile.company_address.trim() || null,
      company_phone: profile.company_phone.trim() || null,
      siret: profile.siret.trim() || null,
      updated_at: new Date().toISOString(),
    });
    setSavingId(false); setSavedId(true);
    setTimeout(() => setSavedId(false), 2500);
  };

  // ── Logo upload ─────────────────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    const supabase = createClient();
    const path = `logos/${user.id}`;
    const { error } = await supabase.storage.from('storage').upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from('storage').getPublicUrl(path);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').upsert({ id: user.id, logo_url: url, updated_at: new Date().toISOString() });
      setProfile((p) => ({ ...p, logo_url: url }));
    }
    setUploadingLogo(false);
    e.target.value = '';
  };

  const removeLogo = async () => {
    if (!user) return;
    const supabase = createClient();
    await supabase.storage.from('storage').remove([`logos/${user.id}`]);
    await supabase.from('profiles').upsert({ id: user.id, logo_url: null, updated_at: new Date().toISOString() });
    setProfile((p) => ({ ...p, logo_url: null }));
  };

  // ── Save CGV ────────────────────────────────────────────────────────────────
  const saveCgv = async () => {
    if (!user) return;
    setSavingCgv(true); setSavedCgv(false);
    const supabase = createClient();
    await supabase.from('profiles').upsert({
      id: user.id,
      cgv: cgvHtml.trim() || null,
      updated_at: new Date().toISOString(),
    });
    setSavingCgv(false); setSavedCgv(true);
    setTimeout(() => setSavedCgv(false), 2500);
  };

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-0.5">Informations de votre entreprise et préférences</p>
      </div>

      {/* ── Section 1: Identité ─────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="p-2 bg-[#f3e5f5] rounded-lg">
            <Building2 className="h-4 w-4 text-[#9c27b0]" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Identité de l&apos;entreprise</h2>
            <p className="text-xs text-gray-400">Affiché sur tous vos devis</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <Field
            label="Nom de l'entreprise"
            value={profile.company_name}
            onChange={(v) => setProfile((p) => ({ ...p, company_name: v }))}
            placeholder="Traiteur Dupont"
          />
          <Field
            label="Adresse"
            value={profile.company_address}
            onChange={(v) => setProfile((p) => ({ ...p, company_address: v }))}
            placeholder="12 rue des Saveurs, 75001 Paris"
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Téléphone"
              value={profile.company_phone}
              onChange={(v) => setProfile((p) => ({ ...p, company_phone: v }))}
              placeholder="+33 1 23 45 67 89"
            />
            <Field
              label="SIRET"
              value={profile.siret}
              onChange={(v) => setProfile((p) => ({ ...p, siret: v }))}
              placeholder="123 456 789 00012"
            />
          </div>
          <div className="flex justify-end pt-1">
            <SaveBtn loading={savingId} saved={savedId} onClick={saveIdentity} />
          </div>
        </div>
      </section>

      {/* ── Section 2: Logo ─────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="p-2 bg-[#f3e5f5] rounded-lg">
            <Upload className="h-4 w-4 text-[#9c27b0]" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Logo</h2>
            <p className="text-xs text-gray-400">Affiché dans l&apos;en-tête du devis (PNG, JPG, WebP — max 2 Mo)</p>
          </div>
        </div>
        <div className="p-6">
          {profile.logo_url ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.logo_url}
                alt="Logo"
                className="h-16 max-w-[160px] object-contain rounded-lg border border-gray-200 bg-gray-50 p-2"
              />
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Logo actuel</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
                  >
                    Remplacer
                  </button>
                  <button
                    onClick={removeLogo}
                    className="text-xs px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-500 transition-colors flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Supprimer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="flex flex-col items-center justify-center gap-3 w-full border-2 border-dashed border-gray-200 rounded-xl p-8 hover:border-[#9c27b0]/40 hover:bg-[#f3e5f5]/20 transition-all"
            >
              {uploadingLogo
                ? <Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" />
                : <Upload className="h-6 w-6 text-gray-300" />}
              <span className="text-sm text-gray-500">
                {uploadingLogo ? 'Upload en cours…' : 'Cliquer pour uploader votre logo'}
              </span>
            </button>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>
      </section>

      {/* ── Section 3: CGV ──────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="p-2 bg-[#f3e5f5] rounded-lg">
            <FileText className="h-4 w-4 text-[#9c27b0]" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Conditions Générales de Vente</h2>
            <p className="text-xs text-gray-400">Ajoutées en page 2 de tous vos devis PDF</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <RichTextEditor
            initialValue={cgvHtml}
            onChange={setCgvHtml}
            placeholder="Saisir vos CGV ici… (paiement, annulation, responsabilités…)"
            minHeight="200px"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {cgvHtml ? 'Les CGV seront ajoutées en page 2 du PDF.' : 'Aucune CGV renseignée — page 2 absente.'}
            </p>
            <SaveBtn loading={savingCgv} saved={savedCgv} onClick={saveCgv} />
          </div>
        </div>
      </section>
    </div>
  );
}
