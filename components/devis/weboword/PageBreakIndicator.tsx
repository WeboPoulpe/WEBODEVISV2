// components/devis/weboword/PageBreakIndicator.tsx

type Props = {
  label: string  // ex: "Page 2", "Page photos"
}

export function PageBreakIndicator({ label }: Props) {
  return (
    <div
      className="flex items-center gap-2 my-1 select-none print:hidden"
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {/* Left line */}
      <div className="flex-1 h-px bg-purple-200" />
      {/* Dot + label */}
      <div className="flex items-center gap-1.5 text-purple-400 text-xs font-medium">
        <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
        {label}
        <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
      </div>
      {/* Right line */}
      <div className="flex-1 h-px bg-purple-200" />
    </div>
  )
}
