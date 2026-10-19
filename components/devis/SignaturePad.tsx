'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

export interface SignaturePadHandle {
  /** Signature en PNG (data URL), ou null si le cadre est vide. */
  toDataUrl: () => string | null;
  clear: () => void;
}

// Cadre de signature au doigt, au stylet ou à la souris. Le trait est dessiné à la résolution de l'écran
// pour rester net, et exporté en PNG sur fond transparent.
const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void }>(function SignaturePad({ onChange }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  const resize = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1C2621';
    setEmpty(true);
    onChange?.(true);
  }, [onChange]);

  useEffect(() => {
    resize();
    // Un changement d'orientation efface le cadre plutôt que de déformer la signature.
    window.addEventListener('orientationchange', resize);
    return () => window.removeEventListener('orientationchange', resize);
  }, [resize]);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = canvas.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) { setEmpty(false); onChange?.(false); }
  };
  const up = () => { drawing.current = false; last.current = null; };

  useImperativeHandle(ref, () => ({
    toDataUrl: () => (empty || !canvas.current ? null : canvas.current.toDataURL('image/png')),
    clear: resize,
  }), [empty, resize]);

  return (
    <div className="relative">
      <canvas
        ref={canvas}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        className="block w-full h-40 rounded-xl border border-dashed border-gray-300 bg-white touch-none cursor-crosshair"
        aria-label="Cadre de signature : signez avec le doigt ou la souris"
        role="img"
      />
      {empty && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">Signez ici</p>}
      {!empty && (
        <button type="button" onClick={resize} className="absolute top-2 right-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/90 border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          <Eraser className="h-3.5 w-3.5" /> Effacer
        </button>
      )}
    </div>
  );
});

export default SignaturePad;
