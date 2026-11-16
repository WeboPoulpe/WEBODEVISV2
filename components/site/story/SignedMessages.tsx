import { STORY } from '@/lib/site/story';
import { cn } from '@/lib/utils';

// Mercredi : le message de la cliente, puis ce que le logiciel a fait tout seul.
export default function SignedMessages({ className }: { className?: string }) {
  const bubble = 'w-fit max-w-[88%] rounded-[18px] rounded-bl-[5px] bg-white px-4 py-3 text-base text-gray-900 shadow-[0_8px_18px_-12px_rgb(0_0_0/0.35)]';
  return (
    <div className={cn('mx-auto max-w-[420px] space-y-2 text-left', className)}>
      <p className={bubble}>
        <span className="block text-xs text-gray-500">{STORY.client}</span>
        Bonjour, on vient de signer le devis en ligne&nbsp;!
      </p>
      <p className={bubble}>On a hâte d’être au 14 juin.</p>
      <p className="mx-auto !mt-5 w-fit max-w-full rounded-[18px] bg-forest px-4 py-3 text-base text-white">
        <span className="block text-xs text-primary-300">WeboDevis</span>
        Événement créé&nbsp;: checklist, matériel et courses sont prêts.
      </p>
    </div>
  );
}
