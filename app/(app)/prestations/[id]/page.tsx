import PrestationEditor from '@/components/prestations/PrestationEditor';

// Modification d'une prestation du catalogue, sur une page complète.
export default async function PrestationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrestationEditor id={id} />;
}
