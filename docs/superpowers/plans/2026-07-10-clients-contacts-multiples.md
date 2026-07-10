# Clients entreprise — Contacts multiples + destinataire + SIRET — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre plusieurs contacts par client entreprise, choisir le contact destinataire d'un devis (figé en snapshot), et afficher raison sociale + SIRET + contact sur le document généré.

**Architecture:** Nouvelle table `customer_contacts` (source de vérité), miroir du contact principal dans `customers.contact_person_*` pour compat, colonnes snapshot sur `quotes`, composants isolés `ContactsEditor` et `RecipientPicker`, extension additive de `generateQuoteHtml`.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase (Postgres + RLS), TypeScript, Tailwind.

## Global Constraints

- **Aucun framework de tests** dans le repo. Vérification de chaque tâche = `npx tsc --noEmit` (0 erreur) + `npx next build` (exit 0) + checklist manuelle navigateur. Pas de test runner.
- Ne jamais casser le build. Commit à la fin de chaque tâche seulement si tsc + build passent.
- Design de référence : `docs/superpowers/specs/2026-07-10-clients-contacts-multiples-design.md`.
- Colonnes réelles : `customers.siret_number`, `customers.contact_person_name/_email/_phone`, `customers.customer_type` ('particulier'|'entreprise').
- SIRET affiché = **celui du client** (pas l'émetteur).
- Le SQL est idempotent et n'est PAS exécuté par l'agent — il est ajouté au repo + au fichier consolidé, l'utilisateur l'applique dans Supabase.

---

### Task 1: Migration SQL — table `customer_contacts` + colonnes snapshot devis

**Files:**
- Create: `sql/lot_c_customer_contacts.sql`
- Modify: `sql/00_APPLIQUER_TOUT.sql` (append section 5)

**Interfaces:**
- Produces (schéma consommé par les tâches suivantes) :
  - Table `customer_contacts(id uuid, customer_id uuid, owner_user_id uuid, name text, role text, email text, phone text, notes text, is_primary bool, created_at timestamptz)`.
  - Colonnes `quotes.client_siret text`, `quotes.recipient_contact_email text`, `quotes.recipient_contact_phone text`, `quotes.recipient_contact_role text`.

- [ ] **Step 1: Créer `sql/lot_c_customer_contacts.sql`**

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Lot C — Contacts multiples par client + snapshot destinataire/SIRET sur devis
-- À lancer dans le SQL Editor de Supabase (idempotent).
-- Pré-requis : fonction public.is_admin() (cf. fix_admin_rls_recursion.sql).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Table des contacts
CREATE TABLE IF NOT EXISTS customer_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  name          text NOT NULL,
  role          text,
  email         text,
  phone         text,
  notes         text,
  is_primary    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts(customer_id);

-- 2) RLS
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own customer_contacts" ON customer_contacts;
CREATE POLICY "Owner manages own customer_contacts" ON customer_contacts
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage customer_contacts" ON customer_contacts;
CREATE POLICY "Admins manage customer_contacts" ON customer_contacts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) Snapshot destinataire + SIRET sur les devis
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_siret            text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_email text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_phone text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_role  text;

-- 4) Migration idempotente des contacts primaires existants
INSERT INTO customer_contacts (customer_id, owner_user_id, name, email, phone, is_primary)
SELECT c.id, c.owner_user_id, c.contact_person_name, c.contact_person_email, c.contact_person_phone, true
FROM customers c
WHERE c.customer_type = 'entreprise'
  AND c.contact_person_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM customer_contacts cc WHERE cc.customer_id = c.id);
```

- [ ] **Step 2: Ajouter la section 5 au fichier consolidé `sql/00_APPLIQUER_TOUT.sql`**

Ajouter à la fin du fichier (avant le bloc de vérification `-- ✅ Terminé`) le contenu ci-dessous :

```sql
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- ║ 5) lot_c_customer_contacts.sql                                          ║
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS customer_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  name          text NOT NULL,
  role          text,
  email         text,
  phone         text,
  notes         text,
  is_primary    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts(customer_id);
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages own customer_contacts" ON customer_contacts;
CREATE POLICY "Owner manages own customer_contacts" ON customer_contacts
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage customer_contacts" ON customer_contacts;
CREATE POLICY "Admins manage customer_contacts" ON customer_contacts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_siret            text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_email text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_phone text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_role  text;
INSERT INTO customer_contacts (customer_id, owner_user_id, name, email, phone, is_primary)
SELECT c.id, c.owner_user_id, c.contact_person_name, c.contact_person_email, c.contact_person_phone, true
FROM customers c
WHERE c.customer_type = 'entreprise' AND c.contact_person_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM customer_contacts cc WHERE cc.customer_id = c.id);
```

- [ ] **Step 3: Vérifier (revue manuelle)** que le SQL est idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS / WHERE NOT EXISTS). Pas d'exécution ici.

- [ ] **Step 4: Commit**

```bash
git add sql/lot_c_customer_contacts.sql sql/00_APPLIQUER_TOUT.sql
git commit -m "feat(sql): table customer_contacts + colonnes snapshot destinataire/SIRET sur quotes"
```

---

### Task 2: Couche données — `lib/customerContacts.ts`

**Files:**
- Create: `lib/customerContacts.ts`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/client`.
- Produces:
  - `interface CustomerContact { id: string; customer_id: string; owner_user_id: string; name: string; role: string | null; email: string | null; phone: string | null; notes: string | null; is_primary: boolean; }`
  - `interface ContactDraft { id?: string; name: string; role: string; email: string; phone: string; notes: string; is_primary: boolean; }`
  - `listContacts(customerId: string): Promise<CustomerContact[]>`
  - `saveContacts(customerId: string, ownerUserId: string, drafts: ContactDraft[]): Promise<{ error: string | null }>` — remplace l'ensemble des contacts du client (delete + insert), garantit un seul `is_primary`, et met à jour le miroir `customers.contact_person_*`.
  - `snapshotFromContact(contact: { name: string; role: string | null; email: string | null; phone: string | null } | null, company: { company_name: string | null; siret_number: string | null }): { contact_person_name: string; recipient_contact_role: string | null; recipient_contact_email: string | null; recipient_contact_phone: string | null; company_name: string | null; client_siret: string | null }`

- [ ] **Step 1: Écrire `lib/customerContacts.ts`**

```typescript
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
```

- [ ] **Step 2: Vérifier** `npx tsc --noEmit` → 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/customerContacts.ts
git commit -m "feat(clients): couche données customer_contacts (list/save/snapshot)"
```

---

### Task 3: Composant `ContactsEditor`

**Files:**
- Create: `components/clients/ContactsEditor.tsx`

**Interfaces:**
- Consumes: `ContactDraft` de `@/lib/customerContacts`.
- Produces: `export default function ContactsEditor({ value, onChange }: { value: ContactDraft[]; onChange: (next: ContactDraft[]) => void })` — édition en mémoire d'une liste de contacts (ajout/suppression/édition + choix du primaire). Ne touche pas la BDD (persistance déléguée à l'appelant via `saveContacts`).

- [ ] **Step 1: Écrire `components/clients/ContactsEditor.tsx`**

```tsx
'use client';

import { Plus, Trash2, Star } from 'lucide-react';
import type { ContactDraft } from '@/lib/customerContacts';

const EMPTY: ContactDraft = { name: '', role: '', email: '', phone: '', notes: '', is_primary: false };

export default function ContactsEditor({
  value, onChange,
}: { value: ContactDraft[]; onChange: (next: ContactDraft[]) => void }) {
  const update = (i: number, patch: Partial<ContactDraft>) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const setPrimary = (i: number) =>
    onChange(value.map((c, idx) => ({ ...c, is_primary: idx === i })));
  const add = () => onChange([...value, { ...EMPTY, is_primary: value.length === 0 }]);
  const remove = (i: number) => {
    const next = value.filter((_, idx) => idx !== i);
    if (next.length > 0 && !next.some((c) => c.is_primary)) next[0].is_primary = true;
    onChange(next);
  };

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]';

  return (
    <div className="space-y-3">
      {value.map((c, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <button
              type="button" onClick={() => setPrimary(i)}
              className={`flex items-center gap-1 text-xs font-medium ${c.is_primary ? 'text-amber-600' : 'text-gray-400 hover:text-amber-600'}`}
              title="Contact principal"
            >
              <Star className={`h-3.5 w-3.5 ${c.is_primary ? 'fill-amber-500 text-amber-500' : ''}`} />
              {c.is_primary ? 'Principal' : 'Définir principal'}
            </button>
            <button type="button" onClick={() => remove(i)} className="p-1 text-gray-300 hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input className={input} placeholder="Nom *" value={c.name} onChange={(e) => update(i, { name: e.target.value })} />
            <input className={input} placeholder="Rôle (ex. Décideur)" value={c.role} onChange={(e) => update(i, { role: e.target.value })} />
            <input className={input} placeholder="Email" type="email" value={c.email} onChange={(e) => update(i, { email: e.target.value })} />
            <input className={input} placeholder="Téléphone" value={c.phone} onChange={(e) => update(i, { phone: e.target.value })} />
          </div>
          <input className={input} placeholder="Notes" value={c.notes} onChange={(e) => update(i, { notes: e.target.value })} />
        </div>
      ))}
      <button type="button" onClick={add}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#9c27b0] border border-dashed border-[#9c27b0]/40 rounded-lg hover:bg-purple-50">
        <Plus className="h-3.5 w-3.5" /> Ajouter un contact
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier** `npx tsc --noEmit` → 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add components/clients/ContactsEditor.tsx
git commit -m "feat(clients): composant ContactsEditor (liste de contacts en mémoire)"
```

---

### Task 4: Intégrer les contacts dans la création client (`ClientForm`)

**Files:**
- Modify: `components/clients/ClientForm.tsx`

**Interfaces:**
- Consumes: `ContactsEditor` (Task 3), `saveContacts`/`ContactDraft` (Task 2).

- [ ] **Step 1: Ajouter les imports en haut de `components/clients/ClientForm.tsx`**

Après `import { useAuth } from '@/context/AuthContext';` ajouter :

```tsx
import ContactsEditor from '@/components/clients/ContactsEditor';
import { saveContacts, type ContactDraft } from '@/lib/customerContacts';
```

- [ ] **Step 2: Ajouter l'état contacts** après `const [error, setError] = useState<string | null>(null);` :

```tsx
  const [contacts, setContacts] = useState<ContactDraft[]>([]);
```

- [ ] **Step 3: Persister les contacts après l'insert du client.** Remplacer le bloc `const { error: err } = await supabase.from('customers').insert([ … ]);` par une version qui récupère l'id, puis sauve les contacts :

```tsx
    const { data: created, error: err } = await supabase.from('customers').insert([
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
    ]).select('id').single();

    if (err || !created) {
      setLoading(false);
      setError(err?.message ?? 'Erreur lors de la création du client.');
      return;
    }

    if (form.type === 'entreprise' && contacts.some((c) => c.name.trim())) {
      const res = await saveContacts(created.id, user.id, contacts);
      if (res.error) { setLoading(false); setError(res.error); return; }
    }

    setLoading(false);
    router.push('/clients');
```

(Supprimer l'ancien `setLoading(false); if (err) { … } else { router.push('/clients'); }` remplacé ci-dessus.)

- [ ] **Step 4: Afficher `ContactsEditor`** dans le rendu, uniquement pour les entreprises. Après la section « Coordonnées » (le `</section>` qui suit l'adresse de prestation), ajouter :

```tsx
      {form.type === 'entreprise' && (
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Contacts</h3>
          <p className="text-xs text-gray-400 mb-3">Ajoutez les interlocuteurs (décideur, comptabilité…). Le contact principal alimente les champs de contact par défaut.</p>
          <ContactsEditor value={contacts} onChange={setContacts} />
        </section>
      )}
```

- [ ] **Step 5: Vérifier** `npx tsc --noEmit` puis `npx next build` → exit 0.

- [ ] **Step 6: Test manuel (navigateur)** — créer un client entreprise avec 2 contacts, l'un marqué principal ; vérifier en base (`customer_contacts` 2 lignes, 1 `is_primary`, `customers.contact_person_name` = primaire).

- [ ] **Step 7: Commit**

```bash
git add components/clients/ClientForm.tsx
git commit -m "feat(clients): gestion des contacts multiples à la création d'un client entreprise"
```

---

### Task 5: Édition des contacts sur un client existant

**Files:**
- Modify: `app/(app)/clients/page.tsx`

**Interfaces:**
- Consumes: `listContacts`/`saveContacts`/`ContactDraft` (Task 2), `ContactsEditor` (Task 3).

**Contexte:** la page clients a un panneau/fiche d'édition (`from('customers').update(...)` à la ligne ~129). Repérer le composant/section d'édition d'un client et y ajouter la gestion des contacts pour les entreprises.

- [ ] **Step 1: Lire** `app/(app)/clients/page.tsx` autour des lignes 120-160 et de la fiche d'édition pour identifier l'état du client édité et le handler de sauvegarde.

- [ ] **Step 2: Ajouter les imports**

```tsx
import ContactsEditor from '@/components/clients/ContactsEditor';
import { listContacts, saveContacts, type ContactDraft } from '@/lib/customerContacts';
```

- [ ] **Step 3: Ajouter un état** `const [editContacts, setEditContacts] = useState<ContactDraft[]>([]);` dans le composant qui gère l'édition.

- [ ] **Step 4: Charger les contacts** à l'ouverture de la fiche d'un client entreprise :

```tsx
    if (customer.customer_type === 'entreprise') {
      listContacts(customer.id).then((rows) =>
        setEditContacts(rows.map((r) => ({
          id: r.id, name: r.name, role: r.role ?? '', email: r.email ?? '',
          phone: r.phone ?? '', notes: r.notes ?? '', is_primary: r.is_primary,
        }))),
      );
    }
```

- [ ] **Step 5: Sauver les contacts** dans le handler d'enregistrement du client, après l'`update` de `customers` :

```tsx
    if (customer.customer_type === 'entreprise') {
      await saveContacts(customer.id, user.id, editContacts);
    }
```

- [ ] **Step 6: Afficher `<ContactsEditor value={editContacts} onChange={setEditContacts} />`** dans la fiche d'édition, sous les infos entreprise, conditionné à `customer_type === 'entreprise'`.

- [ ] **Step 7: Vérifier** `npx tsc --noEmit` + `npx next build` → exit 0.

- [ ] **Step 8: Test manuel** — éditer un client entreprise, ajouter/supprimer un contact, changer le principal, recharger → persistance OK.

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/clients/page.tsx"
git commit -m "feat(clients): édition des contacts multiples sur un client existant"
```

---

### Task 6: Composant `RecipientPicker`

**Files:**
- Create: `components/devis/RecipientPicker.tsx`

**Interfaces:**
- Consumes: `CustomerContact`/`listContacts` (Task 2).
- Produces: `export default function RecipientPicker({ customerId, valueContactId, onPick }: { customerId: string; valueContactId: string | null; onPick: (contact: CustomerContact | null) => void })` — charge les contacts du client, affiche un `<select>` (label = `name` + rôle), déclenche `onPick(contact)` au choix ; sélectionne le primaire par défaut.

- [ ] **Step 1: Écrire `components/devis/RecipientPicker.tsx`**

```tsx
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
```

- [ ] **Step 2: Vérifier** `npx tsc --noEmit` → 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add components/devis/RecipientPicker.tsx
git commit -m "feat(devis): composant RecipientPicker (choix du contact destinataire)"
```

---

### Task 7: Brancher le destinataire aux points d'entrée devis + écrire le snapshot

**Files:**
- Modify: `components/devis/steps/StepClientEvent.tsx`
- Modify: `components/devis/WeboWordSidePanels.tsx`
- Modify: `context/DevisContext.tsx` (ajouter les champs destinataire au `clientInfo` si absents)

**Interfaces:**
- Consumes: `RecipientPicker` (Task 6), `snapshotFromContact` (Task 2).

**Note:** `StepClientEvent` connaît déjà le client sélectionné (`customer`/`customer_id`) et `clientInfo` (avec `siret`, `contactName`, `contactEmail`, `contactPhone`). On y ajoute le picker et on stocke le contact choisi + son rôle. Le snapshot (`contact_person_name`, `recipient_contact_*`, `company_name`, `client_siret`) est écrit dans le payload devis au moment du save (`StepResume`, `QuoteInlineEditor`, `WeboWordSidePanels`).

- [ ] **Step 1: Étendre `context/DevisContext.tsx`** — ajouter au type `clientInfo` les champs manquants (si absents) : `contactRole: string;` et `contactId: string;`. Mettre à jour `DEFAULT.clientInfo` avec `contactRole: '', contactId: ''`.

```tsx
    contactName: string;
    contactRole: string;
    contactId: string;
    contactEmail: string;
    contactPhone: string;
```
(et dans DEFAULT : `contactName: '', contactRole: '', contactId: '', contactEmail: '', contactPhone: '',`)

- [ ] **Step 2: Dans `StepClientEvent.tsx`**, après la sélection d'un client entreprise, afficher le picker. Repérer le bloc qui rend les champs entreprise (autour de `clientInfo.contactName`, ligne ~351) et y insérer, quand un `customer_id` est présent et `type === 'entreprise'` :

```tsx
{clientInfo.type === 'entreprise' && selectedCustomerId && (
  <RecipientPicker
    customerId={selectedCustomerId}
    valueContactId={clientInfo.contactId || null}
    onPick={(c) => {
      dispatch({ type: 'UPDATE_CLIENT', payload: {
        contactId: c?.id ?? '',
        contactName: c?.name ?? '',
        contactRole: c?.role ?? '',
        contactEmail: c?.email ?? '',
        contactPhone: c?.phone ?? '',
      }});
    }}
  />
)}
```
(`selectedCustomerId` = l'id du client choisi ; s'il n'existe pas déjà dans le composant, le stocker en state lors de la sélection d'un client existant.)

- [ ] **Step 3: Écrire le snapshot dans le payload devis.** Dans `components/devis/steps/StepResume.tsx`, ajouter au `quotePayload` :

```tsx
    contact_person_name:  clientInfo.contactName || null,
    recipient_contact_role:  clientInfo.contactRole || null,
    recipient_contact_email: clientInfo.contactEmail || null,
    recipient_contact_phone: clientInfo.contactPhone || null,
    client_siret:         clientInfo.siret || null,
```
(la raison sociale `company_name: clientInfo.companyName` est déjà dans le payload.)

- [ ] **Step 4: Dans `WeboWordSidePanels.tsx`** (panneau Client), charger le `customer_id` du devis et, si entreprise, afficher `RecipientPicker` ; au save, inclure `recipient_contact_role/email/phone` et `client_siret` dans `updatePayload` (à partir de l'état local du contact choisi). Ajouter les champs au `select` de chargement du devis (`recipient_contact_role, recipient_contact_email, recipient_contact_phone, client_siret, customer_id`).

- [ ] **Step 5: Vérifier** `npx tsc --noEmit` + `npx next build` → exit 0.

- [ ] **Step 6: Test manuel** — créer un devis pour une entreprise à ≥2 contacts, choisir un destinataire, enregistrer, rouvrir → le bon contact + SIRET sont mémorisés sur le devis.

- [ ] **Step 7: Commit**

```bash
git add context/DevisContext.tsx "components/devis/steps/StepClientEvent.tsx" components/devis/steps/StepResume.tsx components/devis/WeboWordSidePanels.tsx
git commit -m "feat(devis): choix du destinataire (contact) + snapshot SIRET/contact sur le devis"
```

---

### Task 8: Affichage raison sociale + SIRET + contact sur le document (`generateQuoteHtml`)

**Files:**
- Modify: `lib/generateQuoteHtml.ts`
- Modify: `app/(app)/devis/[id]/modifier/page.tsx`
- Modify: `components/devis/LivePreview.tsx`
- Modify: `components/devis/QuoteInlineEditor.tsx`
- Modify: `components/devis/steps/StepWeboWord.tsx`

**Interfaces:**
- Produces: `QuoteHtmlData` étendu avec `clientType?: 'particulier' | 'entreprise'; clientCompanyName?: string | null; clientSiret?: string | null; contactName?: string | null; contactRole?: string | null; contactEmail?: string | null; contactPhone?: string | null;`

- [ ] **Step 1: Étendre l'interface `QuoteHtmlData`** dans `lib/generateQuoteHtml.ts` (après `guestCountChildren`) :

```typescript
  clientType?: 'particulier' | 'entreprise';
  clientCompanyName?: string | null;
  clientSiret?: string | null;
  contactName?: string | null;
  contactRole?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
```

- [ ] **Step 2: Adapter le bloc client** dans `generateQuoteHtml` (la carte « CLIENT », autour de `${d.clientName || t.aCompleter}`). Le remplacer par un rendu conditionnel entreprise :

```typescript
      <p style="font-size:14px;font-weight:bold;margin:0 0 3px;">${
        (d.clientType === 'entreprise' && d.clientCompanyName) ? d.clientCompanyName : (d.clientName || t.aCompleter)
      }</p>
      ${d.clientType === 'entreprise' && d.clientSiret ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">SIRET : ${d.clientSiret}</p>` : ''}
      ${d.clientType === 'entreprise' && d.contactName ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">${lang === 'en' ? 'Attn' : 'À l\\'attention de'} : ${d.contactName}${d.contactRole ? ` — ${d.contactRole}` : ''}</p>` : ''}
      ${(d.clientType === 'entreprise' ? d.contactEmail : d.clientEmail) ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">${d.clientType === 'entreprise' ? d.contactEmail : d.clientEmail}</p>` : ''}
      ${(d.clientType === 'entreprise' ? d.contactPhone : d.clientPhone) ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">${d.clientType === 'entreprise' ? d.contactPhone : d.clientPhone}</p>` : ''}
      ${d.clientAddress ? `<p style="color:#555;margin:0;font-size:11px;">${d.clientAddress}</p>` : ''}
```
(Remplace les lignes existantes `${d.clientEmail ? …}`, `${d.clientPhone ? …}`, `${d.clientAddress ? …}` du bloc client.)

- [ ] **Step 3: Passer les champs depuis `app/(app)/devis/[id]/modifier/page.tsx`** — dans l'objet passé à `generateQuoteHtml` (et au `WeboWordEditor` via `initialHtml`), ajouter :

```typescript
        clientType:        (quote.client_type as 'particulier' | 'entreprise') ?? 'particulier',
        clientCompanyName: quote.company_name ?? null,
        clientSiret:       (quote as { client_siret?: string | null }).client_siret ?? null,
        contactName:       quote.contact_person_name ?? null,
        contactRole:       (quote as { recipient_contact_role?: string | null }).recipient_contact_role ?? null,
        contactEmail:      (quote as { recipient_contact_email?: string | null }).recipient_contact_email ?? null,
        contactPhone:      (quote as { recipient_contact_phone?: string | null }).recipient_contact_phone ?? null,
```
(S'assurer que le `select` du devis dans cette page inclut `client_siret, recipient_contact_role, recipient_contact_email, recipient_contact_phone, company_name, contact_person_name, client_type`.)

- [ ] **Step 4: Passer les champs depuis les aperçus** `LivePreview.tsx`, `QuoteInlineEditor.tsx`, `StepWeboWord.tsx` — dans chaque appel `generateQuoteHtml`, ajouter les mêmes clés à partir de `clientInfo` (wizard/éditeur) :

```typescript
        clientType:        client.type,               // ou clientInfo.type / state.clientInfo.type
        clientCompanyName: client.companyName || null,
        clientSiret:       client.siret || null,
        contactName:       client.contactName || null,
        contactRole:       client.contactRole || null,
        contactEmail:      client.contactEmail || null,
        contactPhone:      client.contactPhone || null,
```
(Adapter le nom de la variable client selon le fichier : `client` dans QuoteInlineEditor, `clientInfo` dans LivePreview, `state.clientInfo` dans StepWeboWord.)

- [ ] **Step 5: Vérifier** `npx tsc --noEmit` + `npx next build` → exit 0.

- [ ] **Step 6: Test manuel** — générer/imprimer un devis entreprise : le bloc client affiche Raison sociale + SIRET + « À l'attention de : contact — rôle » + email/tél du contact. Un devis particulier reste inchangé.

- [ ] **Step 7: Commit**

```bash
git add lib/generateQuoteHtml.ts "app/(app)/devis/[id]/modifier/page.tsx" components/devis/LivePreview.tsx components/devis/QuoteInlineEditor.tsx components/devis/steps/StepWeboWord.tsx
git commit -m "feat(devis): affichage raison sociale + SIRET + contact destinataire sur le document"
```

---

### Task 9: Vérification finale + checklist de test manuel

**Files:** aucun (vérification).

- [ ] **Step 1:** `npx tsc --noEmit` → 0 erreur.
- [ ] **Step 2:** `npx next lint --max-warnings 9999` → 0 erreur.
- [ ] **Step 3:** `npx next build` → exit 0.
- [ ] **Step 4: Checklist manuelle** (après avoir appliqué le SQL dans Supabase) :
  - Créer un client entreprise avec 3 contacts (rôles différents), un principal.
  - Éditer le client : ajouter/supprimer un contact, changer le principal → persistance.
  - Créer un devis pour ce client → sélecteur destinataire présent, primaire par défaut, choix d'un autre contact.
  - Enregistrer, rouvrir le devis → destinataire + SIRET conservés.
  - Imprimer/PDF → bloc client = raison sociale + SIRET + contact (nom, rôle, email, tél).
  - Devis particulier → bloc client inchangé.
- [ ] **Step 5: Commit** (si ajustements) puis push.

```bash
git push origin main
```

---

## Notes d'exécution

- **SQL non exécuté par l'agent** : Task 1 ajoute les fichiers ; l'utilisateur applique `sql/00_APPLIQUER_TOUT.sql` (ou `sql/lot_c_customer_contacts.sql`) dans Supabase avant les tests manuels des Tasks 4-9.
- **Pas de tests unitaires** dans le repo → la « boucle rouge/vert » est remplacée par tsc + build + test manuel navigateur.
- Suivre les patterns existants (Tailwind, `createClient`, composants `'use client'`).
