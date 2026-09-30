import { ArrowDown, ArrowRight, Mail } from 'lucide-react';
import DateBlock from '@/components/ui/DateBlock';
import { cn } from '@/lib/utils';
import { Pill, Preview, previewCard } from './preview-kit';

// Le trajet d'une demande : le formulaire posé sur le site du traiteur, puis ce qui arrive dans l'app
// et les deux emails qui partent. Données inventées.

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="flex items-center h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 truncate">{value}</p>
    </div>
  );
}

function EmailLine({ subject, to }: { subject: string; to: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-9 h-9 rounded-xl bg-sage-100 text-sage flex items-center justify-center flex-shrink-0">
        <Mail className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-snug">{subject}</p>
        <p className="text-xs text-gray-500 mt-0.5">{to}</p>
      </div>
    </div>
  );
}

export default function RequestPreview({ className }: { className?: string }) {
  return (
    <Preview
      label="Exemple : Camille Roussel remplit le formulaire du site d’un traiteur pour un mariage de 120 couverts le 12 juin 2027. La demande apparaît dans WeboDevis, le traiteur reçoit un email et Camille reçoit un accusé de réception."
      className={cn('grid grid-cols-1 sm:grid-cols-[minmax(0,0.78fr)_auto_minmax(0,1.22fr)] items-center gap-3 sm:gap-4', className)}
    >
      {/* Sur le site du traiteur */}
      <div>
        <p className="text-sm text-gray-500 mb-2">Votre formulaire</p>
        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 sm:p-5">
          <p className="font-menu text-[22px] lg:text-[19px] text-gray-900 leading-tight whitespace-nowrap">Demander un devis</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 mt-4">
            <Field label="Prénom" value="Camille" />
            <Field label="Nom" value="Roussel" />
            <Field label="Type d’événement" value="Mariage" className="col-span-2" />
            <Field label="Date" value="12/06/2027" />
            <Field label="Personnes" value="120" />
          </div>
          <p className="flex items-center justify-center h-10 mt-4 rounded-lg bg-gray-900 text-white text-sm font-semibold">Envoyer la demande</p>
        </div>
      </div>

      <div className="flex justify-center text-gray-400 sm:pt-7">
        <ArrowRight className="hidden sm:block h-5 w-5" />
        <ArrowDown className="sm:hidden h-5 w-5" />
      </div>

      {/* Dans l'app */}
      <div>
        <p className="text-sm text-gray-500 mb-2">Dans WeboDevis</p>
        <div className={cn(previewCard, 'p-4 sm:p-5 shadow-card')}>
          <p className="text-base font-semibold text-gray-900 mb-3">Nouvelles demandes</p>
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50">
            <DateBlock iso="2027-06-12" className="w-12 h-12" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">Camille Roussel</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">Mariage, 120 couverts</p>
            </div>
            <Pill>Nouveau</Pill>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3.5">
            <EmailLine subject="Nouvelle demande de Camille Roussel" to="Email envoyé à votre adresse" />
            <EmailLine subject="Nous avons bien reçu votre demande" to="Accusé de réception envoyé à Camille" />
          </div>
        </div>
      </div>
    </Preview>
  );
}
