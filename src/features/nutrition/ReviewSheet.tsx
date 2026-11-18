import { useMemo, useState } from 'react';
import { rescaleItem, sumMacros } from '../../core/macros';
import type { MealItem } from '../../core/types';
import { IconX } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { MacroInline } from './MacroInline';

export interface ReviewDraft {
  name: string;
  items: MealItem[];
  notes?: string;
  simulated?: boolean;
  unmatched?: string[];
  previewUrl?: string;
}

interface ReviewSheetProps {
  title: string;
  draft: ReviewDraft;
  onConfirm: (name: string, items: MealItem[], saveAsFavorite: boolean) => void;
  onClose: () => void;
}

/**
 * Pantalla de confirmación común a foto, texto y etiqueta. El deslizador mueve los gramos y
 * los macros se recalculan conservando la densidad que estimó la IA (macros por gramo).
 */
export function ReviewSheet({ title, draft, onConfirm, onClose }: ReviewSheetProps) {
  const [name, setName] = useState(draft.name);
  const [items, setItems] = useState(draft.items);
  const [baseGrams] = useState(() => draft.items.map((i) => i.grams));
  const [favorite, setFavorite] = useState(false);
  const total = useMemo(() => sumMacros(items), [items]);

  const setGrams = (idx: number, grams: number) =>
    setItems((list) => list.map((it, i) => (i === idx ? rescaleItem(draft.items[i]!, grams) : it)));

  return (
    <Sheet title={title} onClose={onClose}>
      {draft.previewUrl && <img className="preview-img" src={draft.previewUrl} alt="Foto analizada" />}
      {draft.notes && <div className="note" style={{ marginTop: 10 }}>{draft.notes}</div>}
      {draft.unmatched && draft.unmatched.length > 0 && (
        <div className="note" style={{ marginTop: 10 }}>
          Sin reconocer: {draft.unmatched.join(', ')}
        </div>
      )}

      <label className="field" style={{ marginTop: 12 }}>
        Nombre
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="review-list">
        {items.map((it, i) => {
          const max = Math.max(50, Math.round((baseGrams[i] ?? 100) * 2.5));
          return (
            <div key={i} className="review-item">
              <div className="spread">
                <strong>{it.name}</strong>
                <button
                  className="faint"
                  onClick={() => setItems((l) => l.filter((_, j) => j !== i))}
                  aria-label={`Quitar ${it.name}`}
                >
                  <IconX size={16} />
                </button>
              </div>
              <div className="row">
                <input
                  type="range"
                  min={0}
                  max={max}
                  step={5}
                  value={it.grams}
                  onChange={(e) => setGrams(i, Number(e.target.value))}
                  aria-label={`Gramos de ${it.name}`}
                />
                <span className="num" style={{ minWidth: 56, textAlign: 'right', fontWeight: 700 }}>
                  {it.grams} g
                </span>
              </div>
              <MacroInline m={it} />
            </div>
          );
        })}
      </div>

      <div className="card spread" style={{ background: 'var(--surface-2)' }}>
        <div>
          <div className="small muted">Total</div>
          <div className="num" style={{ fontSize: 22, fontWeight: 800 }}>
            {total.kcal} kcal
          </div>
        </div>
        <MacroInline m={total} />
      </div>

      <label className="row small muted" style={{ margin: '12px 0' }}>
        <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        Guardar también como favorito (botón 1 clic)
      </label>

      <button
        className="btn btn-primary btn-block"
        disabled={items.length === 0 || !name.trim()}
        onClick={() => onConfirm(name.trim(), items.filter((i) => i.grams > 0), favorite)}
      >
        Añadir a hoy · {total.kcal} kcal
      </button>
    </Sheet>
  );
}
