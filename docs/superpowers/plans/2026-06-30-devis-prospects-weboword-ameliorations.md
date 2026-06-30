# Améliorations Devis / Prospects / WeboWord — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger 3 bugs et livrer 6 améliorations sur les pages Devis/Prospects et le rendu WeboWord (logo, CGV, page de garde).

**Architecture:** Modifications ciblées de composants React existants (Next.js App Router, client components) + une route serveur d'impression. Données via Supabase JS. Le rendu WeboWord est centralisé en réutilisant les helpers purs `printHelpers.ts`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase (`@supabase/ssr`), Tailwind, lucide-react.

## Global Constraints

- **Pas de framework de test** dans ce projet. La vérification de chaque tâche se fait par : `npm run lint`, `npm run build` (compilation TypeScript) et **test manuel** dans l'app (`npm run dev`, http://localhost:3001). Ne PAS introduire de framework de test.
- **Couleur de marque** : violet `#9c27b0` (hover `#7b1fa2`), fond clair `#f3e5f5`. Réutiliser les classes Tailwind existantes des composants voisins.
- **Table `customers`** : colonnes propriétaire = `owner_user_id`, type = `customer_type` (valeurs `'particulier'` | `'entreprise'`). NE JAMAIS utiliser `user_id` ni `type` sur cette table.
- **Table `quotes`** : `user_id` ET `owner_user_id` existent et sont tous deux renseignés à la création (cf. code existant). Colonnes client texte : `client_name`, `client_first_name`, `client_last_name`, `client_email`, `client_phone`, `client_address`. Lien client : `customer_id`. Lien prospect : `prospect_id`. Rendu WeboWord : `content_html`, `cover_page_config`, `photos_page_config`, `selected_font`.
- **Table `profiles`** : `logo_url` (texte/URL), `cgv` (HTML). La colonne `cgv` peut ne pas exister sur d'anciennes bases → toujours la lire en `try/maybeSingle` et tolérer `null`.
- **Commits fréquents** : un commit par tâche terminée et vérifiée. Branche de travail dédiée (ne pas committer directement sur `main`).

---

## File Structure

| Fichier | Rôle | Lot |
|---|---|---|
| `app/(app)/prospects/page.tsx` | Fix insertions `customers` (A1), conversion remplit `client_name` (A2) | A |
| `app/(app)/devis/page.tsx` | Recherche élargie (A2), actions cartes pipeline (B1), cartes prospect (B2) | A,B |
| `components/devis/ImportDevisModal.tsx` | Sélecteur client existant/nouveau + lien `customer_id` (C1) | C |
| `components/devis/weboword/printHelpers.ts` | Ajout `buildCgvHtml`, logo dans cover (D1, D2) | D |
| `components/devis/WeboWordEditor.tsx` | Logo+CGV dans print/PDF (D1,D2), bouton ajout ligne page de garde (D4) | D |
| `app/(print)/devis/[id]/imprimer/page.tsx` | Inclure cover+photos+logo+CGV pour devis WeboWord (D1,D2,D3) | D |
| `components/devis/weboword/CoverPageBuilder.tsx` | Bouton « + ligne de texte » (D4) | D |

---

## LOT A — Bugs

### Task A1 : Corriger les insertions `customers` dans Prospects

**Files:**
- Modify: `app/(app)/prospects/page.tsx` (fonctions `SaveAsCustomerButton` ~L510-542, `CreateDevisModal.handleCreate` ~L292-337)

**Interfaces:**
- Produces: insertion `customers` conforme aux colonnes `owner_user_id` / `customer_type`.

- [ ] **Step 1 : Corriger `SaveAsCustomerButton`**

Dans la vérification d'existence, scoper au propriétaire ; dans l'insertion, utiliser `owner_user_id`. Remplacer le bloc `useEffect` de détection et la fonction `save` :

```tsx
useEffect(() => {
  if (!prospect.email) return;
  const supabase = createClient();
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    supabase.from('customers')
      .select('id')
      .eq('email', prospect.email.toLowerCase())
      .eq('owner_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setAlreadyExists(true); });
  });
}, [prospect.email]);

const save = async () => {
  setLoading(true);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { setLoading(false); return; }
  const { error } = await supabase.from('customers').insert({
    owner_user_id: user.id,
    first_name: prospect.first_name || null,
    last_name: prospect.last_name || null,
    email: prospect.email.toLowerCase(),
    phone: prospect.phone || null,
    customer_type: 'particulier',
  });
  setLoading(false);
  if (error) {
    alert('Erreur: ' + error.message);
  } else {
    setSaved(true);
    setAlreadyExists(true);
  }
};
```

- [ ] **Step 2 : Corriger `CreateDevisModal.handleCreate` (recherche + insertion client)**

Remplacer le bloc « Find or create customer » :

```tsx
// 1. Find or create customer
let customerId: string | null = null;
const { data: existing } = await supabase
  .from('customers')
  .select('id')
  .eq('email', email.trim().toLowerCase())
  .eq('owner_user_id', user.id)
  .limit(1)
  .maybeSingle();

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
      owner_user_id: user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      customer_type: 'particulier',
    })
    .select('id')
    .single();
  if (custErr) throw new Error(custErr.message);
  customerId = newCustomer.id;
}
```

- [ ] **Step 3 : Vérifier lint + build**

Run: `npm run lint && npm run build`
Expected: aucune erreur sur `prospects/page.tsx`.

- [ ] **Step 4 : Test manuel**

Run: `npm run dev` → ouvrir `/prospects`, sélectionner un prospect, cliquer « Enregistrer en client » → message « Ajouté aux clients ! », fiche visible dans `/clients`. Tester aussi « Créer un devis » → pas d'erreur, redirection vers l'éditeur.

- [ ] **Step 5 : Commit**

```bash
git add "app/(app)/prospects/page.tsx"
git commit -m "fix(prospects): aligner insertion customers sur owner_user_id/customer_type"
```

---

### Task A2 : Recherche « Mes devis » + remplissage `client_name` à la conversion

**Files:**
- Modify: `app/(app)/devis/page.tsx` (interface `Quote` ~L29-45 ; requête `quotes` ~L654-657 et ~L1019 ; filtre `filtered` ~L811-817)
- Modify: `app/(app)/prospects/page.tsx` (`CreateDevisModal.handleCreate`, insertion `quotes`)

**Interfaces:**
- Consumes: colonnes client de A1.
- Produces: `quotes` créés depuis prospect ont `client_name`/`client_first_name`/`client_last_name`/`client_email` remplis ; recherche élargie.

- [ ] **Step 1 : Étendre l'interface `Quote`**

Ajouter dans l'interface `Quote` :

```tsx
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_email?: string | null;
```

- [ ] **Step 2 : Charger ces colonnes dans les 2 requêtes `quotes`**

Dans le `select` du `useEffect` (~L655) ET dans le `select` de `onCreated` de `ImportDevisModal` (~L1019), ajouter `client_first_name, client_last_name, client_email` à la liste des colonnes.

- [ ] **Step 3 : Élargir le filtre de recherche**

Remplacer la ligne `matchSearch` dans `filtered` :

```tsx
const q4 = search.toLowerCase();
const haystack = [
  q.client_name, q.client_first_name, q.client_last_name,
  q.client_email, q.event_type,
].filter(Boolean).join(' ').toLowerCase();
const matchSearch = !search || haystack.includes(q4);
```

- [ ] **Step 4 : Remplir `client_name` à la conversion prospect→devis**

Dans `prospects/page.tsx`, `CreateDevisModal.handleCreate`, ajouter au payload d'insertion `quotes` (objet passé à `.insert({...})`) :

```tsx
client_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
client_first_name: firstName.trim(),
client_last_name: lastName.trim(),
client_email: email.trim().toLowerCase() || null,
client_phone: phone.trim() || null,
```

- [ ] **Step 5 : Vérifier lint + build**

Run: `npm run lint && npm run build`
Expected: aucune erreur.

- [ ] **Step 6 : Test manuel**

Convertir un prospect en devis, revenir sur `/devis`, taper le nom du client dans la recherche → le devis apparaît (grille, tableau et pipeline).

- [ ] **Step 7 : Commit**

```bash
git add "app/(app)/devis/page.tsx" "app/(app)/prospects/page.tsx"
git commit -m "fix(devis): recherche par nom/prenom/email + remplir client_name a la conversion"
```

---

## LOT B — Pipeline & Prospects unifiés

### Task B1 : Actions rapides sur les cartes Pipeline

**Files:**
- Modify: `app/(app)/devis/page.tsx` (`PipelineView` ~L511-608 ; appel `PipelineView` ~L993)

**Interfaces:**
- Consumes: `onOpenSheet(q)` existant.
- Produces: `PipelineView` accepte `onDuplicate(id)` en plus.

- [ ] **Step 1 : Ajouter `onDuplicate` à la signature de `PipelineView`**

```tsx
function PipelineView({
  quotes, onStatusChange, onOpenSheet, onDuplicate,
}: {
  quotes: Quote[]; onStatusChange: (id: string, s: string) => void; onOpenSheet: (q: Quote) => void; onDuplicate: (id: string) => void;
}) {
```

- [ ] **Step 2 : Importer les icônes nécessaires**

Vérifier que `Printer`, `Pencil`, `Copy`, `Eye` sont déjà importés (oui, en tête de fichier). Sinon les ajouter.

- [ ] **Step 3 : Remplacer la barre d'action en bas de la carte pipeline**

Dans la carte (bloc `<div className="flex items-center justify-between mt-1">` ~L588-593), remplacer le bouton flèche unique par une rangée d'actions :

```tsx
<div className="flex items-center justify-between mt-1 pt-1.5 border-t border-gray-100">
  {(() => { const t = computeQuoteTotal(q); return t ? <p className="text-xs font-bold text-gray-900 tabular-nums">{formatCurrency(t)}</p> : <span />; })()}
  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
    <button onClick={() => onOpenSheet(q)} title="Aperçu" className="p-1 text-gray-300 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded transition-colors"><Eye className="h-3 w-3" /></button>
    <Link href={`/devis/${q.id}/imprimer`} target="_blank" title="PDF" className="p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"><Printer className="h-3 w-3" /></Link>
    <button onClick={() => onDuplicate(q.id)} title="Dupliquer" className="p-1 text-gray-300 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded transition-colors"><Copy className="h-3 w-3" /></button>
    <Link href={`/devis/${q.id}/modifier?mode=weboword`} title="Éditer" className="p-1 text-gray-300 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded transition-colors"><Pencil className="h-3 w-3" /></Link>
  </div>
</div>
```

Note : le `draggable` de la carte reste actif ; le `onClick={(e) => e.stopPropagation()}` empêche le drag de gêner les clics sur les boutons.

- [ ] **Step 4 : Passer `onDuplicate` à l'appel `PipelineView`**

```tsx
<PipelineView quotes={filtered} onStatusChange={handleStatusChange} onOpenSheet={(q) => setSheetQuote(q)} onDuplicate={handleDuplicate} />
```

- [ ] **Step 5 : Vérifier lint + build**

Run: `npm run lint && npm run build`
Expected: aucune erreur.

- [ ] **Step 6 : Test manuel**

Vue Pipeline → sur une carte : PDF s'ouvre dans un onglet, Éditer ouvre l'éditeur, Dupliquer ouvre le modal, Aperçu ouvre le panneau. Le glisser-déposer entre colonnes fonctionne toujours.

- [ ] **Step 7 : Commit**

```bash
git add "app/(app)/devis/page.tsx"
git commit -m "feat(devis): actions rapides (apercu/PDF/dupliquer/editer) sur cartes pipeline"
```

---

### Task B2 : Afficher les prospects non convertis dans « Mes devis »

**Files:**
- Modify: `app/(app)/devis/page.tsx` (état + chargement + rendu colonne/section Nouveau)

**Interfaces:**
- Consumes: table `prospect_requests` (colonnes : `id, first_name, last_name, email, phone, address, event_type, event_date, guest_count, status, owner_user_id, user_token, created_at`).
- Produces: type `ProspectCard` interne + rendu de cartes prospect dans Nouveau ; conversion via navigation vers `/prospects` (réutilisation du flux existant) — voir Step 5.

- [ ] **Step 1 : Ajouter un type et un état pour les prospects non liés**

En haut de `DevisPage`, ajouter :

```tsx
interface ProspectLite {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  status: string;
}
const [prospects, setProspects] = useState<ProspectLite[]>([]);
```

- [ ] **Step 2 : Charger les prospects non convertis dans le `useEffect`**

Après le chargement des quotes, et en réutilisant le pattern de tokens de `prospects/page.tsx`, ajouter au `Promise.all` une requête prospects, puis filtrer ceux qui n'ont PAS de devis lié (comparer avec les `prospect_id` présents dans `quotes`) :

```tsx
// dans le .then(...) après avoir set quotes :
const linkedProspectIds = new Set((quotesRes.data ?? []).map((q) => q.prospect_id).filter(Boolean));
const { data: tokenRows } = await supabase.from('user_prospect_tokens').select('token').eq('user_id', user.id);
const myTokens = (tokenRows ?? []).map((r: { token: string }) => r.token);
let pq = supabase.from('prospect_requests').select('id, first_name, last_name, email, event_type, event_date, guest_count, status').order('created_at', { ascending: false });
pq = myTokens.length > 0
  ? pq.or(`owner_user_id.eq.${user.id},user_token.in.(${myTokens.join(',')})`)
  : pq.eq('owner_user_id', user.id);
const { data: prospectRows } = await pq;
setProspects((prospectRows ?? []).filter((p) => !linkedProspectIds.has(p.id)));
```

> Note d'implémentation : convertir le `.then` actuel en fonction `async` pour pouvoir `await` ces requêtes secondaires.

- [ ] **Step 3 : Carte prospect (composant interne)**

Ajouter un petit composant rendant une carte au style distinct (badge « Prospect », bordure ambrée), avec menu de statut réutilisant `PIPELINE_ORDER`/`STATUS_CONFIG`, et un bouton « Convertir » :

```tsx
function ProspectMiniCard({ p, onStatus, onConvert }: { p: ProspectLite; onStatus: (id: string, s: string) => void; onConvert: (id: string) => void }) {
  return (
    <div className="bg-white border border-amber-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Prospect</span>
        <p className="text-xs font-semibold text-gray-900 truncate">{p.first_name} {p.last_name}</p>
      </div>
      <p className="text-[10px] text-gray-500 truncate">{p.event_type || '—'}{p.event_date ? ` · ${formatDate(p.event_date)}` : ''}</p>
      <div className="flex items-center gap-1 mt-2">
        <select value={p.status} onChange={(e) => onStatus(p.id, e.target.value)} className="text-[10px] border border-gray-200 rounded px-1 py-0.5 flex-1">
          {PIPELINE_ORDER.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
        <button onClick={() => onConvert(p.id)} className="text-[10px] font-semibold text-[#9c27b0] border border-[#9c27b0]/30 rounded px-2 py-0.5 hover:bg-[#f3e5f5]">Convertir</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Handlers statut + conversion**

```tsx
const handleProspectStatus = useCallback(async (id: string, status: string) => {
  setProspects((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
  await createClient().from('prospect_requests').update({ status }).eq('id', id);
}, []);

const handleConvertProspect = useCallback((id: string) => {
  router.push(`/prospects?convert=${id}`);
}, [router]);
```

> La conversion réelle reste gérée par `CreateDevisModal` dans `/prospects`. Voir Step 6 pour l'auto-ouverture.

- [ ] **Step 5 : Afficher les cartes prospect dans la colonne « Nouveau » (pipeline) et la section grille**

Dans `PipelineView`, pour la colonne `statusKey === 'nouveau'`, rendre d'abord les `ProspectMiniCard` (passer `prospects`, `handleProspectStatus`, `handleConvertProspect` en props à `PipelineView`). En vues grille/tableau, n'afficher les cartes prospect que si `activeStatus === 'Tous'` ou `'Nouveau'`, au-dessus de la grille de devis.

- [ ] **Step 6 : Auto-ouvrir le modal de conversion côté `/prospects`**

Dans `prospects/page.tsx`, lire le param `convert` (via `useSearchParams`) au montage ; si présent et que le prospect est chargé, ouvrir `CreateDevisModal` pour ce prospect (set `createDevisFor`).

```tsx
// après le load() initial
const searchParams = useSearchParams();
useEffect(() => {
  const cid = searchParams.get('convert');
  if (cid && prospects.length) {
    const p = prospects.find((x) => x.id === cid);
    if (p) setCreateDevisFor(p);
  }
}, [searchParams, prospects]);
```

- [ ] **Step 7 : Vérifier lint + build**

Run: `npm run lint && npm run build`
Expected: aucune erreur (attention au type de `useSearchParams` → composant déjà `'use client'`).

- [ ] **Step 8 : Test manuel**

Créer un prospect via le formulaire public, aller sur `/devis` : il apparaît sous « Nouveau » (pipeline + grille) avec badge Prospect. Changer son statut → persiste après refresh. Cliquer « Convertir » → redirige vers `/prospects` avec le modal de création ouvert ; après conversion, il disparaît des cartes prospect et devient un vrai devis.

- [ ] **Step 9 : Commit**

```bash
git add "app/(app)/devis/page.tsx" "app/(app)/prospects/page.tsx"
git commit -m "feat(devis): afficher les prospects non convertis sous Nouveau avec statut et conversion"
```

---

## LOT C — Import de devis

### Task C1 : Lier un client existant ou nouveau lors de l'import

**Files:**
- Modify: `components/devis/ImportDevisModal.tsx`

**Interfaces:**
- Consumes: table `customers` (`owner_user_id`, `customer_type`, `first_name`, `last_name`, `email`, `phone`, `address`).
- Produces: devis importé avec `customer_id` renseigné.

- [ ] **Step 1 : Ajouter l'état du sélecteur de client**

```tsx
const [clientMode, setClientMode] = useState<'new' | 'existing'>('new');
const [customerSearch, setCustomerSearch] = useState('');
const [customerResults, setCustomerResults] = useState<{ id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; address: string | null }[]>([]);
const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
```

- [ ] **Step 2 : Recherche de clients existants**

```tsx
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

const pickCustomer = (c: { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; address: string | null }) => {
  setSelectedCustomerId(c.id);
  setFirstName(c.first_name ?? '');
  setLastName(c.last_name ?? '');
  setEmail(c.email ?? '');
  setPhone(c.phone ?? '');
  setBillingAddress(c.address ?? '');
  setCustomerResults([]);
  setCustomerSearch(`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim());
};
```

- [ ] **Step 3 : UI du sélecteur (au-dessus du bloc Client)**

Ajouter un toggle « Nouveau client / Client existant ». En mode `existing`, afficher un champ de recherche + la liste de résultats (réutiliser le style des résultats prospect de `devis/page.tsx`). En mode `new`, garder les champs texte actuels. Réinitialiser `selectedCustomerId` quand on revient en mode `new`.

- [ ] **Step 4 : Créer/lier le customer à la sauvegarde**

Dans `handleSave`, avant le `payload`, résoudre `customer_id` (seulement en création, pas forcément en édition) :

```tsx
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
```

Puis ajouter `customer_id: customerId` dans l'objet `.insert({ ...payload, ... })` de création (et `.update(payload)` peut aussi inclure `customer_id: customerId` si défini).

- [ ] **Step 5 : Réinitialiser les nouveaux états dans `reset()`**

Ajouter `setClientMode('new'); setCustomerSearch(''); setCustomerResults([]); setSelectedCustomerId(null);` dans `reset()`.

- [ ] **Step 6 : Vérifier lint + build**

Run: `npm run lint && npm run build`
Expected: aucune erreur.

- [ ] **Step 7 : Test manuel**

`/devis` → Importer. (a) Mode « Client existant » : rechercher un client, le sélectionner, importer → le devis importé est lié (vérifier `customer_id` non nul). (b) Mode « Nouveau client » avec un email inédit → une fiche `customers` est créée et liée.

- [ ] **Step 8 : Commit**

```bash
git add components/devis/ImportDevisModal.tsx
git commit -m "feat(import): choisir un client existant ou en creer un, lier customer_id au devis importe"
```

---

## LOT D — Rendu WeboWord

### Task D1+D2 : Logo en en-tête + CGV en dernière page (helpers)

**Files:**
- Modify: `components/devis/weboword/printHelpers.ts` (ajout helpers purs)

**Interfaces:**
- Produces:
  - `buildLogoHeaderHtml(logoUrl: string | null | undefined): string`
  - `buildCgvHtml(cgv: string | null | undefined): string`

- [ ] **Step 1 : Ajouter `buildLogoHeaderHtml`**

```ts
export function buildLogoHeaderHtml(logoUrl: string | null | undefined): string {
  if (!logoUrl) return ''
  return `<div style="text-align:center;padding:10mm 0 4mm;"><img src="${esc(logoUrl)}" alt="Logo" style="max-height:80px;max-width:220px;object-fit:contain;" /></div>`
}
```

- [ ] **Step 2 : Ajouter `buildCgvHtml` (dernière page dédiée, condensé)**

```ts
export function buildCgvHtml(cgv: string | null | undefined): string {
  if (!cgv || !cgv.trim()) return ''
  return `<div style="page-break-before:always;break-before:page;padding:18mm 16mm;">
  <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:0.12em;color:#666;border-bottom:1px solid #ddd;padding-bottom:6px;margin:0 0 10px;">Conditions Générales de Vente</h2>
  <div style="font-size:8.5px;line-height:1.45;color:#444;column-count:2;column-gap:10mm;text-align:justify;">${cgv}</div>
</div>`
}
```

> Le `cgv` est déjà du HTML (saisi via l'éditeur de `/parametres`). On l'injecte tel quel à l'intérieur du conteneur condensé (2 colonnes, petite taille).

- [ ] **Step 3 : Vérifier build**

Run: `npm run build`
Expected: compilation OK (fichier purement TS, importable côté serveur et client).

- [ ] **Step 4 : Commit**

```bash
git add components/devis/weboword/printHelpers.ts
git commit -m "feat(weboword): helpers logo header et CGV derniere page (condense)"
```

---

### Task D2b : Intégrer logo + CGV dans l'impression/PDF de l'éditeur

**Files:**
- Modify: `components/devis/WeboWordEditor.tsx` (`buildPrintHtml` ~L768-815 ; `handleSavePdf` ~L828-881 ; chargement profil)

**Interfaces:**
- Consumes: `buildLogoHeaderHtml`, `buildCgvHtml` (D1).
- Produces: print/PDF éditeur incluant logo (haut) + CGV (dernière page).

- [ ] **Step 1 : Charger le profil (logo + cgv) au montage**

Ajouter un état `const [profile, setProfile] = useState<{ logo_url: string | null; cgv: string | null }>({ logo_url: null, cgv: null });` et le charger :

```tsx
useEffect(() => {
  if (!user) return;
  const supabase = createClient();
  (async () => {
    const { data } = await supabase.from('profiles').select('logo_url').eq('id', user.id).maybeSingle();
    let cgv: string | null = null;
    try {
      const { data: c } = await supabase.from('profiles').select('cgv').eq('id', user.id).maybeSingle();
      cgv = c?.cgv ?? null;
    } catch { /* colonne absente */ }
    setProfile({ logo_url: data?.logo_url ?? null, cgv });
  })();
}, [user]);
```

(Adapter `user` à la source réelle dans le composant — vérifier l'import `useAuth`.)

- [ ] **Step 2 : Importer les helpers**

Mettre à jour l'import existant :

```tsx
import { buildCoverPageHtml, buildPhotosPageHtml, buildLogoHeaderHtml, buildCgvHtml } from './weboword/printHelpers';
```

- [ ] **Step 3 : Injecter dans `buildPrintHtml`**

Modifier le `return` du `<body>` :

```tsx
const logoHtml = buildLogoHeaderHtml(profile.logo_url);
const cgvHtml = buildCgvHtml(profile.cgv);
// ...
// <body>
//   ${coverHtml}
//   ${coverHtml ? '' : logoHtml}
//   <div style="padding:20mm;">${content}</div>
//   ${photosHtml}
//   ${cgvHtml}
```

> Si une page de garde existe, le logo y sera ajouté (Task D3) ; sinon on met le logo en tête du corps. Ici on évite le doublon avec `${coverHtml ? '' : logoHtml}`.

- [ ] **Step 4 : Injecter de même dans `handleSavePdf`**

Mêmes ajouts : `logoHtml` (si pas de cover) avant `.pdf-wrap`, et `cgvHtml` après `photosHtml`.

- [ ] **Step 5 : Vérifier lint + build**

Run: `npm run lint && npm run build`
Expected: aucune erreur.

- [ ] **Step 6 : Test manuel**

Dans l'éditeur WeboWord : renseigner logo + CGV dans `/parametres`, puis « Imprimer » et « Enregistrer PDF » → le logo apparaît (en tête de doc si pas de page de garde) et les CGV sur une dernière page condensée (2 colonnes).

- [ ] **Step 7 : Commit**

```bash
git add components/devis/WeboWordEditor.tsx
git commit -m "feat(weboword): logo + CGV dans impression et PDF de l'editeur"
```

---

### Task D3 : Route d'impression — inclure cover + photos + logo + CGV (parité)

**Files:**
- Modify: `app/(print)/devis/[id]/imprimer/page.tsx`

**Interfaces:**
- Consumes: `buildCoverPageHtml`, `buildPhotosPageHtml`, `buildLogoHeaderHtml`, `buildCgvHtml`.
- Produces: rendu serveur identique à l'éditeur pour les devis WeboWord.

- [ ] **Step 1 : Récupérer le profil AUSSI pour le chemin WeboWord**

Déplacer la récupération du `profile` (logo_url, cgv) AVANT le bloc `if (quote.content_html)`, et inclure `logo_url, cgv` dans le `select`. Gérer `cgv` éventuellement absent via `try/catch` ou en tolérant `null`.

- [ ] **Step 2 : Importer les helpers**

```tsx
import { buildCoverPageHtml, buildPhotosPageHtml, buildLogoHeaderHtml, buildCgvHtml } from '@/components/devis/weboword/printHelpers';
import { DEFAULT_COVER_CONFIG, DEFAULT_PHOTOS_CONFIG } from '@/components/devis/weboword/weboword.types';
```

- [ ] **Step 3 : Construire le document complet dans le chemin `content_html`**

Dans le bloc `if (quote.content_html) { ... }`, composer cover + logo + contenu + photos + CGV :

```tsx
const coverHtml = buildCoverPageHtml((quote.cover_page_config as CoverPageConfig) ?? DEFAULT_COVER_CONFIG);
const photosHtml = buildPhotosPageHtml((quote.photos_page_config as PhotosPageConfig) ?? DEFAULT_PHOTOS_CONFIG);
const logoHtml = buildLogoHeaderHtml(profile?.logo_url);
const cgvHtml = buildCgvHtml(profile?.cgv);
```

Puis dans le JSX, remplacer le `<div ... dangerouslySetInnerHTML={{ __html: content_html }} />` par une série de blocs :

```tsx
<>
  {coverHtml && <div dangerouslySetInnerHTML={{ __html: coverHtml }} />}
  {!coverHtml && logoHtml && <div dangerouslySetInnerHTML={{ __html: logoHtml }} />}
  <div className="prose prose-sm max-w-none" style={{ padding: '20mm', fontFamily: `'${selectedFont}', Georgia, serif` }} dangerouslySetInnerHTML={{ __html: quote.content_html as string }} />
  {photosHtml && <div dangerouslySetInnerHTML={{ __html: photosHtml }} />}
  {cgvHtml && <div dangerouslySetInnerHTML={{ __html: cgvHtml }} />}
</>
```

Conserver `<AutoPrint />`, le `<link>` font conditionnel et le `<style>` (ajouter au `<style>` les règles `page-break` déjà présentes dans l'éditeur si nécessaire — les helpers posent déjà les `page-break-before` inline).

- [ ] **Step 4 : Importer les types**

Ajouter l'import des types `CoverPageConfig`, `PhotosPageConfig` depuis `weboword.types`.

- [ ] **Step 5 : Vérifier lint + build**

Run: `npm run lint && npm run build`
Expected: aucune erreur (le composant est un Server Component ; les helpers sont des fonctions pures sans `'use client'` requis — vérifier que `CoverPage.templates.ts` n'importe rien de client).

- [ ] **Step 6 : Test manuel**

Depuis `/devis`, bouton PDF d'un devis WeboWord (qui a une page de garde + photos + logo + CGV configurés) → la page `/devis/[id]/imprimer` affiche page de garde, logo, corps, photos puis CGV, et déclenche l'impression. Comparer visuellement avec « Imprimer » de l'éditeur : doivent correspondre.

- [ ] **Step 7 : Commit**

```bash
git add "app/(print)/devis/[id]/imprimer/page.tsx"
git commit -m "feat(impression): parite WeboWord (page de garde, photos, logo, CGV) sur la route imprimer"
```

---

### Task D4 : Bouton « + ajouter une ligne de texte » sur la page de garde

**Files:**
- Modify: `components/devis/weboword/CoverPageBuilder.tsx`

**Interfaces:**
- Consumes: type `CoverPageLayoutElement` (`weboword.types.ts`), props `{ config, onChange }`.
- Produces: ajout d'éléments `type: 'text'` dans `config.customLayout`.

- [ ] **Step 1 : Lire l'état actuel du builder**

Ouvrir `CoverPageBuilder.tsx` et repérer la barre d'outils. Si un mécanisme d'ajout d'élément existe déjà, ajouter simplement un bouton « + ligne de texte » qui l'utilise. Sinon, ajouter le handler ci-dessous.

- [ ] **Step 2 : Ajouter un handler d'ajout de ligne de texte**

```tsx
const addTextLine = () => {
  const id = `txt-${config.customLayout.length}-${config.customLayout.reduce((m, e) => Math.max(m, 1), 1)}`;
  const el: CoverPageLayoutElement = {
    id,
    type: 'text',
    x: 100, y: 100 + config.customLayout.filter(e => e.type === 'text').length * 50,
    width: 594, height: 40,
    content: 'Nouvelle ligne de texte',
    fontSize: 24, color: '#1a1a1a', fontWeight: 'normal', textAlign: 'center',
  };
  onChange({ ...config, customLayout: [...config.customLayout, el] });
};
```

> `id` doit être unique sans `Math.random()` ni `Date.now()` n'est pas requis ici ; baser l'unicité sur la longueur + un suffixe stable suffit. Si le fichier utilise déjà un générateur d'id, le réutiliser.

- [ ] **Step 3 : Ajouter le bouton dans la barre d'outils du builder**

```tsx
<button onClick={addTextLine} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#9c27b0] border border-[#9c27b0]/30 rounded-lg hover:bg-[#f3e5f5] transition-colors">
  + Ligne de texte
</button>
```

- [ ] **Step 4 : (Si le mode template ne supporte pas les éléments libres)**

Si l'utilisateur est en `mode === 'template'`, le bouton doit d'abord basculer en builder OU les lignes additionnelles doivent être rendues par-dessus le template. Décision : exposer le bouton uniquement quand `config.mode === 'builder'`, et ajouter dans le sélecteur de page de garde une bascule claire vers le mode builder. Vérifier que `buildCoverPageHtml` rend bien `customLayout` (oui, en mode builder — cf. `printHelpers.ts`).

- [ ] **Step 5 : Vérifier lint + build**

Run: `npm run lint && npm run build`
Expected: aucune erreur.

- [ ] **Step 6 : Test manuel**

Éditeur WeboWord → panneau Page de garde → mode builder → « + Ligne de texte » : une ligne éditable apparaît, repositionnable ; elle est visible dans l'aperçu et dans le PDF (Task D3).

- [ ] **Step 7 : Commit**

```bash
git add components/devis/weboword/CoverPageBuilder.tsx
git commit -m "feat(weboword): ajouter une ligne de texte sur la page de garde (builder)"
```

---

## Self-Review (couverture spec)

- A1 (#7) → Task A1 ✓
- A2 (#3) → Task A2 ✓
- B1 (#1) → Task B1 ✓
- B2 (#2) → Task B2 ✓
- C1 (#4) → Task C1 ✓
- D1 (#9 logo) → Task D1 + D2b + D3 ✓
- D2 (#8 CGV) → Task D1 + D2b + D3 ✓
- D3 (#5 aperçu page de garde) → Task D3 ✓
- D4 (#6 ligne page de garde) → Task D4 ✓

Tous les points de la spec sont couverts. Cohérence des noms de helpers (`buildLogoHeaderHtml`, `buildCgvHtml`, `buildCoverPageHtml`, `buildPhotosPageHtml`) vérifiée entre D1, D2b et D3.

## Points à vérifier en cours d'implémentation (non bloquants)

- Confirmer en début de Lot D que `CoverPage.templates.ts` n'a pas de directive `'use client'` (sinon extraire les templates en module pur pour l'usage serveur dans la route imprimer).
- Confirmer la source de `user` dans `WeboWordEditor.tsx` (hook `useAuth` ou prop) avant d'ajouter le chargement profil.
- Confirmer le mécanisme d'ajout d'éléments existant dans `CoverPageBuilder.tsx` (Step 1 de D4) pour réutiliser le code en place plutôt que dupliquer.
