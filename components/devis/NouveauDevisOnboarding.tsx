'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, Loader2, Heart, PartyPopper, UtensilsCrossed, Wine, Music, Briefcase,
  Users, MapPin, Calendar, User, ArrowLeft, Sparkles, Search, Building2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const EVENT_TYPES = [
  { key: 'Mariage', label: 'Mariage', icon: Heart, color: 'from-pink-500 to-rose-500' },
  { key: 'Cocktail', label: 'Cocktail', icon: Wine, color: 'from-amber-500 to-orange-500' },
  { key: 'Anniversaire', label: 'Anniversaire', icon: PartyPopper, color: 'from-purple-500 to-fuchsia-500' },
  { key: 'Séminaire', label: 'Séminaire', icon: Briefcase, color: 'from-slate-500 to-slate-700' },
  { key: 'Gala', label: 'Gala', icon: Music, color: 'from-indigo-500 to-purple-600' },
  { key: 'Communion', label: 'Communion', icon: UtensilsCrossed, color: 'from-sky-400 to-blue-600' },
  { key: 'Baptême', label: 'Baptême', icon: UtensilsCrossed, color: 'from-cyan-400 to-teal-500' },
  { key: 'Autre', label: 'Autre', icon: Sparkles, color: 'from-gray-400 to-gray-600' },
];

const TEMPLATES = [
  { key: 'standard', label: 'Standard', color: '#9c27b0', desc: 'Violet élégant' },
  { key: 'mariage', label: 'Mariage', color: '#c8956c', desc: 'Doré chaleureux' },
  { key: 'business', label: 'Business', color: '#1e293b', desc: 'Sobre et pro' },
];

export default function NouveauDevisOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1 = event, 2 = client, 3 = template
  const [creating, setCreating] = useState(false);

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
          first_name: cFirst,
          last_name: cLast,
          email: clientEmail.toLowerCase(),
          phone: clientPhone || null,
          customer_type: 'particulier',
        }).select('id').single();
        if (newCustomer) customerId = newCustomer.id;
      }
    }

    const { data, error } = await supabase.from('quotes').insert({
      user_id: user.id,
      owner_user_id: user.id,
      customer_id: customerId,
      client_name: clientName.trim(),
      client_first_name: cFirst || null,
      client_last_name: cLast || null,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      status: 'draft',
      services: [],
      event_type: eventType,
      event_date: eventDate,
      event_location: eventLocation || '',
      guest_count: parseInt(guestCount) || 1,
      template,
      vat_rate: 20,
      hide_price: false,
    }).select('id').single();

    if (error || !data) {
      alert('Erreur création devis: ' + (error?.message || 'inconnu'));
      setCreating(false);
      return;
    }
    // Direct redirect to WeboWord
    router.push(`/devis/${data.id}/modifier?mode=weboword`);
  };

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gradient-to-br from-[#faf5ff] via-white to-[#fff7ed]">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="bg-gradient-to-r from-[#9c27b0] to-[#7b1fa2] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/devis" className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-white font-bold text-lg">Nouveau devis</h1>
              <p className="text-white/70 text-xs">Étape {step}/3 — {step === 1 ? 'Événement' : step === 2 ? 'Client' : 'Style'}</p>
            </div>
          </div>
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div key={s} className={cn('w-2 h-2 rounded-full transition-all', s === step ? 'bg-white w-6' : s < step ? 'bg-white/60' : 'bg-white/20')} />
            ))}
          </div>
        </div>

        <div className="p-8 min-h-[400px]">
          {/* STEP 1 — Event */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Quel type d&apos;événement ?</h2>
                <p className="text-sm text-gray-500 mt-1">Sélectionnez le type d&apos;événement que vous allez organiser</p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {EVENT_TYPES.map(({ key, label, icon: Icon, color }) => (
                  <button
                    key={key}
                    onClick={() => setEventType(key)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                      eventType === key ? 'border-[#9c27b0] bg-[#faf5ff] shadow-sm scale-105' : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br', color)}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className={cn('text-xs font-medium', eventType === key ? 'text-[#9c27b0]' : 'text-gray-700')}>{label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    <Users className="h-3 w-3 inline mr-1" />
                    Couverts
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    placeholder="120"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  <MapPin className="h-3 w-3 inline mr-1" />
                  Lieu (optionnel)
                </label>
                <input
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Château de Villebougis"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                />
              </div>
            </div>
          )}

          {/* STEP 2 — Client */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Pour quel client ?</h2>
                <p className="text-sm text-gray-500 mt-1">Sélectionnez un client existant ou créez-en un nouveau.</p>
              </div>

              {/* Tabs: Existant vs Nouveau */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => { setMode('existing'); resetClient(); }}
                  className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
                    mode === 'existing' ? 'bg-white shadow-sm text-[#9c27b0]' : 'text-gray-500 hover:text-gray-700')}
                >
                  <Search className="h-3.5 w-3.5" />
                  Client existant
                </button>
                <button
                  onClick={() => { setMode('new'); resetClient(); }}
                  className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
                    mode === 'new' ? 'bg-white shadow-sm text-[#9c27b0]' : 'text-gray-500 hover:text-gray-700')}
                >
                  <User className="h-3.5 w-3.5" />
                  Nouveau client
                </button>
              </div>

              {/* EXISTING CLIENT — Search */}
              {mode === 'existing' && (
                <>
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Rechercher un client
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        autoFocus
                        value={clientSearch}
                        onChange={(e) => searchCustomers(e.target.value)}
                        placeholder="Nom, email, entreprise…"
                        className="w-full text-sm border border-gray-200 rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                      />
                    </div>
                    {showCustomerPicker && clientResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                        {clientResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#faf5ff] transition-colors text-left border-b border-gray-50 last:border-0"
                          >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9c27b0] to-[#7b1fa2] flex items-center justify-center flex-shrink-0">
                              {c.customer_type === 'entreprise'
                                ? <Building2 className="h-4 w-4 text-white" />
                                : <span className="text-sm font-bold text-white">{(c.first_name?.[0] || c.email[0]).toUpperCase()}</span>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {c.customer_type === 'entreprise' && c.company_name
                                  ? c.company_name
                                  : [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
                              </p>
                              <p className="text-xs text-gray-400 truncate">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showCustomerPicker && clientResults.length === 0 && clientSearch.length >= 2 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-4 text-center">
                        <p className="text-xs text-gray-400">Aucun client trouvé.</p>
                        <button onClick={() => { setMode('new'); setClientName(clientSearch); setClientSearch(''); setShowCustomerPicker(false); }}
                          className="text-xs text-[#9c27b0] hover:underline mt-1 font-medium">
                          Créer « {clientSearch} » comme nouveau client
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Selected client preview */}
                  {selectedCustomerId && (
                    <div className="bg-[#faf5ff] border border-[#9c27b0]/20 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9c27b0] to-[#7b1fa2] flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 truncate">{clientName}</p>
                          <p className="text-xs text-gray-500 truncate">{clientEmail}{clientPhone ? ` · ${clientPhone}` : ''}</p>
                        </div>
                        <button onClick={resetClient} className="text-xs text-gray-400 hover:text-red-500">Changer</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* NEW CLIENT — Form */}
              {mode === 'new' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      <User className="h-3 w-3 inline mr-1" />
                      Nom complet *
                    </label>
                    <input
                      autoFocus
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Jean Dupont"
                      className="w-full text-base border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                      <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="jean@email.com"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Téléphone</label>
                      <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="06 12 34 56 78"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
                    </div>
                  </div>
                </>
              )}

              <p className="text-xs text-gray-400 italic">💡 Vous pourrez modifier ces infos et ajouter une adresse depuis le panneau Client du WeboWord.</p>
            </div>
          )}

          {/* STEP 3 — Template */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Choisissez votre style</h2>
                <p className="text-sm text-gray-500 mt-1">Vous pourrez le changer plus tard depuis le panneau Style.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTemplate(t.key as 'standard' | 'mariage' | 'business')}
                    className={cn(
                      'flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all',
                      template === t.key ? 'border-[#9c27b0] shadow-md scale-105' : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div className="w-16 h-16 rounded-2xl shadow-md" style={{ background: t.color }} />
                    <div>
                      <p className="font-bold text-gray-900">{t.label}</p>
                      <p className="text-xs text-gray-500">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Vous arriverez directement sur l&apos;éditeur WeboWord. Utilisez les onglets dans la sidebar pour ajouter vos prestations.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : router.push('/devis')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? 'Annuler' : 'Précédent'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
            >
              Suivant
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={createQuote}
              disabled={creating || !canFinish}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-[#9c27b0] to-[#7b1fa2] text-white text-sm font-semibold rounded-xl hover:from-[#7b1fa2] hover:to-[#6a1080] disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Créer et ouvrir WeboWord
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
