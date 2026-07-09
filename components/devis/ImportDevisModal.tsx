'use client';

import { useState, useRef, useEffect } from 'react';
import { X, UploadCloud, Loader2, Check, FileText, Trash2, ExternalLink, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** If provided, the modal opens in EDIT mode and updates this quote */
  editQuoteId?: string | null;
}

const EVENT_TYPES = ['Mariage', 'Cocktail', 'Anniversaire', 'Séminaire', 'Gala', 'Communion', 'Baptême', 'Autre'];

type CustomerResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export default function ImportDevisModal({ open, onClose, onCreated, editQuoteId = null }: Props) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [eventAddress, setEventAddress] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // Step 1 — Client selector states
  const [clientMode, setClientMode] = useState<'new' | 'existing'>('new');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const isEdit = !!editQuoteId;

  // Load existing data in edit mode
  useEffect(() => {
    if (!open || !editQuoteId) return;
    setLoadingEdit(true);
    const sb = createClient();
    sb.from('quotes')
      .select('client_first_name, client_last_name, client_name, client_email, client_phone, client_address, event_location, event_type, event_date, guest_count, total_amount, imported_file_url, imported_file_name')
      .eq('id', editQuoteId)
      .single()
      .then(({ data }) => {
        if (data) {
          setFirstName(data.client_first_name || (data.client_name?.split(' ')[0] ?? ''));
          setLastName(data.client_last_name || (data.client_name?.split(' ').slice(1).join(' ') ?? ''));
          setEmail(data.client_email || '');
          setPhone(data.client_phone || '');
          setBillingAddress(data.client_address || '');
          setEventAddress(data.event_location || '');
          setEventType(data.event_type || '');
          setEventDate(data.event_date || '');
          setGuestCount(data.guest_count != null ? String(data.guest_count) : '');
          setTotalAmount(data.total_amount != null ? String(data.total_amount) : '');
          setExistingFileUrl(data.imported_file_url || null);
          setExistingFileName(data.imported_file_name || null);
        }
        setLoadingEdit(false);
      });
  }, [open, editQuoteId]);

  if (!open) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const reset = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPhone('');
    setBillingAddress(''); setEventAddress(''); setEventType('');
    setEventDate(''); setGuestCount(''); setTotalAmount(''); setFile(null);
    setExistingFileUrl(null); setExistingFileName(null);
    // Step 5 — reset client selector states
    setClientMode('new'); setCustomerSearch(''); setCustomerResults([]); setSelectedCustomerId(null);
  };

  // Step 2 — Search & pick existing customers
  const searchCustomers = async (q: string) => {
    setCustomerSearch(q);
    if (!q.trim() || !user) { setCustomerResults([]); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone, address')
      .eq('owner_user_id', user.id)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(6);
    setCustomerResults(data ?? []);
  };

  const pickCustomer = (c: CustomerResult) => {
    setSelectedCustomerId(c.id);
    setFirstName(c.first_name ?? '');
    setLastName(c.last_name ?? '');
    setEmail(c.email ?? '');
    setPhone(c.phone ?? '');
    setBillingAddress(c.address ?? '');
    setCustomerResults([]);
    setCustomerSearch(`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim());
  };

  const handleSave = async () => {
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) { alert('Prénom et nom requis'); return; }
    if (!eventDate) { alert('Date de l\'événement requise'); return; }

    setSaving(true);
    const supabase = createClient();
    let fileUrl: string | null = existingFileUrl;
    let fileName: string | null = existingFileName;

    // Upload new file if selected (replaces existing in edit mode)
    if (file) {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${user.id}/imported-devis/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('storage').upload(path, file);
      if (uploadErr) {
        alert('Erreur upload fichier: ' + uploadErr.message + '\n\nVérifie que le bucket "storage" existe dans Supabase et que les RLS permettent l\'upload.');
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('storage').getPublicUrl(path);
      fileUrl = urlData.publicUrl;
      fileName = file.name;
    }

    // Step 4 — Resolve customer id (creation only)
    let customerId: string | null = selectedCustomerId;
    if (!isEdit && !customerId && email.trim()) {
      const supabase2 = createClient();
      const { data: existing } = await supabase2.from('customers')
        .select('id').eq('owner_user_id', user.id).eq('email', email.trim().toLowerCase()).maybeSingle();
      if (existing?.id) {
        customerId = existing.id;
      } else {
        const { data: created } = await supabase2.from('customers').insert({
          owner_user_id: user.id,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          address: billingAddress.trim() || null,
          customer_type: 'particulier',
        }).select('id').single();
        customerId = created?.id ?? null;
      }
    }

    const clientFullName = `${firstName.trim()} ${lastName.trim()}`;
    const payload = {
      client_name: clientFullName,
      client_first_name: firstName.trim(),
      client_last_name: lastName.trim(),
      client_email: email || null,
      client_phone: phone || null,
      client_address: billingAddress || null,
      event_location: eventAddress || '',
      event_type: eventType || '',
      event_date: eventDate,
      guest_count: parseInt(guestCount) || 1,
      total_amount: parseFloat(totalAmount) || null,
      imported_file_url: fileUrl,
      imported_file_name: fileName,
    };

    let error;
    if (isEdit && editQuoteId) {
      const res = await supabase.from('quotes').update(payload).eq('id', editQuoteId);
      error = res.error;
    } else {
      const res = await supabase.from('quotes').insert({
        ...payload,
        user_id: user.id,
        owner_user_id: user.id,
        status: 'valide',
        services: [],
        template: 'standard',
        vat_rate: 20,
        hide_price: false,
        imported: true,
        customer_id: customerId,
      });
      error = res.error;
    }

    setSaving(false);
    if (error) {
      alert('Erreur: ' + error.message);
      return;
    }
    reset();
    onCreated();
    onClose();
  };

  const removeExistingFile = () => {
    setExistingFileUrl(null); setExistingFileName(null);
  };

  const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]';
  const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-xl">
              <UploadCloud className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">{isEdit ? 'Modifier l\'import' : 'Importer un devis existant'}</h2>
              <p className="text-[10px] text-gray-400">{isEdit ? 'Mettre à jour les infos, le prix ou le fichier' : 'Devis déjà fait dans un autre logiciel'}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loadingEdit && (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Client */}
          <div>
            <p className="text-[10px] font-bold text-[#9c27b0] uppercase tracking-wider mb-3">Client</p>

            {/* Step 3 — Client mode toggle (creation only) */}
            {!isEdit && (
              <div className="mb-4">
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => { setClientMode('new'); setSelectedCustomerId(null); }}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${clientMode === 'new' ? 'bg-[#9c27b0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    Nouveau client
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode('existing')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${clientMode === 'existing' ? 'bg-[#9c27b0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    Client existant
                  </button>
                </div>

                {clientMode === 'existing' && (
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        value={customerSearch}
                        onChange={(e) => searchCustomers(e.target.value)}
                        className={`${inputCls} pl-8`}
                        placeholder="Rechercher par nom ou email…"
                      />
                    </div>
                    {customerResults.length > 0 && (
                      <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => pickCustomer(c)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[#f3e5f5] transition-colors"
                          >
                            <span className="font-medium text-gray-900">
                              {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                            </span>
                            {c.email && <span className="text-gray-500"> · {c.email}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedCustomerId && (
                      <p className="mt-1.5 text-[10px] text-[#9c27b0] font-medium">
                        Client sélectionné — champs pré-remplis ci-dessous
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Prénom *</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} placeholder="Jean" /></div>
              <div><label className={labelCls}>Nom *</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} placeholder="Dupont" /></div>
              <div><label className={labelCls}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="jean@email.com" /></div>
              <div><label className={labelCls}>Téléphone</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="06 12 34 56 78" /></div>
            </div>
          </div>

          {/* Adresses */}
          <div className="space-y-3">
            <div><label className={labelCls}>Adresse de facturation</label><input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} className={inputCls} placeholder="12 rue des Lilas, 75001 Paris" /></div>
            <div><label className={labelCls}>Adresse de prestation</label><input value={eventAddress} onChange={(e) => setEventAddress(e.target.value)} className={inputCls} placeholder="Château de Villebougis" /></div>
          </div>

          {/* Event */}
          <div>
            <p className="text-[10px] font-bold text-[#9c27b0] uppercase tracking-wider mb-3">Événement</p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Type</label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputCls}>
                  <option value="">— Choisir —</option>
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Date *</label><input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Couverts</label><input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} className={inputCls} placeholder="120" /></div>
            </div>
          </div>

          {/* Total */}
          <div>
            <label className={labelCls}>Montant total TTC (€)</label>
            <input type="number" min={0} step={0.01} value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className={inputCls} placeholder="2400.00" />
          </div>

          {/* File upload */}
          <div>
            <label className={labelCls}>Fichier du devis (PDF, Word…)</label>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.odt,image/*" onChange={handleFileSelect} className="hidden" />
            {file ? (
              <div className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
                <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(1)} Ko · Sera uploadé à la sauvegarde</p>
                </div>
                <button onClick={() => setFile(null)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : existingFileUrl ? (
              <div className="space-y-2">
                <a href={existingFileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors group">
                  <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{existingFileName || 'Document existant'}</p>
                    <p className="text-[10px] text-blue-600 group-hover:underline">Cliquer pour ouvrir</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-blue-500" />
                </a>
                <div className="flex items-center gap-2">
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                    Remplacer le fichier
                  </button>
                  <button onClick={removeExistingFile} className="text-xs px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    Retirer
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#9c27b0]/50 hover:bg-gray-50 transition-colors"
              >
                <UploadCloud className="h-6 w-6 text-gray-400" />
                <span className="text-xs text-gray-500">Cliquer pour sélectionner un fichier</span>
                <span className="text-[10px] text-gray-400">PDF, DOC, DOCX, ODT, image</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving || loadingEdit} className="flex items-center gap-2 px-5 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isEdit ? 'Enregistrer les modifications' : 'Importer le devis'}
          </button>
        </div>
      </div>
    </div>
  );
}
