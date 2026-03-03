'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, X, Phone, Mail, MapPin, Calendar, Users2,
  MessageSquare, ChevronDown, FileText, Copy, Check, Link2,
  Loader2, Trash2, RefreshCw, Eye, AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
type ProspectStatus =
  | 'nouveau' | 'devis' | 'flyer' | 'rdv_degust'
  | 'attente_reponse' | 'acompte' | 'relance' | 'refuse';

interface Prospect {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  service_address: string | null;
  guest_count: number | null;
  event_type: string | null;
  event_date: string | null;
  message: string | null;
  status: ProspectStatus;
  owner_user_id: string | null;
  user_token: string | null;
  created_at: string;
}

interface Token {
  id: string;
  token: string;
  is_active: boolean;
  brochure_url: string | null;
  created_at: string;
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUSES: {
  key: ProspectStatus; label: string;
  bg: string; text: string; dot: string;
}[] = [
  { key: 'nouveau',          label: 'Nouveau',         bg: 'bg-sky-50',    text: 'text-sky-700',     dot: 'bg-sky-400'    },
  { key: 'devis',            label: 'Devis envoyé',    bg: 'bg-amber-50',  text: 'text-amber-700',   dot: 'bg-amber-400'  },
  { key: 'rdv_degust',       label: 'RDV Dégustation', bg: 'bg-violet-50', text: 'text-violet-700',  dot: 'bg-violet-400' },
  { key: 'attente_reponse',  label: 'En attente',      bg: 'bg-orange-50', text: 'text-orange-700',  dot: 'bg-orange-400' },
  { key: 'acompte',          label: 'Acompte reçu',    bg: 'bg-emerald-50',text: 'text-emerald-700', dot: 'bg-emerald-400'},
  { key: 'relance',          label: 'Relance',         bg: 'bg-pink-50',   text: 'text-pink-700',    dot: 'bg-pink-400'   },
  { key: 'flyer',            label: 'Flyer envoyé',    bg: 'bg-slate-100', text: 'text-slate-600',   dot: 'bg-slate-400'  },
  { key: 'refuse',           label: 'Refusé',          bg: 'bg-red-50',    text: 'text-red-700',     dot: 'bg-red-400'    },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

const EVENT_TYPES = ['Mariage', 'Cocktail', 'Anniversaire', 'Séminaire', 'Gala', 'Communion', 'Baptême', 'Autre'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ProspectStatus }) {
  const s = STATUS_MAP[status] ?? STATUSES[0];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border', s.bg, s.text, 'border-current/10')}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
      {s.label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Token Manager Modal ────────────────────────────────────────────────────────
function TokenManagerModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [token, setToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [brochureUrl, setBrochureUrl] = useState('');

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/` : '';

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('user_prospect_tokens')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    setToken(data ?? null);
    setBrochureUrl(data?.brochure_url ?? '');
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const createToken = async () => {
    if (!user) return;
    setCreating(true);
    const supabase = createClient();
    const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    const { data } = await supabase
      .from('user_prospect_tokens')
      .insert({ user_id: user.id, token, is_active: true })
      .select()
      .single();
    setToken(data);
    setCreating(false);
  };

  const copyLink = () => {
    if (!token) return;
    navigator.clipboard.writeText(baseUrl + token.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveBrochure = async () => {
    if (!token) return;
    const supabase = createClient();
    await supabase.from('user_prospect_tokens').update({ brochure_url: brochureUrl || null }).eq('id', token.id);
    setToken((t) => t ? { ...t, brochure_url: brochureUrl || null } : t);
  };

  const regenerate = async () => {
    if (!token || !confirm('Régénérer le lien ? L\'ancien lien ne fonctionnera plus.')) return;
    const supabase = createClient();
    const newToken = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    const { data } = await supabase
      .from('user_prospect_tokens')
      .update({ token: newToken, updated_at: new Date().toISOString() })
      .eq('id', token.id)
      .select()
      .single();
    setToken(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-[#9c27b0]" />
            <h2 className="font-semibold text-gray-900">Lien de formulaire</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" />
            </div>
          ) : !token ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 mx-auto bg-[#f3e5f5] rounded-2xl flex items-center justify-center">
                <Link2 className="h-6 w-6 text-[#9c27b0]" />
              </div>
              <p className="text-sm text-gray-600">Créez un lien pour recevoir des demandes de devis.</p>
              <button
                onClick={createToken}
                disabled={creating}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Créer mon lien
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Lien partageable</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 truncate font-mono">
                    {baseUrl}{token.token}
                  </div>
                  <button
                    onClick={copyLink}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0',
                      copied ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copié' : 'Copier'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">URL brochure (affiché après envoi)</label>
                <div className="flex gap-2">
                  <input
                    value={brochureUrl}
                    onChange={(e) => setBrochureUrl(e.target.value)}
                    placeholder="https://…"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                  />
                  <button
                    onClick={saveBrochure}
                    className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    Sauver
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <a
                  href={`/p/${token.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-[#9c27b0] hover:underline"
                >
                  <Eye className="h-4 w-4" />
                  Voir le formulaire
                </a>
                <button
                  onClick={regenerate}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Régénérer le lien
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Devis Modal ─────────────────────────────────────────────────────────
function CreateDevisModal({
  prospect,
  onClose,
  onCreated,
}: {
  prospect: Prospect;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customer form
  const [firstName, setFirstName] = useState(prospect.first_name);
  const [lastName, setLastName]   = useState(prospect.last_name);
  const [email, setEmail]         = useState(prospect.email);
  const [phone, setPhone]         = useState(prospect.phone ?? '');
  const [address, setAddress]     = useState(prospect.address ?? '');

  // Quote form
  const [eventType, setEventType] = useState(prospect.event_type ?? '');
  const [eventDate, setEventDate] = useState(prospect.event_date ?? '');
  const [guestCount, setGuestCount] = useState(String(prospect.guest_count ?? ''));

  const handleCreate = async () => {
    if (!user) return;
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Prénom, nom et email sont requis.');
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      // 1. Find or create customer
      let customerId: string | null = null;
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (existing?.id) {
        customerId = existing.id;
        await supabase.from('customers').update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
        }).eq('id', customerId);
      } else {
        const { data: newCustomer, error: custErr } = await supabase
          .from('customers')
          .insert({
            user_id: user.id,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || null,
            address: address.trim() || null,
            type: 'particulier',
          })
          .select('id')
          .single();
        if (custErr) throw new Error(custErr.message);
        customerId = newCustomer.id;
      }

      // 2. Create quote
      const { data: quote, error: quoteErr } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          owner_user_id: user.id,
          customer_id: customerId,
          status: 'draft',
          event_type: eventType.trim() || null,
          event_date: eventDate || null,
          guest_count: parseInt(guestCount) || null,
          services: [],
          total_amount: 0,
          internal_notes: `Créé depuis la demande prospect #${prospect.id}`,
        })
        .select('id')
        .single();
      if (quoteErr) throw new Error(quoteErr.message);

      // 3. Update prospect status
      await supabase
        .from('prospect_requests')
        .update({
          status: 'devis',
          owner_user_id: user.id,
        })
        .eq('id', prospect.id);

      onCreated();
      router.push(`/devis/${quote.id}/modifier`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#9c27b0]" />
            <h2 className="font-semibold text-gray-900">Créer un devis</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 grid sm:grid-cols-2 gap-6">
          {/* Left: customer */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Prénom *</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Téléphone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Adresse</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
              />
            </div>
          </div>

          {/* Right: event */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Événement</p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type d&apos;événement</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
              >
                <option value="">— Choisir —</option>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre de convives</label>
              <input
                type="number"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
              />
            </div>

            {prospect.message && (
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 leading-relaxed border border-gray-100">
                <p className="font-semibold text-gray-700 mb-1">Message du prospect</p>
                <p className="line-clamp-4">{prospect.message}</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-6 mb-4 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="px-6 pb-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Créer le devis
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Prospect Drawer ────────────────────────────────────────────────────────────
function ProspectDrawer({
  prospect,
  onClose,
  onStatusChange,
  onDelete,
  onCreateDevis,
}: {
  prospect: Prospect;
  onClose: () => void;
  onStatusChange: (id: string, status: ProspectStatus) => void;
  onDelete: (id: string) => void;
  onCreateDevis: () => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleStatus = async (s: ProspectStatus) => {
    setUpdatingStatus(true);
    setStatusOpen(false);
    const supabase = createClient();
    await supabase.from('prospect_requests').update({ status: s }).eq('id', prospect.id);
    onStatusChange(prospect.id, s);
    setUpdatingStatus(false);
  };

  const s = STATUS_MAP[prospect.status] ?? STATUSES[0];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {prospect.first_name} {prospect.last_name}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Reçu le {formatDate(prospect.created_at)}</p>
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors ml-3 flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Statut</p>
            <div className="relative">
              <button
                onClick={() => setStatusOpen((v) => !v)}
                disabled={updatingStatus}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold w-full transition-colors',
                  s.bg, s.text, 'border-current/10'
                )}
              >
                {updatingStatus ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
                ) : (
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', s.dot)} />
                )}
                <span className="flex-1 text-left">{s.label}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                  {STATUSES.map((st) => (
                    <button
                      key={st.key}
                      onClick={() => handleStatus(st.key)}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors',
                        st.key === prospect.status && 'bg-gray-50 font-semibold'
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', st.dot)} />
                      {st.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contact</p>
            <div className="space-y-2">
              <a href={`mailto:${prospect.email}`} className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-[#9c27b0] transition-colors">
                <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                {prospect.email}
              </a>
              {prospect.phone && (
                <a href={`tel:${prospect.phone}`} className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-[#9c27b0] transition-colors">
                  <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  {prospect.phone}
                </a>
              )}
              {prospect.address && (
                <div className="flex items-start gap-2.5 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>{prospect.address}</span>
                </div>
              )}
              {prospect.service_address && prospect.service_address !== prospect.address && (
                <div className="flex items-start gap-2.5 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-[#9c27b0]/60 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-gray-400 block">Lieu de l&apos;événement</span>
                    {prospect.service_address}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Event */}
          {(prospect.event_type || prospect.event_date || prospect.guest_count) && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Événement</p>
              <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                {prospect.event_type && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">Type</span>
                    <span className="font-medium text-gray-800">{prospect.event_type}</span>
                  </div>
                )}
                {prospect.event_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <span className="font-medium text-gray-800">{formatDate(prospect.event_date)}</span>
                  </div>
                )}
                {prospect.guest_count && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users2 className="h-3.5 w-3.5 text-gray-400" />
                    <span className="font-medium text-gray-800">{prospect.guest_count} convives</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Message */}
          {prospect.message && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Message</p>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <MessageSquare className="h-3.5 w-3.5 text-gray-400 mb-1.5" />
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{prospect.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 border-t border-gray-100 p-4 space-y-2">
        {prospect.status !== 'devis' && (
          <button
            onClick={onCreateDevis}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors"
          >
            <FileText className="h-4 w-4" />
            Créer un devis
          </button>
        )}
        <button
          onClick={() => onDelete(prospect.id)}
          className="flex items-center justify-center gap-2 w-full py-2 text-red-500 text-sm hover:bg-red-50 rounded-xl transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Supprimer
        </button>
      </div>
    </div>
  );
}

// ── Prospect Card ──────────────────────────────────────────────────────────────
function ProspectCard({
  prospect,
  selected,
  onClick,
}: {
  prospect: Prospect;
  selected: boolean;
  onClick: () => void;
}) {
  const isUrgent =
    prospect.event_date &&
    new Date(prospect.event_date) < new Date(Date.now() + 60 * 24 * 3600 * 1000);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-white border rounded-2xl p-4 transition-all hover:shadow-sm',
        selected
          ? 'border-[#9c27b0]/40 ring-1 ring-[#9c27b0]/20 shadow-sm'
          : 'border-gray-200 hover:border-[#9c27b0]/20',
        isUrgent && !selected && 'border-orange-200 bg-orange-50/30',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {prospect.first_name} {prospect.last_name}
          </p>
          <p className="text-xs text-gray-500 truncate">{prospect.email}</p>
        </div>
        <StatusBadge status={prospect.status} />
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400 mt-3 flex-wrap">
        {prospect.event_type && (
          <span className="bg-[#f3e5f5] text-[#9c27b0] px-2 py-0.5 rounded-full font-medium">
            {prospect.event_type}
          </span>
        )}
        {prospect.event_date && (
          <span className={cn('flex items-center gap-1', isUrgent && 'text-orange-500 font-medium')}>
            <Calendar className="h-3 w-3" />
            {formatDate(prospect.event_date)}
          </span>
        )}
        {prospect.guest_count && (
          <span className="flex items-center gap-1">
            <Users2 className="h-3 w-3" />
            {prospect.guest_count}
          </span>
        )}
        <span className="ml-auto">{formatDate(prospect.created_at)}</span>
      </div>
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ProspectsPage() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [createDevisFor, setCreateDevisFor] = useState<Prospect | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    // Get user's tokens
    const { data: tokenRows } = await supabase
      .from('user_prospect_tokens')
      .select('token')
      .eq('user_id', user.id);

    const myTokens = (tokenRows ?? []).map((r: { token: string }) => r.token);

    let query = supabase
      .from('prospect_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (myTokens.length > 0) {
      query = query.or(
        `owner_user_id.eq.${user.id},user_token.in.(${myTokens.join(',')})`
      );
    } else {
      query = query.eq('owner_user_id', user.id);
    }

    const { data } = await query;
    setProspects(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = (id: string, status: ProspectStatus) => {
    setProspects((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
    if (selected?.id === id) setSelected((p) => p ? { ...p, status } : p);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette demande ?')) return;
    const supabase = createClient();
    await supabase.from('prospect_requests').delete().eq('id', id);
    setProspects((prev) => prev.filter((p) => p.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const filtered = prospects.filter((p) => {
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchSearch =
      !search ||
      `${p.first_name} ${p.last_name} ${p.email} ${p.event_type ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const newCount = prospects.filter((p) => p.status === 'nouveau').length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#f3e5f5] rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-[#9c27b0]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Demandes de devis</h1>
              <p className="text-sm text-gray-400">
                {loading ? '…' : `${prospects.length} demande${prospects.length !== 1 ? 's' : ''}${newCount > 0 ? ` · ${newCount} nouvelle${newCount > 1 ? 's' : ''}` : ''}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowTokenManager(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors self-start sm:self-auto"
          >
            <Link2 className="h-4 w-4" />
            Mon formulaire
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, événement…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
              statusFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Toutes ({prospects.length})
          </button>
          {STATUSES.map((s) => {
            const count = prospects.filter((p) => p.status === s.key).length;
            if (count === 0 && statusFilter !== s.key) return null;
            return (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                  statusFilter === s.key
                    ? cn(s.bg, s.text)
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
                {s.label}
                <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden flex">
        {/* List */}
        <div className={cn(
          'flex-1 overflow-y-auto p-4',
          selected && 'hidden md:block md:w-auto',
        )}>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 animate-pulse">
                  <div className="flex justify-between mb-2">
                    <div className="space-y-1.5">
                      <div className="h-4 bg-gray-100 rounded w-32" />
                      <div className="h-3 bg-gray-100 rounded w-48" />
                    </div>
                    <div className="h-5 bg-gray-100 rounded-full w-20" />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <div className="h-4 bg-gray-100 rounded-full w-16" />
                    <div className="h-4 bg-gray-100 rounded w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium mb-1">Aucune demande</p>
              <p className="text-sm text-gray-400 mb-4">
                {search || statusFilter !== 'all'
                  ? 'Aucun résultat pour ces filtres.'
                  : 'Partagez votre formulaire pour recevoir des demandes.'}
              </p>
              {!search && statusFilter === 'all' && (
                <button
                  onClick={() => setShowTokenManager(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors"
                >
                  <Link2 className="h-4 w-4" />
                  Créer mon formulaire
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => (
                <ProspectCard
                  key={p.id}
                  prospect={p}
                  selected={selected?.id === p.id}
                  onClick={() => setSelected((cur) => cur?.id === p.id ? null : p)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Drawer */}
        {selected && (
          <div className={cn(
            'w-full md:w-[380px] flex-shrink-0 border-l border-gray-100 bg-white overflow-hidden flex flex-col',
          )}>
            <ProspectDrawer
              prospect={selected}
              onClose={() => setSelected(null)}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onCreateDevis={() => setCreateDevisFor(selected)}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showTokenManager && (
        <TokenManagerModal onClose={() => setShowTokenManager(false)} />
      )}
      {createDevisFor && (
        <CreateDevisModal
          prospect={createDevisFor}
          onClose={() => setCreateDevisFor(null)}
          onCreated={() => {
            setCreateDevisFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
