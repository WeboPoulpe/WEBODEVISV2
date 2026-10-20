import { redirect } from 'next/navigation';

// Ancienne adresse de l'éditeur plein écran de la fiche : le texte de la carte s'édite maintenant sur place,
// dans la page de la prestation. Les liens et favoris déjà enregistrés y mènent.
export default async function PrestationEditWebo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/prestations/${encodeURIComponent(id)}`);
}
