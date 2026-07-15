'use client';

import { useEffect, useState } from 'react';
import { listContacts, type CustomerContact } from '@/lib/customerContacts';

export default function RecipientPicker({
  customerId, valueContactId, onPick,
}: {
  customerId: string;
  valueContactId: string | null;
  onPick: (contact: CustomerContact | null) => void;
}) {
  const [contacts, setContacts] = useState<CustomerContact[]>([]);

  useEffect(() => {
    let cancelled = false;
    listContacts(customerId).then((rows) => {
      if (cancelled) return;
      setContacts(rows);
      // Défaut : le contact déjà choisi, sinon le primaire, sinon le premier.
      const current = rows.find((r) => r.id === valueContactId)
        ?? rows.find((r) => r.is_primary) ?? rows[0] ?? null;
      onPick(current);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  if (contacts.length === 0) return null;

  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Destinataire du devis</label>
      <select
        value={valueContactId ?? ''}
        onChange={(e) => onPick(contacts.find((c) => c.id === e.target.value) ?? null)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
      >
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}{c.role ? ` — ${c.role}` : ''}{c.is_primary ? ' ★' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
