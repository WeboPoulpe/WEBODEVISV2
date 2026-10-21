'use client';

// Un « + » à droite de la feuille, en face de chaque plat de la carte : la mise en page du plat, retouchée dans
// l'éditeur, devient la fiche de la carte de la prestation (et celle des lignes de ce devis portant ce nom).
// Hors du texte du devis : jamais imprimé, jamais enregistré dans le document.

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { sanitizeHtml } from '@/lib/sanitize';
import { isBlankHtml } from '@/lib/prestationCard';
import { useFeedback } from '@/components/ui/Feedback';
import { SHEET_WIDTH_PX } from './pageView';

interface Dish { name: string; top: number; el: HTMLElement }

/** Nom de la prestation d'un plat : son repère, ou, dans un document d'avant le repère, son premier paragraphe. */
function dishName(el: HTMLElement): string | null {
  const marked = el.getAttribute('data-webo-dish');
  if (marked) return marked;
  const first = el.firstElementChild;
  return first?.tagName === 'P' ? (first.textContent || '').trim() || null : null;
}

/** Fiche de la carte tirée d'un plat : son contenu, sans les repères du devis, centré s'il l'était. */
export function dishCardHtml(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('*').forEach((n) => {
    Array.from(n.attributes).forEach((a) => { if (a.name.startsWith('data-webo-')) n.removeAttribute(a.name); });
  });
  const inner = copy.innerHTML.trim();
  // Le plat sans fiche est centré par son enveloppe, que la fiche n'a pas : le centrage passe dans la fiche.
  return el.style.textAlign === 'center' ? `<div style="text-align:center;">${inner}</div>` : inner;
}

export function DishLayoutButtons({ editorRef, sheetRef, quoteId }: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  sheetRef: React.RefObject<HTMLDivElement | null>;
  quoteId: string;
}) {
  const { confirm, notify } = useFeedback();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    const sheet = sheetRef.current;
    if (!editor || !sheet) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = sheet.getBoundingClientRect().width;
        const scale = w > 0 ? w / SHEET_WIDTH_PX : 1;
        const sheetTop = sheet.getBoundingClientRect().top;
        const found: Dish[] = [];
        editor.querySelectorAll<HTMLElement>('.gastro-menu > div').forEach((el) => {
          const name = dishName(el);
          if (name) found.push({ name, el, top: (el.getBoundingClientRect().top - sheetTop) / scale });
        });
        setDishes(found);
      });
    };
    measure();
    const mutations = new MutationObserver(measure);
    mutations.observe(editor, { subtree: true, childList: true, characterData: true, attributes: true });
    const resize = new ResizeObserver(measure);
    resize.observe(editor);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(frame); mutations.disconnect(); resize.disconnect(); window.removeEventListener('resize', measure); };
  }, [editorRef, sheetRef]);

  const apply = async (dish: Dish) => {
    const html = sanitizeHtml(dishCardHtml(dish.el));
    if (isBlankHtml(html)) { notify('Ce plat est vide : il n’y a pas de mise en page à reprendre.', { tone: 'error' }); return; }
    const ok = await confirm({
      title: `Appliquer cette mise en page à « ${dish.name} » ?`,
      message: 'La fiche de la carte de la prestation est remplacée par ce plat tel qu’il est dans ce devis. Les prochains devis la reprendront.',
      confirmLabel: 'Appliquer',
    });
    if (!ok) return;
    setBusy(dish.name);
    try {
      const supabase = createClient();
      const { data: quote, error: qErr } = await supabase.from('quotes').select('services, language').eq('id', quoteId).single();
      if (qErr || !quote) throw qErr ?? new Error('devis introuvable');
      // Devis en anglais : c'est la fiche anglaise qui est montrée, donc celle qui est remplacée.
      const column = quote.language === 'en' ? 'gastro_card_html_en' : 'gastro_card_html';
      const key = quote.language === 'en' ? 'gastroCardHtmlEn' : 'gastroCardHtml';
      const { data: updated, error } = await supabase.from('prestations').update({ [column]: html }).eq('name', dish.name).select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        notify(`Aucune prestation ne s’appelle « ${dish.name} » : la mise en page n’a pas été reprise.`, { tone: 'error' });
        return;
      }
      // Les lignes de ce devis gardent la même fiche : « Régénérer le document » ne la défait pas.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const services: any[] = Array.isArray(quote.services) ? quote.services : [];
      if (services.some((s) => s?.name === dish.name)) {
        await supabase.from('quotes').update({ services: services.map((s) => (s?.name === dish.name ? { ...s, [key]: html } : s)) }).eq('id', quoteId);
      }
      notify(`Mise en page appliquée à la prestation « ${dish.name} ».`, { tone: 'success' });
    } catch (e) {
      console.error('Mise en page du plat vers la prestation', e);
      notify('La mise en page n’a pas pu être appliquée à la prestation. Vérifiez votre connexion et réessayez.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  if (dishes.length === 0) return null;
  return (
    // Sur un écran étroit, la feuille prend toute la largeur : pas de place à côté pour les boutons.
    <div className="pointer-events-none select-none absolute inset-0 hidden lg:block print:hidden" contentEditable={false}>
      {dishes.map((d, i) => (
        <button
          key={`${i}-${d.name}`}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply(d)}
          disabled={busy !== null}
          title={`Appliquer cette mise en page à la prestation « ${d.name} »`}
          aria-label={`Appliquer cette mise en page à la prestation « ${d.name} »`}
          className="pointer-events-auto absolute flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          style={{ top: d.top, left: 'calc(100% + 10px)' }}
        >
          <Plus className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
