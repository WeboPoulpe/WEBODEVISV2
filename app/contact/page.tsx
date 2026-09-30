import ContactForm from '@/components/site/ContactForm';
import HeroPanel from '@/components/site/HeroPanel';
import { JsonLd, TextLink, container } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { CONTACT, DEMO, GUIDES_INDEX, HOME } from '@/lib/site/pages';
import { breadcrumbSchema } from '@/lib/site/schema';

const TITLE = 'Contact et demande de devis | WeboDevis';
const DESCRIPTION = 'Demandez un devis pour WeboDevis, le logiciel des traiteurs, ou envoyez-nous un message. Nous répondons par email.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: CONTACT.href });

const crumbs = [
  { name: HOME.label, path: HOME.href },
  { name: CONTACT.label, path: CONTACT.href },
];

// /contact?objet=devis présélectionne la demande de devis.
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ objet?: string | string[] }> }) {
  const { objet } = await searchParams;
  const initialKind = objet === 'devis' ? 'devis' : 'message';

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <HeroPanel
        crumbs={crumbs}
        title="Demander un devis, ou nous écrire"
        lead="Dites-nous comment vous travaillez et ce que vous attendez du logiciel. Nous vous répondons par email."
        demo={false}
      />

      <section aria-label="Formulaire de contact" className="pt-10 md:pt-16">
        <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-x-16 gap-y-10`}>
          <div className="order-2 lg:order-1 lg:pt-4">
            <h2 className="site-h2 max-w-[14ch]">Parfois plus rapide qu’un message</h2>
            <p className="site-body text-gray-700 mt-5 max-w-[40ch]">
              Pour voir le logiciel, le plus rapide reste la démonstration : <TextLink href={DEMO.href}>essayer la démo</TextLink>.
            </p>
            <p className="site-body text-gray-700 mt-4 max-w-[40ch]">
              Pour une question de métier, les <TextLink href={GUIDES_INDEX.href}>guides pratiques</TextLink> y répondent peut-être déjà.
            </p>
            <p className="site-body text-gray-700 mt-4 max-w-[40ch]">
              Pour une demande de devis, indiquez la taille de votre équipe et le type d’événements que vous réalisez&nbsp;: la proposition sera plus juste.
            </p>
          </div>
          <div className="order-1 lg:order-2"><ContactForm initialKind={initialKind} /></div>
        </div>
      </section>
    </>
  );
}
