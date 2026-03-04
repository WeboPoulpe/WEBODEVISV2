'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

type ClientType = 'particulier' | 'entreprise';

interface FormState {
  type: ClientType;
  firstName: string;
  lastName: string;
  companyName: string;
  siretNumber: string;
  contactPersonName: string;
  contactPersonEmail: string;
  contactPersonPhone: string;
  email: string;
  phone: string;
  address: string;
  serviceAddress: string;
}

const INITIAL: FormState = {
  type: 'particulier',
  firstName: '',
  lastName: '',
  companyName: '',
  siretNumber: '',
  contactPersonName: '',
  contactPersonEmail: '',
  contactPersonPhone: '',
  email: '',
  phone: '',
  address: '',
  serviceAddress: '',
};

export default function ClientForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: err } = await supabase.from('customers').insert([
      {
        owner_user_id: user.id,
        customer_type: form.type,
        first_name: form.firstName || null,
        last_name: form.lastName || null,
        company_name: form.companyName || null,
        siret_number: form.siretNumber || null,
        contact_person_name: form.contactPersonName || null,
        contact_person_email: form.contactPersonEmail || null,
        contact_person_phone: form.contactPersonPhone || null,
        email: form.email,
        phone: form.phone || null,
        address: form.address || null,
        service_address: form.serviceAddress || null,
      },
    ]);

    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      router.push('/clients');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Type */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Type de client</h3>
        <div className="flex gap-2">
          {(['particulier', 'entreprise'] as ClientType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set('type', t)}
              className={[
                'px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors',
                form.type === t
                  ? 'bg-[#9c27b0] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Identity */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Identité</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {form.type === 'particulier' ? (
            <>
              <Field
                label="Prénom *"
                value={form.firstName}
                onChange={(v) => set('firstName', v)}
                placeholder="Jean"
              />
              <Field
                label="Nom *"
                value={form.lastName}
                onChange={(v) => set('lastName', v)}
                placeholder="Dupont"
              />
            </>
          ) : (
            <>
              <div className="sm:col-span-2">
                <Field
                  label="Nom de l'entreprise *"
                  value={form.companyName}
                  onChange={(v) => set('companyName', v)}
                  placeholder="SARL Dupont"
                />
              </div>
              <Field
                label="Numéro SIRET"
                value={form.siretNumber}
                onChange={(v) => set('siretNumber', v)}
                placeholder="12345678900001"
              />
              <Field
                label="Personne de contact"
                value={form.contactPersonName}
                onChange={(v) => set('contactPersonName', v)}
                placeholder="Jean Dupont"
              />
              <Field
                label="Email de contact"
                type="email"
                value={form.contactPersonEmail}
                onChange={(v) => set('contactPersonEmail', v)}
                placeholder="contact@entreprise.fr"
              />
              <Field
                label="Téléphone de contact"
                value={form.contactPersonPhone}
                onChange={(v) => set('contactPersonPhone', v)}
                placeholder="06 00 00 00 00"
              />
            </>
          )}
        </div>
      </section>

      {/* Contact */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Coordonnées</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Email *"
            type="email"
            value={form.email}
            onChange={(v) => set('email', v)}
            placeholder="jean@exemple.fr"
            required
          />
          <Field
            label="Téléphone"
            value={form.phone}
            onChange={(v) => set('phone', v)}
            placeholder="06 00 00 00 00"
          />
          <div className="sm:col-span-2">
            <Field
              label="Adresse principale"
              value={form.address}
              onChange={(v) => set('address', v)}
              placeholder="12 rue de la Paix, 75001 Paris"
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Adresse de prestation"
              value={form.serviceAddress}
              onChange={(v) => set('serviceAddress', v)}
              placeholder="Lieu de l'événement"
            />
          </div>
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enregistrement…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Créer le client
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ── Shared input ──────────────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
      />
    </div>
  );
}
