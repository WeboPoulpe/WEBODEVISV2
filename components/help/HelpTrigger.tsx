'use client';

import { HelpCircle } from 'lucide-react';

interface HelpTriggerProps {
  open: boolean;
  onClick: () => void;
}

export default function HelpTrigger({ open, onClick }: HelpTriggerProps) {
  if (open) return null;
  return (
    <button
      onClick={onClick}
      title="Centre d'aide"
      className="fixed right-5 bottom-20 lg:bottom-5 z-[55] w-12 h-12 rounded-full text-white shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #9c27b0, #6a1b9a)',
        boxShadow: '0 6px 20px -4px rgba(156, 39, 176, 0.5), 0 4px 8px -2px rgba(0,0,0,0.15)',
      }}
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
}
