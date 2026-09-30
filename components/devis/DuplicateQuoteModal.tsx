'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, Search, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { syncWeboDocument } from '@/lib/weboFinancials';
import type { QuoteHtmlOptions } from '@/lib/generateQuoteHtml';
import { cn } from '@/lib/utils';

// Dupliquer un devis pour un autre événement : on choisit le client, la date et les couverts ; les quantités
// qui suivaient le nombre de couverts sont recalculées et le document (client, événement, tableau) mis à jour.

const SOURCE_COLUMNS = 'services, event_type, event_date, event_location, guest_count, guest_count_adults, guest_count_children, remarks, vat_rate, hide_price, template, images, content_html, selected_font, selected_font_size, language, cover_page_config, photos_page_config, client_name, client_first_name, client_last_name, client_email, client_phone, client_address, client_type, company_name, contact_person_name, client_siret, recipient_contact_id, recipient_contact_role, recipient_contact_email, recipient_contact_phone, customer_id, folder_id';

type Source = Record<string, unknown> & {
  services: Record<string, unknown>[] | null; guest_count: number | null; event_date: string | null;
  content_html: string | null; template: string | null; selected_font: string | null;
};

type Customer = {
  id: string; first_name: string | null; last_name: string | null; email: string; phone: string | null; company_name: string | null;
  customer_type: string; address: string | null; siret_number: string | null; contact_person_name: string | null;
};

const customerName = (c: Customer) =>
  (c.customer_type === 'entreprise' && c.company_name ? c.company_name : [c.first_name, c.last_name].filter(Boolean).join(' ')) || c.email;

export default function DuplicateQuoteModal({ quoteId, userId, onClose }: { quoteId: string; userId: string; onClose: () => void }) {
  const router = useRouter();
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [otherClient, setOtherClient] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState('');
  const [asTemplate, setAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    createClient().from('quotes').select(SOURCE_COLUMNS).eq('id', quoteId).single().then(({ data, error: err }) => {
      if (err || !data) { setError('Ce devis n’a pas pu être lu. Fermez et réessayez.'); return; }
      const q = data as Source;
      setSource(q);
      setDate(q.event_date ?? '');
      setGuests(q.guest_count ? String(q.guest_count) : '');
    });
  }, [quoteId]);

  useEffect(() => {
    const q = search.trim();
    if (!otherClient || q.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => {
      createClient().from('customers')
        .select('id, first_name, last_name, email, phone, company_name, customer_type, address, siret_number, contact_person_name')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`)
        .limit(6)
        .then(({ data }) => setResults((data ?? []) as Customer[]));
    }, 200);
    return () => clearTimeout(timer);
  }, [search, otherClient]);

  const create = async () => {
    if (!source) return;
    if (otherClient && !customer) { setError('Choisissez le client du nouveau devis, ou gardez le même.'); return; }
    setSaving(true); setError(null);
    const supabase = createClient();

    const oldGuests = source.guest_count ?? 0;
    const newGuests = parseInt(guests) || oldGuests || 1;
    const guestsChanged = newGuests !== oldGuests;
    // Les lignes dont la quantité suivait le nombre de couverts suivent le nouveau nombre.
    const services = (source.services ?? []).map((s) =>
      guestsChanged && oldGuests > 0 && Number(s.quantity) === oldGuests ? { ...s, quantity: newGuests } : s);

    const client = customer ? {
      client_name: customerName(customer),
      client_first_name: customer.first_name, client_last_name: customer.last_name,
      client_email: customer.email || null, client_phone: customer.phone, client_address: customer.address,
      client_type: customer.customer_type === 'entreprise' ? 'entreprise' : 'particulier',
      company_name: customer.company_name, contact_person_name: customer.contact_person_name, client_siret: customer.siret_number,
      recipient_contact_id: null, recipient_contact_role: null, recipient_contact_email: null, recipient_contact_phone: null,
      customer_id: customer.id,
    } : {
      client_name: source.client_name ?? '', client_first_name: source.client_first_name ?? null, client_last_name: source.client_last_name ?? null,
      client_email: source.client_email ?? null, client_phone: source.client_phone ?? null, client_address: source.client_address ?? null,
      client_type: source.client_type ?? 'particulier', company_name: source.company_name ?? null,
      contact_person_name: source.contact_person_name ?? null, client_siret: source.client_siret ?? null,
      recipient_contact_id: source.recipient_contact_id ?? null, recipient_contact_role: source.recipient_contact_role ?? null,
      recipient_contact_email: source.recipient_contact_email ?? null, recipient_contact_phone: source.recipient_contact_phone ?? null,
      customer_id: source.customer_id ?? null,
    };
    const adults = guestsChanged ? null : (source.guest_count_adults as number | null) ?? null;
    const children = guestsChanged ? null : (source.guest_count_children as number | null) ?? null;
    const eventDate = date || (source.event_date as string | null) || new Date().toISOString().slice(0, 10);

    // Le document mis en forme garde sa mise en page ; client, événement et tableau sont mis à jour.
    let contentHtml = source.content_html;
    if (contentHtml && (customer || guestsChanged || eventDate !== source.event_date)) {
      contentHtml = syncWeboDocument(contentHtml, {
        all: {
          companyName: '',
          clientName: client.client_name as string, clientEmail: client.client_email as string | null, clientPhone: client.client_phone as string | null,
          clientAddress: client.client_address as string | null, clientType: client.client_type as 'particulier' | 'entreprise',
          clientCompanyName: client.company_name as string | null, clientSiret: client.client_siret as string | null,
          contactName: client.contact_person_name as string | null, contactRole: client.recipient_contact_role as string | null,
          contactEmail: client.recipient_contact_email as string | null, contactPhone: client.recipient_contact_phone as string | null,
          eventType: (source.event_type as string | null) ?? null, eventDate, eventLocation: (source.event_location as string | null) ?? null,
          guestCount: newGuests, guestCountAdults: adults, guestCountChildren: children,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          services: services.filter((s) => !s.isPageBreak) as any,
          vatRate: Number(source.vat_rate ?? 20), hidePrice: !!source.hide_price,
          language: source.language === 'en' ? 'en' : 'fr',
        },
        financials: true,
        parties: true,
      }, { template: (source.template ?? undefined) as QuoteHtmlOptions['template'], font: source.selected_font ?? undefined }) ?? contentHtml;
    }

    if (asTemplate && templateName.trim()) {
      await supabase.from('devis_templates').insert({
        user_id: userId, name: templateName.trim(), services: source.services ?? [], content_html: source.content_html,
        template: source.template || 'classique', selected_font: source.selected_font, selected_font_size: source.selected_font_size || 12,
        remarks: source.remarks ?? null, vat_rate: source.vat_rate ?? 20, hide_price: source.hide_price ?? false,
      });
    }

    const res = await supabase.from('quotes').insert({
      user_id: userId, owner_user_id: userId, status: 'devis_a_faire',
      ...client,
      services, content_html: contentHtml,
      selected_font: source.selected_font, selected_font_size: source.selected_font_size || 12,
      template: source.template || 'classique', language: source.language || 'fr',
      cover_page_config: source.cover_page_config ?? null, photos_page_config: source.photos_page_config ?? null,
      event_type: source.event_type || '', event_date: eventDate, event_location: source.event_location || '',
      guest_count: newGuests, guest_count_adults: adults, guest_count_children: children,
      remarks: source.remarks ?? null, vat_rate: source.vat_rate ?? 20, hide_price: source.hide_price ?? false,
      images: source.images ?? [], folder_id: source.folder_id ?? null,
    }).select('id').single();
    if (res.error || !res.data) {
      console.error(res.error);
      setError('La copie n’a pas pu être créée. Réessayez.');
      setSaving(false);
      return;
    }
    router.push(`/devis/${res.data.id}/modifier?mode=weboword`);
  };

  const choice = (on: boolean) => cn('flex-1 h-10 rounded-lg text-sm font-medium transition-colors', on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900');

  return (
    <Modal
      title="Dupliquer le devis"
      onClose={() => !saving && onClose()}
      footer={<>
        <button onClick={onClose} disabled={saving} className={btnGhost}>Annuler</button>
        <button onClick={create} disabled={!source || saving || (asTemplate && !templateName.trim())} className={btnPrimary}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Créer la copie
        </button>
      </>}
    >
      <div className="space-y-5 pb-3">
        <p className="text-sm text-gray-600">Même contenu, même mise en page. Les quantités calculées sur le nombre de couverts suivent le nouveau nombre.</p>

        <div>
          <p className={labelCls}>Client</p>
          <div className="flex p-1 rounded-xl bg-gray-100" role="tablist" aria-label="Client du nouveau devis">
            <button role="tab" aria-selected={!otherClient} onClick={() => { setOtherClient(false); setCustomer(null); }} className={choice(!otherClient)}>
              {source?.client_name ? `Garder ${String(source.client_name).slice(0, 24)}` : 'Même client'}
            </button>
            <button role="tab" aria-selected={otherClient} onClick={() => setOtherClient(true)} className={choice(otherClient)}>Autre client</button>
          </div>
          {otherClient && (customer ? (
            <div className="flex items-center gap-3 mt-3 p-3 rounded-2xl bg-sage-100">
              {customer.customer_type === 'entreprise' ? <Building2 className="h-5 w-5 text-sage" /> : <User className="h-5 w-5 text-sage" />}
              <span className="flex-1 min-w-0 font-medium text-gray-900 truncate">{customerName(customer)}</span>
              <button onClick={() => { setCustomer(null); setSearch(''); }} className="text-sm font-medium text-primary hover:underline">Changer</button>
            </div>
          ) : (
            <div className="mt-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, email ou entreprise" aria-label="Rechercher un client" className={cn(inputCls, 'pl-11')} />
              </div>
              {results.length > 0 && (
                <ul className="mt-2 border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => setCustomer(c)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50">
                        <span className="block text-[15px] font-medium text-gray-900 truncate">{customerName(c)}</span>
                        <span className="block text-sm text-gray-500 truncate">{[c.email, c.phone].filter(Boolean).join(', ')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {search.trim().length >= 2 && results.length === 0 && <p className="mt-2 text-sm text-gray-500">Aucun client ne correspond. Créez-le d’abord dans Clients, ou gardez le même client et changez-le dans le devis.</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="dup-date" className={labelCls}>Date</label>
            <input id="dup-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="dup-guests" className={labelCls}>Couverts</label>
            <input id="dup-guests" type="number" inputMode="numeric" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2.5 text-[15px] text-gray-700">
            <input type="checkbox" checked={asTemplate} onChange={(e) => setAsTemplate(e.target.checked)} className="w-5 h-5 rounded accent-[rgb(var(--p-600))]" />
            Garder aussi ce devis comme modèle
          </label>
          {asTemplate && (
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Nom du modèle, par exemple Menu mariage 80 couverts" aria-label="Nom du modèle" className={cn(inputCls, 'mt-2')} />
          )}
        </div>

        {error && <p role="alert" className={errorCls}>{error}</p>}
      </div>
    </Modal>
  );
}
