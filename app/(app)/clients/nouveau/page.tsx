import ClientForm from '@/components/clients/ClientForm';

export const metadata = { title: 'Nouveau client — WeboDevis' };

export default function NouveauClientPage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nouveau client</h1>
      <ClientForm />
    </div>
  );
}
