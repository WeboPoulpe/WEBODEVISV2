'use client';

import { DevisProvider, useDevis } from '@/context/DevisContext';
import DevisStepper from './DevisStepper';
import { LivePreview, LivePreviewFAB } from './LivePreview';

function InnerView() {
  const { state } = useDevis();
  const isWeboWord = state.currentStep === 5;

  return (
    <div className="flex h-full">
      {/* Left — stepper. In WeboWord mode it takes full width. */}
      <div className={isWeboWord
        ? 'flex-1 min-w-0 overflow-hidden'
        : 'flex-1 min-w-0 overflow-y-auto print:hidden'
      }>
        <DevisStepper />
      </div>

      {/* Right — live preview (hidden in WeboWord step) */}
      {!isWeboWord && (
        <>
          <div className="hidden lg:flex print:!flex flex-col w-[380px] print:!w-full flex-shrink-0 border-l border-gray-200 print:border-0 bg-white sticky top-0 h-screen print:h-auto print:!static overflow-hidden print:overflow-visible">
            <LivePreview />
          </div>
          <LivePreviewFAB />
        </>
      )}
    </div>
  );
}

export default function DevisCreateView() {
  return (
    <DevisProvider>
      <InnerView />
    </DevisProvider>
  );
}
