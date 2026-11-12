import FavoritesList from '@/components/annuaire/FavoritesList';
import PageHead from '@/components/annuaire/PageHead';
import { container } from '@/components/site/ui';
import { directoryBase } from '@/lib/annuaire/base';
import { directoryMetadata } from '@/lib/annuaire/metadata';

// Les favoris du visiteur : gardés dans son navigateur, sans compte. Page personnelle, donc pas indexée.

export const metadata = directoryMetadata({
  title: 'Mes favoris',
  description: 'Les traiteurs que vous avez mis de côté sur cet appareil.',
  path: '/favoris',
  noindex: true,
});

export default async function FavorisPage() {
  const base = await directoryBase();
  return (
    <>
      <PageHead
        base={base}
        crumbs={[{ name: 'Accueil', path: '/' }, { name: 'Mes favoris', path: '/favoris' }]}
        title="Mes favoris"
        lead="Les traiteurs que vous avez mis de côté. Ils restent sur cet appareil, dans votre navigateur : aucun compte, rien d’envoyé ailleurs."
      />
      <section className={`${container} cmt-section`} style={{ paddingTop: 36 }} aria-label="Traiteurs gardés">
        <FavoritesList />
      </section>
    </>
  );
}
