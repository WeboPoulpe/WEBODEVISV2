'use client';

// Un « + » à droite de la feuille, en face de chaque plat de la carte, avec deux choix pour la mise en page du plat
// retouchée dans l'éditeur :
//  • elle devient la fiche de la carte de la prestation (et celle des lignes de ce devis portant ce nom) ;
//  • ou elle part dans une nouvelle prestation, copie de celle-ci : la prestation d'origine ne change pas.
// Hors du texte du devis : jamais imprimé, jamais enregistré dans le document.

import { useEffect, useState } from 'react';
import { CopyPlus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { sanitizeHtml } from '@/lib/sanitize';
import { dishCardHtml, isBlankHtml } from '@/lib/prestationCard';
import { useFeedback } from '@/components/ui/Feedback';
import { useAuth } from '@/context/AuthContext';
import { SHEET_WIDTH_PX } from './pageView';

/** Un plat, et sa position dans le conteneur de la feuille (le bord droit de la feuille pour `left`). */
interface Dish { name: string; top: number; left: number; el: HTMLElement }

/** Nom de la prestation d'un plat : son repère, ou, dans un document d'avant le repère, son premier paragraphe. */
function dishName(el: HTMLElement): string | null {
  const marked = el.getAttribute('data-webo-dish');
  if (marked) return marked;
  const first = el.firstElementChild;
  return first?.tagName === 'P' ? (first.textContent || '').trim() || null : null;
}

export function DishLayoutButtons({ editorRef, sheetRef, quoteId }: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  sheetRef: React.RefObject<HTMLDivElement | null>;
  quoteId: string;
}) {
  const { confirm, notify } = useFeedback();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const { user } = useAuth();
  // Plat dont le menu du « + » est ouvert, et nom de la nouvelle prestation en cours de saisie.
  const [open, setOpen] = useState<number | null>(null);
  const [newName, setNewName] = useState<string | null>(null);
  useEffect(() => {
    if (open === null) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); setNewName(null); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);

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
        const left = sheet.offsetLeft + sheet.offsetWidth;
        const found: Dish[] = [];
        editor.querySelectorAll<HTMLElement>('.gastro-menu > div').forEach((el) => {
          const name = dishName(el);
          if (name) found.push({ name, el, left, top: sheet.offsetTop + (el.getBoundingClientRect().top - sheetTop) / scale });
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

  /** Nouvelle prestation : copie de celle du plat (prix, catégorie, description…), avec la mise en page du plat. */
  const createFrom = async (dish: Dish, name: string) => {
    const html = sanitizeHtml(dishCardHtml(dish.el));
    if (isBlankHtml(html)) { notify('Ce plat est vide : il n’y a pas de mise en page à reprendre.', { tone: 'error' }); return; }
    if (!user) return;
    setBusy(dish.name);
    try {
      const supabase = createClient();
      const [{ data: quote }, { data: bases, error: bErr }, { data: taken }] = await Promise.all([
        supabase.from('quotes').select('language').eq('id', quoteId).single(),
        supabase.from('prestations').select('*').eq('name', dish.name).limit(1),
        supabase.from('prestations').select('id').eq('name', name).limit(1),
      ]);
      if (bErr) throw bErr;
      const base = bases?.[0];
      if (!base) {
        notify(`Aucune prestation ne s’appelle « ${dish.name} » : impossible de la copier.`, { tone: 'error' });
        return;
      }
      if (taken && taken.length > 0) {
        notify(`Une prestation s’appelle déjà « ${name} ». Choisissez un autre nom.`, { tone: 'error' });
        return;
      }
      // Devis en anglais : la mise en page va dans la fiche anglaise ; l'autre langue reprend celle d'origine.
      const en = quote?.language === 'en';
      // Mêmes champs que « Dupliquer » de la page Prestations.
      const { error } = await supabase.from('prestations').insert([{
        user_id: user.id,
        name,
        unit_price: base.unit_price,
        cost_price: base.cost_price,
        child_unit_price: base.child_unit_price,
        category: base.category,
        sub_category: base.sub_category,
        category_id: base.category_id,
        sub_category_id: base.sub_category_id,
        description: base.description,
        is_option: base.is_option,
        gastro_card_html: en ? base.gastro_card_html : html,
        gastro_card_html_en: en ? html : base.gastro_card_html_en,
      }]).select('id').single();
      if (error) throw error;
      setOpen(null);
      setNewName(null);
      notify(`Prestation « ${name} » créée avec cette mise en page. « ${dish.name} » n’a pas changé.`, { tone: 'success' });
    } catch (e) {
      console.error('Nouvelle prestation depuis un plat', e);
      notify('La nouvelle prestation n’a pas pu être créée. Vérifiez votre connexion et réessayez.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  /**
   * Retire le plat de la carte du devis (pas la ligne du tableau, ni la prestation du catalogue). Utile quand le plat
   * n'est plus relié à sa ligne (prestation renommée dans un ancien devis) : supprimer la ligne ne l'emporte pas.
   */
  const removeDish = async (dish: Dish) => {
    setOpen(null);
    const ok = await confirm({
      title: `Retirer « ${dish.name} » de la carte ?`,
      message: 'Le plat disparaît de ce devis. La ligne du tableau et la prestation du catalogue ne changent pas : retirez la ligne dans le panneau Prestations si elle n’a plus lieu d’être. Pensez à enregistrer.',
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (ok) dish.el.remove();
  };

  if (dishes.length === 0) return null;
  return (
    // Sur un écran étroit, la feuille prend toute la largeur : pas de place à côté pour les boutons.
    <div className="pointer-events-none absolute inset-0 hidden lg:block print:hidden">
      {dishes.map((d, i) => (
        <div key={`${i}-${d.name}`} className="absolute" style={{ top: d.top, left: d.left + 10, zIndex: open === i ? 30 : 10 }}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setOpen(open === i ? null : i); setNewName(null); }}
            disabled={busy !== null}
            title={`Mise en page de « ${d.name} »`}
            aria-label={`Mise en page de « ${d.name} »`}
            aria-expanded={open === i}
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
          {open === i && (
            <div className="pointer-events-auto absolute right-0 top-9 w-72 rounded-xl border border-gray-200 bg-white p-1.5 text-sm shadow-xl">
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] text-gray-500">Mise en page de « {d.name} » dans ce devis</p>
              <button
                type="button"
                onClick={() => { setOpen(null); apply(d); }}
                className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-gray-50"
              >
                <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <span>
                  <span className="block font-medium text-gray-800">Mettre à jour la prestation</span>
                  <span className="block text-xs text-gray-500">« {d.name} » prend cette mise en page.</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeDish(d)}
                className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-red-50"
              >
                <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>
                  <span className="block font-medium text-red-700">Retirer ce plat du devis</span>
                  <span className="block text-xs text-gray-500">La prestation du catalogue ne change pas.</span>
                </span>
              </button>
              {newName === null ? (
                <button
                  type="button"
                  onClick={() => setNewName(`${d.name} (variante)`)}
                  className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-gray-50"
                >
                  <CopyPlus className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span>
                    <span className="block font-medium text-gray-800">Créer une nouvelle prestation</span>
                    <span className="block text-xs text-gray-500">Copie de « {d.name} » avec cette mise en page ; l’originale ne change pas.</span>
                  </span>
                </button>
              ) : (
                <form
                  className="space-y-2 px-2.5 py-2"
                  onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createFrom(d, newName.trim()); }}
                >
                  <label className="block text-xs font-medium text-gray-700" htmlFor={`dish-new-${i}`}>Nom de la nouvelle prestation</label>
                  <input
                    id={`dish-new-${i}`}
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => setNewName(null)} className="rounded-lg px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Annuler</button>
                    <button type="submit" disabled={!newName.trim() || busy !== null} className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-60">Créer</button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
