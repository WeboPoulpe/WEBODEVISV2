import PageHead from '@/components/annuaire/PageHead';
import { container } from '@/components/site/ui';
import { directoryBase } from '@/lib/annuaire/base';
import { DIRECTORY_NAME, MAX_PHOTOS } from '@/lib/annuaire/config';
import { directoryMetadata } from '@/lib/annuaire/metadata';
import { SITE_URL } from '@/lib/site/config';

// Page pour les traiteurs : ce que comprend la fiche, comment elle est publiée, et l'accès par WeboDevis, le logiciel
// partenaire (fiche offerte à ses abonnés). La fiche seule, sans le logiciel, viendra au lot 3 : annoncée, sans prix.

export const metadata = directoryMetadata({
  title: 'Référencer mon entreprise',
  description: `Traiteur ? Présentez votre maison sur ${DIRECTORY_NAME} : photos, cartes, événements servis, et les demandes qui arrivent directement chez vous.`,
  path: '/referencer-mon-entreprise',
});

const LOGIN = `${SITE_URL}/login?source=annuaire`;

const INCLUDED = [
  { title: 'Vos photos', text: `Jusqu’à ${MAX_PHOTOS} photos de vos buffets, de vos tables, de votre équipe, dont une en couverture.` },
  { title: 'Votre présentation', text: 'Votre histoire, votre cuisine, ce qui vous distingue, avec vos mots.' },
  { title: 'Où et pour quoi', text: 'Les départements où vous vous déplacez et les événements que vous servez : on vous trouve là où vous travaillez.' },
  { title: 'Vos repères', text: 'Le nombre de convives que vous accueillez et votre prix de départ par personne, si vous le souhaitez.' },
  { title: 'Vos cartes à feuilleter', text: 'Les brochures créées dans WeboDevis, ouvertes en un clic depuis votre fiche.' },
  { title: 'Les demandes chez vous', text: 'Le formulaire de votre fiche envoie chaque demande dans vos Prospects, avec un e-mail pour vous prévenir.' },
];

const STEPS = [
  { title: 'Vous remplissez votre fiche', text: 'Depuis l’écran « Ma fiche » de WeboDevis, en quelques minutes.' },
  { title: 'Nous vérifions l’entreprise', text: 'Le numéro SIRET est contrôlé automatiquement, et nous relisons nous-mêmes les cas douteux.' },
  { title: 'Votre fiche est en ligne', text: 'Les fiches sont classées par date de publication. Personne ne paie pour passer devant.' },
];

/** Coche blanche sur un rond pourpre. */
function Check() {
  return (
    <svg aria-hidden="true" focusable="false" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#6B1235" />
      <path d="M10 16.5l4 4 8-9" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function ReferencerPage() {
  const base = await directoryBase();
  return (
    <>
      <PageHead
        base={base}
        crumbs={[{ name: 'Accueil', path: '/' }, { name: 'Référencer mon entreprise', path: '/referencer-mon-entreprise' }]}
        title="Référencer mon entreprise"
        lead="Présentez votre maison à ceux qui cherchent un traiteur près de chez eux, et recevez leurs demandes directement."
      />

      <section className={`${container} cmt-section cmt-section--near`} aria-labelledby="fiche-contenu">
        <h2 id="fiche-contenu" className="cmt-h2">Ce que comprend votre fiche</h2>
        <ul className="cmt-includes">
          {INCLUDED.map((i) => (
            <li key={i.title}><Check /><span><strong>{i.title}</strong>{i.text}</span></li>
          ))}
        </ul>
      </section>

      <section className={`${container} cmt-section`} aria-labelledby="fiche-etapes">
        <h2 id="fiche-etapes" className="cmt-h2">Comment elle est publiée</h2>
        <ol className="cmt-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="cmt-step__num" aria-hidden="true">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="cmt-purple" aria-labelledby="fiche-acces">
        <div className={`${container} cmt-purple__inner`}>
          <div className="cmt-purple__text">
            <h2 id="fiche-acces" className="cmt-purple__title">Gratuite pour les abonnés WeboDevis</h2>
            <p>
              WeboDevis, le logiciel des traiteurs, est le partenaire de {DIRECTORY_NAME}. Ses abonnés créent leur fiche depuis
              l’écran « Ma fiche », sans rien payer de plus : connectez-vous à votre compte WeboDevis pour commencer.
            </p>
            <a href={LOGIN} className="cmt-btn cmt-btn--light cmt-btn--big">Créer ma fiche avec WeboDevis</a>
            <p className="cmt-soon">Pas abonné à WeboDevis ? Une fiche seule, sans le logiciel, arrive bientôt.</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cmt-purple__photo"
            src="/annuaire/accueil/assiette.webp"
            alt="Filet mignon aux morilles et gratin, servi à l’assiette"
            width={1200}
            height={800}
            loading="lazy"
            decoding="async"
          />
        </div>
      </section>
    </>
  );
}
