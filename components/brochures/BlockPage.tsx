// Une page à blocs (éditeur avancé), telle que le lecteur la voit. Tailles en cqw, comme BrochurePages : la page
// s'affiche à l'identique à toutes les tailles. En mode `editing` (éditeur avancé), chaque bloc se sélectionne, se
// déplace (flèches, glisser) et reçoit les blocs qu'on y dépose.

import type { CSSProperties, DragEvent, ReactNode } from 'react';
import type { BrochureStyle } from '@/lib/brochure';
import type { BlockStyle, BlockTarget, ResolvedBlock } from '@/lib/brochureLayout';

const INK = '#1C2621';
const ACCENT = '#B4502D';
const MUTED = '#5b5b55';
const cq = (n: number) => `${n}cqw`;
/** Taille de titre en pixels de la palette, ramenée à la page (une page de 420 px de large ≈ 100 cqw). */
const px = (n: number) => cq(n / 4.2);
const LEVEL: Record<'l' | 'm' | 's', number> = { l: 28, m: 22, s: 16 };

export interface BlockEditing {
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Dépôt d'un bloc (`move:<id>`) ou d'un bloc neuf de la palette (`new:<type>`) à cet endroit. */
  onDrop: (at: BlockTarget, payload: string) => void;
  /** Rendu des commandes du bloc sélectionné (monter, descendre, dupliquer, supprimer). */
  controls: (id: string) => ReactNode;
}

const DRAG_TYPE = 'text/x-webo-block';

function boxStyle(s: BlockStyle | undefined): CSSProperties {
  return {
    padding: s?.padding ? px(s.padding) : undefined,
    background: s?.background ?? undefined,
    fontFamily: s?.font ? `'${s.font}', Georgia, serif` : undefined,
    textAlign: s?.align,
  };
}

const titleStyle = (s: BlockStyle | undefined, base: number): CSSProperties => ({
  margin: 0, fontSize: px(s?.titleSize ?? base), lineHeight: 1.2, fontWeight: 600, color: s?.titleColor ?? INK,
});

function Photo({ url, style }: { url: string | null; style?: CSSProperties }) {
  if (!url) return <div data-photo="" style={{ background: 'linear-gradient(135deg,#d9c8ad,#9c8a6c)', ...style }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img data-photo="" src={url} alt="" style={{ objectFit: 'cover', display: 'block', width: '100%', ...style }} />;
}

function Prestation({ b }: { b: Extract<ResolvedBlock, { type: 'prestation' }> }) {
  const { item } = b;
  if (item.missing) return <p style={{ fontSize: cq(3.2), color: '#b91c1c', textDecoration: 'line-through', margin: 0 }}>Supprimée du catalogue</p>;
  // Le nom n'est pas répété sous une fiche qui le porte déjà, sauf en texte court (sans mise en forme).
  const showName = b.show.name && (!item.titled || b.text === 'short');
  const body = (
    <div style={{ minWidth: 0 }}>
      {showName && <h2 style={titleStyle(b.style, 18)}>{item.name}</h2>}
      {b.show.text && (b.text === 'short'
        ? <p style={{ margin: `${cq(1)} 0 0`, fontSize: cq(3), lineHeight: 1.45, color: MUTED }}>{item.html}</p>
        : <div style={{ marginTop: cq(1), fontSize: cq(3.2), lineHeight: 1.5, color: INK }} dangerouslySetInnerHTML={{ __html: item.html }} />)}
      {item.price && (
        <p style={{ margin: `${cq(1.5)} 0 0`, fontSize: cq(3.3), color: ACCENT, fontWeight: 700 }}>
          {item.price}{item.childPrice && <span style={{ fontWeight: 400, color: MUTED }}> · {item.childPrice}</span>}
        </p>
      )}
    </div>
  );
  if (b.photo === 'none') return body;
  if (b.photo === 'top') return <div><Photo url={item.photoUrl} style={{ aspectRatio: '3 / 2', marginBottom: cq(2) }} />{body}</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: b.photo === 'left' ? '40% 1fr' : '1fr 40%', gap: cq(3), alignItems: 'start' }}>
      {b.photo === 'left' && <Photo url={item.photoUrl} style={{ aspectRatio: '1 / 1' }} />}
      {body}
      {b.photo === 'right' && <Photo url={item.photoUrl} style={{ aspectRatio: '1 / 1' }} />}
    </div>
  );
}

function BlockView({ b, editing, renderList }: { b: ResolvedBlock; editing?: BlockEditing; renderList: (blocks: ResolvedBlock[], at: Omit<BlockTarget, 'index'>) => ReactNode }) {
  switch (b.type) {
    case 'prestation': return <Prestation b={b} />;
    case 'title': {
      const Tag = b.level === 'l' ? 'h2' : 'h3';
      return <Tag style={titleStyle(b.style, LEVEL[b.level])}>{b.text}</Tag>;
    }
    case 'text': return <div style={{ fontSize: cq(3.3), lineHeight: 1.55, color: INK }} dangerouslySetInnerHTML={{ __html: b.html }} />;
    case 'image': return <Photo url={b.url} style={{ height: px(b.height), objectFit: b.fit }} />;
    case 'separator': return <div style={{ height: 1, background: b.color, width: `${b.width}%`, margin: `${cq(1)} auto` }} />;
    case 'spacer': return <div style={{ height: px(b.height) }} />;
    case 'columns':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${b.count}, minmax(0, 1fr))`, gap: px(b.gap) }}>
          {b.cols.map((col, i) => <div key={i} style={{ minWidth: 0, minHeight: editing ? cq(8) : undefined }}>{renderList(col, { parentId: b.id, col: i })}</div>)}
        </div>
      );
  }
}

export default function BlockPage({ page, theme, editing }: {
  page: { background: string | null; font: string | null; blocks: ResolvedBlock[] };
  theme: BrochureStyle;
  editing?: BlockEditing;
}) {
  const dropProps = (at: BlockTarget) => editing ? {
    onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.stopPropagation(); } },
    onDrop: (e: DragEvent) => { const p = e.dataTransfer.getData(DRAG_TYPE); if (p) { e.preventDefault(); e.stopPropagation(); editing.onDrop(at, p); } },
  } : {};

  const renderList = (blocks: ResolvedBlock[], at: Omit<BlockTarget, 'index'>): ReactNode => (
    <>
      {blocks.map((b, index) => {
        const view = <BlockView b={b} editing={editing} renderList={renderList} />;
        const spacing = b.type === 'spacer' || b.type === 'separator' ? 0 : cq(3);
        if (!editing) return <div key={b.id} style={{ ...boxStyle('style' in b ? b.style : undefined), marginBottom: spacing }}>{view}</div>;
        const selected = editing.selectedId === b.id;
        return (
          <div key={b.id} data-block-id={b.id}
            draggable
            onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData(DRAG_TYPE, `move:${b.id}`); }}
            onClick={(e) => { e.stopPropagation(); editing.onSelect(b.id); }}
            {...dropProps({ ...at, index })}
            style={{
              ...boxStyle('style' in b ? b.style : undefined), marginBottom: spacing, position: 'relative', cursor: 'pointer',
              outline: selected ? `2px solid ${ACCENT}` : '1px dashed rgba(0,0,0,.18)', outlineOffset: 2,
            }}>
            {view}
            {selected && <div style={{ position: 'absolute', top: -14, right: 0, zIndex: 2 }} onClick={(e) => e.stopPropagation()}>{editing.controls(b.id)}</div>}
          </div>
        );
      })}
      {/* Fin de liste : dépôt à la suite. */}
      {editing && <div {...dropProps({ ...at, index: blocks.length })} style={{ minHeight: cq(6) }} />}
    </>
  );

  return (
    <div data-page-scroll="" style={{
      position: 'absolute', inset: 0, overflowY: 'auto', padding: cq(7), color: INK,
      background: page.background ?? undefined,
      fontFamily: page.font ? `'${page.font}', Georgia, serif` : undefined,
      textAlign: theme === 'carte' ? 'left' : 'center',
    }}>
      {renderList(page.blocks, {})}
    </div>
  );
}
