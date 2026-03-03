'use client';

import { useDevis } from '@/context/DevisContext';
import { Check } from 'lucide-react';
import StepClientEvent from './steps/StepClientEvent';
import StepPrestations from './steps/StepPrestations';
import StepOptions from './steps/StepOptions';
import StepResume from './steps/StepResume';
import StepWeboWord from './steps/StepWeboWord';

const STEPS = [
  { id: 1, label: 'Client & Événement' },
  { id: 2, label: 'Prestations' },
  { id: 3, label: 'Options' },
  { id: 4, label: 'Récapitulatif' },
  { id: 5, label: 'WeboWord' },
];

function StepIndicator() {
  const { state } = useDevis();
  const current = state.currentStep;

  return (
    <div className="flex items-center justify-center px-6 py-5 border-b border-gray-100">
      {STEPS.map((step, index) => {
        const done = current > step.id;
        const active = current === step.id;

        return (
          <div key={step.id} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200',
                  done
                    ? 'bg-[#9c27b0] text-white'
                    : active
                    ? 'bg-[#9c27b0] text-white ring-4 ring-[#9c27b0]/20'
                    : 'bg-gray-100 text-gray-400',
                ].join(' ')}
              >
                {done ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <span
                className={[
                  'text-[11px] font-medium whitespace-nowrap hidden sm:block',
                  active ? 'text-[#9c27b0]' : done ? 'text-gray-600' : 'text-gray-400',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {index < STEPS.length - 1 && (
              <div
                className={[
                  'h-0.5 w-12 sm:w-20 mx-2 mb-5 rounded-full transition-all duration-300',
                  done ? 'bg-[#9c27b0]' : 'bg-gray-200',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DevisStepper() {
  const { state, dispatch } = useDevis();
  const step = state.currentStep;

  const goNext = () => {
    if (step < 5) dispatch({ type: 'SET_STEP', payload: step + 1 });
  };

  const goPrev = () => {
    if (step > 1) dispatch({ type: 'SET_STEP', payload: step - 1 });
  };

  // WeboWord is full-screen — hide the step nav bar
  if (step === 5) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <StepWeboWord onBack={goPrev} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <StepIndicator />

      {/* Step content */}
      <div className="flex-1 p-6">
        {step === 1 && <StepClientEvent onNext={goNext} />}
        {step === 2 && <StepPrestations onNext={goNext} onBack={goPrev} />}
        {step === 3 && <StepOptions onNext={goNext} onBack={goPrev} />}
        {step === 4 && <StepResume onBack={goPrev} />}
      </div>
    </div>
  );
}
