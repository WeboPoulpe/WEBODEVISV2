import { createClient } from '@/lib/supabase/client';

export interface CustomerContact {
  id: string;
  customer_id: string;
  owner_user_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_primary: boolean;
}

export interface ContactDraft {
  id?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
  is_primary: boolean;
}

export async function listContacts(customerId: string): Promise<CustomerContact[]> {
  const { data } = await createClient()
    .from('customer_contacts')
    .select('id, customer_id, owner_user_id, name, role, email, phone, notes, is_primary')
    .eq('customer_id', customerId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  return (data ?? []) as CustomerContact[];
}

/** Remplace tous les contacts d'un client et synchronise le miroir customers.contact_person_*. */
export async function saveContacts(
  customerId: string,
  ownerUserId: string,
  drafts: ContactDraft[],
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const clean = drafts.filter((d) => d.name.trim());
  // Garantit un seul primaire (le 1er coché, sinon le 1er de la liste).
  const primaryIdx = Math.max(0, clean.findIndex((d) => d.is_primary));
  const rows = clean.map((d, i) => ({
    customer_id: customerId,
    owner_user_id: ownerUserId,
    name: d.name.trim(),
    role: d.role.trim() || null,
    email: d.email.trim() || null,
    phone: d.phone.trim() || null,
    notes: d.notes.trim() || null,
    is_primary: i === primaryIdx,
  }));

  const del = await supabase.from('customer_contacts').delete().eq('customer_id', customerId);
  if (del.error) return { error: del.error.message };

  if (rows.length > 0) {
    const ins = await supabase.from('customer_contacts').insert(rows);
    if (ins.error) return { error: ins.error.message };
  }

  // Miroir : le contact primaire alimente customers.contact_person_* (compat code existant).
  const primary = rows[primaryIdx];
  const upd = await supabase.from('customers').update({
    contact_person_name: primary?.name ?? null,
    contact_person_email: primary?.email ?? null,
    contact_person_phone: primary?.phone ?? null,
  }).eq('id', customerId);
  if (upd.error) return { error: upd.error.message };

  return { error: null };
}

/** Construit le snapshot destinataire à poser sur un devis. */
export function snapshotFromContact(
  contact: { name: string; role: string | null; email: string | null; phone: string | null } | null,
  company: { company_name: string | null; siret_number: string | null },
) {
  return {
    contact_person_name: contact?.name ?? '',
    recipient_contact_role: contact?.role ?? null,
    recipient_contact_email: contact?.email ?? null,
    recipient_contact_phone: contact?.phone ?? null,
    company_name: company.company_name ?? null,
    client_siret: company.siret_number ?? null,
  };
}
