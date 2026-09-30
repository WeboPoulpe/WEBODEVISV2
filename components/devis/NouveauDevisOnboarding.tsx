'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Loader2, Heart, PartyPopper, UtensilsCrossed, Wine, Music, Briefcase,
  User, ArrowLeft, Sparkles, Search, Building2, Baby,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const EVENT_TYPES = [
  { key: 'Mariage', label: 'Mariage', icon: Heart },
  { key: 'Cocktail', label: 'Cocktail', icon: Wine },
  { key: 'Anniversaire', label: 'Anniversaire', icon: PartyPopper },
  { key: 'Séminaire', label: 'Séminaire', icon: Briefcase },
  { key: 'Gala', label: 'Gala', icon: Music },
  { key: 'Communion', label: 'Communion', icon: UtensilsCrossed },
  { key: 'Baptême', label: 'Baptême', icon: Baby },
  { key: 'Autre', label: 'Autre', icon: Sparkles },
];

const TEMPLATES = [
  { key: 'standard', label: 'Standard', color: '#9c27b0', desc: 'Classique, accent violet' },
  { key: 'mariage', label: 'Mariage', color: '#c8956c', desc: 'Doré, chaleureux' },
  { key: 'business', label: 'Business', color: '#1e293b', desc: 'Sobre, pour les entreprises' },
];

export default function NouveauDevisOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1 = event, 2 = client, 3 = template
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<{ id: string; first_name: string | null; last_name: string | null; email: string; phone: string | null; company_name: string | null; customer_type: string }[]>([]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [template, setTemplate] = useState<'standard' | 'mariage' | 'business'>('standard');
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');

  const canNext1 = !!eventType && !!eventDate && !!guestCount;

  // Client search
  const searchCustomers = useCallback(async (q: string) => {
    setClientSearch(q);
    if (!q.trim() || q.length < 2) { setClientResults([]); setShowCustomerPicker(false); return; }
    const supabase = createClient();
    const { data } = await supabase.from('customers')
      .select('id, first_name, last_name, email, phone, company_name, customer_type')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`)
      .limit(8);
    setClientResults(data || []);
    setShowCustomerPicker(true);
  }, []);

  const selectCustomer = (c: typeof clientResults[number]) => {
    const fullName = c.customer_type === 'entreprise' && c.company_name
      ? c.company_name
      : [c.first_name, c.last_name].filter(Boolean).join(' ');
    setClientName(fullName);
    setClientEmail(c.email || '');
    setClientPhone(c.phone || '');
    setSelectedCustomerId(c.id);
    setShowCustomerPicker(false);
    setClientSearch(fullName);
  };

  const resetClient = () => {
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientAddress('');
    setSelectedCustomerId(null);
    setClientSearch('');
  };
  const canNext2 = !!clientName.trim();
  const canFinish = !!template;

  const createQuote = async () => {
    if (!user || !canFinish) return;
    setCreating(true);
    setError(null);
    const supabase = createClient();
    const nameParts = clientName.trim().split(' ');
    const cFirst = nameParts[0] || '';
    const cLast = nameParts.slice(1).join(' ') || '';

    // If "new client" mode and email is provided, create the customer in DB
    let customerId = selectedCustomerId;
    if (mode === 'new' && clientName.trim() && clientEmail.trim()) {
      const { data: existing } = await supabase.from('customers')
        .select('id').eq('email', clientEmail.toLowerCase()).maybeSingle();
      if (existing) {
        customerId = existing.id;
      } else {
        const { data: newCustomer } = await supabase.from('customers').insert({
          user_id: user.id,
          owner_user_id: user.id,
          first_name: cFirst,
          last_name: cLast,
          email: clientEmail.toLowerCase(),
          phone: clientPhone || null,
          customer_type: 'particulier',
        }).select('id').single();
        if (newCustomer) customerId = newCustomer.id;
      }
    }

    // Dossier d'arrivée : celui ouvert dans la liste des devis (/devis/nouveau?dossier=…)
    const folderId = new URLSearchParams(window.location.search).get('dossier');

    const { data, error } = await supabase.from('quotes').insert({
      user_id: user.id,
      owner_user_id: user.id,
      customer_id: customerId,
      folder_id: folderId,
      client_name: clientName.trim(),
      client_first_name: cFirst || null,
      client_last_name: cLast || null,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      status: 'devis_a_faire',
      services: [],
      event_type: eventType,
      event_date: eventDate,
      event_location: eventLocation || '',
      guest_count: parseInt(guestCount) || 1,
      template,
      language,
      vat_rate: 20,
      hide_price: false,
    }).select('id').single();

    if (error || !data) {
      setError('Le devis n’a pas pu être créé. Vérifiez la date et le nombre de couverts, puis réessayez.');
      setCreating(false);
      return;
    }
    // Direct redirect to WeboWord
    router.push(`/devis/${data.id}/modifier?mode=weboword`);
  };

  const STEPS = ['Événement', 'Client', 'Style'];
  const input = 'w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100 transition-colors';
  const label = 'block text-sm font-medium text-gray-700 mb-2';
  const choice = (active: boolean) => cn('border rounded-2xl transition-colors',
    active ? 'border-primary bg-primary-50 ring-1 ring-primary' : 'border-gray-200 bg-white hover:border-gray-300');

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="w-full max-w-[680px] mx-auto">
        {/* Titre et étapes */}
        <div className="mb-5">
          <h1 className="text-[28px] md:text-[36px] font-bold text-gray-900 leading-tight">Nouveau devis</h1>
          <ol className="flex gap-2 mt-4" aria-label="Étapes">
            {STEPS.map((name, i) => {
              const n = i + 1;
              return (
                <li key={name} className="flex-1" aria-current={n === step ? 'step' : undefined}>
                  <div className={cn('h-1.5 rounded-full transition-colors', n <= step ? 'bg-primary' : 'bg-gray-200')} />
                  <p className={cn('text-sm mt-2', n === step ? 'font-semibold text-gray-900' : 'text-gray-500')}>{n}. {name}</p>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="bg-white border border-gray-200 rounded-3xl">
          <div className="p-5 sm:p-8">
            {/* ÉTAPE 1 — Événement */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Quel événement préparez-vous ?</h2>
                  <p className="text-[15px] text-gray-600 mt-1">Le type, la date et le nombre de couverts suffisent pour commencer.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {EVENT_TYPES.map(({ key, label: name, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setEventType(key)}
                      aria-pressed={eventType === key}
                      className={cn(choice(eventType === key), 'flex items-center sm:flex-col sm:items-start gap-3 p-3.5 text-left')}
                    >
                      <Icon className={cn('h-5 w-5', eventType === key ? 'text-primary' : 'text-gray-500')} strokeWidth={1.8} />
                      <span className={cn('text-[15px] font-medium', eventType === key ? 'text-primary' : 'text-gray-900')}>{name}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="nd-date" className={label}>Date</label>
                    <input id="nd-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={input} />
                  </div>
                  <div>
                    <label htmlFor="nd-guests" className={label}>Couverts</label>
                    <input id="nd-guests" type="number" inputMode="numeric" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} placeholder="120" className={input} />
                  </div>
                </div>

                <div>
                  <label htmlFor="nd-place" className={label}>Lieu <span className="font-normal text-gray-500">(facultatif)</span></label>
                  <input id="nd-place" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Château de Villebougis" className={input} />
                </div>
              </div>
            )}

            {/* ÉTAPE 2 — Client */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Pour quel client ?</h2>
                  <p className="text-[15px] text-gray-600 mt-1">Choisissez un client de votre carnet ou créez-le maintenant.</p>
                </div>

                <div className="flex p-1 rounded-xl bg-gray-100" role="tablist">
                  {([['existing', 'Client existant'], ['new', 'Nouveau client']] as ['existing' | 'new', string][]).map(([key, name]) => (
                    <button key={key} role="tab" aria-selected={mode === key} onClick={() => { setMode(key); resetClient(); }}
                      className={cn('flex-1 h-10 rounded-lg text-sm font-medium transition-colors', mode === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
                      {name}
                    </button>
                  ))}
                </div>

                {mode === 'existing' && (
                  <>
                    <div className="relative">
                      <label htmlFor="nd-search" className={label}>Rechercher un client</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input id="nd-search" autoFocus value={clientSearch} onChange={(e) => searchCustomers(e.target.value)} placeholder="Nom, email ou entreprise" className={cn(input, 'pl-11')} />
                      </div>
                      {showCustomerPicker && clientResults.length > 0 && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-float max-h-60 overflow-y-auto py-1.5">
                          {clientResults.map((c) => (
                            <button key={c.id} onClick={() => selectCustomer(c)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                              <span className="w-9 h-9 rounded-full bg-primary-100 text-primary flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                                {c.customer_type === 'entreprise' ? <Building2 className="h-4 w-4" /> : (c.first_name?.[0] || c.email[0]).toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-gray-900 truncate">
                                  {c.customer_type === 'entreprise' && c.company_name ? c.company_name : [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
                                </span>
                                <span className="block text-xs text-gray-500 truncate">{[c.email, c.phone].filter(Boolean).join(', ')}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {showCustomerPicker && clientResults.length === 0 && clientSearch.length >= 2 && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-float px-4 py-4">
                          <p className="text-sm text-gray-600">Aucun client ne correspond à « {clientSearch} ».</p>
                          <button onClick={() => { setMode('new'); setClientName(clientSearch); setClientSearch(''); setShowCustomerPicker(false); }}
                            className="text-sm font-medium text-primary hover:underline mt-1">
                            Créer ce client
                          </button>
                        </div>
                      )}
                    </div>

                    {selectedCustomerId && (
                      <div className="flex items-center gap-3 p-4 rounded-2xl bg-sage-100">
                        <span className="w-11 h-11 rounded-full bg-white text-sage flex items-center justify-center flex-shrink-0"><User className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-gray-900 truncate">{clientName}</span>
                          <span className="block text-sm text-gray-600 truncate">{[clientEmail, clientPhone].filter(Boolean).join(', ')}</span>
                        </span>
                        <button onClick={resetClient} className="text-sm font-medium text-primary hover:underline">Changer</button>
                      </div>
                    )}
                  </>
                )}

                {mode === 'new' && (
                  <>
                    <div>
                      <label htmlFor="nd-name" className={label}>Nom complet</label>
                      <input id="nd-name" autoFocus value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Jean Dupont" autoComplete="off" className={input} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="nd-email" className={label}>Email</label>
                        <input id="nd-email" type="email" inputMode="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="jean@email.com" className={input} />
                      </div>
                      <div>
                        <label htmlFor="nd-phone" className={label}>Téléphone</label>
                        <input id="nd-phone" type="tel" inputMode="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="06 12 34 56 78" className={input} />
                      </div>
                    </div>
                  </>
                )}

                <p className="text-sm text-gray-500">L’adresse et les autres informations se complètent ensuite dans le devis, panneau Client.</p>
              </div>
            )}

            {/* ÉTAPE 3 — Style */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Quel style pour ce devis ?</h2>
                  <p className="text-[15px] text-gray-600 mt-1">Vous pourrez en changer à tout moment dans le devis, panneau Style.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {TEMPLATES.map((t) => (
                    <button key={t.key} onClick={() => setTemplate(t.key as 'standard' | 'mariage' | 'business')} aria-pressed={template === t.key}
                      className={cn(choice(template === t.key), 'flex items-center sm:flex-col sm:items-start gap-3 p-4 text-left')}>
                      {/* Aperçu : une page avec la couleur d'accent du modèle */}
                      <span className="w-12 h-16 sm:w-full sm:h-24 rounded-lg bg-gray-50 border border-gray-200 p-2 flex flex-col gap-1.5 flex-shrink-0">
                        <span className="h-1.5 w-2/3 rounded-full" style={{ background: t.color }} />
                        <span className="h-1 w-full rounded-full bg-gray-200" />
                        <span className="h-1 w-5/6 rounded-full bg-gray-200" />
                        <span className="hidden sm:block h-1 w-3/4 rounded-full bg-gray-200" />
                      </span>
                      <span>
                        <span className="block font-semibold text-gray-900">{t.label}</span>
                        <span className="block text-sm text-gray-600">{t.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <p className={label}>Langue du devis</p>
                  <div className="flex p-1 rounded-xl bg-gray-100" role="tablist">
                    {([['fr', 'Français'], ['en', 'English']] as ['fr' | 'en', string][]).map(([key, name]) => (
                      <button key={key} role="tab" aria-selected={language === key} onClick={() => setLanguage(key)}
                        className={cn('flex-1 h-10 rounded-lg text-sm font-medium transition-colors', language === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
                        {name}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Les prestations utilisent leur traduction quand elle existe.</p>
                </div>
              </div>
            )}

            {error && <p role="alert" className="mt-6 text-sm text-danger bg-white border border-danger/30 rounded-xl px-4 py-3">{error}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 px-5 sm:px-8 py-4 border-t border-gray-200">
            <button
              onClick={() => (step > 1 ? setStep(step - 1) : router.push('/devis'))}
              className="flex items-center gap-2 h-11 px-3 -ml-3 rounded-xl text-[15px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 1 ? 'Annuler' : 'Précédent'}
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
                className="flex items-center gap-2 h-11 px-6 bg-primary text-white text-[15px] font-semibold rounded-xl hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continuer
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={createQuote}
                disabled={creating || !canFinish}
                className="flex items-center gap-2 h-11 px-6 bg-primary text-white text-[15px] font-semibold rounded-xl hover:bg-primary-dark disabled:opacity-40 transition-colors"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer le devis
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
