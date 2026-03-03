'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ChefHat, Loader2, CheckCircle, AlertCircle, Send, Calendar, Users, MapPin, Phone, Mail, User } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Stage = 'loading' | 'invalid' | 'form' | 'success';

interface TokenData {
  token: string;
  is_active: boolean;
  brochure_url: string | null;
}

const EVENT_TYPES = ['Mariage', 'Anniversaire', 'Cocktail', 'Séminaire', 'Gala', 'Communion', 'Baptême', 'Autre'];

// ── Field component ────────────────────────────────────────────────────────────
function Field({
  label, required, children,
}: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-[#9c27b0] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors bg-white';

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProspectFormPage() {
  const params = useParams<{ token: string }>();
  const token  = params?.token ?? '';

  const [stage, setStage]       = useState<Stage>('loading');
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName]       = useState('');
  const [lastName, setLastName]         = useState('');
  const [email, setEmail]               = useState('');
  const [phone, setPhone]               = useState('');
  const [address, setAddress]           = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [eventType, setEventType]       = useState('');
  const [eventDate, setEventDate]       = useState('');
  const [guestCount, setGuestCount]     = useState('');
  const [message, setMessage]           = useState('');

  // Validate token
  useEffect(() => {
    if (!token) { setStage('invalid'); return; }
    const supabase = createClient();
    supabase
      .from('user_prospect_tokens')
      .select('token, is_active, brochure_url')
      .eq('token', token)
      .single()
      .then(({ data }) => {
        if (!data || !data.is_active) {
          setStage('invalid');
        } else {
          setTokenData(data);
          setStage('form');
        }
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Prénom, nom et email sont requis.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.from('prospect_requests').insert({
      first_name:      firstName.trim(),
      last_name:       lastName.trim(),
      email:           email.trim().toLowerCase(),
      phone:           phone.trim() || null,
      address:         address.trim() || null,
      service_address: serviceAddress.trim() || null,
      event_type:      eventType || null,
      event_date:      eventDate || null,
      guest_count:     parseInt(guestCount) || null,
      message:         message.trim() || null,
      user_token:      token,
      status:          'nouveau',
    });

    setSubmitting(false);
    if (err) {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } else {
      setStage('success');
    }
  };

  // ── Loading ──
  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f3e5f5] via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#9c27b0] animate-spin" />
      </div>
    );
  }

  // ── Invalid token ──
  if (stage === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f3e5f5] via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Lien invalide</h2>
          <p className="text-sm text-gray-500">Ce lien de formulaire n&apos;existe pas ou a été désactivé. Contactez directement le prestataire.</p>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f3e5f5] via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-7 w-7 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Demande envoyée !</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Votre demande de devis a bien été reçue. Nous vous contacterons sous 48h pour vous proposer une offre personnalisée.
          </p>
          {tokenData?.brochure_url && (
            <a
              href={tokenData.brochure_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors"
            >
              Télécharger notre brochure
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3e5f5] via-white to-purple-50 py-10 px-4">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #ce93d8, #9c27b0)', boxShadow: '0 8px 24px rgba(156,39,176,0.3)' }}
          >
            <ChefHat className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Demande de devis</h1>
          <p className="text-sm text-gray-500">Remplissez ce formulaire et nous vous recontacterons rapidement.</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">

          {/* Section: Contact */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-[#f3e5f5] rounded-lg flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-[#9c27b0]" />
              </div>
              <h2 className="text-sm font-semibold text-gray-700">Vos coordonnées</h2>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prénom" required>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jean"
                    className={inputCls}
                    required
                  />
                </Field>
                <Field label="Nom" required>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    className={inputCls}
                    required
                  />
                </Field>
              </div>
              <Field label="Email" required>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jean.dupont@email.com"
                    className={inputCls + ' pl-10'}
                    required
                  />
                </div>
              </Field>
              <Field label="Téléphone">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06 00 00 00 00"
                    className={inputCls + ' pl-10'}
                  />
                </div>
              </Field>
              <Field label="Votre adresse">
                <div className="relative">
                  <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="12 rue de la Paix, 75001 Paris"
                    className={inputCls + ' pl-10'}
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Section: Event */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-[#f3e5f5] rounded-lg flex items-center justify-center">
                <Calendar className="h-3.5 w-3.5 text-[#9c27b0]" />
              </div>
              <h2 className="text-sm font-semibold text-gray-700">Votre événement</h2>
            </div>
            <div className="space-y-3">
              <Field label="Type d'événement">
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Sélectionner —</option>
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date prévue">
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Nombre de personnes">
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      value={guestCount}
                      onChange={(e) => setGuestCount(e.target.value)}
                      placeholder="50"
                      min="1"
                      className={inputCls + ' pl-10'}
                    />
                  </div>
                </Field>
              </div>
              <Field label="Lieu de l'événement">
                <div className="relative">
                  <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-[#9c27b0]/60" />
                  <input
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                    placeholder="Salle des fêtes, 75008 Paris"
                    className={inputCls + ' pl-10'}
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Message */}
          <Field label="Message ou précisions">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Décrivez votre projet, vos besoins spécifiques, vos contraintes alimentaires…"
              rows={4}
              className={inputCls + ' resize-none'}
            />
          </Field>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#9c27b0] text-white font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors text-sm shadow-lg shadow-[#9c27b0]/20"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            {submitting ? 'Envoi en cours…' : 'Envoyer ma demande'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Vos données sont utilisées uniquement pour répondre à votre demande.
          </p>
        </div>
      </div>
    </div>
  );
}
