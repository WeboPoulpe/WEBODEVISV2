'use client';

import { useState, useRef } from 'react';
import { X, UploadCloud, Loader2, Check, FileText, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const EVENT_TYPES = ['Mariage', 'Cocktail', 'Anniversaire', 'Séminaire', 'Gala', 'Communion', 'Baptême', 'Autre'];

export default function ImportDevisModal({ open, onClose, onCreated }: Props) {
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
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const reset = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPhone('');
    setBillingAddress(''); setEventAddress(''); setEventType('');
    setEventDate(''); setGuestCount(''); setTotalAmount(''); setFile(null);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) { alert('Prénom et nom requis'); return; }
    if (!eventDate) { alert('Date de l\'événement requise'); return; }

    setSaving(true);
    const supabase = createClient();
    let fileUrl: string | null = null;
    let fileName: string | null = null;

    // Upload file if present
    if (file) {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `imported-devis/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('storage').upload(path, file);
      if (uploadErr) {
        alert('Erreur upload fichier: ' + uploadErr.message);
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('storage').getPublicUrl(path);
      fileUrl = urlData.publicUrl;
      fileName = file.name;
    }

    const clientFullName = `${firstName.trim()} ${lastName.trim()}`;
    const { error } = await supabase.from('quotes').insert({
      user_id: user.id,
      owner_user_id: user.id,
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
      status: 'accepted', // Imported = considered accepted
      services: [],
      template: 'standard',
      vat_rate: 20,
      hide_price: false,
      imported: true,
      imported_file_url: fileUrl,
      imported_file_name: fileName,
    });

    setSaving(false);
    if (error) {
      alert('Erreur: ' + error.message);
      return;
    }
    reset();
    onCreated();
    onClose();
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
              <h2 className="font-semibold text-gray-900 text-sm">Importer un devis existant</h2>
              <p className="text-[10px] text-gray-400">Devis déjà fait dans un autre logiciel</p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Client */}
          <div>
            <p className="text-[10px] font-bold text-[#9c27b0] uppercase tracking-wider mb-3">Client</p>
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
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.odt" onChange={handleFileSelect} className="hidden" />
            {file ? (
              <div className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
                <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(1)} Ko</p>
                </div>
                <button onClick={() => setFile(null)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#9c27b0]/50 hover:bg-gray-50 transition-colors"
              >
                <UploadCloud className="h-6 w-6 text-gray-400" />
                <span className="text-xs text-gray-500">Cliquer pour sélectionner un fichier</span>
                <span className="text-[10px] text-gray-400">PDF, DOC, DOCX, ODT</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Importer le devis
          </button>
        </div>
      </div>
    </div>
  );
}
