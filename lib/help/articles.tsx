import {
  Rocket, FileText, Users, CalendarRange, Boxes, Package, Settings,
  type LucideIcon,
} from 'lucide-react';

export type HelpCategoryId =
  | 'demarrer'
  | 'devis'
  | 'clients'
  | 'evenements'
  | 'stock'
  | 'catalogue'
  | 'compte';

export interface HelpCategory {
  id: HelpCategoryId;
  label: string;
  icon: LucideIcon;
  gradient: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'demarrer',   label: 'Démarrer',            icon: Rocket,        gradient: 'from-fuchsia-500 to-purple-600' },
  { id: 'devis',      label: 'Devis',               icon: FileText,      gradient: 'from-violet-500 to-indigo-600' },
  { id: 'clients',    label: 'Clients & Prospects', icon: Users,         gradient: 'from-blue-500 to-cyan-600' },
  { id: 'evenements', label: 'Événements',          icon: CalendarRange, gradient: 'from-emerald-500 to-teal-600' },
  { id: 'stock',      label: 'Stock & Ingrédients', icon: Boxes,         gradient: 'from-amber-500 to-orange-600' },
  { id: 'catalogue',  label: 'Catalogue',           icon: Package,       gradient: 'from-rose-500 to-pink-600' },
  { id: 'compte',     label: 'Compte & Paramètres', icon: Settings,      gradient: 'from-slate-500 to-gray-600' },
];

export interface HelpArticle {
  id: string;
  category: HelpCategoryId;
  title: string;
  description: string;
  keywords: string[];
  body: React.ReactNode;
}

// ── Visual building blocks ──────────────────────────────────────────────────
const Lead = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[15px] text-gray-700 leading-relaxed font-medium">{children}</p>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-gray-700 leading-relaxed">{children}</p>
);

const Section = ({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 mt-5 first:mt-0">
      <span className="text-base">{icon}</span>
      <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-800">{title}</h3>
      <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
    </div>
    <div className="space-y-3 pl-1">{children}</div>
  </div>
);

const Step = ({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) => (
  <div className="flex gap-3">
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#9c27b0] to-[#6a1b9a] text-white text-xs font-bold flex items-center justify-center shadow-sm">{n}</div>
    <div className="flex-1 pt-0.5">
      <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
      {children && <div className="text-sm text-gray-600 leading-relaxed space-y-1.5">{children}</div>}
    </div>
  </div>
);

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
    <span className="text-base flex-shrink-0">💡</span>
    <div className="text-xs text-amber-900 leading-relaxed flex-1">{children}</div>
  </div>
);

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
    <span className="text-base flex-shrink-0">ℹ️</span>
    <div className="text-xs text-blue-900 leading-relaxed flex-1">{children}</div>
  </div>
);

const Warning = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 p-3 bg-rose-50 border-l-4 border-rose-400 rounded-r-lg">
    <span className="text-base flex-shrink-0">⚠️</span>
    <div className="text-xs text-rose-900 leading-relaxed flex-1">{children}</div>
  </div>
);

const Code = ({ children }: { children: React.ReactNode }) => (
  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-[12px] font-mono">{children}</span>
);

const Btn = ({ children, color = 'purple' }: { children: React.ReactNode; color?: 'purple' | 'gray' | 'green' | 'red' }) => {
  const colors = {
    purple: 'bg-[#9c27b0] text-white',
    gray: 'bg-gray-100 text-gray-700 border border-gray-200',
    green: 'bg-emerald-500 text-white',
    red: 'bg-rose-500 text-white',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${colors[color]} mx-0.5 align-middle`}>
      {children}
    </span>
  );
};

const Path = ({ items }: { items: string[] }) => (
  <div className="flex items-center flex-wrap gap-1 p-2 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-lg">
    {items.map((it, i) => (
      <span key={i} className="flex items-center gap-1">
        {i > 0 && <span className="text-purple-300">→</span>}
        <span className="text-xs font-medium text-purple-800">{it}</span>
      </span>
    ))}
  </div>
);

const Mockup = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 bg-gray-50/50">
    {title && <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">{title}</p>}
    <div className="text-xs text-gray-600">{children}</div>
  </div>
);

const Bullets = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="text-sm text-gray-700 space-y-1.5 pl-5 list-disc marker:text-[#9c27b0]">
    {items.map((it, i) => <li key={i}>{it}</li>)}
  </ul>
);

const Stat = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <div className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-gray-200 rounded-lg">
    <span className="text-xl">{icon}</span>
    <span className="text-base font-bold text-gray-900">{value}</span>
    <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
  </div>
);

const StatusPill = ({ color, label }: { color: 'gray' | 'amber' | 'blue' | 'green' | 'red'; label: string }) => {
  const colors = {
    gray:  'bg-gray-100 text-gray-700 border-gray-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue:  'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red:   'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colors[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        color === 'gray'  ? 'bg-gray-400'    :
        color === 'amber' ? 'bg-amber-500'   :
        color === 'blue'  ? 'bg-blue-500'    :
        color === 'green' ? 'bg-emerald-500' :
                            'bg-rose-500'
      }`} />
      {label}
    </span>
  );
};

const FAQ = ({ q, children }: { q: string; children: React.ReactNode }) => (
  <details className="group border border-gray-200 rounded-lg overflow-hidden">
    <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 flex items-center justify-between">
      <span>{q}</span>
      <span className="text-[#9c27b0] text-xs group-open:rotate-90 transition-transform">▶</span>
    </summary>
    <div className="px-3 py-2.5 text-sm text-gray-600 border-t border-gray-100 bg-gray-50/50 space-y-2">
      {children}
    </div>
  </details>
);

// ── Articles ────────────────────────────────────────────────────────────────
export const HELP_ARTICLES: HelpArticle[] = [
  // ════════════════════════════════════════════════════════════════════════
  // DÉMARRER
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'tour-app',
    category: 'demarrer',
    title: 'Visite guidée de WeboDevis',
    description: 'Comprendre l\'organisation de l\'app en 5 minutes',
    keywords: ['début', 'sidebar', 'navigation', 'menu', 'tour', 'organisation'],
    body: (
      <div className="space-y-4">
        <Lead>WeboDevis est ton poste de pilotage métier : devis, clients, événements, stock et catalogue, dans une seule interface.</Lead>

        <Section icon="🗺️" title="Les 5 grandes sections">
          <P>La sidebar de gauche est structurée en sections logiques, du plus utilisé au plus rare :</P>
          <Bullets items={[
            <><strong>Commerce</strong> — ce qui rapporte de l'argent : tableau de bord, devis, clients, prospects.</>,
            <><strong>Production</strong> — ce qui se passe une fois qu'un devis est signé : calendrier, événements, commandes fournisseurs.</>,
            <><strong>Stock</strong> — niveau d'ingrédients en temps réel + alertes.</>,
            <><strong>Catalogue</strong> (déroulant) — ton inventaire : prestations, ingrédients, extras, location, fournisseurs.</>,
            <><strong>Paramètres</strong> (déroulant) — catégories, profil entreprise, modèles de devis.</>,
          ]} />
        </Section>

        <Section icon="🎯" title="Les 3 badges importants">
          <div className="grid grid-cols-3 gap-2">
            <Stat icon="📄" label="Devis envoyés" value="badge violet" />
            <Stat icon="👤" label="Prospects nouveaux" value="badge violet" />
            <Stat icon="📦" label="Stock bas" value="badge rouge" />
          </div>
          <P>Ces badges sur la sidebar te donnent en un clin d'œil ce qui demande ton attention.</P>
        </Section>

        <Section icon="⌨️" title="Raccourcis utiles">
          <Bullets items={[
            <>Bouton <Code>?</Code> en bas à droite : ouvre ce centre d'aide à tout moment, peut être déplacé/redimensionné, reste ouvert quand tu changes de page.</>,
            <>Bouton <Btn color="gray">Réduire</Btn> en bas de la sidebar : réduit la sidebar à 64px de large pour gagner de la place.</>,
            <>Notification 🔔 dans le header : centralise toutes les alertes (stock bas, prospects, etc.).</>,
          ]} />
        </Section>

        <Tip>Si tu débutes, commence par <strong>Compléter ton profil entreprise</strong> (Paramètres) puis <strong>Créer ta première prestation</strong> (Catalogue). Tu pourras ensuite faire ton premier devis en moins de 2 minutes.</Tip>
      </div>
    ),
  },
  {
    id: 'premier-devis',
    category: 'demarrer',
    title: 'Créer mon premier devis (parcours complet)',
    description: 'De zéro à un devis envoyé en moins de 5 minutes',
    keywords: ['premier', 'commencer', 'starter', 'tutoriel', 'guide'],
    body: (
      <div className="space-y-4">
        <Lead>Voici le chemin recommandé pour ton tout premier devis. Suis dans l'ordre, ça prend 5 min max.</Lead>

        <Section icon="📋" title="Pré-requis (5 min de setup, une seule fois)">
          <Step n={1} title="Compléter ton profil entreprise">
            <Path items={['Paramètres', 'Profil entreprise']} />
            <P>Renseigne au minimum : nom commercial, SIRET, adresse, téléphone et logo. Ces infos s'imprimeront en haut de tous tes devis.</P>
          </Step>
          <Step n={2} title="(Optionnel) Créer 2-3 prestations dans ton catalogue">
            <Path items={['Catalogue', 'Prestations', '+ Nouveau']} />
            <P>Si tu veux pouvoir piocher dedans, sinon tu peux toujours créer des lignes libres directement dans le devis.</P>
          </Step>
        </Section>

        <Section icon="✏️" title="Création du devis">
          <Step n={1} title="Crée ou choisis le client">
            <P>Soit depuis l'onglet <Code>Clients → + Nouveau</Code> avant, soit à la volée dans l'éditeur. Seul le nom est obligatoire.</P>
          </Step>
          <Step n={2} title="Démarre le devis">
            <Path items={['Devis', '+ Nouveau']} />
            <P>L'onboarding te demande : type d'événement (mariage, anniversaire...), date, lieu, nombre de couverts (adultes + enfants).</P>
          </Step>
          <Step n={3} title="Ajoute tes prestations">
            <P>Dans l'éditeur, panneau <strong>Prestations</strong> de la sidebar gauche. Clique <Btn>+ Prestation</Btn> :</P>
            <Bullets items={[
              <><strong>Depuis le catalogue</strong> — autocomplete sur ton nom de prestation.</>,
              <><strong>Ligne libre</strong> — pour une prestation unique non répertoriée.</>,
            ]} />
            <P>Quantité × prix unitaire HT = sous-total. La TVA et le total TTC se calculent en bas, en temps réel.</P>
          </Step>
          <Step n={4} title="(Optionnel) Personnalise le visuel">
            <P>Panneau <strong>Style</strong> : police, taille, couleurs. Panneau <strong>Images</strong> : photos d'ambiance ou de plats. Panneau <strong>Événement</strong> : ajuste les détails de l'événement.</P>
          </Step>
          <Step n={5} title="Envoie au client">
            <P>Clique sur <Btn color="green">Envoyer</Btn> en haut à droite. Tu obtiens :</P>
            <Bullets items={[
              <>Un <strong>lien sécurisé</strong> à transmettre par email/SMS — le client voit le devis dans son navigateur, peut accepter/refuser/poser une question.</>,
              <>Un <strong>PDF téléchargeable</strong> à joindre manuellement à un mail.</>,
            ]} />
          </Step>
        </Section>

        <Note>Le devis est sauvegardé automatiquement à chaque modification — tu ne perds jamais ton travail, même si tu fermes l'onglet.</Note>

        <Section icon="🎯" title="Et après ?">
          <Bullets items={[
            <>Le devis apparaît dans <Code>Devis</Code> avec le statut <StatusPill color="amber" label="Envoyé" />.</>,
            <>Quand le client accepte, passe-le en <StatusPill color="green" label="Accepté" /> — il devient automatiquement un événement, visible dans le calendrier.</>,
            <>Tu peux dupliquer ce devis pour un autre client similaire (icône <Code>⋯</Code> sur la carte du devis).</>,
          ]} />
        </Section>

        <Tip>Pour gagner encore plus de temps, sauvegarde ton devis comme <strong>modèle</strong> (option dans le menu <Code>⋯</Code>). Tu pourras réutiliser sa structure en un clic.</Tip>
      </div>
    ),
  },
  {
    id: 'sidebar-personnaliser',
    category: 'demarrer',
    title: 'Personnaliser ma sidebar',
    description: 'Réduire, déplier les groupes, comprendre les badges',
    keywords: ['barre', 'menu', 'collapse', 'badges'],
    body: (
      <div className="space-y-4">
        <Lead>La sidebar s'adapte à ton usage : tu peux la rétrécir et plier les sections rarement utilisées.</Lead>

        <Section icon="📐" title="Réduire la sidebar">
          <P>Bouton <Btn color="gray">Réduire</Btn> tout en bas. La sidebar passe de 240px à 64px : seules les icônes restent. Survole une icône pour voir le label.</P>
          <P>Idéal sur les écrans étroits ou quand tu as une grosse table de devis ouverte.</P>
        </Section>

        <Section icon="📁" title="Sections dépliables">
          <P>Deux sections sont des dropdowns :</P>
          <Bullets items={[
            <><strong>Catalogue</strong> — prestations, ingrédients, extras, location, fournisseurs (utilisé surtout pour la maintenance du catalogue).</>,
            <><strong>Paramètres</strong> — catégories, profil, modèles, espace admin (si applicable).</>,
          ]} />
          <P>Clique sur le titre d'une section pour la déplier/replier. Si tu navigues sur une page interne (ex : <Code>/prestations</Code>), la section s'ouvre automatiquement.</P>
        </Section>

        <Section icon="🔔" title="Comprendre les badges">
          <Bullets items={[
            <><Btn>2</Btn> sur <strong>Devis</strong> : nombre de devis avec statut <StatusPill color="amber" label="Envoyé" /> en attente de réponse.</>,
            <><Btn>9+</Btn> sur <strong>Prospects</strong> : prospects au statut <StatusPill color="blue" label="Nouveau" /> non encore traités.</>,
            <><Btn color="red">3</Btn> sur <strong>Stock</strong> : ingrédients sous le seuil d'alerte.</>,
            <>Point rouge sur <strong>Calendrier</strong> : un événement est prévu aujourd'hui.</>,
          ]} />
        </Section>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // DEVIS
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'creer-devis',
    category: 'devis',
    title: 'Créer un devis (toutes les options)',
    description: 'Anatomie de l\'éditeur de devis et de ses 5 panneaux',
    keywords: ['nouveau devis', 'créer', 'ajouter', 'éditeur'],
    body: (
      <div className="space-y-4">
        <Lead>L'éditeur de devis est divisé en 5 panneaux, accessibles depuis la sidebar gauche (mode WeboWord).</Lead>

        <Section icon="🚀" title="Démarrer un devis">
          <Path items={['Devis', '+ Nouveau']} />
          <P>Onboarding rapide en 4 étapes : type d'événement (mariage, anniversaire, baptême, séminaire, autre), date, lieu, nombre de couverts (adultes + enfants).</P>
          <Note>Tu peux passer toutes les étapes à blanc et les renseigner plus tard depuis le panneau "Événement".</Note>
        </Section>

        <Section icon="🧭" title="Les 5 panneaux">
          <Step n={1} title="Client 👤">
            <P>Sélectionne dans la liste de tes clients existants ou crée-en un à la volée. Champs : nom, email, téléphone, adresse complète.</P>
          </Step>
          <Step n={2} title="Prestations 📦">
            <P>Le cœur du devis. Ajoute des lignes via :</P>
            <Bullets items={[
              <>Autocomplete sur ton catalogue (avec icône ⭐ pour tes prestas perso).</>,
              <>Création de ligne libre.</>,
              <>Saut de page <Code>Shift + Entrée</Code> pour structurer un long menu sur plusieurs pages PDF.</>,
            ]} />
          </Step>
          <Step n={3} title="Événement 📅">
            <P>Type, date, heure, lieu, couverts (adultes + enfants). Ces infos remontent dans le calendrier et dans la fiche événement.</P>
          </Step>
          <Step n={4} title="Style 🎨">
            <P>Police (parmi 12 polices type traiteur), taille du texte, couleurs d'accent, masquer les prix individuels (mode "menu sans prix").</P>
          </Step>
          <Step n={5} title="Images 🖼️">
            <P>Photos d'ambiance, portrait, plats — uploadées et insérées dans le PDF aux endroits prévus du template.</P>
          </Step>
        </Section>

        <Section icon="💾" title="Sauvegarde & sortie">
          <Bullets items={[
            <><strong>Auto-save</strong> à chaque modification — pas besoin de cliquer "Enregistrer".</>,
            <><Btn>Enregistrer</Btn> dans la barre d'actions (sidebar gauche, en bas) — force une sauvegarde immédiate.</>,
            <><Btn color="gray">Enregistrer PDF</Btn> — génère et télécharge le PDF.</>,
            <><Btn color="gray">Imprimer</Btn> — ouvre l'aperçu d'impression du navigateur.</>,
            <><Btn color="green">Envoyer</Btn> — produit le lien sécurisé pour le client.</>,
          ]} />
        </Section>

        <Tip>Tu peux à tout moment revenir à la liste des devis via "Retour aux devis" en haut de la sidebar gauche — ton devis est déjà sauvegardé.</Tip>
      </div>
    ),
  },
  {
    id: 'dupliquer-devis',
    category: 'devis',
    title: 'Dupliquer un devis ou créer un modèle',
    description: 'Repartir d\'un existant pour gagner du temps',
    keywords: ['copier', 'duplication', 'cloner', 'modèle', 'template'],
    body: (
      <div className="space-y-4">
        <Lead>Plutôt que de tout refaire à la main, dupliquer ou modéliser un devis existant fait gagner ~80% du temps sur des devis similaires.</Lead>

        <Section icon="📋" title="Dupliquer un devis (one-shot)">
          <P>Sur la liste des devis :</P>
          <Step n={1} title="Trouve le devis source">Vue Grille, Tableau ou Pipeline.</Step>
          <Step n={2} title="Ouvre le menu actions">Icône <Code>⋯</Code> en haut à droite de la carte.</Step>
          <Step n={3} title="Clique « Dupliquer »">
            <P>Une copie est créée immédiatement avec :</P>
            <Bullets items={[
              <>Toutes les prestations, prix, remarques, style et images.</>,
              <>Le statut <StatusPill color="gray" label="Brouillon" />.</>,
              <>Le client <strong>vide</strong> (à toi de l'assigner).</>,
              <>Une date d'événement à <strong>aujourd'hui</strong> (à modifier).</>,
            ]} />
          </Step>
        </Section>

        <Section icon="📚" title="Créer un modèle réutilisable">
          <P>Si tu vends souvent la même structure (ex : "Mariage 100 couverts standard"), modélise-la une bonne fois :</P>
          <Step n={1} title="Ouvre le menu d'un devis abouti">Icône <Code>⋯</Code> sur la carte.</Step>
          <Step n={2} title="Choisis « Sauvegarder comme modèle »">Donne-lui un nom parlant (ex : <Code>Mariage 100p Premium</Code>).</Step>
          <Step n={3} title="Réutilise-le">
            <P>Sur la page Devis, clique le bandeau <Code>Mes modèles (3)</Code>. Choisis le modèle → un nouveau devis est créé avec sa structure complète.</P>
          </Step>
        </Section>

        <Section icon="⚖️" title="Dupliquer vs Modèle — lequel choisir ?">
          <Mockup>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-bold text-gray-900 mb-1">📋 Dupliquer</p>
                <p>Pour un client similaire, événement <strong>unique</strong>. Action ponctuelle.</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-1">📚 Modèle</p>
                <p>Pour un type de devis que tu vendras <strong>souvent</strong>. Investissement initial.</p>
              </div>
            </div>
          </Mockup>
        </Section>
      </div>
    ),
  },
  {
    id: 'pipeline-statuts',
    category: 'devis',
    title: 'Statuts, pipeline et drag-and-drop',
    description: 'Suivre l\'avancement de tes devis comme un CRM',
    keywords: ['kanban', 'statut', 'workflow', 'crm', 'avancement'],
    body: (
      <div className="space-y-4">
        <Lead>Chaque devis a un statut qui reflète où il en est dans ton cycle de vente. La vue Pipeline transforme tes devis en kanban draggable.</Lead>

        <Section icon="🎯" title="Les 5 statuts">
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
              <StatusPill color="gray" label="Brouillon" />
              <p className="text-xs text-gray-600 flex-1">Devis en cours de rédaction, pas encore envoyé. C'est le statut par défaut.</p>
            </div>
            <div className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
              <StatusPill color="amber" label="En attente" />
              <p className="text-xs text-gray-600 flex-1">Tu attends une info ou une décision interne avant d'envoyer.</p>
            </div>
            <div className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
              <StatusPill color="blue" label="Envoyé" />
              <p className="text-xs text-gray-600 flex-1">Devis transmis au client, en attente de sa réponse. Compté dans le badge sidebar.</p>
            </div>
            <div className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
              <StatusPill color="green" label="Accepté" />
              <p className="text-xs text-gray-600 flex-1">Le client a dit oui. Le devis devient un événement automatiquement (visible dans le calendrier).</p>
            </div>
            <div className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
              <StatusPill color="red" label="Refusé" />
              <p className="text-xs text-gray-600 flex-1">Tu peux préciser : <strong>refus client</strong> (le client a dit non) ou <strong>refus traiteur</strong> (toi qui as décliné).</p>
            </div>
          </div>
        </Section>

        <Section icon="📊" title="Vue Pipeline (kanban)">
          <P>En haut de la liste des devis, bouton <Btn color="gray">Pipeline</Btn>. Tu obtiens 5 colonnes (1 par statut) avec les devis sous forme de cartes.</P>
          <Bullets items={[
            <><strong>Drag & drop</strong> : glisse une carte d'une colonne à l'autre pour changer son statut instantanément.</>,
            <><strong>Compteurs</strong> en haut de chaque colonne : nombre de devis + total TTC cumulé.</>,
            <><strong>Onglet "Refusé"</strong> en haut filtre uniquement les refus pour analyse rétrospective.</>,
          ]} />
        </Section>

        <Section icon="🔄" title="Changer un statut sans drag">
          <P>Sur la fiche d'un devis (Sheet sur le côté), section <strong>Statut</strong> : sélecteur direct avec les 5 options. Idéal sur mobile où le drag est moins pratique.</P>
        </Section>

        <Note>Les devis <strong>Refusés</strong> (refus client + refus traiteur) sont <strong>masqués du calendrier</strong> automatiquement, pour ne pas polluer ta vue de production.</Note>
      </div>
    ),
  },
  {
    id: 'envoyer-devis',
    category: 'devis',
    title: 'Envoyer un devis au client',
    description: 'Lien sécurisé, PDF, signature électronique',
    keywords: ['envoi', 'mail', 'partager', 'lien', 'signature'],
    body: (
      <div className="space-y-4">
        <Lead>WeboDevis te donne deux options d'envoi, à utiliser selon ton process.</Lead>

        <Section icon="🔗" title="Option 1 : Lien sécurisé (recommandé)">
          <P>Bouton <Btn color="green">Envoyer</Btn> dans l'éditeur → le système génère un lien unique et chiffré du type <Code>/c/abc123xyz</Code>.</P>
          <P>Quand le client clique :</P>
          <Bullets items={[
            <>Il visualise le devis directement dans son navigateur (sans télécharger).</>,
            <>Il peut <strong>accepter</strong> ou <strong>refuser</strong> en un clic.</>,
            <>Il peut laisser une <strong>question</strong> ou un message.</>,
            <>Le statut du devis se met à jour automatiquement de ton côté.</>,
          ]} />
          <Tip>Le lien expire si tu changes le devis après envoi → renvoie un nouveau lien dans ce cas.</Tip>
        </Section>

        <Section icon="📄" title="Option 2 : PDF manuel">
          <P>Bouton <Btn color="gray">Enregistrer PDF</Btn> dans la barre d'actions → fichier téléchargé sur ton ordinateur.</P>
          <P>À toi de l'envoyer par mail manuellement, l'imprimer, ou le partager autrement.</P>
          <Note>Avec cette option, le statut ne se met pas à jour automatiquement — tu dois le passer en "Envoyé" à la main.</Note>
        </Section>

        <Section icon="🖨️" title="Imprimer">
          <P>Bouton <Btn color="gray">Imprimer</Btn> → ouvre l'aperçu d'impression du navigateur. Idéal pour un rendez-vous physique avec le client.</P>
        </Section>
      </div>
    ),
  },
  {
    id: 'modifier-apres-envoi',
    category: 'devis',
    title: 'Modifier un devis après envoi',
    description: 'Comment gérer les changements de dernière minute',
    keywords: ['modifier', 'changer', 'révision', 'ajustement'],
    body: (
      <div className="space-y-4">
        <Lead>Le client veut ajouter 10 couverts, changer une prestation, négocier un prix ? Pas de souci, le devis reste éditable même après envoi.</Lead>

        <Section icon="✏️" title="Comment modifier">
          <Step n={1} title="Ouvre le devis">Page Devis → clique sur le devis → Sheet s'ouvre → bouton <Btn color="gray">Modifier</Btn>.</Step>
          <Step n={2} title="Fais tes changements">L'éditeur s'ouvre, tout est modifiable.</Step>
          <Step n={3} title="Renvoie au client">Bouton <Btn color="green">Envoyer</Btn> → un nouveau lien est généré (l'ancien est invalidé).</Step>
        </Section>

        <Warning>Si le client a déjà accepté le devis (statut <StatusPill color="green" label="Accepté" />), une modification fait perdre la trace de ce qu'il a vu/signé. Préfère créer un <strong>avenant</strong> (nouveau devis avec mention "avenant").</Warning>

        <Section icon="🔁" title="Avenants (bonne pratique)">
          <P>Pour un changement après acceptation officielle :</P>
          <Step n={1} title="Duplique le devis original">Menu <Code>⋯ → Dupliquer</Code>.</Step>
          <Step n={2} title="Renomme-le « [Nom client] - Avenant 1 »">Pour la traçabilité.</Step>
          <Step n={3} title="Applique les modifications et envoie">Le client a alors les 2 documents : original + avenant.</Step>
        </Section>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // CLIENTS & PROSPECTS
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'creer-client',
    category: 'clients',
    title: 'Créer et gérer mes clients',
    description: 'Fiche client, historique, recherche',
    keywords: ['contact', 'fiche', 'ajouter client', 'carnet adresse'],
    body: (
      <div className="space-y-4">
        <Lead>Le carnet client centralise toutes les personnes pour qui tu as déjà fait un devis ou un événement.</Lead>

        <Section icon="➕" title="Créer un client">
          <P>Deux moyens :</P>
          <Bullets items={[
            <><strong>Avant le devis</strong> : <Path items={['Clients', '+ Nouveau']} /></>,
            <><strong>Pendant le devis</strong> : panneau "Client" → bouton <Code>+ Nouveau client</Code>.</>,
          ]} />
          <P>Champs disponibles : nom (obligatoire), email, téléphone, adresse complète, note interne. Tu peux laisser vide ce que tu n'as pas — la fiche se complète au fil du temps.</P>
        </Section>

        <Section icon="🔍" title="Retrouver un client">
          <P>Page Clients :</P>
          <Bullets items={[
            <>Barre de recherche en haut — cherche par nom, email, téléphone.</>,
            <>Tri par date de création (plus récent en premier par défaut).</>,
            <>Clique sur une ligne → sheet latérale avec tout l'historique de ses devis.</>,
          ]} />
        </Section>

        <Section icon="📜" title="Historique d'un client">
          <P>Sur la fiche client, tu vois :</P>
          <Bullets items={[
            <>Tous ses devis passés (avec statut et montant).</>,
            <>Total cumulé du chiffre d'affaires.</>,
            <>Notes internes que tu as prises sur lui.</>,
          ]} />
          <P>Bouton <Btn>+ Nouveau devis</Btn> directement depuis sa fiche pour aller plus vite.</P>
        </Section>

        <Tip>Renseigne l'adresse complète : elle est automatiquement utilisée pour ouvrir Google Maps depuis la fiche événement le jour J.</Tip>
      </div>
    ),
  },
  {
    id: 'prospects',
    category: 'clients',
    title: 'Gérer mes prospects entrants',
    description: 'Demandes de devis automatiques via formulaire public',
    keywords: ['lead', 'demande', 'formulaire', 'inbound', 'prospect'],
    body: (
      <div className="space-y-4">
        <Lead>Les prospects sont des personnes qui ont rempli ton formulaire public. Toutes leurs demandes atterrissent dans <Code>/prospects</Code> — à toi de les qualifier et de les transformer en clients.</Lead>

        <Section icon="📨" title="D'où viennent les prospects ?">
          <P>Tu as un <strong>formulaire public</strong> avec un lien unique. Tu peux :</P>
          <Bullets items={[
            <>Le partager directement (Insta bio, signature mail).</>,
            <>L'embarquer sur ton site web via une iframe.</>,
            <>Le coller dans un QR code pour tes flyers.</>,
          ]} />
        </Section>

        <Section icon="🏷️" title="Les 6 statuts prospect">
          <div className="space-y-2">
            <div className="flex items-center gap-3"><StatusPill color="blue" label="Nouveau" /><span className="text-xs text-gray-600">Vient d'arriver, jamais traité.</span></div>
            <div className="flex items-center gap-3"><StatusPill color="amber" label="RDV dégustation à venir" /><span className="text-xs text-gray-600">Tu as planifié une dégustation.</span></div>
            <div className="flex items-center gap-3"><StatusPill color="amber" label="Brochure envoyée" /><span className="text-xs text-gray-600">Premier envoi de doc commerciale.</span></div>
            <div className="flex items-center gap-3"><StatusPill color="green" label="Devis envoyé" /><span className="text-xs text-gray-600">Tu as transformé en devis.</span></div>
            <div className="flex items-center gap-3"><StatusPill color="red" label="Refus client" /><span className="text-xs text-gray-600">Le client n'a pas donné suite.</span></div>
            <div className="flex items-center gap-3"><StatusPill color="red" label="Refus traiteur" /><span className="text-xs text-gray-600">Toi qui as décliné (date prise, hors zone, etc.).</span></div>
          </div>
        </Section>

        <Section icon="🔄" title="Workflow type">
          <Step n={1} title="Le prospect arrive">Statut <StatusPill color="blue" label="Nouveau" />, badge sidebar +1.</Step>
          <Step n={2} title="Tu le contactes">Passe en <StatusPill color="amber" label="Brochure envoyée" /> ou <StatusPill color="amber" label="RDV dégustation" />.</Step>
          <Step n={3} title="Tu fais un devis">Bouton <Btn>Créer un devis depuis ce prospect</Btn> → toutes les infos sont pré-remplies.</Step>
          <Step n={4} title="Suivi long terme">Si pas de retour après X semaines, passe en <StatusPill color="red" label="Refus client" /> pour nettoyer ta liste.</Step>
        </Section>

        <Tip>Le badge <Btn>9+</Btn> sur "Prospects" dans la sidebar compte uniquement les <StatusPill color="blue" label="Nouveau" /> — c'est ta to-do du jour.</Tip>
      </div>
    ),
  },
  {
    id: 'masquer-refus',
    category: 'clients',
    title: 'Masquer les refus de la vue principale',
    description: 'Garder l\'écran propre tout en conservant l\'historique',
    keywords: ['filtrer', 'cacher', 'archive', 'refus'],
    body: (
      <div className="space-y-4">
        <Lead>Les refus restent en base (pour ton archive) mais sont masqués des vues actives par défaut.</Lead>

        <Section icon="📑" title="Devis refusés">
          <P>Sur la page Devis, par défaut, l'onglet "Tous" exclut les refus. Pour les voir, clique sur l'onglet <Btn color="gray">Refusé</Btn>.</P>
        </Section>

        <Section icon="📅" title="Calendrier">
          <P>Les événements de devis refusés <strong>n'apparaissent jamais</strong> dans le calendrier — peu importe le filtre. C'est volontaire pour ne pas surcharger.</P>
        </Section>

        <Section icon="👥" title="Prospects refusés">
          <P>Les prospects en <StatusPill color="red" label="Refus client" /> ou <StatusPill color="red" label="Refus traiteur" /> sont visibles via le filtre dédié en haut de la liste.</P>
        </Section>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // ÉVÉNEMENTS
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'evenement-fiche',
    category: 'evenements',
    title: 'Anatomie de la fiche événement',
    description: 'Tout ce qu\'on peut faire après acceptation d\'un devis',
    keywords: ['fiche', 'préparation', 'event', 'production'],
    body: (
      <div className="space-y-4">
        <Lead>Quand un devis passe en <StatusPill color="green" label="Accepté" />, il devient un événement à part entière, avec sa propre fiche de production.</Lead>

        <Section icon="📋" title="Les 4 zones de la fiche événement">
          <Step n={1} title="En-tête">
            <P>Client, date, lieu (avec lien Google Maps cliquable), nombre de couverts, total TTC. Boutons <Btn color="gray">Voir le devis</Btn> et <Btn>Finance</Btn>.</P>
          </Step>
          <Step n={2} title="Liste de courses 🛒">
            <P>Calculée automatiquement depuis les ingrédients liés à chaque prestation × le nombre de couverts. Cochable au fur et à mesure des achats. Voir l'article dédié.</P>
          </Step>
          <Step n={3} title="Sheet financier 💰">
            <P>Coûts <strong>prévisionnels</strong> (depuis le devis) vs <strong>réels</strong> (saisis par toi après l'événement). Marge brute en temps réel. Voir l'article dédié.</P>
          </Step>
          <Step n={4} title="Notes & checklist">
            <P>Espace libre pour noter ce qui n'est pas dans le devis : remarques jour J, contacts utiles, plan de table, etc.</P>
          </Step>
        </Section>

        <Section icon="🗓️" title="Vue Calendrier">
          <P>Les événements apparaissent automatiquement dans <Code>/calendrier</Code> à leur date :</P>
          <Bullets items={[
            <><strong>Pastille violette pleine</strong> = accepté/confirmé.</>,
            <><strong>Contour violet</strong> = en attente / brouillon (devient une opportunité à confirmer).</>,
            <><strong>Cellule rouge</strong> = capacité dépassée (300+ couverts cumulés sur la journée).</>,
          ]} />
        </Section>
      </div>
    ),
  },
  {
    id: 'liste-courses',
    category: 'evenements',
    title: 'Liste de courses automatique',
    description: 'Générer la liste d\'achats depuis les prestations',
    keywords: ['ingrédients', 'achat', 'recette', 'production'],
    body: (
      <div className="space-y-4">
        <Lead>WeboDevis calcule automatiquement la liste de courses d'un événement à partir des ingrédients liés à chaque prestation.</Lead>

        <Section icon="⚙️" title="Comment ça fonctionne">
          <Step n={1} title="Tu lies des ingrédients à tes prestations">
            <P>Dans la fiche d'une prestation, section "Ingrédients" : ajoute chaque ingrédient avec sa quantité <strong>par couvert</strong>.</P>
            <Mockup title="Exemple — prestation « Entrée saumon »">
              <Bullets items={[
                <>Saumon fumé : 80g / couvert</>,
                <>Aneth frais : 2g / couvert</>,
                <>Citron : 0.1 unité / couvert</>,
              ]} />
            </Mockup>
          </Step>
          <Step n={2} title="L'événement multiplie">
            <P>Pour un événement de 100 couverts avec cette prestation : saumon 8kg, aneth 200g, citron 10 unités. Tout est cumulé si plusieurs prestations utilisent le même ingrédient.</P>
          </Step>
          <Step n={3} title="Tu coches au fur et à mesure">
            <P>Sur la page Courses de l'événement, coche les lignes pour suivre tes achats. État sauvegardé.</P>
          </Step>
        </Section>

        <Section icon="🛒" title="Courses globales (multi-événements)">
          <P>Page <Path items={['Catalogue', 'Courses globales']} /> : agrège les ingrédients nécessaires pour <strong>tous les événements à venir</strong> dans une plage de dates.</P>
          <P>Pratique pour faire <strong>une seule grosse commande hebdomadaire</strong> couvrant tous les événements de la semaine.</P>
        </Section>

        <Tip>Renseigne le <strong>fournisseur préféré</strong> de chaque ingrédient → la liste de courses peut être groupée par fournisseur, prête à être convertie en commande.</Tip>
      </div>
    ),
  },
  {
    id: 'finance-event',
    category: 'evenements',
    title: 'Sheet financier d\'un événement',
    description: 'Comparer prévisionnel vs réel pour calculer ta marge',
    keywords: ['marge', 'coût', 'finance', 'rentabilité', 'compta'],
    body: (
      <div className="space-y-4">
        <Lead>Le sheet financier te montre, en un coup d'œil, si l'événement a été rentable.</Lead>

        <Section icon="📊" title="Structure du sheet">
          <Step n={1} title="Colonne Prévisionnel">
            <P>Calculée automatiquement depuis le devis : prix de vente HT/TTC, coûts d'ingrédients estimés (depuis ton catalogue), marge théorique.</P>
          </Step>
          <Step n={2} title="Colonne Réel">
            <P>À toi de saisir après l'événement : coûts réels d'ingrédients, frais de personnel, location de matériel, transport, etc.</P>
          </Step>
          <Step n={3} title="Calcul automatique">
            <P>Marge brute = Vente HT − Coûts réels. Marge en € et en %. Comparaison vs prévisionnel.</P>
          </Step>
        </Section>

        <Section icon="🎯" title="Quand le remplir ?">
          <P>Idéalement dans les 7 jours après l'événement, pendant que les chiffres sont frais. Tu peux y revenir autant que tu veux.</P>
        </Section>

        <Section icon="📈" title="Utilité business">
          <Bullets items={[
            <>Identifier les types d'événements les plus rentables.</>,
            <>Repérer les prestations sous-tarifées.</>,
            <>Argumenter une hausse de prix avec des chiffres.</>,
            <>Calculer ton CA effectif pour la compta.</>,
          ]} />
        </Section>
      </div>
    ),
  },
  {
    id: 'calendrier-lecture',
    category: 'evenements',
    title: 'Lire et utiliser le calendrier',
    description: 'Couleurs, capacité, filtres, navigation',
    keywords: ['agenda', 'planning', 'mois', 'capacité'],
    body: (
      <div className="space-y-4">
        <Lead>Le calendrier est ta vue mensuelle de production : qui mange où, combien sont-ils, et est-ce que tu n'es pas en surchauffe.</Lead>

        <Section icon="🎨" title="Code couleurs des événements">
          <Bullets items={[
            <><strong>Violet plein</strong> — événement accepté, confirmé.</>,
            <><strong>Contour violet</strong> — brouillon, en attente, ou envoyé (opportunité non confirmée).</>,
            <><strong>Cellule en surbrillance rouge</strong> — capacité dépassée (300+ couverts cumulés sur la journée), avec icône ⚠️.</>,
          ]} />
        </Section>

        <Section icon="🔍" title="Filtres & navigation">
          <Bullets items={[
            <>Flèches <Code>‹</Code> <Code>›</Code> pour changer de mois.</>,
            <>Bouton <Btn color="gray">Aujourd'hui</Btn> pour revenir au mois courant.</>,
            <>Toggle <Btn color="gray">Validés uniquement</Btn> pour masquer les non-confirmés.</>,
            <>Stats en haut : nombre de confirmés, nombre en attente, total couverts du mois.</>,
          ]} />
        </Section>

        <Section icon="👆" title="Cliquer sur un événement">
          <P>Une sheet latérale s'ouvre avec : statut, couverts, date complète, adresse (avec lien Maps), prestations à préparer, total TTC, et boutons <Btn>Gérer l'événement</Btn> / <Btn color="gray">Accéder au devis</Btn>.</P>
        </Section>

        <Note>Les devis refusés (refus client / refus traiteur) sont automatiquement masqués du calendrier, peu importe le filtre actif.</Note>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // STOCK & INGRÉDIENTS
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'gerer-ingredients',
    category: 'stock',
    title: 'Créer et gérer mes ingrédients',
    description: 'Anatomie d\'une fiche ingrédient',
    keywords: ['inventaire', 'fiche', 'matière première'],
    body: (
      <div className="space-y-4">
        <Lead>Chaque ingrédient a sa fiche avec unité, prix, fournisseur, stock et seuil d'alerte.</Lead>

        <Section icon="➕" title="Créer un ingrédient">
          <Path items={['Catalogue', 'Ingrédients', '+ Nouveau']} />
          <P>Champs principaux :</P>
          <Bullets items={[
            <><strong>Nom</strong> (obligatoire) — ex : "Saumon fumé", "Champagne brut".</>,
            <><strong>Unité</strong> — kg, g, L, mL, unité, botte... Choisis ce qui correspond à comment tu l'achètes.</>,
            <><strong>Prix unitaire HT</strong> — pour le calcul des coûts dans le sheet financier.</>,
            <><strong>Fournisseur préféré</strong> — pour grouper les commandes.</>,
            <><strong>Stock actuel</strong> — quantité en réserve à ce jour.</>,
            <><strong>Seuil d'alerte</strong> — quand passer en alerte.</>,
          ]} />
        </Section>

        <Section icon="🔁" title="Catégories d'ingrédients">
          <P>Les ingrédients peuvent être classés par catégorie (ex : "Viandes", "Boissons", "Légumes") pour filtrer la liste.</P>
        </Section>

        <Tip>Crée d'abord les <strong>30-40 ingrédients principaux</strong> que tu utilises souvent. Tu pourras compléter ponctuellement quand tu créeras d'autres prestations.</Tip>
      </div>
    ),
  },
  {
    id: 'gerer-stock',
    category: 'stock',
    title: 'Mouvements de stock',
    description: 'Entrée, sortie, ajustement — comment et quand',
    keywords: ['mouvement', 'entrée', 'sortie', 'inventaire', 'achat'],
    body: (
      <div className="space-y-4">
        <Lead>Le stock se met à jour via des <strong>mouvements</strong>. C'est un journal qui garde trace de tout.</Lead>

        <Section icon="🔄" title="Les 3 types de mouvement">
          <div className="space-y-2">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="font-bold text-emerald-900 text-sm">⬆️ Entrée</p>
              <p className="text-xs text-emerald-800 mt-1">Tu reçois une livraison fournisseur. Augmente le stock. Saisis quantité + prix d'achat (optionnel).</p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="font-bold text-amber-900 text-sm">⬇️ Sortie</p>
              <p className="text-xs text-amber-800 mt-1">Tu consommes pour un événement, tu casses, tu jettes. Diminue le stock. Précise la raison (événement X, perte, etc.).</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-bold text-blue-900 text-sm">🔧 Ajustement</p>
              <p className="text-xs text-blue-800 mt-1">Inventaire physique : tu comptes, ça ne correspond pas. Force la valeur exacte. Le système enregistre la différence.</p>
            </div>
          </div>
        </Section>

        <Section icon="📝" title="Comment saisir un mouvement">
          <Step n={1} title="Va sur la page Stock">
            <Path items={['Stock']} />
          </Step>
          <Step n={2} title="Sur la ligne d'un ingrédient, clique « + Mouvement »">Modal qui s'ouvre.</Step>
          <Step n={3} title="Choisis le type, saisis la quantité">+ note libre si tu veux.</Step>
          <Step n={4} title="Valide">Le stock se met à jour immédiatement, et l'historique garde la trace.</Step>
        </Section>

        <Section icon="📜" title="Historique des mouvements">
          <P>Sur la fiche d'un ingrédient, onglet "Mouvements" : journal complet daté avec quantité, type et note.</P>
          <P>Utile pour auditer les pertes ou retrouver une livraison.</P>
        </Section>
      </div>
    ),
  },
  {
    id: 'alertes-stock',
    category: 'stock',
    title: 'Alertes stock bas (seuil + notifications)',
    description: 'Ne plus jamais être en rupture',
    keywords: ['notification', 'badge', 'seuil', 'alerte', 'rupture'],
    body: (
      <div className="space-y-4">
        <Lead>Le système surveille en continu tes niveaux de stock et te prévient avant la rupture.</Lead>

        <Section icon="🎯" title="Définir un seuil">
          <P>Sur la fiche d'un ingrédient, champ <strong>Seuil d'alerte</strong> : quantité en-dessous de laquelle tu veux être prévenu.</P>
          <Mockup title="Exemple — Saumon fumé">
            <Bullets items={[
              <>Stock actuel : 12 kg.</>,
              <>Seuil d'alerte : 5 kg.</>,
              <>Tant que stock {'>'} 5 → OK.</>,
              <>Dès que stock ≤ 5 → alerte automatique.</>,
            ]} />
          </Mockup>
        </Section>

        <Section icon="🔔" title="Comment l'alerte se déclenche">
          <P>Automatique à chaque <strong>mouvement de sortie</strong> qui fait passer le stock sous le seuil :</P>
          <Bullets items={[
            <><strong>Notification</strong> créée dans <Code>/notifications</Code>.</>,
            <><strong>Badge rouge</strong> sur l'item Stock dans la sidebar (= nombre d'ingrédients en alerte).</>,
            <>Pas de doublon : si une alerte non lue existe déjà, pas de re-création.</>,
          ]} />
        </Section>

        <Section icon="✅" title="Acquitter une alerte">
          <P>Page Notifications → marque comme lue (icône ✓). Le badge baisse. La notification reste dans l'historique.</P>
        </Section>

        <Tip>Définis tes seuils en pensant à ton <strong>délai de réappro fournisseur</strong>. Si ton fournisseur livre sous 48h, ton seuil doit couvrir au moins 48h de consommation.</Tip>
      </div>
    ),
  },
  {
    id: 'commandes-fournisseurs',
    category: 'stock',
    title: 'Générer une commande fournisseur',
    description: 'À partir d\'un événement ou en mode global',
    keywords: ['achat', 'commande', 'fournisseur', 'order'],
    body: (
      <div className="space-y-4">
        <Lead>WeboDevis peut générer des bons de commande groupés par fournisseur, à partir de la liste de courses d'un événement.</Lead>

        <Section icon="📦" title="Pré-requis">
          <Bullets items={[
            <>Tes ingrédients doivent avoir un <strong>fournisseur préféré</strong> renseigné.</>,
            <>Tes prestations doivent avoir des <strong>ingrédients liés</strong> avec quantité par couvert.</>,
          ]} />
        </Section>

        <Section icon="🛒" title="Depuis un événement">
          <Step n={1} title="Ouvre la fiche événement">Page <Code>/evenements/[id]</Code>.</Step>
          <Step n={2} title="Onglet « Liste de courses »">Tu vois tous les ingrédients agrégés.</Step>
          <Step n={3} title="Clique « Générer commandes »">Le système crée un bon par fournisseur, regroupant les ingrédients de ce fournisseur.</Step>
        </Section>

        <Section icon="🌐" title="Mode global (plusieurs événements)">
          <P>Page <Path items={['Catalogue', 'Courses globales']} /> :</P>
          <P>Sélectionne une plage de dates → l'app agrège les besoins de tous les événements à venir → tu génères <strong>une commande hebdo</strong> couvrant tout le périmètre.</P>
        </Section>

        <Section icon="📋" title="Suivi des commandes">
          <P>Page <Path items={['Production', 'Commandes']} /> : toutes tes commandes avec statut (à envoyer / envoyée / livrée / payée). À toi de mettre à jour quand tu reçois.</P>
          <P>Une commande "livrée" peut générer automatiquement les <strong>mouvements de stock entrée</strong> (un clic).</P>
        </Section>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // CATALOGUE
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'creer-prestation',
    category: 'catalogue',
    title: 'Créer une prestation complète',
    description: 'Avec catégorie, prix, ingrédients, carte gastronomique',
    keywords: ['service', 'plat', 'menu', 'item'],
    body: (
      <div className="space-y-4">
        <Lead>Une prestation est une "ligne vendable" : une entrée, un cocktail dînatoire, un service, un buffet… Bien créée, elle te fait gagner un temps fou sur les devis.</Lead>

        <Section icon="🎯" title="Anatomie d'une prestation">
          <Step n={1} title="Identité">
            <P>Nom, description, catégorie + sous-catégorie, photo de couverture.</P>
          </Step>
          <Step n={2} title="Prix">
            <P>Prix unitaire HT (par couvert ou unité). Tu peux avoir un <strong>prix enfant</strong> distinct.</P>
          </Step>
          <Step n={3} title="Ingrédients liés">
            <P>Chaque ingrédient avec sa quantité <strong>par couvert</strong>. Permet le calcul auto de la liste de courses + du coût matière.</P>
          </Step>
          <Step n={4} title="Carte gastronomique (HTML riche)">
            <P>Édition visuelle (mode WeboWord) : description riche, mise en forme typographique premium, bilingue FR/EN. C'est ce qui s'imprime sur la 2ème page du PDF de devis.</P>
          </Step>
        </Section>

        <Section icon="🚀" title="Créer une prestation">
          <Step n={1} title="Va sur Prestations">
            <Path items={['Catalogue', 'Prestations']} />
          </Step>
          <Step n={2} title="Bouton « + Nouveau » en haut à droite">
            <P>Modal de création.</P>
          </Step>
          <Step n={3} title="Renseigne au minimum">Nom + prix HT.</Step>
          <Step n={4} title="(Recommandé) Ajoute la catégorie">Pour pouvoir filtrer ton catalogue plus tard.</Step>
          <Step n={5} title="(Recommandé) Lie les ingrédients">Pour activer la liste de courses auto.</Step>
        </Section>

        <Section icon="🎨" title="Carte gastronomique premium">
          <P>Sur une prestation existante, bouton <Btn color="gray">Éditer la carte</Btn> → ouvre l'éditeur WeboWord (sidebar gauche dédiée).</P>
          <P>Tu peux : changer la police, les couleurs, ajouter des sections, des images, des séparateurs élégants. Édition bilingue avec traduction auto FR ↔ EN.</P>
        </Section>

        <Tip>Investis 30 min à fond pour créer 10 prestations bien faites. Tes 50 prochains devis prendront 2 min chacun.</Tip>
      </div>
    ),
  },
  {
    id: 'categories-perso',
    category: 'catalogue',
    title: 'Catégories personnelles vs globales',
    description: 'Organiser le catalogue à ta façon, sans perdre les standards',
    keywords: ['rangement', 'sous-catégorie', 'organiser', 'globale'],
    body: (
      <div className="space-y-4">
        <Lead>Tu disposes de catégories <strong>globales</strong> (fournies, standards du métier) + de tes catégories <strong>personnelles</strong> (les tiennes).</Lead>

        <Section icon="🌐" title="Globales (lecture seule)">
          <P>Catégories standards type traiteur (Apéritif, Entrée, Plat, Dessert, Cocktail, Buffet…). Visibles et utilisables par tout le monde, mais tu ne peux ni les renommer ni les supprimer.</P>
          <P>Reconnaissables au badge <Code>🌐 Globale</Code>.</P>
        </Section>

        <Section icon="⭐" title="Perso (totalement modifiables)">
          <P>Pour ajouter ta propre logique : "Cocktails signature", "Menus végétariens", "Service haut-de-gamme"... Modifiables, supprimables.</P>
        </Section>

        <Section icon="✏️" title="Gérer mes catégories perso">
          <Path items={['Paramètres', 'Catégories']} />
          <Step n={1} title="Bouton « + Catégorie »">En haut à droite.</Step>
          <Step n={2} title="Renseigne le nom">Ex : "Menus signature".</Step>
          <Step n={3} title="Déplie la catégorie">Pour ajouter des <strong>sous-catégories</strong> dedans (Ex : "Menu Tradition", "Menu Prestige").</Step>
          <Step n={4} title="Édition inline">Clique sur l'icône ✏️ pour renommer, 🗑️ pour supprimer.</Step>
        </Section>

        <Warning>Supprimer une catégorie supprime aussi ses sous-catégories. Les prestations qui l'utilisaient ne sont pas supprimées, mais perdent leur catégorie (à réassigner).</Warning>

        <Section icon="🔍" title="Comment l'utiliser dans une prestation">
          <P>Sur la fiche prestation, sélecteur "Catégorie" : tu vois <strong>tes catégories perso (⭐)</strong> mélangées aux <strong>globales (🌐)</strong>. Choisis ce qui te convient.</P>
        </Section>
      </div>
    ),
  },
  {
    id: 'fournisseurs',
    category: 'catalogue',
    title: 'Gérer mes fournisseurs',
    description: 'Carnet d\'adresses + lien aux ingrédients',
    keywords: ['supplier', 'achat', 'commande', 'fournisseur'],
    body: (
      <div className="space-y-4">
        <Lead>Tes fournisseurs sont centralisés avec leurs coordonnées et liés à tes ingrédients pour grouper les commandes.</Lead>

        <Section icon="➕" title="Créer un fournisseur">
          <Path items={['Catalogue', 'Fournisseurs', '+ Nouveau']} />
          <P>Champs : nom, contact, email, téléphone, adresse, conditions de commande, délai de livraison standard, notes.</P>
        </Section>

        <Section icon="🔗" title="Lier à un ingrédient">
          <P>Sur la fiche d'un ingrédient, sélecteur "Fournisseur préféré". Quand tu génères une commande, l'ingrédient va automatiquement sur le bon de ce fournisseur.</P>
          <Tip>Un ingrédient peut avoir plusieurs fournisseurs possibles, mais un seul "préféré" pour l'auto-routing des commandes.</Tip>
        </Section>

        <Section icon="📦" title="Bons de commande">
          <P>Les commandes générées (depuis événement ou courses globales) sont consultables dans <Path items={['Production', 'Commandes']} />, groupées par fournisseur.</P>
          <P>Tu peux les exporter en PDF pour les envoyer.</P>
        </Section>
      </div>
    ),
  },
  {
    id: 'extras-location',
    category: 'catalogue',
    title: 'Extras et matériel en location',
    description: 'Tables, chaises, vaisselle, personnel additionnel',
    keywords: ['matériel', 'mobilier', 'rental', 'location', 'extra'],
    body: (
      <div className="space-y-4">
        <Lead>Tu peux ajouter à un devis non seulement des prestations culinaires mais aussi du matériel en location et du personnel extra.</Lead>

        <Section icon="🪑" title="Location (Catalogue → Location)">
          <P>Crée tes articles louables avec : nom, prix unitaire (par jour ou forfait), photo, quantité disponible.</P>
          <P>Exemples : nappes blanches, mange-debout, vaisselle premium, sono, chauffage de terrasse.</P>
        </Section>

        <Section icon="👥" title="Extras (Catalogue → Extras)">
          <P>Personnel additionnel facturable : maître d'hôtel, serveurs, plongeurs, chef supplémentaire. Avec taux horaire ou forfait.</P>
        </Section>

        <Section icon="📦" title="Templates de location">
          <Path items={['Catalogue', 'Templates location']} />
          <P>Tu peux créer des "packages" de matériel (ex : "Pack mariage 100p" = 100 chaises + 10 tables + nappes...) à insérer en un clic dans un devis.</P>
        </Section>

        <Section icon="🌐" title="Location globale">
          <Path items={['Catalogue', 'Location']} />
          <P>Vue agrégée du matériel mobilisé par tes événements à venir. Permet de vérifier que tu as bien assez de stock disponible aux dates concernées.</P>
        </Section>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // COMPTE & PARAMÈTRES
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'profil-entreprise',
    category: 'compte',
    title: 'Compléter mon profil entreprise',
    description: 'Logo, SIRET, coordonnées, défaut TVA',
    keywords: ['identité', 'siret', 'logo', 'cgv', 'tva', 'profil'],
    body: (
      <div className="space-y-4">
        <Lead>Ces informations apparaissent en en-tête de tous tes devis. À compléter avant le tout premier envoi.</Lead>

        <Section icon="🏢" title="Identité de l'entreprise">
          <Path items={['Paramètres', 'Profil entreprise']} />
          <Bullets items={[
            <><strong>Nom commercial</strong> — apparaît en grand en haut du devis.</>,
            <><strong>SIRET</strong> — obligatoire légalement.</>,
            <><strong>Adresse complète</strong> — siège social.</>,
            <><strong>Téléphone</strong> + <strong>email</strong> de contact.</>,
            <><strong>Site web</strong> (optionnel).</>,
          ]} />
        </Section>

        <Section icon="🖼️" title="Logo">
          <P>Upload PNG ou JPG. Idéalement <strong>carré ou format 1:1</strong>, fond transparent (PNG). Apparaît en haut à gauche du PDF.</P>
        </Section>

        <Section icon="📊" title="TVA par défaut">
          <P>Champ <strong>Taux de TVA par défaut</strong> : valeur appliquée automatiquement à chaque nouveau devis (10% pour la restauration en France, 20% pour la location de matériel...). Tu peux toujours surcharger au cas par cas.</P>
        </Section>

        <Section icon="📜" title="CGV (Conditions Générales de Vente)">
          <P>Voir l'article dédié — éditeur riche, multilingue FR/EN, ajout automatique en fin de devis.</P>
        </Section>

        <Tip>Imprime un devis test après avoir tout rempli pour vérifier que ton en-tête est bien rendu.</Tip>
      </div>
    ),
  },
  {
    id: 'cgv',
    category: 'compte',
    title: 'Personnaliser mes CGV',
    description: 'Conditions Générales de Vente — éditeur riche bilingue',
    keywords: ['conditions', 'légal', 'mentions', 'contrat'],
    body: (
      <div className="space-y-4">
        <Lead>Les CGV s'impriment automatiquement à la fin de chaque devis envoyé, pour cadrer la relation commerciale.</Lead>

        <Section icon="📍" title="Où les éditer">
          <Path items={['Paramètres', 'Profil entreprise', 'CGV']} />
          <P>Éditeur riche type Word :</P>
          <Bullets items={[
            <>Titres (H2, H3), gras, italique.</>,
            <>Listes numérotées et à puces.</>,
            <>Liens hypertexte.</>,
            <>Couleurs et alignement.</>,
          ]} />
        </Section>

        <Section icon="🌍" title="Bilingue FR / EN">
          <P>Toggle <Code>FR / EN</Code> en haut de l'éditeur. Bouton <Btn color="gray">Traduire automatiquement</Btn> si tu écris en FR et veux la version EN auto-générée.</P>
          <Note>La traduction auto est un point de départ — relis et corrige les nuances juridiques importantes.</Note>
        </Section>

        <Section icon="✅" title="Ce qu'il faut mettre">
          <Bullets items={[
            <>Conditions de réservation et acompte.</>,
            <>Politique d'annulation (délais, frais).</>,
            <>Modalités de paiement.</>,
            <>Limites de responsabilité (allergènes, accidents…).</>,
            <>RGPD si tu collectes des données client.</>,
            <>Juridiction compétente.</>,
          ]} />
        </Section>

        <Warning>Fais relire tes CGV par un avocat ou juriste — c'est un document légalement contraignant.</Warning>
      </div>
    ),
  },
  {
    id: 'mot-de-passe',
    category: 'compte',
    title: 'Sécurité du compte (mot de passe)',
    description: 'Changer, récupérer, sécuriser',
    keywords: ['password', 'sécurité', 'oubli', 'connexion'],
    body: (
      <div className="space-y-4">
        <Lead>Toutes tes données client sont sensibles — sécurise ton mot de passe.</Lead>

        <Section icon="🔁" title="Changer mon mot de passe">
          <P>Pour l'instant, le changement passe par la procédure "Mot de passe oublié" :</P>
          <Step n={1} title="Déconnecte-toi">Sidebar → Déconnexion.</Step>
          <Step n={2} title="Sur l'écran de login, clique « Mot de passe oublié »">Saisis ton email.</Step>
          <Step n={3} title="Tu reçois un email avec un lien">Valable 1h.</Step>
          <Step n={4} title="Clique le lien et définis un nouveau mot de passe">Au moins 8 caractères, mix lettres + chiffres + symboles.</Step>
        </Section>

        <Section icon="🛡️" title="Bonnes pratiques">
          <Bullets items={[
            <>N'utilise pas le même mot de passe que ta boîte mail.</>,
            <>Privilégie un gestionnaire de mots de passe (Bitwarden, 1Password, KeePass).</>,
            <>Si tu partages ton compte avec un employé, crée-lui plutôt son propre compte (à venir : multi-utilisateurs par entreprise).</>,
          ]} />
        </Section>
      </div>
    ),
  },
  {
    id: 'notifications-centre',
    category: 'compte',
    title: 'Centre de notifications',
    description: 'Tout ce que l\'app a à te dire',
    keywords: ['notification', 'alerte', 'badge', 'rappel'],
    body: (
      <div className="space-y-4">
        <Lead>Toutes les alertes du système (stock bas, nouveaux prospects, devis acceptés…) atterrissent dans le centre de notifications.</Lead>

        <Section icon="📍" title="Y accéder">
          <P>Icône 🔔 en haut à droite du header → un compteur indique les non-lues.</P>
          <P>Ou directement <Path items={['/notifications']} />.</P>
        </Section>

        <Section icon="🏷️" title="Types de notifications">
          <Bullets items={[
            <><strong>Stock bas</strong> — un ingrédient est passé sous son seuil d'alerte.</>,
            <><strong>Nouveau prospect</strong> — quelqu'un a rempli ton formulaire public.</>,
            <><strong>Devis accepté</strong> — un client a accepté ton devis via le lien sécurisé.</>,
            <><strong>Devis refusé</strong> — pareil mais en négatif.</>,
            <><strong>Question client</strong> — un client a posté un message sur son lien.</>,
          ]} />
        </Section>

        <Section icon="✅" title="Gérer les notifs">
          <Bullets items={[
            <>Cliquer une notif → marquée comme lue + redirige vers le contenu concerné.</>,
            <>Bouton <Btn color="gray">Tout marquer comme lu</Btn> en haut à droite.</>,
          ]} />
        </Section>
      </div>
    ),
  },
  {
    id: 'admin-espace',
    category: 'compte',
    title: 'Espace admin (réservé)',
    description: 'Pour les utilisateurs avec rôle admin',
    keywords: ['admin', 'rôle', 'utilisateurs', 'modération'],
    body: (
      <div className="space-y-4">
        <Lead>Si ton compte a le rôle <strong>admin</strong>, un lien "Espace admin" apparaît en bas du groupe Paramètres dans la sidebar.</Lead>

        <Section icon="🛡️" title="Ce que tu peux y faire">
          <Bullets items={[
            <><strong>Dashboard global</strong> — KPIs cross-comptes (nb traiteurs, devis, CA cumulé).</>,
            <><strong>Gestion utilisateurs</strong> — voir tous les comptes, activer/désactiver, promouvoir admin.</>,
            <><strong>Catégories globales</strong> — créer/modifier les catégories standards visibles par tous.</>,
          ]} />
        </Section>

        <Note>Le rôle admin n'enlève rien à ton compte traiteur normal — tu peux gérer tes propres devis ET la plateforme.</Note>
      </div>
    ),
  },

  // ════════════════════════════════════════════════════════════════════════
  // FAQ TRANSVERSE (catégorie démarrer)
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'faq-generale',
    category: 'demarrer',
    title: 'FAQ — Questions fréquentes',
    description: 'Les questions qui reviennent le plus souvent',
    keywords: ['faq', 'questions', 'aide', 'problème'],
    body: (
      <div className="space-y-3">
        <Lead>Réponses rapides aux questions les plus courantes.</Lead>

        <FAQ q="Mes données sont-elles sauvegardées automatiquement ?">
          <P>Oui, à chaque modification dans l'éditeur de devis, sur les fiches client, prestation, événement, etc. Tu peux fermer l'onglet sans risque.</P>
        </FAQ>
        <FAQ q="Est-ce que je peux exporter mes données ?">
          <P>Pour l'instant, les devis sont exportables en PDF un par un. Un export CSV/Excel global de toute la base est en projet pour la compta.</P>
        </FAQ>
        <FAQ q="Puis-je travailler à plusieurs sur le même compte ?">
          <P>Pas encore — chaque compte est individuel. Le multi-utilisateurs par entreprise (équipe avec rôles) est en roadmap.</P>
        </FAQ>
        <FAQ q="Que se passe-t-il si je supprime un devis accepté ?">
          <P>Le devis est définitivement supprimé. L'événement associé est aussi supprimé. Action irréversible — préfère passer en "Refusé" pour conserver l'historique.</P>
        </FAQ>
        <FAQ q="Pourquoi je vois 0 devis alors que j'en ai créés ?">
          <P>Le filtre actif (statut "Refusé" sélectionné, recherche en cours, etc.) peut masquer des éléments. Reset les filtres avec l'onglet "Tous" + barre de recherche vide.</P>
        </FAQ>
        <FAQ q="Comment changer la couleur principale (violet) ?">
          <P>Pour l'instant la couleur de marque (violet WeboDevis) n'est pas personnalisable. Le branding par traiteur est prévu pour une version premium.</P>
        </FAQ>
        <FAQ q="Le client peut-il signer électroniquement le devis ?">
          <P>Le client peut "Accepter" via le lien sécurisé, ce qui vaut acceptation contractuelle (avec horodatage). Une vraie signature certifiée (eIDAS) est en projet.</P>
        </FAQ>
        <FAQ q="Puis-je avoir plusieurs entreprises dans le même compte ?">
          <P>Non — un compte = une entreprise. Si tu as plusieurs structures, crée plusieurs comptes avec des emails différents.</P>
        </FAQ>
        <FAQ q="Est-ce que mes données sont chiffrées ?">
          <P>Oui, toutes les communications avec le serveur sont en HTTPS, et la base est chiffrée au repos (AES-256). Hébergé en UE.</P>
        </FAQ>
      </div>
    ),
  },
];
