import { useRef, useState } from 'react';
import { formatWeekday, nowTime, today } from '../../core/dates';
import { uid } from '../../core/id';
import { sumMacros } from '../../core/macros';
import type { Favorite, MealEntry, MealItem, MealSource } from '../../core/types';
import { fileToAIImage } from '../../services/image';
import { analyzeMealPhoto, parseMealDescription } from '../../services/nutritionAI';
import { useAppData, useQuery } from '../../state/AppData';
import { useAISettings } from '../../state/useAISettings';
import { useDaySummary } from '../../state/useDaySummary';
import { IconBarcode, IconCamera, IconLabel, IconPlus, IconStar, IconText, IconTrash, IconX } from '../../ui/icons';
import { MacroBar } from '../../ui/MacroBar';
import { Sheet } from '../../ui/Sheet';
import { FoodSheet } from './FoodSheet';
import { MacroInline } from './MacroInline';
import { ReviewSheet, type ReviewDraft } from './ReviewSheet';
import './nutrition.css';

const SOURCE_ICON: Record<MealSource, string> = {
  quick: '⚡',
  photo: '📷',
  barcode: '▥',
  label: '🏷',
  text: '✎',
  manual: '•',
};

const EMOJIS = ['🥖', '🥪', '🍗', '🍚', '🍳', '🥤', '🥗', '🍝', '🌯', '🥣', '🍌', '🧀'];

type Overlay =
  | { kind: 'review'; title: string; draft: ReviewDraft; source: MealSource }
  | { kind: 'food'; mode: 'barcode' | 'label' }
  | { kind: 'text' }
  | { kind: 'newFavorite' }
  | null;

export function NutritionView() {
  const { repo, invalidate, toast } = useAppData();
  const { client } = useAISettings();
  const date = today();
  const day = useDaySummary(date);
  const favorites = useQuery((r) => r.allFavorites(), [], [] as Favorite[]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [busy, setBusy] = useState<string>();
  const [editFavs, setEditFavs] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const addMeal = async (name: string, items: MealItem[], source: MealSource) => {
    const meal: MealEntry = { id: uid('m'), date, time: nowTime(), name, source, items, updatedAt: Date.now() };
    await repo.saveMeal(meal);
    invalidate();
    const kcal = sumMacros(items).kcal;
    toast(`+${kcal} kcal · ${name}`, 'success');
  };

  const saveFavorite = async (name: string, items: MealItem[], emoji = '⭐') => {
    await repo.saveFavorite({ id: uid('fav'), name, emoji, items, updatedAt: Date.now() });
    invalidate();
    toast(`Favorito creado: ${name}`, 'success');
  };

  const onPhoto = async (file: File) => {
    setBusy(client ? 'Analizando el plato con IA…' : 'Simulando análisis…');
    try {
      const { image, previewUrl } = await fileToAIImage(file);
      const result = await analyzeMealPhoto(client, image);
      setOverlay({
        kind: 'review',
        title: 'Revisa el plato',
        source: 'photo',
        draft: { name: result.name ?? 'Plato', items: result.items, notes: result.notes, simulated: result.simulated, previewUrl },
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo analizar la foto', 'error');
    } finally {
      setBusy(undefined);
    }
  };

  const remaining = day.remaining;

  return (
    <>
      <section className="card day-summary">
        <div className="spread">
          <div>
            <div className="small muted">{formatWeekday(date)} · consumido</div>
            <div className="kcal-big num">
              {day.consumed.kcal}
              <span className="faint" style={{ fontSize: 16, fontWeight: 600 }}>
                {' '}
                / {day.targets.kcal} kcal
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="small muted">restan</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 800, color: remaining.kcal > 0 ? 'var(--accent)' : 'var(--danger)' }}>
              {remaining.kcal}
            </div>
          </div>
        </div>
        {day.legDay && (
          <div className="chip chip-amber" style={{ marginTop: 10 }}>
            🦵 Día de pierna pesada ({day.lowerBodySets} series) · +{day.bonusKcal} kcal en carbohidratos
          </div>
        )}
        <div className="macro-grid">
          <MacroBar label="Proteína" value={day.consumed.protein} target={day.targets.protein} color="var(--protein)" />
          <MacroBar label="Carbos" value={day.consumed.carbs} target={day.targets.carbs} color="var(--carbs)" />
          <MacroBar label="Grasa" value={day.consumed.fat} target={day.targets.fat} color="var(--fat)" />
        </div>
      </section>

      <div className="spread">
        <div className="section-title" style={{ margin: 0 }}>
          Añadir en 1 clic
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditFavs((v) => !v)}>
          {editFavs ? 'Hecho' : 'Editar'}
        </button>
      </div>
      <div className="fav-strip">
        {favorites.map((f) => {
          const t = sumMacros(f.items);
          return (
            <button
              key={f.id}
              className="fav-card"
              onClick={() => (editFavs ? undefined : void addMeal(f.name, f.items, 'quick'))}
            >
              {editFavs && (
                <span
                  className="del"
                  role="button"
                  aria-label={`Borrar ${f.name}`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    await repo.deleteFavorite(f.id);
                    invalidate();
                  }}
                >
                  <IconX size={14} />
                </span>
              )}
              <span className="emoji">{f.emoji}</span>
              <span className="name">{f.name}</span>
              <span className="small num faint">
                {t.kcal} kcal · {Math.round(t.protein)}P
              </span>
            </button>
          );
        })}
        <button className="fav-card new" onClick={() => setOverlay({ kind: 'newFavorite' })}>
          <IconPlus size={22} />
          <span className="small">Nuevo favorito</span>
        </button>
      </div>

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onPhoto(f);
        }}
      />
      <div className="action-grid">
        <button className="action-btn" onClick={() => photoRef.current?.click()}>
          <IconCamera /> Foto plato
        </button>
        <button className="action-btn" onClick={() => setOverlay({ kind: 'food', mode: 'barcode' })}>
          <IconBarcode /> Código
        </button>
        <button className="action-btn" onClick={() => setOverlay({ kind: 'food', mode: 'label' })}>
          <IconLabel /> Etiqueta
        </button>
        <button className="action-btn" onClick={() => setOverlay({ kind: 'text' })}>
          <IconText /> Texto
        </button>
      </div>
      {!client && (
        <div className="small faint" style={{ textAlign: 'center' }}>
          IA en modo simulación · pega tu API key gratuita de Gemini en Ajustes ⚙
        </div>
      )}

      <section className="card">
        <h2>Hoy</h2>
        {day.meals.length === 0 && <div className="empty">Nada registrado todavía. Toca un favorito para empezar.</div>}
        {day.meals.map((m) => {
          const t = sumMacros(m.items);
          return (
            <div key={m.id} className="meal-row">
              <span className="faint" title={m.source} style={{ width: 18, textAlign: 'center' }}>
                {SOURCE_ICON[m.source]}
              </span>
              <div className="info">
                <div className="title">{m.name}</div>
                <div className="row small faint">
                  <span className="num">{m.time}</span>
                  <MacroInline m={t} />
                </div>
              </div>
              <span className="kcal num">{t.kcal}</span>
              <button
                className="btn btn-ghost btn-sm"
                aria-label="Guardar como favorito"
                onClick={() => void saveFavorite(m.name, m.items)}
              >
                <IconStar size={16} />
              </button>
              <button
                className="btn btn-ghost btn-sm"
                aria-label="Borrar comida"
                onClick={async () => {
                  await repo.deleteMeal(m.id);
                  invalidate();
                }}
              >
                <IconTrash size={16} />
              </button>
            </div>
          );
        })}
      </section>

      {busy && (
        <div className="busy-overlay">
          <div className="spinner" />
          {busy}
        </div>
      )}

      {overlay?.kind === 'review' && (
        <ReviewSheet
          title={overlay.title}
          draft={overlay.draft}
          onClose={() => setOverlay(null)}
          onConfirm={async (name, items, fav) => {
            setOverlay(null);
            await addMeal(name, items, overlay.source);
            if (fav) await saveFavorite(name, items, '⭐');
          }}
        />
      )}

      {overlay?.kind === 'food' && (
        <FoodSheet
          mode={overlay.mode}
          onClose={() => setOverlay(null)}
          onAdd={async (name, item, source) => {
            setOverlay(null);
            await addMeal(name, [item], source);
          }}
        />
      )}

      {overlay?.kind === 'text' && (
        <TextSheet
          onClose={() => setOverlay(null)}
          onParsed={(draft) => setOverlay({ kind: 'review', title: 'Revisa el desglose', draft, source: 'text' })}
        />
      )}

      {overlay?.kind === 'newFavorite' && (
        <NewFavoriteSheet
          onClose={() => setOverlay(null)}
          onSave={async (name, emoji, items) => {
            setOverlay(null);
            await saveFavorite(name, items, emoji);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

const EXAMPLES = [
  'Bocadillo con 100g de pan y 120g de lomo',
  '200g de arroz, 150g de pollo y una cucharada de aceite',
  'Batido con 1 scoop de whey, 300ml de leche y un plátano',
  'Dos huevos y 60g de pan de molde',
];

function TextSheet({ onClose, onParsed }: { onClose: () => void; onParsed: (d: ReviewDraft) => void }) {
  const { client } = useAISettings();
  const { toast } = useAppData();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const r = await parseMealDescription(client, text.trim());
      onParsed({
        name: r.name ?? text.slice(0, 40),
        items: r.items,
        notes: r.simulated ? 'Desglose con la base de datos local (sin IA).' : r.notes,
        unmatched: r.unmatched,
        simulated: r.simulated,
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet title="Describe lo que has comido" onClose={onClose}>
      <textarea
        className="input"
        rows={3}
        autoFocus
        placeholder="Bocadillo con 100g de pan y 120g de lomo"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && void submit()}
      />
      <div className="example-chips">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => setText(ex)}>
            {ex}
          </button>
        ))}
      </div>
      <button className="btn btn-primary btn-block" disabled={loading || !text.trim()} onClick={() => void submit()}>
        {loading ? <div className="spinner" /> : 'Desglosar'}
      </button>
    </Sheet>
  );
}

function NewFavoriteSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string, emoji: string, items: MealItem[]) => void;
}) {
  const { client } = useAISettings();
  const { toast } = useAppData();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🥪');
  const [desc, setDesc] = useState('');
  const [items, setItems] = useState<MealItem[]>([]);
  const [loading, setLoading] = useState(false);

  const parse = async () => {
    setLoading(true);
    try {
      const r = await parseMealDescription(client, desc);
      setItems(r.items);
      if (!name) setName(r.name && r.name.length < 40 ? r.name : desc.slice(0, 30));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  const total = sumMacros(items);

  return (
    <Sheet title="Nuevo favorito" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="example-chips">
          {EMOJIS.map((e) => (
            <button key={e} className={`chip${e === emoji ? ' chip-accent' : ''}`} style={{ fontSize: 18 }} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
        <label className="field">
          Nombre
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bocadillo de pavo y queso" />
        </label>
        <label className="field">
          Ingredientes
          <textarea
            className="input"
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="120g de pan, 80g de pavo y 30g de queso"
          />
        </label>
        <button className="btn" disabled={!desc.trim() || loading} onClick={() => void parse()}>
          {loading ? <div className="spinner" /> : 'Calcular macros'}
        </button>
        {items.length > 0 && (
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            {items.map((it, i) => (
              <div key={i} className="spread small">
                <span>
                  {it.name} <span className="faint">{it.grams} g</span>
                </span>
                <span className="num">{it.kcal} kcal</span>
              </div>
            ))}
            <div className="spread" style={{ marginTop: 8 }}>
              <strong className="num">{total.kcal} kcal</strong>
              <MacroInline m={total} />
            </div>
          </div>
        )}
        <button className="btn btn-primary" disabled={!name.trim() || items.length === 0} onClick={() => onSave(name.trim(), emoji, items)}>
          Guardar favorito
        </button>
      </div>
    </Sheet>
  );
}
