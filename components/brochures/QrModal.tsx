'use client';

// QR code d'un lien de brochure, à télécharger (PNG pour un flyer ou un écran, SVG pour un imprimeur).

import { useMemo } from 'react';
import { Download } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary } from '@/components/ui/kit';
import { qrSvg } from '@/lib/qr';

const fileName = (label: string) => `qr-${label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brochure'}`;

function download(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

export default function QrModal({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const svg = useMemo(() => qrSvg(url), [url]);
  const svgHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const png = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 1024;
      c.getContext('2d')!.drawImage(img, 0, 0, 1024, 1024);
      download(c.toDataURL('image/png'), `${fileName(label)}.png`);
    };
    img.src = svgHref;
  };
  return (
    <Modal title={`QR code · ${label}`} onClose={onClose}
      footer={<>
        <button type="button" onClick={() => download(svgHref, `${fileName(label)}.svg`)} className={btnSecondary}><Download className="h-4 w-4" /> SVG (imprimeur)</button>
        <button type="button" onClick={png} className={btnPrimary}><Download className="h-4 w-4" /> PNG</button>
      </>}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={svgHref} alt={`QR code vers ${url}`} className="mx-auto w-56 max-w-full rounded-lg border border-gray-200" />
      <p className="mt-3 break-all text-center text-xs text-gray-500">{url}</p>
      <p className="mt-2 text-center text-sm text-gray-600">À poser sur un flyer, un menu, une carte de visite ou un stand : on le scanne, la brochure s’ouvre.</p>
    </Modal>
  );
}
